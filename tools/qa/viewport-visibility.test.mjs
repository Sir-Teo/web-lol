import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorInsideViewport } from './viewport-visibility.mjs';

test('depth-visible offscreen anchors are excluded on all four viewport edges', () => {
  for (const [x, y] of [
    [-0.01, 400],
    [1280.01, 400],
    [640, -0.01],
    [640, 800.01],
  ]) {
    assert.equal(anchorInsideViewport({ x, y, visible: true }, 1280, 800), false);
  }
});
test('the center and inclusive viewport boundaries count while depth-clipped anchors do not', () => {
  for (const [x, y] of [
    [640, 400],
    [0, 0],
    [1280, 0],
    [0, 800],
    [1280, 800],
  ]) {
    assert.equal(anchorInsideViewport({ x, y, visible: true }, 1280, 800), true);
    assert.equal(anchorInsideViewport({ x, y, visible: false }, 1280, 800), false);
  }
});
test('invalid projected coordinates do not count as on-screen observations', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(anchorInsideViewport({ x: value, y: 400, visible: true }, 1280, 800), false);
    assert.equal(anchorInsideViewport({ x: 640, y: value, visible: true }, 1280, 800), false);
  }
});
