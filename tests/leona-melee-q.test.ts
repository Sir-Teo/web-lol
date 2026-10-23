import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LEONA_COMBAT_POLICY as POLICY } from '../src/content/leona-combat-policy';
import { selectableChampion } from '../src/content/champion-profiles';
import { leonaDaybreakValues } from '../src/simulation/leona-spell-values';
import { ITEMS } from '../src/content/rules';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_a, b) => [{ ...b }],
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.magicResist = 0;
  const state = w.championState(leona.id)!;
  const cast = (ability: 'q' | 'w' | 'e' | 'r' = 'q') => {
    w.enqueue({ type: 'cast', unit: leona.id, ability, point: { x: 500, y: 0 } });
    w.step();
  };
  const attack = () => w.setOrder(leona, { type: 'attack', target: target.id });
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, leona, target, state, cast, attack, restore };
}

test('Leona owns her melee stats, progression and mana without entering the selectable roster', () => {
  const { w, leona, state, attack, target, restore } = setup();
  expect(leona).toMatchObject({
    name: 'Leona',
    hp: 646,
    maxMana: 302,
    damage: 60,
    armor: 43,
    magicResist: 32,
    range: 125,
    speed: 335,
    missileSpeed: 0,
    windupTicks: 22,
  });
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(state.eCharges).toBe(0);
  expect(() => selectableChampion('leona')).toThrow(/development/);
  expect(() => new World(false, PRACTICE_FIXTURE, 'leona')).toThrow(/non-player/);
  const outside = new World(false, { ...PRACTICE_FIXTURE, id: 'rift' });
  expect(() => outside.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona')).toThrow(/development/);
  attack();
  w.step();
  const release = leona.releaseTick!;
  expect(release).toBe(23);
  const copy = restore();
  w.step(release - w.tick);
  copy.step(release - copy.tick);
  expect(w.snapshot()).toBe(copy.snapshot());
  expect(target.hp).toBe(1440);
  expect(w.projectiles).toEqual([]);
  expect(state.qStacks).toBe(0);
  w.gainExperience(280, leona.id);
  expect(state.level).toBe(2);
  expect(leona.damage).toBeCloseTo(62.16, 6);
  expect(leona.maxHp).toBeCloseTo(718.72, 6);
  expect(leona.maxMana).toBeCloseTo(330.8, 6);
  expect(() => restore()).not.toThrow();
});

test('activation validates rank, mana, cooldown and silence without an Ashe fallback', () => {
  const { w, leona, state, cast, restore } = setup();
  cast();
  expect(state.leonaQ).toBeNull();
  expect(state.cooldowns.q).toBe(0);
  expect(w.learnSpell('q', leona.id)).toBeNull();
  leona.mana = 10;
  cast();
  expect(state.leonaQ).toBeNull();
  leona.mana = 302;
  w.applySilence(leona, 3);
  cast();
  expect(state.leonaQ).toBeNull();
  w.step(3);
  cast();
  expect(state.leonaQ).toEqual({
    startTick: w.tick,
    endTick: w.tick + POLICY.attackWindowTicks,
    rank: 1,
  });
  expect(state.cooldowns.q).toBe(w.tick + 300);
  expect(leona.mana).toBeCloseTo(272.02, 5);
  const armed = structuredClone(state.leonaQ),
    deadline = state.cooldowns.q;
  cast();
  expect(state.leonaQ).toEqual(armed);
  expect(state.cooldowns.q).toBe(deadline);
  const before = leona.mana;
  for (const ability of ['w', 'e', 'r'] as const) cast(ability);
  expect(state.pendingCast).toBeNull();
  expect(state.qUntil).toBe(0);
  expect(leona.mana - before).toBeCloseTo(0.06, 6);
  expect(w.projectiles).toEqual([]);
  expect(() => restore()).not.toThrow();
});

test('Q resets a pending swing and deals separate physical and magic damage at its fixed release', () => {
  const { w, leona, target, state, cast, attack, restore } = setup();
  target.armor = 100;
  target.magicResist = 100;
  w.learnSpell('q', leona.id);
  attack();
  w.step();
  const original = leona.releaseTick;
  cast();
  expect(leona.releaseTick).toBe(w.tick + 15);
  expect(leona.releaseTick).not.toBe(original);
  expect(leona.attackCycle?.leonaQRank).toBe(1);
  const copy = restore(),
    release = leona.releaseTick!;
  w.step(release - w.tick - 1);
  copy.step(release - copy.tick - 1);
  expect(target.hp).toBe(1500);
  expect(target.stunUntil).toBe(0);
  w.step();
  copy.step();
  expect(w.snapshot()).toBe(copy.snapshot());
  expect(target.hp).toBe(1465); // 60 physical / 2 plus 10 magic / 2.
  expect(target.stunUntil).toBe(w.tick + 60);
  expect(state.leonaQ).toBeNull();
  expect(leona.nextAttackTick).toBe(release);
  expect(w.projectiles).toEqual([]);
  expect(
    w.events.filter((e) => e.type === 'damage' && e.unit === target.id).map((e) => e.value)
  ).toEqual([30, 5]);
});

test('an explicit follow-up attack skips automatic Q recovery and the bonus cannot repeat', () => {
  const manual = setup(),
    automatic = setup();
  for (const fixture of [manual, automatic]) {
    fixture.w.learnSpell('q', fixture.leona.id);
    fixture.attack();
    fixture.cast();
    fixture.w.step(fixture.leona.releaseTick! - fixture.w.tick);
  }
  manual.attack();
  manual.w.step();
  automatic.w.step();
  expect(manual.leona.releaseTick).toBe(manual.w.tick + manual.leona.windupTicks);
  expect(automatic.leona.releaseTick).toBeNull();
  expect(automatic.leona.attackCycle?.leonaQRank).toBe(1);
  const until = manual.leona.releaseTick!;
  manual.w.step(until - manual.w.tick);
  expect(manual.target.hp).toBe(1370);
  expect(manual.state.leonaQ).toBeNull();
  expect(manual.target.stunUntil).toBe(76);
  const recoveryEnd = automatic.leona.attackCycle!.endTick;
  automatic.w.step(recoveryEnd - automatic.w.tick);
  expect(automatic.leona.releaseTick).toBe(recoveryEnd + automatic.leona.windupTicks);
});

test('range changes only while armed and the empowerment expires before new commands at its deadline', () => {
  const { w, leona, target, state, cast, restore } = setup();
  w.learnSpell('q', leona.id);
  cast();
  expect(w.attackRange(leona)).toBe(175);
  leona.speed = 0;
  target.x = 215;
  w.setOrder(leona, { type: 'attack', target: target.id });
  w.step();
  expect(leona.releaseTick).not.toBeNull();
  w.setOrder(leona, { type: 'idle' }); // Committed Q remains committed.
  w.step(leona.releaseTick! - w.tick);
  expect(w.attackRange(leona)).toBe(125);
  expect(state.leonaQ).toBeNull();
  expect(() => restore()).not.toThrow();
  const expiry = setup();
  expiry.w.learnSpell('q', expiry.leona.id);
  expiry.cast();
  const end = expiry.state.leonaQ!.endTick;
  expiry.w.step(end - expiry.w.tick - 1);
  expiry.attack();
  expiry.w.step();
  expect(expiry.leona.attackCycle?.leonaQRank).toBeUndefined();
  expect(expiry.state.leonaQ).toBeNull();
});

test('committed Q survives move orders, stun and empowerment expiry; target loss preserves an unexpired buff', () => {
  const { w, leona, target, state, cast, attack, restore } = setup();
  w.learnSpell('q', leona.id);
  cast();
  w.step(350);
  attack();
  w.step();
  const release = leona.releaseTick!;
  w.setOrder(leona, { type: 'move', point: { x: 500, y: 0 } });
  leona.stunUntil = 500;
  const copy = restore();
  w.step(release - w.tick);
  copy.step(release - copy.tick);
  expect(w.snapshot()).toBe(copy.snapshot());
  expect(state.leonaQ).toBeNull();
  expect(target.hp).toBe(1430);
  expect(leona.x).toBe(0);
  w.step(20);
  expect(leona.x).toBe(0);
  const lost = setup();
  lost.w.learnSpell('q', lost.leona.id);
  lost.attack();
  lost.cast();
  lost.w.damage(lost.w.hero, lost.target, 1e6, 'true');
  lost.w.step();
  expect(lost.leona.releaseTick).toBeNull();
  expect(lost.state.leonaQ).not.toBeNull();
  expect(() => lost.restore()).not.toThrow();
});

test('Q magic uses the captured rank, never the basic critical multiplier, and stun extends existing control', () => {
  const { w, leona, target, state, cast, attack } = setup();
  w.learnSpell('q', leona.id);
  state.inventory.push('agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge');
  attack();
  cast();
  expect(leona.attackCycle?.critical).toBe(true);
  const physical = leona.damage * w.basicAttackDamageMultiplier(leona, true);
  const magic = leonaDaybreakValues(1, w.abilityPower(leona)).bonusMagicDamage;
  target.stunUntil = 200;
  w.gainExperience(1e6, leona.id);
  w.learnSpell('q', leona.id);
  // AD samples at contact, whereas the Q rank was captured at attack start.
  const currentPhysical = (leona.damage / 60) * physical;
  w.step(leona.releaseTick! - w.tick);
  expect(target.hp).toBeCloseTo(1500 - currentPhysical - magic, 6);
  expect(target.stunUntil).toBe(200);
});

test('death and victory remove armed/committed Q state and saves reject forged ownership and clocks', () => {
  const fixture = setup();
  fixture.w.learnSpell('q', fixture.leona.id);
  fixture.attack();
  fixture.cast();
  const saved = JSON.parse(fixture.w.snapshot());
  const owner = saved.otherChampions.find((c: { id: number }) => c.id === fixture.leona.id);
  const unit = saved.units.find((u: { id: number }) => u.id === fixture.leona.id);
  const forge = (mutate: (o: typeof owner, u: typeof unit) => void) => {
    const changed = structuredClone(saved),
      o = changed.otherChampions.find((c: { id: number }) => c.id === fixture.leona.id),
      u = changed.units.find((v: { id: number }) => v.id === fixture.leona.id);
    mutate(o, u);
    expect(() => World.fromSnapshot(JSON.stringify(changed), fixture.w.battlefield)).toThrow();
  };
  forge((o) => o.leonaQ.endTick++);
  forge((_o, u) => (u.champion = 'ashe'));
  forge((_o, u) => u.attackCycle.leonaQReleaseTick++);
  forge((_o, u) => delete u.attackCycle.leonaQStartTick);
  forge((o) => (o.leonaQ = null));
  forge((o) => (o.spellRanks.q = 0));
  fixture.w.damage(fixture.w.hero, fixture.leona, 1e6, 'true');
  expect(fixture.state.leonaQ).toBeNull();
  expect(fixture.leona.attackCycle).toBeNull();
  expect(() => fixture.restore()).not.toThrow();
  const winner = setup();
  winner.w.learnSpell('q', winner.leona.id);
  winner.attack();
  winner.cast();
  const nexus = winner.w.spawn('nexus', 'red', { x: 300, y: 0 });
  winner.w.damage(winner.w.hero, nexus, 1e6, 'true');
  expect(winner.state.leonaQ).toBeNull();
  expect(winner.leona.attackCycle).toBeNull();
  const terminal = winner.w.snapshot();
  winner.w.step(100);
  expect(winner.w.snapshot()).toBe(terminal);
  expect(() => winner.restore()).not.toThrow();
});

test('queued movement resumes after contact, while explicit recovery bypass survives a saved future', () => {
  const f = setup();
  f.w.learnSpell('q', f.leona.id);
  f.attack();
  f.cast();
  f.w.setOrder(f.leona, { type: 'move', point: { x: 500, y: 0 } });
  f.w.step(f.leona.releaseTick! - f.w.tick);
  expect(f.leona.x).toBe(0);
  const copy = f.restore();
  f.w.step();
  copy.step();
  expect(f.leona.x).toBeGreaterThan(0);
  expect(f.leona.attackCycle).toBeNull();
  expect(f.w.snapshot()).toBe(copy.snapshot());
  const manual = setup();
  manual.w.learnSpell('q', manual.leona.id);
  manual.attack();
  manual.cast();
  manual.w.step(manual.leona.releaseTick! - manual.w.tick);
  const restored = manual.restore();
  manual.attack();
  restored.setOrder(restored.unit(manual.leona.id)!, { type: 'attack', target: manual.target.id });
  manual.w.step(30);
  restored.step(30);
  expect(manual.w.snapshot()).toBe(restored.snapshot());
});

test('Q activation preserves roots/slows, can refresh after its cooldown, and samples haste at cast', () => {
  const f = setup();
  f.w.learnSpell('q', f.leona.id);
  f.leona.rootUntil = 100;
  f.leona.slowUntil = 100;
  f.leona.slowMultiplier = 0.5;
  f.cast();
  expect(f.leona.rootUntil).toBe(100);
  expect(f.w.movementSpeed(f.leona)).toBe(167.5);
  const first = f.state.leonaQ!;
  f.w.step(f.state.cooldowns.q - f.w.tick - 1);
  f.cast();
  expect(f.state.leonaQ!.startTick).toBe(first.startTick + 300);
  expect(f.state.leonaQ!.endTick).toBe(f.w.tick + POLICY.attackWindowTicks);
  expect(() => f.restore()).not.toThrow();
  const stun = setup();
  stun.w.learnSpell('q', stun.leona.id);
  stun.leona.stunUntil = 20;
  stun.cast();
  expect(stun.state.leonaQ).toBeNull();
  expect(stun.state.cooldowns.q).toBe(0);
  const hasted = setup();
  hasted.w.learnSpell('q', hasted.leona.id);
  const item = ITEMS.find((entry) => 'abilityHaste' in entry && entry.abilityHaste > 0)!;
  hasted.state.inventory.push(item.id);
  const resources = hasted.w.abilityResources('q', hasted.leona.id);
  expect(resources.cooldownSeconds).toBeLessThan(5);
  hasted.cast();
  const deadline = hasted.w.tick + Math.ceil(resources.cooldownSeconds * 60);
  expect(hasted.state.cooldowns.q).toBe(deadline);
  hasted.state.inventory = [];
  hasted.w.step();
  expect(hasted.state.cooldowns.q).toBe(deadline);
});

test('stun respects Courage tenacity and survives a fully shielded hit without lengthening shorter control', () => {
  const f = setup();
  f.w.learnSpell('q', f.leona.id);
  const garen = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'garen');
  f.w.learnSpell('w', garen.id);
  f.w.enqueue({ type: 'cast', unit: garen.id, ability: 'w', point: { x: 0, y: 0 } });
  f.w.setOrder(f.leona, { type: 'attack', target: garen.id });
  f.cast();
  f.w.applyShield(garen, garen, 1000, 300);
  const full = garen.hp;
  f.w.step(f.leona.releaseTick! - f.w.tick);
  expect(garen.hp).toBe(full);
  expect(garen.stunUntil).toBe(f.w.tick + 24); // 60% Courage tenacity sampled at application.
  expect(f.w.applyStun(garen, 5)).toBe(true);
  expect(garen.stunUntil).toBe(f.w.tick + 24);
  garen.stunUntil = 0;
  expect(f.w.applyStun(garen, 5)).toBe(true);
  expect(garen.stunUntil).toBe(f.w.tick + 5);
  expect(f.w.applyStun(garen, 0)).toBe(false);
  expect(f.w.applyStun(garen, Infinity)).toBe(false);
  expect(() => f.restore()).not.toThrow();
});

test('structures and wards cannot be stunned, and lethal physical contact cannot damage or control a corpse', () => {
  const f = setup();
  f.w.learnSpell('q', f.leona.id);
  f.target.hp = 30;
  f.attack();
  f.cast();
  f.w.step(f.leona.releaseTick! - f.w.tick);
  expect(f.target.deadAt).toBe(f.w.tick);
  expect(f.target.stunUntil).toBe(0);
  expect(f.w.events.filter((e) => e.type === 'damage' && e.unit === f.target.id)).toHaveLength(1);
  const tower = f.w.spawn('turret', 'red', { x: 1000, y: 0 });
  expect(f.w.applyStun(tower, 60)).toBe(false);
  const ward = f.w.spawnWard({
    ownerId: f.w.hero.id,
    team: 'blue',
    point: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    startTick: f.w.tick,
    readyTick: f.w.tick,
    lifeTicks: 5400,
  });
  expect(f.w.applyStun(ward, 60)).toBe(false);
});
