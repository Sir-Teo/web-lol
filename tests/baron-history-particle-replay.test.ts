import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import { BaronAttackSystem } from '../src/render/baron-attack-system';
import type { BaronAttackVisual, BaronFlightFrame } from '../src/simulation/baron-attack-visuals';
import type { BaronAttackProgram } from '../src/render/baron-attack-program';
const program = JSON.parse(
  readFileSync('public/assets/effects/baron-attack/program.json', 'utf8')
) as BaronAttackProgram;
const field = {
  ...PRACTICE_FIXTURE,
  developmentBaron: true as const,
  lineOfSight: () => true,
  half: 10000,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  lineWalkable: () => true,
  findPath: (_from: { x: number; y: number }, to: { x: number; y: number }) => [{ ...to }],
};
const system = () =>
  new BaronAttackSystem(program, 'missile', 719, {
    capacity: 512,
    birthFactors: () => ({ birthScale: 1, emitOffset: 1 }),
  });
function step(
  s: BaronAttackSystem,
  visual: BaronAttackVisual,
  frame: BaronFlightFrame,
  previous?: BaronFlightFrame
) {
  s.step({
    dt: 1 / 60,
    origin: [frame.x, 0, frame.y],
    moved: previous ? [frame.x - previous.x, 0, frame.y - previous.y] : [0, 0, 0],
    orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    stopped: visual.stopTick !== null && frame.tick >= visual.stopTick,
  });
}
test('a long-range saved launch prefix reconstructs the exact particle stream and future', () => {
  const w = createBaronEncounter(field),
    baron = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, baron, 1, 'true');
  w.step();
  w.step(baron.releaseTick! - w.tick);
  const visual = w.baronAttackVisuals[0],
    live = system();
  let previous: BaronFlightFrame | undefined;
  const advance = () => {
    const frame = visual.frames.at(-1)!;
    step(live, visual, frame, previous);
    previous = frame;
  };
  advance();
  for (let tick = 0; tick < 115; tick++) {
    const p = w.projectiles.find((p) => p.id === visual.id)!;
    w.hero.x = p.x - 3500;
    w.hero.y = p.y;
    w.step();
    advance();
  }
  expect(visual.frames.length).toBeGreaterThan(90);
  expect(visual.frames[0].tick).toBe(visual.launchTick);
  const saved = w.snapshot(),
    restored = World.fromSnapshot(saved, w.battlefield),
    history = restored.baronAttackVisuals.find((p) => p.id === visual.id)!,
    rebuilt = system();
  for (let i = 0; i < history.frames.length; i++)
    step(rebuilt, history, history.frames[i], history.frames[i - 1]);
  expect(rebuilt.checkpoint()).toEqual(live.checkpoint());
  expect(rebuilt.packets()).toEqual(live.packets());
  expect(w.snapshot()).toBe(saved);
  for (let tick = 0; tick < 20; tick++) {
    const p = w.projectiles.find((p) => p.id === visual.id)!;
    w.hero.x = p.x - 3500;
    w.hero.y = p.y;
    w.step();
    const frame = visual.frames.at(-1)!;
    step(rebuilt, visual, frame, previous);
    advance();
    expect(rebuilt.checkpoint()).toEqual(live.checkpoint());
  }
  const corrupted = JSON.parse(saved);
  corrupted.baronAttackVisuals.find((p: BaronAttackVisual) => p.id === visual.id).frames.shift();
  expect(() => World.fromSnapshot(JSON.stringify(corrupted), w.battlefield)).toThrow();
});
