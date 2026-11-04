import React from 'react';
import { Zap } from 'lucide-react';
import type { Driver } from '../types';
import { DEPARTURE_COUNTDOWN_CONFIGS } from '../data/initialDrivers';
import { getDepartureAnnouncement, departureAnnouncementLabel } from '../utils/departureAnnouncement';

export function DepartureAnnouncement({ driver, now, isAr }: { driver: Driver; now: number; isAr: boolean }) {
  const announcement = getDepartureAnnouncement(driver, now);
  if (!announcement) return null;
  return <div role="status" className={`p-2.5 rounded-2xl flex flex-wrap items-center justify-between text-xs font-black gap-2 ${DEPARTURE_COUNTDOWN_CONFIGS[announcement.key].pillBg}`}>
    <div className="flex items-center gap-2 min-w-0">
      <Zap size={16} className="shrink-0" />
      <span>{departureAnnouncementLabel(announcement, isAr)}</span>
    </div>
    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-black/20 text-white">
      {isAr ? 'تنبيه من السائق' : 'Driver announcement'}
    </span>
  </div>;
}
