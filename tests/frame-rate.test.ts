import { expect, test } from 'vitest';
import { FrameRate } from '../src/render/frame-rate';
import { FramePacer } from '../src/render/frame-pacer';

test.each([2, 5, 30, 60])('reports %i rendered frames per wall-clock second', (hz) => {
  const rate = new FrameRate();
  expect(rate.value).toBeNull();
  for (let i = 0; i <= hz * 2; i++) rate.record((i * 1000) / hz);
  expect(rate.value).toBeCloseTo(hz, 8);
});

test('includes the full duration of an active rendering stall', () => {
  const rate = new FrameRate();
  rate.record(0);
  rate.record(10000);
  expect(rate.value).toBe(0.1);
});

test('waits for a complete observation window', () => {
  const rate = new FrameRate();
  for (const now of [0, 100, 200, 300, 499]) rate.record(now);
  expect(rate.value).toBeNull();
  rate.record(500);
  expect(rate.value).toBe(10);
});

test('resuming excludes idle time and abandons a partial earlier window', () => {
  const rate = new FrameRate();
  for (const now of [0, 100, 200, 300, 400, 500, 600]) rate.record(now);
  expect(rate.value).toBe(10);
  rate.reset();
  rate.record(60000);
  expect(rate.value).toBe(10);
  rate.record(60250);
  rate.record(60500);
  expect(rate.value).toBe(4);
});

test('counts only frames admitted by the presentation pacer', () => {
  const rate = new FrameRate(),
    pacer = new FramePacer();
  for (let i = 0; i <= 1440; i++) {
    const now = (i * 1000) / 144;
    if (pacer.ready(now)) rate.record(now);
  }
  expect(rate.value).toBeGreaterThan(58);
  expect(rate.value).toBeLessThan(62);
});
