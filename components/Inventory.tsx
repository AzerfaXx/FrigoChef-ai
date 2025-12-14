
import React, { useState, useRef } from 'react';
import { Ingredient } from '../types';
import { Plus, Trash2, AlertTriangle, Apple, Beef, Wine, Soup, Search, Package, Clock, ChevronRight, ChevronLeft, Pencil, Check, X } from 'lucide-react';

interface Props {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
}

const Inventory: React.FC<Props> = ({ ingredients, setIngredients }) => {
  // Add State
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [category, setCategory] = useState<Ingredient['category']>('produce');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editCategory, setEditCategory] = useState<Ingredient['category']>('produce');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const addIngredient = () => {
    if (!newItem.trim()) return;
    const item: Ingredient = {
      id: Date.now().toString(),
      name: newItem,
      quantity: newQuantity || '1',
      expiryDate: expiryDate || null,
      category: category,
    };
    setIngredients([...ingredients, item]);
    setNewItem('');
    setNewQuantity('');
    setExpiryDate('');
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const startEditing = (item: Ingredient) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditExpiry(item.expiryDate || '');
    setEditCategory(item.category);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    setIngredients(prev => prev.map(item => 
        item.id === editingId 
        ? { ...item, name: editName, quantity: editQuantity, expiryDate: editExpiry || null, category: editCategory }
        : item
    ));
    setEditingId(null);
  };

  const scrollRight = () => {
    if (scrollRef.current) {
        scrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
        scrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    const expiry = new Date(dateStr);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'produce': return <Apple size={18} className="text-emerald-600 dark:text-emerald-400" />;
      case 'meat': return <Beef size={18} className="text-rose-600 dark:text-rose-400" />;
      case 'drinks': return <Wine size={18} className="text-sky-500 dark:text-sky-400" />;
      case 'sauce': return <Soup size={18} className="text-orange-500 dark:text-orange-400" />;
      case 'pantry': return <Package size={18} className="text-amber-600 dark:text-amber-400" />;
      default: return <Search size={18} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const sortedIngredients = [...ingredients].sort((a, b) => {
      const daysA = getDaysUntilExpiry(a.expiryDate) ?? 999;
      const daysB = getDaysUntilExpiry(b.expiryDate) ?? 999;
      return daysA - daysB;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative transition-colors duration-300">
      {/* Header */}
      <div className="pt-10 pb-6 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 z-10 shadow-sm transition-colors duration-300">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Garde-Manger</h1>
        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mt-0.5">
          {ingredients.length} produits en stock
        </p>
      </div>

      {/* Add Item Bar */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 z-10 transition-colors duration-300">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all h-12">
             <input
                type="text"
                placeholder="Produit (ex: Oeufs)"
                className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
             />
             <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
             <input
                type="text"
                placeholder="Qté"
                className="w-16 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
             />
          </div>
          
          <button
            onClick={addIngredient}
            disabled={!newItem.trim()}
            className="bg-emerald-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-200 dark:shadow-none disabled:opacity-50"
          >
            <Plus size={22} />
          </button>
        </div>

        {/* Combined Date & Category Row */}
        <div className="flex items-center gap-2 h-10">
             {/* Date Picker Button */}
             <div className="relative flex flex-col justify-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 h-full shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group min-w-[100px]">
                <div className="flex items-center justify-between gap-1 w-full">
                    <span className={`text-xs font-bold truncate ${expiryDate ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                        {expiryDate ? formatDate(expiryDate) : 'Date'}
                    </span>
                    <Clock size={12} className="text-slate-400 shrink-0 group-hover:text-emerald-500 transition-colors" />
                </div>
                <span className="text-[9px] text-slate-400 leading-none mt-0.5">date de péremption</span>

                {/* Invisible input overlay for full clickability */}
                <input 
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

            {/* Categories */}
            <div className="relative group flex-1 min-w-0 h-full">
                {/* Left Arrow */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white via-white to-transparent dark:from-slate-800 dark:via-slate-800 flex items-center justify-start z-10 pointer-events-none">
                    <button 
                        onClick={scrollLeft}
                        className="w-5 h-5 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-emerald-500 active:scale-95 transition-all pointer-events-auto"
                    >
                        <ChevronLeft size={10} />
                    </button>
                </div>

                <div ref={scrollRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar px-6 h-full">
                    {['produce', 'meat', 'drinks', 'sauce', 'pantry', 'frozen', 'other'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat as any)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors border flex-shrink-0 ${
                                category === cat 
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {cat === 'produce' ? 'Fruits' : 
                            cat === 'meat' ? 'Viande' :
                            cat === 'drinks' ? 'Boissons' :
                            cat === 'sauce' ? 'Sauces' :
                            cat === 'pantry' ? 'Épicerie' :
                            cat === 'frozen' ? 'Froid' : 'Autre'}
                        </button>
                    ))}
                </div>
                
                {/* Right Arrow */}
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white via-white to-transparent dark:from-slate-800 dark:via-slate-800 flex items-center justify-end z-10 pointer-events-none">
                    <button 
                        onClick={scrollRight}
                        className="w-5 h-5 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-emerald-500 active:scale-95 transition-all pointer-events-auto"
                    >
                        <ChevronRight size={10} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 scroll-smooth">
        {ingredients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-500">
                    <Package size={32} />
                </div>
                <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Le frigo est vide</p>
                <p className="text-sm opacity-70">Ajoutez vos courses.</p>
            </div>
        ) : (
            sortedIngredients.map((item) => {
            const isEditing = editingId === item.id;
            const daysLeft = getDaysUntilExpiry(item.expiryDate);
            const isExpiring = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
            const isExpired = daysLeft !== null && daysLeft < 0;

            if (isEditing) {
                return (
                    <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border-2 border-emerald-500/50 shadow-md animate-in fade-in zoom-in-95">
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:text-white"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nom"
                                />
                                <input 
                                    className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:text-white"
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    placeholder="Qté"
                                />
                            </div>
                            <div className="flex gap-2 items-center">
                                <select
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value as any)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none dark:text-white h-9"
                                >
                                    <option value="produce">Fruits & Légumes</option>
                                    <option value="meat">Viande & Poisson</option>
                                    <option value="drinks">Boissons</option>
                                    <option value="sauce">Sauces</option>
                                    <option value="pantry">Épicerie</option>
                                    <option value="frozen">Surgelés</option>
                                    <option value="other">Autre</option>
                                </select>
                                
                                {/* Edit Mode Date Picker */}
                                <div className="relative flex flex-col justify-center px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer group min-w-[100px] h-9">
                                    <div className="flex items-center gap-2 justify-between">
                                        <span className={`text-xs font-bold ${editExpiry ? 'text-slate-700 dark:text-white' : 'text-slate-500'}`}>
                                            {editExpiry ? formatDate(editExpiry) : 'Date'}
                                        </span>
                                        <Clock size={12} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    <span className="text-[8px] text-slate-400 leading-none">date de péremption</span>

                                    <input 
                                        type="date"
                                        value={editExpiry || ''}
                                        onChange={(e) => setEditExpiry(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button onClick={saveEdit} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors">
                                    <Check size={14} /> Enregistrer
                                </button>
                                <button onClick={cancelEditing} className="w-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-lg flex items-center justify-center transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div
                key={item.id}
                className={`group flex items-center justify-between p-3 rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-md ${
                    isExpired ? 'bg-red-50/50 dark:bg-red-900/20 border-red-100 dark:border-red-900' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                }`}
                >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-colors ${isExpired ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-700/50 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-900/20'}`}>
                        {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-sm truncate ${isExpired ? 'text-red-700 dark:text-red-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                            {item.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{item.quantity}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {item.expiryDate && (
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm border ${
                            isExpired ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900' :
                            isExpiring ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900' : 
                            'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                        }`}>
                            {(isExpiring || isExpired) && <AlertTriangle size={10} />}
                            {isExpired ? 'Périmé' : `${daysLeft}j`}
                        </div>
                    )}
                    
                    <button
                        onClick={() => startEditing(item)}
                        className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all active:scale-90"
                    >
                        <Pencil size={16} />
                    </button>

                    <button
                        onClick={() => removeIngredient(item.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all active:scale-90"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                </div>
            );
            })
        )}
      </div>
      <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .dark ::-webkit-calendar-picker-indicator {
             filter: invert(0.8);
             opacity: 0.6;
             cursor: pointer;
          }
      `}</style>
    </div>
  );
};

export default Inventory;
