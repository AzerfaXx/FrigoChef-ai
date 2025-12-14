import { FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { Ingredient, ShoppingItem } from "../types";

// Initialize the client
const getAiClient = () => {
  // Use environment variable if available, otherwise use the provided fallback key for mobile/deployment
  const apiKey = process.env.API_KEY || "AIzaSyDpF6Q7i2BQbC1CovL01il0cZNf6ooaWiA";
  if (!apiKey) throw new Error("API_KEY not found in environment");
  return new GoogleGenAI({ apiKey });
};

// --- Tool Definitions ---

const addToInventoryTool: FunctionDeclaration = {
  name: 'ajouterAuStock',
  description: 'Ajouter des ingrédients au STOCK (Frigo/Placard). Utiliser si l\'utilisateur dit "J\'ai", "Il y a", OU si l\'utilisateur dit "Ajoute..." AVEC une date/péremption.',
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
            quantity: { type: Type.STRING, description: 'Quantité (ex: 500g, 2 paquets). Si non précisée, mettre "1".' },
            category: { 
              type: Type.STRING, 
              description: 'Catégorie DÉDUITE automatiquement.', 
              enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'] 
            },
            expiryDate: {
              type: Type.STRING,
              description: 'Date de péremption CALCULÉE au format ISO YYYY-MM-DD. (Ex: "dans 10 jours" -> Aujourd\'hui + 10 jours).'
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
  description: 'Ajouter des articles à la LISTE DE COURSES.',
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

const toolsConfig = [
  { functionDeclarations: [addToInventoryTool, removeFromInventoryTool, updateInventoryTool, addToShoppingListTool, saveRecipeTool] }
];

// --- Shared Audio Helpers ---

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
    model: "gemini-2.5-flash", 
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
  const model = "gemini-2.5-flash";
  const activeTools = useSearch ? [...toolsConfig, { googleSearch: {} }] : toolsConfig;
  
  const inventoryContext = ingredients.length > 0
    ? ingredients.map(i => `- ${i.name} (Qté: ${i.quantity})`).join('\n')
    : "Vide.";

  const shoppingContext = shoppingList.length > 0
    ? shoppingList.map(i => `- ${i.name}`).join('\n')
    : "Vide.";
  
  // DATE DU JOUR PRÉCISE
  const today = new Date();
  const dayName = today.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayNum = today.getDate();
  const month = today.toLocaleDateString('fr-FR', { month: 'long' });
  const year = today.getFullYear();
  const fullDate = `${dayName} ${dayNum} ${month} ${year}`;
  const isoDate = today.toISOString().split('T')[0];

  const systemInstruction = `
    Tu es FrigoChef, l'assistant culinaire INTELLIGENT.
    
    [DATE ACTUELLE] : ${fullDate} (ISO: ${isoDate}).
    C'est ta référence ABSOLUE.
    - Pour "périme dans 10 jours", le calcul est : ${isoDate} + 10 jours.
    - Pour "périme mardi prochain", trouve la date exacte du prochain mardi.

    [RÈGLES D'INTENTION CRITIQUES] :
    
    1. **AJOUTER AU STOCK (Inventaire)** :
       - Si l'utilisateur dit : "J'ai acheté...", "J'ai...", "Mets au frigo...".
       - OU SI l'utilisateur dit "Ajoute..." ET mentionne une DATE ou "PÉRIMER".
         > Ex: "Ajoute des yaourts qui périment le 12" -> STOCK (car date présente).
         > Ex: "Ajoute du lait péremption dans 3 jours" -> STOCK.

    2. **AJOUTER À LA LISTE (Courses)** :
       - Si l'utilisateur dit : "Ajoute...", "Il faut...", "Besoin de...".
       - SANS mention de date ou péremption.
         > Ex: "Ajoute des yaourts" -> LISTE.
         > Ex: "Il faut du lait" -> LISTE.

    [INTELLIGENCE PRODUIT] :
    - **Catégorie** : Déduis-la TOUJOURS. 
    - **Quantité** : Si l'utilisateur ne dit pas "combien", mets "1" par défaut.

    [CONTEXTE STOCK] :
    ${inventoryContext}
    
    [CONTEXTE LISTE] :
    ${shoppingContext}

    Sois concis.
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
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1") 
    .replace(/[*_#`~]/g, "") 
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .trim();

  const hasContent = /[a-zA-Z0-9éèàùçêîôûëïüÿñæœÉÈÀÙÇÊÎÔÛËÏÜŸÑÆŒ]/.test(cleanText);
  if (!cleanText || !hasContent) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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

// --- 3. Live Transcription ---

export const startLiveTranscription = async (
    onTranscriptionUpdate: (text: string) => void,
    onError: (err: any) => void
) => {
    const ai = getAiClient();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 }});
    
    const source = audioContext.createMediaStreamSource(stream);
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
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
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            systemInstruction: `
            ROLE: Transcription vocale EXPERTE pour cuisine.
            
            [RÈGLES PHONÉTIQUES ABSOLUES] :
            Tu dois CORRIGER tout ce qui ressemble à des aliments mais qui est mal prononcé ou mal compris.
            - "Style" / "Stick" -> **STEAK**
            - "Pattes" / "Pote" -> **PÂTES** ou **PATATES**
            - "Laid" / "Les" -> **LAIT**
            - "Celle" -> **SEL**
            - "Peau" / "Pot" -> **POT** ou **EAU** (selon contexte)
            - "Cour gilet" -> **COURGETTE**
            - "A mande" -> **AMANDE**

            [FORMATAGE INTELLIGENT] :
            - Si l'utilisateur dit "périme le douze", écris "périme le 12".
            - Si l'utilisateur dit "trois oeufs", écris "3 oeufs".
            - Si l'utilisateur dit "ajoute des...", écris "Ajoute des...".
            
            Ton seul but est de fournir une transcription textuelle PARFAITE pour que l'IA de gestion puisse comprendre l'intention (Stock vs Liste) juste après.
            `,
            inputAudioTranscription: {}, 
        }
    });

    scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
        const base64Data = encode(new Uint8Array(int16.buffer));

        sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: base64Data } });
        });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    return () => {
        scriptProcessor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        audioContext.close();
        sessionPromise.then(session => session.close());
    };
};