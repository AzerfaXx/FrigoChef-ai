import React, { useState, useEffect, useRef } from 'react';
import { AppTab, Ingredient, ShoppingItem, Recipe, UserProfile } from './types';
import Inventory from './components/Inventory';
import RecipeAssistant from './components/RecipeAssistant';
import ShoppingList from './components/ShoppingList';
import Profile from './components/Profile';
import Carnet from './components/Carnet';
import { LayoutGrid, ShoppingCart, ChefHat, User, BookOpen, Key, ExternalLink, Loader2 } from 'lucide-react';

// --- Helper: Auto-Categorization Logic ---
const detectCategory = (name: string): Ingredient['category'] => {
  const lower = name.toLowerCase();
  if (lower.match(/poulet|dinde|volaille|boeuf|steak|viande|haché|porc|jambon|lardon|saucisse|poisson|saumon|thon|cabillaud|crevette|gambas|oeuf/)) return 'meat';
  if (lower.match(/pomme|banane|poire|orange|clémentine|citron|raisin|fraise|framboise|fruit|carotte|salade|laitue|tomate|oignon|ail|échalote|patate|courgette|aubergine|poivron|avocat|brocoli|champignon|légume|basilic|persil|menthe|coriandre|épinard|haricot/)) return 'produce';
  if (lower.match(/eau|lait|jus|soda|coca|bière|vin|café|thé|boisson|sirop|alcool/)) return 'drinks';
  if (lower.match(/sauce|ketchup|mayo|moutarde|huile|vinaigre|épice|sel|poivre|bouillon|cube/)) return 'sauce';
  if (lower.match(/surgelé|glace|pizza|frite|poêlée/)) return 'frozen';
  if (lower.match(/pâte|spaghetti|macaroni|nouille|riz|semoule|blé|quinoa|lentille|pain|baguette|toast|farine|sucre|levure|biscuit|gâteau|céréale|conserve|boite|chocolat|miel|confiture|tartine|nutella/)) return 'pantry';
  return 'other';
};

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // --- App Data State ---
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    try { const saved = localStorage.getItem('fc_ingredients'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try { const saved = localStorage.getItem('fc_shopping'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>(() => {
    try { const saved = localStorage.getItem('fc_recipes'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try { const saved = localStorage.getItem('fc_darkmode'); return saved ? JSON.parse(saved) : false; } catch (e) { return false; }
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try { const saved = localStorage.getItem('fc_profile'); return saved ? JSON.parse(saved) : { name: 'Chef' }; } catch (e) { return { name: 'Chef' }; }
  });
  const [streak, setStreak] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { const saved = localStorage.getItem('fc_notifications'); return saved ? JSON.parse(saved) : false; } catch (e) { return false; }
  });
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.ASSISTANT);

  // --- API Key Selection Logic ---
  useEffect(() => {
    const checkKey = async () => {
      if (process.env.API_KEY) {
        setHasApiKey(true);
      } else if ((window as any).aistudio) {
        // Redundant global Window declarations cause "All declarations of 'aistudio' must have identical modifiers" errors.
        // We cast to any to ensure we can call the pre-configured aistudio methods safely.
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(false);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleConnectGemini = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true); // Proceed assuming selection success as per guidelines
    } else {
      alert("L'environnement AI Studio n'est pas détecté. Utilisez une clé API dans les variables d'environnement.");
    }
  };

  // --- Persistence ---
  useEffect(() => { localStorage.setItem('fc_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('fc_shopping', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('fc_recipes', JSON.stringify(savedRecipes)); }, [savedRecipes]);
  useEffect(() => { localStorage.setItem('fc_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('fc_notifications', JSON.stringify(notificationsEnabled)); }, [notificationsEnabled]);
  useEffect(() => {
    localStorage.setItem('fc_darkmode', JSON.stringify(darkMode));
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // --- Streak Logic ---
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('fc_last_login');
    let currentStreak = parseInt(localStorage.getItem('fc_streak') || '0');
    if (lastLogin !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (lastLogin === yesterdayStr) currentStreak += 1;
      else currentStreak = 1;
      localStorage.setItem('fc_last_login', today);
      localStorage.setItem('fc_streak', currentStreak.toString());
    }
    setStreak(currentStreak);
  }, []);

  // --- Swipe Logic ---
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const xDistance = touchStartX.current - touchEndX.current;
    if (Math.abs(xDistance) < 50) return;
    if (xDistance > 0) { // Left swipe
      if (currentTab === AppTab.INVENTORY) setCurrentTab(AppTab.SHOPPING);
      else if (currentTab === AppTab.SHOPPING) setCurrentTab(AppTab.ASSISTANT);
      else if (currentTab === AppTab.ASSISTANT) setCurrentTab(AppTab.CARNET);
      else if (currentTab === AppTab.CARNET) setCurrentTab(AppTab.PROFILE);
    } else { // Right swipe
      if (currentTab === AppTab.PROFILE) setCurrentTab(AppTab.CARNET);
      else if (currentTab === AppTab.CARNET) setCurrentTab(AppTab.ASSISTANT);
      else if (currentTab === AppTab.ASSISTANT) setCurrentTab(AppTab.SHOPPING);
      else if (currentTab === AppTab.SHOPPING) setCurrentTab(AppTab.INVENTORY);
    }
  };

  if (isCheckingKey) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6 text-emerald-600">
          <ChefHat size={48} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Bienvenue sur FrigoChef AI</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-sm">
          Pour utiliser votre assistant intelligent, vous devez connecter votre compte Google Gemini.
        </p>
        <button 
          onClick={handleConnectGemini}
          className="w-full max-w-xs bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Key size={20} /> Se connecter à Gemini
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-6 text-xs text-emerald-600 flex items-center gap-1 font-medium hover:underline"
        >
          Documentation de facturation <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="h-full w-full flex flex-col max-w-md mx-auto bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div 
          className="flex-1 overflow-hidden relative z-0"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div 
            className="flex h-full w-[500%] transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) will-change-transform"
            style={{ transform: `translateX(${
              currentTab === AppTab.INVENTORY ? 0 : 
              currentTab === AppTab.SHOPPING ? -20 : 
              currentTab === AppTab.ASSISTANT ? -40 : 
              currentTab === AppTab.CARNET ? -60 : -80
            }%)` }}
          >
            <div className="w-1/5 h-full"><Inventory ingredients={ingredients} setIngredients={setIngredients} /></div>
            <div className="w-1/5 h-full"><ShoppingList items={shoppingList} setItems={setShoppingList} onAddToStock={(items) => {
              const newIngs = items.map(i => ({ id: Date.now().toString()+Math.random(), name: i.name, quantity: '1', expiryDate: null, category: detectCategory(i.name) }));
              setIngredients(prev => [...prev, ...newIngs]);
            }} /></div>
            <div className="w-1/5 h-full"><RecipeAssistant ingredients={ingredients} setIngredients={setIngredients} setSavedRecipes={setSavedRecipes} shoppingList={shoppingList} setShoppingList={setShoppingList} isActive={currentTab === AppTab.ASSISTANT} /></div>
            <div className="w-1/5 h-full"><Carnet savedRecipes={savedRecipes} setSavedRecipes={setSavedRecipes} /></div>
            <div className="w-1/5 h-full"><Profile userProfile={userProfile} setUserProfile={setUserProfile} darkMode={darkMode} setDarkMode={setDarkMode} streak={streak} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} /></div>
          </div>
        </div>
        <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 px-2 pt-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex justify-between items-center z-40 h-[88px] shrink-0 transition-colors duration-300 relative">
          <button onClick={() => setCurrentTab(AppTab.INVENTORY)} className={`flex flex-col items-center gap-1 p-2 rounded-2xl w-16 active:scale-95 ${currentTab === AppTab.INVENTORY ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}><LayoutGrid size={24} /><span className="text-[10px] tracking-wide uppercase font-medium">Stock</span></button>
          <button onClick={() => setCurrentTab(AppTab.SHOPPING)} className={`flex flex-col items-center gap-1 p-2 rounded-2xl w-16 active:scale-95 ${currentTab === AppTab.SHOPPING ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}><ShoppingCart size={24} /><span className="text-[10px] tracking-wide uppercase font-medium">Liste</span></button>
          <div className="relative -top-6"><button onClick={() => setCurrentTab(AppTab.ASSISTANT)} className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-xl border-4 border-slate-50 dark:border-slate-800 active:scale-95 ${currentTab === AppTab.ASSISTANT ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white scale-110' : 'bg-white dark:bg-slate-700 text-slate-400'}`}><ChefHat size={30} /></button></div>
          <button onClick={() => setCurrentTab(AppTab.CARNET)} className={`flex flex-col items-center gap-1 p-2 rounded-2xl w-16 active:scale-95 ${currentTab === AppTab.CARNET ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}><BookOpen size={24} /><span className="text-[10px] tracking-wide uppercase font-medium">Carnet</span></button>
          <button onClick={() => setCurrentTab(AppTab.PROFILE)} className={`flex flex-col items-center gap-1 p-2 rounded-2xl w-16 active:scale-95 ${currentTab === AppTab.PROFILE ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}><User size={24} /><span className="text-[10px] tracking-wide uppercase font-medium">Profil</span></button>
        </nav>
      </div>
    </div>
  );
};

export default App;
