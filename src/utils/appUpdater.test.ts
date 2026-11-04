import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppUpdateState, UpdateCallbacks, createAppUpdater } from './appUpdater';

function setup(update: () => Promise<unknown> = async () => {}) {
  let callbacks!: UpdateCallbacks;
  const states: AppUpdateState[] = [];
  let reloads = 0;
  const controller = createAppUpdater((options) => { callbacks = options; }, () => { reloads++; }, (state) => states.push(state));
  return { controller, states, get callbacks() { return callbacks; }, get reloads() { return reloads; }, register() { callbacks.onRegisteredSW('/sw.js', { update }); } };
}

test('initial registration does not announce an update or reload the page', () => {
  const s = setup();
  s.register();
  assert.deepEqual(s.states.at(-1), { available: false, status: 'idle' });
  assert.equal(s.reloads, 0);
});

test('an activated update notifies the UI without reloading an in-progress form', () => {
  const s = setup();
  s.register();
  s.callbacks.onNeedReload();
  assert.deepEqual(s.states.at(-1), { available: true, status: 'ready' });
  assert.equal(s.reloads, 0);
});

test('only an explicit apply reloads, and repeated taps reload once', () => {
  const s = setup();
  s.controller.apply();
  assert.equal(s.reloads, 0);
  s.callbacks.onNeedReload();
  s.controller.apply();
  s.controller.apply();
  assert.equal(s.reloads, 1);
});

test('manual checks call the service worker without reloading', async () => {
  let checks = 0;
  const s = setup(async () => { checks++; });
  s.register();
  await s.controller.check();
  assert.equal(checks, 1);
  assert.equal(s.reloads, 0);
  assert.equal(s.states.at(-1)?.status, 'idle');
});

test('an update arriving during a check remains ready after the check finishes', async () => {
  let complete!: () => void;
  const s = setup(() => new Promise<void>((resolve) => { complete = resolve; }));
  s.register();
  const checking = s.controller.check();
  s.callbacks.onNeedReload();
  complete();
  await checking;
  assert.deepEqual(s.states.at(-1), { available: true, status: 'ready' });
  assert.equal(s.reloads, 0);
});

test('network failures are recoverable and do not discard a downloaded update', async () => {
  let offline = true;
  const s = setup(async () => { if (offline) throw new Error('offline'); });
  s.register();
  await s.controller.check();
  assert.equal(s.states.at(-1)?.status, 'error');
  offline = false;
  await s.controller.check();
  assert.equal(s.states.at(-1)?.status, 'idle');
  s.callbacks.onNeedReload();
  offline = true;
  await s.controller.check();
  assert.deepEqual(s.states.at(-1), { available: true, status: 'ready' });
});

test('stopped controllers ignore late events and never reload', async () => {
  const s = setup();
  s.register();
  s.controller.stop();
  const notifications = s.states.length;
  s.callbacks.onNeedReload();
  s.callbacks.onRegisterError(new Error('late error'));
  await s.controller.check();
  s.controller.apply();
  assert.equal(s.states.length, notifications);
  assert.equal(s.reloads, 0);
});

test('a failed reload keeps the update available for a retry', () => {
  let callbacks!: UpdateCallbacks;
  let reloads = 0;
  const states: AppUpdateState[] = [];
  const controller = createAppUpdater((options) => { callbacks = options; }, () => {
    reloads++;
    if (reloads === 1) throw new Error('reload failed');
  }, (state) => states.push(state));
  callbacks.onNeedReload();
  controller.apply();
  assert.deepEqual(states.at(-1), { available: true, status: 'error' });
  controller.apply();
  assert.equal(reloads, 2);
});

test('failed registration can be retried without affecting app data', async () => {
  let attempts = 0;
  const states: AppUpdateState[] = [];
  const controller = createAppUpdater((options) => {
    attempts++;
    if (attempts === 1) options.onRegisterError(new Error('network'));
    else options.onRegisteredSW('/sw.js', { update: async () => {} });
  }, () => assert.fail('No reload expected'), (state) => states.push(state));
  assert.equal(states.at(-1)?.status, 'error');
  await controller.check();
  assert.equal(attempts, 2);
  assert.equal(states.at(-1)?.status, 'idle');
});
