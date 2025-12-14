import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { User, Moon, Sun, Camera, Settings, Shield, ToggleLeft, ToggleRight, Smartphone, Share, X, MoreVertical, Download, HelpCircle, Flame, Bell } from 'lucide-react';

interface Props {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  streak: number;
  notificationsEnabled: boolean;
  setNotificationsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

const Profile: React.FC<Props> = ({ userProfile, setUserProfile, darkMode, setDarkMode, streak, notificationsEnabled, setNotificationsEnabled }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userProfile.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  // Settings states
  const [privateMode, setPrivateMode] = useState(false);

  useEffect(() => {
    // 1. Detect if app is running in standalone mode (Installed App)
    const checkStandalone = () => {
        const mq = window.matchMedia('(display-mode: standalone)');
        const isNavStandalone = (window.navigator as any).standalone === true; // iOS legacy
        setIsStandalone(mq.matches || isNavStandalone);
    };
    
    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    // 2. Detect iOS
    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosCheck);

    // 3. Handle 'beforeinstallprompt' for Android/Desktop
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      console.log("Install prompt captured in Profile");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Listen for successful installation
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      setShowInstallInstructions(false);
      console.log("App installed successfully");
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('resize', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      // Android/Desktop: Trigger the native prompt
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setDeferredPrompt(null);
          (window as any).deferredPrompt = null;
        } else {
          console.log('User dismissed the install prompt');
        }
      });
    } else {
        // iOS or Browser preventing prompt: Show manual instructions
        setShowInstallInstructions(true);
    }
  };

  const saveName = () => {
    setUserProfile({ ...userProfile, name: newName });
    setIsEditingName(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
        // Enable logic
        if (!('Notification' in window)) {
            alert("Les notifications ne sont pas supportées par ce navigateur.");
            return;
        }
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            new Notification('Notifications activées ! 🔔', {
                body: 'Vous serez alerté si vos produits arrivent à péremption.',
                icon: '/icon.png'
            });
        } else {
            alert("Veuillez autoriser les notifications dans les paramètres de votre appareil.");
            setNotificationsEnabled(false);
        }
    } else {
        // Disable logic
        setNotificationsEnabled(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative">
      
      {/* Install Instructions Modal (iOS or Fallback) */}
      {showInstallInstructions && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                  <button onClick={() => setShowInstallInstructions(false)} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500">
                      <X size={16} />
                  </button>
                  <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                          {isIOS ? <Share size={32} className="text-blue-500" /> : <MoreVertical size={32} className="text-slate-500" />}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Installer l'application</h3>
                      
                      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 text-left w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                          {isIOS ? (
                              <>
                                <p className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                                    Appuyez sur <strong className="text-blue-500">Partager</strong> (carré avec flèche).
                                </p>
                                <p className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                                    Cherchez <strong className="whitespace-nowrap">Sur l'écran d'accueil</strong>.
                                </p>
                              </>
                          ) : (
                              <>
                                <p className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                                    Ouvrez le menu du navigateur (3 points).
                                </p>
                                <p className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                                    Sélectionnez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.
                                </p>
                              </>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* Header */}
      <div className="pt-10 pb-12 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300 flex flex-col items-center relative">
        <div className="absolute top-4 right-4">
             <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600"
             >
                 {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
        </div>

        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl overflow-hidden border-4 border-white dark:border-slate-700 bg-gradient-to-br from-emerald-400 to-teal-600">
                {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <User size={48} />
                )}
            </div>
            <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full border-2 border-white dark:border-slate-800 shadow-md group-hover:scale-110 transition-transform">
                <Camera size={16} />
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
            />
        </div>

        <div className="mt-4 text-center">
             {isEditingName ? (
                 <div className="flex items-center gap-2 justify-center">
                     <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 text-xl font-bold w-40 text-center outline-none dark:text-white"
                        autoFocus
                     />
                     <button onClick={saveName} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold">OK</button>
                 </div>
             ) : (
                <h1 
                    onClick={() => setIsEditingName(true)}
                    className="text-2xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2 cursor-pointer hover:opacity-70"
                >
                    {userProfile.name}
                </h1>
             )}
             
             {/* Streak Display */}
             <div className="flex items-center justify-center gap-2 mt-3 animate-in fade-in zoom-in duration-500">
                 <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-1.5 rounded-full flex items-center gap-2 border border-orange-100 dark:border-orange-800/50 shadow-sm">
                    <Flame size={18} className="text-orange-500 fill-orange-500 animate-[pulse_2s_infinite]" />
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak} jours de suite</span>
                 </div>
             </div>
        </div>
      </div>

      {/* Settings Options */}
      <div className="p-6 space-y-4">

         {/* INSTALL APP BUTTON - Intelligent Logic */}
         {!isStandalone && (
            <button 
                onClick={handleInstallClick}
                className={`w-full p-4 rounded-2xl shadow-lg flex items-center justify-between group active:scale-95 transition-all mb-4 animate-in fade-in slide-in-from-top-2 ${
                    deferredPrompt 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200 dark:shadow-none' 
                    : 'bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-800 dark:text-white'
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${deferredPrompt ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                        <Smartphone size={24} className={deferredPrompt ? "text-white" : "text-blue-500"} />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">Installer l'application</p>
                        <p className={`text-xs ${deferredPrompt ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {deferredPrompt ? 'Version complète (APK)' : 'Instructions d\'installation'}
                        </p>
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1 ${
                    deferredPrompt 
                    ? 'bg-white text-emerald-600 group-hover:bg-emerald-50' 
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100'
                }`}>
                    {deferredPrompt ? <Download size={14} /> : <HelpCircle size={14} />}
                    {deferredPrompt ? 'Télécharger' : 'Comment faire ?'}
                </div>
            </button>
         )}

         <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Paramètres</h2>
         
         <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700/50">
             <div className="p-4 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center">
                     <Settings size={20} />
                 </div>
                 <div className="flex-1">
                     <p className="font-bold text-slate-700 dark:text-slate-200">Préférences</p>
                     <p className="text-xs text-slate-400">Unités (Métrique)</p>
                 </div>
                 <div className="text-slate-300">
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded">Auto</span>
                 </div>
             </div>

             {/* NOTIFICATIONS TOGGLE */}
             <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={toggleNotifications}>
                 <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center">
                     <Bell size={20} />
                 </div>
                 <div className="flex-1">
                     <p className="font-bold text-slate-700 dark:text-slate-200">Notifications</p>
                     <p className="text-xs text-slate-400">Rappels de péremption & Streak</p>
                 </div>
                 <div className={`${notificationsEnabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {notificationsEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                 </div>
             </div>

             <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => setPrivateMode(!privateMode)}>
                 <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center">
                     <Shield size={20} />
                 </div>
                 <div className="flex-1">
                     <p className="font-bold text-slate-700 dark:text-slate-200">Confidentialité</p>
                     <p className="text-xs text-slate-400">Mode privé</p>
                 </div>
                 <div className={`${privateMode ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {privateMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                 </div>
             </div>
         </div>
         
         <div className="text-center mt-6">
             <p className="text-[10px] text-slate-300 dark:text-slate-600">
                 FrigoChef AI v1.3.0
             </p>
         </div>
      </div>
    </div>
  );
};

export default Profile;