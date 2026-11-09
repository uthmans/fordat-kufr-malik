import React, { useEffect, useRef, useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { normalizeDriverAccessCode } from '../utils/driverCodeSession';
import { supportsDeviceUnlock } from '../utils/deviceUnlock';

export function DriverSecurityPanel() {
  const { shared, language }=useTransit(); const isAr=language==='ar';
  const [current,setCurrent]=useState(''); const [next,setNext]=useState(''); const [repeat,setRepeat]=useState('');
  const [capable,setCapable]=useState(false); const [busy,setBusy]=useState(false); const busyRef=useRef(false);
  const [message,setMessage]=useState(''); const [error,setError]=useState(false); const [confirmRemoval,setConfirmRemoval]=useState(false);
  useEffect(()=>{let active=true; void supportsDeviceUnlock().then(value=>{if(active)setCapable(value);});return()=>{active=false;};},[]);
  const run=async (action:'pin'|'enroll'|'remove')=>{
    if(busyRef.current)return;
    if(action==='pin' && (!/^\d{6,8}$/.test(next) || next!==repeat)) {
      setError(true);setMessage(isAr?'أدخل رمزاً من 6 إلى 8 أرقام وأعد كتابته بنفس الشكل.':'Enter a 6–8 digit PIN and repeat it exactly.');return;
    }
    busyRef.current=true;setBusy(true);setMessage('');
    try {
      const result=action==='pin'?await shared.changePin(current,next):action==='enroll'?await shared.enrollDevice(current):await shared.removeDeviceUnlock();
      setError(!!result);
      if(result) setMessage(result==='invalid_code' ? (isAr?'تحقق من رمزك الحالي. إذا نسيته، ادخل ببصمة الهاتف أو راجع المسؤول.':'Check your current PIN. If forgotten, sign in with device unlock or ask the administrator.')
        : result==='rate_limited' ? (isAr?'محاولات كثيرة. انتظر 15 دقيقة.':'Too many attempts. Wait 15 minutes.')
        : result==='cancelled' ? (isAr?'تم الإلغاء أو تعذر فتح قفل الهاتف. يمكنك المحاولة مجدداً.':'Cancelled or device unlock unavailable. You can try again.')
        : (isAr?'تعذر إتمام العملية. تحقق من الإنترنت ودخولك وحاول مجدداً.':'Could not complete this. Check internet and sign-in, then retry.'));
      else {
        setCurrent('');setNext('');setRepeat('');setConfirmRemoval(false);
        setMessage(action==='pin' ? (isAr?'تم تغيير الرمز. دخولك محفوظ. أعد مشاركة موقعك إذا كنت تعمل.':'PIN changed. You remain signed in. Restart location sharing if working.')
          : action==='enroll' ? (isAr?'تم تفعيل فتح الملف بقفل الهاتف.':'Device unlock enabled for your profile.')
          : (isAr?'تم إلغاء مفاتيح الدخول. ما زال رمزك يعمل.':'Device unlock keys removed. Your PIN still works.'));
      }
    } finally {busyRef.current=false;setBusy(false);}
  };
  const input='w-full min-h-12 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm';
  return <section className="space-y-4">
    <p className="text-xs text-slate-500">{shared.sessionPersisted ? (isAr?'دخولك محفوظ على هذا الهاتف.':'Your sign-in is remembered on this phone.') : (isAr?'المتصفح يمنع حفظ الدخول بشكل دائم.':'Your browser is blocking persistent sign-in.')}</p>
    <label className="block text-sm font-bold">{isAr?'الرمز الحالي':'Current PIN'}
      <input type="password" dir="ltr" autoComplete="current-password" inputMode="numeric" maxLength={8} value={current} disabled={busy}
        onChange={e=>setCurrent(normalizeDriverAccessCode(e.target.value))} className={input}/>
    </label>
    <p className="text-xs text-slate-500">{isAr?'إذا دخلت بقفل الهاتف خلال آخر 5 دقائق، يمكنك ترك الرمز الحالي فارغاً.':'If you used device unlock within the last 5 minutes, you can leave the current PIN blank.'}</p>
    <form onSubmit={e=>{e.preventDefault();void run('pin');}} className="space-y-3">
      <label className="block text-sm font-bold">{isAr?'رمز جديد (6–8 أرقام)':'New PIN (6–8 digits)'}
        <input type="password" dir="ltr" autoComplete="new-password" inputMode="numeric" minLength={6} maxLength={8} required value={next} disabled={busy}
          onChange={e=>setNext(normalizeDriverAccessCode(e.target.value))} className={input}/>
      </label>
      <label className="block text-sm font-bold">{isAr?'أعد كتابة الرمز الجديد':'Repeat new PIN'}
        <input type="password" dir="ltr" autoComplete="new-password" inputMode="numeric" minLength={6} maxLength={8} required value={repeat} disabled={busy}
          onChange={e=>setRepeat(normalizeDriverAccessCode(e.target.value))} className={input}/>
      </label>
      <button type="submit" disabled={busy} className="w-full min-h-12 p-3 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50">{isAr?'تغيير الرمز':'Change PIN'}</button>
    </form>
    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
      <h4 className="font-bold">{isAr?'بصمة أو قفل الهاتف':'Fingerprint or phone unlock'}</h4>
      <p className="text-xs text-slate-500">{isAr?'الهاتف يختار البصمة أو الوجه أو رمز/نمط قفل الشاشة. التطبيق لا يطلع عليها.':'Your phone offers fingerprint, face, or its screen-lock PIN/pattern. The app cannot read them.'}</p>
      {capable ? <button type="button" disabled={busy} onClick={()=>void run('enroll')} className="w-full min-h-12 p-3 rounded-xl bg-slate-900 text-white dark:bg-slate-700 font-bold disabled:opacity-50">{isAr?'تفعيل قفل الهاتف للدخول':'Enable device unlock'}</button>
        : <p className="text-xs text-amber-800 dark:text-amber-200">{isAr?'الميزة تحتاج هاتفاً ومتصفحاً يدعمان مفاتيح المرور. افتح الموقع المباشر على هاتفك.':'Requires a compatible phone/browser. Open the live app on your phone to set it up.'}</p>}
      <button type="button" disabled={busy} onClick={()=>setConfirmRemoval(true)} className="min-h-11 text-xs underline">{isAr?'إلغاء مفاتيح الدخول لهذا السائق':'Remove this driver’s device unlock keys'}</button>
      {confirmRemoval && <div className="space-y-2 text-xs"><p>{isAr?'ستحتاج رمزك عند الدخول دون مفتاح. هل تريد إلغاء جميع مفاتيح هذا السائق؟':'Your PIN will still work. Remove all device unlock keys for this driver?'}</p>
        <button type="button" disabled={busy} onClick={()=>void run('remove')} className="min-h-11 px-3 text-rose-700 font-bold">{isAr?'نعم، إلغاء المفاتيح':'Yes, remove keys'}</button>
        <button type="button" disabled={busy} onClick={()=>setConfirmRemoval(false)} className="min-h-11 px-3">{isAr?'تراجع':'Cancel'}</button></div>}
    </div>
    {busy && <p role="status" className="text-xs">{isAr?'جارٍ التحقق…':'Verifying…'}</p>}
    {message && <p role={error?'alert':'status'} className={`text-xs font-bold ${error?'text-rose-700 dark:text-rose-300':'text-emerald-700 dark:text-emerald-300'}`}>{message}</p>}
  </section>;
}
