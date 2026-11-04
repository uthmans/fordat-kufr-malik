import type { Driver } from '../types';

type DepartureDriver = Pick<Driver, 'isOnDuty' | 'departureCountdown' | 'departureCountdownSetAt'>;

// A timer expresses the driver's intent; expiry is not evidence of departure.
export function getDepartureAnnouncement(driver: DepartureDriver, now: number) {
  const key = driver.departureCountdown;
  const started = driver.departureCountdownSetAt;
  if (!driver.isOnDuty || !Number.isFinite(now) || typeof started !== 'number' ||
      !Number.isFinite(started) || started <= 0 || started > now) return null;
  let duration: number;
  switch (key) {
    case 'in_10_mins': duration = 10 * 60_000; break;
    case 'in_5_mins': duration = 5 * 60_000; break;
    case 'leaving_now': duration = 2 * 60_000; break;
    default: return null;
  }
  const remaining = duration - (now - started);
  if (remaining <= 0) return null;
  return { key, minutes: Math.ceil(remaining / 60_000) };
}

export function departureAnnouncementLabel(announcement: NonNullable<ReturnType<typeof getDepartureAnnouncement>>, isAr: boolean) {
  if (announcement.key === 'leaving_now') return isAr ? 'طالع الآن' : 'Leaving now';
  const minutes = announcement.minutes;
  if (!isAr) return `Departing in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  if (minutes === 1) return 'طالع بعد دقيقة واحدة';
  if (minutes === 2) return 'طالع بعد دقيقتين';
  return `طالع بعد ${minutes} دقائق`;
}
