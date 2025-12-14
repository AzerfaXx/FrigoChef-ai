import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Ingredient, Recipe, ShoppingItem } from '../types';
import { 
  chatWithChefStream, 
  generateRecipePlan, 
  generateSpeech, 
  base64ToBytes, 
  pcmToAudioBuffer,
  startLiveTranscription,
} from '../services/geminiService';
import { Mic, Send, Bot, Sparkles, Volume2, VolumeX, Globe, Loader2, StopCircle, ChefHat, X, ArrowRight } from 'lucide-react';

interface Props {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  setSavedRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  shoppingList: ShoppingItem[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  isActive: boolean;
}

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  
  return (
    <div className="whitespace-pre-wrap font-normal">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return <span key={index} className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-900/30 px-0.5 rounded">{part}</span>;
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

const RecipeAssistant: React.FC<Props> = ({ ingredients, setIngredients, setSavedRecipes, shoppingList, setShoppingList, isActive }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'model',
      text: "Salut ! Je suis FrigoChef. 👨‍🍳\nOn cuisine quoi de bon aujourd'hui ?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Dictation State (Live API)
  const [isRecording, setIsRecording] = useState(false);
  const [isConnectingLive, setIsConnectingLive] = useState(false);
  const stopLiveSessionRef = useRef<(() => void) | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio Queue State
  const audioQueueRef = useRef<Promise<AudioBuffer | null>[]>([]);
  const isPlayingQueueRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const isAutoPlayRef = useRef(isAutoPlay);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Dynamic Suggestions Logic (Cleaned Emojis) ---
  const getDynamicSuggestions = () => {
    const lastMsg = messages[messages.length - 1];
    const isAi = lastMsg?.role === 'model';
    const text = lastMsg?.text || '';

    // Scenario 1: Recipe was just generated
    const isRecipe = isAi && (text.includes('Ingrédients') || text.includes('Préparation') || text.includes('Instructions'));
    
    if (isRecipe) {
        return [
            "Sauvegarde cette recette",
            "Ajoute les ingrédients à ma liste"
        ];
    }

    // Scenario 2: Empty Stock
    if (ingredients.length === 0) {
        return [
            "Ajoute 6 oeufs et du lait",
            "Ajoute du beurre à la liste"
        ];
    }

    // Scenario 3: Stock has items
    return [
        "Que cuisiner avec mon stock ?",
        "Idée de dîner rapide"
    ];
  };

  const currentSuggestions = getDynamicSuggestions().slice(0, 2); // Max 2 items
  const showSuggestions = inputValue.length === 0 && !isLoading;

  const scrollToBottom = () => {
    // Only scroll if this tab is active to prevent glitches on other tabs
    if (isActive) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isPlayingAudio]);

  useEffect(() => {
      isAutoPlayRef.current = isAutoPlay;
      if (!isAutoPlay) {
          audioQueueRef.current = [];
          if (audioContextRef.current && audioContextRef.current.state === 'running') {
              audioContextRef.current.suspend();
          }
          setIsPlayingAudio(false);
          isPlayingQueueRef.current = false;
      } else {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume();
          }
      }
  }, [isAutoPlay]);

  // --- Audio Recording & Transcription Setup (Live API) ---
  
  const startRecording = async () => {
    try {
        setIsConnectingLive(true);
        const cleanup = await startLiveTranscription(
            (text) => {
                setInputValue(prev => {
                    // Smart spacing logic: Add space if prev text exists, doesn't end in space, 
                    // and new text doesn't start with space or punctuation.
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !text.startsWith(' ') && !/^[.,?!;:]/.test(text);
                    return prev + (needsSpace ? ' ' : '') + text;
                });
                
                // Auto-scroll input
                if (textareaRef.current) {
                    textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                }
            },
            (err) => {
                console.error("Transcription error", err);
                setIsRecording(false);
                setIsConnectingLive(false);
                alert("Erreur de connexion audio. Réessayez.");
            }
        );
        stopLiveSessionRef.current = cleanup;
        setIsRecording(true);
        setIsConnectingLive(false);
    } catch (err) {
        console.error("Error accessing microphone or API", err);
        setIsRecording(false);
        setIsConnectingLive(false);
        alert("Impossible d'accéder au micro ou à l'API.");
    }
  };

