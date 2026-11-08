import React from 'react';
import { DEPARTURE_COUNTDOWN_CONFIGS } from '../data/initialDrivers';
import type { DepartureCountdown } from '../types';

export function DepartureButtons({ selected, onDuty, isAr, onChange }: {
  selected: DepartureCountdown; onDuty: boolean; isAr: boolean;
  onChange: (value: DepartureCountdown) => void;
}) {
  return <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
    {(['in_10_mins', 'in_5_mins', 'leaving_now'] as const).map(option => {
      const config = DEPARTURE_COUNTDOWN_CONFIGS[option];
      const active = selected === option;
      return <button key={option} type="button" disabled={!onDuty} aria-pressed={active}
        onClick={() => onChange(active ? null : option)}
        className={`min-w-0 min-h-12 p-3 rounded-2xl font-bold text-xs leading-relaxed flex items-center justify-center gap-2 border-2 transition-colors disabled:opacity-50 ${active
          ? `${config.pillBg} border-amber-500`
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'}`}>
        <span aria-hidden="true" className={`w-2 h-2 shrink-0 rounded-full ${active ? config.dotColor : 'bg-slate-400'}`} />
        <span className="min-w-0 whitespace-normal break-words">{config[isAr ? 'labelAr' : 'labelEn']}</span>
      </button>;
    })}
  </div>;
}
