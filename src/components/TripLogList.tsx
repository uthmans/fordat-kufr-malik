import React from 'react';
import { useTransit } from '../context/TransitContext';
import { buildDriverConfirmationUrl } from '../utils/whatsapp';
import { PhoneDisplay } from './PhoneDisplay';
import { CheckCircle2, MessageSquare, Archive, Users, Building2, MapPin } from 'lucide-react';

interface TripLogListProps {
  driverId: string;
}

export const TripLogList: React.FC<TripLogListProps> = ({ driverId }) => {
  const { tripLogs, archiveCurrentTrip, language, drivers } = useTransit();
  const isAr = language === 'ar';

  const driver = drivers.find((d) => d.id === driverId);
  const driverLogs = tripLogs.filter((l) => l.driverId === driverId);

  const formatAgo = (timestamp: number) => {
    const min = Math.floor((Date.now() - timestamp) / 60000);
    if (min < 1) return isAr ? 'الآن' : 'just now';
    return isAr ? `قبل ${min} د` : `${min}m ago`;
  };

  const totalConfirmedSeats = driverLogs.reduce((acc, l) => acc + l.seatCount, 0);
  const activePassengers = driver?.passengers ?? totalConfirmedSeats;
  const maxCapacity = driver?.maxCapacity ?? 7;
  const isVanInRamallah = driver?.status === 'in_ramallah';

  const handleArchiveAndClear = () => {
    archiveCurrentTrip(driverId);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            {isVanInRamallah ? <Building2 size={18} /> : <CheckCircle2 size={18} />}
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{isAr ? 'سجل الرحلة الحالية' : 'Current Trip Log'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black font-mono">
                {activePassengers} / {maxCapacity} {isAr ? 'ركاب' : 'seats'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {isVanInRamallah
                ? isAr
                  ? 'الموقف — الركاب يلتقون بالسائق في الموقف'
                  : 'Ramallah — Passengers board at station'
                : isAr
                ? 'كفر مالك — أسماء الركاب ومواقع التوصيل من البيوت'
                : 'Kufr Malik — House pickups & passenger roster'}
            </p>
          </div>
        </div>

        {/* Clear Log & Archive Button */}
        {(driverLogs.length > 0 || activePassengers > 0) && (
          <button
            type="button"
            onClick={handleArchiveAndClear}
            className="py-1.5 px-3 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center gap-1.5 transition-colors active:scale-95 tap-highlight"
            title={isAr ? 'حفظ الرحلة في الأرشيف وبدء رحلة جديدة' : 'Archive Trip & Reset Log'}
          >
            <Archive size={13} />
            <span className="text-[11px]">{isAr ? 'أرشفة وبدء رحلة جديدة' : 'Archive & New Trip'}</span>
          </button>
        )}
      </div>

      {/* Conditional Rendering: Ramallah Mode vs Kufr Malik Mode */}
      {isVanInRamallah ? (
        // RAMALLAH MODE: Disable passenger names; show live vacancy count only
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <Building2 size={16} className="shrink-0" />
            <span>
              {isAr
                ? 'في الموقف: لا يلزم تسجيل الأسماء الفردية'
                : 'In Ramallah: No individual house pickup list'}
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-3 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-amber-600" />
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {isAr ? 'حالة الشواغر في السيارة' : 'Live Vehicle Vacancy'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {maxCapacity - activePassengers > 0
                    ? isAr
                      ? `متبقي ${maxCapacity - activePassengers} مقاعد للتحميل`
                      : `${maxCapacity - activePassengers} seats remaining`
                    : isAr
                    ? 'السيارة مكتملة'
                    : 'Van is FULL'}
                </p>
              </div>
            </div>

            <div className="text-right rtl:text-left">
              <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {activePassengers} / {maxCapacity}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isAr
              ? 'الركاب في الموقف يتجمعون مباشرة عند كراج كفر مالك، وتحديث العداد يظهر فوراً لأهل البلد.'
              : 'Villagers in Ramallah board directly at the station stand. Use seat buttons to update vacancies.'}
          </p>
        </div>
      ) : (
        // KUFR MALIK / ROAD MODE: Show individual passenger names for house pickup
        <>
          {driverLogs.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isAr
                  ? 'السجل فارغ — الحجوزات المقبولة من كفر مالك ستظهر هنا مع خيار الرد بواتساب'
                  : 'Trip log is empty — accepted village bookings will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <MapPin size={12} className="text-emerald-500" />
                <span>
                  {isAr
                    ? 'طلبات الركوب من البيوت في كفر مالك:'
                    : 'House pickup roster in Kufr Malik:'}
                </span>
              </div>

              {driverLogs.map((entry) => {
                const confirmationUrl = entry.phone
                  ? buildDriverConfirmationUrl(entry.phone, isAr)
                  : null;

                return (
                  <div
                    key={entry.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    {/* Passenger Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">
                          {entry.passengerName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-[11px] font-mono shrink-0">
                          {entry.seatCount} {isAr ? 'مقاعد' : 'seats'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                          {isAr ? 'مؤكد' : 'Confirmed'}
                        </span>
                      </div>

                      {/* Time & Phone */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {entry.phone && (
                          <>
                            <PhoneDisplay phone={entry.phone} className="text-[11px]" />
                            <span>·</span>
                          </>
                        )}
                        <span className="font-mono text-[10px] shrink-0">{formatAgo(entry.confirmedAt)}</span>
                      </div>
                    </div>

                    {/* 1-Tap WhatsApp Quick-Reply Confirmation */}
                    {entry.phone ? (
                      <a
                        href={confirmationUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-all tap-highlight"
                        title={isAr ? 'إرسال تأكيد عبر واتساب' : 'Reply via WhatsApp'}
                      >
                        <MessageSquare size={14} className="fill-white" />
                        <span className="hidden sm:inline">{isAr ? 'واتساب' : 'WhatsApp'}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {isAr ? 'حجز مسجل' : 'Logged'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
