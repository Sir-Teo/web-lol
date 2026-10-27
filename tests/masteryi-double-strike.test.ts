import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_PASSIVE } from '../src/content/masteryi-passive';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { mobilePose } from '../src/render/mobile-pose';
import { DOUBLE_STRIKE_STACK_TICKS } from '../src/simulation/masteryi-double-strike';
import { Random } from '../src/simulation/math';

function fixture() {
  let sight = true;
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => sight,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (point) => ({ x: point.x, y: point.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const state = w.championState(yi.id)!;
  const passive = state.doubleStrike!;
  const primary = (victim = target) => {
    w.setOrder(yi, { type: 'attack', target: victim.id });
    w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
    expect(yi.releaseTick).not.toBeNull();
    w.step(yi.releaseTick! - w.tick);
    w.setOrder(yi, { type: 'idle' });
  };
  const ready = () => {
    for (let n = 0; n < 4; n++) primary();
  };
  return {
    w,
    yi,
    target,
    state,
    passive,
    primary,
    ready,
    hide: () => {
      sight = false;
    },
  };
}

test('source passive retains count/duration, half-stat formula and separately bound child capabilities', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/character.json', 'utf8')).records;
  const parent = source[MASTER_YI_PASSIVE.declaration].mSpell;
  const child = source[MASTER_YI_PASSIVE.secondaryDeclaration].mSpell;
  expect(parent.DataValues.map((v: any) => [v.name, v.values[1]])).toEqual([
    ['StackDuration', 4],
    ['AttackCount', 4],
  ]);
  expect(parent.mSpellCalculations.TotalDamage.mFormulaParts).toEqual([
    { mStat: 2, mCoefficient: 0.5, __type: 'StatByCoefficientCalculationPart' },
  ]);
  expect(child.canCastWhileDisabled).toBe(true);
  expect(child.mUseAutoattackCastTimeData.__type).toBe('UseAutoattackCastTimeData');
  expect(child.mAnimationName).toBe('Passive');
  expect(child.cannotCancelWhileWindingUp).toBeUndefined();
});

test('three contacts build readiness; the fourth schedules a distinct delayed half-damage contact', () => {
  const f = fixture();
  for (let n = 1; n <= 3; n++) {
    f.primary();
    expect(f.passive.stacks).toBe(n);
    expect(f.passive.strike).toBeNull();
  }
  f.primary();
  const strike = f.passive.strike!;
  const nextAttack = f.yi.nextAttackTick;
  expect(strike).toMatchObject({
    startTick: f.w.tick,
    releaseTick: f.w.tick + 22,
    damage: 32.5,
    result: 'pending',
  });
  expect(f.passive.stacks).toBe(0);
  expect(f.target.maxHp - f.target.hp).toBe(260);
  f.w.step(21);
  expect(f.target.maxHp - f.target.hp).toBe(260);
  f.w.step();
  expect(strike.result).toBe('hit');
  expect(f.target.maxHp - f.target.hp).toBe(292.5);
  expect(f.passive.stacks).toBe(1);
  expect(f.yi.nextAttackTick).toBe(nextAttack);
  expect(f.w.projectiles).toEqual([]);
  expect(f.state.qStacks).toBe(0);
  expect(f.target.slows).toEqual([]);
});

test('the secondary counts once toward the next cycle and never recursively schedules another strike', () => {
  const f = fixture();
  f.ready();
  f.w.step(f.passive.strike!.releaseTick - f.w.tick);
  expect(f.passive.stacks).toBe(1);
  f.primary();
  expect(f.passive.stacks).toBe(2);
  f.primary();
  expect(f.passive.stacks).toBe(3);
  f.primary();
  expect(f.passive.strike?.result).toBe('pending');
  const hp = f.target.hp;
  f.w.step(f.passive.strike!.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBe(32.5);
  f.w.step(90);
  expect(hp - f.target.hp).toBe(32.5);
  expect(f.passive.strike).toBeNull();
});

test('a cancelled ready primary spends no stack and cannot inherit the child disabled permission', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  const hp = f.target.hp;
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step(f.yi.nextAttackTick - f.w.tick + 3);
  f.yi.stunUntil = f.w.tick + 30;
  f.w.step(29);
  expect(f.target.hp).toBe(hp);
  expect(f.passive.stacks).toBe(3);
  expect(f.passive.strike).toBeNull();
  expect(f.yi.releaseTick).toBeNull();
  f.w.setOrder(f.yi, { type: 'idle' });
  f.w.step(2);
  expect(f.target.hp).toBe(hp);
});

test.each(['move', 'stun', 'root', 'silence'] as const)(
  'an already committed secondary survives %s without resetting the primary deadline',
  (action) => {
    const f = fixture();
    f.ready();
    const strike = f.passive.strike!;
    const deadline = f.yi.nextAttackTick;
    const hp = f.target.hp;
    if (action === 'move') f.w.setOrder(f.yi, { type: 'move', point: { x: -80, y: 0 } });
    if (action === 'stun') f.yi.stunUntil = f.w.tick + 100;
    if (action === 'root') f.yi.rootUntil = f.w.tick + 100;
    if (action === 'silence') f.yi.silenceUntil = f.w.tick + 100;
    f.w.step(strike.releaseTick - f.w.tick);
    expect(hp - f.target.hp).toBe(32.5);
    expect(f.yi.nextAttackTick).toBe(deadline);
    expect(f.passive.stacks).toBe(1);
  }
);

test.each(['death', 'vision'] as const)(
  'target %s discards the pending child without retargeting or granting a stack',
  (reason) => {
    const f = fixture();
    f.ready();
    const strike = f.passive.strike!;
    const other = f.w.spawn('dummy', 'red', { x: 100, y: 0 });
    if (reason === 'death') f.w.damage(f.yi, f.target, 1e9, 'true');
    else f.hide();
    const hp = f.target.hp;
    f.w.step(strike.releaseTick - f.w.tick);
    expect(strike.result).toBe('lost');
    expect(f.target.hp).toBe(hp);
    expect(other.hp).toBe(other.maxHp);
    expect(f.passive.stacks).toBe(0);
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  }
);

test('a lethal fourth primary consumes readiness without inventing a child against a corpse', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.target.hp = 1;
  f.primary();
  expect(f.target.hp).toBe(0);
  expect(f.passive.stacks).toBe(0);
  expect(f.passive.strike).toBeNull();
});

