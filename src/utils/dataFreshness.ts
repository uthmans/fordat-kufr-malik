import type { Driver, SeatRequest, TripLogEntry, ArchivedTrip } from '../types';

export const GPS_FRESH_MS = 2 * 60 * 1000;
export const SEATS_FRESH_MS = 10 * 60 * 1000;
const recent = (timestamp: number | undefined, now: number, maxAge: number) =>
  typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now && now - timestamp < maxAge;

export const isDemoDriver = (driver: Driver) => driver.gpsMode !== 'live';
export const hasRecentGPS = (driver: Driver, now: number) => !isDemoDriver(driver) && recent(driver.currentLocation?.timestamp, now, GPS_FRESH_MS);
export const hasRecentSeatCount = (driver: Driver, now: number) => recent(driver.seatCountUpdatedAt, now, SEATS_FRESH_MS) && Number.isInteger(driver.maxCapacity) && driver.maxCapacity > 0 &&
  Number.isInteger(driver.passengers) && driver.passengers >= 0 && driver.passengers <= driver.maxCapacity;
export const hasConfirmedSeats = (driver: Driver, now: number) => driver.isOnDuty && hasRecentGPS(driver, now) && hasRecentSeatCount(driver, now);
export const isDemoRequest = (request: SeatRequest) => request.isDemo === true || request.id.startsWith('req-sample-');
export const isDemoLog = (entry: TripLogEntry) => entry.isDemo === true || entry.id === 'log-1' || entry.id === 'log-2' || entry.id.startsWith('booking-req-sample-');
export const isDemoArchive = (trip: ArchivedTrip) => trip.isDemo === true || trip.id === 'arch-1';
