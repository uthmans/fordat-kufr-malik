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

export type PublicationState = 'stopped' | 'offline' | 'gps_error' | 'waiting' | 'stale' | 'pending' | 'live' | 'off_duty';
// Compare passenger-facing operational settings. New GPS fixes are intentionally
// sent less often, so a newer local coordinate alone is not an unsaved operation.
function operations(driver: Driver | PublicDriver) {
  return JSON.stringify([driver.isOnDuty, driver.passengers, driver.maxCapacity, driver.seatCountUpdatedAt,
    driver.prayerShift, driver.isLateShift, driver.departureCountdown, driver.departureCountdownSetAt,
    driver.departureNoteEn, driver.departureNoteAr]);
}

export function publicationState(input: { driver: Driver; row?: SharedDriverRow; sharing: boolean;
  online: boolean; gpsError: boolean; lastPublished: string | null; now: number }): PublicationState {
  const { driver, row, sharing, online, gpsError, lastPublished, now } = input;
  if (!sharing) return 'stopped';
  if (!online) return 'offline';
  if (gpsError) return 'gps_error';
  if (!row || row.driver_id !== driver.id || !lastPublished || lastPublished !== row.received_at) return 'waiting';
  if (!hasRecentSharedReport(row, now)) return 'stale';
  if (operations(driver) !== operations(row.snapshot)) return 'pending';
  if (!driver.isOnDuty) return 'off_duty';
  return hasRecentGPS(driver, now) && isSharedDriverActive(row, now) ? 'live' : 'stale';
}
