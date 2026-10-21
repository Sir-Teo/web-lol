import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { mobilePose } from '../src/render/mobile-pose';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';
import type { UnitKind } from '../src/simulation/types';

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
  const target = w.spawn('champion', 'blue', { x: 350, y: 0 }, 'lux');
  w.gainExperience(1e6, garen.id);
  const state = w.championState(garen.id)!;
  for (let i = 0; i < rank; i++) expect(w.learnSpell('r', garen.id)).toBeNull();
  target.maxHp = target.hp = 2000;
  const cast = (targetId: number | undefined = target.id) => {
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'r', point: { x: 350, y: 0 }, targetId });
    w.step();
  };
  return { w, garen, state, target, cast };
}

test('R captures a champion target and rank, costs no mana, and hits only at its release tick', () => {
  const { w, garen, state, target, cast } = setup();
  state.recallEnd = 100;
  cast();
  expect(state.pendingCast).toMatchObject({
    targetId: target.id,
    rank: 1,
    startTick: 1,
    releaseTick: 28,
    damage: 0,
  });
  expect(state.cooldowns.r).toBe(7201);
  expect(state.recallEnd).toBeNull();
  expect(garen.mana).toBe(0);
  expect(w.projectiles).toHaveLength(0);
  expect(w.learnSpell('r', garen.id)).toBeNull();
  w.step(26);
  expect(target.hp).toBe(2000);
  w.step();
  expect(target.hp).toBeCloseTo(1875 + 1.1 / 60); // End-of-tick Lux regeneration.
  expect(state.pendingCast).toBeNull();
  expect(garen.animationTimeline!.primary.clip).toBe('spell4_base');
  expect(garen.animationTimeline!.primary.time).toBeCloseTo(18.5 / 30);
});

test('all ranked damage/cooldowns use release-time missing health and true damage through shields', () => {
  for (const [rank, base, ratio, cooldown] of [
    [1, 125, 0.25, 120],
    [2, 200, 0.3, 100],
    [3, 275, 0.35, 80],
  ]) {
    const { w, garen, target, state, cast } = setup(rank);
    target.hp = 600;
    target.armor = target.magicResist = 10000;
    w.applyShield(target, target, 100, 100);
    cast();
    expect(state.cooldowns.r).toBe(1 + cooldown * 60);
    w.step(26);
    target.hp = 1000; // A heal during the windup changes the result.
    w.step();
    expect(target.hp).toBeCloseTo(1000 - (base + ratio * 1000 - 100) + 1.1 / 60, 3);
    expect(w.shieldAmount(target)).toBe(0);
    expect(garen.mana).toBe(0);
  }
});

test('acceptance rejects missing/invalid/hidden/allied/nonchampion/out-of-range targets without spending R', () => {
  for (const condition of [
    'missing',
    'unknown',
    'hidden',
    'allied',
    'dead',
    'range',
    'unlearned',
    'cooldown',
    'silence',
    'stun',
  ]) {
    const { w, state, garen, target, cast } = setup();
    let targetId = target.id;
    if (condition === 'unknown') targetId = 99999;
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'allied') target.team = garen.team;
    if (condition === 'dead') w.damage(garen, target, 1e6, 'true');
    if (condition === 'range') target.x = 400.01;
    if (condition === 'unlearned') state.spellRanks.r = 0;
    if (condition === 'cooldown') state.cooldowns.r = 100;
    if (condition === 'silence') garen.silenceUntil = 100;
    if (condition === 'stun') garen.stunUntil = 100;
    const oldCooldown = state.cooldowns.r;
    if (condition === 'missing') {
      w.enqueue({ type: 'cast', unit: garen.id, ability: 'r', point: target });
      w.step();
    } else cast(targetId);
    expect(state.pendingCast, condition).toBeNull();
    expect(state.garenRReveal, condition).toBeNull();
    expect(state.cooldowns.r, condition).toBe(oldCooldown);
  }
  for (const kind of ['dummy', 'melee', 'turret', 'inhibitor', 'nexus'] as UnitKind[]) {
    const { w, state, cast } = setup();
    cast(w.spawn(kind, 'blue', { x: 300, y: 0 }).id);
    expect(state.pendingCast, kind).toBeNull();
    expect(state.cooldowns.r, kind).toBe(0);
  }
  const edge = setup();
  edge.target.x = 400;
  edge.garen.rootUntil = 100;
  edge.cast();
  expect(edge.state.pendingCast).not.toBeNull();
  expect(edge.garen.rootUntil).toBe(100);
});

