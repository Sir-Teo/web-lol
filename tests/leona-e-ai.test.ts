import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { distance } from '../src/simulation/math';

function setup(team: 'blue' | 'red' = 'blue', learned = true) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona'),
    enemy = w.spawn('champion', team === 'blue' ? 'red' : 'blue', { x: 600, y: 0 });
  leona.ai = enemy.ai = false;
  leona.speed = 0;
  enemy.magicResist = 0;
  const state = w.championState(leona.id)!;
  w.learnSpell(learned ? 'e' : 'q', leona.id);
  state.cooldowns.d = state.cooldowns.f = Infinity;
  w.applyRoot(enemy, 60);
  const think = () => {
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
  };
  const queued = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === leona.id && c.ability === 'e');
  return { w, leona, enemy, state, think, queued };
}
for (const team of ['blue', 'red'] as const)
  test(`${team} Leona follows an isolated visible catch through paid E damage, root, dash and exact saved futures`, () => {
    const f = setup(team);
    if (team === 'red') {
      f.enemy.rootUntil = 0;
      f.w.applyStun(f.enemy, 60);
    }
    const hp = f.enemy.hp;
    f.think();
    expect(f.queued()).toEqual([
      { type: 'cast', unit: f.leona.id, ability: 'e', point: { x: 600, y: 0 } },
    ]);
    const saved = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    for (const world of [f.w, saved]) world.step();
    expect(f.state.leonaEWindup).not.toBeNull();
    expect(f.leona.mana).toBeLessThan(f.leona.maxMana - 39);
    expect(f.state.cooldowns.e).toBeGreaterThan(f.w.tick);
    for (const world of [f.w, saved]) world.step(42);
    expect(saved.snapshot()).toBe(f.w.snapshot());
    expect(f.enemy.hp).toBeLessThan(hp - 49); // Regeneration continues after contact.
    expect(f.enemy.rootUntil).toBeGreaterThan(60);
    expect(f.state.leonaDash?.targetId).toBe(f.enemy.id);
    const dashing = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    for (const world of [f.w, saved, dashing]) world.step(35);
    expect(saved.snapshot()).toBe(f.w.snapshot());
    expect(dashing.snapshot()).toBe(f.w.snapshot());
    expect(f.state.leonaDash).toBeNull();
    expect(distance(f.leona, f.enemy)).toBeCloseTo(f.leona.radius + f.enemy.radius, 6);
    expect(f.enemy.sunlight?.sourceId).toBe(f.leona.id);
    expect(f.state.leonaEVisuals.at(-1)?.dash?.endReason).toBe('arrived');
  });

test('E follow-up rejects hidden/mobile/briefly held/out-of-range targets and unavailable or retreating actors', () => {
  for (const condition of [
    'hidden',
    'mobile',
    'short',
    'melee',
    'range',
    'mana',
    'unlearned',
    'silence',
    'stun',
    'root',
    'cooldown',
    'retreat',
  ]) {
    const f = setup('blue', condition !== 'unlearned');
    if (condition === 'hidden') f.w.battlefield.lineOfSight = () => false;
    if (condition === 'mobile') f.enemy.rootUntil = 0;
    if (condition === 'short') f.enemy.rootUntil = 20;
    if (condition === 'melee') f.enemy.x = 150;
    if (condition === 'range') f.enemy.x = 1000;
    if (condition === 'mana') f.leona.mana = 39;
    if (condition === 'silence') f.leona.silenceUntil = 1000;
    if (condition === 'stun') f.leona.stunUntil = 1000;
    if (condition === 'root') f.leona.rootUntil = 1000;
    if (condition === 'cooldown') f.state.cooldowns.e = 1000;
    if (condition === 'retreat') f.leona.hp = f.leona.maxHp * 0.2;
    f.think();
    expect(f.queued(), condition).toHaveLength(0);
    expect(f.state.leonaEWindup, condition).toBeNull();
  }
});

test('an additional observed champion prevents the isolated catch even without enough damage to trigger disengage', () => {
  const f = setup(),
    other = f.w.spawn('champion', 'red', { x: 600, y: 300 });
  other.ai = false;
  other.damage = 0;
  f.think();
  expect(f.queued()).toHaveLength(0);
});

