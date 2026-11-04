import type { Driver } from '../types';
import { AUTH_DRIVER_KEY } from './identityStorage';

export function resetConfirmationMessage(isAr: boolean) {
  return isAr
    ? 'سيتم حذف الحجوزات وسجلات الرحلات والأرشيف وإعادة بيانات السائقين ورموزهم إلى القيم التجريبية الأصلية، مع تسجيل الخروج وإيقاف التتبع في تبويبات التطبيق المفتوحة على هذا الجهاز. لا يمكن التراجع. هل تريد المتابعة؟'
    : 'This deletes bookings, trip logs and archives, restores original demo driver profiles and PINs, signs out and stops tracking in open app tabs on this device. This cannot be undone. Continue?';
}

// Attempt every write even when one collection or browser permission fails.
// Never clear unrelated app preferences or other sites' browser storage.
export function persistTransitReset(drivers: Driver[], storage?: Pick<Storage, 'setItem' | 'removeItem'>) {
  let target: Pick<Storage, 'setItem' | 'removeItem'>;
  try { target = storage ?? localStorage; } catch { return false; }
  let saved = true;
  for (const [key, value] of [
    ['kufr_malik_transit_drivers_v8', JSON.stringify(drivers)],
    ['kufr_malik_transit_requests_v6', '[]'],
    ['kufr_malik_transit_triplogs_v6', '[]'],
    ['kufr_malik_transit_history_v6', '[]']
  ]) {
    try { target.setItem(key, value); } catch { saved = false; }
  }
  for (const key of [AUTH_DRIVER_KEY, 'kufr_malik_admin_auth_v6', 'kufr_malik_transit_drivers_v7']) {
    try { target.removeItem(key); } catch { saved = false; }
  }
  return saved;
}
