import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';
import { mobilePose } from '../src/render/mobile-pose';
import { garenEStrikes } from '../src/simulation/garen-e';

function setup(rank = 1) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
    reachable: (p) => ({ x: p.x, y: p.y }),
    lineWalkable: () => true,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  if (rank > 1) w.gainExperience(1e6, garen.id);
  const state = w.championState(garen.id)!;
  for (let i = 0; i < rank; i++) expect(w.learnSpell('e', garen.id)).toBeNull();
  const target = w.spawn('dummy', 'blue', { x: 200, y: 0 });
  target.hp = target.maxHp = 10000;
  const cast = () => {
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'e', point: garen });
    w.step();
  };
  return { w, garen, state, target, cast };
}

test('Judgment completes seven level-one strikes over exactly three seconds and starts cooldown afterward', () => {
  const { w, garen, state, target, cast } = setup();
  state.recallEnd = 100;
  cast();
  expect(state.garenE).toMatchObject({
    startTick: 1,
    endTick: 181,
    strikes: 7,
    completedStrikes: 0,
  });
  expect(state.recallEnd).toBeNull();
  expect(state.cooldowns.e).toBe(0);
  expect(garen.mana).toBe(0);
  const deadlines = [27, 53, 79, 104, 130, 156, 181];
  for (const [i, tick] of deadlines.entries()) {
    w.step(tick - w.tick - 1);
    const before = target.hp;
    expect(state.garenE?.completedStrikes).toBe(i);
    w.step();
    expect(before - target.hp).toBeCloseTo((4 + 0.4 * 69) * 1.25);
  }
  expect(state.garenE).toBeNull();
  expect(state.cooldowns.e).toBe(721);
  expect(w.projectiles).toHaveLength(0);
  const hp = target.hp;
  w.step(60);
  expect(target.hp).toBe(hp);
});

test('ranked damage and cooldowns match current values, with no old level-based bonus damage', () => {
  for (const [rank, base, ratio, cooldown] of [
    [1, 4, 0.4, 9],
    [2, 7, 0.43, 8.25],
    [3, 10, 0.46, 7.5],
    [4, 13, 0.49, 6.75],
    [5, 16, 0.52, 6],
  ]) {
    const { w, garen, state, target, cast } = setup(rank);
    garen.damage = 100;
    cast();
    const first = rank === 1 ? 27 : 21;
    w.step(first - w.tick);
    expect(10000 - target.hp).toBeCloseTo((base + ratio * 100) * 1.25, 4);
    w.step(181 - w.tick);
    expect(state.cooldowns.e).toBe(181 + cooldown * 60);
  }
});

test('level growth adds whole spins and the captured count/rank survives a mid-spin level-up', () => {
  expect(garenEStrikes(1)).toBe(7);
  expect(garenEStrikes(18)).toBe(9);
  const { w, garen, state, target, cast } = setup();
  cast();
  w.gainExperience(1e6, garen.id);
  w.learnSpell('e', garen.id);
  expect(state.garenE).toMatchObject({ rank: 1, strikes: 7 });
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(180);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(w.events.filter((e) => e.type === 'damage' && e.unit === target.id)).toHaveLength(6); // Older events retire after 150 ticks.
  expect(state.garenE).toBeNull();
});

test('each spin reselects the nearest recipient and respects body edges while excluding allies and structures', () => {
  const { w, target, garen, cast } = setup();
  const second = w.spawn('dummy', 'blue', { x: 300, y: 0 });
  const edge = w.spawn('dummy', 'blue', { x: 365, y: 0 });
  const outside = w.spawn('dummy', 'blue', { x: 365.01, y: 0 });
  const ally = w.spawn('dummy', 'red', { x: 10, y: 0 });
  const turret = w.spawn('turret', 'blue', { x: 20, y: 0 });
  turret.ai = false;
  cast();
  w.step(26);
  const raw = 4 + 0.4 * garen.damage;
  expect(10000 - target.hp).toBeCloseTo(raw * 1.25);
  expect(second.maxHp - second.hp).toBeCloseTo(raw);
  expect(edge.maxHp - edge.hp).toBeCloseTo(raw);
  expect(outside.hp).toBe(outside.maxHp);
  expect(ally.hp).toBe(ally.maxHp);
  expect(turret.hp).toBe(turret.maxHp);
  target.x = 400;
  const hp = second.hp;
  w.step(26);
  expect(hp - second.hp).toBeCloseTo(raw * 1.25);
});

test('area damage hits unseen units without exposing their health or feedback', () => {
  const { w, target, cast } = setup();
  w.battlefield.lineOfSight = () => false;
  cast();
  w.step(26);
  expect(target.hp).toBeLessThan(10000);
  expect(w.visible(target, 'red')).toBe(false);
  const hit = w.events.find((e) => e.type === 'damage' && e.unit === target.id)!;
  expect(w.eventVisible(hit, 'red')).toBe(false);
});

