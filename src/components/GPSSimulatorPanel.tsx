import React from 'react';
import { useTransit } from '../context/TransitContext';
import { ROUTE_NODES, DETOUR_NODES } from '../data/routeNodes';
import {
  Play,
  Pause,
  Compass,
  AlertTriangle,
  RotateCcw,
  Navigation,
  Radio,
  Sliders,
  CheckCircle2,
  ArrowRightLeft
} from 'lucide-react';

export const GPSSimulatorPanel: React.FC = () => {
  const {
    isTrackingRealGPS,
    startRealGPSTracking,
    stopRealGPSTracking,
    gpsError,
    isSimulatingGPS,
    toggleGPSSimulation,
    simulationProgress,
    setSimulationProgress,
    simulationDirection,
    setSimulationDirection,
    isDetourSimulated,
    toggleDetourSimulation,
    language,
    currentDriver,
    authenticatedDriverId,
    isAdminAuthenticated
  } = useTransit();

  const isAr = language === 'ar';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Radio size={18} className={isSimulatingGPS || isTrackingRealGPS ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              {isAdminAuthenticated ? (isAr ? 'مختبر المحاكاة وGPS' : 'GPS Tracking & Simulation Lab') : (isAr ? 'موقع هاتف السائق' : 'Driver phone location')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isAdminAuthenticated ? (isAr
                ? 'اختبار الحركة التلقائية بين كفر مالك ورام الله وكشف التحويلات'
                : 'Test auto-location progression & detour detection across tabs') : (isAr ? 'استخدم موقع الهاتف الحقيقي' : 'Use the phone’s real location')}
            </p>
          </div>
        </div>

        {/* Real GPS Toggle button */}
        <button
          type="button"
          disabled={!authenticatedDriverId}
          onClick={() => (isTrackingRealGPS ? stopRealGPSTracking() : startRealGPSTracking())}
          className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all tap-highlight disabled:opacity-50 disabled:cursor-not-allowed ${
            isTrackingRealGPS
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Navigation size={13} className={isTrackingRealGPS ? 'animate-spin' : ''} />
          <span>
            {isTrackingRealGPS
              ? isAr ? 'GPS حقيقي نشط' : 'Real GPS ON'
              : isAr ? 'تشغيل GPS الهاتف' : 'Use Phone GPS'}
          </span>
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {authenticatedDriverId && currentDriver
          ? (isAr ? `GPS الهاتف يحدث موقع ${currentDriver.nameAr} فقط` : `Phone GPS updates ${currentDriver.nameEn} only`)
          : (isAr ? 'سجل دخولك كسائق لتشغيل GPS الهاتف' : 'Sign in as a driver to use phone GPS')}
      </p>

      {gpsError && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Simulation Controls Strip */}
      {isAdminAuthenticated && <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-4">
        {/* Play/Pause + Direction Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleGPSSimulation}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all tap-highlight ${
              isSimulatingGPS
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}
          >
            {isSimulatingGPS ? <Pause size={15} /> : <Play size={15} />}
            <span>
              {isSimulatingGPS
                ? isAr ? 'إيقاف المحاكاة مؤقتاً' : 'Pause Simulation'
                : isAr ? 'بدء المحاكاة التلقائية' : 'Start Auto Simulation'}
            </span>
          </button>

          {/* Direction Switcher */}
          <button
            type="button"
            onClick={() =>
              setSimulationDirection(
                simulationDirection === 'to_ramallah' ? 'to_kufr_malik' : 'to_ramallah'
              )
            }
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100"
          >
            <ArrowRightLeft size={14} />
            <span>
              {simulationDirection === 'to_ramallah'
                ? isAr ? 'باتجاه الموقف ➔' : 'To Ramallah ➔'
                : isAr ? 'باتجاه كفر مالك ➔' : 'To Kufr Malik ➔'}
            </span>
          </button>

          {/* Detour Simulation Button */}
          <button
            type="button"
            onClick={toggleDetourSimulation}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all tap-highlight ${
              isDetourSimulated
                ? 'bg-orange-600 text-white ring-2 ring-orange-400 shadow-sm'
                : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800'
            }`}
          >
            <AlertTriangle size={15} />
            <span>
              {isDetourSimulated
                ? isAr ? 'تحويلة نشطة (ترمسعيا)' : 'Detour Active (Turmusaya)'
                : isAr ? 'اختبار مسار بديل / تحويلة' : 'Simulate Detour'}
            </span>
          </button>
        </div>

        {/* Corridor Movement Progress Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>{isAr ? 'كفر مالك (0%)' : 'Kufr Malik (0%)'}</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-extrabold text-sm">
              {simulationProgress}%
            </span>
            <span>{isAr ? 'الموقف (100%)' : 'Ramallah (100%)'}</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={simulationProgress}
            onChange={(e) => setSimulationProgress(Number(e.target.value))}
            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
            <span>{isAr ? 'سلواد' : 'Silwad'}</span>
            <span>{isAr ? 'حاجز يبرود' : 'Checkpoint'}</span>
            <span>{isAr ? 'عين سينيا' : 'Ein Sinia'}</span>
            <span>{isAr ? 'الشيني' : 'Al Shini'}</span>
            <span>{isAr ? 'الفرندز' : 'Friends'}</span>
          </div>
        </div>

        {/* Live Detected Outcome Banner */}
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {isAr ? 'الموقع المُكتشف تلقائياً للسائق الحالي:' : 'Auto-detected Driver Location:'}
            </span>
            <p className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {isAr ? currentDriver?.currentStopAr : currentDriver?.currentStopEn}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">
              {currentDriver?.currentLocation?.lat.toFixed(4)}°, {currentDriver?.currentLocation?.lng.toFixed(4)}°
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {currentDriver?.isDetour ? (isAr ? 'تحويلة معتمدة' : 'Detour Detected') : (isAr ? 'على المسار الرئيسي' : 'On Corridor')}
            </span>
          </div>
        </div>
      </div>}
    </div>
  );
};
