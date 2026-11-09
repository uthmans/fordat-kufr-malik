import React, { useLayoutEffect, useRef, useState } from 'react';
import { ROUTE_NODES } from '../data/routeNodes';
import { Driver, Language } from '../types';
import { Navigation, AlertTriangle, MapPin } from 'lucide-react';
import { layoutRoutePins } from '../utils/routePinLayout';
import { hasConfirmedSeats, isDemoDriver } from '../utils/dataFreshness';

interface RouteVisualizerProps {
  drivers: Driver[];
  language: Language;
  onSelectDriver?: (driverId: string) => void;
  now?: number;
  demo?: boolean;
}

const formatDriverPinName = (fullName: string, isArabic: boolean): string => {
  const words = fullName.trim().split(/\s+/);
  const hasHonorific = isArabic
    ? words[0] === 'أبو' || words[0] === 'ابو'
    : words[0].toLowerCase() === 'abu';
  return words.slice(0, hasHonorific ? 2 : 1).join(' ');
};

const getDriverProgress = (driver: Driver) => {
  if (driver.status === 'in_kufr_malik') return 4;
  if (driver.status === 'in_ramallah') return 96;
  const node = ROUTE_NODES.find((n) => n.id === driver.detectedNodeId);
  return node ? (node.distanceKmFromStart / 23) * 100 : driver.status === 'to_ramallah' ? 45 : 65;
};

const pinColor = (driver: Driver) => driver.isDetour ? 'bg-orange-600'
  : driver.status === 'in_kufr_malik' ? 'bg-emerald-600'
  : driver.status === 'to_ramallah' ? 'bg-blue-600'
  : driver.status === 'in_ramallah' ? 'bg-amber-600' : 'bg-purple-600';

