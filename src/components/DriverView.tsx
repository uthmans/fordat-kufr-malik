import React, { useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { STATUS_CONFIGS, PRAYER_SHIFT_CONFIGS, DEPARTURE_COUNTDOWN_CONFIGS } from '../data/initialDrivers';
import { PrayerShiftPreset, DepartureCountdown } from '../types';
import { SeatVisualizer } from './SeatVisualizer';
import { SeatRequestsList } from './SeatRequestsList';
import { TripLogList } from './TripLogList';
import { DriverLoginView } from './DriverLoginView';
import { DriverProfileModal } from './DriverProfileModal';
import { hasRecentSeatCount, hasRecentGPS } from '../utils/dataFreshness';
import { getDepartureAnnouncement } from '../utils/departureAnnouncement';
import { DepartureAnnouncement } from './DepartureAnnouncement';
import { PassengerPresets } from './PassengerPresets';
import {
  Plus,
  Minus,
  Navigation,
  Users,
  AlertTriangle,
  Moon,
  Sun,
  Sunset,
  Flag,
  LogOut,
  CheckCircle2,
  XCircle,
  UserCheck,
  Clock,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const DriverView: React.FC = () => {
  const {
    currentDriver,
    authenticatedDriverId,
    logoutDriver,
    toggleDriverDuty,
    setDriverPrayerShift,
    setDepartureCountdown,
    resumeDutyFromInactivity,
    incrementPassengers,
    decrementPassengers,
    updateDriverPassengers,
    confirmDriverPassengers,
    fillDriverPassengers,
    isTrackingRealGPS,
    isSimulatingGPS,
    language,
    dataNow
  } = useTransit();

  const isAr = language === 'ar';
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Explicit login activates duty in the provider. Restoring a remembered session
  // must preserve manual pauses and the 45-minute inactivity timeout.

  // If driver is not authenticated yet, show clean PIN login view
  if (!authenticatedDriverId || !currentDriver) {
    return <DriverLoginView />;
  }

  const driver = currentDriver;
  const vacantSeats = driver.maxCapacity - driver.passengers;
  const isFull = driver.passengers >= driver.maxCapacity;
  const statusConfig = STATUS_CONFIGS[driver.status] || STATUS_CONFIGS.to_ramallah;
  const driverDisplayName = isAr ? driver.nameAr : driver.nameEn;
  const activeDeparture = getDepartureAnnouncement(driver, dataNow);

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Inactivity Auto-Pause Alert Banner */}
      {driver.autoPausedForInactivity && (
        <div className="p-4 rounded-3xl bg-amber-500 text-slate-950 shadow-md border-2 border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle size={22} />
            </div>
            <div>
              <h4 className="font-black text-sm leading-tight">
                {isAr
                  ? 'تم إيقاف التفعيل تلقائياً لعدم الحركة في كفر مالك'
                  : 'Automatically paused due to inactivity in Kufr Malik'}
              </h4>
              <p className="text-xs font-semibold opacity-90 mt-0.5">
                {isAr
                  ? 'تجاوزت فترة التوقف 45 دقيقة دون تغيير. اضغط للتفعيل مرة أخرى'
                  : 'Stationary for > 45 mins without movement. Tap to resume.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => resumeDutyFromInactivity(driver.id)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-950 text-white font-black text-xs hover:bg-slate-900 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <RefreshCw size={14} className="text-amber-400" />
            <span>{isAr ? 'تفعيل الآن ومتابعة الخط' : 'Resume Active Duty'}</span>
          </button>
        </div>
      )}

      {/* 2. Driver Top Session Bar & Profile / Logout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-xs">
            {driverDisplayName.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
              {driverDisplayName}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
              <span className={`w-2 h-2 rounded-full ${driver.isOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{driver.isOnDuty ? (isAr ? 'متاح على هذا الجهاز' : 'On duty on this device') : (isAr ? 'غير متاح حالياً' : 'Off duty')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Driver Profile & Archive modal trigger */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors tap-highlight"
            title={isAr ? 'ملفي وسجل الرحلات' : 'My Profile & Trips'}
          >
            <UserCheck size={14} className="text-amber-500" />
            <span className="hidden sm:inline">{isAr ? 'ملفي' : 'Profile'}</span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={logoutDriver}
            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors tap-highlight"
            title={isAr ? 'تسجيل الخروج من الكابينة' : 'Log out from cab'}
          >
            <LogOut size={13} />
            <span>{isAr ? 'خروج' : 'Exit'}</span>
          </button>
        </div>
      </div>

      {/* 3. QUICK ON/OFF DUTY TOGGLE */}
      <button
        type="button"
        onClick={() => toggleDriverDuty(driver.id)}
        className={`w-full p-3.5 rounded-2xl border-2 text-left rtl:text-right transition-all tap-highlight flex items-center justify-between gap-3 ${
          driver.isOnDuty
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs'
            : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        <div className="flex items-center gap-3">
          {driver.isOnDuty ? (
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={20} />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <XCircle size={20} />
            </div>
          )}
          <div>
            <div className="font-black text-sm leading-tight">
              {driver.isOnDuty
                ? isAr ? 'على رأس عمله الآن (متاح للركاب)' : 'Active Today (On Duty)'
                : isAr ? 'غير متاح اليوم (عطلة أو في استراحة)' : 'Off Duty Today'}
            </div>
            <span className="text-[11px] opacity-80 block mt-0.5">
              {driver.isOnDuty
                ? isAr ? 'ظاهر لأهالي البلد في اللوحة ومستعد للتحميل' : 'Visible to villagers on live dashboard'
                : isAr ? 'مخفي من لوحة الركاب حتى تفعل الدوام' : 'Hidden from public line'}
            </span>
          </div>
        </div>

        <span className="px-3 py-1.5 rounded-xl font-black text-xs shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          {driver.isOnDuty ? (isAr ? 'إيقاف ⏸' : 'Pause') : (isAr ? 'تفعيل ▶' : 'Activate')}
        </span>
      </button>

      {/* 4. CULTURAL PRAYER-BASED SHIFT SCHEDULE PRESETS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              {isAr ? 'مواعيد العمل والمناوبة (توقيت القرية):' : 'Shift Timing (Village Presets):'}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {isAr ? 'اختر بنقرة واحدة لإعلام الركاب' : '1-tap to broadcast'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['regular_day', 'after_maghrib', 'after_isha', 'final_trip'] as PrayerShiftPreset[]).map((preset) => {
            const config = PRAYER_SHIFT_CONFIGS[preset];
            const isSelected = (driver.prayerShift || 'regular_day') === preset;

            return (
              <button
                key={preset}
                type="button"
                onClick={() => setDriverPrayerShift(driver.id, preset)}
                className={`p-3 rounded-2xl border-2 text-left rtl:text-right transition-all tap-highlight flex flex-col justify-between min-h-[76px] ${
                  isSelected
                    ? `${config.badgeBg} ${config.badgeBorder} shadow-xs ring-2 ring-amber-400/50`
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">
                    {preset === 'regular_day' && '☀️'}
                    {preset === 'after_maghrib' && '🌅'}
                    {preset === 'after_isha' && '🌙'}
                    {preset === 'final_trip' && '🏁'}
                  </span>
                  {isSelected && <CheckCircle2 size={15} className="text-emerald-600" />}
                </div>
                <div>
                  <div className={`font-black text-xs leading-tight ${isSelected ? config.badgeText : ''}`}>
                    {config[isAr ? 'labelAr' : 'labelEn']}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {config[isAr ? 'subAr' : 'subEn']}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. QUICK DEPARTURE ANNOUNCEMENT (LAST TRIP LEAVING SOON) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/80 dark:border-amber-700/60 rounded-3xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              {isAr ? 'تنبيه المغادرة السريع (طالع قريباً):' : 'Quick Departure Announcement:'}
            </h3>
          </div>
          {activeDeparture && (
            <button
              type="button"
              onClick={() => setDepartureCountdown(driver.id, null)}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline tap-highlight"
            >
              {isAr ? 'إلغاء التنبيه ✕' : 'Clear Alert ✕'}
            </button>
          )}
        </div>

        <DepartureAnnouncement driver={driver} now={dataNow} isAr={isAr} />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {!driver.isOnDuty
            ? (isAr ? 'فعّل الدوام لإرسال تنبيه مغادرة.' : 'Go on duty to post a departure announcement.')
            : (isAr ? 'ينتهي التنبيه تلقائياً. «طالع الآن» يظهر لدقيقتين.' : 'Announcements expire automatically. “Leaving now” stays visible for two minutes.')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['in_10_mins', 'in_5_mins', 'leaving_now'] as const).map((opt) => {
            const conf = DEPARTURE_COUNTDOWN_CONFIGS[opt];
            const isSelected = activeDeparture?.key === opt;

            return (
              <button
                key={opt}
                type="button"
                disabled={!driver.isOnDuty}
                onClick={() => setDepartureCountdown(driver.id, isSelected ? null : opt)}
                className={`py-2.5 px-2 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1 transition-all tap-highlight border-2 disabled:opacity-50 ${
                  isSelected
                    ? `${conf.pillBg} border-white/40 scale-102`
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isSelected ? conf.dotColor : 'bg-slate-400'}`} />
                  <span className="truncate">{conf[isAr ? 'labelAr' : 'labelEn']}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>


      {/* 3. DYNAMIC LIVE PROXIMITY STATUS (HANDS-FREE GPS) */}
      <div
        className={`p-4 rounded-3xl border-2 transition-all ${
          driver.isDetour
            ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-950 dark:text-orange-200'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        } shadow-xs space-y-2`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isTrackingRealGPS || isSimulatingGPS
                  ? 'bg-emerald-500 animate-ping'
                  : 'bg-amber-500'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? 'آخر موقع على هذا الجهاز' : 'Last location on this device'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {driver.isDetour ? (
              <span className="px-2.5 py-0.5 rounded-lg bg-orange-600 text-white text-[11px] font-black flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>{isAr ? 'مسار بديل' : 'Detour Active'}</span>
              </span>
            ) : (
              <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${statusConfig.color.badgeBg}`}>
                {statusConfig[isAr ? 'labelAr' : 'labelEn']}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Human-Readable Proximity String */}
        <div className="flex items-start gap-2.5 pt-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Navigation size={20} className="rotate-45" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
              {isAr ? driver.proximityStatusAr : driver.proximityStatusEn}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                {driver.gpsMode !== 'live' ? (isAr ? 'موقع تجريبي' : 'Demo location')
                  : !hasRecentGPS(driver, dataNow) ? (isAr ? 'موقع محفوظ — تحديث قديم' : 'Saved location — stale update')
                  : isTrackingRealGPS ? (isAr ? 'GPS هذا الهاتف نشط' : 'This phone GPS is active')
                  : (isAr ? 'موقع محفوظ — التتبع متوقف' : 'Saved location — tracking stopped')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RESPONSIVE PASSENGER CAPACITY COUNTER */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {!hasRecentSeatCount(driver, dataNow) && <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <p>{isAr ? 'أكد عدد الركاب الموجودين في سيارتك. العدد المحفوظ غير مؤكد حديثاً.' : 'Confirm the passengers in your vehicle. The saved count has not been confirmed recently.'}</p>
          <button type="button" onClick={() => confirmDriverPassengers(driver.id)} className="min-h-10 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold">
            {isAr ? 'تأكيد العدد الحالي' : 'Confirm current count'}
          </button>
        </div>}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {isAr ? 'سعة الركاب الحالية' : 'Passenger Capacity'}
            </h3>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${
              isFull
                ? 'bg-rose-600 text-white animate-pulse'
                : vacantSeats > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-white'
            }`}
          >
            {isFull
              ? isAr ? `مكتمل (${driver.passengers}/${driver.maxCapacity})` : `FULL (${driver.passengers}/${driver.maxCapacity})`
              : isAr
              ? (vacantSeats === 1 ? 'متبقي مقعد واحد' : vacantSeats === 2 ? 'متبقي مقعدان' : `متبقي ${vacantSeats} مقاعد`)
              : (vacantSeats === 1 ? '1 SEAT VACANT' : `${vacantSeats} SEATS VACANT`)}
          </div>
        </div>

        {/* Stepper Buttons */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => decrementPassengers(driver.id)}
            disabled={driver.passengers <= 0}
            className={`flex-1 h-16 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm transition-all tap-highlight ${
              driver.passengers <= 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white active:scale-95'
            }`}
            aria-label="Decrease passenger count"
          >
            <Minus size={32} strokeWidth={3.5} />
          </button>

          <div className="flex-1 text-center py-2 px-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
              {driver.passengers}
              <span className="text-xl sm:text-2xl text-slate-400 font-sans font-normal"> / {driver.maxCapacity}</span>
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr
                ? (driver.passengers === 1 ? 'راكب واحد' : driver.passengers === 2 ? 'راكبان' : 'ركاب')
                : (driver.passengers === 1 ? 'passenger' : 'passengers')}
            </div>
          </div>

          <button
            type="button"
            onClick={() => incrementPassengers(driver.id)}
            disabled={driver.passengers >= driver.maxCapacity}
            className={`flex-1 h-16 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm transition-all tap-highlight ${
              driver.passengers >= driver.maxCapacity
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
            }`}
            aria-label="Increase passenger count"
          >
            <Plus size={32} strokeWidth={3.5} />
          </button>
        </div>

        {/* 1-Tap Quick Seat Presets */}
        <PassengerPresets passengers={driver.passengers} capacity={driver.maxCapacity} isAr={isAr}
          onSet={count => updateDriverPassengers(driver.id, count)} onFull={() => fillDriverPassengers(driver.id)} />

        {/* Visual Seating Graphic */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <SeatVisualizer
            passengers={driver.passengers}
            maxCapacity={driver.maxCapacity}
            interactive={true}
            onSeatClick={(index) => updateDriverPassengers(driver.id, index + 1)}
            size="md"
          />
        </div>
      </div>

      {/* 5. PENDING BOOKING REQUESTS */}
      <SeatRequestsList driverId={driver.id} />

      {/* 6. CURRENT TRIP LOG WITH CONDITIONAL RAMALLAH/KUFR MALIK MODE & ARCHIVING */}
      <TripLogList driverId={driver.id} />

      {/* 7. DRIVER PROFILE MODAL */}
      {showProfileModal && (
        <DriverProfileModal
          driver={driver}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
};
