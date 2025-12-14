import { FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { Ingredient, ShoppingItem } from "../types";

// Initialize the client
const getAiClient = () => {
  // Direct integration of the key. 
  // We removed LocalStorage check to ensure the valid key is used even if a user had a bad key saved before.
  const apiKey = process.env.API_KEY || "AIzaSyDpF6Q7i2BQbC1CovL01il0cZNf6ooaWiA";
  return new GoogleGenAI({ apiKey });
};

// --- Tool Definitions ---

const addToInventoryTool: FunctionDeclaration = {
  name: 'ajouterAuStock',
  description: 'Ajouter des ingrédients au STOCK (Frigo/Placard). Action immédiate sans poser de questions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des ingrédients à ajouter.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nom propre de l\'ingrédient (ex: Steak, Lait, Pommes)' },
            quantity: { type: Type.STRING, description: 'Quantité. Si non précisée par l\'utilisateur, mettre "1".' },
            category: { 
              type: Type.STRING, 
              description: 'Catégorie DÉDUITE automatiquement.', 
              enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'] 
            },
            expiryDate: {
              type: Type.STRING,
              description: 'Date de péremption UNIQUEMENT si explicitement donnée par l\'utilisateur (format ISO YYYY-MM-DD). Sinon NULL.'
            }
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
  description: 'Retirer des ingrédients du stock (consommés ou jetés).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des noms d\'ingrédients à retirer.',
        items: { type: Type.STRING }
      }
    },
    required: ['items']
  }
};

const updateInventoryTool: FunctionDeclaration = {
  name: 'modifierStock',
  description: 'Modifier un ingrédient existant (quantité, date, nom).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      originalName: { type: Type.STRING, description: 'Nom actuel de l\'ingrédient' },
      newName: { type: Type.STRING, description: 'Nouveau nom (optionnel)' },
      newQuantity: { type: Type.STRING, description: 'Nouvelle quantité (optionnel)' },
      newCategory: { 
        type: Type.STRING, 
        description: 'Nouvelle catégorie (optionnel)',
        enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other']
      }
    },
    required: ['originalName']
  }
};

const addToShoppingListTool: FunctionDeclaration = {
  name: 'ajouterAuPanier',
  description: 'Ajouter des articles à la LISTE DE COURSES. Action immédiate.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des noms d\'articles à acheter.',
        items: { type: Type.STRING }
      }
    },
    required: ['items']
  }
};

const saveRecipeTool: FunctionDeclaration = {
  name: 'sauvegarderRecette',
  description: 'Sauvegarder une recette. IMPORTANT: Tu DOIS générer une "description" courte et appétissante (1 phrase) et estimer le "prepTime" (ex: 15 min) si non fournis.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING, description: 'Résumé court et appétissant du plat.' },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
      prepTime: { type: Type.STRING, description: 'Durée estimée (ex: 20 min)' }
    },
    required: ['title', 'ingredients', 'steps', 'description', 'prepTime']
  }
};

const toolsConfig = [
  { functionDeclarations: [addToInventoryTool, removeFromInventoryTool, updateInventoryTool, addToShoppingListTool, saveRecipeTool] }
];

// --- Helpers ---

export const base64ToBytes = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const pcmToAudioBuffer = (data: Uint8Array, ctx: AudioContext, sampleRate: number): AudioBuffer => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// --- AUDIO DOWNSAMPLING HELPER ---
function downsampleTo16k(input: Float32Array, sampleRate: number): Int16Array {
    if (sampleRate === 16000) {
        const res = new Int16Array(input.length);
        for (let i=0; i<input.length; i++) res[i] = input[i] * 32767;
        return res;
    }
    const ratio = sampleRate / 16000;
    const newLength = Math.floor(input.length / ratio);
    const result = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const offset = Math.floor(i * ratio);
        const val = Math.max(-1, Math.min(1, input[offset]));
        result[i] = val * 32767;
    }
    return result;
}

// --- 1. Text Chat & Recipe Generation ---