test('committed R retains its target through move/retarget, new CC, lost sight and range', () => {
  const { w, state, garen, target, cast } = setup();
  const other = w.spawn('champion', 'blue', { x: 350, y: 10 });
  cast();
  w.enqueue({ type: 'order', unit: garen.id, order: { type: 'move', point: { x: -500, y: 0 } } });
  w.enqueue({ type: 'order', unit: garen.id, order: { type: 'attack', target: other.id } });
  w.applySilence(garen, 100);
  garen.stunUntil = 100;
  target.x = 2000;
  w.battlefield.lineOfSight = () => false;
  const position = { x: garen.x, y: garen.y };
  w.step(26);
  expect({ x: garen.x, y: garen.y }).toEqual(position);
  expect(state.pendingCast?.targetId).toBe(target.id);
  w.step();
  expect(target.hp).toBeLessThan(2000);
  expect(other.hp).toBe(other.maxHp);
  expect(w.projectiles).toHaveLength(0);
});

test('target-only reveal grants no nearby champion or terrain vision and expires exactly', () => {
  const { w, target, state, cast } = setup();
  const neighbor = w.spawn('champion', 'blue', { x: 355, y: 0 });
  cast();
  w.battlefield.lineOfSight = () => false;
  expect(w.visible(target, 'red')).toBe(true);
  expect(w.visible(neighbor, 'red')).toBe(false);
  expect(w.pointVisible(target, 'red')).toBe(false);
  w.emit('scout-arrival', { x: 2000, y: 2000 }, { unit: target.id, team: target.team });
  expect(w.eventVisible(w.events.at(-1)!, 'red')).toBe(false);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, restored]) {
    world.step(27);
    const hit = world.events.find((e) => e.type === 'damage' && e.unit === target.id)!;
    expect(world.eventVisible(hit, 'red')).toBe(true);
    world.step(32);
    expect(world.visible(world.unit(target.id)!, 'red')).toBe(true);
    world.step();
    expect(world.visible(world.unit(target.id)!, 'red')).toBe(false);
  }
  expect(state.garenRReveal).toBeNull();
  expect(restored.snapshot()).toBe(w.snapshot());
});

test('R lethal damage uses ordinary kill attribution and Courage stacking', () => {
  const { w, garen, state, target, cast } = setup();
  w.learnSpell('w', garen.id);
  target.hp = 100;
  const armor = garen.armor;
  cast();
  w.step(27);
  expect(target.hp).toBe(0);
  expect(state.kills).toBe(1);
  expect(state.garenCourageStacks).toBe(1);
  expect(garen.armor).toBeCloseTo(armor + 0.2);
  expect(state.gold).toBeGreaterThan(500);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});

test('caster death cancels damage but retains reveal; dead targets never redirect R or refund cooldown', () => {
  for (const victim of ['source', 'target']) {
    const { w, garen, target, state, cast } = setup();
    const neighbor = w.spawn('champion', 'blue', { x: 350, y: 0 });
    cast();
    if (victim === 'source') w.damage(target, garen, 1e6, 'true');
    else w.damage(garen, target, 1e6, 'true');
    const hpAfterKill = target.hp;
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) world.step(27);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(neighbor.hp).toBe(neighbor.maxHp);
    expect(state.cooldowns.r).toBe(7201);
    expect(state.pendingCast).toBeNull();
    expect(state.garenRReveal).not.toBeNull();
    if (victim === 'source') expect(target.hp).toBeGreaterThanOrEqual(hpAfterKill);
  }
});

test('queued and pending R restore identically without recapturing mutable command data', () => {
  const { w, garen, target, state } = setup();
  const point = { x: target.x, y: target.y };
  const command = {
    type: 'cast' as const,
    unit: garen.id,
    ability: 'r' as const,
    point,
    targetId: target.id,
  };
  w.enqueue(command);
  command.targetId = garen.id;
  point.x = -2000;
  const queued = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, queued]) world.step(10);
  expect(queued.snapshot()).toBe(w.snapshot());
  expect(state.pendingCast?.targetId).toBe(target.id);
  const pending = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, queued, pending]) world.step(40);
  expect(queued.snapshot()).toBe(w.snapshot());
  expect(pending.snapshot()).toBe(w.snapshot());
});

