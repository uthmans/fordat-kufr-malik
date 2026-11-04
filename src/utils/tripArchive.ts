import type { ArchivedTrip, Driver, TripLogEntry } from '../types';
import { isDemoLog } from './dataFreshness';

export interface TripArchiveState {
  drivers: Driver[];
  logs: TripLogEntry[];
  history: ArchivedTrip[];
}

export function archiveTrip(
  state: TripArchiveState, driverId: string, now: number,
  archiveId: string, formattedDate: string, includeDemo: boolean
): TripArchiveState | null {
  const driver = state.drivers.find(d => d.id === driverId);
  if (!driver || !Number.isFinite(now) || now <= 0 || !archiveId || state.history.some(t => t.id === archiveId)) return null;
  if (!Number.isInteger(driver.passengers) || driver.passengers < 0) return null;
  const entries = state.logs.filter(l => l.driverId === driverId && (includeDemo || !isDemoLog(l)));
  if (entries.some(e => !Number.isInteger(e.seatCount) || e.seatCount < 1)) return null;
  if (!entries.length && driver.passengers === 0) return null;
  // This is the trip's recorded total, which can exceed simultaneous occupancy
  // when passengers board and leave along the route. Never truncate the log.
  const passengersCount = entries.length
    ? entries.reduce((sum, entry) => sum + entry.seatCount, 0)
    : driver.passengers;
  if (!Number.isSafeInteger(passengersCount)) return null;
  const trip: ArchivedTrip = {
    id: archiveId, driverId, timestamp: now, formattedDate, passengersCount,
    locationStatus: driver.status, entries, isDemo: entries.some(isDemoLog)
  };
  return {
    history: [trip, ...state.history],
    logs: state.logs.filter(l => l.driverId !== driverId),
    drivers: state.drivers.map(d => d.id === driverId ? {
      ...d, passengers: 0, seatCountUpdatedAt: now, lastActiveTime: now,
      autoPausedForInactivity: false, lastUpdated: new Date(now).toISOString(),
      departureCountdown: null, departureCountdownSetAt: undefined
    } : d)
  };
}
