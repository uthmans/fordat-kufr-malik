import React from 'react';
import { useTransit } from '../context/TransitContext';
import { Bus, Sun, Moon } from 'lucide-react';

export const Header: React.FC = () => {
  const { language, setLanguage, highContrast, setHighContrast, isTrackingRealGPS, isSimulatingGPS } = useTransit();
  const isAr = language === 'ar';

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors select-none shrink-0">
      <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-xs shrink-0">
            <Bus size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {isAr ? 'سرفيس كفر مالك' : 'Kufr Malik Transit'}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium -mt-0.5 truncate">
              <span>{isAr ? 'خط كفر مالك ⇄ الموقف' : 'Kufr Malik ⇄ Ramallah'}</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {isTrackingRealGPS
                  ? isAr ? 'GPS مباشر' : 'GPS Live'
                  : isSimulatingGPS
                  ? isAr ? 'محاكاة نشطة' : 'Sim Active'
                  : isAr ? 'متصل' : 'Online'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Utilities */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sunlight High-Contrast Toggle */}
          <button
            onClick={() => setHighContrast(!highContrast)}
            title={highContrast ? 'Standard Mode' : 'Sunlight High-Contrast Mode'}
            className={`p-2 rounded-xl text-xs font-semibold transition-colors tap-highlight ${
              highContrast
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
            aria-label="Toggle Sunlight High-Contrast"
          >
            {highContrast ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Quick Lang Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors tap-highlight"
          >
            {language === 'en' ? 'العربية' : 'EN'}
          </button>
        </div>
      </div>
    </header>
  );
};
