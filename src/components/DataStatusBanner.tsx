import React from 'react';
import { useTransit } from '../context/TransitContext';

export const DataStatusBanner = () => {
  const { language, showDemoData, setShowDemoData, isOnline, shared } = useTransit();
  const isAr = language === 'ar';
  return (
    <aside className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 text-xs text-amber-950 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{showDemoData ? (isAr ? 'معاينة تجريبية' : 'Demo preview')
          : shared.status === 'connected' ? (isAr ? 'تحديثات السائقين المشتركة' : 'Shared driver updates')
          : shared.status === 'connecting' ? (isAr ? 'جارٍ الاتصال بالتحديثات المشتركة' : 'Connecting to shared updates')
          : (isAr ? 'التحديثات المشتركة غير متصلة' : 'Shared updates disconnected')}</strong>
        <button type="button" aria-pressed={showDemoData} onClick={() => setShowDemoData(!showDemoData)}
          className="min-h-9 px-2 rounded-xl bg-white/70 dark:bg-black/20 font-bold underline underline-offset-4">
          {showDemoData ? (isAr ? 'إخفاء البيانات التجريبية' : 'Hide demo data') : (isAr ? 'عرض البيانات التجريبية' : 'View demo data')}
        </button>
      </div>
      <p>{isAr ? 'مواقع السائقين والمقاعد المنشورة تُشارك بين الهواتف. طلبات الحجز ما زالت محفوظة على هذا الجهاز؛ أرسل رسالة واتساب وانتظر تأكيد السائق.' : 'Published driver locations and seats are shared between phones. Booking requests still stay on this device; send the WhatsApp message and wait for the driver’s confirmation.'}</p>
      {!showDemoData && shared.status !== 'connected' && <p role="status">{isAr ? 'قد تكون البيانات المعروضة قديمة. تأكد من التوفر عبر واتساب.' : 'Displayed updates may be old. Confirm availability through WhatsApp.'}</p>}
      {showDemoData && <p className="font-bold">{isAr ? 'المواقع والمقاعد التجريبية لا تعني وجود سائق متاح فعلياً.' : 'Demo locations and seats do not indicate real driver availability.'}</p>}
      {!isOnline && <p className="font-bold" role="status">{isAr ? 'أنت دون اتصال — تحقق من أوقات التحديث للبيانات المحفوظة.' : 'You are offline — check update times on saved data.'}</p>}
    </aside>
  );
};
