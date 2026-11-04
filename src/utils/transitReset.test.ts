import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { AUTH_DRIVER_KEY, VILLAGER_NAME_KEY } from './identityStorage';
import { persistTransitReset, resetConfirmationMessage } from './transitReset';
import { readSyncMessage, restoreDrivers, readStoredCollection, isSeatRequest, isTripLog, isArchivedTrip } from './transitData';

function memoryStorage() {
  const data = new Map<string, string>([
    [AUTH_DRIVER_KEY, 'driver-1'], ['kufr_malik_admin_auth_v6', 'true'],
    ['kufr_malik_transit_drivers_v7', 'old roster'], [VILLAGER_NAME_KEY, 'أم أحمد'],
    ['kufr_malik_transit_lang', 'en'], ['kufr_malik_transit_contrast', 'true'], ['unrelated', 'keep']
  ]);
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

test('reset persists empty collections and default roster, clears sessions and legacy fallback', () => {
  const store = memoryStorage();
  assert.equal(persistTransitReset(INITIAL_DRIVERS, store), true);
  assert.deepEqual(restoreDrivers(store).map(d => d.id), INITIAL_DRIVERS.map(d => d.id));
  assert.deepEqual(readStoredCollection('kufr_malik_transit_requests_v6', isSeatRequest, store), []);
  assert.deepEqual(readStoredCollection('kufr_malik_transit_triplogs_v6', isTripLog, store), []);
  assert.deepEqual(readStoredCollection('kufr_malik_transit_history_v6', isArchivedTrip, store), []);
  assert.equal(store.getItem(AUTH_DRIVER_KEY), null);
  assert.equal(store.getItem('kufr_malik_admin_auth_v6'), null);
  assert.equal(store.getItem('kufr_malik_transit_drivers_v7'), null);
});

test('reset retains saved villager identity, language, contrast and unrelated storage', () => {
  const store = memoryStorage();
  persistTransitReset(INITIAL_DRIVERS, store);
  for (const [key, value] of [[VILLAGER_NAME_KEY, 'أم أحمد'], ['kufr_malik_transit_lang', 'en'], ['kufr_malik_transit_contrast', 'true'], ['unrelated', 'keep']]) {
    assert.equal(store.getItem(key), value);
  }
});

test('one failed storage operation cannot prevent the remaining reset writes or session cleanup', () => {
  const store = memoryStorage();
  const writes: string[] = [];
  const result = persistTransitReset(INITIAL_DRIVERS, { ...store, setItem(key, value) {
    writes.push(key);
    if (key.includes('requests')) throw Error('Quota');
    store.setItem(key, value);
  } });
  assert.equal(result, false);
  assert.equal(writes.length, 4);
  assert.equal(store.getItem('kufr_malik_transit_history_v6'), '[]');
  assert.equal(store.getItem(AUTH_DRIVER_KEY), null);
});

test('blocked storage never throws and reports that reset cannot be fully saved', () => {
  const attempts: string[] = [];
  const blocked = (key: string) => { attempts.push(key); throw Error('Blocked'); };
  assert.equal(persistTransitReset(INITIAL_DRIVERS, { setItem: blocked, removeItem: blocked }), false);
  assert.equal(attempts.length, 7);
});

test('reset sync accepts a complete valid roster and rejects empty or malformed snapshots', () => {
  const message = { type: 'RESET_TRANSIT', payload: INITIAL_DRIVERS };
  assert.deepEqual(readSyncMessage(message), message);
  for (const payload of [null, [], {}, [null], [INITIAL_DRIVERS[0], INITIAL_DRIVERS[0]], [{ ...INITIAL_DRIVERS[0], currentLocation: null }]]) {
    assert.equal(readSyncMessage({ type: 'RESET_TRANSIT', payload }), null);
  }
});

test('Arabic and English confirmation explain irreversible data and PIN changes', () => {
  for (const isAr of [false, true]) {
    const message = resetConfirmationMessage(isAr);
    assert.ok(message.includes(isAr ? 'لا يمكن التراجع' : 'cannot be undone'));
    assert.ok(message.includes(isAr ? 'رموزهم' : 'PINs'));
  }
});
