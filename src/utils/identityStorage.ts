export const AUTH_DRIVER_KEY = 'kufr_malik_auth_driver_id_v6';
export const VILLAGER_NAME_KEY = 'kufr_malik_villager_name_v1';

type IdentityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const normalizeVillagerName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 80);

export function readDriverSession(drivers: { id: string }[], storage?: IdentityStorage): string | null {
  try {
    const target = storage ?? localStorage;
    const id = target.getItem(AUTH_DRIVER_KEY);
    if (id && drivers.some((driver) => driver.id === id)) return id;
    if (id) target.removeItem(AUTH_DRIVER_KEY);
  } catch {}
  return null;
}

export function readVillagerName(storage?: IdentityStorage): string {
  try {
    return normalizeVillagerName((storage ?? localStorage).getItem(VILLAGER_NAME_KEY) || '');
  } catch {
    return '';
  }
}

export function storeIdentity(key: string, value: string | null, storage?: IdentityStorage) {
  try {
    const target = storage ?? localStorage;
    if (value) target.setItem(key, value);
    else target.removeItem(key);
  } catch {}
}
