import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { Driver } from '../types';
import { PhoneDisplay } from './PhoneDisplay';
import { changedProfileFields } from '../utils/driverProfile';
import { ArchiveDeleteConfirmation } from './ArchiveDeleteConfirmation';
import {
  ShieldCheck,
  Lock,
  LogOut,
  Users,
  Power,
  Moon,
  Edit2,
  Trash2,
  Archive,
  RefreshCw,
  KeyRound,
  Check,
  X,
  Phone
} from 'lucide-react';

interface AdminPortalProps {
  onClose?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onClose }) => {
  const {
    drivers,
    adminLogin,
    adminLogout,
    isAdminAuthenticated,
    adminUpdateDriver,
    toggleDriverDuty,
    toggleDriverLateShift,
    tripHistory,
    deleteArchivedTrip,
    clearAllTripHistory,
    resetAll,
    language
  } = useTransit();

  const isAr = language === 'ar';
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'drivers' | 'archives'>('drivers');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [archiveDeletion, setArchiveDeletion] = useState<{ ids: string[]; all: boolean } | null>(null);

  // Form edit states
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCapacity, setEditCapacity] = useState(7);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    const success = await adminLogin(pinInput);
    setSigningIn(false);
    if (!success) {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    } else {
      setPinInput('');
    }
  };

  const startEditDriver = (d: Driver) => {
    setSaveError(false);
    setEditingDriver(d);
    setEditNameAr(d.nameAr);
    setEditNameEn(d.nameEn);
    setEditPhone(d.phone);
    setEditCapacity(d.maxCapacity || 7);
  };

  const handleSaveDriverEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    const saved = adminUpdateDriver(editingDriver.id, changedProfileFields(editingDriver, {
      nameAr: editNameAr.trim(),
      nameEn: editNameEn.trim(),
      phone: editPhone.trim(),
      maxCapacity: Number(editCapacity)
    }));
    setSaveError(!saved);
    if (!saved) return;

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setEditingDriver(null);
    }, 1000);
  };

  // If not authenticated, show PIN gate
  if (!isAdminAuthenticated) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm max-w-md mx-auto space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 mx-auto flex items-center justify-center shadow-sm">
            <ShieldCheck size={26} />
          </div>
          <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
            {isAr ? 'بوابة إدارة خط كفر مالك' : 'Kufr Malik Transit Admin Portal'}
          </h2>
          <p className="text-xs text-slate-500">
            {isAr
              ? 'أدخل رمز الإدارة الخاص بك المكوّن من 12 رقماً. رموز السائقين لا تفتح هذه الصفحة.'
              : 'Enter your private 12-digit administrator code. Driver codes cannot open this page.'}
          </p>
        </div>

        <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="password"
              maxLength={12}
              minLength={12}
              inputMode="numeric"
              autoComplete="off"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••••••••••"
              dir="ltr"
              className={`w-full text-center text-2xl font-mono tracking-widest py-3 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 ${
                pinError
                  ? 'border-rose-500 text-rose-600 animate-shake'
                  : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-amber-500'
              } focus:outline-none`}
            />
          </div>

          {pinError && (
            <p className="text-center text-xs font-bold text-rose-600">
              {isAr ? 'تعذر التحقق. راجع الرمز والاتصال، أو انتظر إذا تكررت المحاولات.' : 'Could not verify. Check the code and connection, or wait if too many attempts were made.'}
            </p>
          )}

          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              disabled={signingIn}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 text-amber-400 hover:bg-slate-800 active:scale-98 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm tap-highlight"
            >
              <Lock size={14} />
              <span>{signingIn ? (isAr ? 'جارٍ التحقق…' : 'Verifying…') : (isAr ? 'دخول الإدارة' : 'Login Admin')}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-5">
      {/* Admin Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{isAr ? 'لوحة إدارة السائقين' : 'Driver Management Admin'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold">
                {drivers.length} {isAr ? 'سائقين' : 'drivers'}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {isAr ? 'إدارة بيانات السائقين وأرشيف الرحلات' : 'Manage driver profiles and trip archives'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          )}

          <button
            type="button"
            onClick={adminLogout}
            className="py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut size={13} />
            <span>{isAr ? 'خروج' : 'Logout'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'drivers'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={14} />
          <span>{isAr ? 'السائقين (8)' : 'Drivers (8)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archives')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'archives'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Archive size={14} />
          <span>{isAr ? 'أرشيف الرحلات العام' : 'Trip Archives'}</span>
          {tripHistory.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
              {tripHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Content Tab 1: DRIVERS LIST */}
      {activeTab === 'drivers' && (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                      {isAr ? d.nameAr : d.nameEn}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      ({isAr ? d.nameEn : d.nameAr})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <PhoneDisplay phone={d.phone} className="font-mono text-[11px]" />
                  </div>
                </div>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => startEditDriver(d)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 hover:text-amber-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs"
                  title={isAr ? 'تعديل بيانات السائق' : 'Edit Driver Profile'}
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {/* Quick Status Toggles for Admin */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => toggleDriverDuty(d.id)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    d.isOnDuty
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  <Power size={13} />
                  <span>{d.isOnDuty ? (isAr ? 'على رأس عمله' : 'On Duty') : (isAr ? 'معطل / غير متاح' : 'Off Duty')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleDriverLateShift(d.id)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    d.isLateShift
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  <Moon size={13} />
                  <span>{d.isLateShift ? (isAr ? 'مناوبة مسائية' : 'Late Shift') : (isAr ? 'دوام نهاري' : 'Day Shift')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Tab 2: TRIP ARCHIVES */}
      {activeTab === 'archives' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {isAr ? 'جميع الرحلات المحفوظة من جميع السائقين:' : 'All archived trips from all drivers:'}
            </span>
            {tripHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setArchiveDeletion({ ids: tripHistory.map(trip => trip.id), all: true })}
                className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>{isAr ? 'مسح كل الأرشيف' : 'Clear All Archive'}</span>
              </button>
            )}
          </div>

          {tripHistory.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <Archive size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-bold">
                {isAr ? 'لا توجد رحلات مؤرشفة في النظام' : 'No archived trips recorded yet'}
              </p>
            </div>
          ) : (
            tripHistory.map((trip) => {
              const driverObj = drivers.find((d) => d.id === trip.driverId);
              return (
                <div
                  key={trip.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-slate-900 dark:text-slate-100">
                        {driverObj ? (isAr ? driverObj.nameAr : driverObj.nameEn) : trip.driverId}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-500">{trip.formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black font-mono text-[11px]">
                        {trip.passengersCount} {isAr ? 'ركاب' : 'passengers'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setArchiveDeletion({ ids: [trip.id], all: false })}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title={isAr ? 'حذف هذه الرحلة' : 'Delete Trip'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {trip.entries && trip.entries.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                      {trip.entries.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{entry.passengerName}</span>
                          <span className="font-mono">{entry.seatCount} {isAr ? 'مقاعد' : 'seats'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {archiveDeletion && <ArchiveDeleteConfirmation count={archiveDeletion.ids.length} isAr={isAr}
        onCancel={() => setArchiveDeletion(null)}
        onConfirm={() => {
          if (archiveDeletion.all) clearAllTripHistory(archiveDeletion.ids);
          else deleteArchivedTrip(archiveDeletion.ids[0]);
          setArchiveDeletion(null);
        }} />}

      {/* Edit Driver Sub-Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isAr ? 'تعديل بيانات السائق' : 'Edit Driver Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDriver(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDriverEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'الاسم بالعربية' : 'Arabic Name'}
                </label>
                <input
                  type="text"
                  value={editNameAr}
                  onChange={(e) => setEditNameAr(e.target.value)}
                  dir="rtl"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'الاسم بالإنجليزية' : 'English Name'}
                </label>
                <input
                  type="text"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  dir="ltr"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'رقم الواتساب' : 'WhatsApp Phone'}
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <p className="text-xs text-slate-500">{isAr ? 'رموز الدخول تُسلّم بشكل خاص ولا تُعرض هنا.' : 'Access codes are handed over privately and are not displayed here.'}</p>

              {saveError && <p role="alert" className="text-xs font-bold text-rose-600">{isAr ? 'تعذر الحفظ. تحقق من البيانات وسعة السيارة الحالية.' : 'Could not save. Check the profile values and current vehicle capacity.'}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  {saveSuccess ? <Check size={14} /> : null}
                  <span>{isAr ? 'حفظ' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
