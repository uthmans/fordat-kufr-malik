import React, { useRef, useState } from 'react';
import { useTransit } from '../context/TransitContext';
import { Driver, TripDirection } from '../types';
import { PassengerDriverCard } from './PassengerDriverCard';
import { DriverContactActions } from './DriverContactActions';
import { RouteVisualizer } from './RouteVisualizer';
import { PWAInstallBanner } from './PWAInstallBanner';
import { PreparedReservation, ReservationHandoff } from '../utils/reservationHandoff';
import { hasRecentGPS, hasConfirmedSeats, isDemoDriver } from '../utils/dataFreshness';
import { hasRecentSharedReport, isSharedDriverActive } from '../utils/sharedAvailability';
import { MessageSquare, X } from 'lucide-react';

export const VillagerView: React.FC = () => {
  const { drivers: localDrivers, shared, language, setSelectedDriverId, requestSeat, villagerName, showDemoData, dataNow: refreshTime } = useTransit();
  const dataNow = Math.max(refreshTime, Date.now());
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
  const onDutyDrivers = drivers.filter(driver => showDemoData ? driver.isOnDuty
    : isSharedDriverActive(shared.rows.find(row => row.driver_id === driver.id), dataNow));
  const offDutyDrivers = drivers.filter(driver => !driver.isOnDuty && (showDemoData ||
    hasRecentSharedReport(shared.rows.find(row => row.driver_id === driver.id), dataNow)));
  const mapDrivers = onDutyDrivers.filter((driver) => hasRecentGPS(driver, dataNow) || (showDemoData && isDemoDriver(driver)));
  const confirmedDrivers = onDutyDrivers.filter((driver) => hasConfirmedSeats(driver, dataNow) || (showDemoData && isDemoDriver(driver)));

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
      <h2 className="text-lg font-black">{isAr ? 'السائقون المتاحون' : 'Available drivers'}</h2>
      {onDutyDrivers.length > 0 && <div className="grid grid-cols-3 gap-2" role="group" aria-label={isAr ? 'اتجاه الرحلة' : 'Trip direction'}>
        {(['all', 'to_ramallah', 'to_kufr_malik'] as const).map(direction => <button key={direction} type="button"
          aria-pressed={filterDirection === direction} onClick={() => setFilterDirection(direction)}
          className={`min-w-0 min-h-11 p-2 rounded-xl text-xs font-bold whitespace-normal ${filterDirection === direction ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
          {direction === 'all' ? (isAr ? 'الكل' : 'All') : direction === 'to_ramallah' ? (isAr ? 'إلى الموقف' : 'To Ramallah') : (isAr ? 'إلى كفر مالك' : 'To Kufr Malik')}
        </button>)}
      </div>}
      {filteredDrivers.length > 0 ? <div className="space-y-3">
        {filteredDrivers.map(driver => <PassengerDriverCard key={driver.id} driver={driver} now={dataNow} isAr={isAr}
          demo={showDemoData} onWhatsApp={() => handleOpenWhatsAppModal(driver)} />)}
      </div> : <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <p className="font-bold">{isAr ? 'لا توجد تحديثات حديثة حالياً' : 'No recent updates right now'}</p>
        <p className="text-sm text-slate-500">{isAr ? 'افتح جميع السائقين واتصل للتأكد.' : 'Open All drivers and call to check.'}</p>
      </div>}
      <details className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl px-4">
        <summary className="min-h-14 py-4 cursor-pointer font-bold">{isAr ? 'جميع السائقين' : 'All drivers'} ({drivers.length})</summary>
        <div className="pb-4 space-y-3">
          {drivers.map(driver => <div key={driver.id} className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="font-bold">{isAr ? driver.nameAr : driver.nameEn}</p>
            <p className="text-xs text-slate-500">{onDutyDrivers.some(active => active.id === driver.id) ? (isAr ? 'تحديث حديث' : 'Recent update')
              : offDutyDrivers.some(off => off.id === driver.id) ? (isAr ? 'آخر بلاغ: خارج الدوام' : 'Last report: off duty') : (isAr ? 'اتصل للتأكد من التوفر' : 'Call to check availability')}</p>
            <DriverContactActions phone={driver.phone} name={isAr ? driver.nameAr : driver.nameEn} isAr={isAr} onWhatsApp={() => handleOpenWhatsAppModal(driver)} />
          </div>)}
        </div>
      </details>
      {mapDrivers.length > 0 && <details className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl px-4">
        <summary className="min-h-14 py-4 cursor-pointer font-bold">{isAr ? 'عرض مسار السائقين' : 'View drivers on route'}</summary>
        <div className="pb-4 space-y-3">
          <p className="text-xs text-slate-500">{confirmedDrivers.length > 0 ? (isAr ? `المقاعد المؤكدة: ${totalOpenSeats}` : `Confirmed open seats: ${totalOpenSeats}`) : (isAr ? 'المقاعد غير مؤكدة' : 'Seats unconfirmed')}</p>
          <RouteVisualizer drivers={mapDrivers} language={language} now={dataNow} demo={showDemoData}
          onSelectDriver={id => {
            setSelectedDriverId(id);
            setFilterDirection('all');
            setTimeout(() => {
              const card = document.getElementById(`driver-card-${id}`);
              card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card?.classList.add('ring-2', 'ring-emerald-500');
              setTimeout(() => card?.classList.remove('ring-2', 'ring-emerald-500'), 2000);
            }, 0);
          }} /></div>
      </details>}
      <details className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl px-4">
        <summary className="min-h-14 py-4 cursor-pointer font-bold">{isAr ? 'المساعدة وتثبيت التطبيق' : 'Help and install'}</summary>
        <div className="pb-4 space-y-3 text-sm">
          <p>{isAr ? 'اتصل بالسائق أو أرسل طلباً عبر واتساب. الحجز يحتاج تأكيد السائق.' : 'Call the driver or request seats through WhatsApp. The driver must confirm your booking.'}</p>
          <p>{isAr ? 'التحديثات المباشرة ورسائل واتساب تحتاج الإنترنت.' : 'Live updates and WhatsApp messages need internet.'}</p>
          <PWAInstallBanner />
        </div>
      </details>

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
                      : (isAr ? 'الاسم محفوظ' : 'Name saved')}
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

                <details>
                  <summary className="min-h-11 py-3 cursor-pointer text-xs font-bold">{isAr ? 'معاينة الرسالة والمساعدة' : 'Message preview and help'}</summary>
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


                </details>
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