export const generateRecipePlan = async (
  ingredients: Ingredient[],
  userRequest: string
): Promise<string> => {
  const ai = getAiClient();
  const inventoryList = ingredients.length > 0 
    ? ingredients.map((i) => `- ${i.name} (${i.quantity}), expire le: ${i.expiryDate || 'N/A'}`).join("\n")
    : "Le frigo est vide.";

  const prompt = `
    Rôle : Tu es FrigoChef, un assistant culinaire expert.
    Inventaire : \n${inventoryList}
    Demande : "${userRequest}"
    Instructions : Génère une réponse structurée (recette ou plan). Sois direct et concis.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash", // Utilisation de 2.0-flash (stable)
    contents: prompt,
  });

  return response.text || "Désolé, je n'ai pas pu générer de plan.";
};

export const chatWithChefStream = async function* (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  ingredients: Ingredient[],
  shoppingList: ShoppingItem[],
  useSearch: boolean = false
) {
  const ai = getAiClient();
  const model = "gemini-2.0-flash"; // Utilisation de 2.0-flash (stable)
  const activeTools = useSearch ? [...toolsConfig, { googleSearch: {} }] : toolsConfig;
  
  const inventoryContext = ingredients.length > 0
    ? ingredients.map(i => `- ${i.name} (Qté: ${i.quantity})`).join('\n')
    : "Vide.";

  const shoppingContext = shoppingList.length > 0
    ? shoppingList.map(i => `- ${i.name}`).join('\n')
    : "Vide.";
  
  const today = new Date();
  const fullDate = `${today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const isoDate = today.toISOString().split('T')[0];

  const systemInstruction = `
    Tu es FrigoChef. Date: ${fullDate}.
    
    RÈGLES D'INTENTION STRICTES (NE PAS CONFONDRE LISTE ET STOCK):
    
    1. EXÉCUTION DIRECTE (ZERO QUESTIONS) :
       - NE DEMANDE JAMAIS la date de péremption si l'utilisateur ne l'a pas donnée. (Laisse null).
       - NE DEMANDE JAMAIS la quantité si elle n'est pas précisée. (Mets "1").
       - Exécute l'action IMMEDIATEMENT.
    
    2. LISTE DE COURSES (FUTUR/BESOIN/MANQUE): 
       - Déclencheurs : "Ajoute du lait", "Il me faut...", "On n'a plus de...", "Besoin de...", "Ajoute à la liste", "Achète...".
       - ACTION : UTILISE 'ajouterAuPanier'.
       - NOTE : "Ajoute des pommes" (sans contexte de stock) -> LISTE par défaut.

    3. GESTION STOCK (PASSÉ/ACTION FAITE): 
       - Déclencheurs : "J'ai acheté...", "J'ai pris...", "Mets dans le frigo", "Ajoute au stock", "Je reviens des courses", "J'ai [ingrédient]".
       - ACTION : UTILISE 'ajouterAuStock'.
       - IMPORTANT : Ne cherche pas à savoir la date. Ajoute direct.
       - Déclencheurs Retrait : "J'ai fini...", "Il n'y a plus de [item] DANS LE FRIGO", "J'ai jeté".
       - ACTION : UTILISE 'retirerDuStock'.

    4. GÉNÉRATION & SAUVEGARDE AUTOMATIQUE DE RECETTE :
       - QUAND TU GÉNÈRES UNE RECETTE :
         1. Affiche la recette en texte.
         2. APPELLE IMMÉDIATEMENT 'sauvegarderRecette'.
         3. IMPORTANT: Remplis le champ 'description' avec une phrase alléchante et 'prepTime' avec une estimation.

    CONTEXTE STOCK ACTUEL : 
    ${inventoryContext}

    CONTEXTE LISTE COURSES : 
    ${shoppingContext}
    
    ISO Date: ${isoDate}.
  `;

  const chat = ai.chats.create({
    model: model,
    history: history,
    config: {
      tools: activeTools,
      systemInstruction: systemInstruction
    }
  });

  const stream = await chat.sendMessageStream({ message });
  for await (const chunk of stream) {
    yield chunk;
  }
};

// --- 2. Text-to-Speech (TTS) ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  const ai = getAiClient();
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, "$1") 
    .replace(/__(.*?)__/g, "$1") 
    .replace(/#+\s/g, "") 
    .replace(/^\s*[-*]\s+/gm, "") 
    .trim();

  const hasContent = /[a-zA-Z0-9éèàùçêîôûëïüÿñæœÉÈÀÙÇÊÎÔÛËÏÜŸÑÆŒ]/.test(cleanText);
  if (!cleanText || !hasContent) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Utilisation de 2.0-flash-exp pour l'audio output
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

// --- Playback Helper ---
let globalAudioContext: AudioContext | null = null;
let globalSource: AudioBufferSourceNode | null = null;

export const playTextAsAudio = async (text: string, onEnded?: () => void): Promise<void> => {
  try {
    stopAudio();
    const base64Audio = await generateSpeech(text);
    if (!base64Audio) { if (onEnded) onEnded(); return; }

    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

    const bytes = base64ToBytes(base64Audio);
    const buffer = pcmToAudioBuffer(bytes, globalAudioContext, 24000);
    const source = globalAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(globalAudioContext.destination);
    source.onended = () => { if (onEnded) onEnded(); };
    source.start(0);
    globalSource = source;
  } catch (error) {
    console.error("Audio playback error", error);
    if (onEnded) onEnded();
  }
};

export const stopAudio = () => {
    if (globalSource) { try { globalSource.stop(); } catch (e) {} globalSource = null; }
};

// --- 3. Live Transcription (MOBILE OPTIMIZED) ---

declare global {
  interface Window {
    __liveScriptProcessor: ScriptProcessorNode | null;
  }
}

export const startLiveTranscription = async (
    onTranscriptionUpdate: (text: string) => void,
    onError: (err: any) => void,
    onVolumeChange?: (volume: number) => void
) => {
    let ai;
    try {
        ai = getAiClient();
    } catch (e) {
        onError("API_KEY_MISSING");
        return () => {};
    }

    const TARGET_SAMPLE_RATE = 16000;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    
    if (audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch (e) { console.error("Could not resume audio context", e); }
    }
    
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                channelCount: 1, 
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
    } catch (e) {
        onError(e);
        return () => {};
    }
    
    const source = audioContext.createMediaStreamSource(stream);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.5; 
    
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    window.__liveScriptProcessor = scriptProcessor;

    source.connect(gainNode);
    gainNode.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    try {
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.0-flash-exp', // Utilisation de 2.0-flash-exp pour le Live API
            callbacks: {
                onopen: () => console.log("Live Connected"),
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text) onTranscriptionUpdate(text);
                    }
                },
                onclose: () => console.log("Live Closed"),
                onerror: (err) => onError(err)
            },
            config: {
                responseModalities: [Modality.AUDIO], 
                generationConfig: { 
                    temperature: 0 
                },
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                // OPTIMIZED SYSTEM PROMPT FOR COOKING INGREDIENTS
                systemInstruction: `
                CONTEXTE: Transcription Speech-to-Text CULINAIRE.
                TACHE: Transcrire la parole en texte EXACTEMENT.
                
                RÈGLES STRICTES:
                1. ORTHOGRAPHE : "Pâtes" (pas pattes), "Steak" (pas stick), "Lait" (pas les).
                2. NOMBRES : Écris TOUJOURS en CHIFFRES (ex: "3 oeufs", "1 litre", "250g").
                3. NE PAS COUPER LES MOTS (ex: "steak" et pas "ste ak").
                `,
                inputAudioTranscription: {}, 
            }
        });

        scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            if (onVolumeChange) {
                let sum = 0;
                for (let i = 0; i < inputData.length; i += 4) {
                    sum += inputData[i] * inputData[i];
                }
                onVolumeChange(Math.sqrt(sum / (inputData.length / 4)));
            }

            const downsampledInt16 = downsampleTo16k(inputData, audioContext.sampleRate);
            const base64Data = encode(new Uint8Array(downsampledInt16.buffer));

            sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: { mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`, data: base64Data } });
            }).catch(err => {
                // Silent catch
            });
        };

        return () => {
            window.__liveScriptProcessor = null;
            scriptProcessor.disconnect();
            gainNode.disconnect();
            source.disconnect();
            stream.getTracks().forEach(t => t.stop());
            audioContext.close();
            sessionPromise.then(session => session.close());
        };
    } catch (e) {
        onError(e);
        return () => {
             stream.getTracks().forEach(t => t.stop());
             audioContext.close();
        };
    }
};