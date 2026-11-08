import type { Driver } from '../types';
import type { PublicDriver, SharedDriverRow } from './sharedDriver';

const SETTINGS = ['isOnDuty', 'passengers', 'maxCapacity', 'seatCountUpdatedAt', 'autoPausedForInactivity',
  'prayerShift', 'isLateShift', 'departureCountdown', 'departureCountdownSetAt',
  'departureNoteEn', 'departureNoteAr', 'lastTripLabelEn', 'lastTripLabelAr'] as const;

export function sharingSettingsSignature(driver: Driver | PublicDriver): string {
  return JSON.stringify(SETTINGS.map(field => driver[field] ?? null));
}

export type SharingResolution = { driverId: string; choice: 'phone' | 'published'; revision: number; localSignature: string };
export type SharingConflict = { local: Driver; published: SharedDriverRow };
export type SharingPlan = { kind: 'ready'; driver: Driver } | { kind: 'conflict'; conflict: SharingConflict } | { kind: 'invalid' };

export function planSharingStart(local: Driver, row: SharedDriverRow | null, resolution?: SharingResolution): SharingPlan {
  if (!row) return { kind: 'ready', driver: local };
  if (row.driver_id !== local.id || row.snapshot.id !== local.id) return { kind: 'invalid' };
  const localSignature = sharingSettingsSignature(local);
  const differs = localSignature !== sharingSettingsSignature(row.snapshot);
  if (differs && (!resolution || resolution.driverId !== local.id || resolution.revision !== row.revision || resolution.localSignature !== localSignature ||
      !['phone', 'published'].includes(resolution.choice))) {
    return { kind: 'conflict', conflict: { local, published: row } };
  }
  if (differs && resolution?.choice === 'phone') return { kind: 'ready', driver: local };
  // A deliberate server choice still retains this phone's real GPS and anchors.
  return { kind: 'ready', driver: { ...local, ...row.snapshot, currentLocation: local.currentLocation,
    directionAnchor: local.directionAnchor, dutyMovementAnchor: local.dutyMovementAnchor,
    gpsMode: local.gpsMode, bearing: local.bearing, detectedNodeId: local.detectedNodeId,
    lastActiveTime: Math.max(local.lastActiveTime || 0, row.snapshot.lastActiveTime || 0),
    lastUpdated: local.lastUpdated,
    status: local.status, isDetour: local.isDetour, detourNameEn: local.detourNameEn,
    detourNameAr: local.detourNameAr, currentStopEn: local.currentStopEn,
    currentStopAr: local.currentStopAr, proximityStatusEn: local.proximityStatusEn,
    proximityStatusAr: local.proximityStatusAr } };
}
