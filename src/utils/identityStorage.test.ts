import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_DRIVER_KEY, VILLAGER_NAME_KEY, normalizeVillagerName, readDriverSession, readVillagerName, storeIdentity } from './identityStorage';
import { buildVillagerReservationUrl } from './whatsapp';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }
  };
}

describe('persistent identity', () => {
  test('restores an existing driver session and forgets it on switch', () => {
    const storage = memoryStorage();
    const roster = [{ id: 'driver-1' }, { id: 'driver-2' }];
    assert.equal(readDriverSession(roster, storage), null);
    storeIdentity(AUTH_DRIVER_KEY, 'driver-2', storage);
    assert.equal(readDriverSession(roster, storage), 'driver-2');
    storeIdentity(AUTH_DRIVER_KEY, null, storage);
    assert.equal(readDriverSession(roster, storage), null);
  });

  test('rejects a stale roster ID instead of restoring another driver', () => {
    const storage = memoryStorage();
    storage.setItem(AUTH_DRIVER_KEY, 'removed-driver');
    assert.equal(readDriverSession([{ id: 'driver-1' }], storage), null);
    assert.equal(storage.getItem(AUTH_DRIVER_KEY), null);
  });

  test('remembers Arabic and English names and replaces family identity', () => {
    const storage = memoryStorage();
    assert.equal(readVillagerName(storage), '');
    for (const name of ['  أحمد   كنعان  ', '  Mary   Smith ']) {
      storeIdentity(VILLAGER_NAME_KEY, normalizeVillagerName(name), storage);
      assert.equal(readVillagerName(storage), normalizeVillagerName(name));
    }
    assert.equal(readVillagerName(storage), 'Mary Smith');
    assert.equal(normalizeVillagerName('  \n  '), '');
    assert.equal(normalizeVillagerName('x'.repeat(100)).length, 80);
  });

  test('driver switching does not remove the villager name', () => {
    const storage = memoryStorage();
    storeIdentity(VILLAGER_NAME_KEY, 'Ahmad', storage);
    storeIdentity(AUTH_DRIVER_KEY, 'driver-1', storage);
    storeIdentity(AUTH_DRIVER_KEY, null, storage);
    assert.equal(readVillagerName(storage), 'Ahmad');
  });

  test('storage restrictions never crash login or booking', () => {
    const blocked = () => { throw new Error('Storage blocked'); };
    const storage = { getItem: blocked, setItem: blocked, removeItem: blocked };
    assert.equal(readDriverSession([{ id: 'driver-1' }], storage), null);
    assert.equal(readVillagerName(storage), '');
    assert.doesNotThrow(() => storeIdentity(AUTH_DRIVER_KEY, 'driver-1', storage));
    assert.doesNotThrow(() => storeIdentity(AUTH_DRIVER_KEY, null, storage));
  });

  test('WhatsApp keeps the same primary name when booking 1, 2, or 3 seats', () => {
    for (const isAr of [false, true]) {
      const name = isAr ? 'أم أحمد' : 'Mary Smith';
      for (const seats of [1, 2, 3]) {
        const url = new URL(buildVillagerReservationUrl('0599111222', name, seats, isAr));
        assert.equal(url.origin, 'https://wa.me');
        assert.equal(url.pathname, '/970599111222');
        assert.ok(url.searchParams.get('text')!.includes(name));
        assert.ok(url.searchParams.get('text')!.includes(isAr ? ['مقعد واحد', 'مقعدين', '3 مقاعد'][seats - 1] : seats + (seats === 1 ? ' seat' : ' seats')));
      }
    }
  });
});
