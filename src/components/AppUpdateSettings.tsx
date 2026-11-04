import React from 'react';
import { useAppUpdates } from '../context/AppUpdateContext';
import { useTransit } from '../context/TransitContext';

export const AppUpdateSettings = () => {
  const update = useAppUpdates();
  const { language, isOnline } = useTransit();
  const isAr = language === 'ar';
  const unsupported = update.status === 'unsupported';
  const busy = update.status === 'checking' || update.status === 'applying';
  return <section className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{isAr ? 'تحديث التطبيق' : 'App updates'}</h3>
    <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
      {update.available ? (isAr ? 'إصدار جديد جاهز. أكمل أي حجز قبل التحديث.' : 'A new version is ready. Finish any booking before updating.')
        : unsupported ? (isAr ? 'سيظهر الإصدار الأحدث عند إعادة فتح التطبيق.' : 'The latest version loads when you reopen the app.')
        : !isOnline ? (isAr ? 'أنت دون اتصال. سنتحقق عند عودة الاتصال.' : 'You are offline. Updates will be checked when you reconnect.')
        : busy ? (isAr ? 'جارٍ التحقق من التحديثات...' : 'Checking for updates…')
        : update.status === 'error' ? (isAr ? 'تعذر التحقق. يمكنك المحاولة مرة أخرى.' : 'Could not check for updates. You can try again.')
        : (isAr ? 'لا يوجد تحديث جاهز الآن. نتحقق أيضاً عند عودتك للتطبيق.' : 'No update is ready right now. We also check when you return to the app.')}
    </p>
    {!unsupported && <button type="button" disabled={busy || (!isOnline && !update.available)} onClick={update.available ? update.apply : update.check}
      className="min-h-11 px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-50">
      {update.available ? (isAr ? 'تحديث الآن' : 'Update now') : (isAr ? 'التحقق من التحديثات' : 'Check for updates')}
    </button>}
  </section>;
};
