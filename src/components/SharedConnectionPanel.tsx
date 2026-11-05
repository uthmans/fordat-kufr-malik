import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';

export function SharedConnectionPanel() {
  const { shared, language, setActiveTab, logoutDriver, drivers } = useTransit();
  const isAr = language === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const owner = drivers.find(driver => driver.id === shared.ownerId);
  const start = async () => {
    if (busy) return;
    setBusy(true); setError(false);
    try { if (!await shared.startSharing()) setError(true); } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3 text-sm">
    <h3 className="font-black">{isAr ? 'مشاركة تحديثات السائق' : 'Share driver updates'}</h3>
    {!owner ? <>
      <p className="text-xs text-slate-500">{isAr ? 'اختر اسمك في شاشة السائق وأدخل رمز الدخول الخاص بك. لا تحتاج بريداً إلكترونياً أو رسالة SMS.' : 'Select your name in Driver Mode and enter your private access code. No email or SMS needed.'}</p>
      <button type="button" onClick={() => setActiveTab('driver')} className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold">
        {isAr ? 'فتح شاشة دخول السائق' : 'Open driver sign-in'}
      </button>
    </> : <>
      <p className="font-bold">{isAr ? `السائق: ${owner.nameAr}` : `Driver: ${owner.nameEn}`}</p>
      <p className="text-xs text-slate-500">{isAr
        ? 'شغّل GPS الهاتف، ثم ابدأ المشاركة. نحمّل المقاعد والدوام المنشورة أولاً. الموقع يُحدّث كل دقيقة تقريباً؛ تغييرات المقاعد والدوام أسرع. المحاكاة لا تُنشر.'
        : 'Start phone GPS, then share. Existing shared seats and duty load first. Location updates roughly once a minute; seat and duty changes are faster. Simulation is never published.'}</p>
      <button type="button" disabled={busy} onClick={() => shared.sharing ? shared.stopSharing() : void start()}
        className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50">
        {shared.sharing ? (isAr ? 'إيقاف المشاركة من هذا الهاتف' : 'Stop sharing from this phone')
          : (isAr ? 'بدء مشاركة تحديثات السائق' : 'Start sharing driver updates')}
      </button>
      <button type="button" disabled={busy} onClick={logoutDriver} className="min-h-11 underline text-xs font-bold">
        {isAr ? 'تغيير السائق / تسجيل الخروج' : 'Switch Driver / Sign out'}
      </button>
      {!shared.sessionPersisted && <p role="status" className="text-xs text-amber-700">{isAr ? 'المتصفح يمنع حفظ الدخول. قد تحتاج الرمز عند فتح التطبيق مجدداً.' : 'Your browser blocked saved sign-in. You may need your code when reopening the app.'}</p>}
    </>}
    {shared.sharing && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{isAr ? 'المشاركة مفعلة من هذا الهاتف' : 'Sharing enabled on this phone'}</p>}
    {shared.lastPublished && <p className="text-xs text-slate-500">{isAr ? 'آخر تحديث منشور: ' : 'Last published: '}{new Date(shared.lastPublished).toLocaleTimeString(isAr ? 'ar' : 'en')}</p>}
    {(error || shared.publishError) && <p role="alert" className="text-xs font-bold text-rose-600">{isAr
      ? 'تعذر النشر. تحقق من الدخول والإنترنت وGPS. إذا حدّث هاتف آخر السائق، أعد بدء المشاركة لتحميل أحدث البيانات.'
      : 'Could not publish. Check your sign-in, internet and GPS. If another phone updated this driver, start sharing again to load the latest state.'}</p>}
    <p className="text-xs text-slate-500">{isAr ? 'إيقاف المشاركة لا يغيّر الدوام. أحدث موقع منشور يتقادم تلقائياً.' : 'Stopping sharing does not change duty. The last published location expires through the normal freshness checks.'}</p>
  </section>;
}
