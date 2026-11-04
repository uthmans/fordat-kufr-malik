import type { Driver, GPSLocation } from '../types';
import { isDriver } from './transitData';

// The public feed is a separate contract, never a serialized local roster.
export const PUBLIC_DRIVER_FIELDS = [
  'id', 'nameEn', 'nameAr', 'phone', 'isOnDuty', 'isLateShift', 'prayerShift',
  'departureCountdown', 'departureCountdownSetAt', 'lastActiveTime',
  'autoPausedForInactivity', 'lastTripLabelEn', 'lastTripLabelAr', 'status',
  'passengers', 'seatCountUpdatedAt', 'maxCapacity', 'lastUpdated',
  'departureNoteEn', 'departureNoteAr', 'currentStopEn', 'currentStopAr',
  'proximityStatusEn', 'proximityStatusAr', 'currentLocation', 'detectedNodeId',
  'isDetour', 'detourNameEn', 'detourNameAr', 'gpsMode', 'bearing'
] as const satisfies readonly (keyof Driver)[];

export type PublicDriver = Pick<Driver, typeof PUBLIC_DRIVER_FIELDS[number]>;
const GPS_FIELDS = ['lat', 'lng', 'accuracy', 'heading', 'speed', 'timestamp'] as const;
const allowed = new Set<string>(PUBLIC_DRIVER_FIELDS);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function publicLocation(location: GPSLocation): GPSLocation {
  return Object.fromEntries(GPS_FIELDS.filter(key => location[key] !== undefined)
    .map(key => [key, location[key]])) as unknown as GPSLocation;
}

export function toPublicDriver(driver: Driver): PublicDriver {
  const result = Object.fromEntries(PUBLIC_DRIVER_FIELDS
    .filter(key => driver[key] !== undefined).map(key => [key, driver[key]])) as PublicDriver;
  result.currentLocation = publicLocation(driver.currentLocation);
  return result;
}

export function isPublicDriver(value: unknown): value is PublicDriver {
  if (!record(value) || Object.keys(value).some(key => !allowed.has(key))) return false;
  if (!record(value.currentLocation) || Object.keys(value.currentLocation)
    .some(key => !(GPS_FIELDS as readonly string[]).includes(key))) return false;
  // Local validation also checks counters, timestamps, coordinates and enums.
  // A dummy private field is used only for validation, never added to the feed.
  return isDriver({ ...value, pinCode: '' });
}

export interface SharedDriverRow {
  driver_id: string;
  revision: number;
  received_at: string;
  snapshot: PublicDriver;
}

export function readSharedDriverRow(value: unknown): SharedDriverRow | null {
  if (!record(value) || typeof value.driver_id !== 'string' ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
      typeof value.received_at !== 'string' || !Number.isFinite(Date.parse(value.received_at)) ||
      !isPublicDriver(value.snapshot) || value.driver_id !== value.snapshot.id) return null;
  return { driver_id: value.driver_id, revision: value.revision as number,
    received_at: value.received_at, snapshot: value.snapshot };
}

// Revision comes from the database, not phone clocks. Late network responses
// must not replace a newer snapshot, including after reconnecting.
export function mergeSharedDriverRows(current: readonly SharedDriverRow[], incoming: unknown): SharedDriverRow[] | null {
  if (!Array.isArray(incoming)) return null;
  const parsed = incoming.map(readSharedDriverRow);
  if (parsed.some(row => !row)) return null;
  const rows = parsed as SharedDriverRow[];
  if (new Set(rows.map(row => row.driver_id)).size !== rows.length) return null;
  const latest = new Map(current.map(row => [row.driver_id, row]));
  for (const row of rows) {
    if (row.revision > (latest.get(row.driver_id)?.revision ?? 0)) latest.set(row.driver_id, row);
  }
  return [...latest.values()];
}