test('counter expires exactly before commands/contact at the four-second boundary', () => {
  const f = fixture();
  f.primary();
  const expiry = f.passive.expiresTick;
  expect(expiry).toBe(f.w.tick + DOUBLE_STRIKE_STACK_TICKS);
  f.w.step(expiry - f.w.tick - 1);
  expect(f.passive.stacks).toBe(1);
  f.w.step();
  expect(f.passive).toMatchObject({ stacks: 0, expiresTick: 0 });
  f.primary();
  expect(f.passive.stacks).toBe(1);
});

test('a ready primary landing on the expiry tick starts a fresh counter without a child', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  const expiry = f.passive.expiresTick;
  f.w.step(expiry - f.yi.windupTicks - f.w.tick - 1);
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step();
  expect(f.yi.releaseTick).toBe(expiry);
  f.w.step(expiry - f.w.tick);
  expect(f.passive.stacks).toBe(1);
  expect(f.passive.strike).toBeNull();
});

test('moving out of an ordinary ready windup preserves readiness without committing a child', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  const hp = f.target.hp;
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step(f.yi.nextAttackTick - f.w.tick + 5);
  f.w.setOrder(f.yi, { type: 'move', point: { x: -200, y: 0 } });
  f.w.step(40);
  expect(f.target.hp).toBe(hp);
  expect(f.passive.stacks).toBe(3);
  expect(f.passive.strike).toBeNull();
});

test('level-derived attack speed controls the accepted child windup without changing normal attack cadence', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  f.ready();
  const strike = f.passive.strike!;
  expect(f.yi.windupTicks).toBeLessThan(22);
  expect(strike.releaseTick - strike.startTick).toBe(f.yi.windupTicks);
  const next = f.yi.nextAttackTick;
  f.w.step(strike.releaseTick - f.w.tick);
  expect(f.yi.nextAttackTick).toBe(next);
  expect(f.passive.stacks).toBe(1);
});

test('structure contacts build and consume readiness but neither strike can critically hit a building', () => {
  const f = fixture();
  const turret = f.w.spawn('turret', 'red', { x: 150, y: 0 });
  turret.ai = false;
  turret.hp = turret.maxHp = 10000;
  turret.armor = 0;
  f.state.inventory = Array(6).fill('agility');
  for (let n = 0; n < 4; n++) f.primary(turret);
  expect(turret.maxHp - turret.hp).toBe(260);
  expect(f.passive.strike).toMatchObject({ critical: false, damage: 32.5 });
  f.w.step(f.passive.strike!.releaseTick - f.w.tick);
  expect(turret.maxHp - turret.hp).toBe(292.5);
  expect(f.passive.stacks).toBe(1);
});

test('a secondary that destroys the Nexus produces one terminal result and no retained contact', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  const nexus = f.w.spawn('nexus', 'red', { x: 150, y: 0 });
  nexus.armor = 0;
  nexus.hp = 66;
  f.primary(nexus);
  expect(f.w.winner).toBeNull();
  const release = f.passive.strike!.releaseTick;
  f.w.step(release - f.w.tick);
  expect(f.w.winner).toBe('blue');
  expect(f.w.tick).toBe(release);
  expect(f.state.doubleStrike).toEqual({ stacks: 0, expiresTick: 0, strike: null });
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  const terminal = f.w.snapshot();
  f.w.step(300);
  expect(f.w.snapshot()).toBe(terminal);
});

