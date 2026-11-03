import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReservationHandoff, PreparedReservation } from './reservationHandoff';

const input = () => ({ driverId: 'driver-1', phone: '+972599111222', name: 'Family Test', seats: 3, capacity: 7, isArabic: false });

test('saves and launches WhatsApp synchronously before submit returns', () => {
  const events: string[] = [];
  const result = new ReservationHandoff().submit(input(), () => events.push('save'), () => events.push('open'));
  events.push('returned');
  assert.equal(result.ok, true);
  assert.deepEqual(events, ['save', 'open', 'returned']);
});

test('rapid repeat submissions save and open only once', () => {
  const handoff = new ReservationHandoff();
  let saved = 0;
  let opened = 0;
  const first = handoff.submit(input(), () => saved++, () => opened++);
  const second = handoff.submit(input(), () => saved++, () => opened++);
  assert.deepEqual(first, second);
  assert.equal(saved, 1);
  assert.equal(opened, 1);
});

test('blocked or throwing launch retains the saved request and usable retry URL', () => {
  const handoff = new ReservationHandoff();
  let saved = 0;
  const result = handoff.submit(input(), () => saved++, () => { throw new Error('Popup blocked'); });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(new URL(result.value.url).hostname, 'wa.me');
  assert.ok(result.value.message.includes('Family Test'));
  assert.ok(result.value.message.includes('3 seats'));
  handoff.submit(input(), () => saved++, () => assert.fail('Do not reopen on duplicate submit'));
  assert.equal(saved, 1);
});

test('a null popup handle is not treated as failed preparation', () => {
  const result = new ReservationHandoff().submit(input(), () => {}, () => null);
  assert.equal(result.ok, true);
});

test('invalid names, seat counts, and phone numbers have no side effects', () => {
  for (const changes of [{ name: '  ' }, { seats: 0 }, { seats: 1.5 }, { seats: 8 }, { capacity: 0 }, { phone: 'invalid' }, { phone: '123' }]) {
    const result = new ReservationHandoff().submit({ ...input(), ...changes }, () => assert.fail('No request expected'), () => assert.fail('No launch expected'));
    assert.equal(result.ok, false);
  }
});

test('correcting an invalid name allows a subsequent valid submission', () => {
  const handoff = new ReservationHandoff();
  assert.equal(handoff.submit({ ...input(), name: ' ' }, () => assert.fail(), () => assert.fail()).ok, false);
  assert.equal(handoff.submit(input(), () => {}, () => {}).ok, true);
});

test('a new modal session can prepare a different family booking', () => {
  const handoff = new ReservationHandoff();
  const saved: PreparedReservation[] = [];
  handoff.submit(input(), (value) => saved.push(value), () => {});
  handoff.reset();
  handoff.submit({ ...input(), name: 'Another Family', seats: 2 }, (value) => saved.push(value), () => {});
  assert.equal(saved.length, 2);
  assert.equal(saved[0].name, 'Family Test');
  assert.equal(saved[1].name, 'Another Family');
  assert.equal(saved[1].seats, 2);
});

test('Arabic names, group sizes, local numbers, and international prefixes survive the handoff', () => {
  for (const phone of ['0599111222', '+970599111222', '+972599111222']) {
    for (const seats of [1, 2, 3, 4]) {
      const result = new ReservationHandoff().submit({ ...input(), name: '  أم أحمد & علي  ', phone, seats, isArabic: true }, () => {}, () => {});
      assert.equal(result.ok, true);
      if (!result.ok) continue;
      assert.equal(result.value.name, 'أم أحمد & علي');
      assert.equal(new URL(result.value.url).pathname, '/' + (phone.startsWith('+972') ? '972599111222' : '970599111222'));
      assert.ok(result.value.message.includes('أم أحمد & علي'));
      assert.ok(result.value.message.includes(seats === 1 ? 'مقعد واحد' : seats === 2 ? 'مقعدين' : seats + ' مقاعد'));
    }
  }
});
