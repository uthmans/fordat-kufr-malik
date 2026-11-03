import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DriverLocationWatch } from './driverLocationWatch';

function setup() {
  const callbacks: { position: PositionCallback; error: PositionErrorCallback | null | undefined }[] = [];
  const cleared: number[] = [];
  const owners: string[] = [];
  const errors: number[] = [];
  const watch = new DriverLocationWatch({
    watchPosition(position, error) { callbacks.push({ position, error }); return callbacks.length - 1; },
    clearWatch(id) { cleared.push(id); }
  }, (id) => owners.push(id), (error) => errors.push(error.code));
  const position = { coords: { latitude: 31.98, longitude: 35.3 }, timestamp: 100 } as GeolocationPosition;
  const error = (code: number) => ({ code, message: 'GPS error' } as GeolocationPositionError);
  return { watch, callbacks, cleared, owners, errors, position, error };
}

test('every location stays assigned to the driver who started the watch', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.callbacks[0].position(s.position);
  s.callbacks[0].position(s.position);
  assert.deepEqual(s.owners, ['driver-1', 'driver-1']);
});

test('stopping ignores queued locations and errors, including watch ID zero', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.watch.stop();
  s.callbacks[0].position(s.position);
  s.callbacks[0].error!(s.error(2));
  assert.deepEqual(s.cleared, [0]);
  assert.deepEqual(s.owners, []);
  assert.deepEqual(s.errors, []);
});

test('switching drivers rejects old callbacks and accepts only the new owner', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.watch.start('driver-2');
  s.callbacks[0].position(s.position);
  s.callbacks[0].error!(s.error(1));
  s.callbacks[1].position(s.position);
  assert.deepEqual(s.cleared, [0]);
  assert.deepEqual(s.owners, ['driver-2']);
  assert.deepEqual(s.errors, []);
});

test('starting again replaces the previous watch instead of leaking it', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.watch.start('driver-1');
  s.callbacks[0].position(s.position);
  s.callbacks[1].position(s.position);
  assert.deepEqual(s.cleared, [0]);
  assert.deepEqual(s.owners, ['driver-1']);
});

test('permission denial ends the session and ignores later callbacks', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.callbacks[0].error!(s.error(1));
  s.callbacks[0].position(s.position);
  assert.deepEqual(s.errors, [1]);
  assert.deepEqual(s.cleared, [0]);
  assert.deepEqual(s.owners, []);
});

test('a temporary timeout can recover on the same watch', () => {
  const s = setup();
  s.watch.start('driver-1');
  s.callbacks[0].error!(s.error(3));
  s.callbacks[0].position(s.position);
  assert.deepEqual(s.errors, [3]);
  assert.deepEqual(s.owners, ['driver-1']);
  assert.deepEqual(s.cleared, []);
});

test('an empty driver identity never starts a watch', () => {
  const s = setup();
  s.watch.start('');
  assert.equal(s.callbacks.length, 0);
});

test('a synchronous permission error still clears the returned watcher', () => {
  const cleared: number[] = [];
  const watch = new DriverLocationWatch({
    watchPosition(_success, error) { error!({ code: 1 } as GeolocationPositionError); return 5; },
    clearWatch(id) { cleared.push(id); }
  }, () => assert.fail('No location expected'), () => {});
  watch.start('driver-1');
  assert.deepEqual(cleared, [5]);
});
