import React, { useState } from 'react';
import { useAppUpdates } from '../context/AppUpdateContext';
import { useTransit } from '../context/TransitContext';

export const AppUpdateBanner = () => {
  const update = useAppUpdates();
  const { language } = useTransit();
  const [dismissed, setDismissed] = useState(false);
  const isAr = language === 'ar';
  if (!update.available || dismissed) return null;
  return <aside role="status" className="shrink-0 border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 px-3 py-2 text-xs text-amber-950 dark:text-amber-200">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>{isAr ? 'إصدار جديد جاهز' : 'New version ready'}</strong>
      <div className="flex items-center gap-2">
        <button type="button" disabled={update.status === 'applying'} onClick={update.apply} className="min-h-10 px-3 rounded-xl bg-amber-500 text-slate-950 font-black disabled:opacity-50">{isAr ? 'تحديث الآن' : 'Update now'}</button>
        <button type="button" onClick={() => setDismissed(true)} className="min-h-10 px-2 font-bold underline underline-offset-4">{isAr ? 'لاحقاً' : 'Later'}</button>
      </div>
    </div>
    <p className="mt-1">{update.status === 'error' ? (isAr ? 'تعذر إعادة التحميل. حاول التحديث مرة أخرى.' : 'Could not reload. Try updating again.') : (isAr ? 'أكمل أي حجز أو تعديل قبل التحديث. لن نعيد تحميل الصفحة تلقائياً.' : 'Finish any booking or edit before updating. This page will not reload automatically.')}</p>
  </aside>;
};
