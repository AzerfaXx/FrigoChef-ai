
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Recipe } from '../types';
import { BookOpen, Clock, ChevronRight, Search, ChefHat, Volume2, StopCircle, Heart, Pin, Loader2 } from 'lucide-react';
import { playTextAsAudio, stopAudio } from '../services/geminiService';

interface Props {
  savedRecipes: Recipe[];
  setSavedRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

const Carnet: React.FC<Props> = ({ savedRecipes, setSavedRecipes }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingSection, setPlayingSection] = useState<'ingredients' | 'steps' | null>(null);
  const [loadingSection, setLoadingSection] = useState<'ingredients' | 'steps' | null>(null);

  const filteredRecipes = savedRecipes.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.ingredients.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    // Pinned items first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Then favorites (optional, let's say favorites are secondary priority)
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    // Finally by date
    return b.createdAt - a.createdAt;
  });

  const toggleAudio = (e: React.MouseEvent, section: 'ingredients' | 'steps', text: string) => {
      e.stopPropagation();

      if (playingSection === section) {
          // If currently playing this section, stop it
          stopAudio();
          setPlayingSection(null);
          setLoadingSection(null);
      } else {
          // If playing something else or nothing, start this
          stopAudio(); // Ensure previous is stopped
          setLoadingSection(section); // Show loading spinner immediately
          setPlayingSection(null); // Clear previous playing state

          playTextAsAudio(text, () => {
              // Reset state when audio finishes naturally
              setPlayingSection(null);
          }).then(() => {
              // Audio has started (or failed), remove loading, set playing
              setLoadingSection(null);
              setPlayingSection(section);
          });
      }
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r));
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isPinned: !r.isPinned } : r));
  };

  const handlePlayIngredients = (e: React.MouseEvent, recipe: Recipe) => {
      const text = "Voici la liste des ingrédients : " + recipe.ingredients.join(", ");
      toggleAudio(e, 'ingredients', text);
  };

  const handlePlaySteps = (e: React.MouseEvent, recipe: Recipe) => {
      const text = "Voici les étapes de préparation : " + recipe.steps.join(". ");
      toggleAudio(e, 'steps', text);
  };

  const closeModal = () => {
      stopAudio();
      setPlayingSection(null);
      setLoadingSection(null);
      setSelectedRecipe(null);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative">
      {/* Detail Modal - Rendered via Portal to cover the entire App including Bottom Nav */}
      {selectedRecipe && createPortal(
          <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom-full duration-300">
             <div className="pt-10 pb-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
                 <button 
                    onClick={closeModal}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                 >
                     <ChevronRight className="rotate-180" />
                 </button>
                 <h2 className="text-xl font-bold truncate flex-1 text-slate-900 dark:text-white">{selectedRecipe.title}</h2>
                 
                 <div className="flex gap-2">
                    <button 
                        onClick={(e) => togglePin(e, selectedRecipe.id)}
                        className={`p-2 rounded-full transition-colors ${selectedRecipe.isPinned ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Pin size={20} className={selectedRecipe.isPinned ? "fill-current" : ""} />
                    </button>
                    <button 
                        onClick={(e) => toggleFavorite(e, selectedRecipe.id)}
                        className={`p-2 rounded-full transition-colors ${selectedRecipe.isFavorite ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Heart size={20} className={selectedRecipe.isFavorite ? "fill-current" : ""} />
                    </button>
                 </div>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
                 {selectedRecipe.description && (
                     <p className="text-slate-600 dark:text-slate-400 italic text-sm border-l-4 border-emerald-500 pl-4 py-1">
                       {selectedRecipe.description}
                     </p>
                 )}
                 
                 <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl w-max">
                     <Clock size={16} className="text-emerald-500" />
                     <span className="font-medium">{selectedRecipe.prepTime || 'Temps libre'}</span>
                 </div>

                 <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Ingrédients
                        </h3>
                        <button 
                            onClick={(e) => handlePlayIngredients(e, selectedRecipe)}
                            className={`p-2 rounded-full transition-all active:scale-95 ${
                                playingSection === 'ingredients' || loadingSection === 'ingredients'
                                ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                        >
                            {loadingSection === 'ingredients' ? <Loader2 size={18} className="animate-spin" /> : 
                             playingSection === 'ingredients' ? <StopCircle size={18} /> : 
                             <Volume2 size={18} />}
                        </button>
                     </div>
                     <ul className="space-y-3">
                         {selectedRecipe.ingredients.map((ing, i) => (
                             <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 shrink-0"></div>
                                 <span className="leading-relaxed">{ing}</span>
                             </li>
                         ))}
                     </ul>
                 </div>

                 <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                             Préparation
                         </h3>
                         <button 
                            onClick={(e) => handlePlaySteps(e, selectedRecipe)}
                            className={`p-2 rounded-full transition-all active:scale-95 ${
                                playingSection === 'steps' || loadingSection === 'steps'
                                ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' 
                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            }`}
                        >
                            {loadingSection === 'steps' ? <Loader2 size={18} className="animate-spin" /> :
                             playingSection === 'steps' ? <StopCircle size={18} /> : 
                             <Volume2 size={18} />}
                        </button>
                     </div>
                     <div className="space-y-6">
                         {selectedRecipe.steps.map((step, i) => (
                             <div key={i} className="flex gap-4">
                                 <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-bold flex items-center justify-center border border-slate-200 dark:border-slate-600">
                                     {i + 1}
                                 </span>
                                 <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-1">{step}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
          </div>,
          document.body
      )}

      {/* Main Page Header */}
      <div className="pt-10 pb-6 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300 sticky top-0 z-10">
         <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="text-emerald-600" />
                Mon Carnet
            </h1>
            <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
                {savedRecipes.length}
            </span>
         </div>

         <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
                type="text" 
                placeholder="Rechercher une recette..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-white placeholder:text-slate-400 transition-all"
             />
         </div>
      </div>

      {/* Recipe List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3 scroll-smooth">
         {savedRecipes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 animate-in fade-in">
                 <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                     <ChefHat size={32} className="text-emerald-300 dark:text-emerald-700" />
                 </div>
                 <p className="font-semibold text-slate-500 dark:text-slate-400">Carnet vide</p>
                 <p className="text-xs text-center mt-1 max-w-[200px]">Demandez à l'assistant de sauvegarder vos recettes préférées.</p>
             </div>
         ) : (
             sortedRecipes.map((recipe) => (
                 <div 
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`group bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all active:scale-95 cursor-pointer flex flex-col gap-3 relative overflow-hidden ${recipe.isPinned ? 'border-emerald-500/30 dark:border-emerald-500/30' : 'border-slate-100 dark:border-slate-700'}`}
                 >
                     {recipe.isPinned && (
                        <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 rounded-bl-xl text-white shadow-sm z-10">
                            <Pin size={12} className="fill-current" />
                        </div>
                     )}

                     <div className="flex justify-between items-start pr-6">
                         <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 text-base group-hover:text-emerald-600 transition-colors">{recipe.title}</h3>
                         {recipe.prepTime && (
                             <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 font-medium">
                                 <Clock size={10} /> {recipe.prepTime}
                             </span>
                         )}
                     </div>
                     
                     <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                         {recipe.description || recipe.steps[0]}
                     </p>

                     <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5 overflow-hidden">
                            {recipe.ingredients.slice(0, 4).map((_, i) => (
                                <div key={i} className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 border border-white dark:border-slate-800"></div>
                            ))}
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {recipe.ingredients.length} ingrédients
                            </span>
                        </div>
                        
                        <div className="flex gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                             <button 
                                onClick={(e) => togglePin(e, recipe.id)}
                                className={`p-1.5 rounded-full transition-colors ${recipe.isPinned ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-300 hover:text-emerald-500'}`}
                             >
                                <Pin size={16} className={recipe.isPinned ? "fill-current" : ""} />
                             </button>
                             <button 
                                onClick={(e) => toggleFavorite(e, recipe.id)}
                                className={`p-1.5 rounded-full transition-colors ${recipe.isFavorite ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-slate-300 hover:text-rose-500'}`}
                             >
                                <Heart size={16} className={recipe.isFavorite ? "fill-current" : ""} />
                             </button>
                        </div>
                     </div>
                 </div>
             ))
         )}
      </div>
    </div>
  );
};

export default Carnet;
