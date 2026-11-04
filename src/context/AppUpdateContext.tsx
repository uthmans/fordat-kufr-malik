import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { AppUpdateState, createAppUpdater } from '../utils/appUpdater';

interface AppUpdates extends AppUpdateState { check(): void; apply(): void; }
const AppUpdateContext = createContext<AppUpdates | null>(null);

export const AppUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppUpdateState>({ available: false, status: 'idle' });
  const updater = useRef<ReturnType<typeof createAppUpdater> | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
      setState({ available: false, status: 'unsupported' });
      return;
    }
    const controller = createAppUpdater((callbacks) => registerSW(callbacks), () => window.location.reload(), setState);
    updater.current = controller;
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void controller.check();
    };
    const interval = setInterval(check, 5 * 60 * 1000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.stop();
      updater.current = null;
      clearInterval(interval);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return <AppUpdateContext.Provider value={{ ...state, check: () => { void updater.current?.check(); }, apply: () => updater.current?.apply() }}>{children}</AppUpdateContext.Provider>;
};

export function useAppUpdates() {
  const value = useContext(AppUpdateContext);
  if (!value) throw new Error('AppUpdateProvider is missing');
  return value;
}
