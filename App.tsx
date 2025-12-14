import React, { useState, useEffect, useRef } from 'react';
import { AppTab, Ingredient, ShoppingItem, Recipe, UserProfile } from './types';
import Inventory from './components/Inventory';
import RecipeAssistant from './components/RecipeAssistant';
import ShoppingList from './components/ShoppingList';
import Profile from './components/Profile';
import Carnet from './components/Carnet';
import { LayoutGrid, ShoppingCart, ChefHat, User, BookOpen } from 'lucide-react';

const App: React.FC = () => {
  // --- App Data State with Persistence ---

  // 1. Ingredients (Stock)
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    try {
      const saved = localStorage.getItem('fc_ingredients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // 2. Shopping List
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem('fc_shopping');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // 3. Saved Recipes (Carnet)
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem('fc_recipes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // 4. Dark Mode
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('fc_darkmode');
      return saved ? JSON.parse(saved) : false;
    } catch (e) { return false; }
  });
  
  // 5. User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
      try {
        const saved = localStorage.getItem('fc_profile');
        return saved ? JSON.parse(saved) : { name: 'Chef' };
      } catch (e) { return { name: 'Chef' }; }
  });

  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.ASSISTANT);

  // --- Persistence Effects (Save on Change) ---

  useEffect(() => {
    localStorage.setItem('fc_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('fc_shopping', JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    localStorage.setItem('fc_recipes', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  useEffect(() => {
    localStorage.setItem('fc_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('fc_darkmode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Swipe Logic ---
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null; 
    touchEndY.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !touchEndY.current) return;
    
    const xDistance = touchStartX.current - touchEndX.current;
    const yDistance = touchStartY.current - touchEndY.current;
    
    // If vertical scroll is dominant, do not swipe tabs
    if (Math.abs(yDistance) >= Math.abs(xDistance)) return;

    const isLeftSwipe = xDistance > minSwipeDistance;
    const isRightSwipe = xDistance < -minSwipeDistance;

    // Order: INVENTORY (0) -> SHOPPING (1) -> ASSISTANT (2) -> CARNET (3) -> PROFILE (4)
    if (isLeftSwipe) {
      if (currentTab === AppTab.INVENTORY) setCurrentTab(AppTab.SHOPPING);
      else if (currentTab === AppTab.SHOPPING) setCurrentTab(AppTab.ASSISTANT);
      else if (currentTab === AppTab.ASSISTANT) setCurrentTab(AppTab.CARNET);
      else if (currentTab === AppTab.CARNET) setCurrentTab(AppTab.PROFILE);
    } else if (isRightSwipe) {
      if (currentTab === AppTab.PROFILE) setCurrentTab(AppTab.CARNET);
      else if (currentTab === AppTab.CARNET) setCurrentTab(AppTab.ASSISTANT);
      else if (currentTab === AppTab.ASSISTANT) setCurrentTab(AppTab.SHOPPING);
      else if (currentTab === AppTab.SHOPPING) setCurrentTab(AppTab.INVENTORY);
    }
  };

  // Calculate percentage for translateX
  const getTranslatePercent = () => {
    switch (currentTab) {
      case AppTab.INVENTORY: return 0;
      case AppTab.SHOPPING: return -20;
      case AppTab.ASSISTANT: return -40;
      case AppTab.CARNET: return -60;
      case AppTab.PROFILE: return -80;
      default: return -40;
    }
  };

  // --- RENDER ---

  return (
    <div className="h-full w-full">
      <div className="h-full w-full flex flex-col max-w-md mx-auto bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-200 dark:border-slate-800 transition-colors duration-300">
        
        {/* Main View Port with Slider */}
        <div 
          className="flex-1 overflow-hidden relative z-0"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Width is 500% for 5 tabs */}
          <div 
            className="flex h-full w-[500%] transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) will-change-transform"
            style={{ transform: `translateX(${getTranslatePercent()}%)` }}
          >
            {/* Section 1: Stock */}
            <div className="w-1/5 h-full overflow-hidden relative">
               <Inventory ingredients={ingredients} setIngredients={setIngredients} />
            </div>

            {/* Section 2: Shopping (Liste) */}
            <div className="w-1/5 h-full overflow-hidden relative">
               <ShoppingList items={shoppingList} setItems={setShoppingList} />
            </div>
            
            {/* Section 3: Assistant (Chef) */}
            <div className="w-1/5 h-full overflow-hidden relative">
              <RecipeAssistant 
                  ingredients={ingredients} 
                  setIngredients={setIngredients} 
                  setSavedRecipes={setSavedRecipes}
                  shoppingList={shoppingList}
                  setShoppingList={setShoppingList}
                  isActive={currentTab === AppTab.ASSISTANT} // Pass active state to prevent background scrolling glitches
              />
            </div>
            
            {/* Section 4: Carnet */}
            <div className="w-1/5 h-full overflow-hidden relative">
               <Carnet savedRecipes={savedRecipes} setSavedRecipes={setSavedRecipes} />
            </div>

            {/* Section 5: Profile */}
            <div className="w-1/5 h-full overflow-hidden relative">
               <Profile 
                 userProfile={userProfile} 
                 setUserProfile={setUserProfile} 
                 darkMode={darkMode} 
                 setDarkMode={setDarkMode}
               />
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 px-2 pt-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex justify-between items-center z-40 h-[88px] shrink-0 transition-colors duration-300 relative">
          
          {/* Stock */}
          <button
            type="button"
            onClick={() => setCurrentTab(AppTab.INVENTORY)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 active:scale-95 ${
              currentTab === AppTab.INVENTORY ? 'text-emerald-600 dark:text-emerald-400 font-bold translate-y-0' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <LayoutGrid size={24} strokeWidth={currentTab === AppTab.INVENTORY ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide uppercase font-medium">Stock</span>
          </button>

          {/* Liste */}
          <button
            type="button"
            onClick={() => setCurrentTab(AppTab.SHOPPING)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 active:scale-95 ${
              currentTab === AppTab.SHOPPING ? 'text-blue-600 dark:text-blue-400 font-bold translate-y-0' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <ShoppingCart size={24} strokeWidth={currentTab === AppTab.SHOPPING ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide uppercase font-medium">Liste</span>
          </button>

          {/* CHEF (Center Button) */}
          <div className="relative -top-6 group">
              <div className={`absolute inset-0 bg-emerald-500/30 rounded-full blur-xl transition-opacity duration-500 pointer-events-none ${currentTab === AppTab.ASSISTANT ? 'opacity-100' : 'opacity-0'}`}></div>
              <button
                type="button"
                onClick={() => setCurrentTab(AppTab.ASSISTANT)}
                className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-xl border-4 border-slate-50 dark:border-slate-800 active:scale-95 ${
                  currentTab === AppTab.ASSISTANT 
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white scale-110' 
                  : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-emerald-600'
                }`}
              >
                 <ChefHat size={30} strokeWidth={2.5} />
              </button>
          </div>

          {/* Carnet */}
          <button
            type="button"
            onClick={() => setCurrentTab(AppTab.CARNET)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 active:scale-95 ${
              currentTab === AppTab.CARNET ? 'text-amber-600 dark:text-amber-400 font-bold translate-y-0' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen size={24} strokeWidth={currentTab === AppTab.CARNET ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide uppercase font-medium">Carnet</span>
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => setCurrentTab(AppTab.PROFILE)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 active:scale-95 ${
              currentTab === AppTab.PROFILE ? 'text-purple-600 dark:text-purple-400 font-bold translate-y-0' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <User size={24} strokeWidth={currentTab === AppTab.PROFILE ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide uppercase font-medium">Profil</span>
          </button>
        </nav>
        
        <style>{`
          .pb-safe {
            padding-bottom: max(env(safe-area-inset-bottom), 16px);
          }
        `}</style>
      </div>
    </div>
  );
};

export default App;