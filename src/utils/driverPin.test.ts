import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDriverPin, matchesDriverPin } from './driverPin';

test('changed driver PIN rejects default and administrator shortcuts', () => {
  const driver = { pinCode: '5826' };
  assert.equal(matchesDriverPin(driver, '5826'), true);
  for (const pin of ['1234', '9999', '', '582', '58260', ' 5826']) {
    assert.equal(matchesDriverPin(driver, pin), false);
  }
});

test('default and administrator numbers work only when explicitly assigned to that profile', () => {
  for (const pin of ['1234', '9999']) {
    assert.equal(matchesDriverPin({ pinCode: pin }, pin), true);
    assert.equal(matchesDriverPin({ pinCode: '5826' }, pin), false);
  }
});

test('existing four to six digit PINs keep leading zeroes and remain usable', () => {
  for (const pin of ['0042', '01234', '001234']) {
    assert.equal(isValidDriverPin(pin), true);
    assert.equal(matchesDriverPin({ pinCode: pin }, pin), true);
    assert.equal(matchesDriverPin({ pinCode: pin }, String(Number(pin))), false);
  }
});

test('missing profiles and malformed stored PINs never grant access', () => {
  assert.equal(matchesDriverPin(undefined, '1234'), false);
  for (const pin of ['', '123', '1234567', '12a4', '１２３４', '1234 ', null, 1234]) {
    assert.equal(isValidDriverPin(pin), false);
    assert.equal(matchesDriverPin({ pinCode: pin as string }, pin as string), false);
  }
});
