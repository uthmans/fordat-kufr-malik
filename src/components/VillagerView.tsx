import React, { useRef, useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { Driver, TripDirection } from '../types';
import { PRAYER_SHIFT_CONFIGS } from '../data/initialDrivers';
import { DepartureAnnouncement } from './DepartureAnnouncement';
import { SeatVisualizer } from './SeatVisualizer';
import { RouteVisualizer } from './RouteVisualizer';
import { PWAInstallBanner } from './PWAInstallBanner';
import { PreparedReservation, ReservationHandoff } from '../utils/reservationHandoff';
import { hasRecentGPS, hasConfirmedSeats, isDemoDriver } from '../utils/dataFreshness';
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
  X,
  Coffee,
  Zap,
  WifiOff
} from 'lucide-react';

export const VillagerView: React.FC = () => {
  const { drivers: localDrivers, shared, language, setSelectedDriverId, requestSeat, villagerName, showDemoData, dataNow } = useTransit();
  // Local cached/demo GPS must never impersonate an update from another phone.
  const drivers = showDemoData ? localDrivers : localDrivers.map(driver => {
    const row = shared.rows.find(row => row.driver_id === driver.id);
    return row ? { ...driver, ...row.snapshot } : { ...driver, gpsMode: 'idle' as const,
      isOnDuty: false, seatCountUpdatedAt: undefined, currentLocation: { lat: 0, lng: 0, timestamp: 0 } };
  });
  const [filterDirection, setFilterDirection] = useState<TripDirection>('all');
  const [requestingForDriver, setRequestingForDriver] = useState<Driver | null>(null);

  // Simplified form state: Only Name + Seats!
  const [passengerName, setPassengerName] = useState(villagerName);
  const [isEditingName, setIsEditingName] = useState(!villagerName);
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [preparedReservation, setPreparedReservation] = useState<PreparedReservation | null>(null);
  const [handoffError, setHandoffError] = useState<'seats' | 'phone' | 'request' | null>(null);
  const handoffRef = useRef(new ReservationHandoff());

  const isAr = language === 'ar';

  // Only ON DUTY drivers appear in the active villager list!
  const onDutyDrivers = drivers.filter((driver) => driver.isOnDuty && (showDemoData || !isDemoDriver(driver)));
  const offDutyDrivers = drivers.filter((driver) => !driver.isOnDuty && (showDemoData || !isDemoDriver(driver)));
  const mapDrivers = onDutyDrivers.filter((driver) => hasRecentGPS(driver, dataNow) || (showDemoData && isDemoDriver(driver)));
  const confirmedDrivers = onDutyDrivers.filter((driver) => hasConfirmedSeats(driver, dataNow) || (showDemoData && isDemoDriver(driver)));
  const contactDrivers = showDemoData ? [] : drivers.filter((driver) => !onDutyDrivers.some((visible) => visible.id === driver.id));

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

  const totalOpenSeats = confirmedDrivers.reduce(
    (acc, d) => acc + Math.max(0, d.maxCapacity - d.passengers),
    0
  );

  const handleOpenWhatsAppModal = (driver: Driver) => {
    setRequestingForDriver(driver);
    setPreparedReservation(null);
    setHandoffError(null);
    handoffRef.current.reset();
    setPassengerName(villagerName);
    setIsEditingName(!villagerName);
    setNameError(false);
    setPassengerCount(1);
  };

  const handleLaunchWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingForDriver || preparedReservation) return;
    const currentDriver = drivers.find(driver => driver.id === requestingForDriver.id);
    if (!currentDriver) { setHandoffError('request'); return; }
    const result = handoffRef.current.submit({
      driverId: currentDriver.id, phone: currentDriver.phone,
      name: passengerName, seats: passengerCount, capacity: currentDriver.maxCapacity, isArabic: isAr
    }, (reservation) => requestSeat(reservation.driverId, reservation.name, reservation.seats),
    (url) => { window.open(url, '_blank', 'noopener,noreferrer'); });
    if (!result.ok) {
      if (result.error === 'name') {
        setNameError(true);
        nameInputRef.current?.focus();
      } else setHandoffError(result.error);
      return;
    }
    setPreparedReservation(result.value);
  };

  return (
    <div className="space-y-4">
      {/* PWA Home Screen Install Banner */}
      <PWAInstallBanner />

      {/* Corridor Map with live GPS positions of on-duty drivers */}
      {mapDrivers.length > 0 ? <RouteVisualizer
        drivers={mapDrivers}
        language={language}
        now={dataNow}
        demo={showDemoData}
        onSelectDriver={(id) => {
          setSelectedDriverId(id);
          const el = document.getElementById(`driver-card-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-emerald-500');
            setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 2000);
          }
        }}
      /> : <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
        {isAr ? 'لا توجد مواقع GPS مشتركة حديثة حالياً.' : 'No recent shared GPS locations available.'}
      </div>}

      {/* Direction Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {onDutyDrivers.length > 0 && <div className="flex flex-wrap items-center gap-1 p-1 max-w-full bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
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

        }
        {/* Total open seats with pluralization */}
        <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
          <span className="block font-sans text-slate-500">{showDemoData ? (isAr ? 'معاينة المقاعد (تشمل بيانات تجريبية)' : 'Seat preview (includes demo data)') : (isAr ? 'مقاعد مؤكدة حديثاً من السائقين' : 'Recently confirmed seats from drivers')}</span>
          {confirmedDrivers.length === 0 ? (isAr ? 'لا يوجد تحديث مؤكد للمقاعد' : 'No confirmed seat updates') : totalOpenSeats > 0 ? (
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
      {filteredDrivers.length === 0 ? (contactDrivers.length > 0 ? null :
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
          <Coffee size={28} className="mx-auto text-slate-400" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isAr ? 'لا توجد تحديثات للسائقين في هذا العرض' : 'No driver updates in this view'}
          </h3>
          <p className="text-xs text-slate-500">
            {isAr ? 'تواصل مع السائق للتأكد من توفره.' : 'Contact a driver to confirm availability.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDrivers.map((driver) => {
            const demo = isDemoDriver(driver);
            const seatsKnown = hasConfirmedSeats(driver, dataNow) || (showDemoData && demo);
            const vacant = driver.maxCapacity - driver.passengers;
            const isFull = vacant === 0;
            const displayName = isAr ? driver.nameAr : driver.nameEn;

            // Signal age detection (> 2 minutes indicates weak valley coverage)
            const isSignalOld = !demo && !hasRecentGPS(driver, dataNow);
            const timestamp = driver.currentLocation?.timestamp;
            const validTime = Number.isFinite(timestamp) && timestamp > 0 && timestamp <= dataNow;
            const minsAgo = validTime ? Math.floor((dataNow - timestamp) / 60000) : 0;

            const shiftKey = driver.prayerShift || (driver.isLateShift ? 'after_maghrib' : 'regular_day');
            const shiftConf = PRAYER_SHIFT_CONFIGS[shiftKey];

            return (
              <div
                key={driver.id}
                id={`driver-card-${driver.id}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all space-y-3.5"
              >
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{demo ? (isAr ? 'بيانات تجريبية' : 'Demo data') : isSignalOld ? (isAr ? 'موقع محفوظ — تحديث قديم' : 'Saved location — stale update') : (isAr ? 'GPS حديث من هذا الهاتف' : 'Recent GPS from this phone')}</p>
                {/* Quick Departure Announcement Banner if Driver Set Countdown */}
                <DepartureAnnouncement driver={driver} now={dataNow} isAr={isAr} />

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
                        {demo ? (isAr ? 'موقع تجريبي:' : 'Demo location:') : (isAr ? 'آخر موقع مُبلغ عنه:' : 'Last reported location:')}
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
                      <span>{validTime ? (isAr ? `آخر موقع قبل ${minsAgo} دقيقة` : `Last seen ${minsAgo}m ago`) : (isAr ? 'وقت التحديث غير معروف' : 'Update time unknown')}</span>
                    </span>
                  )}
                </div>

                {/* 3. Available Seats Counter with correct pluralization */}
                {!demo && validTime && <p className="text-[11px] text-slate-500">{isAr ? 'تحديث الموقع: ' : 'Location updated: '}{new Date(timestamp).toLocaleTimeString(isAr ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</p>}
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'المقاعد المتاحة:' : 'Available Seats:'}
                    </span>
                  </div>

                  {!seatsKnown ? <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs">{isAr ? 'التوفر غير مؤكد' : 'Availability unconfirmed'}</span> : isFull ? (
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
                {seatsKnown && <div className="flex justify-center">
                  <SeatVisualizer passengers={driver.passengers} maxCapacity={driver.maxCapacity} size="md" />
                </div>}

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


      {contactDrivers.length > 0 && <section className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{isAr ? 'التواصل مع السائقين — التوفر غير مؤكد' : 'Driver contacts — availability unconfirmed'}</h2>
        {contactDrivers.map((driver) => <div key={driver.id} className="flex items-center justify-between gap-2 py-2 border-t border-slate-100 dark:border-slate-800">
          <span className="min-w-0 text-sm font-bold text-slate-800 dark:text-slate-200">{isAr ? driver.nameAr : driver.nameEn}</span>
          <button type="button" onClick={() => handleOpenWhatsAppModal(driver)} className="min-h-10 shrink-0 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">{isAr ? 'تواصل عبر واتساب' : 'WhatsApp'}</button>
        </div>)}
      </section>}

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

            {preparedReservation ? (
              <div className="py-5 text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 mx-auto flex items-center justify-center">
                  <MessageSquare size={28} />
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {isAr ? 'الرسالة جاهزة لواتساب' : 'Message ready for WhatsApp'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isAr ? 'أرسل الرسالة في واتساب وانتظر تأكيد السائق. تجهيز الرسالة لا يؤكد الحجز.' : 'Send the message in WhatsApp and wait for the driver to confirm. Preparing a message does not confirm a booking.'}
                </p>
                <p dir="auto" className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-start text-xs text-slate-700 dark:text-slate-200 break-words">{preparedReservation.message}</p>
                <a href={preparedReservation.url} target="_blank" rel="noopener noreferrer" className="w-full min-h-12 p-3 rounded-2xl bg-[#25D366] text-white font-black text-sm flex items-center justify-center gap-2">
                  <MessageSquare size={18} />{isAr ? 'فتح واتساب' : 'Open WhatsApp'}
                </a>
                <p className="text-[11px] text-slate-500">{isAr ? 'إذا لم يفتح واتساب، اضغط الزر أعلاه. لن يتكرر الطلب المحفوظ.' : 'If WhatsApp did not open, use the button above. It will not duplicate the saved request.'}</p>
                <button type="button" onClick={() => setRequestingForDriver(null)} className="w-full min-h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs">{isAr ? 'تم' : 'Done'}</button>
              </div>
            ) : (
              <form onSubmit={handleLaunchWhatsApp} className="space-y-4 py-4">
                {handoffError && <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">{handoffError === 'request'
                  ? (isAr ? 'تعذر إضافة الطلب. بياناتك ما زالت هنا. حاول مجدداً أو اختر سائقاً آخر.' : 'Could not add the request. Your draft is still here. Try again or choose another driver.')
                  : handoffError === 'phone'
                  ? (isAr ? 'رقم واتساب السائق غير صالح. اختر سائقاً آخر.' : 'This driver’s WhatsApp number is invalid. Choose another driver.')
                  : (isAr ? 'عدد المقاعد غير صالح لهذه السيارة.' : 'The seat count is invalid for this vehicle.')}</p>}
                <p className="text-xs text-amber-700 dark:text-amber-300">{isAr ? 'التوفر يحتاج تأكيد السائق عبر واتساب. هذا طلب حجز وليس تأكيداً.' : 'The driver must confirm availability through WhatsApp. This is a request, not a confirmed booking.'}</p>
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
                        onClick={() => { setPassengerCount(num); setHandoffError(null); }}
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
                  disabled={!!preparedReservation}
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
