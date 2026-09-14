import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -3000;
  const garen = w.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  const state = w.championState(garen.id)!;
  expect(w.learnSpell('w', garen.id)).toBeNull();
  const cast = () => {
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'w', point: { x: 0, y: 0 } });
    w.step();
  };
  return { w, garen, state, cast };
}

test('Courage has independent shield, tenacity and defense deadlines, and costs no mana', () => {
  const { w, garen, state, cast } = setup();
  cast();
  expect(state.garenW).toEqual({ startTick: 1, rank: 1, upfrontUntil: 46, defenseUntil: 241 });
  expect(w.shieldAmount(garen)).toBe(65);
  expect(garen.mana).toBe(0);
  expect(state.cooldowns.w).toBe(1321);
  const original = structuredClone(state.garenW);
  cast();
  expect(state.garenW).toEqual(original);
  w.step(46 - w.tick);
  expect(w.shieldAmount(garen)).toBe(0);
  expect(state.garenW).not.toBeNull();
  w.applyRoot(garen, 120);
  expect(garen.rootUntil).toBe(w.tick + 120);
  garen.armor = 0;
  const hp = garen.hp;
  w.damage(w.hero, garen, 100, 'physical');
  expect(hp - garen.hp).toBe(75);
  w.step(241 - w.tick);
  expect(state.garenW).toBeNull();
  const unprotected = garen.hp;
  w.damage(w.hero, garen, 100, 'physical');
  expect(unprotected - garen.hp).toBe(100);
});

test('resistance and Courage mitigate before the shield; true damage bypasses mitigation', () => {
  for (const kind of ['physical', 'magic', 'true'] as const) {
    const { w, garen, cast } = setup();
    cast();
    garen.armor = garen.magicResist = 100;
    const hp = garen.hp;
    w.damage(w.hero, garen, 200, kind);
    expect(hp - garen.hp).toBe(kind === 'true' ? 135 : 10);
    expect(w.shieldAmount(garen)).toBe(0);
  }
});

test('shield excludes level-growth health, includes bonus health, and captures its cast rank', () => {
  const { w, garen, state, cast } = setup();
  w.gainExperience(100000, garen.id);
  expect(state.level).toBe(18);
  garen.maxHp += 200;
  cast();
  expect(w.shieldAmount(garen)).toBeCloseTo(101);
  expect(w.learnSpell('w', garen.id)).toBeNull();
  expect(state.garenW!.rank).toBe(1);
  expect(w.shieldAmount(garen)).toBeCloseTo(101);
  state.cooldowns.w = 0;
  w.step(241 - w.tick);
  cast();
  expect(state.garenW!.rank).toBe(2);
  expect(w.shieldAmount(garen)).toBeCloseTo(121);
  expect(w.abilityResources('w', garen.id).cooldownSeconds).toBe(19.5);
});

test('tenacity is sampled on new controls and persists after the upfront window ends', () => {
  const { w, garen, cast } = setup();
  w.applyRoot(garen, 120);
  cast();
  expect(garen.rootUntil).toBe(120); // No retroactive cleanse or shortening.
  garen.rootUntil = 0;
  w.applyRoot(garen, 120);
  expect(garen.rootUntil).toBe(49);
  w.applySilence(garen, 90);
  expect(garen.silenceUntil).toBe(37);
  w.applySlow(w.hero, garen, 'frost', 120, 0.5);
  expect(garen.slows[0].endTick).toBe(49);
  expect(w.movementSpeed(garen)).toBe(170); // Duration, not slow strength.
  w.step(46 - w.tick);
  expect(garen.rootUntil).toBe(49);
  expect(garen.slows[0].endTick).toBe(49);
});

test('tenacity does not lengthen short controls and applies the local minimum duration', () => {
  const { w, garen, cast } = setup();
  cast();
  w.applyRoot(garen, 10);
  expect(garen.rootUntil).toBe(11);
  w.applyRoot(garen, 30);
  expect(garen.rootUntil).toBe(19);
});

