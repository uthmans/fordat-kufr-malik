import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGPSLocation, getRouteProgressPercent, interpolateRoutePoint } from './geo';
import { inferRouteDirection } from './routeDirection';
import type { GPSLocation } from '../types';

const fix = (progress: number, timestamp = 2000, accuracy = 5): GPSLocation => ({ ...interpolateRoutePoint(progress), timestamp, accuracy });

test('progress follows the route continuously, including inside one stop segment', () => {
  for (const progress of [0, 12, 12.5, 20, 40, 60, 80, 93, 100]) {
    const point = interpolateRoutePoint(progress);
    assert.ok(Math.abs(getRouteProgressPercent(point.lat, point.lng) - progress) < 0.001);
  }
});

test('travel towards Ramallah works on either side of halfway', () => {
  for (const start of [10, 30, 70, 90]) {
    assert.equal(inferRouteDirection(fix(start + 2), fix(start, 1000)).bearing, 'southbound');
  }
});

test('travel towards Kufr Malik works on either side of halfway', () => {
  for (const start of [12, 32, 72, 92]) {
    assert.equal(inferRouteDirection(fix(start - 2), fix(start, 1000)).bearing, 'northbound');
  }
});

test('near-identical fixes are stationary and retain the reference point', () => {
  const anchor = fix(40, 1000);
  const result = inferRouteDirection(fix(40.01), anchor);
  assert.equal(result.bearing, 'stationary');
  assert.equal(result.anchor, anchor);
});

test('small movements accumulate until direction is distinguishable from noise', () => {
  let anchor = fix(40, 1000);
  let result = inferRouteDirection(fix(40.02, 2000), anchor);
  assert.equal(result.bearing, 'stationary');
  anchor = result.anchor;
  result = inferRouteDirection(fix(40.4, 4000), anchor);
  assert.equal(result.bearing, 'southbound');
});

test('poor accuracy prevents a small apparent reversal from changing direction', () => {
  assert.equal(inferRouteDirection(fix(40.5, 2000, 200), fix(40, 1000, 200)).bearing, 'stationary');
});

test('first, stale, or invalid reference fixes establish a new baseline', () => {
  const current = fix(40, 200000);
  for (const previous of [undefined, fix(10, 1), { ...fix(10, 199000), lat: NaN }]) {
    const result = inferRouteDirection(current, previous);
    assert.equal(result.bearing, 'stationary');
    assert.equal(result.anchor, current);
  }
});

test('out-of-order or repeated samples cannot move the reference point backward', () => {
  const anchor = fix(50, 200000);
  for (const current of [fix(10, 199000), fix(10, 200000)]) {
    assert.equal(inferRouteDirection(current, anchor).anchor, anchor);
    assert.equal(inferRouteDirection(current, anchor).bearing, 'stationary');
  }
});

test('a genuine turnaround changes direction', () => {
  const outbound = inferRouteDirection(fix(42), fix(40, 1000));
  assert.equal(outbound.bearing, 'southbound');
  assert.equal(inferRouteDirection(fix(39, 3000), outbound.anchor).bearing, 'northbound');
});

test('stationary road updates retain the previous trip direction', () => {
  const point = interpolateRoutePoint(60);
  assert.equal(evaluateGPSLocation(point.lat, point.lng, 'stationary', 'Driver', 'السائق', 'to_kufr_malik').status, 'to_kufr_malik');
  assert.equal(evaluateGPSLocation(point.lat, point.lng, 'stationary', 'Driver', 'السائق', 'to_ramallah').status, 'to_ramallah');
});

test('stationary Ramallah approach does not claim entering or leaving the city', () => {
  const point = interpolateRoutePoint(86);
  const result = evaluateGPSLocation(point.lat, point.lng, 'stationary', 'Driver', 'السائق', 'to_kufr_malik');
  assert.equal(result.bearing, 'stationary');
  assert.equal(result.status, 'to_kufr_malik');
  assert.ok(!/entering|leaving/.test(result.proximityTextEn));
});

test('terminal arrival remains stationary regardless of the previous movement', () => {
  for (const [progress, status] of [[0, 'in_kufr_malik'], [100, 'in_ramallah']] as const) {
    const point = interpolateRoutePoint(progress);
    const result = evaluateGPSLocation(point.lat, point.lng, 'northbound');
    assert.equal(result.bearing, 'stationary');
    assert.equal(result.status, status);
  }
});
