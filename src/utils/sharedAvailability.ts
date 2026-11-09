import type { Driver } from '../types';
import type { PublicDriver, SharedDriverRow } from './sharedDriver';
import { GPS_FRESH_MS, hasRecentGPS } from './dataFreshness';

export function hasRecentSharedReport(row: SharedDriverRow | undefined, now: number): boolean {
  if (!row) return false;
  const received = Date.parse(row.received_at);
  return Number.isFinite(received) && received > 0 && received <= now && now - received < GPS_FRESH_MS;
}

export function isSharedDriverActive(row: SharedDriverRow | undefined, now: number): boolean {
  return !!row && hasRecentSharedReport(row, now) && row.snapshot.isOnDuty && hasRecentGPS(row.snapshot as Driver, now);
}

// A last report is history, never evidence of current duty or availability.
// Off-duty reports deliberately clear coordinates and must not retain a marker.
export function hasLastSharedLocation(row: SharedDriverRow | undefined, now: number): boolean {
  if (!row || !row.snapshot.isOnDuty || row.snapshot.gpsMode !== 'live') return false;
  const timestamp = row.snapshot.currentLocation.timestamp;
  const received = Date.parse(row.received_at);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now &&
    Number.isFinite(received) && received > 0 && received <= now;
}

export function formatLastSeen(timestamp: number, now: number, isAr: boolean): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now) return isAr ? 'لا يوجد موقع مُبلغ عنه' : 'No reported location';
  const minutes = Math.floor((now - timestamp) / 60_000);
  const unit = minutes >= 1440 ? 'day' : minutes >= 60 ? 'hour' : 'minute';
  const amount = unit === 'day' ? Math.floor(minutes / 1440) : unit === 'hour' ? Math.floor(minutes / 60) : minutes;
  const relative = new Intl.RelativeTimeFormat(isAr ? 'ar' : 'en', { numeric: 'auto' }).format(-amount, unit);
  return isAr ? `آخر ظهور: ${relative}` : `Last seen ${relative}`;
}

export type PublicationState = 'stopped' | 'offline' | 'recovering' | 'gps_error' | 'waiting' | 'stale' | 'pending' | 'live' | 'off_duty';
// Compare passenger-facing operational settings. New GPS fixes are intentionally
// sent less often, so a newer local coordinate alone is not an unsaved operation.
function operations(driver: Driver | PublicDriver) {
  return JSON.stringify([driver.isOnDuty, driver.passengers, driver.maxCapacity, driver.seatCountUpdatedAt,
    driver.prayerShift, driver.isLateShift, driver.departureCountdown, driver.departureCountdownSetAt,
    driver.departureNoteEn, driver.departureNoteAr]);
}

export function publicationState(input: { driver: Driver; row?: SharedDriverRow; sharing: boolean;
  online: boolean; gpsError: boolean; recovering?: boolean; lastPublished: string | null; now: number }): PublicationState {
  const { driver, row, sharing, online, gpsError, lastPublished, now } = input;
  if (!sharing) return 'stopped';
  if (!online) return 'offline';
  if (gpsError) return 'gps_error';
  if (input.recovering) return 'recovering';
  if (!row || row.driver_id !== driver.id || !lastPublished || lastPublished !== row.received_at) return 'waiting';
  if (!hasRecentSharedReport(row, now)) return 'stale';
  if (operations(driver) !== operations(row.snapshot)) return 'pending';
  if (!driver.isOnDuty) return 'off_duty';
  return hasRecentGPS(driver, now) && isSharedDriverActive(row, now) ? 'live' : 'stale';
}
