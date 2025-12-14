
import React, { useState } from 'react';
import { ChefHat, Mail, Lock, ArrowRight, ChevronRight } from 'lucide-react';

interface Props {
  onLogin: (email: string, name: string) => void;
  onSkip: () => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin, onSkip }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    // Simulate network delay for a professional feel
    setTimeout(() => {
      const name = email.split('@')[0];
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      onLogin(email, formattedName);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Skip Button */}
      <div className="absolute top-6 right-6 z-20 animate-in fade-in slide-in-from-top-4 duration-1000">
         <button 
           onClick={onSkip}
           className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium text-sm transition-colors"
         >
           Passer <ChevronRight size={16} />
         </button>
      </div>

      <div className="w-full max-w-sm z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl flex items-center justify-center mb-4 transform rotate-3">
             <ChefHat size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">FrigoChef AI</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Votre assistant culinaire intelligent</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 backdrop-blur-sm">
           <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 text-center">
             {isRegistering ? 'Créer un compte' : 'Bon retour parmi nous'}
           </h2>

           <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
                 <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                    <Mail size={18} className="text-slate-400" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none ml-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                      placeholder="exemple@email.com"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mot de passe</label>
                 <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                    <Lock size={18} className="text-slate-400" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none ml-3 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                      placeholder="••••••••"
                      required
                    />
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
              >
                {loading ? (
                   <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                   <>
                     {isRegistering ? "S'inscrire" : "Se connecter"} <ArrowRight size={18} />
                   </>
                )}
              </button>
           </form>

           <p className="text-center mt-6 text-sm text-slate-500">
             {isRegistering ? "Déjà un compte ?" : "Pas encore de compte ?"}
             <button 
               onClick={() => setIsRegistering(!isRegistering)}
               className="text-emerald-600 dark:text-emerald-400 font-bold ml-1 hover:underline"
             >
               {isRegistering ? "Se connecter" : "S'inscrire"}
             </button>
           </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
