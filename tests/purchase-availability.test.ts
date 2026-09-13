import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

test('purchase feedback is read-only and agrees with the transaction at the fractional threshold', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.buy('ruby');
  w.player.gold = 499.99;
  const before = w.snapshot();
  expect(w.purchaseError('belt')).toBe('Not enough gold');
  expect(w.snapshot()).toBe(before);
  expect(w.buy('belt')).toBe(w.purchaseError('belt'));
  expect(w.snapshot()).toBe(before);
  w.player.gold = 500;
  expect(w.purchaseError('belt')).toBeNull();
  expect(w.buy('belt')).toBeNull();
  expect(w.player.gold).toBe(0);
});
