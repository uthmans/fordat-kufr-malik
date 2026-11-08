import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildDriverCallUrl } from './whatsapp';
import { DriverContactActions } from '../components/DriverContactActions';
import { DepartureButtons } from '../components/DepartureButtons';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

test('calls preserve international prefixes and normalize Arabic/Persian/local phone numbers', () => {
  for (const phone of ['0599111222', '٠٥٩٩١١١٢٢٢', '۰۵۹۹۱۱۱۲۲۲', '+970 599-111-222', '00970599111222']) {
    assert.equal(buildDriverCallUrl(phone), 'tel:+970599111222');
  }
  assert.equal(buildDriverCallUrl('\u2066+٩٧٢ ٥٩٩١١١٢٢٢\u2069'), 'tel:+972599111222');
  for (const driver of INITIAL_DRIVERS) assert.equal(buildDriverCallUrl(driver.phone), `tel:${driver.phone}`);
});

test('invalid numbers never become actionable call links', () => {
  for (const phone of ['', 'رقم الهاتف', '123', '0000000000', '+970', '1'.repeat(16)]) {
    assert.equal(buildDriverCallUrl(phone), null);
    const html = renderToStaticMarkup(<DriverContactActions phone={phone} name="Driver" isAr={false} onWhatsApp={() => assert.fail('No message')} />);
    assert.ok(!html.includes('href='));
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  }
});

test('both languages expose a direct dialer link and a separate WhatsApp booking button', () => {
  for (const isAr of [true, false]) {
    const html = renderToStaticMarkup(<DriverContactActions phone="+972599111222" name="أبو هارون" isAr={isAr} onWhatsApp={() => {}} />);
    assert.ok(html.includes('href="tel:+972599111222"'));
    assert.ok(html.includes(isAr ? 'اتصل بـ أبو هارون' : 'Call أبو هارون'));
    assert.ok(html.includes(isAr ? 'واتساب أبو هارون' : 'WhatsApp أبو هارون'));
  }
});

test('departure controls retain three full labels, selection state and off-duty protection', () => {
  for (const isAr of [true, false]) {
    const html = renderToStaticMarkup(<DepartureButtons selected="in_5_mins" onDuty={true} isAr={isAr} onChange={() => {}} />);
    assert.equal((html.match(/<button/g) ?? []).length, 3);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
    assert.ok(html.includes(isAr ? 'طالع كمان 10 دقائق' : 'Departing in 10 mins'));
    const paused = renderToStaticMarkup(<DepartureButtons selected={null} onDuty={false} isAr={isAr} onChange={() => assert.fail('Off duty')} />);
    assert.equal((paused.match(/disabled=""/g) ?? []).length, 3);
  }
});
