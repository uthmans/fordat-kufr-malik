import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanWhatsAppNumber, buildVillagerReservationUrl, buildDriverConfirmationUrl, buildGeneralDriverWhatsAppUrl } from './whatsapp';
import { ReservationHandoff } from './reservationHandoff';
import { editDriverProfile } from './driverProfile';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

const variants = ['0599111222', '٠٥٩٩١١١٢٢٢', '۰۵۹۹۱۱۱۲۲۲', '+970 599-111-222', '00970 599 111 222', '٠٠٩٧٠ ٥٩٩ ١١١ ٢٢٢'];

test('local numbers from English, Arabic and Persian keyboards share the same destination', () => {
  for (const phone of variants) assert.equal(cleanWhatsAppNumber(phone), '970599111222');
  assert.equal(cleanWhatsAppNumber('٠٥٦٩١١١٢٢٢'), '970569111222');
});

test('plus and dial-out prefixes preserve the selected international country code', () => {
  for (const phone of ['+972599111222', '00972599111222', '+٩٧٢٥٩٩١١١٢٢٢', '۰۰۹۷۲۵۹۹۱۱۱۲۲۲']) {
    assert.equal(cleanWhatsAppNumber(phone), '972599111222');
  }
  assert.equal(cleanWhatsAppNumber('00442079460000'), '442079460000');
});

test('mixed digits, spaces, punctuation and invisible RTL marks do not alter the number', () => {
  assert.equal(cleanWhatsAppNumber('\u200f٠٠9٧٢ (٥99) ١١١-٢٢٢\u200e'), '972599111222');
  assert.equal(cleanWhatsAppNumber('\u2066+970 ۵۹۹ 111 ۲۲۲\u2069'), '970599111222');
});

test('reservation, confirmation and contact links use identical normalized destinations', () => {
  for (const isAr of [false, true]) {
    for (const phone of variants) {
      for (const url of [buildVillagerReservationUrl(phone, 'أم أحمد', 3, isAr),
        buildDriverConfirmationUrl(phone, isAr), buildGeneralDriverWhatsAppUrl(phone, 'أبو هارون', isAr)]) {
        const parsed = new URL(url);
        assert.equal(parsed.origin, 'https://wa.me');
        assert.equal(parsed.pathname, '/970599111222');
        assert.ok(parsed.searchParams.get('text'));
      }
    }
  }
});

test('profile edits accept the supported regional formats without changing the saved text', () => {
  for (const phone of variants) {
    const next = editDriverProfile(INITIAL_DRIVERS, 'driver-1', { phone }, Date.now())!;
    assert.ok(next);
    assert.equal(next[0].phone, phone);
  }
});

test('reservation handoff validates regional digits and prepares the normalized chat once', () => {
  for (const phone of variants) {
    let destination = '';
    let saves = 0;
    const handoff = new ReservationHandoff();
    const input = { driverId: 'driver-1', phone, name: 'Family', seats: 2, capacity: 7, isArabic: false };
    assert.equal(handoff.submit(input, () => { saves++; return true; }, url => { destination = new URL(url).pathname; }).ok, true);
    handoff.submit(input, () => assert.fail('No duplicate request'), () => assert.fail('No duplicate launch'));
    assert.equal(saves, 1);
    assert.equal(destination, '/970599111222');
  }
});

test('empty, incomplete and all-zero numbers remain rejected', () => {
  for (const phone of ['', 'رقم الهاتف', '٠٠٩٧٠', '۰۰۰۰۰۰۰۰۰۰', '123']) {
    const result = new ReservationHandoff().submit({ driverId: 'driver-1', phone, name: 'Family', seats: 1, capacity: 7, isArabic: true },
      () => assert.fail('No save'), () => assert.fail('No launch'));
    assert.deepEqual(result, { ok: false, error: 'phone' });
  }
});

test('existing roster numbers retain their original destinations', () => {
  for (const driver of INITIAL_DRIVERS) {
    assert.equal(cleanWhatsAppNumber(driver.phone), driver.phone.replace(/[^0-9]/g, ''));
  }
});
