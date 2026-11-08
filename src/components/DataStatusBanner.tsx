import React from 'react';
import { useTransit } from '../context/TransitContext';

export const DataStatusBanner = () => {
  const { language, showDemoData, setShowDemoData, isOnline, shared, isAdminAuthenticated } = useTransit();
  const isAr = language === 'ar';
  if (!isAdminAuthenticated && !showDemoData && isOnline && shared.status === 'connected') return null;
  return (
    <aside aria-live="polite" className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-xs text-amber-950 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{showDemoData ? (isAr ? 'معاينة تجريبية' : 'Demo preview')
          : shared.status === 'connected' ? (isAr ? 'أدوات المعاينة' : 'Preview tools')
          : !isOnline ? (isAr ? 'دون إنترنت — اتصل بالسائق للتأكد' : 'Offline — call the driver to check')
          : shared.status === 'connecting' ? (isAr ? 'جارٍ الاتصال…' : 'Connecting…')
          : (isAr ? 'تعذر تحديث البيانات — اتصل للتأكد' : 'Updates unavailable — call to check')}</strong>
        {isAdminAuthenticated && <button type="button" aria-pressed={showDemoData} onClick={() => setShowDemoData(!showDemoData)}
          className="min-h-9 px-2 rounded-xl bg-white/70 dark:bg-black/20 font-bold underline underline-offset-4">
          {showDemoData ? (isAr ? 'إخفاء البيانات التجريبية' : 'Hide demo data') : (isAr ? 'عرض البيانات التجريبية' : 'View demo data')}
        </button>}
      </div>
      {showDemoData && <p className="font-bold">{isAr ? 'المواقع والمقاعد التجريبية لا تعني وجود سائق متاح فعلياً.' : 'Demo locations and seats do not indicate real driver availability.'}</p>}
    </aside>
  );
};
