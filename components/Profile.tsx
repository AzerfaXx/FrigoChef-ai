import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { User, Moon, Sun, Camera, Shield, ToggleLeft, ToggleRight, Smartphone, Share, X, MoreVertical, Download, HelpCircle, Flame, Bell } from 'lucide-react';

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
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      setShowInstallInstructions(false);
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
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          (window as any).deferredPrompt = null;
        }
      });
    } else {
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
        if (!('Notification' in window)) {
            alert("Les notifications ne sont pas supportées par ce navigateur.");
            return;
        }
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            
            // NOTIFICATION IMMÉDIATE DE CONFIRMATION
            try {
                new Notification('Notifications activées ! 🎉', {
                    body: 'Merci ! Vous recevrez nos alertes anti-gaspi et vos rappels de streak quotidiens.',
                    icon: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png',
                    tag: 'welcome-notif'
                });
            } catch (e) {
                console.error("Erreur notification test", e);
            }

        } else {
            alert("Veuillez autoriser les notifications dans les paramètres de votre appareil.");
            setNotificationsEnabled(false);
        }
    } else {
        setNotificationsEnabled(false);
    }
  };

  // --- Dynamic Streak Style Logic ---
  const getStreakStyle = (days: number) => {
    if (days >= 100) {
      return {
        wrapper: "bg-slate-900 border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.5)]",
        icon: "text-blue-100 fill-blue-400 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-[pulse_1s_ease-in-out_infinite] scale-110",
        text: "text-transparent bg-clip-text bg-gradient-to-r from-blue-100 via-white to-blue-200 font-black drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]"
      };
    }

    const level = Math.floor(days / 5);
    const palettes = [
        { w: "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800", i: "text-orange-500 fill-orange-500", t: "text-orange-600 dark:text-orange-400" },
        { w: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800", i: "text-yellow-500 fill-yellow-500", t: "text-yellow-600 dark:text-yellow-400" },
        { w: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800", i: "text-red-500 fill-red-500", t: "text-red-600 dark:text-red-400" },
        { w: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800", i: "text-purple-500 fill-purple-500", t: "text-purple-600 dark:text-purple-400" },
    ];
    const current = palettes[level % palettes.length];
    
    return {
        wrapper: current.w,
        icon: current.i + (days > 0 ? " animate-[pulse_3s_infinite]" : ""),
        text: current.t
    };
  };

  const streakStyle = getStreakStyle(streak);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">
      
      {/* Install Instructions Modal */}
      {showInstallInstructions && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 w-full max-w-[320px] rounded-3xl p-6 shadow-2xl relative flex flex-col items-center">
                  <button onClick={() => setShowInstallInstructions(false)} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                      <X size={16} />
                  </button>
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-4">
                      {isIOS ? <Share size={28} className="text-blue-500" /> : <MoreVertical size={28} className="text-slate-500" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 text-center">Installer l'app</h3>
                  <div className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-3">
                      <p className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                           <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                           <span>Ouvrez le menu du navigateur</span>
                      </p>
                      <p className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                           <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                           <span>Sélectionnez "Ajouter à l'écran d'accueil"</span>
                      </p>
                  </div>
              </div>
          </div>
      )}
      
      {/* Header Profile */}
      <div className="pt-8 pb-8 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300 flex flex-col items-center relative z-10">
        <div className="absolute top-4 right-4">
             <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 active:scale-95"
             >
                 {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
        </div>

        <div className="relative group cursor-pointer mt-4" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl overflow-hidden border-4 border-white dark:border-slate-700 bg-gradient-to-br from-emerald-400 to-teal-600">
                {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <User size={40} />
                )}
            </div>
            <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full border-2 border-white dark:border-slate-800 shadow-md group-hover:scale-110 transition-transform">
                <Camera size={14} />
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
            />
        </div>

        <div className="mt-4 text-center w-full">
             {isEditingName ? (
                 <div className="flex items-center gap-2 justify-center mb-2">
                     <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 text-lg font-bold w-40 text-center outline-none dark:text-white"
                        autoFocus
                     />
                     <button onClick={saveName} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold">OK</button>
                 </div>
             ) : (
                <h1 
                    onClick={() => setIsEditingName(true)}
                    className="text-xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2 cursor-pointer hover:opacity-70 mb-2"
                >
                    {userProfile.name}
                </h1>
             )}
             
             {/* Streak Display */}
             <div className="flex items-center justify-center animate-in fade-in zoom-in duration-500">
                 <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border shadow-sm transition-all duration-500 max-w-[150px] overflow-hidden ${streakStyle.wrapper}`}>
                    <Flame size={18} className={`transition-all duration-500 shrink-0 ${streakStyle.icon}`} />
                    <span className={`text-lg font-black font-mono tracking-tight transition-all duration-500 ${streakStyle.text}`}>{streak}</span>
                 </div>
             </div>
        </div>
      </div>

      {/* Settings Options - Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-4">

         {/* INSTALL APP BUTTON */}
         {!isStandalone && (
            <button 
                onClick={handleInstallClick}
                className={`w-full p-4 rounded-2xl shadow-lg flex items-center justify-between group active:scale-95 transition-all ${
                    deferredPrompt 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200 dark:shadow-none' 
                    : 'bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-800 dark:text-white'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${deferredPrompt ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                        <Smartphone size={22} className={deferredPrompt ? "text-white" : "text-blue-500"} />
                    </div>
                    <div className="text-left min-w-0">
                        <p className="font-bold text-sm truncate">Installer l'app</p>
                        <p className={`text-[10px] truncate ${deferredPrompt ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {deferredPrompt ? 'Accès rapide' : 'Instructions'}
                        </p>
                    </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 shrink-0 ${
                    deferredPrompt 
                    ? 'bg-white text-emerald-600' 
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                    {deferredPrompt ? <Download size={12} /> : <HelpCircle size={12} />}
                    {deferredPrompt ? 'Go' : 'Aide'}
                </div>
            </button>
         )}

         <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-2">Paramètres</h2>
         
         <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700/50">
             
             <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={toggleNotifications}>
                 <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center shrink-0">
                     <Bell size={18} />
                 </div>
                 <div className="flex-1 min-w-0">
                     <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Notifications</p>
                     <p className="text-[10px] text-slate-400 truncate">Rappels péremption & Streak</p>
                 </div>
                 <div className={`${notificationsEnabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {notificationsEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                 </div>
             </div>

             <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => setPrivateMode(!privateMode)}>
                 <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shrink-0">
                     <Shield size={18} />
                 </div>
                 <div className="flex-1 min-w-0">
                     <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Confidentialité</p>
                     <p className="text-[10px] text-slate-400 truncate">Mode privé</p>
                 </div>
                 <div className={`${privateMode ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {privateMode ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                 </div>
             </div>
         </div>
         
         <div className="text-center pt-4">
             <p className="text-[10px] text-slate-300 dark:text-slate-600">
                 FrigoChef AI v1.6.0 (Notifs Boosted)
             </p>
         </div>
      </div>
    </div>
  );
};

export default Profile;