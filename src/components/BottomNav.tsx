import React from 'react';
import { useTransit } from '../context/TransitContext';
import { ActiveTab } from '../types';
import { Bus, Gauge, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, language, seatRequests, currentDriver } = useTransit();
  const isAr = language === 'ar';

  const pendingCount = seatRequests.filter(
    (r) => r.driverId === currentDriver?.id && r.status === 'pending'
  ).length;

  const tabs: { id: ActiveTab; labelEn: string; labelAr: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'villager',
      labelEn: 'Villagers Feed',
      labelAr: 'لوحة الركاب',
      icon: <Bus size={20} />
    },
    {
      id: 'driver',
      labelEn: 'Driver Mode',
      labelAr: 'شاشة السائق',
      icon: <Gauge size={20} />,
      badge: pendingCount
    },
    {
      id: 'settings',
      labelEn: 'Settings & GPS',
      labelAr: 'الإعدادات و GPS',
      icon: <Settings size={20} />
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-lg select-none">
      <div className="max-w-lg mx-auto grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[50px] relative flex flex-col items-center justify-center rounded-2xl transition-all tap-highlight ${
                isActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-bounce">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] mt-1 tracking-tight truncate max-w-full px-1">
                {isAr ? tab.labelAr : tab.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
