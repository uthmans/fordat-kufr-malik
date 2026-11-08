import React from 'react';
import { useTransit } from '../context/TransitContext';
import { publicationState } from '../utils/sharedAvailability';
import { PublicationStatus } from './PublicationStatus';
import { SharingConflictPanel } from './SharingConflictPanel';

export function SharedConnectionPanel() {
  const { shared, language, setActiveTab, logoutDriver, drivers, startDriverSharing, stopDriverSharing,
    sharingPhase, sharingError, gpsError, isOnline, dataNow: refreshTime } = useTransit();
  const dataNow = Math.max(refreshTime, Date.now());
  const isAr = language === 'ar';
  const busy = sharingPhase !== 'idle';
  const owner = drivers.find(driver => driver.id === shared.ownerId);
  return <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3 text-sm">
    <h3 className="font-black">{isAr ? 'مشاركة موقعي' : 'Share my location'}</h3>
    {!owner ? <>
      <p className="text-xs text-slate-500">{isAr ? 'اختر اسمك في شاشة السائق وأدخل رمز الدخول الخاص بك. لا تحتاج بريداً إلكترونياً أو رسالة SMS.' : 'Select your name in Driver Mode and enter your private access code. No email or SMS needed.'}</p>
      <button type="button" onClick={() => setActiveTab('driver')} className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold">
        {isAr ? 'فتح شاشة دخول السائق' : 'Open driver sign-in'}
      </button>
    </> : <>
      <p className="font-bold">{isAr ? `السائق: ${owner.nameAr}` : `Driver: ${owner.nameEn}`}</p>
      <p className="text-xs text-slate-500">{isAr
        ? 'اضغط الزر واسمح باستخدام الموقع إذا طلب الهاتف. أبقِ التطبيق مفتوحاً أثناء العمل.'
        : 'Tap the button and allow location access if your phone asks. Keep the app open while working.'}</p>
      <button type="button" onClick={() => busy || shared.sharing || shared.sharingConflict ? stopDriverSharing() : void startDriverSharing()}
        className="w-full min-h-14 p-3 rounded-xl bg-amber-500 text-slate-950 font-bold whitespace-normal break-words leading-snug">
        {busy || shared.sharingConflict ? (isAr ? 'إلغاء' : 'Cancel') : shared.sharing ? (isAr ? 'إيقاف مشاركة موقعي' : 'Stop sharing my location')
          : (isAr ? 'مشاركة موقعي الآن' : 'Share my location now')}
      </button>
      {busy && <p role="status" className="text-xs font-bold">{sharingPhase === 'gps'
        ? (isAr ? 'جارٍ تحديد موقعك… اسمح باستخدام الموقع إذا طُلب منك.' : 'Finding your location… Allow location access if asked.')
        : (isAr ? 'جارٍ الاتصال لمشاركة موقعك…' : 'Connecting to share your location…')}</p>}
      {!busy && shared.sharingConflict && <SharingConflictPanel conflict={shared.sharingConflict} isAr={isAr}
        onResolve={resolution => void startDriverSharing(resolution)} />}
      <button type="button" onClick={logoutDriver} className="min-h-11 underline text-xs font-bold">
        {isAr ? 'تغيير السائق / تسجيل الخروج' : 'Switch Driver / Sign out'}
      </button>
      {!shared.sessionPersisted && <p role="status" className="text-xs text-amber-700">{isAr ? 'المتصفح يمنع حفظ الدخول. قد تحتاج الرمز عند فتح التطبيق مجدداً.' : 'Your browser blocked saved sign-in. You may need your code when reopening the app.'}</p>}
    </>}
    {owner && !busy && !shared.sharingConflict && <PublicationStatus isAr={isAr} state={publicationState({ driver: owner,
      row: shared.rows.find(row => row.driver_id === owner.id), sharing: shared.sharing,
      online: isOnline, gpsError: !!gpsError, lastPublished: shared.lastPublished, now: dataNow })} />}
    {owner && shared.lastPublished && shared.rows.some(row => row.driver_id === owner.id && row.received_at === shared.lastPublished) && <p className="text-xs text-slate-500">{isAr ? 'آخر تحديث مؤكد: ' : 'Last confirmed update: '}{new Date(shared.lastPublished).toLocaleString(isAr ? 'ar' : 'en')}</p>}
    {owner && gpsError && <p role="alert" className="text-xs font-bold text-rose-600">{gpsError}</p>}
    {owner && !gpsError && (sharingError || shared.publishError) && <p role="alert" className="text-xs font-bold text-rose-600">{isAr
      ? 'تعذرت المشاركة. تحقق من الإنترنت ثم اضغط «مشاركة موقعي الآن» للمحاولة مجدداً. إذا استمرت المشكلة، سجّل خروجك وادخل برمزك مرة أخرى.'
      : 'Could not share. Check your internet and tap “Share my location now” to retry. If it keeps failing, sign out and enter your code again.'}</p>}
    <p className="text-xs text-slate-500">{isAr ? 'إيقاف المشاركة لا يغيّر الدوام. أحدث موقع منشور يتقادم تلقائياً.' : 'Stopping sharing does not change duty. The last published location expires through the normal freshness checks.'}</p>
  </section>;
}
