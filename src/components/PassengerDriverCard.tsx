import React from 'react';
import type { Driver } from '../types';
import { PRAYER_SHIFT_CONFIGS, STATUS_CONFIGS } from '../data/initialDrivers';
import { hasConfirmedSeats, hasRecentGPS, isDemoDriver } from '../utils/dataFreshness';
import { DriverContactActions } from './DriverContactActions';
import { DepartureAnnouncement } from './DepartureAnnouncement';
import { SeatVisualizer } from './SeatVisualizer';
import { formatLastSeen } from '../utils/sharedAvailability';

export function PassengerDriverCard({ driver, now, isAr, demo, onWhatsApp, lastSeen = false }: {
  driver: Driver; now: number; isAr: boolean; demo: boolean; onWhatsApp: () => void; lastSeen?: boolean;
}) {
  const example = demo && isDemoDriver(driver);
  const seatsKnown = !lastSeen && (hasConfirmedSeats(driver, now) || example);
  const vacant = driver.maxCapacity - driver.passengers;
  const status = STATUS_CONFIGS[driver.status] || STATUS_CONFIGS.to_ramallah;
  const shift = PRAYER_SHIFT_CONFIGS[driver.prayerShift || (driver.isLateShift ? 'after_maghrib' : 'regular_day')];
  const fresh = hasRecentGPS(driver, now);
  const name = isAr ? driver.nameAr : driver.nameEn;
  return <article id={`driver-card-${driver.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-black text-lg break-words">{name}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{lastSeen ? formatLastSeen(driver.currentLocation.timestamp, now, isAr) : status[isAr ? 'labelAr' : 'labelEn']}</p>
      </div>
      <span className={`shrink-0 text-xs font-bold rounded-xl px-3 py-2 ${seatsKnown && vacant > 0 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
        {!seatsKnown ? (isAr ? 'اتصل للتأكد' : 'Call to check') : vacant === 0 ? (isAr ? 'مكتمل' : 'Full')
          : isAr ? (vacant === 1 ? 'مقعد واحد' : vacant === 2 ? 'مقعدان' : `${vacant} مقاعد`) : `${vacant} ${vacant === 1 ? 'seat' : 'seats'}`}
      </span>
    </div>
    {!lastSeen && <DepartureAnnouncement driver={driver} now={now} isAr={isAr} />}
    <p className="text-xs text-slate-500">{lastSeen ? (isAr ? 'الموقع لا يتحدّث — اتصل للتأكد من التوفر' : 'Location not updating — call to check availability') : example ? (isAr ? 'بيانات تجريبية' : 'Demo data') : fresh
      ? (isAr ? 'تحديث حديث من السائق' : 'Recent driver update') : (isAr ? 'التوفر غير مؤكد' : 'Availability unconfirmed')}
      {!lastSeen && driver.isDetour && <span className="font-bold text-orange-700 dark:text-orange-300">{' · '}{isAr ? 'تحويلة' : 'Detour'}</span>}</p>
    <DriverContactActions phone={driver.phone} name={name} isAr={isAr} onWhatsApp={onWhatsApp} />
    <details className="border-t border-slate-100 dark:border-slate-800">
      <summary className="min-h-11 flex items-center cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">{isAr ? 'تفاصيل الرحلة والمقاعد' : 'Trip and seat details'}</summary>
      <div className="space-y-3 text-sm pb-2">
        <p>{shift[isAr ? 'labelAr' : 'labelEn']}</p>
        <p>{lastSeen && (isAr ? 'آخر بلاغ: ' : 'Last report: ')}{isAr ? driver.proximityStatusAr : driver.proximityStatusEn}</p>
        {!example && driver.currentLocation.timestamp > 0 && <p className="text-xs text-slate-500">{isAr ? 'آخر موقع: ' : 'Last location: '}{new Date(driver.currentLocation.timestamp).toLocaleString(isAr ? 'ar' : 'en')}</p>}
        {driver.isDetour && <p>{isAr ? driver.detourNameAr : driver.detourNameEn}</p>}
        {(driver.departureNoteEn || driver.departureNoteAr) && <p dir="auto">{isAr ? driver.departureNoteAr || driver.departureNoteEn : driver.departureNoteEn || driver.departureNoteAr}</p>}
        {seatsKnown && <SeatVisualizer passengers={driver.passengers} maxCapacity={driver.maxCapacity} size="md" />}
      </div>
    </details>
  </article>;
}
