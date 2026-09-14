import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup(learn = true) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  const state = w.championState(garen.id)!;
  if (learn) w.learnSpell('w', garen.id);
  const minion = () => {
    const target = w.spawn('melee', 'blue', { x: 150, y: 0 });
    target.experienceBounty = 0;
    target.goldBounty = 0;
    target.speed = 0;
    w.damage(garen, target, 100000, 'true');
    return target;
  };
  return { w, garen, state, minion };
}

test('Courage gains separate capped stacks and changes actual incoming damage', () => {
  const { w, garen, state, minion } = setup();
  for (let i = 0; i < 149; i++) minion();
  expect(state.garenCourageStacks).toBe(149);
  expect(garen.armor).toBe(67.8);
  expect(garen.magicResist).toBe(61.8);
  for (let i = 0; i < 3; i++) minion();
  expect(state.cs).toBe(152);
  expect(state.garenCourageStacks).toBe(150);
  expect(garen.armor).toBe(68);
  expect(garen.magicResist).toBe(62);
  const hp = garen.hp;
  w.damage(w.hero, garen, 100, 'physical');
  expect(hp - garen.hp).toBeCloseTo(100 / 1.68);
});

test('kills before learning W are banked and apply once when the first rank is learned', () => {
  const { w, garen, state, minion } = setup(false);
  minion();
  minion();
  minion();
  expect(state.garenCourageStacks).toBe(3);
  expect(garen.armor).toBe(38);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    expect(world.learnSpell('w', garen.id)).toBeNull();
    expect(world.unit(garen.id)!.armor).toBe(38.6);
    expect(world.unit(garen.id)!.magicResist).toBe(32.6);
    world.gainExperience(1000, garen.id);
    const armor = world.unit(garen.id)!.armor;
    expect(world.learnSpell('w', garen.id)).toBeNull();
    expect(world.unit(garen.id)!.armor).toBe(armor);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('stacks survive death, respawn and repeated checkpoint restoration without duplication', () => {
  const { w, garen, state, minion } = setup();
  minion();
  minion();
  const armor = garen.armor;
  w.damage(w.hero, garen, 100000, 'true');
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  const duration = garen.respawnTick! - w.tick;
  for (const world of [w, saved]) {
    world.step(duration);
    expect(world.championState(garen.id)!.garenCourageStacks).toBe(2);
    expect(world.unit(garen.id)!.armor).toBe(armor);
  }
  expect(state.garenW).toBeNull();
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(World.fromSnapshot(saved.snapshot(), w.battlefield).unit(garen.id)!.armor).toBe(armor);
});

test('champion kill credit grants one stack; assists, dummies, structures and duplicate deaths do not', () => {
  const { w, garen, state, minion } = setup();
  const victim = w.spawn('champion', 'blue', { x: 150, y: 0 }, 'lux');
  w.damage(garen, victim, 100000, 'true');
  expect(state.garenCourageStacks).toBe(1);
  const dead = minion();
  w.damage(garen, dead, 100000, 'true');
  expect(state.garenCourageStacks).toBe(2);
  for (const kind of ['dummy', 'turret'] as const) {
    const target = w.spawn(kind, 'blue', { x: 300, y: 0 });
    w.damage(garen, target, 100000, 'true');
  }
  const other = w.spawn('champion', 'blue', { x: 300, y: 0 }, 'lux');
  const ally = w.spawn('champion', 'red', { x: 100, y: 0 }, 'lux');
  w.damage(garen, other, 1, 'true');
  w.damage(ally, other, 100000, 'true');
  expect(state.assists).toBe(1);
  expect(state.garenCourageStacks).toBe(2);
});

test('stack saves reject missing, foreign, fractional, negative and above-cap counters', () => {
  const { w, minion } = setup();
  minion();
  for (const value of [undefined, -1, 0.5, 151]) {
    const snapshot = JSON.parse(w.snapshot());
    snapshot.otherChampions[0].garenCourageStacks = value;
    expect(() => World.fromSnapshot(JSON.stringify(snapshot), w.battlefield)).toThrow();
  }
  const foreign = JSON.parse(w.snapshot());
  foreign.player.garenCourageStacks = 1;
  expect(() => World.fromSnapshot(JSON.stringify(foreign), w.battlefield)).toThrow();
});
