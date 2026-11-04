import type { Driver } from '../types';
import { isValidDriverPin } from './driverPin';
import { cleanWhatsAppNumber } from './whatsapp';

export type DriverProfileUpdates = Partial<Pick<Driver, 'nameAr' | 'nameEn' | 'phone' | 'pinCode' | 'maxCapacity'>>;
const fields = ['nameAr', 'nameEn', 'phone', 'pinCode', 'maxCapacity'] as const;

// Compare with the form's original snapshot, not with changing live props.
export function changedProfileFields(original: Driver, values: DriverProfileUpdates): DriverProfileUpdates {
  const patch: Record<string, unknown> = {};
  for (const key of fields) {
    if (values[key] === undefined) continue;
    const value = typeof values[key] === 'string' ? (values[key] as string).trim() : values[key];
    if (value !== original[key]) patch[key] = value;
  }
  return patch as DriverProfileUpdates;
}

export function editDriverProfile(drivers: Driver[], id: string, updates: DriverProfileUpdates, now: number): Driver[] | null {
  const driver = drivers.find(d => d.id === id);
  if (!driver || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return null;
  const patch: DriverProfileUpdates = {};
  for (const field of fields) {
    const value = updates[field];
    if (value === undefined) continue;
    if (field === 'maxCapacity') {
      if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) < driver.passengers) return null;
      patch.maxCapacity = value as number;
    } else {
      if (typeof value !== 'string' || !value.trim()) return null;
      const normalized = value.trim();
      if (field === 'pinCode' && !isValidDriverPin(value)) return null;
      if (field === 'phone' && !/^[1-9][0-9]{7,14}$/.test(cleanWhatsAppNumber(normalized))) return null;
      patch[field] = normalized;
    }
  }
  if (!Object.keys(patch).length) return drivers;
  return drivers.map(d => d.id === id ? { ...d, ...patch, lastUpdated: new Date(now).toISOString() } : d);
}
