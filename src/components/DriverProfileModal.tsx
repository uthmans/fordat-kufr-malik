import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { Driver } from '../types';
import { PhoneDisplay } from './PhoneDisplay';
import { isValidDriverPin } from '../utils/driverPin';
import { User, KeyRound, Phone, Archive, X, Check, Clock, Calendar, Users } from 'lucide-react';

interface DriverProfileModalProps {
  driver: Driver;
  onClose: () => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({ driver, onClose }) => {
  const { updateDriverProfile, tripHistory, language, logoutDriver } = useTransit();
  const isAr = language === 'ar';

  const [nameAr, setNameAr] = useState(driver.nameAr);
  const [nameEn, setNameEn] = useState(driver.nameEn);
  const [phone, setPhone] = useState(driver.phone);
  const [pinCode, setPinCode] = useState(driver.pinCode);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

  // Filter archived trips for this driver
  const myTripHistory = tripHistory.filter((t) => t.driverId === driver.id);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !nameEn.trim() || !isValidDriverPin(pinCode)) return;

    updateDriverProfile(driver.id, {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
      phone: phone.trim(),
      pinCode
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-label={isAr ? 'ملف السائق وسجل الرحلات' : 'Driver Profile & Trips'} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                {isAr ? 'ملف السائق وسجل الرحلات' : 'Driver Profile & Trips'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? driver.nameAr : driver.nameEn}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors tap-highlight"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch: Profile Edit vs History */}
        <div className="flex p-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User size={14} />
            <span>{isAr ? 'تعديل البيانات' : 'Edit Profile'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Archive size={14} />
            <span>{isAr ? 'أرشيف الرحلات' : 'Trip Archive'}</span>
            {myTripHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
                {myTripHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">{isAr ? 'تم تذكر دخولك على هذا الجهاز' : 'Your login is remembered on this device'}</p>
                <button type="button" onClick={() => { onClose(); logoutDriver(); }}
                  className="min-h-10 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 underline underline-offset-4 hover:text-amber-600">
                  {isAr ? 'تغيير السائق' : 'Switch Driver'}
                </button>
              </div>

              {/* Arabic Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'الاسم بالعربية' : 'Arabic Name'}
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  required
                  dir="rtl"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* English Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'الاسم بالإنجليزية' : 'English Name'}
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* WhatsApp Phone */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رقم الواتساب (مفتاح دولي)' : 'WhatsApp Number (Intl)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone size={15} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    required
                    placeholder="+972599000000"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isAr ? 'يستخدم للتحويل الفوري إلى محادثة واتساب مع الركاب' : 'Used for 1-tap WhatsApp chats'}
                </p>
              </div>

              {/* 4-Digit PIN */}
              <div>
                <label htmlFor="driver-profile-pin" className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رمز الدخول السري (4 إلى 6 أرقام)' : 'Login PIN (4–6 digits)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={15} />
                  </div>
                  <input
                    id="driver-profile-pin"
                    type="password"
                    maxLength={6}
                    minLength={4}
                    pattern="[0-9]{4,6}"
                    inputMode="numeric"
                    required
                    autoComplete="new-password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    dir="ltr"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isAr ? 'استخدم من 4 إلى 6 أرقام. ستحتاج الرمز عند تغيير السائق أو تسجيل الدخول مجدداً.' : 'Use 4–6 digits. This PIN is required after switching drivers or signing in again.'}
                </p>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={savedSuccess}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all tap-highlight"
              >
                {savedSuccess ? (
                  <>
                    <Check size={16} />
                    <span>{isAr ? 'تم حفظ التعديلات بنجاح' : 'Changes Saved!'}</span>
                  </>
                ) : (
                  <span>{isAr ? 'حفظ البيانات' : 'Save Changes'}</span>
                )}
              </button>
            </form>
          ) : (
            /* Trip History Archive */
            <div className="space-y-3">
              {myTripHistory.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <Archive size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500 font-bold">
                    {isAr ? 'لا توجد رحلات مؤرشفة بعد' : 'No archived trips yet'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isAr
                      ? 'عند الضغط على "أرشفة وبدء رحلة جديدة" في السجل، ستُحفظ الرحلات هنا.'
                      : 'Trips will be archived here when you tap "Archive & New Trip".'}
                  </p>
                </div>
              ) : (
                myTripHistory.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                        <Calendar size={13} className="text-amber-500" />
                        <span>{trip.formattedDate}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black font-mono text-[11px]">
                        {trip.passengersCount} {isAr ? 'ركاب' : 'passengers'}
                      </span>
                    </div>

                    {trip.entries && trip.entries.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                        {trip.entries.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{entry.passengerName}</span>
                            <span className="font-mono">{entry.seatCount} {isAr ? 'مقاعد' : 'seats'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
