import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Recipe } from '../types';
import { BookOpen, Clock, ChevronRight, Search, ChefHat, Volume2, StopCircle, Heart, Pin, Loader2, Trash2, AlignLeft, RefreshCcw, XCircle, ArrowLeft } from 'lucide-react';
import { playTextAsAudio, stopAudio } from '../services/geminiService';

interface Props {
  savedRecipes: Recipe[];
  setSavedRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

const getIngredientEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.match(/poulet|viande/)) return '🥩';
  if (lower.match(/pâte|riz/)) return '🍝';
  if (lower.match(/légume|tomate|carotte/)) return '🥕';
  if (lower.match(/œuf/)) return '🥚';
  if (lower.match(/fromage/)) return '🧀';
  return '🥘';
};

const Carnet: React.FC<Props> = ({ savedRecipes, setSavedRecipes }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const filteredRecipes = savedRecipes.filter(r => 
    showTrash ? r.isDeleted : !r.isDeleted
  ).filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const trashCount = savedRecipes.filter(r => r.isDeleted).length;

  const moveToTrash = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isDeleted: true, isPinned: false } : r));
      if (selectedRecipe?.id === id) setSelectedRecipe(null);
  };

  const restoreFromTrash = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isDeleted: false } : r));
  };

  const deletePermanently = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Supprimer définitivement cette recette ?")) {
          setSavedRecipes(prev => prev.filter(r => r.id !== id));
      }
  };

  const handlePlay = (e: React.MouseEvent, text: string) => {
      e.stopPropagation();
      setLoadingAudio(true);
      playTextAsAudio(text, () => setLoadingAudio(false));
  };

  return (
    <div className={`flex flex-col h-full transition-colors duration-500 ${showTrash ? 'bg-slate-100 dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}`}>
      
      {/* HEADER */}
      <div className={`pt-10 pb-6 px-6 border-b transition-colors shadow-sm sticky top-0 z-10 ${showTrash ? 'bg-red-50/90 dark:bg-red-950/40 border-red-100 dark:border-red-900' : 'bg-white/90 dark:bg-slate-800/90 border-slate-100 dark:border-slate-700'}`}>
         <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                {showTrash ? (
                    <>
                        <button onClick={() => setShowTrash(false)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors">
                            <ArrowLeft size={24} className="text-red-600" />
                        </button>
                        <span className="text-red-600">Corbeille</span>
                    </>
                ) : (
                    <>
                        <BookOpen className="text-emerald-600" />
                        <span className="dark:text-white">Mon Carnet</span>
                    </>
                )}
            </h1>
            {!showTrash && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg">
                    {savedRecipes.filter(r => !r.isDeleted).length}
                </span>
            )}
         </div>

         <div className="flex gap-2">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder={showTrash ? "Chercher dans la corbeille..." : "Rechercher une recette..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-white"
                 />
             </div>
             
             <button 
                onClick={() => { setShowTrash(!showTrash); setSearchTerm(''); }}
                className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all relative ${
                    showTrash 
                    ? 'bg-red-600 text-white border-red-700 shadow-lg' 
                    : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-red-500 hover:border-red-200'
                }`}
             >
                <Trash2 size={22} />
                {!showTrash && trashCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-bounce">
                        {trashCount}
                    </span>
                )}
             </button>
         </div>
      </div>

      {/* LISTE DES RECETTES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
         {filteredRecipes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                 {showTrash ? <Trash2 size={48} className="opacity-20 mb-2" /> : <ChefHat size={48} className="opacity-20 mb-2" />}
                 <p className="font-medium">{showTrash ? 'Corbeille vide' : 'Aucune recette trouvée'}</p>
             </div>
         ) : (
             filteredRecipes.map((recipe) => (
                 <div 
                    key={recipe.id}
                    onClick={() => !showTrash && setSelectedRecipe(recipe)}
                    className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border transition-all shadow-sm flex flex-col gap-2 relative ${showTrash ? 'border-red-100 dark:border-red-900 grayscale-[0.5]' : 'border-slate-100 dark:border-slate-700 hover:border-emerald-200 active:scale-[0.98]'}`}
                 >
                     <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{recipe.title}</h3>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {showTrash ? (
                                <>
                                    <button onClick={(e) => restoreFromTrash(e, recipe.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><RefreshCcw size={16} /></button>
                                    <button onClick={(e) => deletePermanently(e, recipe.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><XCircle size={16} /></button>
                                </>
                            ) : (
                                <button onClick={(e) => moveToTrash(e, recipe.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            )}
                        </div>
                     </div>
                     <p className="text-xs text-slate-500 line-clamp-2 italic">{recipe.description || recipe.steps[0]}</p>
                     <div className="flex items-center gap-2 mt-2">
                        <Clock size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{recipe.prepTime || '20 min'}</span>
                     </div>
                 </div>
             ))
         )}
      </div>

      {/* MODALE DE DÉTAIL */}
      {selectedRecipe && createPortal(
          <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom-full duration-300">
              <div className="pt-10 pb-4 px-6 border-b border-slate-100 flex items-center justify-between bg-white dark:bg-slate-900">
                  <button onClick={() => setSelectedRecipe(null)} className="p-2 rounded-full bg-slate-100"><ChevronRight className="rotate-180" /></button>
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white truncate mx-4">{selectedRecipe.title}</h2>
                  <button onClick={(e) => handlePlay(e, selectedRecipe.steps.join(' '))} className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                    {loadingAudio ? <Loader2 className="animate-spin" /> : <Volume2 />}
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                      <p className="text-sm italic text-slate-700 dark:text-slate-300">{selectedRecipe.description}</p>
                  </div>
                  <div>
                      <h3 className="font-bold mb-3 dark:text-white">Ingrédients</h3>
                      <div className="flex flex-wrap gap-2">
                          {selectedRecipe.ingredients.map((ing, i) => (
                              <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium dark:text-white">{getIngredientEmoji(ing)} {ing}</span>
                          ))}
                      </div>
                  </div>
                  <div>
                      <h3 className="font-bold mb-3 dark:text-white">Préparation</h3>
                      <div className="space-y-4">
                          {selectedRecipe.steps.map((step, i) => (
                              <div key={i} className="flex gap-3">
                                  <span className="w-6 h-6 shrink-0 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{step}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default Carnet;