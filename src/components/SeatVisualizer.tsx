import React from 'react';
import { User, ShieldAlert } from 'lucide-react';

interface SeatVisualizerProps {
  passengers: number;
  maxCapacity?: number;
  interactive?: boolean;
  onSeatClick?: (seatIndex: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const SeatVisualizer: React.FC<SeatVisualizerProps> = ({
  passengers,
  maxCapacity = 7,
  interactive = false,
  onSeatClick,
  size = 'md'
}) => {
  const seats = Array.from({ length: maxCapacity }, (_, i) => i < passengers);

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-12 w-12 text-base'
  }[size];

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24
  }[size];

  return (
    <div className="flex flex-col gap-1.5">
      {/* Visual van layout: Driver in front + 7 passenger seats */}
      <div className="inline-flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Front row: Driver (Fixed) + Front Passenger */}
        <div
          title="Driver Seat"
          className={`${sizeClasses} rounded-lg bg-slate-700 text-amber-300 flex items-center justify-center font-bold shadow-sm select-none`}
        >
          <span className="text-[10px] uppercase font-mono">D</span>
        </div>

        <div className="w-[1px] h-6 bg-slate-300 dark:bg-slate-600 mx-0.5" />

        {/* 7 Passenger Seats */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {seats.map((isOccupied, index) => (
            <button
              key={index}
              type="button"
              disabled={!interactive}
              onClick={() => onSeatClick && onSeatClick(index)}
              className={`
                ${sizeClasses} rounded-lg font-bold flex items-center justify-center transition-all duration-150
                ${interactive ? 'cursor-pointer active:scale-95 hover:opacity-90' : 'cursor-default'}
                ${
                  isOccupied
                    ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600'
                    : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-600'
                }
              `}
              title={`Seat #${index + 1}: ${isOccupied ? 'Occupied' : 'Vacant'}`}
            >
              {isOccupied ? (
                <User size={iconSizes} strokeWidth={2.5} className="fill-slate-900/40" />
              ) : (
                <span className="font-mono text-xs">{index + 1}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
