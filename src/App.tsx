import React, { useEffect } from 'react';
import { TransitProvider, useTransit } from './context/TransitContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { VillagerView } from './components/VillagerView';
import { DriverView } from './components/DriverView';
import { SettingsView } from './components/SettingsView';
import { DataStatusBanner } from './components/DataStatusBanner';
import { AppUpdateProvider } from './context/AppUpdateContext';
import { AppUpdateBanner } from './components/AppUpdateBanner';

const MainAppContent: React.FC = () => {
  const { activeTab, language, highContrast } = useTransit();
  const isAr = language === 'ar';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';

    if (highContrast) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [language, highContrast, isAr]);

  return (
    <div
      className={`h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex justify-center transition-colors duration-150 ${
        highContrast ? 'bg-black text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Smartphone Container: Full width on mobile, comfortably sized on tablets/desktops without cramping */}
      <div className="w-full max-w-lg h-full flex flex-col bg-slate-50 dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Mobile App Bar */}
        <Header />
        <AppUpdateBanner />

        {/* Scrollable Viewport: Internal panel scrolling with generous bottom padding for bottom nav */}
        <div
          id="scrollable-panel"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 space-y-4"
        >
          <DataStatusBanner />
          {activeTab === 'villager' && <VillagerView />}
          {activeTab === 'driver' && <DriverView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>

        {/* Native Fixed Bottom Navigation Bar */}
        <BottomNav />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <TransitProvider>
      <AppUpdateProvider><MainAppContent /></AppUpdateProvider>
    </TransitProvider>
  );
}
