import React, { useState } from 'react';
import { bookingAcceptanceError, bookingAcceptanceLabel } from '../utils/bookingAcceptance';
import { isDemoRequest } from '../utils/dataFreshness';
import { useTransit } from '../context/TransitContext';
import { SeatRequest } from '../types';
import { PhoneDisplay } from './PhoneDisplay';
import { Check, X, Users, Clock, UserCheck } from 'lucide-react';

interface SeatRequestsListProps {
  driverId: string;
}

export const SeatRequestsList: React.FC<SeatRequestsListProps> = ({ driverId }) => {
  const { seatRequests, acceptSeatRequest, declineSeatRequest, language, currentDriver } = useTransit();
  const isAr = language === 'ar';
  const [actionError, setActionError] = useState<'accept' | 'decline' | null>(null);

  const relevantRequests = seatRequests.filter((r) => r.driverId === driverId);
  const pendingRequests = relevantRequests.filter((r) => r.status === 'pending');
  const pastRequests = relevantRequests.filter((r) => r.status !== 'pending').slice(0, 3);

  const formatAgo = (timestamp: number) => {
    const min = Math.floor((Date.now() - timestamp) / 60000);
    if (min < 1) return isAr ? 'الآن' : 'just now';
    return isAr ? `قبل ${min} د` : `${min}m ago`;
  };

  const isFull = !!currentDriver && currentDriver.passengers >= currentDriver.maxCapacity;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <UserCheck size={18} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
              <span>{isAr ? 'طلبات الحجز على هذا الجهاز' : 'Booking requests on this device'}</span>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.2 rounded-full bg-rose-600 text-white text-[11px] font-black">
                  {pendingRequests.length} {isAr ? 'جديد' : 'new'}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'حجوزات الركاب من أهالي كفر مالك' : 'Passenger seat bookings from villagers'}
            </p>
          </div>
        </div>

        {isFull && (
          <span className="px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold shrink-0">
            {isAr ? 'مكتمل' : 'FULL'}
          </span>
        )}
      </div>

      {actionError && <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">{actionError === 'decline'
        ? (isAr ? 'تعذر رفض الطلب. ربما تمت معالجته أو تغيّر السائق المسجل.' : 'Could not decline this request. It may already be handled, or the signed-in driver has changed.')
        : (isAr ? 'تعذر قبول الطلب. تحقق من حالة الدوام والمقاعد المتاحة وحالة الطلب.' : 'Could not accept this request. Check duty status, available seats and request status.')}</p>}

      {/* Pending Requests List */}
      {pendingRequests.length === 0 ? (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isAr
              ? 'لا توجد طلبات معلقة محفوظة على هذا الجهاز'
              : 'No pending requests saved on this device'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map((req) => {
            const error = bookingAcceptanceError(req, currentDriver);
            return (
            <div
              key={req.id}
              className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border-2 border-amber-500/40 space-y-3 shadow-xs animate-in slide-in-from-top-2 duration-150"
            >
              {/* Passenger Name & Seats */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span>{req.passengerName}</span>
                    {isDemoRequest(req) && <span className="text-[10px] text-amber-700 dark:text-amber-400">{isAr ? 'طلب تجريبي' : 'Demo request'}</span>}
                  </h4>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[11px] font-mono">
                      {req.seatCount} {isAr ? (req.seatCount === 1 ? 'مقعد' : 'مقاعد') : (req.seatCount === 1 ? 'seat' : 'seats')}
                    </span>
                    {req.phone && (
                      <>
                        <span>·</span>
                        <PhoneDisplay phone={req.phone} className="text-[11px]" />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                  <Clock size={11} />
                  <span>{formatAgo(req.timestamp)}</span>
                </div>
              </div>

              {/* 1-Tap Accept / Decline Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActionError(acceptSeatRequest(req.id) ? null : 'accept')}
                  disabled={!!error}
                  className={`min-h-[48px] rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all tap-highlight ${
                    error
                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white ring-2 ring-emerald-500'
                  }`}
                >
                  <Check size={18} strokeWidth={3} />
                  <span>{bookingAcceptanceLabel(error, isAr)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionError(declineSeatRequest(req.id) ? null : 'decline')}
                  className="min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all tap-highlight"
                >
                  <X size={18} strokeWidth={3} />
                  <span>{isAr ? 'اعتذار' : 'Decline'}</span>
                </button>
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
};
