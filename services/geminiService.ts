import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Ingredient, ShoppingItem } from "../types";

// Helper for audio encoding required by the Live API
// Following the Gemini API coding guidelines for manual base64 encoding
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper for audio decoding (base64 to bytes)
// Following the Gemini API coding guidelines for manual base64 decoding
// Exported to fix missing member error in RecipeAssistant.tsx
export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to transform raw PCM data (bytes) into an AudioBuffer
// Following the Gemini API coding guidelines for manual audio decoding
// Exported to fix missing member error in RecipeAssistant.tsx
export async function pcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function downsampleTo16k(input: Float32Array, sampleRate: number): Int16Array {
    const ratio = sampleRate / 16000;
    const result = new Int16Array(Math.floor(input.length / ratio));
    for (let i = 0; i < result.length; i++) {
        result[i] = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)])) * 32767;
    }
    return result;
}

// Définition des outils pour Gemini
const addToInventoryTool: FunctionDeclaration = {
  name: 'ajouterAuStock',
  description: 'Ajouter des ingrédients au STOCK.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'] }
          },
          required: ['name', 'category']
        }
      }
    },
    required: ['items']
  }
};

const addToShoppingListTool: FunctionDeclaration = {
  name: 'ajouterAuPanier',
  description: 'Ajouter des articles à la liste de courses.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ['items']
  }
};

const saveRecipeTool: FunctionDeclaration = {
  name: 'sauvegarderRecette',
  description: 'Sauvegarder une recette.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
      prepTime: { type: Type.STRING }
    },
    required: ['title', 'ingredients', 'steps']
  }
};

const toolsConfig = [{ functionDeclarations: [addToInventoryTool, addToShoppingListTool, saveRecipeTool] }];

// --- Fonctions Exportées ---

export const chatWithChefStream = async function* (
  history: any[],
  message: string,
  ingredients: Ingredient[],
  shoppingList: ShoppingItem[],
  useSearch: boolean = false
) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  const activeTools = useSearch ? [{ googleSearch: {} }] : toolsConfig;
  
  const systemInstruction = `Tu es FrigoChef. Aide l'utilisateur. 
    STOCK: ${ingredients.map(i => i.name).join(', ')}
    COURSES: ${shoppingList.map(i => i.name).join(', ')}`;

  const chat = ai.chats.create({
    model,
    history,
    config: { tools: activeTools, systemInstruction }
  });

  const stream = await chat.sendMessageStream({ message });
  for await (const chunk of stream) yield chunk;
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    return null;
  }
};

export const playTextAsAudio = async (text: string, onEnded?: () => void) => {
  const base64 = await generateSpeech(text);
  if (!base64) { onEnded?.(); return; }
  
  const ctx = new AudioContext({ sampleRate: 24000 });
  // Using helper function for manual base64 decoding
  const bytes = base64ToBytes(base64);
  // Using helper function for manual PCM decoding into AudioBuffer
  const buffer = await pcmToAudioBuffer(bytes, ctx, 24000);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => { onEnded?.(); ctx.close(); };
  source.start(0);
};

export const startLiveTranscription = async (
    onUpdate: (text: string) => void,
    onError: (err: any) => void,
    onVolume?: (volume: number) => void
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log("Live ON"),
            onmessage: (msg: LiveServerMessage) => {
                if (msg.serverContent?.inputTranscription) onUpdate(msg.serverContent.inputTranscription.text);
            },
            onerror: onError,
            onclose: () => console.log("Live OFF")
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} }
    });

    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (onVolume) {
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            onVolume(Math.sqrt(sum / inputData.length));
        }
        const pcm = downsampleTo16k(inputData, audioContext.sampleRate);
        const data = encode(new Uint8Array(pcm.buffer));
        sessionPromise.then(s => s.sendRealtimeInput({ media: { data, mimeType: 'audio/pcm;rate=16000' } }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return () => {
        stream.getTracks().forEach(t => t.stop());
        processor.disconnect();
        source.disconnect();
        audioContext.close();
        sessionPromise.then(s => s.close());
    };
};

export const generateRecipePlan = async (ingredients: Ingredient[], request: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Inventaire: ${ingredients.map(i => i.name).join(', ')}. Demande: ${request}`,
  });
  return response.text || "";
};