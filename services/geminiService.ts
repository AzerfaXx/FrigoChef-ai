import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Ingredient, ShoppingItem } from "../types";

// --- Tool Definitions ---

const addToInventoryTool: FunctionDeclaration = {
  name: 'ajouterAuStock',
  description: 'Ajouter des ingrédients au STOCK (Frigo/Placard). Action immédiate.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des ingrédients à ajouter.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nom de l\'ingrédient' },
            quantity: { type: Type.STRING, description: 'Quantité (ex: 1, 500g, 2L)' },
            category: { 
              type: Type.STRING, 
              enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'] 
            },
            expiryDate: { type: Type.STRING, description: 'Format YYYY-MM-DD ou null' }
          },
          required: ['name', 'category']
        }
      }
    },
    required: ['items']
  }
};

const removeFromInventoryTool: FunctionDeclaration = {
  name: 'retirerDuStock',
  description: 'Retirer des ingrédients du stock.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Noms des articles à retirer.',
        items: { type: Type.STRING }
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
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ['items']
  }
};

const saveRecipeTool: FunctionDeclaration = {
  name: 'sauvegarderRecette',
  description: 'Sauvegarder une recette dans le carnet.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING, description: 'Description appétissante.' },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
      prepTime: { type: Type.STRING, description: 'Temps estimé (ex: 15 min)' }
    },
    required: ['title', 'ingredients', 'steps', 'description', 'prepTime']
  }
};

const toolsConfig = [
  { functionDeclarations: [addToInventoryTool, removeFromInventoryTool, addToShoppingListTool, saveRecipeTool] }
];

// --- Audio Helpers ---

export const base64ToBytes = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const pcmToAudioBuffer = (data: Uint8Array, ctx: AudioContext, sampleRate: number): AudioBuffer => {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

function encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function downsampleTo16k(input: Float32Array, sampleRate: number): Int16Array {
    const ratio = sampleRate / 16000;
    const result = new Int16Array(Math.floor(input.length / ratio));
    for (let i = 0; i < result.length; i++) {
        result[i] = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)])) * 32767;
    }
    return result;
}

// --- API Client Initialization ---

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Chat & Generation ---

export const chatWithChefStream = async function* (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  ingredients: Ingredient[],
  shoppingList: ShoppingItem[],
  useSearch: boolean = false
) {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview'; 
  // According to guidelines: "Only googleSearch is permitted. Do not use it with other tools."
  const activeTools = useSearch ? [{ googleSearch: {} }] : toolsConfig;
  
  const systemInstruction = `
    Tu es FrigoChef. Aide l'utilisateur à cuisiner.
    STOCK : ${ingredients.map(i => i.name).join(', ') || 'Vide'}
    LISTE COURSES : ${shoppingList.map(i => i.name).join(', ') || 'Vide'}
    RÈGLE : Si tu proposes une recette, sauvegarde-la TOUJOURS avec 'sauvegarderRecette'.
    Sois amical, concis et efficace.
  `;

  const chat = ai.chats.create({
    model,
    history,
    config: { tools: activeTools, systemInstruction }
  });

  const stream = await chat.sendMessageStream({ message });
  for await (const chunk of stream) yield chunk;
};

export const generateRecipePlan = async (ingredients: Ingredient[], request: string): Promise<string> => {
  const ai = getAIClient();
  const prompt = `Inventaire: ${ingredients.map(i => i.name).join(', ')}. Demande: ${request}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
  });
  return response.text || "Erreur de génération.";
};

// --- TTS Engine ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const ai = getAIClient();
    const cleanText = text.replace(/[#*_]/g, '').trim();
    if (!cleanText || !/[a-zA-Z]/.test(cleanText)) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.warn("TTS Error", error);
    return null;
  }
};

export const playTextAsAudio = async (text: string, onEnded?: () => void) => {
  const base64Audio = await generateSpeech(text);
  if (!base64Audio) { onEnded?.(); return; }

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const bytes = base64ToBytes(base64Audio);
  const buffer = pcmToAudioBuffer(bytes, ctx, 24000);
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
    try {
        const ai = getAIClient();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => console.debug('Live opened'),
                onmessage: (msg: LiveServerMessage) => {
                    if (msg.serverContent?.inputTranscription) onUpdate(msg.serverContent.inputTranscription.text);
                },
                onerror: onError,
                onclose: () => console.debug('Live closed')
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
            }
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
            // Ensuring sendRealtimeInput is initiated after the session promise resolves to prevent race conditions.
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
    } catch (e) {
        onError(e);
        return () => {};
    }
};
