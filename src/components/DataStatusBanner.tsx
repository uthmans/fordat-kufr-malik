import React from 'react';
import { useTransit } from '../context/TransitContext';

export const DataStatusBanner = () => {
  const { language, showDemoData, setShowDemoData, isOnline } = useTransit();
  const isAr = language === 'ar';
  return (
    <aside className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-xs text-amber-950 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{showDemoData ? (isAr ? 'معاينة تجريبية' : 'Demo preview') : (isAr ? 'بيانات هذا الجهاز فقط' : 'Data from this device only')}</strong>
        <button type="button" aria-pressed={showDemoData} onClick={() => setShowDemoData(!showDemoData)}
          className="min-h-9 px-2 rounded-xl bg-white/70 dark:bg-black/20 font-bold underline underline-offset-4">
          {showDemoData ? (isAr ? 'إخفاء البيانات التجريبية' : 'Hide demo data') : (isAr ? 'عرض البيانات التجريبية' : 'View demo data')}
        </button>
      </div>
      <p>{isAr ? 'لم يتم ربط هواتف السائقين بعد. تأكد من التوفر عبر واتساب قبل الانطلاق.' : 'Driver phones are not connected yet. Confirm availability through WhatsApp before travelling.'}</p>
      {showDemoData && <p className="font-bold">{isAr ? 'المواقع والمقاعد التجريبية لا تعني وجود سائق متاح فعلياً.' : 'Demo locations and seats do not indicate real driver availability.'}</p>}
      {!isOnline && <p className="font-bold" role="status">{isAr ? 'أنت دون اتصال — تحقق من أوقات التحديث للبيانات المحفوظة.' : 'You are offline — check update times on saved data.'}</p>}
    </aside>
  );
};
