import React, { useState, useEffect } from 'react';
import { Wifi, Signal, BatteryCharging, Radio } from 'lucide-react';
import { useTransit } from '../context/TransitContext';

export const StatusBar: React.FC = () => {
  const [timeStr, setTimeStr] = useState('');
  const { isTrackingRealGPS, isSimulatingGPS, language } = useTransit();
  const isAr = language === 'ar';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-slate-950 text-slate-200 px-5 pt-2 pb-1.5 flex items-center justify-between text-xs select-none border-b border-slate-900 shrink-0">
      {/* Time & Carrier */}
      <div className="flex items-center gap-2">
        <span className="font-bold tracking-tight font-mono">{timeStr}</span>
        <span className="text-[10px] text-slate-400 font-medium">Jawwal 4G</span>
      </div>

      {/* Live GPS indicator in Status Bar */}
      <div className="flex items-center gap-1.5">
        {isTrackingRealGPS ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
            <Radio size={10} className="animate-pulse" />
            <span>{isAr ? 'GPS مباشر' : 'GPS LIVE'}</span>
          </div>
        ) : isSimulatingGPS ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-400 text-[10px] font-mono">
            <Radio size={10} />
            <span>{isAr ? 'GPS محاكاة' : 'GPS SIM'}</span>
          </div>
        ) : null}

        {/* Battery & Network signals */}
        <div className="flex items-center gap-2 text-slate-400">
          <Wifi size={12} />
          <Signal size={12} />
          <div className="flex items-center gap-0.5 text-[11px] font-mono">
            <span>98%</span>
            <BatteryCharging size={13} className="text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
