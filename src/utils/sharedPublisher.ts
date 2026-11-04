import type { Driver } from '../types';
import { toPublicDriver, type PublicDriver, type SharedDriverRow } from './sharedDriver';

export const SHARED_GPS_INTERVAL_MS = 60_000;

export function publishableDriver(driver: Driver, now: number): PublicDriver | null {
  // Simulation and old fixes must never become shared live locations.
  if (driver.gpsMode === 'simulation') return null;
  const snapshot = toPublicDriver(driver);
  if (!driver.isOnDuty) {
    snapshot.currentLocation = { lat: 0, lng: 0, timestamp: 0 };
    snapshot.gpsMode = 'idle';
    snapshot.bearing = 'stationary';
  } else if (driver.gpsMode !== 'live' || driver.currentLocation.timestamp > now ||
    now - driver.currentLocation.timestamp >= 120_000) return null;
  return snapshot;
}

// Operational changes bypass the GPS interval; location-only updates are capped.
function operations(snapshot: PublicDriver) {
  const { currentLocation, lastUpdated, lastActiveTime, proximityStatusEn, proximityStatusAr,
    currentStopEn, currentStopAr, detectedNodeId, bearing, ...rest } = snapshot;
  return JSON.stringify(rest);
}

export class SharedPublisher {
  private generation = 0;
  private owner: string | null = null;
  private revision: number | null = null;
  private previous: PublicDriver | null = null;
  private lastSent = -Infinity;
  private pending: Driver | null = null;
  private busy = false;
  private abort: AbortController | null = null;
  constructor(private send: (snapshot: PublicDriver, revision: number | null, signal: AbortSignal) => Promise<SharedDriverRow>,
    private onSaved: (row: SharedDriverRow) => void,
    private onError: (error: unknown) => void,
    private now = Date.now) {}

  start(owner: string, row: SharedDriverRow | null) {
    this.stop();
    this.owner = owner;
    this.revision = row?.revision ?? null;
    // Postgres JSONB key order differs from the browser's insertion order.
    this.previous = row ? toPublicDriver({ ...row.snapshot, pinCode: '' }) : null;
    this.lastSent = -Infinity;
  }

  stop() {
    this.generation++;
    this.owner = null;
    this.pending = null;
    this.abort?.abort();
    this.abort = null;
    this.busy = false;
  }

  queue(driver: Driver) {
    if (driver.id !== this.owner) return;
    this.pending = driver;
  }

  async flush() {
    if (this.busy || !this.pending || !this.owner) return;
    const snapshot = publishableDriver(this.pending, this.now());
    if (!snapshot) return;
    if (JSON.stringify(snapshot) === JSON.stringify(this.previous)) { this.pending = null; return; }
    if (this.previous && operations(snapshot) === operations(this.previous) &&
        this.now() - this.lastSent < SHARED_GPS_INTERVAL_MS) return;
    const generation = this.generation;
    const pending = this.pending;
    this.busy = true;
    this.abort = new AbortController();
    try {
      const row = await this.send(snapshot, this.revision, this.abort.signal);
      if (generation !== this.generation) return;
      this.revision = row.revision;
      this.previous = snapshot;
      this.lastSent = this.now();
      if (this.pending === pending) this.pending = null;
      this.onSaved(row);
    } catch (error) {
      if (generation !== this.generation) return;
      // Do not automatically replay a stale snapshot after a conflict or timeout.
      // Reconnect explicitly reloads the server row before publishing resumes.
      this.stop();
      this.onError(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
}
