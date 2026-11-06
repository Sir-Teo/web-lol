import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { ChampionIdentity } from '../src/simulation/types';

function setup(champion: ChampionIdentity = 'lux') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    inBrush: () => false,
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
  const target = w.spawn('champion', 'red', { x: 400, y: 0 }, champion);
  target.ai = false;
  const owner = w.championState(target.id)!;
  const launch = () => w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: target });
  const impact = () => {
    for (let i = 0; i < 90 && !target.stunUntil; i++) w.step();
    expect(target.stunUntil).toBeGreaterThan(w.tick);
  };
  const resume = () => {
    const saved = w.snapshot();
    const copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(180);
    copy.step(180);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, target, owner, launch, impact, resume };
}

test('a short-range Crystal Arrow cannot shorten a longer existing stun', () => {
  const { w, target, launch, resume } = setup();
  w.applyStun(target, 240);
  const deadline = target.stunUntil;
  launch();
  for (let i = 0; i < 90 && target.hp === target.maxHp; i++) w.step();
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(target.stunUntil).toBe(deadline);
  resume();
});

test('Crystal Arrow interrupts Meditate at the impact tick with a restorable control ending', () => {
  const { w, target, owner, launch, impact, resume } = setup('masteryi');
  expect(w.learnSpell('w', target.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: target.id, ability: 'w', point: target });
  w.step();
  expect(owner.meditate?.stopTick).toBeNull();
  launch();
  impact();
  expect(owner.meditate?.stopTick).toBe(w.tick);
  expect(owner.meditate?.stopReason).toBe('control');
  resume();
});

test('Crystal Arrow stops an active Spirit Rush at contact and preserves its saved control facts', () => {
  const { w, target, launch, impact, resume } = setup('ahri');
  w.gainExperience(1e6, target.id);
  expect(w.learnSpell('r', target.id)).toBeNull();
  launch();
  for (let i = 0; i < 90; i++) {
    const arrow = w.projectiles.find((p) => p.type === 'ultimate');
    if (arrow && target.x - arrow.x < 140) break;
    w.step();
  }
  expect(target.stunUntil).toBe(0);
  w.enqueue({ type: 'cast', unit: target.id, ability: 'r', point: { x: target.x, y: 500 } });
  w.step();
  impact();
  const dash = w.ahriRushes[0]?.bursts[0];
  expect(dash?.stopTick).toBe(w.tick);
  expect(dash?.stopReason).toBe('control');
  resume();
});

test('Crystal Arrow stops Zenith Blade during travel at the impact tick', () => {
  const { w, target, owner, resume } = setup('leona');
  Object.assign(w.hero, { x: 550, y: -500, previous: { x: 550, y: -500 } });
  const victim = w.spawn('champion', 'blue', { x: 1200, y: 0 }, 'lux');
  victim.ai = false;
  expect(w.learnSpell('e', target.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: target.id, ability: 'e', point: victim });
  w.step(15);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: { x: 550, y: 200 } });
  for (let i = 0; i < 60 && !owner.leonaDash; i++) w.step();
  expect(owner.leonaDash).not.toBeNull();
  for (let i = 0; i < 30 && !target.stunUntil; i++) w.step();
  expect(target.stunUntil).toBeGreaterThan(w.tick);
  expect(owner.leonaDash).toBeNull();
  expect(owner.leonaEVisuals.at(-1)?.dash?.stopTick).toBe(w.tick);
  resume();
});

test('Crystal Arrow retains Courage tenacity when dispatched through the shared handler', () => {
  const { w, target, launch, impact, resume } = setup('garen');
  expect(w.learnSpell('w', target.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: target.id, ability: 'w', point: target });
  w.step();
  launch();
  impact();
  expect(target.stunUntil - w.tick).toBe(24);
  resume();
});