test('moving and chasing during Judgment suppress basic attacks, including an armed Q', () => {
  const { w, garen, state, target, cast } = setup();
  w.gainExperience(1000, garen.id);
  w.learnSpell('q', garen.id);
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: garen });
  w.step();
  cast();
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step(20);
  expect(garen.x).toBeGreaterThan(0);
  expect(garen.releaseTick).toBeNull();
  expect(garen.attackCycle).toBeNull();
  expect(state.garenQ?.consumed).toBe(false);
  w.enqueue({ type: 'recall', unit: garen.id });
  w.step();
  expect(state.recallEnd).toBeNull();
  expect(garen.animationTimeline?.primary.clip).toBe('spell3_0');
  w.step(182 - w.tick);
  expect(state.garenE).toBeNull();
  expect(garen.order.type).toBe('idle');
});

test('stun/root/silence do not stop accepted spin damage, but their capability gates remain in force', () => {
  for (const control of ['stun', 'root', 'silence']) {
    const { w, target, garen, state, cast } = setup();
    cast();
    w.setOrder(garen, { type: 'move', point: { x: 600, y: 0 } });
    if (control === 'stun') garen.stunUntil = 100;
    if (control === 'root') w.applyRoot(garen, 100);
    if (control === 'silence') w.applySilence(garen, 100);
    w.step(26);
    expect(target.hp, control).toBeLessThan(10000);
    expect(state.garenE?.completedStrikes, control).toBe(1);
    expect(garen.x > 0, control).toBe(control === 'silence');
  }
  for (const control of ['stun', 'silence']) {
    const { garen, state, cast } = setup();
    if (control === 'stun') garen.stunUntil = 100;
    else garen.silenceUntil = 100;
    cast();
    expect(state.garenE).toBeNull();
  }
});

test('early recast has a one-second lock and starts the full captured cooldown without a refund', () => {
  const { w, state, cast } = setup();
  cast();
  cast();
  expect(state.garenE).not.toBeNull();
  w.step(60 - w.tick);
  cast();
  expect(w.tick).toBe(61);
  expect(state.garenE).toBeNull();
  expect(state.cooldowns.e).toBe(601);
  cast();
  expect(state.garenE).toBeNull();
});

test('W/Q/Flash preserve Judgment, and valid R interrupts it after target validation', () => {
  const { w, garen, state, cast } = setup();
  w.gainExperience(1e6, garen.id);
  for (const spell of ['w', 'q', 'r'] as const) w.learnSpell(spell, garen.id);
  cast();
  for (const ability of ['w', 'q', 'd'] as const)
    w.enqueue({ type: 'cast', unit: garen.id, ability, point: { x: 0, y: 50 } });
  w.step();
  expect(state.garenE).not.toBeNull();
  expect(state.garenW).not.toBeNull();
  expect(state.garenQ).not.toBeNull();
  const target = w.spawn('champion', 'blue', { x: 200, y: 0 });
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'r', point: target });
  w.step();
  expect(state.garenE).not.toBeNull();
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'r', targetId: target.id, point: target });
  w.step();
  expect(state.garenE).toBeNull();
  expect(state.pendingCast?.ability).toBe('r');
  expect(state.cooldowns.e).toBe(w.tick + 540);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});

test('Judgment cannot cancel a committed Q windup', () => {
  const { w, garen, target, state, cast } = setup();
  w.gainExperience(1000, garen.id);
  w.learnSpell('q', garen.id);
  target.x = 100;
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: garen });
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.step();
  const release = garen.releaseTick;
  cast();
  expect(state.garenE).toBeNull();
  expect(garen.releaseTick).toBe(release);
});