export const RouteVisualizer: React.FC<RouteVisualizerProps> = ({ drivers, language, onSelectDriver, now = Date.now(), demo = false }) => {
  const isAr = language === 'ar';
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const layout = layoutRoutePins(drivers.map((driver) => ({ id: driver.id, progress: getDriverProgress(driver) })), trackWidth);
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  return (
    <section data-testid="route-card" className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Navigation className="w-4 h-4 text-amber-500 shrink-0" />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {demo ? (isAr ? 'معاينة المسار التجريبية' : 'Demo route preview') : (isAr ? 'مسار السائقين' : 'Driver route')}
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          {isAr ? 'كفر مالك ⇄ الموقف (23 كم)' : 'Kufr Malik ⇄ Ramallah (~23 km)'}
        </span>
      </div>

      {drivers.some((d) => d.isDetour) && (
        <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-700/60 flex flex-wrap items-center justify-between text-xs text-orange-900 dark:text-orange-200 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle size={15} className="text-orange-600 shrink-0" />
            <span className="font-bold">{isAr ? 'تنبيه: مسار بديل نشط لتفادي الإغلاقات' : 'Detour Active: Vehicle on bypass route'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-orange-600 text-white font-black text-[10px] shrink-0">{isAr ? 'مسار بديل' : 'Detour'}</span>
        </div>
      )}

      {/* Physical route stays left-to-right; each label has its own text direction. */}
      <div className="px-2 pb-3" dir="ltr">
        <div ref={trackRef} data-testid="route-track" className="relative" style={{ height: layout.height + 6 }}>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="absolute inset-x-2 top-1/2 border-t border-dashed border-slate-400 dark:border-slate-600" />
            {ROUTE_NODES.map((node) => {
              const pct = (node.distanceKmFromStart / 23) * 100;
              const color = pct === 0 ? 'bg-emerald-500 border-white ring-2 ring-emerald-300'
                : pct >= 95 ? 'bg-amber-500 border-white ring-2 ring-amber-300'
                : node.id === 'yabroud_checkpoint' ? 'bg-rose-500 border-white ring-2 ring-rose-300'
                : 'bg-white dark:bg-slate-700 border-slate-400 dark:border-slate-500';
              return (
                <div key={node.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: pct + '%' }} title={(isAr ? node.nameAr : node.nameEn) + ' (' + node.distanceKmFromStart + ' km)'}>
                  <div className={'w-3.5 h-3.5 rounded-full border-2 ' + color} />
                </div>
              );
            })}
          </div>

          {/* Draw all stems behind labels, ending at the true GPS position. */}
          {trackWidth > 0 && layout.pins.map((pin) => {
            const driver = driverById.get(pin.id)!;
            const top = layout.height - 48 - pin.lane * 40;
            return (
              <div key={pin.id} aria-hidden="true" className={'absolute w-px opacity-60 pointer-events-none ' + pinColor(driver)}
                style={{ left: pin.anchor, top: top + 32, height: layout.height - top - 32 }}>
                <span className={'absolute bottom-0 -left-0.5 w-1.5 h-1.5 rounded-full ' + pinColor(driver)} />
              </div>
            );
          })}

          {trackWidth > 0 && layout.pins.map((pin) => {
            const driver = driverById.get(pin.id)!;
            const vacant = Math.max(0, driver.maxCapacity - driver.passengers);
            const vacantText = !(hasConfirmedSeats(driver, now) || (demo && isDemoDriver(driver))) ? (isAr ? 'غير مؤكد' : 'Unconfirmed') : vacant === 0 ? (isAr ? 'مكتمل' : 'FULL')
              : isAr ? (vacant === 1 ? 'مقعد واحد' : vacant === 2 ? 'مقعدان' : vacant + ' مقاعد')
              : vacant === 1 ? '1 seat' : vacant + ' seats';
            const fullName = isAr ? driver.nameAr : driver.nameEn;
            return (
              <button key={pin.id} type="button" data-testid="route-pin" dir={isAr ? 'rtl' : 'ltr'}
                onClick={() => onSelectDriver?.(pin.id)} disabled={!onSelectDriver}
                title={fullName + ' (' + vacantText + ')'} aria-label={fullName + ' (' + vacantText + ')'}
                className={'absolute z-10 h-8 px-2 rounded-lg text-[11px] font-black text-white shadow-sm flex items-center justify-between gap-1 whitespace-nowrap border border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ' + pinColor(driver)}
                style={{ left: pin.left, top: layout.height - 48 - pin.lane * 40, width: layout.labelWidth }}>
                <span className="min-w-0 truncate">{formatDriverPinName(fullName, isAr)}</span>
                <span className="shrink-0">{vacantText}</span>
                {driver.isDetour && <AlertTriangle size={12} className="shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center gap-3 text-xs mt-4 pt-1 font-extrabold text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span dir="auto">{isAr ? 'كفر مالك' : 'Kufr Malik'}</span></div>
          <div className="flex items-center gap-1"><span dir="auto">{isAr ? 'الموقف' : 'Ramallah'}</span><span className="w-2 h-2 rounded-full bg-amber-500" /></div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          {demo ? (isAr ? 'مواقع تجريبية للتوضيح:' : 'Example locations for preview:') : (isAr ? 'آخر المواقع المشتركة:' : 'Latest shared locations:')}
        </span>
        <div className="flex flex-col gap-1.5">
          {drivers.map((driver) => (
            <button key={driver.id} type="button" onClick={() => onSelectDriver?.(driver.id)} disabled={!onSelectDriver}
              className="w-full text-start flex items-start justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors border border-slate-100 dark:border-slate-700/60 gap-2">
              <span className="flex items-start gap-1.5 min-w-0">
                <MapPin size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="font-extrabold text-slate-900 dark:text-slate-100 break-words">{isAr ? driver.proximityStatusAr : driver.proximityStatusEn}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 shrink-0" dir="auto">
                {hasConfirmedSeats(driver, now) || (demo && isDemoDriver(driver))
                  ? `${driver.passengers}/${driver.maxCapacity || 7} ${isAr ? 'ركاب' : 'passengers'}`
                  : (isAr ? 'المقاعد غير مؤكدة' : 'Seats unconfirmed')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

