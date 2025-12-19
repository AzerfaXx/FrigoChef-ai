import React, { useState, useEffect, useRef } from 'react';
import { AppTab, Ingredient, ShoppingItem, Recipe, UserProfile } from './types';
import Inventory from './components/Inventory';
import RecipeAssistant from './components/RecipeAssistant';
import ShoppingList from './components/ShoppingList';
import Profile from './components/Profile';
import Carnet from './components/Carnet';
import { LayoutGrid, ShoppingCart, ChefHat, User, BookOpen } from 'lucide-react';

const detectCategory = (name: string): Ingredient['category'] => {
  const lower = name.toLowerCase();
  if (lower.match(/poulet|viande|poisson|oeuf/)) return 'meat';
  if (lower.match(/pomme|banane|carotte|salade|tomate/)) return 'produce';
  if (lower.match(/eau|lait|jus|soda/)) return 'drinks';
  if (lower.match(/sauce|sel|poivre|huile/)) return 'sauce';
  if (lower.match(/surgelé/)) return 'frozen';
  if (lower.match(/pâte|riz|pain|farine/)) return 'pantry';
  return 'other';
};

const App: React.FC = () => {
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
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.ASSISTANT);

  useEffect(() => { localStorage.setItem('fc_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('fc_shopping', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('fc_recipes', JSON.stringify(savedRecipes)); }, [savedRecipes]);
  useEffect(() => { 
    localStorage.setItem('fc_darkmode', JSON.stringify(darkMode));
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  return (
    <div className="h-full w-full flex flex-col max-w-md mx-auto bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex-1 overflow-hidden relative">
        <div 
          className="flex h-full w-[500%] transition-transform duration-500"
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
          <div className="w-1/5 h-full"><Profile userProfile={userProfile} setUserProfile={setUserProfile} darkMode={darkMode} setDarkMode={setDarkMode} streak={0} notificationsEnabled={false} setNotificationsEnabled={() => {}} /></div>
        </div>
      </div>
      <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 px-2 pt-2 pb-safe flex justify-between items-center z-40 h-[88px] shrink-0">
        <button onClick={() => setCurrentTab(AppTab.INVENTORY)} className={`flex flex-col items-center gap-1 p-2 w-16 ${currentTab === AppTab.INVENTORY ? 'text-emerald-600' : 'text-slate-400'}`}><LayoutGrid size={24} /><span className="text-[10px]">Stock</span></button>
        <button onClick={() => setCurrentTab(AppTab.SHOPPING)} className={`flex flex-col items-center gap-1 p-2 w-16 ${currentTab === AppTab.SHOPPING ? 'text-blue-600' : 'text-slate-400'}`}><ShoppingCart size={24} /><span className="text-[10px]">Liste</span></button>
        <div className="relative -top-6"><button onClick={() => setCurrentTab(AppTab.ASSISTANT)} className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all ${currentTab === AppTab.ASSISTANT ? 'bg-emerald-500 text-white scale-110' : 'bg-white dark:bg-slate-700 text-slate-400'}`}><ChefHat size={30} /></button></div>
        <button onClick={() => setCurrentTab(AppTab.CARNET)} className={`flex flex-col items-center gap-1 p-2 w-16 ${currentTab === AppTab.CARNET ? 'text-amber-600' : 'text-slate-400'}`}><BookOpen size={24} /><span className="text-[10px]">Carnet</span></button>
        <button onClick={() => setCurrentTab(AppTab.PROFILE)} className={`flex flex-col items-center gap-1 p-2 w-16 ${currentTab === AppTab.PROFILE ? 'text-purple-600' : 'text-slate-400'}`}><User size={24} /><span className="text-[10px]">Profil</span></button>
      </nav>
    </div>
  );
};

export default App;