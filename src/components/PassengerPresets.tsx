import React from 'react';
import { passengerShortcuts } from '../utils/passengerCount';

export function PassengerPresets({ passengers, capacity, isAr, onSet, onFull }: {
  passengers: number; capacity: number; isAr: boolean; onSet(count: number): void; onFull(): void;
}) {
  return <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
    {passengerShortcuts(capacity).map(count => {
      const full = count === capacity;
      return <button key={count} type="button" aria-pressed={passengers === count}
        aria-label={full ? (isAr ? `تعيين السيارة مكتملة (${capacity} مقاعد)` : `Mark vehicle full (${capacity} seats)`)
          : (isAr ? `تعيين عدد الركاب إلى ${count}` : `Set passenger count to ${count}`)}
        onClick={() => full ? onFull() : onSet(count)}
        className={`min-h-11 rounded-xl font-mono text-xs font-black transition-all tap-highlight ${passengers === count
          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-600 shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}>
        {full ? (isAr ? 'مكتمل' : 'FULL') : count}
      </button>;
    })}
  </div>;
}