test('damage/critical roll and deadlines are captured at the fourth contact through later stat changes', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.state.inventory = ['agility'];
  // Separate primary and secondary rolls: force ordinary miss, child crit.
  let seed = 1;
  for (; ; seed++) {
    const r = new Random(seed);
    if (r.next() >= 0.15 && r.next() < 0.15) break;
  }
  f.w.random.state = seed;
  f.primary();
  const strike = f.passive.strike!;
  expect(strike.critical).toBe(true);
  expect(strike.damage).toBe(65);
  const hp = f.target.hp;
  f.yi.damage = 1000;
  f.state.inventory = [];
  const random = f.w.random.state;
  f.w.step(strike.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBe(65);
  expect(f.w.random.state).toBe(random);
});

test('both contacts use armor and shields independently', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.target.armor = 100;
  f.primary();
  const hp = f.target.hp;
  f.target.shields.push({ sourceId: f.w.hero.id, amount: 10, endTick: f.w.tick + 100 });
  f.w.step(f.passive.strike!.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBeCloseTo(6.25);
  expect(f.target.shields).toEqual([]);
});

test('real Cinders acquisition uses melee slow and the child refreshes on-hit burn without an extra pulse', () => {
  const f = fixture();
  f.w.damage(f.yi, f.w.spawnMonster({ x: 300, y: 0 }, null, 'red'), 1e9, 'true');
  f.ready();
  const strike = f.passive.strike!;
  const burn = structuredClone(f.target.cinderBurn!);
  const hp = f.target.hp;
  expect(f.target.slows.find((s) => s.kind === 'cinders')?.startMultiplier).toBe(0.9);
  f.w.step(strike.releaseTick - f.w.tick);
  expect(f.target.cinderBurn?.appliedTick).toBe(strike.releaseTick);
  expect(f.target.cinderBurn?.phaseTick).toBe(burn.phaseTick);
  const pulses = burn.nextTick <= strike.releaseTick ? 5 : 0;
  expect(hp - f.target.hp).toBe(32.5 + pulses);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test.each(['death', 'match-end'] as const)(
  '%s clears counters and pending contacts before they can damage again',
  (reason) => {
    const f = fixture();
    f.ready();
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e9, 'true');
    else f.w.damage(f.yi, f.w.spawn('nexus', 'red', { x: 2000, y: 0 }), 1e9, 'true');
    const hp = f.target.hp;
    expect(f.state.doubleStrike).toEqual({ stacks: 0, expiresTick: 0, strike: null });
    f.w.step(100);
    expect(f.target.hp).toBe(hp);
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  }
);

test.each(['counter', 'pending', 'contact', 'recovery'] as const)(
  '%s checkpoints preserve bytes and exact 300-tick futures',
  (phase) => {
    const f = fixture();
    if (phase === 'counter') f.primary();
    else {
      f.ready();
      if (phase === 'pending') f.w.step(5);
      else f.w.step(f.passive.strike!.releaseTick - f.w.tick + (phase === 'recovery' ? 10 : 0));
    }
    const saved = f.w.snapshot();
    const copy = World.fromSnapshot(saved, f.w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
    copy.setOrder(copy.unit(f.yi.id)!, { type: 'attack', target: f.target.id });
    f.w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(f.w.snapshot());
  }
);

test('the source Passive pose reconstructs from absolute child clocks without changing simulation or random state', () => {
  const f = fixture();
  f.ready();
  f.w.step(5);
  const snapshot = f.w.snapshot();
  const durations = MOBILE_CLIP_DURATIONS['masteryi-base'];
  const pose = mobilePose(f.yi, f.state, f.w.tick, 0.5, durations);
  expect(pose.clip).toBe('entry_85dac0b3');
  expect(pose.time).toBeGreaterThan(0);
  const copy = World.fromSnapshot(snapshot, f.w.battlefield);
  expect(
    mobilePose(copy.unit(f.yi.id)!, copy.championState(f.yi.id), copy.tick, 0.5, durations)
  ).toEqual(pose);
  expect(f.w.snapshot()).toBe(snapshot);
});

test('strict decoding rejects foreign counters, expired/forged clocks, impossible result phases and former schema', () => {
  const f = fixture();
  f.ready();
  f.w.step(3);
  const valid = JSON.parse(f.w.snapshot());
  const mutations: ((s: any, o: any) => void)[] = [
    (s, o) => {
      s.player.doubleStrike = o.doubleStrike;
    },
    (_s, o) => {
      o.doubleStrike = null;
    },
    (_s, o) => {
      o.doubleStrike.stacks = 4;
    },
    (s, o) => {
      o.doubleStrike.stacks = 1;
      o.doubleStrike.expiresTick = s.tick;
    },
    (s, o) => {
      o.doubleStrike.expiresTick = s.tick + 1;
    },
    (_s, o) => {
      o.doubleStrike.strike.result = 'hit';
    },
    (s, o) => {
      o.doubleStrike.strike.startTick = s.tick + 1;
    },
    (s, o) => {
      o.doubleStrike.strike.endTick = s.tick;
    },
    (_s, o) => {
      o.doubleStrike.strike.targetId = f.yi.id;
    },
    (_s, o) => {
      o.doubleStrike.strike.damage = -1;
    },
    (s) => {
      s.version = 138;
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(valid);
    const own = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    mutate(raw, own);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});
