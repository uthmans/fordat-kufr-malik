import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutRoutePins } from './routePinLayout';

describe('route labels', () => {
  for (const width of [0, 120, 232, 300, 420]) {
    for (const progress of [[4, 4, 37, 53, 96, 96, 96], Array(12).fill(96), Array(12).fill(4), []]) {
      test(`contains and separates ${progress.length} labels in ${width}px`, () => {
        const positions = progress.map((value, i) => ({ id: String(i), progress: value }));
        const { pins, labelWidth, height } = layoutRoutePins(positions, width);
        assert.equal(pins.length, positions.length);
        for (const pin of pins) {
          assert.ok(pin.left >= 0);
          assert.ok(pin.left + labelWidth <= width);
          assert.ok(height - 48 - pin.lane * 40 >= 0);
          assert.equal(pin.anchor, positions.find((p) => p.id === pin.id)!.progress / 100 * width);
          for (const other of pins.filter((p) => p.id !== pin.id && p.lane === pin.lane)) {
            assert.ok(Math.abs(pin.left - other.left) >= labelWidth + 8);
          }
        }
        assert.deepEqual(layoutRoutePins([...positions].reverse(), width), { pins, labelWidth, height });
      });
    }
  }
});
