import type { Driver, GPSLocation } from '../types';
import { getDistanceMeters } from './geo';

export const DUTY_INACTIVITY_MS = 45 * 60 * 1000;
const MAX_FIX_AGE_MS = 2 * 60 * 1000;

const validFix = (fix: GPSLocation) => Number.isFinite(fix.lat) && Math.abs(fix.lat) <= 90 &&
  Number.isFinite(fix.lng) && Math.abs(fix.lng) <= 180 && Number.isFinite(fix.timestamp) &&
  typeof fix.accuracy === 'number' && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= 100;

// Movement may refresh activity, but never switches an off-duty driver back on.
// Keep a separate anchor: house pickups can move across the route as well as along it.
export function recordDutyMovement(driver: Driver, fix: GPSLocation, mode: Driver['gpsMode'], now: number): Partial<Driver> {
  if (!driver.isOnDuty || driver.autoPausedForInactivity || !validFix(fix) ||
      fix.timestamp > now || now - fix.timestamp > MAX_FIX_AGE_MS) return {};
  const anchor = driver.gpsMode === mode ? driver.dutyMovementAnchor : undefined;
  if (!anchor || !validFix(anchor) || fix.timestamp - anchor.timestamp > MAX_FIX_AGE_MS) {
    return { dutyMovementAnchor: fix };
  }
  if (fix.timestamp <= anchor.timestamp) return {};
  const uncertainty = Math.max(50, (anchor.accuracy || 0) + (fix.accuracy || 0));
  if (getDistanceMeters(anchor.lat, anchor.lng, fix.lat, fix.lng) <= uncertainty) return {};
  return { dutyMovementAnchor: fix, lastActiveTime: Math.max(driver.lastActiveTime || 0, fix.timestamp) };
}

export function pauseInactiveDrivers(drivers: Driver[], now: number): Driver[] {
  let changed = false;
  const updated = drivers.map((driver) => {
    if (!driver.isOnDuty || driver.status !== 'in_kufr_malik') return driver;
    const lastActive = Number.isFinite(driver.lastActiveTime) ? driver.lastActiveTime! : Date.parse(driver.lastUpdated);
    if (Number.isFinite(lastActive) && now - lastActive < DUTY_INACTIVITY_MS) return driver;
    changed = true;
    return { ...driver, isOnDuty: false, autoPausedForInactivity: true, lastUpdated: new Date(now).toISOString() };
  });
  return changed ? updated : drivers;
}
