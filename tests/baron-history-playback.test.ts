import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { BaronHistoryPlayback } from '../src/render/baron-history-playback';
import type { BaronAttackProgram } from '../src/render/baron-attack-program';
const program = JSON.parse(
  readFileSync('public/assets/effects/baron-attack/program.json', 'utf8')
) as BaronAttackProgram;
const options = { capacity: 512, birthFactors: () => ({ birthScale: 1, emitOffset: 1 }) };
const root = (tick: number) => ({
  origin: [tick * 3, 100, Math.sin(tick * 0.05) * 100],
  orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  stopped: tick >= 170,
  visible: tick >= 120,
});
for (const role of ['missile', 'hit'] as const) {
  test(`${role} sequential, skipped, fractional and restored playback agree`, () => {
    const live = new BaronHistoryPlayback(program, role, 719, 100, options),
      copy = new BaronHistoryPlayback(program, role, 719, 100, options);
    for (let tick = 100; tick < 150; tick++) {
      live.sample(tick, root);
      live.sample(tick + 0.2, root);
      live.sample(tick + 0.9, root);
    }
    expect(live.completedTicks).toBe(49);
    for (const tick of [150, 150.25, 170.9, 200, 130.5, 131, 180])
      expect(live.sample(tick, root)).toEqual(copy.sample(tick, root));
  });
  test(`${role} hidden births consume RNG but cannot become visible on reveal`, () => {
    const hidden = new BaronHistoryPlayback(program, role, 1, 100, options),
      seen = new BaronHistoryPlayback(program, role, 1, 100, options);
    const a = hidden.sample(125, root),
      b = seen.sample(125, (tick) => ({ ...root(tick), visible: true }));
    expect(a.packets).toEqual(b.packets);
    expect(a.bornVisible.size).toBeLessThan(b.bornVisible.size);
    for (const packet of a.packets)
      expect(a.bornVisible.has(packet.serial)).toBe(packet.birthTime * 60 >= 20 - 1e-4);
  });
}
test('fractional drafts and caller mutations never change committed futures', () => {
  const a = new BaronHistoryPlayback(program, 'missile', 777, 0, options),
    b = new BaronHistoryPlayback(program, 'missile', 777, 0, options);
  const output = a.sample(10.5, root);
  expect(a.completedTicks).toBe(10);
  output.packets[0].position.fill(999);
  output.bornVisible.clear();
  expect(a.sample(10.5, root)).toEqual(b.sample(10.5, root));
  expect(a.sample(20, root)).toEqual(b.sample(20, root));
});
test('clock bounds and invalid roots reject without inventing missing history', () => {
  expect(() => new BaronHistoryPlayback(program, 'hit', 1, -1, options)).toThrow();
  const a = new BaronHistoryPlayback(program, 'hit', 1, 0, options);
  expect(a.sample(-1, root).packets).toEqual([]);
  for (const tick of [NaN, Infinity, 313]) expect(() => a.sample(tick, root)).toThrow();
  expect(() => a.sample(1, () => ({ ...root(1), origin: [NaN, 0, 0] }))).toThrow();
  expect(a.completedTicks).toBe(0);
});