test('actual Volley keeps legacy slow clocks synchronized with tenacity-shortened effects', () => {
  const { w, garen, cast } = setup();
  w.hero.x = 0;
  w.hero.y = -200;
  w.learnSpell('w');
  cast();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: 0, y: 1000 } });
  for (let i = 0; i < 60 && !garen.criticalSlow; i++) w.step();
  expect(garen.criticalSlow).not.toBeNull();
  const contactTick = w.tick;
  expect(garen.criticalSlow!.endTick).toBe(contactTick + 24);
  expect(garen.slowUntil).toBe(contactTick + 48);
  expect(garen.slows.find((s) => s.kind === 'critical-frost')!.endTick).toBe(contactTick + 24);
  expect(garen.slows.find((s) => s.kind === 'frost')!.endTick).toBe(contactTick + 48);
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    world.step(48);
    expect(world.movementSpeed(world.unit(garen.id)!)).toBe(340);
  }
  expect(saved.snapshot()).toBe(w.snapshot());
});

test('Courage preserves a committed Q swing and cancels recall without changing orders', () => {
  const { w, garen, state, cast } = setup();
  w.gainExperience(280, garen.id);
  w.learnSpell('q', garen.id);
  const target = w.spawn('dummy', 'blue', { x: 150, y: 0 });
  w.setOrder(garen, { type: 'attack', target: target.id });
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: { x: 0, y: 0 } });
  w.step();
  const cycle = structuredClone(garen.attackCycle);
  cast();
  expect(garen.attackCycle).toEqual(cycle);
  expect(garen.order).toEqual({ type: 'attack', target: target.id });
  w.step(garen.releaseTick! - w.tick);
  expect(target.hp).toBeLessThan(target.maxHp);
  expect(state.garenQ?.consumed).toBe(true);
  state.cooldowns.w = 0;
  state.recallEnd = w.tick + 100;
  cast();
  expect(state.recallEnd).toBeNull();
});

test('silence and stun reject W, while a root permits it without clearing the root', () => {
  for (const kind of ['silence', 'stun', 'root']) {
    const { garen, state, cast } = setup();
    if (kind === 'silence') garen.silenceUntil = 100;
    if (kind === 'stun') garen.stunUntil = 100;
    if (kind === 'root') garen.rootUntil = 100;
    cast();
    expect(state.garenW !== null, kind).toBe(kind === 'root');
    if (kind === 'root') expect(garen.rootUntil).toBe(100);
    else expect(state.cooldowns.w).toBe(0);
  }
});

test('Courage survives save continuation and clears on death', () => {
  const { w, garen, state, cast } = setup();
  cast();
  const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, saved]) {
    const owner = world.unit(garen.id)!;
    world.damage(world.hero, owner, 100, 'magic');
    world.step(50);
    world.damage(world.hero, owner, 100, 'physical');
  }
  expect(saved.snapshot()).toBe(w.snapshot());
  w.damage(w.hero, garen, 100000, 'true');
  expect(state.garenW).toBeNull();
  expect(garen.shields).toEqual([]);
  expect(() => World.fromSnapshot(w.snapshot(), w.battlefield)).not.toThrow();
});

test('save validation rejects foreign, expired, unlearned or changed Courage timers', () => {
  const { w, cast } = setup();
  cast();
  for (const mutate of [
    (s: any) => {
      s.player.garenW = s.otherChampions[0].garenW;
    },
    (s: any) => {
      s.otherChampions[0].garenW.upfrontUntil++;
    },
    (s: any) => {
      s.otherChampions[0].garenW.defenseUntil++;
    },
    (s: any) => {
      s.otherChampions[0].spellRanks.w = 0;
    },
    (s: any) => {
      s.otherChampions[0].garenW.startTick = 2;
    },
  ]) {
    const snapshot = JSON.parse(w.snapshot());
    mutate(snapshot);
    expect(() => World.fromSnapshot(JSON.stringify(snapshot), w.battlefield)).toThrow();
  }
});
