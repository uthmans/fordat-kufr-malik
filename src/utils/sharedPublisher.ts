import type { Driver } from '../types';
import { toPublicDriver, type PublicDriver, type SharedDriverRow } from './sharedDriver';
import { PublicationError } from './publicationError';

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
  private needsRecovery = false;
  private retryAt = 0;
  private failures = 0;
  private attempted: PublicDriver | null = null;
  constructor(private send: (snapshot: PublicDriver, revision: number | null, signal: AbortSignal) => Promise<SharedDriverRow>,
    private onSaved: (row: SharedDriverRow) => void,
    private onError: (error: unknown) => void,
    private now = Date.now,
    private recovery?: {
      read: (owner: string, signal: AbortSignal) => Promise<SharedDriverRow | null>;
      onWaiting: (waiting: boolean) => void;
    }) {}

  start(owner: string, row: SharedDriverRow | null) {
    this.stop();
    this.owner = owner;
    this.revision = row?.revision ?? null;
    // Postgres JSONB key order differs from the browser's insertion order.
    this.previous = row ? toPublicDriver({ ...row.snapshot, pinCode: '' }) : null;
    this.lastSent = -Infinity;
    this.needsRecovery = false; this.retryAt = 0; this.failures = 0; this.attempted = null;
  }

  stop() {
    this.generation++;
    this.owner = null;
    this.pending = null;
    this.abort?.abort();
    this.abort = null;
    this.busy = false;
    this.recovery?.onWaiting(false);
  }

  // Keep sharing consent and the latest local state; never restart after stop().
  reconnect() {
    if (!this.owner || !this.recovery) return;
    this.needsRecovery = true; this.retryAt = 0;
    this.recovery.onWaiting(true);
  }

  queue(driver: Driver) {
    if (driver.id !== this.owner) return;
    this.pending = driver;
  }

  async flush() {
    if (this.busy || !this.owner || (!this.pending && !this.needsRecovery) || this.now() < this.retryAt) return;
    const generation = this.generation;
    this.busy = true;
    this.abort = new AbortController();
    try {
      if (this.needsRecovery) {
        const row = await this.recovery!.read(this.owner, this.abort.signal);
        if (generation !== this.generation) return;
        if (row && (row.driver_id !== this.owner || row.snapshot.id !== this.owner)) throw new PublicationError('invalid_request');
        if ((row?.revision ?? null) !== this.revision) {
          // A timeout may mean the server committed but its reply was lost.
          const matchesAttempt = row && this.attempted && JSON.stringify(toPublicDriver({ ...row.snapshot, pinCode: '' })) === JSON.stringify(this.attempted);
          if (!matchesAttempt) throw new PublicationError('conflict', row ?? undefined);
          this.revision = row!.revision; this.previous = toPublicDriver({ ...row!.snapshot, pinCode: '' });
          this.onSaved(row!);
        }
        this.needsRecovery = false;
      }
      // Read AFTER reconciliation: GPS or passenger count may change during it.
      const pending = this.pending;
      if (!pending) { this.recovery?.onWaiting(false); return; }
      const snapshot = publishableDriver(pending, this.now());
      if (!snapshot) { this.recovery?.onWaiting(false); return; }
      if (JSON.stringify(snapshot) === JSON.stringify(this.previous)) {
        this.pending = null; this.failures = 0; this.recovery?.onWaiting(false); return;
      }
      if (this.previous && operations(snapshot) === operations(this.previous) &&
          this.now() - this.lastSent < SHARED_GPS_INTERVAL_MS) return;
      this.attempted = snapshot;
      const row = await this.send(snapshot, this.revision, this.abort.signal);
      if (generation !== this.generation) return;
      this.revision = row.revision;
      this.previous = snapshot;
      this.lastSent = this.now();
      if (this.pending === pending) this.pending = null;
      this.onSaved(row);
      this.failures = 0; this.recovery?.onWaiting(false);
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.recovery && (!(error instanceof PublicationError) || error.kind === 'retryable' || (error.kind === 'conflict' && !error.row && !this.needsRecovery))) {
        this.needsRecovery = true;
        this.retryAt = this.now() + Math.min(60_000, 2000 * 2 ** Math.min(this.failures++, 5));
        this.recovery.onWaiting(true);
        return;
      }
      // A competing revision, revoked sign-in or malformed request needs attention.
      this.stop();
      this.onError(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
}
