import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { assignRole } from '../src/simulation/bot-jungle';

function setup(team: 'blue' | 'red' = 'blue', otherIdentity: 'lux' | 'ahri' = 'lux') {
  const sign = team === 'blue' ? 1 : -1;
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -2500, y: 0 }, red: { x: 2500, y: 0 } },
    inBrush: () => false,
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const enemyTeam = team === 'blue' ? 'red' : 'blue';
  const leona = w.spawn('champion', team, { x: 0, y: 0 }, 'leona');
  const carry = w.spawn('champion', team, { x: 300 * sign, y: 0 }, 'ashe');
  const target = w.spawn('champion', enemyTeam, { x: 650 * sign, y: 0 }, 'ashe');
  const other = w.spawn('champion', enemyTeam, { x: 650 * sign, y: 350 }, otherIdentity);
  for (const u of [leona, carry, target, other]) u.ai = false;
  assignRole(w.championState(leona.id)!, 'support');
  assignRole(w.championState(carry.id)!, 'carry');
  w.gainExperience(660, leona.id);
  for (const ability of ['q', 'e', 'w'] as const)
    expect(w.learnSpell(ability, leona.id)).toBeNull();
  const state = w.championState(leona.id)!;
  state.cooldowns.d = state.cooldowns.f = Infinity;
  w.setOrder(carry, { type: 'attack', target: target.id });
  const think = () => {
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
  };
  const queued = () =>
    w.commands.filter((c) => c.type === 'cast' && c.unit === leona.id && c.ability === 'e');
  return { w, leona, carry, target, other, state, sign, think, queued };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} support joins an actual allied attack on an unheld moving target through paid E and exact saved futures`, () => {
    const f = setup(team),
      hp = f.target.hp;
    f.w.setOrder(f.target, { type: 'move', point: { x: 550 * f.sign, y: 0 } });
    f.think();
    expect(f.queued()).toEqual([
      { type: 'cast', unit: f.leona.id, ability: 'e', point: { x: 650 * f.sign, y: 0 } },
    ]);
    expect(f.target.rootUntil).toBe(0);
    expect(f.target.stunUntil).toBe(0);
    const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield),
      before = f.leona.mana;
    f.w.step();
    copy.step();
    expect(f.state.leonaEWindup).not.toBeNull();
    expect(f.leona.mana).toBeLessThan(before - 39);
    expect(f.state.cooldowns.e).toBeGreaterThan(f.w.tick);
    let root = false,
      sunlight = false;
    for (let i = 0; i < 120; i++) {
      f.w.step();
      copy.step();
      root ||= f.target.rootUntil > f.w.tick;
      sunlight ||= f.target.sunlight?.sourceId === f.leona.id;
    }
    expect(copy.snapshot()).toBe(f.w.snapshot());
    expect(root).toBe(true);
    expect(sunlight).toBe(true);
    expect(f.target.hp).toBeLessThan(hp - 49);
    expect(f.state.leonaEVisuals.some((v) => v.dash?.endReason === 'arrived')).toBe(true);
    expect(
      f.w.events.some((e) => e.type === 'cast' && e.unit === f.leona.id && e.text === 'q')
    ).toBe(true);
  });

for (const unavailable of [
  'idle',
  'distant',
  'stunned',
  'charmed',
  'retreating',
  'injured',
  'dead',
] as const)
  test(`an ${unavailable} ally does not authorize the mobile-target engage`, () => {
    const f = setup('blue', unavailable === 'charmed' ? 'ahri' : 'lux');
    if (unavailable === 'idle') f.w.setOrder(f.carry, { type: 'idle' });
    if (unavailable === 'distant') f.carry.x = -500;
    if (unavailable === 'stunned') f.w.applyStun(f.carry, 100);
    if (unavailable === 'charmed') {
      const ahri = f.other;
      ahri.x = f.carry.x - 150;
      ahri.y = 0;
      f.w.learnSpell('e', ahri.id);
      f.w.enqueue({ type: 'cast', unit: ahri.id, ability: 'e', point: f.carry });
      f.leona.nextThink = Infinity;
      f.w.step(30);
      expect(f.carry.charm).toBeTruthy();
    }
    if (unavailable === 'retreating') f.carry.aiRetreating = true;
    if (unavailable === 'injured') f.carry.hp = f.carry.maxHp * 0.4;
    if (unavailable === 'dead') f.w.damage(f.target, f.carry, 1e6, 'true');
    f.think();
    expect(f.queued()).toHaveLength(0);
  });

for (const mana of [100, 140])
  test(`a supported engage preserves Q and ready W resources at ${mana} mana`, () => {
    const f = setup();
    f.leona.mana = mana;
    f.think();
    expect(f.queued()).toHaveLength(mana === 140 ? 1 : 0);
  });

test('a W already queued against a real incoming attack is reserved once before supported E', () => {
  const f = setup();
  f.other.x = 300;
  f.other.y = 200;
  f.other.damage = 1;
  f.w.setOrder(f.other, { type: 'attack', target: f.leona.id });
  f.w.step();
  expect(f.other.releaseTick).not.toBeNull();
  f.leona.mana = 140;
  f.think();
  expect(
    f.w.commands
      .filter((c) => c.type === 'cast' && c.unit === f.leona.id)
      .map((c) => c.type === 'cast' && c.ability)
  ).toEqual(['w', 'e']);
  f.w.step();
  expect(f.state.leonaW).not.toBeNull();
  expect(f.state.leonaEWindup).not.toBeNull();
  expect(f.leona.mana).toBeGreaterThanOrEqual(30);
  expect(f.leona.mana).toBeLessThan(41);
});

test('an already armed Q supplies follow-through without a second mana reservation', () => {
  const f = setup();
  f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: f.leona });
  f.w.step();
  expect(f.state.leonaQ).not.toBeNull();
  expect(f.state.cooldowns.q).toBeGreaterThan(f.w.tick);
  f.leona.mana = 105;
  f.think();
  expect(f.queued()).toHaveLength(1);
});

test('an unavailable Q prevents a new mobile-target engage', () => {
  const f = setup();
  f.state.cooldowns.q = 1000;
  f.think();
  expect(f.queued()).toHaveLength(0);
});

test('an observed later champion along the complete ray vetoes the intended landing', () => {
  const f = setup();
  f.other.x = 800;
  f.other.y = 0;
  f.think();
  expect(f.queued()).toHaveLength(0);
});

test('an earlier champion contact still permits the intended last champion landing', () => {
  const f = setup();
  f.other.x = 450;
  f.other.y = 0;
  f.think();
  expect(f.queued()).toHaveLength(1);
});

for (const hidden of [false, true])
  test(`${hidden ? 'unseen' : 'observed'} reinforcements respect the support numbers boundary`, () => {
    const f = setup();
    const extra = f.w.spawn('champion', 'red', { x: 650, y: -350 });
    extra.ai = false;
    if (hidden) f.w.battlefield.lineOfSight = (_a, b) => b.y >= 0;
    expect(f.w.visible(extra, 'blue')).toBe(!hidden);
    f.think();
    expect(f.queued()).toHaveLength(hidden ? 1 : 0);
  });

for (const unsafe of [
  'injured',
  'role',
  'hidden-target',
  'wall',
  'corrected-landing',
  'tower',
] as const)
  test(`the ${unsafe} boundary prevents the supported engage`, () => {
    const f = setup();
    if (unsafe === 'injured') f.leona.hp = f.leona.maxHp * 0.6;
    if (unsafe === 'role') assignRole(f.state, 'mid');
    if (unsafe === 'hidden-target') f.w.battlefield.lineOfSight = (_a, b) => b.x < 500;
    if (unsafe === 'wall') f.w.battlefield.lineWalkable = () => false;
    if (unsafe === 'corrected-landing')
      f.w.battlefield.reachable = (p) => ({ x: p.x + 100, y: p.y });
    if (unsafe === 'tower') {
      const tower = f.w.spawn('turret', 'red', { x: 1300, y: 0 });
      tower.range = 750;
      expect(f.w.visible(tower, 'blue')).toBe(true);
    }
    f.think();
    expect(f.queued()).toHaveLength(0);
  });

test('the copied supported aim can miss a later displaced target without a homing dash', () => {
  const f = setup();
  f.think();
  expect(f.queued()).toHaveLength(1);
  f.target.y = 500;
  const saved = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  let rooted = false,
    dashed = false;
  for (let tick = 0; tick < 120; tick++) {
    f.w.step();
    saved.step();
    rooted ||= f.target.rootUntil > f.w.tick;
    dashed ||= f.state.leonaDash !== null;
  }
  expect(saved.snapshot()).toBe(f.w.snapshot());
  expect(rooted).toBe(false);
  expect(dashed).toBe(false);
  expect(f.target.rootUntil).toBe(0);
  expect(f.state.leonaDash).toBeNull();
  expect(f.state.leonaEVisuals.every((v) => !v.dash)).toBe(true);
});

test('normal target travel during the outward flight is included in the known-tower margin', () => {
  const f = setup(),
    scout = f.w.spawn('champion', 'blue', { x: 1100, y: 200 }),
    tower = f.w.spawn('turret', 'red', { x: 1600, y: 0 });
  scout.ai = false;
  tower.range = 750;
  expect(f.w.visible(tower, 'blue')).toBe(true);
  expect((f.w as any).threateningTower(f.leona, { x: 580, y: 0 }, true)).toBeUndefined();
  f.think();
  expect(f.queued()).toHaveLength(0);
});

test('an unseen later contact cannot veto the observed supported aim', () => {
  const f = setup();
  f.other.x = 800;
  f.other.y = 0;
  f.w.battlefield.lineOfSight = (_a, b) => b.x < 700;
  expect(f.w.visible(f.other, 'blue')).toBe(false);
  expect(f.w.visible(f.target, 'blue')).toBe(true);
  f.think();
  expect(f.queued()).toHaveLength(1);
});

for (const mana of [105, 140])
  test(`an expiring prepared Q reserves a replacement before queued W and E at ${mana} mana`, () => {
    const f = setup();
    f.w.enqueue({ type: 'cast', unit: f.leona.id, ability: 'q', point: f.leona });
    f.w.step();
    f.w.setOrder(f.carry, { type: 'idle' });
    f.w.step(330);
    expect(f.state.leonaQ!.endTick - f.w.tick).toBeLessThanOrEqual(30);
    expect(f.state.cooldowns.q).toBeLessThanOrEqual(f.w.tick);
    f.other.x = 300;
    f.other.y = 200;
    f.other.damage = 1;
    f.w.setOrder(f.other, { type: 'attack', target: f.leona.id });
    f.w.step();
    expect(f.other.releaseTick).not.toBeNull();
    f.w.setOrder(f.carry, { type: 'attack', target: f.target.id });
    f.leona.mana = mana;
    f.think();
    expect(
      f.w.commands
        .filter((c) => c.type === 'cast' && c.unit === f.leona.id)
        .map((c) => c.type === 'cast' && c.ability)
    ).toEqual(mana === 105 ? ['w'] : ['w', 'e']);
    if (mana === 140) {
      const start = f.w.tick,
        copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
      f.w.step(120);
      copy.step(120);
      expect(copy.snapshot()).toBe(f.w.snapshot());
      expect(
        f.w.events.some(
          (e) => e.type === 'cast' && e.unit === f.leona.id && e.text === 'q' && e.tick > start
        )
      ).toBe(true);
      expect(f.state.leonaW).not.toBeNull();
    }
  });
