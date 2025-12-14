import React, { useState } from 'react';
import { ShoppingItem, ShoppingListTemplate } from '../types';
import { Check, Plus, Trash2, LayoutTemplate, Save, X, Pencil, ChevronDown, ShoppingCart, Archive } from 'lucide-react';

interface Props {
  items: ShoppingItem[];
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  onAddToStock: (items: ShoppingItem[]) => void;
}

const DEFAULT_TEMPLATES: ShoppingListTemplate[] = [
  { id: '1', name: 'Soirée Italienne', items: ['Pâtes fraîches', 'Sauce tomate', 'Parmesan', 'Ail', 'Basilic'] },
  { id: '2', name: 'Brunch Dimanche', items: ['Oeufs', 'Bacon', 'Pain de campagne', 'Jus d\'orange', 'Café'] },
  { id: '3', name: 'Essentiels', items: ['Lait', 'Beurre', 'Pain', 'Riz', 'Oignons'] },
];

const ShoppingList: React.FC<Props> = ({ items, setItems, onAddToStock }) => {
  const [newItemName, setNewItemName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<ShoppingListTemplate[]>(DEFAULT_TEMPLATES);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addItem = (name: string) => {
    if (!name.trim()) return;
    const item: ShoppingItem = {
      id: Date.now().toString() + Math.random(),
      name: name,
      checked: false,
    };
    setItems(prev => [...prev, item]);
    setNewItemName('');
  };

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const applyTemplate = (template: ShoppingListTemplate) => {
    const newItems = template.items.map(name => ({
      id: Date.now().toString() + Math.random(),
      name,
      checked: false
    }));
    setItems(prev => [...prev, ...newItems]);
    setShowTemplates(false);
    setExpandedId(null);
  };

  const saveCurrentAsTemplate = () => {
    if (!newTemplateName.trim() || items.length === 0) return;
    const newTemplate: ShoppingListTemplate = {
        id: Date.now().toString(),
        name: newTemplateName,
        items: items.map(i => i.name),
        isCustom: true
    };
    setTemplates(prev => [...prev, newTemplate]);
    setNewTemplateName('');
    setIsCreatingTemplate(false);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (editingId === id) setEditingId(null);
      if (expandedId === id) setExpandedId(null);
  };

  const startEditing = (t: ShoppingListTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(t.id);
      setEditName(t.name);
  };

  const saveEditName = (id: string) => {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editName } : t));
      setEditingId(null);
  };

  const toggleExpand = (id: string) => {
      setExpandedId(expandedId === id ? null : id);
  };

  // --- Logic for Transfer ---
  const checkedItems = items.filter(i => i.checked);
  
  const handleTransferToStock = () => {
      if (checkedItems.length === 0) return;
      onAddToStock(checkedItems);
      // Remove checked items from list
      setItems(prev => prev.filter(i => !i.checked));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative transition-colors duration-300">
      {/* Header */}
      <div className="pt-10 pb-6 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm z-20 transition-colors duration-300 shrink-0">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Ma Liste</h1>
           <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mt-0.5">{items.filter(i => !i.checked).length} articles à acheter</p>
        </div>
        <button 
           onClick={() => setShowTemplates(!showTemplates)}
           className={`p-2.5 rounded-xl transition-all border ${
               showTemplates 
               ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
               : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
           }`}
           title="Gérer les modèles"
        >
           <LayoutTemplate size={20} />
        </button>
      </div>

      {/* Templates Panel (Collapsible) */}
      <div 
        className={`bg-slate-100/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-500 ease-in-out z-10 ${showTemplates ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0'}`}
      >
           <div className="p-4 space-y-3">
                <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Vos Modèles
                        </h3>
                        <button 
                            onClick={() => setIsCreatingTemplate(!isCreatingTemplate)} 
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${isCreatingTemplate ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm'}`}
                        >
                            <Save size={12} /> Nouveau
                        </button>
                </div>

                {isCreatingTemplate && (
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Sauvegarder la liste actuelle ({items.length} articles) :</p>
                        <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Nom du modèle..." 
                                    className="flex-1 p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                />
                                <button 
                                    onClick={saveCurrentAsTemplate}
                                    className="bg-emerald-600 text-white px-4 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    disabled={items.length === 0 || !newTemplateName.trim()}
                                >
                                    OK
                                </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar pb-2">
                    {templates.map(t => (
                        <div key={t.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md shrink-0">
                            {/* Card Header */}
                            <div 
                                className="flex items-center p-3 justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                onClick={() => toggleExpand(t.id)}
                            >
                                {editingId === t.id ? (
                                    <div className="flex items-center gap-2 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="text" 
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 p-1.5 border border-emerald-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && saveEditName(t.id)}
                                        />
                                        <button onClick={() => saveEditName(t.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded"><Check size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                        <div className={`p-1.5 rounded-lg ${expandedId === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                                            <LayoutTemplate size={16} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-slate-700 dark:text-slate-200 text-sm font-bold truncate">{t.name}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {t.items.length} articles
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-1">
                                    {!editingId && (
                                        <>
                                            <button 
                                                onClick={(e) => startEditing(t, e)} 
                                                className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => deleteTemplate(t.id, e)} 
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div className={`p-2 text-slate-300 transition-transform duration-300 ${expandedId === t.id ? 'rotate-180 text-emerald-500' : ''}`}>
                                                <ChevronDown size={16} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Card Body (Accordion) */}
                            <div 
                                className={`grid transition-[grid-template-rows] duration-300 ease-out ${expandedId === t.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                            >
                                <div className="overflow-hidden">
                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50">
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {t.items.map((item, idx) => (
                                                <span key={idx} className="text-[10px] px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex">
                                            <button 
                                                onClick={() => applyTemplate(t)}
                                                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus size={16} /> Ajouter à ma liste
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
           </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth bg-slate-50 dark:bg-slate-900">
          
          {/* Sticky Input */}
          <div className="sticky top-0 z-10 px-4 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
                <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
                    <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addItem(newItemName)}
                        placeholder="Ajouter un article (ex: Lait)"
                        className="flex-1 px-3 py-2 bg-transparent outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 text-sm"
                    />
                    <button
                        onClick={() => addItem(newItemName)}
                        className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-200 dark:shadow-none active:scale-95"
                    >
                        <Plus size={20} />
                    </button>
                </div>
          </div>

          {/* List Content */}
          <div className="p-4 space-y-2.5 pb-44">
            {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 animate-in fade-in zoom-in-95">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-500">
                        <ShoppingCart size={28} />
                    </div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400">Votre liste est vide</p>
                    <p className="text-xs text-center mt-1 text-slate-400 max-w-[200px]">Utilisez les modèles ou ajoutez des articles manuellement.</p>
                </div>
            )}
            
            {items.map((item) => (
            <div
                key={item.id}
                className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 animate-in slide-in-from-bottom-2 ${
                item.checked 
                    ? 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60' 
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-900'
                }`}
            >
                <div className="flex items-center gap-4 flex-1 cursor-pointer select-none" onClick={() => toggleCheck(item.id)}>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        item.checked 
                        ? 'bg-emerald-500 border-emerald-500 scale-105' 
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'
                    }`}>
                        <Check size={14} className={`text-white transition-transform duration-200 ${item.checked ? 'scale-100' : 'scale-0'}`} />
                    </div>
                    <span className={`text-sm font-medium transition-all ${item.checked ? 'text-slate-400 dark:text-slate-600 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item.name}
                    </span>
                </div>
                <button
                onClick={() => removeItem(item.id)}
                className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-90"
                >
                <Trash2 size={18} />
                </button>
            </div>
            ))}
         </div>
         
         {/* FLOATING ACTION BUTTON FOR TRANSFER */}
         {checkedItems.length > 0 && (
             <div className="absolute bottom-24 left-0 right-0 px-4 flex justify-center z-30 animate-in slide-in-from-bottom-6 fade-in duration-300 pointer-events-none">
                 <button 
                    onClick={handleTransferToStock}
                    className="pointer-events-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 active:scale-95 transition-all hover:scale-105 border-2 border-slate-700 dark:border-slate-200"
                 >
                     <div className="bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                         {checkedItems.length}
                     </div>
                     <span className="font-bold text-sm pr-1">Ajouter au Stock</span>
                     <Archive size={18} />
                 </button>
             </div>
         )}
      </div>

      <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  );
};

export default ShoppingList;