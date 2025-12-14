import { FunctionDeclaration, GoogleGenAI, Modality, Type } from "@google/genai";
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
  description: 'Ajouter un ou plusieurs ingrédients à l\'inventaire du frigo (stock actuel).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des ingrédients à ajouter.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nom de l\'ingrédient (ex: Oeufs, Lait)' },
            quantity: { type: Type.STRING, description: 'Quantité (ex: 6, 1L, 500g)' },
            category: { 
              type: Type.STRING, 
              description: 'Catégorie', 
              enum: ['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'] 
            }
          },
          required: ['name', 'quantity', 'category']
        }
      }
    },
    required: ['items']
  }
};

const removeFromInventoryTool: FunctionDeclaration = {
  name: 'retirerDuStock',
  description: 'Supprimer complètement un ou plusieurs ingrédients de l\'inventaire (ex: produit fini ou jeté).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'Liste des noms d\'ingrédients à retirer.',
        items: {
          type: Type.STRING,
          description: 'Nom de l\'ingrédient (ex: Oeufs, Lait)'
        }
      }
    },
    required: ['items']
  }
};

const updateInventoryTool: FunctionDeclaration = {
  name: 'modifierStock',
  description: 'Modifier un ingrédient existant (changer quantité, corriger nom, catégoriser). Utiliser ceci si l\'utilisateur a consommé une partie d\'un aliment mais pas tout.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      originalName: { type: Type.STRING, description: 'Nom actuel de l\'ingrédient dans la liste à modifier' },
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
  description: 'Ajouter des articles à la LISTE DE COURSES (ce qu\'il faut acheter).',
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
  description: 'Sauvegarder une recette structurée dans le carnet de recettes de l\'utilisateur.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Titre de la recette' },
      description: { type: Type.STRING, description: 'Brève description appétissante' },
      ingredients: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: 'Liste des ingrédients avec quantités' 
      },
      steps: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: 'Étapes de préparation' 
      },
      prepTime: { type: Type.STRING, description: 'Temps de préparation estimé (ex: 20 min)' }
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
  // Convert 8-bit bytes to 16-bit integers (PCM format)
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < frameCount; i++) {
    // Normalize 16-bit integer to float range [-1.0, 1.0]
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

// --- 1. Text Chat & Recipe Generation (Complex Tasks) ---

export const generateRecipePlan = async (
  ingredients: Ingredient[],
  userRequest: string
): Promise<string> => {
  const ai = getAiClient();
  const inventoryList = ingredients.length > 0 
    ? ingredients.map((i) => `- ${i.name} (${i.quantity}), expire le: ${i.expiryDate || 'N/A'}`).join("\n")
    : "Le frigo est vide.";

  const prompt = `
    Rôle : Tu es FrigoChef, un assistant culinaire expert, créatif et chaleureux.
    
    Contexte Inventaire :
    ${inventoryList}
    
    Demande Utilisateur : "${userRequest}"
    
    Objectif :
    Génère une réponse structurée (recette ou plan de repas) basée PRINCIPALEMENT sur l'inventaire fourni.
    Si des ingrédients essentiels manquent, signale-le clairement mais gentiment.
    Sois direct, n'utilise pas de phrases de remplissage inutiles.
    Utilise du **gras** pour les titres et ingrédients clés.
    Ton : Enjoué, passionné de cuisine, mais concis. Comme un vrai chef qui donne des conseils à un ami.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", 
    contents: prompt,
  });

  return response.text || "Désolé, je n'ai pas pu générer de plan pour le moment.";
};

export const chatWithChefStream = async function* (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  ingredients: Ingredient[],
  shoppingList: ShoppingItem[],
  useSearch: boolean = false
) {
  const ai = getAiClient();
  // Using Flash for maximum speed and fluidity
  const model = "gemini-2.5-flash";
  
  const activeTools = useSearch 
    ? [...toolsConfig, { googleSearch: {} }] 
    : toolsConfig;
  
  // Format inventory list for the system prompt
  const inventoryContext = ingredients.length > 0
    ? ingredients.map(i => `- ${i.name} (Qté: ${i.quantity})`).join('\n')
    : "Aucun ingrédient (frigo vide).";

  const shoppingContext = shoppingList.length > 0
    ? shoppingList.map(i => `- ${i.name} (${i.checked ? 'Acheté' : 'À acheter'})`).join('\n')
    : "Liste vide.";

  const systemInstruction = `
    Tu es FrigoChef, un chef étoilé virtuel sympathique, dynamique et ultra-efficace.
    
    ÉTAT ACTUEL :
    [STOCK FRIGO] :
    ${inventoryContext}
    
    [COURSES] :
    ${shoppingContext}
    
    TES DIRECTIVES :
    1. **Personalité** : Parle comme un humain passionné. Pas de phrases robotiques comme "Voici la réponse". Dis plutôt "Super idée ! On peut faire ça..." ou "Alors, avec ce stock, je te propose...".
    2. **Gestion du STOCK** : Utilise en priorité ce qu'il y a dans le frigo. Si l'utilisateur ajoute/retire des choses, utilise les outils silencieusement et confirme brièvement ("C'est noté !", "Ajouté !").
    3. **Gestion des COURSES** : Si l'utilisateur veut acheter quelque chose, utilise 'ajouterAuPanier'.
    4. **Sauvegarde** : Propose de sauvegarder les recettes qui semblent plaire.
    
    FORMAT :
    - Utilise le **gras** pour mettre en valeur les plats ou ingrédients.
    - Sois aéré.
    - Évite les longs pavés de texte. Préfère les listes.
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
  
  // Robust markdown and Emoji cleaning for Audio Only
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold - keep text inside
    .replace(/__(.*?)__/g, "$1") // Underline/Italic - keep text inside
    .replace(/#+\s/g, "") // Headers
    .replace(/^\s*[-*]\s+/gm, "") // List bullets at start of line
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1") // Code blocks
    .replace(/[*_#`~]/g, "") // Remove remaining markdown chars
    // Remove ALL emojis (Unicode ranges for symbols, pictographs, etc.)
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .trim();

  const hasContent = /[a-zA-Z0-9éèàùçêîôûëïüÿñæœÉÈÀÙÇÊÎÔÛËÏÜŸÑÆŒ]/.test(cleanText);

  if (!cleanText || !hasContent) return null;

  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
          throw new Error("No audio data received");
      }

      return base64Audio;
    } catch (error: any) {
      const isInternalError = error.message?.includes('500') || 
                              error.message?.includes('Internal error') || 
                              error.message?.includes('No audio data received');
      
      if (isInternalError && attempt < maxRetries) {
        attempt++;
        console.warn(`TTS Error (${error.message}). Retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      } else {
        console.error("TTS Generation failed permanently:", error);
        return null;
      }
    }
  }
  return null;
};

// --- Playback Helper for Components ---
let globalAudioContext: AudioContext | null = null;
let globalSource: AudioBufferSourceNode | null = null;

export const playTextAsAudio = async (text: string, onEnded?: () => void): Promise<void> => {
  try {
    stopAudio();

    const base64Audio = await generateSpeech(text);
    if (!base64Audio) {
        if (onEnded) onEnded();
        return;
    }

    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
    }

    const bytes = base64ToBytes(base64Audio);
    const buffer = pcmToAudioBuffer(bytes, globalAudioContext, 24000);

    const source = globalAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(globalAudioContext.destination);
    
    source.onended = () => {
        if (onEnded) onEnded();
    };

    source.start(0);
    globalSource = source;
  } catch (error) {
    console.error("Failed to play manual audio", error);
    if (onEnded) onEnded();
  }
};

export const stopAudio = () => {
    if (globalSource) {
        try {
            globalSource.stop();
        } catch (e) {}
        globalSource = null;
    }
    if (globalAudioContext) {
        // Optional: suspend if needed
    }
};

// --- 3. Speech-to-Text (Transcribe) ---

export const transcribeUserAudio = async (audioBlob: Blob): Promise<string> => {
  const ai = getAiClient();
  const base64Audio = await blobToBase64(audioBlob);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "audio/wav", 
            data: base64Audio
          }
        },
        {
          text: "Transcris cet audio en français. Ne réponds pas à la question, transcris seulement ce qui est dit."
        }
      ]
    }
  });

  return response.text?.trim() || "";
};