test('an unseen additional champion cannot supply an isolation veto', () => {
  const f = setup(),
    other = f.w.spawn('champion', 'red', { x: 600, y: 300 });
  other.ai = false;
  other.damage = 0;
  f.w.battlefield.lineOfSight = (_a, b) => b.y < 100;
  expect(f.w.visible(other, 'blue')).toBe(false);
  expect(f.w.visible(f.enemy, 'blue')).toBe(true);
  f.think();
  expect(f.queued()).toHaveLength(1);
});

test('the actual near-edge dash landing is checked against a visible turret', () => {
  const f = setup(),
    scout = f.w.spawn('champion', 'blue', { x: 1100, y: 200 }),
    tower = f.w.spawn('turret', 'red', { x: 1400, y: 0 });
  scout.ai = false;
  tower.range = 750;
  expect(f.w.visible(tower, 'blue')).toBe(true);
  f.think();
  expect(f.queued()).toHaveLength(0);
});

test('E refuses blocked paths or a landing requiring terrain correction', () => {
  for (const corrected of [false, true]) {
    const f = setup();
    if (corrected) f.w.battlefield.reachable = (p) => ({ x: p.x + 100, y: p.y });
    else f.w.battlefield.lineWalkable = () => false;
    f.think();
    expect(f.queued()).toHaveLength(0);
  }
});

test('a committed melee windup remains intact while a different visible catch is available', () => {
  const f = setup(),
    minion = f.w.spawn('melee', 'red', { x: 150, y: 0 });
  minion.ai = false;
  f.w.setOrder(f.leona, { type: 'attack', target: minion.id });
  f.w.step();
  const release = f.leona.releaseTick;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.leona.releaseTick).toBe(release);
});

test('an existing outward Zenith flight cannot be duplicated even if its cooldown is reset', () => {
  const f = setup();
  f.w.applyRoot(f.enemy, 180);
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'e', point: f.enemy });
  f.w.step(16);
  expect(f.w.projectiles.some((p) => p.type === 'zenith')).toBe(true);
  f.state.cooldowns.e = 0;
  f.think();
  expect(f.queued()).toHaveLength(0);
  expect(f.state.leonaEVisuals).toHaveLength(1);
});

for (const mana of [90, 150])
  test(`queued W retains its mana priority before E at ${mana} mana`, () => {
    const f = setup();
    f.w.gainExperience(280, f.leona.id);
    f.w.learnSpell('w', f.leona.id);
    f.w.applyRoot(f.enemy, 180);
    f.leona.mana = mana;
    f.w.setOrder(f.enemy, { type: 'attack', target: f.leona.id });
    f.w.step();
    f.think();
    expect(
      f.w.commands.filter((c) => c.type === 'cast' && c.unit === f.leona.id && c.ability === 'w')
    ).toHaveLength(1);
    expect(f.queued()).toHaveLength(mana === 90 ? 0 : 1);
    f.w.step();
    expect(f.state.leonaW).not.toBeNull();
    expect(f.state.leonaEWindup !== null).toBe(mana === 150);
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
    f.w.step(70);
    copy.step(70);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  });

test('the queued observed E point cannot track a target after sight is lost', () => {
  const f = setup();
  f.think();
  expect(f.queued()).toHaveLength(1);
  f.enemy.y = 300;
  f.w.battlefield.lineOfSight = () => false;
  f.w.step();
  expect(f.state.leonaEWindup?.direction).toEqual({ x: 1, y: 0 });
  f.w.step(44);
  expect(f.state.leonaDash).toBeNull();
  expect(f.state.leonaEVisuals.at(-1)?.flight?.contacts).toEqual([]);
  expect(f.leona.mana).toBeLessThan(f.leona.maxMana - 39);
});

test('accepting E holds the evaluated launch position until next-tick dispatch', () => {
  const f = setup();
  f.leona.speed = 335;
  f.w.setOrder(f.leona, { type: 'move', point: { x: 0, y: 1000 } });
  f.think();
  expect(f.queued()).toHaveLength(1);
  expect({ x: f.leona.x, y: f.leona.y }).toEqual({ x: 0, y: 0 });
  expect(f.leona.order.type).toBe('idle');
  f.w.step();
  expect(f.state.leonaEWindup?.direction).toEqual({ x: 1, y: 0 });
});
