import React, { useRef, useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { Driver, TripDirection } from '../types';
import { PRAYER_SHIFT_CONFIGS, DEPARTURE_COUNTDOWN_CONFIGS } from '../data/initialDrivers';
import { SeatVisualizer } from './SeatVisualizer';
import { RouteVisualizer } from './RouteVisualizer';
import { PWAInstallBanner } from './PWAInstallBanner';
import { buildVillagerReservationUrl } from '../utils/whatsapp';
import { normalizeVillagerName } from '../utils/identityStorage';
import {
  MessageSquare,
  MapPin,
  Users,
  AlertTriangle,
  Moon,
  Sun,
  Sunset,
  Flag,
  Clock,
  CheckCircle2,
  X,
  Coffee,
  Zap,
  WifiOff
} from 'lucide-react';

export const VillagerView: React.FC = () => {
  const { drivers, language, setSelectedDriverId, requestSeat, villagerName } = useTransit();
  const [filterDirection, setFilterDirection] = useState<TripDirection>('all');
  const [requestingForDriver, setRequestingForDriver] = useState<Driver | null>(null);

  // Simplified form state: Only Name + Seats!
  const [passengerName, setPassengerName] = useState(villagerName);
  const [isEditingName, setIsEditingName] = useState(!villagerName);
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [requestSent, setRequestSent] = useState(false);

  const isAr = language === 'ar';

  // Only ON DUTY drivers appear in the active villager list!
  const onDutyDrivers = drivers.filter((driver) => driver.isOnDuty);
  const offDutyDrivers = drivers.filter((driver) => !driver.isOnDuty);

  const filteredDrivers = onDutyDrivers.filter((driver) => {
    if (filterDirection === 'all') return true;
    if (filterDirection === 'detour') return driver.isDetour;
    if (filterDirection === 'to_ramallah') {
      return driver.status === 'in_kufr_malik' || driver.status === 'to_ramallah';
    }
    if (filterDirection === 'to_kufr_malik') {
      return driver.status === 'in_ramallah' || driver.status === 'to_kufr_malik';
    }
    return true;
  });

  const totalOpenSeats = onDutyDrivers.reduce(
    (acc, d) => acc + Math.max(0, d.maxCapacity - d.passengers),
    0
  );

  const handleOpenWhatsAppModal = (driver: Driver) => {
    setRequestingForDriver(driver);
    setRequestSent(false);
    setPassengerName(villagerName);
    setIsEditingName(!villagerName);
    setNameError(false);
    setPassengerCount(1);
  };

  const handleLaunchWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingForDriver || requestSent) return;

    const pName = normalizeVillagerName(passengerName);
    if (!pName) {
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }

    // Broadcast in-app request to driver
    requestSeat(
      requestingForDriver.id,
      pName,
      passengerCount
    );

    // Pre-filled WhatsApp message
    const url = buildVillagerReservationUrl(
      requestingForDriver.phone,
      pName,
      passengerCount,
      isAr
    );

    setRequestSent(true);
    setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
      setRequestingForDriver(null);
      setRequestSent(false);
    }, 600);
  };

  return (
    <div className="space-y-4">
      {/* PWA Home Screen Install Banner */}
      <PWAInstallBanner />

      {/* Corridor Map with live GPS positions of on-duty drivers */}
      <RouteVisualizer
        drivers={onDutyDrivers}
        language={language}
        onSelectDriver={(id) => {
          setSelectedDriverId(id);
          const el = document.getElementById(`driver-card-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-emerald-500');
            setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 2000);
          }
        }}
      />

      {/* Direction Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1 p-1 max-w-full bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            onClick={() => setFilterDirection('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterDirection === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isAr ? 'الكل' : 'All'} ({onDutyDrivers.length})
          </button>

          <button
            onClick={() => setFilterDirection('to_ramallah')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterDirection === 'to_ramallah'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isAr ? 'إلى الموقف' : 'To Ramallah'}
          </button>

          <button
            onClick={() => setFilterDirection('to_kufr_malik')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterDirection === 'to_kufr_malik'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isAr ? 'إلى كفر مالك' : 'To Kufr Malik'}
          </button>
        </div>

        {/* Total open seats with pluralization */}
        <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {totalOpenSeats > 0 ? (
            isAr ? (
              totalOpenSeats === 1
                ? 'مقعد شاغر واحد متاح'
                : totalOpenSeats === 2
                ? 'مقعدان شاغران متاحان'
                : `${totalOpenSeats} مقاعد شاغرة متاحة`
            ) : (
              totalOpenSeats === 1 ? '1 open seat' : `${totalOpenSeats} open seats`
            )
          ) : (
            isAr ? 'لا توجد مقاعد شاغرة حالياً' : 'No open seats'
          )}
        </div>
      </div>

      {/* ULTRA-MINIMALIST DRIVER CARDS */}
      {filteredDrivers.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
          <Coffee size={28} className="mx-auto text-slate-400" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isAr ? 'لا يوجد سرافيس متاحة حالياً على هذا الخط' : 'No drivers currently on duty'}
          </h3>
          <p className="text-xs text-slate-500">
            {isAr ? 'السائقون خارج أوقات العمل أو غير متاحين اليوم' : 'Drivers are currently off duty.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDrivers.map((driver) => {
            const vacant = driver.maxCapacity - driver.passengers;
            const isFull = vacant === 0;
            const displayName = isAr ? driver.nameAr : driver.nameEn;

            // Signal age detection (> 2 minutes indicates weak valley coverage)
            const isSignalOld = driver.currentLocation?.timestamp && (Date.now() - driver.currentLocation.timestamp > 2 * 60 * 1000);
            const minsAgo = isSignalOld ? Math.max(2, Math.round((Date.now() - driver.currentLocation.timestamp) / 60000)) : 0;

            const shiftKey = driver.prayerShift || (driver.isLateShift ? 'after_maghrib' : 'regular_day');
            const shiftConf = PRAYER_SHIFT_CONFIGS[shiftKey];

            return (
              <div
                key={driver.id}
                id={`driver-card-${driver.id}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all space-y-3.5"
              >
                {/* Quick Departure Announcement Banner if Driver Set Countdown */}
                {driver.departureCountdown && (
                  <div className={`p-2.5 rounded-2xl flex items-center justify-between text-xs font-black gap-2 ${DEPARTURE_COUNTDOWN_CONFIGS[driver.departureCountdown].pillBg}`}>
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="shrink-0" />
                      <span>{DEPARTURE_COUNTDOWN_CONFIGS[driver.departureCountdown][isAr ? 'labelAr' : 'labelEn']}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-black/20 text-white">
                      {isAr ? 'تنبيه مباشر من السائق' : 'Driver Announcement'}
                    </span>
                  </div>
                )}

                {/* 1. Driver Name & Cultural Prayer Shift Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                      {displayName}
                    </h3>
                  </div>

                  {/* Cultural Prayer Shift Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 border ${shiftConf.badgeBg} ${shiftConf.badgeBorder} ${shiftConf.badgeText}`}>
                      {shiftKey === 'regular_day' && <Sun size={13} className="shrink-0 text-amber-500" />}
                      {shiftKey === 'after_maghrib' && <Sunset size={13} className="shrink-0 text-amber-600" />}
                      {shiftKey === 'after_isha' && <Moon size={13} className="shrink-0 text-purple-600" />}
                      {shiftKey === 'final_trip' && <Flag size={13} className="shrink-0 text-rose-600" />}
                      <span>{shiftConf[isAr ? 'labelAr' : 'labelEn']}</span>
                    </span>

                    {driver.isDetour && (
                      <span className="px-2 py-0.5 rounded-lg bg-orange-600 text-white text-[11px] font-black flex items-center gap-1">
                        <AlertTriangle size={11} />
                        <span>{isAr ? 'تحويلة' : 'Detour'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Dynamic GPS Location + Signal Fallback */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                        {isAr ? 'الموقع اللحظي (GPS مباشر):' : 'Live Proximity Status:'}
                      </span>
                      <span className="font-black text-base text-slate-900 dark:text-slate-100 truncate block mt-0.5">
                        {isAr ? driver.proximityStatusAr : driver.proximityStatusEn}
                      </span>
                    </div>
                  </div>

                  {/* Offline/Weak Signal Indicator if signal older than 2 minutes */}
                  {isSignalOld && (
                    <span className="px-2 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0 border border-amber-200 dark:border-amber-800/50">
                      <WifiOff size={11} className="shrink-0" />
                      <span>{isAr ? `آخر موقع قبل ${minsAgo} دقيقة` : `Last seen ${minsAgo}m ago`}</span>
                    </span>
                  )}
                </div>

                {/* 3. Available Seats Counter with correct pluralization */}
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'المقاعد المتاحة:' : 'Available Seats:'}
                    </span>
                  </div>

                  {isFull ? (
                    <span className="px-3 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black text-xs">
                      {isAr ? 'مكتمل' : 'FULL'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                      {isAr
                        ? (vacant === 1 ? 'مقعد شاغر واحد' : vacant === 2 ? 'مقعدان شاغران' : `${vacant} مقاعد شاغرة`)
                        : (vacant === 1 ? '1 seat open' : `${vacant} seats open`)}
                    </span>
                  )}
                </div>

                {/* Visual Seat Glyphs */}
                <div className="flex justify-center">
                  <SeatVisualizer passengers={driver.passengers} maxCapacity={driver.maxCapacity} size="md" />
                </div>

                {/* 4. One Clear Action Button: "تواصل عبر واتساب / WhatsApp" */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenWhatsAppModal(driver)}
                    className="w-full min-h-[50px] py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all tap-highlight"
                  >
                    <MessageSquare size={18} className="fill-white" />
                    <span>{isAr ? 'تواصل عبر واتساب (WhatsApp)' : 'Contact via WhatsApp'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Quiet Off-Duty Drivers Notice if any exist */}
      {offDutyDrivers.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/40 text-xs text-slate-500 flex items-center justify-between">
          <span>
            {isAr
              ? `غير متاح اليوم: ${offDutyDrivers.map((d) => d.nameAr).join('، ')}`
              : `Off Duty Today: ${offDutyDrivers.map((d) => d.nameEn).join(', ')}`}
          </span>
          <span className="text-[10px] font-mono opacity-80">{isAr ? 'في استراحة' : 'Off'}</span>
        </div>
      )}

      {/* SIMPLIFIED RESERVATION MODAL (ONLY NAME + SEATS) */}
      {requestingForDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="reservation-title" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm max-h-[90dvh] overflow-y-auto p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 id="reservation-title" className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {isAr ? 'حجز مقعد عبر واتساب' : 'WhatsApp Seat Booking'}
                </h3>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <span>
                    {isAr
                      ? `السائق: ${requestingForDriver.nameAr}`
                      : `Driver: ${requestingForDriver.nameEn}`}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label={isAr ? 'إغلاق الحجز' : 'Close reservation'}
                onClick={() => setRequestingForDriver(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {requestSent ? (
              <div className="py-8 text-center space-y-2 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {isAr ? 'جاري فتح محادثة واتساب...' : 'Opening WhatsApp...'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isAr ? 'تم تجهيز رسالتك وإرسال الإشعار للسائق' : 'Your reservation text is ready.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleLaunchWhatsApp} className="space-y-4 py-4">
                {/* 1. Name */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label htmlFor="reservation-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'الاسم:' : 'Your Name:'}
                    </label>
                    {!isEditingName && (
                      <button type="button" onClick={() => { setIsEditingName(true); nameInputRef.current?.focus(); }}
                        className="min-h-9 px-1 text-xs font-bold text-amber-700 dark:text-amber-400 underline underline-offset-4">
                        {isAr ? 'تعديل الاسم' : 'Edit Name'}
                      </button>
                    )}
                  </div>
                  <input
                    id="reservation-name"
                    ref={nameInputRef}
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    dir="auto"
                    readOnly={!isEditingName}
                    aria-invalid={nameError}
                    aria-describedby="reservation-name-hint"
                    value={passengerName}
                    onChange={(e) => { setPassengerName(e.target.value); setNameError(false); }}
                    placeholder={isAr ? 'مثال: أحمد كنعان' : 'e.g. Ahmad Kanaan'}
                    className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100"
                  />
                  <p id="reservation-name-hint" className={`text-[11px] mt-1 ${nameError ? 'text-rose-600' : 'text-slate-500'}`}>
                    {nameError ? (isAr ? 'يرجى إدخال اسمك للحجز' : 'Please enter your name to book')
                      : isEditingName ? (isAr ? 'سنتذكر هذا الاسم على جهازك عند إرسال الحجز' : 'We will remember this name on your device when you book')
                      : (isAr ? 'اسمك محفوظ على هذا الجهاز — يمكنك الحجز لعدة ركاب بنفس الاسم' : 'Saved on this device — book multiple passengers under this name')}
                  </p>
                </div>

                {/* 2. Number of Seats */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? 'عدد المقاعد:' : 'Number of Seats:'}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        aria-pressed={passengerCount === num}
                        onClick={() => setPassengerCount(num)}
                        className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all ${
                          passengerCount === num
                            ? 'bg-[#25D366] text-white ring-2 ring-emerald-600 scale-102 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notice: Drivers know villagers by name */}
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                  {isAr
                    ? '💡 السائق يعرف بيتك وموقعك بالاسم، لا حاجة لكتابة العنوان.'
                    : '💡 Driver knows your location by name, no address needed.'}
                </div>

                {/* Message Preview */}
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                  <span className="font-bold block text-slate-700 dark:text-slate-300 mb-0.5">
                    {isAr ? 'نص رسالة واتساب الجاهزة:' : 'Pre-filled WhatsApp Message:'}
                  </span>
                  <p className="italic">
                    "{isAr
                      ? `سلام عليكم، أنا ${passengerName || '[الاسم]'}، حابب أحجز ${passengerCount === 1 ? 'مقعد واحد' : passengerCount === 2 ? 'مقعدين' : `${passengerCount} مقاعد`}`
                      : `Salam alaykum, I am ${passengerName || '[Name]'}, I would like to reserve ${passengerCount === 1 ? '1 seat' : `${passengerCount} seats`}`}"
                  </p>
                </div>


                <button
                  type="submit"
                  disabled={requestSent}
                  className="w-full min-h-[48px] py-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-98 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all tap-highlight"
                >
                  <MessageSquare size={16} className="fill-white" />
                  <span>{isAr ? 'إرسال عبر واتساب الآن' : 'Send via WhatsApp'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
