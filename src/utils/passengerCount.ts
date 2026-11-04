import type { Driver } from '../types';

export type PassengerChange = { kind: 'set'; count: number } | { kind: 'adjust'; delta: 1 | -1 } | { kind: 'confirm' } | { kind: 'full' };

export function passengerShortcuts(capacity: number): number[] {
  if (!Number.isSafeInteger(capacity) || capacity < 1) return [];
  // Keep quick choices bounded; stepper and seat buttons cover other counts.
  return [...Array.from({ length: Math.min(capacity, 7) }, (_, count) => count), capacity];
}

export function changePassengerCount(drivers: Driver[], driverId: string, change: PassengerChange, now: number): Driver[] | null {
  const driver = drivers.find(d => d.id === driverId);
  if (!driver || !Number.isSafeInteger(driver.maxCapacity) || driver.maxCapacity < 1 ||
      !Number.isSafeInteger(driver.passengers) || driver.passengers < 0 || driver.passengers > driver.maxCapacity ||
      !Number.isFinite(now) || now <= 0 || !Number.isFinite(new Date(now).getTime())) return null;
  let desired: number;
  switch (change.kind) {
    case 'set': desired = change.count; break;
    case 'adjust':
      if (change.delta !== 1 && change.delta !== -1) return null;
      desired = driver.passengers + change.delta;
      break;
    case 'confirm': desired = driver.passengers; break;
    case 'full': desired = driver.maxCapacity; break;
    default: return null;
  }
  if (!Number.isSafeInteger(desired)) return null;
  const passengers = Math.max(0, Math.min(driver.maxCapacity, desired));
  // A tap beyond the bounds is not a new confirmation of the saved count.
  if (change.kind === 'adjust' && passengers === driver.passengers) return drivers;
  return drivers.map(d => d.id === driverId ? {
    ...d, passengers, seatCountUpdatedAt: now, lastActiveTime: now, lastUpdated: new Date(now).toISOString()
  } : d);
}
