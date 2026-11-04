import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';

export function SharedConnectionPanel() {
  const { shared, language, authenticatedDriverId, drivers } = useTransit();
  const isAr = language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const owner = drivers.find(driver => driver.id === shared.ownerId);
  const run = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { if (!await action()) setError(true); } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3 text-sm">
    <h3 className="font-black">{isAr ? 'ربط هاتف السائق' : 'Connect driver phone'}</h3>
    <p className="text-xs text-slate-500">{isAr
      ? 'للنشر على هواتف الأهالي، يلزم حساب سائق معتمد. رمز PIN المحلي لا يمنح صلاحية النشر.'
      : 'Publishing to village phones requires an approved driver account. A local PIN does not grant publishing access.'}</p>
    {!shared.hasAccount ? <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); void run(async () => {
        const ok = await shared.signIn(email, password); setPassword(''); return ok;
      });
    }}>
      <label className="block text-xs font-bold">{isAr ? 'البريد الإلكتروني للسائق' : 'Driver email'}
        <input type="email" dir="ltr" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)}
          className="mt-1 w-full min-w-0 min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3" />
      </label>
      <label className="block text-xs font-bold">{isAr ? 'كلمة مرور الحساب' : 'Account password'}
        <input type="password" dir="ltr" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
          className="mt-1 w-full min-w-0 min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3" />
      </label>
      <button disabled={busy} className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50">
        {busy ? (isAr ? 'جارٍ الاتصال…' : 'Connecting…') : (isAr ? 'تسجيل الدخول للحساب المشترك' : 'Sign in to shared account')}
      </button>
      <p className="text-xs text-slate-500">{isAr ? 'يُنشئ المسؤول حسابات السائقين ويعتمد ربطها بالأسماء.' : 'The administrator creates driver accounts and approves their profile assignments.'}</p>
    </form> : <>
      <p>{owner ? (isAr ? `الحساب مرتبط بالسائق: ${owner.nameAr}` : `Account assigned to: ${owner.nameEn}`)
        : (isAr ? 'الحساب غير مرتبط بسائق بعد. راجع المسؤول.' : 'This account has no driver assignment yet. Contact the administrator.')}</p>
      {owner && authenticatedDriverId !== owner.id && <p className="text-xs font-bold">{isAr ? 'اختر ملف هذا السائق في شاشة السائق أولاً.' : 'Open this driver’s local profile in Driver Mode first.'}</p>}
      {owner && authenticatedDriverId === owner.id && <>
        <p className="text-xs text-slate-500">{isAr
          ? 'شغّل GPS الهاتف، ثم ابدأ المشاركة. نحمّل المقاعد والدوام المنشورة أولاً. تحديث الموقع كل دقيقة تقريباً؛ تغييرات المقاعد والدوام أسرع. المحاكاة لا تُنشر.'
          : 'Start phone GPS, then share. Existing shared seats and duty load first. Location updates roughly once a minute; seat and duty changes are faster. Simulation is never published.'}</p>
        <button type="button" disabled={busy} onClick={() => shared.sharing ? shared.stopSharing() : void run(shared.startSharing)}
          className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-50">
          {shared.sharing ? (isAr ? 'إيقاف المشاركة من هذا الهاتف' : 'Stop sharing from this phone')
            : (isAr ? 'بدء مشاركة تحديثات السائق' : 'Start sharing driver updates')}
        </button>
      </>}
      <button type="button" disabled={busy} onClick={() => void run(shared.signOut)} className="min-h-11 underline text-xs font-bold">
        {isAr ? 'تسجيل الخروج من الحساب المشترك' : 'Sign out of shared account'}
      </button>
    </>}
    {shared.sharing && <p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{isAr ? 'المشاركة مفعلة من هذا الهاتف' : 'Sharing enabled on this phone'}</p>}
    {shared.lastPublished && <p className="text-xs text-slate-500">{isAr ? 'آخر تحديث منشور: ' : 'Last published: '}{new Date(shared.lastPublished).toLocaleTimeString(isAr ? 'ar' : 'en')}</p>}
    {(error || shared.publishError) && <p role="alert" className="text-xs font-bold text-rose-600">{isAr
      ? 'تعذر الاتصال أو النشر. تحقق من الحساب والإنترنت وGPS. إذا حدّث هاتف آخر السائق، أعد بدء المشاركة لتحميل أحدث البيانات.'
      : 'Could not connect or publish. Check your account, internet and GPS. If another phone updated this driver, start sharing again to load the latest state.'}</p>}
    <p className="text-xs text-slate-500">{isAr ? 'إيقاف المشاركة لا يغيّر الدوام. أحدث موقع منشور يتقادم تلقائياً.' : 'Stopping sharing does not change duty. The last published location expires through the normal freshness checks.'}</p>
  </section>;
}