  const stopRecording = () => {
      if (stopLiveSessionRef.current) {
          stopLiveSessionRef.current();
          stopLiveSessionRef.current = null;
      }
      setIsRecording(false);
      setIsConnectingLive(false);
  };

  const toggleRecording = () => {
      if (isRecording || isConnectingLive) {
          stopRecording();
      } else {
          startRecording();
      }
  };

  // Ensure cleanup on unmount
  useEffect(() => {
      return () => {
          if (stopLiveSessionRef.current) {
              stopLiveSessionRef.current();
          }
      }
  }, []);

  // --- Tool Execution Logic ---
  const handleToolCall = async (name: string, args: any) => {
    if (name === 'ajouterAuStock') {
      const newItems = (args.items || []).map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        name: item.name,
        quantity: item.quantity || '1', // Default quantity if missing
        category: item.category || 'other', // AI should infer this
        expiryDate: item.expiryDate || null // AI handles date calculation
      }));
      setIngredients(prev => [...prev, ...newItems]);
      return newItems; 
    }
    
    if (name === 'retirerDuStock') {
        const itemsToRemove = (args.items || []) as string[];
        const normalizedToRemove = itemsToRemove.map(i => i.toLowerCase());
        
        setIngredients(prev => prev.filter(item => !normalizedToRemove.includes(item.name.toLowerCase())));
        return { removed: itemsToRemove };
    }

    if (name === 'modifierStock') {
        const originalName = args.originalName?.toLowerCase();
        let modifiedItem = null;

        setIngredients(prev => prev.map(item => {
            if (item.name.toLowerCase() === originalName) {
                const updated = {
                    ...item,
                    name: args.newName || item.name,
                    quantity: args.newQuantity || item.quantity,
                    category: args.newCategory || item.category
                };
                modifiedItem = updated;
                return updated;
            }
            return item;
        }));
        
        return modifiedItem ? { modified: modifiedItem } : null;
    }

    if (name === 'ajouterAuPanier') {
        const itemsToAdd = (args.items || []) as string[];
        const newShoppingItems: ShoppingItem[] = itemsToAdd.map(name => ({
            id: Date.now().toString() + Math.random(),
            name: name,
            checked: false
        }));
        setShoppingList(prev => [...prev, ...newShoppingItems]);
        return { added: itemsToAdd };
    }

    if (name === 'sauvegarderRecette') {
        const newRecipe: Recipe = {
            id: Date.now().toString(),
            title: args.title,
            description: args.description,
            ingredients: args.ingredients || [],
            steps: args.steps || [],
            prepTime: args.prepTime,
            createdAt: Date.now()
        };
        setSavedRecipes(prev => [newRecipe, ...prev]);
        return newRecipe;
    }
    return null;
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended' && isAutoPlayRef.current) {
        audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const processAudioQueue = async () => {
    if (!isAutoPlayRef.current || isPlayingQueueRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) {
        if (audioQueueRef.current.length === 0) setIsPlayingAudio(false);
        return;
    }

    setIsPlayingAudio(true);
    isPlayingQueueRef.current = true;

    try {
        const audioTask = audioQueueRef.current[0];
        const buffer = await audioTask;

        if (!isAutoPlayRef.current) {
            audioQueueRef.current = [];
            isPlayingQueueRef.current = false;
            setIsPlayingAudio(false);
            return;
        }

        audioQueueRef.current.shift();

        if (buffer) {
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                isPlayingQueueRef.current = false;
                processAudioQueue(); 
            };
            source.start(0);
        } else {
            isPlayingQueueRef.current = false;
            processAudioQueue();
        }
    } catch (error) {
        console.error("Error processing audio queue", error);
        audioQueueRef.current.shift(); 
        isPlayingQueueRef.current = false;
        processAudioQueue();
    }
  };

  const queueAudioChunk = (text: string) => {
    if (!isAutoPlayRef.current || !text.trim()) return;

    const audioTask = (async () => {
        try {
             const base64Audio = await generateSpeech(text);
             if (!base64Audio) return null;
             
             const ctx = initAudioContext();
             const bytes = base64ToBytes(base64Audio);
             return pcmToAudioBuffer(bytes, ctx, 24000);
        } catch (e) {
            console.warn("TTS Gen failed for chunk", e);
            return null;
        }
    })();

    audioQueueRef.current.push(audioTask);
    processAudioQueue();
  };

  const handleSend = async (manualText?: string) => {
    const textToSend = manualText || inputValue;
    if (!textToSend.trim()) return;

    // CRITICAL: Initialize/Resume Audio Context on user gesture to avoid mobile delays
    if (isAutoPlayRef.current) {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    // Clear previous audio queue if interrupting
    audioQueueRef.current = [];
    if (isPlayingQueueRef.current && audioContextRef.current) {
        audioContextRef.current.suspend().then(() => {
             audioContextRef.current?.resume();
             isPlayingQueueRef.current = false;
        });
    }

    try {
      const complexKeywords = ['plan', 'semaine', 'diner complet', 'menu complet'];
      const isComplex = complexKeywords.some(k => textToSend.toLowerCase().includes(k));

      if (isComplex) {
         setIsThinking(true);
         const resultText = await generateRecipePlan(ingredients, userMsg.text);
         setIsThinking(false);
         const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: resultText };
         setMessages(prev => [...prev, aiMsg]);
         queueAudioChunk(resultText);

      } else {
         const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
         
         const aiMsgId = (Date.now() + 1).toString();
         setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

         let accumulatedText = "";
         let sentenceBuffer = "";
         let firstChunkProcessed = false;
         let allFunctionCalls: any[] = [];
         let groundingUrls: string[] = [];

         const stream = chatWithChefStream(history, userMsg.text, ingredients, shoppingList, useSearch);

         for await (const chunk of stream) {
            const textChunk = chunk.text;
            
            if (textChunk) {
               accumulatedText += textChunk;
               sentenceBuffer += textChunk;
               
               // INSTANT START LOGIC (LOW LATENCY)
               if (!firstChunkProcessed && sentenceBuffer.length > 25) { 
                   const lastSpace = sentenceBuffer.lastIndexOf(' ');
                   if (lastSpace > 0) {
                        const fastChunk = sentenceBuffer.substring(0, lastSpace);
                        queueAudioChunk(fastChunk);
                        sentenceBuffer = sentenceBuffer.substring(lastSpace + 1);
                        firstChunkProcessed = true;
                   }
               }

               const sentenceRegex = /^(.+?([.!?]\s|[\n]+|[:]\s))/;
               let match;
               while ((match = sentenceBuffer.match(sentenceRegex))) {
                   const fullSentence = match[1];
                   if (fullSentence.trim().length > 0) { 
                       queueAudioChunk(fullSentence);
                       sentenceBuffer = sentenceBuffer.substring(fullSentence.length);
                       firstChunkProcessed = true;
                   } else {
                       sentenceBuffer = sentenceBuffer.substring(fullSentence.length);
                   }
               }

               if (sentenceBuffer.length > 150) {
                  const lastSpace = sentenceBuffer.lastIndexOf(' ');
                  if (lastSpace > 0) {
                      const chunk = sentenceBuffer.substring(0, lastSpace);
                      queueAudioChunk(chunk);
                      sentenceBuffer = sentenceBuffer.substring(lastSpace + 1);
                      firstChunkProcessed = true;
                  }
               }

               const textToRender = accumulatedText;
               setTimeout(() => {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: textToRender } : m));
               }, 100);
            }

            const calls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
            if (calls && calls.length > 0) allFunctionCalls = [...allFunctionCalls, ...calls];
            
            const gChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (gChunks) {
                gChunks.forEach((c: any) => {
                    if (c.web?.uri) groundingUrls.push(c.web.uri);
                });
            }
         }

         if (sentenceBuffer.trim()) {
             queueAudioChunk(sentenceBuffer);
         }

         setTimeout(() => {
             setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
         }, 100);

         if (groundingUrls.length > 0) {
             setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, groundingUrls: [...new Set(groundingUrls)] } : m));
         }

         if (allFunctionCalls.length > 0) {
             let toolOutput = "";
             for (const call of allFunctionCalls) {
                 const result = await handleToolCall(call.name, call.args);
                 if (result) {
                     if (call.name === 'ajouterAuStock') {
                         const itemNames = result.map((i: any) => i.name).join(', ');
                         toolOutput += `\n\n✅ Ajouté : **${itemNames}** au stock.`;
                         queueAudioChunk("C'est fait, j'ai ajouté ça au stock.");
                     } else if (call.name === 'retirerDuStock') {
                         const itemNames = result.removed.join(', ');
                         toolOutput += `\n\n🗑️ Retiré : **${itemNames}** du stock.`;
                         queueAudioChunk("C'est noté, j'ai retiré ces articles.");
                     } else if (call.name === 'modifierStock') {
                         if (result.modified) {
                            toolOutput += `\n\n✏️ Modifié : **${result.modified.name}** (${result.modified.quantity}).`;
                            queueAudioChunk(`Stock mis à jour pour ${result.modified.name}.`);
                         }
                     } else if (call.name === 'ajouterAuPanier') {
                         const items = result.added.join(', ');
                         toolOutput += `\n\n🛒 Ajouté liste : **${items}**.`;
                         queueAudioChunk("J'ai ajouté ça à votre liste de courses.");
                     } else if (call.name === 'sauvegarderRecette') {
                         toolOutput += `\n\n📖 Recette **${result.title}** sauvegardée !`;
                         queueAudioChunk("J'ai sauvegardé cette recette.");
                     }
                 }
             }
             if (toolOutput) {
                 accumulatedText += toolOutput;
                 setTimeout(() => {
                     setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
                 }, 100);
             }
         }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Oups, une erreur est survenue." }]);
    } finally {
      setTimeout(() => setIsLoading(false), 200);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <div className="pt-10 pb-4 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center z-20 shrink-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3">
           <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
             <ChefHat size={20} />
           </div>
           <div>
               <h2 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Assistant</h2>
               <div className="flex items-center gap-1.5">
                 <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-500'}`}></span>
                 <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">GEMINI CHEF</p>
               </div>
           </div>
        </div>
        
        <button 
             type="button"
             onClick={() => setIsAutoPlay(!isAutoPlay)}
             className={`p-2.5 rounded-xl transition-all cursor-pointer ${isAutoPlay ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-slate-600'}`}
        >
             {isAutoPlay ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            
            {msg.role === 'model' && (
                <div className={`w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-2 shadow-sm border border-emerald-200/50 dark:border-emerald-800 ${isPlayingAudio && msg.id === messages[messages.length-1].id ? 'animate-pulse' : ''}`}>
                    <Bot size={16} className="text-emerald-700 dark:text-emerald-400" />
                </div>
            )}

            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-sm shadow-emerald-200 dark:shadow-none' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-slate-200/50 dark:shadow-none'
            }`}>
              <FormattedText text={msg.text} />
              
              {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100/50 dark:border-gray-700/50">
                  <p className="text-[10px] font-bold opacity-70 mb-2 flex items-center gap-1 uppercase tracking-wider">
                    <Globe size={10} /> Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.groundingUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs bg-black/5 dark:bg-white/10 hover:bg-black/10 px-2 py-1 rounded transition truncate max-w-[150px]">
                        Source {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
            <div className="flex justify-start gap-3 animate-in fade-in">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    <Bot size={16} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                {isThinking ? (
                    <>
                      <Sparkles size={16} className="text-purple-500 animate-spin" />
                      <span className="bg-gradient-to-r from-purple-500 to-emerald-500 bg-clip-text text-transparent font-semibold text-xs">Réflexion intense...</span>
                    </>
                ) : (
                    <>
                      <Loader2 size={16} className="animate-spin text-emerald-500" />
                      <span className="text-xs font-medium">Le chef écrit...</span>
                    </>
                )}
              </div>
            </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-30 shrink-0 pb-safe relative transition-all border-t border-slate-100 dark:border-slate-800/50">
         
         {/* Dynamic Suggestions (Chips) - Max 2 items - No Emojis */}
         <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showSuggestions ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="flex items-stretch gap-2 px-2 py-2">
                {currentSuggestions.map((suggestion, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(suggestion)}
                        className="flex-1 min-w-0 text-[10px] px-2 py-2 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 whitespace-normal text-center leading-tight hover:from-emerald-50 hover:to-emerald-100 dark:hover:from-emerald-900/30 dark:hover:to-emerald-900/50 hover:text-emerald-800 dark:hover:text-emerald-300 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all font-medium flex flex-col items-center justify-center gap-1 shadow-sm cursor-pointer"
                    >
                        <span className="line-clamp-2">{suggestion}</span>
                    </button>
                ))}
            </div>
         </div>

         <div className="p-4 pt-1">
            {/* Web Toggle */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-center -translate-y-1/2 px-4 pointer-events-none">
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                <div className="pointer-events-auto px-2">
                    <button 
                    type="button"
                    onClick={() => setUseSearch(!useSearch)}
                    className={`text-[10px] font-bold flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm transition-all cursor-pointer ${useSearch ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                    >
                    <Globe size={10} /> Web {useSearch ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            </div>

            <div className="flex gap-2 items-end mt-2">
                <button
                    type="button"
                    onClick={toggleRecording}
                    className={`p-3.5 rounded-full transition-all active:scale-95 flex-shrink-0 flex items-center justify-center shadow-sm cursor-pointer ${
                        isRecording 
                        ? 'bg-rose-500 text-white' 
                        : isConnectingLive
                        ? 'bg-amber-100 text-amber-600 cursor-wait'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                    {isRecording ? <StopCircle size={22} /> : isConnectingLive ? <Loader2 size={22} className="animate-spin" /> : <Mic size={22} />}
                </button>

                <div className={`flex-1 min-w-0 flex items-center bg-white dark:bg-slate-800 rounded-[1.5rem] border transition-colors duration-200 ${
                    isRecording 
                    ? 'border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20'
                }`}>
                    {/* Recording Indicator inside Input Area */}
                    {isRecording && (
                        <div className="pl-3.5 flex items-center justify-center shrink-0">
                             <div className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </div>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isRecording ? "Je vous écoute..." : (isConnectingLive ? "Connexion..." : "Demandez une recette...")}
                        disabled={isConnectingLive}
                        readOnly={isRecording} // Prevent keyboard flicker on mobile
                        rows={1}
                        className={`flex-1 p-3.5 max-h-32 min-h-[52px] bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium resize-none transition-all ${isConnectingLive ? 'opacity-50' : ''}`}
                    />
                    
                    {inputValue.trim() && !isRecording && (
                        <button 
                            type="button"
                            onClick={() => setInputValue('')}
                            className="p-2 mr-1 text-slate-300 hover:text-slate-500 cursor-pointer shrink-0"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <button 
                    type="button"
                    onClick={() => handleSend()}
                    disabled={isLoading || !inputValue.trim() || isRecording || isConnectingLive}
                    className="bg-emerald-600 text-white p-3.5 rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-none flex-shrink-0 cursor-pointer"
                >
                    <Send size={20} className={isLoading ? 'opacity-0' : 'opacity-100'} />
                    {isLoading && <Loader2 size={20} className="absolute animate-spin" />}
                </button>
            </div>
         </div>
      </div>
      <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default RecipeAssistant;