test('save validation rejects forged R timing, references, rank, reveal and foreign payloads', () => {
  const { w, garen, target, cast } = setup();
  cast();
  const mutations: ((owner: any, snapshot: any) => void)[] = [
    (o) => o.pendingCast.releaseTick++,
    (o) => delete o.pendingCast.targetId,
    (o) => (o.pendingCast.targetId = garen.id),
    (o) => (o.pendingCast.rank = 2),
    (o) => (o.pendingCast.damage = 100),
    (o) => (o.pendingCast.origin = { x: 0, y: 0 }),
    (o) => (o.garenRReveal = null),
    (o) => o.garenRReveal.endTick++,
    (o) => o.garenRReveal.startTick++,
    (o) => (o.garenRReveal.targetId = garen.id),
    (o) => (o.garenRReveal.targetId = 999999),
    (o) => (o.spellRanks.r = 0),
    (o, s) => (s.player.garenRReveal = o.garenRReveal),
    (_o, s) => (s.units.find((u: any) => u.id === target.id).kind = 'dummy'),
    (_o, s) =>
      s.commands.push({
        type: 'cast',
        unit: s.player.id,
        ability: 'r',
        point: { x: 0, y: 0 },
        targetId: target.id,
      }),
  ];
  for (const mutate of mutations) {
    const snapshot = JSON.parse(w.snapshot());
    mutate(
      snapshot.otherChampions.find((o: any) => o.id === garen.id),
      snapshot
    );
    expect(() => World.fromSnapshot(JSON.stringify(snapshot), w.battlefield)).toThrow();
  }
});

test('source R animation reaches its contact marker at release and eventually returns to idle', () => {
  const { w, garen, state, cast } = setup();
  cast();
  const durations = mobileClipDurations(garen)!;
  expect(mobilePose(garen, state, 28, 1, durations)).toMatchObject({
    kind: 'cast',
    clip: 'spell4_base',
  });
  expect(mobilePose(garen, state, 28, 1, durations).time).toBeCloseTo(18.5 / 30);
  w.step(100);
  expect(garen.animationTimeline!.primary.kind).toBe('idle');
});

test('R respects a committed Q windup without consuming the empowerment', () => {
  const { w, state, target, garen, cast } = setup();
  w.learnSpell('q', garen.id);
  target.x = 150;
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: garen });
  w.step();
  const release = garen.releaseTick;
  cast();
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.r).toBe(0);
  expect(garen.releaseTick).toBe(release);
  expect(state.garenQ?.consumed).toBe(false);
});

test('disappearing targets cancel the pending cast without redirecting damage or refunding R', () => {
  const { w, target, state, cast } = setup();
  const neighbor = w.spawn('champion', 'blue', { x: 350, y: 0 });
  cast();
  w.units = w.units.filter((u) => u.id !== target.id);
  w.step();
  expect(state.pendingCast).toBeNull();
  expect(state.garenRReveal).toBeNull();
  expect(state.cooldowns.r).toBe(7201);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) world.step(30);
  expect(saved.snapshot()).toBe(w.snapshot());
  expect(neighbor.hp).toBe(neighbor.maxHp);
});

test('both teams learn R and queue a visible lethal execute through the ordinary cast validator', () => {
  for (const team of ['red', 'blue'] as const) {
    const { w, garen, target, state } = setup();
    garen.team = team;
    target.team = team === 'red' ? 'blue' : 'red';
    target.hp = 100;
    garen.ai = true;
    w.step();
    expect(state.spellRanks.r).toBe(3);
    expect(w.commands.find((c) => c.type === 'cast' && c.ability === 'r')).toMatchObject({
      unit: garen.id,
      targetId: target.id,
    });
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) world.step(28);
    expect(saved.snapshot()).toBe(w.snapshot());
    expect(target.hp).toBe(0);
    expect(state.kills).toBe(1);
  }
});

test('execute AI respects shields, hidden health, range, tower danger and unavailable casts', () => {
  for (const condition of [
    'shield',
    'healthy',
    'hidden',
    'range',
    'tower',
    'silence',
    'stun',
    'cooldown',
  ]) {
    const { w, garen, target, state } = setup();
    target.hp = condition === 'healthy' ? target.maxHp : 100;
    if (condition === 'shield') w.applyShield(target, target, 2000, 100);
    if (condition === 'hidden') w.battlefield.lineOfSight = () => false;
    if (condition === 'range') target.x = 401;
    if (condition === 'tower') w.spawn('turret', target.team, { x: 0, y: 0 });
    if (condition === 'silence') garen.silenceUntil = 100;
    if (condition === 'stun') garen.stunUntil = 100;
    if (condition === 'cooldown') state.cooldowns.r = 100;
    garen.ai = true;
    w.step();
    expect(
      w.commands.some((c) => c.type === 'cast' && c.ability === 'r'),
      condition
    ).toBe(false);
  }
});
