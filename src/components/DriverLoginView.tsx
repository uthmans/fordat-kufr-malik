import React, { useRef, useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { PhoneDisplay } from './PhoneDisplay';
import { AdminPortal } from './AdminPortal';
import { KeyRound, AlertCircle, Shield } from 'lucide-react';

export const DriverLoginView: React.FC = () => {
  const { drivers, shared, language } = useTransit();
  const isAr = language === 'ar';

  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0]?.id || 'driver-1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];
  const driverDisplayName = isAr ? selectedDriver.nameAr : selectedDriver.nameEn;
  const pinLength = 8;

  const handlePinDigit = (digit: string) => {
    if (busyRef.current) return;
    if (pin.length < pinLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === pinLength) {
        busyRef.current = true; setBusy(true);
        void shared.signInCode(selectedDriverId, nextPin).then(result => {
          if (!result.ok) {
            setError(result.error === 'rate_limited'
              ? (isAr ? 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.' : 'Too many attempts. Wait 15 minutes and try again.')
              : result.error === 'unavailable'
              ? (isAr ? 'تعذر التحقق. تحقق من الإنترنت وحاول مجدداً.' : 'Could not verify. Check your connection and try again.')
              : (isAr ? 'رمز الدخول غير صحيح أو غير مفعل. راجع المسؤول.' : 'Incorrect or inactive access code. Ask the administrator.'));
          }
          setPin('');
        }).finally(() => { busyRef.current = false; setBusy(false); });
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  if (showAdminPortal) {
    return <AdminPortal onClose={() => setShowAdminPortal(false)} />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Welcome Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 text-center shadow-xs space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center font-bold">
          <KeyRound size={26} />
        </div>
        <h2 className="font-black text-lg text-slate-900 dark:text-slate-100">
          {isAr ? 'تسجيل دخول السائقين' : 'Driver Cab Authentication'}
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          {isAr
            ? 'اختر اسمك وأدخل رمزك الخاص المكوّن من 8 أرقام. لا تحتاج بريداً إلكترونياً.'
            : 'Select your name and enter your private 8-digit code. No email needed.'}
        </p>
        <p className="text-[11px] text-slate-400">{isAr ? 'سنتذكر دخولك على هذا الهاتف حتى تغيّر السائق أو تنتهي الجلسة.' : 'Stay signed in on this phone until you switch drivers or the session expires.'}</p>
      </div>

      {/* Driver Selection Grid - 8 Drivers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isAr ? '1. اختر اسم السائق:' : '1. Select Driver Profile:'}
          </label>
          <span className="text-[11px] font-bold text-slate-400">
            {drivers.length} {isAr ? 'سائقين مسجلين' : 'registered'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {drivers.map((d) => {
            const isSelected = d.id === selectedDriverId;
            const displayName = isAr ? d.nameAr : d.nameEn;
            return (
              <button
                key={d.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelectedDriverId(d.id);
                  setPin('');
                  setError(null);
                }}
                className={`p-3 rounded-2xl text-center transition-all tap-highlight border-2 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-md scale-102'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-black truncate">{displayName}</div>
                <div className="text-[10px] opacity-80 mt-1 flex items-center justify-center gap-1 font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${d.gpsMode === 'live' && d.isOnDuty ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                  <span>{d.gpsMode !== 'live' ? (isAr ? 'الحالة غير مؤكدة' : 'Status unconfirmed') : d.isOnDuty ? (isAr ? 'متاح' : 'On Duty') : (isAr ? 'عطلة' : 'Off')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PIN Dots Display & Keypad */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr
              ? `رمز الدخول لـ (${driverDisplayName}):`
              : `${pinLength}-digit access code for (${driverDisplayName}):`}
          </span>
          <div dir="ltr" className="flex justify-center gap-2 py-2" aria-label={isAr ? 'رمز الدخول مخفي' : 'Access code hidden'}>
            {Array.from({ length: pinLength }, (_, idx) => idx).map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pin.length > idx
                    ? 'bg-amber-500 border-amber-600 scale-110 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                }`}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-600 font-bold flex items-center justify-center gap-1">
              <AlertCircle size={13} />
              <span>{error}</span>
            </p>
          )}
          {busy && <p role="status" className="text-xs font-bold">{isAr ? 'جارٍ التحقق…' : 'Verifying…'}</p>}
        </div>

        {/* Tactile Numeric Keypad */}
        <div dir="ltr" className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={busy}
              onClick={() => handlePinDigit(digit)}
              className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 font-mono text-xl font-black text-slate-900 dark:text-slate-100 shadow-xs transition-all tap-highlight"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            disabled={busy}
            className="h-13 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 text-xs font-bold text-slate-600 dark:text-slate-300 tap-highlight"
          >
            {isAr ? 'مسح' : 'Clear'}
          </button>
          <button
            type="button"
            onClick={() => handlePinDigit('0')}
            disabled={busy}
            className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 font-mono text-xl font-black text-slate-900 dark:text-slate-100 shadow-xs tap-highlight"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={busy}
            className="h-13 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 text-xs font-bold text-slate-600 dark:text-slate-300 tap-highlight"
          >
            ⌫
          </button>
        </div>

        {/* Profile recovery remains available through the admin portal. */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
            <span>{isAr ? 'نسيت الرمز؟ راجع المسؤول.' : 'Forgot your code? Ask the administrator.'}</span>
            {/* Admin Portal Gateway */}
            <button
              type="button"
              onClick={() => setShowAdminPortal(true)}
              className="text-slate-600 dark:text-slate-300 hover:text-amber-600 font-bold flex items-center gap-1 transition-colors"
            >
              <Shield size={12} className="text-amber-500" />
              <span>{isAr ? 'بوابة الإدارة (9999)' : 'Admin Portal (9999)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
