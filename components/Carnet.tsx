import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Recipe } from '../types';
import { BookOpen, Clock, ChevronRight, Search, ChefHat, Volume2, StopCircle, Heart, Pin, Loader2, Trash2, AlignLeft, RefreshCcw, XCircle, ArrowLeft } from 'lucide-react';
import { playTextAsAudio, stopAudio } from '../services/geminiService';

interface Props {
  savedRecipes: Recipe[];
  setSavedRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

// Helper ENRICHI pour mapper des mots-clés d'ingrédients à des emojis
const getIngredientEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  
  // Viandes & Poissons
  if (lower.match(/poulet|dinde|volaille|canard/)) return '🍗';
  if (lower.match(/boeuf|steak|viande|entrecôte|bavette/)) return '🥩';
  if (lower.match(/porc|jambon|lardon|bacon|saucisse|chorizo/)) return '🥓';
  if (lower.match(/poisson|saumon|thon|colin|cabillaud/)) return '🐟';
  if (lower.match(/crevette|gambas|homard|crabe|fruit de mer/)) return '🍤';
  if (lower.match(/oeuf|omelette/)) return '🥚';
  if (lower.match(/burger/)) return '🍔';

  // Féculents & Boulangerie
  if (lower.match(/nouille|spaghetti|pâte|macaroni|penne|fusilli|lasagne/)) return '🍝';
  if (lower.match(/riz|risotto|sushi/)) return '🍚';
  if (lower.match(/pain|toast|baguette|tartine|bun/)) return '🥖';
  if (lower.match(/pomme de terre|patate|frite|purée|gnocchi/)) return '🥔';
  if (lower.match(/pizza/)) return '🍕';
  if (lower.match(/croissant|viennoiserie/)) return '🥐';

  // Légumes & Fruits
  if (lower.match(/tomate/)) return '🍅';
  if (lower.match(/salade|laitue|roquette|mâche/)) return '🥬';
  if (lower.match(/carotte/)) return '🥕';
  if (lower.match(/oignon|ail|échalote/)) return '🧅';
  if (lower.match(/brocoli|chou/)) return '🥦';
  if (lower.match(/champignon|cèpe|girolle/)) return '🍄';
  if (lower.match(/aubergine/)) return '🍆';
  if (lower.match(/maïs/)) return '🌽';
  if (lower.match(/avocat/)) return '🥑';
  if (lower.match(/piment|poivron|épicé/)) return '🌶️';
  if (lower.match(/citron|lime|agrume/)) return '🍋';
  if (lower.match(/pomme/)) return '🍎';
  if (lower.match(/poire/)) return '🍐';
  if (lower.match(/fraise|framboise/)) return '🍓';
  if (lower.match(/cerise/)) return '🍒';
  if (lower.match(/pêche|abricot/)) return '🍑';
  if (lower.match(/raisin/)) return '🍇';
  if (lower.match(/melon|pastèque/)) return '🍉';
  if (lower.match(/banane/)) return '🍌';
  if (lower.match(/ananas/)) return '🍍';
  if (lower.match(/concombre/)) return '🥒';

  // Laitages & Autres
  if (lower.match(/fromage|parmesan|mozzarella|comté|gruyère|raclette/)) return '🧀';
  if (lower.match(/lait|crème|beurre|yaourt/)) return '🥛';
  if (lower.match(/chocolat|cacao|dessert|gâteau|cookie/)) return '🍫';
  if (lower.match(/glace|sorbet/)) return '🍨';
  if (lower.match(/miel/)) return '🍯';
  if (lower.match(/sel|poivre|épice|herbe|curry|paprika|cumin/)) return '🧂';
  if (lower.match(/huile|vinaigre|sauce|soja/)) return '🫒';
  if (lower.match(/vin|alcool/)) return '🍷';
  if (lower.match(/bière/)) return '🍺';
  if (lower.match(/eau/)) return '💧';
  if (lower.match(/café/)) return '☕';
  if (lower.match(/thé/)) return '🫖';

