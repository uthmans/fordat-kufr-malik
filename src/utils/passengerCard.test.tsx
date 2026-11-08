import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { PassengerDriverCard } from '../components/PassengerDriverCard';

const now = 1_800_000_000_000;
const driver = { ...INITIAL_DRIVERS[0], gpsMode: 'live' as const, isOnDuty: true, passengers: 5,
  currentLocation: { lat: 31.98, lng: 35.3, timestamp: now - 1000 }, seatCountUpdatedAt: now - 1000 };
const render = (patch = {}, isAr = false, demo = false) => renderToStaticMarkup(
  <PassengerDriverCard driver={{ ...driver, ...patch }} now={now} isAr={isAr} demo={demo} onWhatsApp={() => {}} />);

test('simple passenger cards show confirmed seats and both contact actions', () => {
  for (const isAr of [true, false]) {
    const html = render({}, isAr);
    assert.ok(html.includes(isAr ? 'مقعدان' : '2 seats'));
    assert.ok(html.includes('href="tel:+972597073155"'));
    assert.ok(html.includes(isAr ? 'واتساب علاء حمايل' : 'WhatsApp Alaa Hamayel'));
  }
});

test('compact cards never show a stale, unknown or off-duty count as available seats', () => {
  for (const patch of [{ seatCountUpdatedAt: undefined }, { seatCountUpdatedAt: now - 600000 },
    { currentLocation: { ...driver.currentLocation, timestamp: now - 120000 } }, { isOnDuty: false }]) {
    const html = render(patch);
    assert.ok(html.includes('Call to check'));
    assert.ok(!html.includes('2 seats'));
  }
});

test('full vehicles remain full and demo seat counts stay explicitly identified', () => {
  assert.ok(render({ passengers: 7 }).includes('Full'));
  const html = render({ gpsMode: 'simulation' }, false, true);
  assert.ok(html.includes('Demo data'));
  assert.ok(html.includes('2 seats'));
  assert.ok(render({ gpsMode: 'simulation' }).includes('Call to check'));
});
