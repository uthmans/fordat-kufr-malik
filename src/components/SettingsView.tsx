import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { GPSSimulatorPanel } from './GPSSimulatorPanel';
import { AdminPortal } from './AdminPortal';
import { AppUpdateSettings } from './AppUpdateSettings';
import {
  Smartphone,
  Sun,
  Moon,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Download,
  Shield
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, highContrast, setHighContrast, resetAll } = useTransit();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isAr = language === 'ar';
  const [showAdminPortal, setShowAdminPortal] = useState(false);

  if (showAdminPortal) {
    return <AdminPortal onClose={() => setShowAdminPortal(false)} />;
  }

  return (
    <div className="space-y-5 pb-8">
      <AppUpdateSettings />
      {/* 1. GPS Tracking & Movement Simulation Lab */}
      <GPSSimulatorPanel />

      {/* 2. Admin Portal Card (Master PIN 9999) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">
                {isAr ? 'بوابة إدارة السائقين (Master PIN: 9999)' : 'Admin Portal (Master PIN: 9999)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'إدارة السائقين الثمانية، إعادة تعيين الرموز، وأرشيف الرحلات العام'
                  : 'Manage all 8 drivers, reset PINs, view and clear archives'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdminPortal(true)}
            className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors tap-highlight"
          >
            <Shield size={14} />
            <span>{isAr ? 'فتح الإدارة' : 'Open Admin'}</span>
          </button>
        </div>
      </div>

      {/* 3. PWA Native App Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {isAr ? 'تثبيت التطبيق على الهاتف (PWA)' : 'PWA Installation Status'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'يعمل كتطبيق هاتف أصلي بدون شريط المتصفح'
                  : 'Runs in full standalone mode like an iOS/Android native app'}
              </p>
            </div>
          </div>

          {isInstalled ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>{isAr ? 'مُثبت' : 'Installed'}</span>
            </span>
          ) : isInstallable ? (
            <button
              onClick={install}
              className="py-2 px-3.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>{isAr ? 'تثبيت الآن' : 'Install App'}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              {isIOS ? (isAr ? 'متاح عبر سفاري' : 'Safari Add to Home') : (isAr ? 'جاهز للتثبيت' : 'Web Ready')}
            </span>
          )}
        </div>
      </div>

      {/* 4. Appearance & Language */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
          {isAr ? 'تفضيلات العرض واللغة' : 'Display & Language Preferences'}
        </h3>

        <div className="space-y-3">
          {/* Sunlight Mode */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                {isAr ? 'وضع ضوء الشمس شديد التباين' : 'Sunlight High-Contrast Mode'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {isAr ? 'وضوح فائق للقراءة تحت أشعة الشمس المباشرة' : 'High contrast for outdoor daylight readability'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setHighContrast(!highContrast)}
              className={`p-2 rounded-xl transition-all ${
                highContrast
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {highContrast ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                {isAr ? 'لغة الواجهة' : 'Interface Language'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {isAr ? 'العربية (محلي لكفر مالك) أو English' : 'Arabic or English'}
              </span>
            </div>

            <div className="flex gap-1 p-1 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  language === 'ar'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  language === 'en'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Reset All Data */}
      <div className="p-4 rounded-3xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            {isAr ? 'إعادة ضبط البيانات الأصلية' : 'Reset to Default Prototype Data'}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {isAr ? 'استعادة السائقين الثمانية ومسح الحجوزات والأرشيف' : 'Restores initial 8 drivers and resets trip history'}
          </span>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors tap-highlight"
        >
          <RotateCcw size={13} />
          <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
        </button>
      </div>
    </div>
  );
};