  return '🥘'; // Défaut (Plat cuisiné)
};

const Carnet: React.FC<Props> = ({ savedRecipes, setSavedRecipes }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingSection, setPlayingSection] = useState<'ingredients' | 'steps' | null>(null);
  const [loadingSection, setLoadingSection] = useState<'ingredients' | 'steps' | null>(null);
  
  // New State for Trash Mode
  const [showTrash, setShowTrash] = useState(false);

  // Filtrage principal
  const filteredRecipes = savedRecipes.filter(r => {
    // Si mode corbeille, on ne montre QUE les supprimés
    if (showTrash) return r.isDeleted;
    // Sinon on montre ceux qui ne sont PAS supprimés
    return !r.isDeleted;
  }).filter(r => 
    // Filtre de recherche commun
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.ingredients.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // LOGIQUE DE TRI STRICTE : Épinglé > Favori > Date
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    // Pas de tri spécifique dans la corbeille, juste par date
    if (showTrash) return b.createdAt - a.createdAt;

    // 1. Épinglés en premier
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    // 2. Favoris (Cœur) en deuxième
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    
    // 3. Plus récent en dernier (par date de création)
    return b.createdAt - a.createdAt;
  });

  const trashCount = savedRecipes.filter(r => r.isDeleted).length;

  const toggleAudio = (e: React.MouseEvent, section: 'ingredients' | 'steps', text: string) => {
      e.stopPropagation();

      if (playingSection === section) {
          stopAudio();
          setPlayingSection(null);
          setLoadingSection(null);
      } else {
          stopAudio();
          setLoadingSection(section);
          setPlayingSection(null);

          playTextAsAudio(text, () => {
              setPlayingSection(null);
          }).then(() => {
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

  // --- LOGIQUE CORBEILLE ---

  // 1. Déplacer vers la corbeille (Soft Delete)
  const moveToTrash = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isDeleted: true } : r));
      if (selectedRecipe?.id === id) closeModal();
  };

  // 2. Restaurer (Sortir de la corbeille)
  const restoreFromTrash = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSavedRecipes(prev => prev.map(r => r.id === id ? { ...r, isDeleted: false } : r));
  };

  // 3. Supprimer définitivement (Hard Delete)
  const deletePermanently = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("⚠️ Cette action est irréversible. Supprimer définitivement ?")) {
          setSavedRecipes(prev => prev.filter(r => r.id !== id));
      }
  };

  const emptyTrash = () => {
    if (window.confirm("Vider toute la corbeille ?")) {
        setSavedRecipes(prev => prev.filter(r => !r.isDeleted));
    }
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
      
      {/* --- DETAIL MODAL (RECETTE OUVERTE) --- */}
      {selectedRecipe && createPortal(
          <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom-full duration-300">
             
             {/* Modal Header */}
             <div className="pt-10 pb-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20">
                 <button 
                    onClick={closeModal}
                    className="p-2 -ml-2 mt-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors shrink-0"
                 >
                     <ChevronRight className="rotate-180" />
                 </button>
                 
                 <h2 className="text-xl font-bold flex-1 text-slate-900 dark:text-white leading-tight pt-1.5">{selectedRecipe.title}</h2>
                 
                 <div className="flex gap-2 shrink-0 mt-1">
                    {!showTrash && (
                        <button 
                            onClick={(e) => toggleFavorite(e, selectedRecipe.id)}
                            className={`p-2.5 rounded-full transition-colors border ${selectedRecipe.isFavorite ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-900' : 'text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                        >
                            <Heart size={20} className={selectedRecipe.isFavorite ? "fill-current" : ""} />
                        </button>
                    )}
                    
                    {/* Bouton Supprimer/Restaurer dans la modale selon le contexte */}
                    {showTrash ? (
                        <button 
                            onClick={(e) => restoreFromTrash(e, selectedRecipe.id)}
                            className="p-2.5 rounded-full transition-colors text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900"
                            title="Restaurer"
                        >
                            <RefreshCcw size={20} />
                        </button>
                    ) : (
                        <button 
                            onClick={(e) => moveToTrash(e, selectedRecipe.id)}
                            className="p-2.5 rounded-full transition-colors text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40"
                            title="Mettre à la corbeille"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                 </div>
             </div>
             
             {/* Modal Content */}
             <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
                 
                 {/* Description Block */}
                 {(selectedRecipe.description || selectedRecipe.steps.length > 0) && (
                     <div className="flex gap-3 items-start bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                        <AlignLeft size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">
                           {selectedRecipe.description || selectedRecipe.steps[0]}
                        </p>
                     </div>
                 )}
                 
                 {/* Info Bar */}
                 <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Clock size={16} className="text-emerald-500" />
                        <span className="font-bold">{selectedRecipe.prepTime || '20 min'}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                        Créée le {new Date(selectedRecipe.createdAt).toLocaleDateString()}
                    </div>
                 </div>

                 {/* Ingrédients Block */}
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
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
                            {loadingSection === 'ingredients' ? <Loader2 size={20} className="animate-spin" /> : 
                             playingSection === 'ingredients' ? <StopCircle size={20} /> : 
                             <Volume2 size={20} />}
                        </button>
                     </div>
                     <ul className="space-y-3">
                         {selectedRecipe.ingredients.map((ing, i) => (
                             <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                 <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 text-sm">
                                     {getIngredientEmoji(ing)}
                                 </div>
                                 <span className="leading-relaxed font-medium">{ing}</span>
                             </li>
                         ))}
                     </ul>
                 </div>

                 {/* Preparation Block */}
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
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
                            {loadingSection === 'steps' ? <Loader2 size={20} className="animate-spin" /> :
                             playingSection === 'steps' ? <StopCircle size={20} /> : 
                             <Volume2 size={20} />}
                        </button>
                     </div>
                     <div className="space-y-6">
                         {selectedRecipe.steps.map((step, i) => (
                             <div key={i} className="flex gap-4">
                                 <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-bold flex items-center justify-center border border-slate-200 dark:border-slate-600 mt-0.5">
                                     {i + 1}
                                 </span>
                                 <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{step}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
          </div>,
          document.body
      )}

      {/* --- LIST HEADER --- */}
      <div className={`pt-10 pb-6 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300 sticky top-0 z-10 ${showTrash ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
         <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                {showTrash ? (
                    <>
                        <button onClick={() => setShowTrash(false)} className="p-1 -ml-1 mr-1 text-slate-400 hover:text-slate-600 rounded-full">
                            <ArrowLeft size={24} />
                        </button>
                        <span className="text-red-600 dark:text-red-400">Corbeille</span>
                    </>
                ) : (
                    <>
                        <BookOpen className="text-emerald-600" />
                        Mon Carnet
                    </>
                )}
            </h1>
            
            {showTrash && trashCount > 0 && (
                <button 
                    onClick={emptyTrash}
                    className="text-xs font-bold text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                >
                    Tout vider
                </button>
            )}

            {!showTrash && (
                <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-white placeholder:text-slate-400 transition-all"
                 />
             </div>
             
             {/* BOUTON CORBEILLE DANS LE HEADER */}
             <button 
                onClick={() => { setShowTrash(!showTrash); setSearchTerm(''); }}
                className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all active:scale-95 relative ${
                    showTrash 
                    ? 'bg-slate-800 text-white border-slate-700' 
                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400'
                }`}
             >
                <Trash2 size={20} />
                {!showTrash && trashCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                        {trashCount}
                    </span>
                )}
             </button>
         </div>
      </div>

      {/* --- RECIPE LIST --- */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3 scroll-smooth">
         {sortedRecipes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 animate-in fade-in">
                 <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${showTrash ? 'bg-red-50 dark:bg-red-900/20 text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-300'}`}>
                     {showTrash ? <Trash2 size={32} /> : <ChefHat size={32} />}
                 </div>
                 <p className="font-semibold text-slate-500 dark:text-slate-400">{showTrash ? 'Corbeille vide' : 'Carnet vide'}</p>
                 <p className="text-xs text-center mt-1 max-w-[200px] text-slate-400">
                    {showTrash 
                        ? "Les recettes supprimées apparaîtront ici." 
                        : "Demandez à l'assistant de sauvegarder vos recettes préférées."}
                 </p>
             </div>
         ) : (
             sortedRecipes.map((recipe) => (
                 <div 
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`group bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all active:scale-[0.98] cursor-pointer flex flex-col gap-3 relative overflow-hidden ${
                        recipe.isPinned && !showTrash 
                            ? 'border-emerald-500/40 dark:border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-900/5' 
                            : 'border-slate-100 dark:border-slate-700'
                        } ${showTrash ? 'opacity-80 grayscale-[0.3]' : ''}`
                    }
                 >
                     {/* Épinglette visuelle (Seulement si pas dans corbeille) */}
                     {recipe.isPinned && !showTrash && (
                        <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 rounded-bl-xl text-white shadow-sm z-10">
                            <Pin size={12} className="fill-current" />
                        </div>
                     )}

                     <div className="flex justify-between items-start pr-6">
                         {/* Titre */}
                         <div className="flex flex-col">
                            <h3 className={`font-bold text-base leading-tight line-clamp-2 ${recipe.isPinned && !showTrash ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-white'}`}>
                                {recipe.title}
                            </h3>
                            {/* Temps de préparation affiché clairement sous le titre */}
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1 flex items-center gap-1">
                                 <Clock size={12} className={showTrash ? "text-slate-400" : "text-emerald-500"} /> 
                                 {recipe.prepTime || "20 min"}
                            </span>
                         </div>
                     </div>
                     
                     {/* Description ou première étape (Affichage forcé de 2 lignes) */}
                     <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-8 opacity-90">
                         {recipe.description || recipe.steps[0] || "Aucune description disponible."}
                     </p>

                     <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-50 dark:border-slate-800">
                        {/* Résumé Ingrédients */}
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5 overflow-hidden">
                            {recipe.ingredients.slice(0, 4).map((ing, i) => (
                                <div key={i} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 border border-white dark:border-slate-800 flex items-center justify-center text-[10px] shadow-sm relative z-0">
                                    {getIngredientEmoji(ing)}
                                </div>
                            ))}
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold ml-1">
                                {recipe.ingredients.length} ingrédients
                            </span>
                        </div>
                        
                        {/* Actions Rapides */}
                        <div className="flex gap-1 relative z-20" onClick={(e) => e.stopPropagation()}>
                             {showTrash ? (
                                 <>
                                    <button 
                                        onClick={(e) => deletePermanently(e, recipe.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                                        title="Supprimer définitivement"
                                    >
                                        <XCircle size={16} />
                                    </button>
                                    <button 
                                        onClick={(e) => restoreFromTrash(e, recipe.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 transition-all active:scale-90"
                                        title="Restaurer"
                                    >
                                        <RefreshCcw size={16} />
                                    </button>
                                 </>
                             ) : (
                                 <>
                                    <button 
                                        onClick={(e) => moveToTrash(e, recipe.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                                        title="Mettre à la corbeille"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button 
                                        onClick={(e) => togglePin(e, recipe.id)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90 ${recipe.isPinned ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-300 hover:text-emerald-500'}`}
                                    >
                                        <Pin size={16} className={recipe.isPinned ? "fill-current" : ""} />
                                    </button>
                                    <button 
                                        onClick={(e) => toggleFavorite(e, recipe.id)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90 ${recipe.isFavorite ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-slate-300 hover:text-rose-500'}`}
                                    >
                                        <Heart size={16} className={recipe.isFavorite ? "fill-current" : ""} />
                                    </button>
                                 </>
                             )}
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