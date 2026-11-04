import type { ArchivedTrip, Driver, GPSLocation, SeatRequest, TripLogEntry } from '../types';

type RecordValue = Record<string, unknown>;
type Guard<T> = (value: unknown) => value is T;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const id = (v: unknown) => text(v) && v.trim().length > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const time = (v: unknown) => finite(v) && v >= 0;
const count = (v: unknown) => finite(v) && Number.isInteger(v) && v >= 0;
const optional = (v: unknown, guard: (value: unknown) => boolean) => v === undefined || guard(v);
const bool = (v: unknown) => typeof v === 'boolean';
const oneOf = (v: unknown, values: readonly unknown[]) => values.includes(v);
const statuses = ['in_kufr_malik', 'to_ramallah', 'in_ramallah', 'to_kufr_malik', 'detour'];

export const isGPSLocation: Guard<GPSLocation> = (v): v is GPSLocation => record(v) &&
  finite(v.lat) && Math.abs(v.lat) <= 90 && finite(v.lng) && Math.abs(v.lng) <= 180 && time(v.timestamp) &&
  optional(v.accuracy, n => finite(n) && n >= 0) &&
  optional(v.heading, n => n === null || (finite(n) && n >= 0 && n <= 360)) &&
  optional(v.speed, n => n === null || (finite(n) && n >= 0));

export const isDriver: Guard<Driver> = (v): v is Driver => {
  if (!record(v)) return false;
  return id(v.id) && ['nameEn', 'nameAr', 'phone', 'pinCode', 'departureNoteEn', 'departureNoteAr',
    'currentStopEn', 'currentStopAr', 'proximityStatusEn', 'proximityStatusAr', 'detectedNodeId'].every(k => text(v[k])) &&
    text(v.lastUpdated) && Number.isFinite(Date.parse(v.lastUpdated)) &&
    ['isOnDuty', 'isLateShift', 'isDetour'].every(k => bool(v[k])) &&
    oneOf(v.status, statuses) && oneOf(v.gpsMode, ['live', 'simulation', 'idle']) &&
    count(v.maxCapacity) && (v.maxCapacity as number) > 0 && count(v.passengers) && (v.passengers as number) <= (v.maxCapacity as number) &&
    isGPSLocation(v.currentLocation) && optional(v.directionAnchor, isGPSLocation) && optional(v.dutyMovementAnchor, isGPSLocation) &&
    ['lastActiveTime', 'seatCountUpdatedAt', 'departureCountdownSetAt'].every(k => optional(v[k], time)) &&
    ['lastTripLabelEn', 'lastTripLabelAr', 'detourNameEn', 'detourNameAr'].every(k => optional(v[k], text)) &&
    optional(v.autoPausedForInactivity, bool) &&
    optional(v.prayerShift, n => oneOf(n, ['regular_day', 'after_maghrib', 'after_isha', 'final_trip'])) &&
    optional(v.departureCountdown, n => oneOf(n, [null, 'leaving_now', 'in_5_mins', 'in_10_mins'])) &&
    optional(v.bearing, n => oneOf(n, ['southbound', 'northbound', 'stationary']));
};

const passenger = (v: RecordValue) => id(v.id) && id(v.driverId) && text(v.passengerName) &&
  count(v.seatCount) && (v.seatCount as number) > 0 && optional(v.phone, text) && optional(v.isDemo, bool);
export const isSeatRequest: Guard<SeatRequest> = (v): v is SeatRequest => record(v) && passenger(v) &&
  time(v.timestamp) && oneOf(v.status, ['pending', 'accepted', 'declined']);
export const isTripLog: Guard<TripLogEntry> = (v): v is TripLogEntry => record(v) && passenger(v) &&
  time(v.confirmedAt) && v.status === 'confirmed';
export const isArchivedTrip: Guard<ArchivedTrip> = (v): v is ArchivedTrip => record(v) &&
  id(v.id) && id(v.driverId) && time(v.timestamp) && text(v.formattedDate) && count(v.passengersCount) &&
  oneOf(v.locationStatus, statuses) && optional(v.isDemo, bool) && validCollection(v.entries, isTripLog) !== null;

// Live snapshots are atomic: reject the whole message if any record or ID is bad.
export function validCollection<T extends { id: string }>(value: unknown, guard: Guard<T>): T[] | null {
  if (!Array.isArray(value) || !value.every(guard)) return null;
  return new Set(value.map(v => v.id)).size === value.length ? value : null;
}

// Storage recovery is read-only: retain valid records without rewriting the original.
export function readStoredCollection<T extends { id: string }>(
  key: string, guard: Guard<T>, storage?: Pick<Storage, 'getItem'>
): T[] {
  try {
    const raw = (storage ?? localStorage).getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((item): item is T => {
      if (!guard(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch { return []; }
}

export function restoreDrivers(storage?: Pick<Storage, 'getItem'>): Driver[] {
  const current = readStoredCollection('kufr_malik_transit_drivers_v8', isDriver, storage);
  const saved = current.length ? current : readStoredCollection('kufr_malik_transit_drivers_v7', isDriver, storage);
  return saved.map(d => ({ ...d,
    prayerShift: d.prayerShift ?? (d.isLateShift ? 'after_maghrib' : 'regular_day'),
    lastActiveTime: d.lastActiveTime ?? Date.parse(d.lastUpdated),
    autoPausedForInactivity: d.autoPausedForInactivity ?? false
  }));
}

export function readSyncMessage(value: unknown) {
  if (!record(value)) return null;
  const payload = value.payload;
  switch (value.type) {
    case 'UPDATE_DRIVERS': {
      const data = validCollection(payload, isDriver);
      return data?.length ? { type: 'UPDATE_DRIVERS' as const, payload: data } : null;
    }
    case 'UPDATE_REQUESTS': {
      const data = validCollection(payload, isSeatRequest);
      return data ? { type: 'UPDATE_REQUESTS' as const, payload: data } : null;
    }
    case 'UPDATE_TRIP_LOGS': {
      const data = validCollection(payload, isTripLog);
      return data ? { type: 'UPDATE_TRIP_LOGS' as const, payload: data } : null;
    }
    case 'UPDATE_TRIP_HISTORY': {
      const data = validCollection(payload, isArchivedTrip);
      return data ? { type: 'UPDATE_TRIP_HISTORY' as const, payload: data } : null;
    }
    case 'GPS_SIM_PROGRESS':
      return record(payload) && finite(payload.progress) && payload.progress >= 0 && payload.progress <= 100 && bool(payload.isDetour)
        ? { type: 'GPS_SIM_PROGRESS' as const, payload: { progress: payload.progress, isDetour: payload.isDetour as boolean } } : null;
    default: return null;
  }
}