test('six champion contacts apply derived armor reduction, subsequent contacts refresh it, and expiry restores armor', () => {
  const { w, garen, state, cast } = setup();
  const target = w.spawn('champion', 'blue', { x: 100, y: 0 });
  target.maxHp = target.hp = 10000;
  target.armor = 100;
  cast();
  w.step(155 - w.tick);
  expect(target.garenEShreds).toEqual([]);
  w.step();
  expect(state.garenE?.completedStrikes).toBe(6);
  expect(w.effectiveArmor(target)).toBe(75);
  expect(target.armor).toBe(100);
  w.step(25);
  expect(target.garenEShreds[0].endTick).toBe(541);
  const hp = target.hp;
  w.damage(garen, target, 100, 'physical');
  expect(hp - target.hp).toBeCloseTo(100 / 1.75);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step(360);
    expect(world.effectiveArmor(world.unit(target.id)!)).toBe(100);
    expect(world.unit(target.id)!.garenEShreds).toEqual([]);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('spin critical damage uses 30% of bonus crit damage and leaves non-critical damage unchanged', () => {
  for (const critical of [false, true]) {
    const { w, garen, state, target, cast } = setup();
    state.inventory = critical
      ? ['agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge']
      : [];
    cast();
    w.step(26);
    expect(10000 - target.hp).toBeCloseTo(
      (4 + 0.4 * garen.damage) * 1.25 * (critical ? 1.39 : 1),
      4
    );
  }
});

test('spin/shred save continuation retains RNG, cooldown and hit counts; source death retains existing shred', () => {
  const { w, garen, state, cast } = setup();
  const target = w.spawn('champion', 'blue', { x: 100, y: 0 });
  target.maxHp = target.hp = 10000;
  state.inventory = ['agility'];
  cast();
  w.step(80);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step(80);
    world.damage(world.unit(target.id)!, world.unit(garen.id)!, 1e6, 'true');
    expect(world.championState(garen.id)!.garenE).toBeNull();
    expect(world.unit(target.id)!.garenEShreds).toHaveLength(1);
    world.step(30);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});

test('spin animation remains active through movement and follows captured strike rate', () => {
  const { w, garen, state, cast } = setup(5);
  cast();
  const pose = mobilePose(garen, state, 60, 1, mobileClipDurations(garen)!);
  expect(pose).toMatchObject({ kind: 'cast', clip: 'spell3_0', loop: true });
  expect(pose.rate).toBeGreaterThan(1);
  w.setOrder(garen, { type: 'move', point: { x: 1000, y: 0 } });
  w.step(20);
  expect(garen.animationTimeline?.primary.clip).toBe('spell3_0');
});

test('malformed spin and shred ownership, timing, counts, ranks and captured cooldowns are rejected', () => {
  const { w, garen, cast } = setup();
  const target = w.spawn('champion', 'blue', { x: 100, y: 0 });
  target.maxHp = target.hp = 10000;
  cast();
  w.step(160);
  for (const mutate of [
    (o: any, _s: any) => o.garenE.endTick++,
    (o: any, _s: any) => o.garenE.completedStrikes--,
    (o: any, _s: any) => (o.garenE.strikes = 9),
    (o: any, _s: any) => (o.garenE.rank = 2),
    (o: any, _s: any) => (o.garenE.cooldownTicks = 1),
    (o: any, _s: any) => (o.garenE.hits[0].count = 7),
    (o: any, _s: any) => o.garenE.hits.push(o.garenE.hits[0]),
    (o: any, s: any) => (s.player.garenE = o.garenE),
    (_o: any, s: any) => s.units.find((u: any) => u.id === target.id).garenEShreds[0].endTick++,
    (_o: any, s: any) =>
      (s.units.find((u: any) => u.id === target.id).garenEShreds[0].sourceId = target.id),
  ]) {
    const snapshot = JSON.parse(w.snapshot());
    mutate(
      snapshot.otherChampions.find((o: any) => o.id === garen.id),
      snapshot
    );
    expect(() => World.fromSnapshot(JSON.stringify(snapshot), w.battlefield)).toThrow();
  }
});

test('Garen executes spin kills through ordinary CS, gold and Courage credit', () => {
  const { w, garen, state, cast } = setup();
  w.gainExperience(1000, garen.id);
  w.learnSpell('w', garen.id);
  const minion = w.spawn('siege', 'blue', { x: 100, y: 0 });
  minion.hp = 1;
  minion.speed = 0;
  minion.ai = false;
  cast();
  w.step(26);
  expect(minion.hp).toBe(0);
  expect(state.cs).toBe(1);
  expect(state.gold).toBeGreaterThan(500);
  expect(state.garenCourageStacks).toBe(1);
});

test('multiple Garen reductions do not multiply armor loss and target death clears all grants', () => {
  const { w, cast } = setup();
  const other = w.spawn('champion', 'red', { x: 0, y: 20 }, 'garen');
  w.learnSpell('e', other.id);
  const target = w.spawn('champion', 'blue', { x: 100, y: 0 });
  target.hp = target.maxHp = 10000;
  target.armor = 100;
  cast();
  w.enqueue({ type: 'cast', unit: other.id, ability: 'e', point: other });
  w.step(180);
  expect(target.garenEShreds).toHaveLength(2);
  expect(w.effectiveArmor(target)).toBe(75);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
  w.damage(other, target, 1e6, 'true');
  expect(target.garenEShreds).toEqual([]);
  expect(w.effectiveArmor(target)).toBe(100);
});

test('Judgment bots use visible nearby champions and grouped minions with ordinary safety/control gates', () => {
  for (const condition of [
    'champion',
    'wave',
    'sparse',
    'hidden',
    'range',
    'tower',
    'silence',
    'cooldown',
  ]) {
    const { w, garen, state } = setup();
    if (condition === 'wave' || condition === 'sparse') {
      for (let i = 0; i < (condition === 'wave' ? 3 : 2); i++) {
        const minion = w.spawn('melee', 'blue', { x: 200 + i * 10, y: 0 });
        minion.ai = false;
      }
    } else w.spawn('champion', 'blue', { x: condition === 'range' ? 500 : 300, y: 0 });
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'tower') w.spawn('turret', 'blue', { x: 0, y: 0 });
    if (condition === 'silence') garen.silenceUntil = 100;
    if (condition === 'cooldown') state.cooldowns.e = 100;
    garen.ai = true;
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.ability === 'e'),
      condition
    ).toBe(condition === 'champion' || condition === 'wave');
  }
});
