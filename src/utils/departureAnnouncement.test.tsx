import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDepartureAnnouncement, departureAnnouncementLabel } from './departureAnnouncement';
import { DepartureAnnouncement } from '../components/DepartureAnnouncement';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

const start = 1_800_000_000_000;
const driver = { ...INITIAL_DRIVERS[0], isOnDuty: true, departureCountdown: 'in_10_mins' as const, departureCountdownSetAt: start };

test('ten-minute announcement counts down using the original saved time', () => {
  for (const [age, minutes] of [[0, 10], [60_000, 9], [120_000, 8], [540_000, 1], [599_999, 1]]) {
    assert.deepEqual(getDepartureAnnouncement(driver, start + age), { key: 'in_10_mins', minutes });
  }
});

test('five and ten-minute notices disappear exactly at their deadline without claiming departure', () => {
  for (const [key, duration] of [['in_5_mins', 300_000], ['in_10_mins', 600_000]] as const) {
    const d = { ...driver, departureCountdown: key };
    assert.ok(getDepartureAnnouncement(d, start + duration - 1));
    assert.equal(getDepartureAnnouncement(d, start + duration), null);
    assert.equal(getDepartureAnnouncement(d, start + 24 * 60 * 60_000), null);
  }
});

test('leaving-now announcement lasts two minutes and then disappears', () => {
  const d = { ...driver, departureCountdown: 'leaving_now' as const };
  assert.ok(getDepartureAnnouncement(d, start + 119_999));
  assert.equal(getDepartureAnnouncement(d, start + 120_000), null);
});

test('off-duty, cancelled, missing, future and invalid timestamps never show an announcement', () => {
  assert.equal(getDepartureAnnouncement({ ...driver, isOnDuty: false }, start), null);
  assert.equal(getDepartureAnnouncement({ ...driver, departureCountdown: null }, start), null);
  for (const departureCountdownSetAt of [undefined, NaN, Infinity, 0, -1, start + 1]) {
    assert.equal(getDepartureAnnouncement({ ...driver, departureCountdownSetAt }, start), null);
  }
  assert.equal(getDepartureAnnouncement(driver, NaN), null);
});

test('reopening, GPS refreshes and unrelated profile edits cannot restart an old timer', () => {
  const updated = { ...driver, lastUpdated: new Date(start + 900_000).toISOString(), lastActiveTime: start + 900_000 };
  assert.equal(getDepartureAnnouncement(JSON.parse(JSON.stringify(updated)), start + 900_000), null);
  assert.equal(getDepartureAnnouncement({ ...updated, departureCountdownSetAt: start + 900_000 }, start + 900_000)?.minutes, 10);
});

test('English and Arabic minute labels handle one, two, and multiple minutes', () => {
  for (const [minutes, ar, en] of [[1, 'طالع بعد دقيقة واحدة', 'Departing in 1 minute'], [2, 'طالع بعد دقيقتين', 'Departing in 2 minutes'], [8, 'طالع بعد 8 دقائق', 'Departing in 8 minutes']] as const) {
    const value = { key: 'in_10_mins' as const, minutes };
    assert.equal(departureAnnouncementLabel(value, true), ar);
    assert.equal(departureAnnouncementLabel(value, false), en);
  }
});

test('shared passenger and driver banner renders remaining time and removes expired content', () => {
  const html = renderToStaticMarkup(<DepartureAnnouncement driver={driver} now={start + 120_000} isAr />);
  assert.ok(html.includes('طالع بعد 8 دقائق'));
  assert.equal(renderToStaticMarkup(<DepartureAnnouncement driver={driver} now={start + 600_000} isAr />), '');
  assert.equal(renderToStaticMarkup(<DepartureAnnouncement driver={{ ...driver, isOnDuty: false }} now={start} isAr={false} />), '');
});
