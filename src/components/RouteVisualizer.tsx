import React from 'react';
import { ROUTE_NODES } from '../data/routeNodes';
import { Driver, Language } from '../types';
import { Navigation, AlertTriangle, MapPin } from 'lucide-react';

interface RouteVisualizerProps {
  drivers: Driver[];
  language: Language;
  onSelectDriver?: (driverId: string) => void;
}

export const RouteVisualizer: React.FC<RouteVisualizerProps> = ({
  drivers,
  language,
  onSelectDriver
}) => {
  const isAr = language === 'ar';

  const getDriverProgress = (driver: Driver) => {
    if (driver.status === 'in_kufr_malik') return 4;
    if (driver.status === 'in_ramallah') return 96;

    const nodeIndex = ROUTE_NODES.findIndex((n) => n.id === driver.detectedNodeId);
    if (nodeIndex !== -1) {
      return (ROUTE_NODES[nodeIndex].distanceKmFromStart / 23.0) * 100;
    }
    return driver.status === 'to_ramallah' ? 45 : 65;
  };

  const hasAnyDetour = drivers.some((d) => d.isDetour);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-amber-500 shrink-0" />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {isAr ? 'مسار الخط الحي (GPS)' : 'Live Corridor Progression'}
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {isAr ? 'كفر مالك ⇄ الموقف (23 كم)' : 'Kufr Malik ⇄ Ramallah (~23 km)'}
        </span>
      </div>

      {/* Detour Alert Banner */}
      {hasAnyDetour && (
        <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-700/60 flex items-center justify-between text-xs text-orange-900 dark:text-orange-200 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={15} className="text-orange-600 shrink-0" />
            <span className="font-bold truncate">
              {isAr ? 'تنبيه: مسار بديل نشط لتفادي الإغلاقات' : 'Detour Active: Vehicle on bypass route'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-orange-600 text-white font-black text-[10px] shrink-0">
            {isAr ? 'مسار بديل' : 'Detour'}
          </span>
        </div>
      )}

      {/* Live Track Line */}
      <div className="relative pt-24 pb-3 px-2">
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-visible">
          {/* Dashed center lane */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[2px] border-t border-dashed border-slate-400 dark:border-slate-600" />

          {/* 6 Clean Node Dots */}
          {ROUTE_NODES.map((node) => {
            const pct = (node.distanceKmFromStart / 23.0) * 100;
            const isCheckpoint = node.id === 'yabroud_checkpoint';

            return (
              <div
                key={node.id}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
                style={{ left: `${pct}%` }}
                title={`${isAr ? node.nameAr : node.nameEn} (${node.distanceKmFromStart} km)`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    pct === 0
                      ? 'bg-emerald-500 border-white ring-2 ring-emerald-300'
                      : pct >= 95
                      ? 'bg-amber-500 border-white ring-2 ring-amber-300'
                      : isCheckpoint
                      ? 'bg-rose-500 border-white ring-2 ring-rose-300'
                      : 'bg-white dark:bg-slate-700 border-slate-400 dark:border-slate-500'
                  }`}
                />
              </div>
            );
          })}

          {/* Live Driver Position Pins (Tiered Staggering to Prevent Horizontal Pill Collisions) */}
          {(() => {
            // Sort by position along the corridor
            const sorted = drivers
              .map((d) => ({
                driver: d,
                pos: Math.max(5, Math.min(95, getDriverProgress(d)))
              }))
              .sort((a, b) => a.pos - b.pos);

            // Assign vertical tiers (0, 1, 2) when pins are within 13% collision distance
            const tiered: { driver: Driver; pos: number; tier: number }[] = [];
            sorted.forEach((item, idx) => {
              let tier = 0;
              for (let i = idx - 1; i >= 0; i--) {
                const prev = tiered[i];
                if (Math.abs(item.pos - prev.pos) < 13) {
                  if (prev.tier === tier) {
                    tier = (prev.tier + 1) % 3;
                  }
                }
              }
              tiered.push({ ...item, tier });
            });

            return tiered.map(({ driver, pos, tier }) => {
              const vacant = driver.maxCapacity - driver.passengers;
              const firstName = isAr
                ? driver.nameAr.split(' ')[0]
                : driver.nameEn.split(' ')[0];

              // Pluralization
              let vacantText = '';
              if (vacant <= 0) {
                vacantText = isAr ? 'مكتمل' : 'FULL';
              } else if (isAr) {
                vacantText = vacant === 1 ? 'مقعد واحد' : vacant === 2 ? 'مقعدان' : `${vacant} مقاعد`;
              } else {
                vacantText = vacant === 1 ? '1 seat' : `${vacant} seats`;
              }

              // Vertical tier calculation
              const topOffset = -30 - tier * 30;
              const stemHeight = 6 + tier * 30;

              return (
                <div
                  key={driver.id}
                  onClick={() => onSelectDriver && onSelectDriver(driver.id)}
                  className="absolute -translate-x-1/2 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{
                    left: `${pos}%`,
                    top: `${topOffset}px`,
                    zIndex: 20 + tier
                  }}
                  title={`${isAr ? driver.nameAr : driver.nameEn} (${vacantText})`}
                >
                  <div className="flex flex-col items-center">
                    {/* Floating Pill */}
                    <div
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-md flex items-center gap-1 whitespace-nowrap border border-white/20 ${
                        driver.isDetour
                          ? 'bg-orange-600 ring-2 ring-orange-300'
                          : driver.status === 'in_kufr_malik'
                          ? 'bg-emerald-600'
                          : driver.status === 'to_ramallah'
                          ? 'bg-blue-600'
                          : driver.status === 'in_ramallah'
                          ? 'bg-amber-600'
                          : 'bg-purple-600'
                      }`}
                    >
                      <span className="opacity-90">{firstName}:</span>
                      <span className="font-mono font-extrabold">{vacantText}</span>
                      {driver.isDetour && <span>⚠️</span>}
                    </div>

                    {/* Connecting stem down to track */}
                    <div
                      className={`w-[2px] transition-all ${
                        driver.isDetour
                          ? 'bg-orange-500'
                          : driver.status === 'in_kufr_malik'
                          ? 'bg-emerald-500'
                          : driver.status === 'to_ramallah'
                          ? 'bg-blue-500'
                          : driver.status === 'in_ramallah'
                          ? 'bg-amber-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ height: `${stemHeight}px` }}
                    />
                    {/* Anchor dot on line */}
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white -mt-0.5 shadow-xs" />
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Start and End labels below track (Strictly Kufr Malik & Ramallah / كفر مالك والموقف) */}
        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-4 pt-1">
          <div className="flex items-center gap-1 font-extrabold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{isAr ? 'كفر مالك' : 'Kufr Malik'}</span>
          </div>

          <div className="flex items-center gap-1 font-extrabold text-slate-800 dark:text-slate-200">
            <span>{isAr ? 'الموقف' : 'Ramallah'}</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
        </div>
      </div>

      {/* Dynamic Proximity Text Strip for all active drivers */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          {isAr ? 'الموقع اللحظي للسائقين (تحديث GPS مباشر):' : 'Live Driver Proximity Updates:'}
        </span>
        <div className="flex flex-col gap-1.5">
          {drivers.map((d) => {
            const pCount = d.passengers;
            const pLabel = isAr
              ? `${pCount}/${d.maxCapacity || 7} ركاب`
              : `${pCount}/${d.maxCapacity || 7} ${pCount === 1 ? 'passenger' : 'passengers'}`;

            return (
              <div
                key={d.id}
                onClick={() => onSelectDriver && onSelectDriver(d.id)}
                className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer transition-colors border border-slate-100 dark:border-slate-700/60 gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin size={13} className="text-amber-500 shrink-0" />
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {isAr ? d.proximityStatusAr : d.proximityStatusEn}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0">
                  {pLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

