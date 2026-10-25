import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_R } from '../src/content/masteryi-r';
import { MASTER_YI } from '../src/content/masteryi-progression';
import { experienceToNextLevel } from '../src/simulation/progression';

function fixture(rank = 1) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const state = w.championState(yi.id)!;
  const level = rank ? 6 + (rank - 1) * 5 : 1;
  while (state.level < level) w.gainExperience(experienceToNextLevel(state.level), yi.id);
  for (let i = 0; i < rank; i++) expect(w.learnSpell('r', yi.id)).toBeNull();
  const cast = (ability: 'r' | 'w' | 'e' = 'r') => {
    w.enqueue({ type: 'cast', unit: yi.id, ability, point: yi });
    w.step();
  };
  const victim = () => {
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.ai = false;
    return target;
  };
  const resume = (ticks = 500) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, state, cast, victim, resume };
}

test('Highlander preserves frozen standard rank values, empty animation and omitted calculations', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/character.json', 'utf8')).records;
  const spell = source[MASTER_YI_R.declaration].mSpell;
  expect(MASTER_YI_R.attackSpeedPercentByRank).toEqual([25, 45, 65]);
  expect(MASTER_YI_R.movementSpeedPercentByRank).toEqual([40, 50, 60]);
  expect(MASTER_YI_R.sourceAnimationName).toBe('');
  expect(spell.mAnimationName).toBe('');
  expect(spell.mSpellCalculations).toBeUndefined();
  expect(MASTER_YI_R.sourceCalculations).toBeNull();
  expect(MASTER_YI_R.basicCooldownRefundFraction).toBe(0.699999988079071);
});

test('R learning requires levels 6/11/16, keeps its own resources, and uses own resources', () => {
  const f = fixture(0);
  expect(f.w.learnSpell('r', f.yi.id)).toMatch(/level 6/);
  for (const level of [6, 11, 16]) {
    while (f.state.level < level) f.w.gainExperience(experienceToNextLevel(f.state.level), f.yi.id);
    expect(f.w.learnSpell('r', f.yi.id)).toBeNull();
    if (level < 16) expect(f.w.learnSpell('r', f.yi.id)).toMatch(/level/);
  }
  expect(f.w.learnSpell('r', f.yi.id)).toMatch(/maximum/);
  expect(f.w.learnSpell('q', f.yi.id)).toBeNull();
  expect(f.w.abilitySpec('q', f.yi.id).name).toBe('Alpha Strike');
  expect(f.w.abilitySpec('r', f.yi.id)).toMatchObject({
    name: 'Highlander',
    cost: 100,
    cooldown: 85,
    range: 0,
  });
  expect(f.w.abilityResources('r', f.yi.id)).toEqual({ mana: 100, cooldownSeconds: 85 });
  f.resume();
});

test.each([1, 2, 3])(
  'rank %i adds ratio-scaled AS and the documented uncapped shared movement bonus',
  (rank) => {
    const f = fixture(rank),
      baseSpeed = f.yi.speed,
      period = f.yi.attackPeriod,
      windup = f.yi.windupTicks;
    const mana = f.yi.mana;
    f.cast();
    expect(f.state.highlander).toMatchObject({
      startTick: f.w.tick,
      endTick: f.w.tick + 420,
      rank,
      pausedTicks: 0,
      extensionCount: 0,
      lastExtensionTick: null,
    });
    expect(f.state.cooldowns.r - f.w.tick).toBe(5100);
    expect(f.yi.mana).toBeLessThan(mana - 99);
    expect(f.w.movementSpeed(f.yi)).toBeCloseTo(baseSpeed * (1 + [0.4, 0.5, 0.6][rank - 1]));
    expect(f.w.attackSpeedMultiplier(f.yi, undefined)).toBeCloseTo(
      1 + (MASTER_YI.attackSpeedRatio * [0.25, 0.45, 0.65][rank - 1] * period) / 60
    );
    expect([f.yi.speed, f.yi.attackPeriod, f.yi.windupTicks]).toEqual([baseSpeed, period, windup]);
    f.w.step(420);
    expect(f.state.highlander).toBeNull();
    expect(f.w.movementSpeed(f.yi)).toBe(baseSpeed);
    expect(f.w.attackSpeedMultiplier(f.yi, undefined)).toBe(1);
    f.resume(1);
  }
);

test.each(['unlearned', 'mana', 'stun', 'silence', 'dead', 'cooldown'] as const)(
  '%s cast rejects without restarting Highlander',
  (reason) => {
    const f = fixture(reason === 'unlearned' ? 0 : 1);
    if (reason === 'mana') f.yi.mana = 0;
    if (reason === 'stun') f.w.applyStun(f.yi, 60);
    if (reason === 'silence') f.w.applySilence(f.yi, 60);
    if (reason === 'dead') f.w.damage(f.victim(), f.yi, 1e9, 'true');
    if (reason === 'cooldown') f.state.cooldowns.r = f.w.tick + 60;
    f.cast();
    expect(f.state.highlander).toBeNull();
  }
);

test('root permits R; movement orders, damage, stun and silence do not cancel its buff', () => {
  const f = fixture();
  f.yi.rootUntil = 30;
  f.cast();
  const end = f.state.highlander!.endTick;
  f.w.setOrder(f.yi, { type: 'move', point: { x: 500, y: 0 } });
  f.w.damage(f.victim(), f.yi, 10, 'true');
  f.w.applyStun(f.yi, 10);
  f.w.applySilence(f.yi, 10);
  f.w.step(15);
  expect(f.state.highlander!.endTick).toBe(end);
  f.resume();
});

test('R preserves captured ordinary windup/recovery, order and pending Double Strike instead of resetting attacks', () => {
  const f = fixture();
  const target = f.w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 1e6;
  for (let i = 0; i < 4; i++) {
    f.w.setOrder(f.yi, { type: 'attack', target: target.id });
    f.w.step(Math.max(1, f.yi.nextAttackTick - f.w.tick + 1));
    f.w.step(f.yi.releaseTick! - f.w.tick);
    f.w.setOrder(f.yi, { type: 'idle' });
  }
  const child = structuredClone(f.state.doubleStrike!.strike),
    next = f.yi.nextAttackTick;
  f.cast();
  expect(f.state.doubleStrike!.strike).toEqual(child);
  expect(f.yi.nextAttackTick).toBe(next);
  f.w.setOrder(f.yi, { type: 'attack', target: target.id });
  f.w.step(next - f.w.tick);
  const release = f.yi.releaseTick!,
    cycle = structuredClone(f.yi.attackCycle);
  expect(release - cycle!.startTick).toBeLessThan(f.yi.windupTicks);
  f.state.cooldowns.r = f.w.tick; // explicit development recast fixture
  f.cast();
  expect(f.yi.releaseTick).toBe(release);
  expect(f.yi.attackCycle).toEqual(cycle);
  expect(f.yi.order).toEqual({ type: 'attack', target: target.id });
  f.resume();
});

test('activation cleanses existing slow records, rejects new applications and permits fresh slows after exact expiry', () => {
  const f = fixture();
  const slower = f.w.spawn('champion', 'red', { x: 150, y: 0 }, 'ashe');
  slower.ai = false;
  f.yi.slowUntil = 1000;
  f.yi.slowMultiplier = 0.2;
  f.yi.criticalSlow = { startTick: 0, endTick: 1000, startMultiplier: 0.1, endMultiplier: 0.5 };
  expect(f.w.applySlow(slower, f.yi, 'frost', 1000, 0.3)).toBe(true);
  f.cast();
  expect(f.w.slowFactor(f.yi)).toBe(1);
  expect(f.yi.slows).toEqual([]);
  expect(f.yi.slowUntil).toBe(0);
  expect(f.yi.criticalSlow).toBeNull();
  expect(f.w.applySlow(slower, f.yi, 'frost', 1000, 0.3)).toBe(false);
  f.w.step(419);
  expect(f.w.slowFactor(f.yi)).toBe(1);
  f.w.step();
  expect(f.w.slowFactor(f.yi)).toBe(1);
  expect(f.w.applySlow(slower, f.yi, 'frost', 1000, 0.3)).toBe(true);
  expect(f.w.slowFactor(f.yi)).toBe(0.3);
  f.resume(10);
});

test('actual Volley damage still lands while R rejects ordinary and critical legacy slow callbacks', () => {
  const f = fixture();
  f.cast();
  const ashe = f.w.spawn('champion', 'red', { x: -150, y: 0 }, 'ashe');
  ashe.ai = false;
  const hp = f.yi.hp;
  f.w.enqueue({ type: 'cast', unit: ashe.id, ability: 'w', point: f.yi });
  f.w.step(60);
  expect(f.yi.hp).toBeLessThan(hp);
  expect(f.yi.slows).toEqual([]);
  expect(f.yi.slowUntil).toBe(0);
  expect(f.yi.criticalSlow).toBeNull();
  expect(f.w.slowFactor(f.yi)).toBe(1);
  f.resume();
});

test('Charm still forces walking but its slowing factor is ignored during R', () => {
  const f = fixture();
  f.cast();
  const ahri = f.w.spawn('champion', 'red', { x: 1000, y: 0 }, 'ahri');
  ahri.ai = false;
  expect(f.w.learnSpell('e', ahri.id)).toBeNull();
  expect(f.w.applyCharm(ahri, f.yi, 1)).toBe(true);
  const start = f.yi.x;
  f.w.step(10);
  expect(f.yi.charm).not.toBeNull();
  expect(f.yi.x).toBeGreaterThan(start);
  expect(f.w.slowFactor(f.yi)).toBe(1);
  f.resume();
});

test.each(['kill', 'assist'] as const)(
  '%s extends a live buff once and refunds only remaining W/E cooldowns',
  (credit) => {
    const f = fixture();
    expect(f.w.learnSpell('w', f.yi.id)).toBeNull();
    expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
    f.cast();
    f.w.step(10);
    f.state.cooldowns.w = f.w.tick + 100;
    f.state.cooldowns.e = f.w.tick + 1000;
    const r = f.state.cooldowns.r,
      end = f.state.highlander!.endTick,
      target = f.victim();
    if (credit === 'assist') {
      f.w.damage(f.yi, target, 1, 'true');
      f.w.damage(f.w.hero, target, 1e9, 'true');
    } else f.w.damage(f.yi, target, 1e9, 'true');
    expect(f.state[credit === 'kill' ? 'kills' : 'assists']).toBe(1);
    expect(f.state.highlander).toMatchObject({
      endTick: end + 420,
      extensionCount: 1,
      lastExtensionTick: f.w.tick,
    });
    expect(f.state.cooldowns.w - f.w.tick).toBe(31);
    expect(f.state.cooldowns.e - f.w.tick).toBe(301);
    expect(f.state.cooldowns.r).toBe(r);
    f.w.damage(f.yi, target, 1e9, 'true');
    expect(f.state.highlander!.extensionCount).toBe(1);
    f.resume();
  }
);

test.each(['inactive', 'expired', 'dead'] as const)(
  '%s owner still receives learned R passive without active extension',
  (phase) => {
    const f = fixture();
    expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
    if (phase !== 'inactive') {
      f.cast();
      if (phase === 'expired') f.w.step(420);
    }
    const target = f.victim();
    f.w.damage(f.yi, target, 1, 'true');
    if (phase === 'dead') f.w.damage(target, f.yi, 1e9, 'true');
    f.state.cooldowns.e = f.w.tick + 100;
    f.w.damage(f.w.hero, target, 1e9, 'true');
    expect(f.state.assists).toBe(1);
    expect(f.state.cooldowns.e - f.w.tick).toBe(31);
    expect(f.state.highlander).toBeNull();
    f.resume(10);
  }
);

test('unlearned R, nonchampions and unrelated allied kills do not trigger its passive', () => {
  const f = fixture(0);
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  f.state.cooldowns.e = 100;
  f.w.damage(f.yi, f.victim(), 1e9, 'true');
  expect(f.state.cooldowns.e).toBe(100);
  const g = fixture();
  expect(g.w.learnSpell('e', g.yi.id)).toBeNull();
  g.cast();
  g.state.cooldowns.e = g.w.tick + 100;
  g.w.damage(g.w.hero, g.victim(), 1e9, 'true');
  g.w.damage(g.yi, g.w.spawn('dummy', 'red', { x: 150, y: 0 }), 1e9, 'true');
  expect(g.state.highlander!.extensionCount).toBe(0);
  expect(g.state.cooldowns.e - g.w.tick).toBe(100);
});

test.each(['before', 'during'] as const)(
  'R cast %s Meditate pauses only elapsed channel intervals through the expiry boundary',
  (order) => {
    const f = fixture();
    expect(f.w.learnSpell('w', f.yi.id)).toBeNull();
    f.yi.mana = f.yi.maxMana;
    if (order === 'before') {
      f.cast();
      f.w.step(418);
    }
    f.cast('w');
    const castTick = f.w.tick;
    if (order === 'during') {
      f.w.step(10);
      f.cast();
    }
    const initial = structuredClone(f.state.highlander!);
    expect(initial).not.toBeNull();
    f.w.step(100);
    expect(f.state.meditate!.stopTick).toBeNull();
    expect(f.state.highlander!.pausedTicks - initial.pausedTicks).toBe(100);
    f.resume(800);
    expect(f.state.highlander).toBeNull();
    expect(f.w.tick).toBeGreaterThan(castTick);
  }
);

test.each(['death', 'victory'] as const)('%s clears active R and its paused state', (reason) => {
  const f = fixture();
  f.cast();
  if (reason === 'death') f.w.damage(f.victim(), f.yi, 1e9, 'true');
  else f.w.damage(f.yi, f.w.spawn('nexus', 'red', { x: 2000, y: 0 }), 1e9, 'true');
  expect(f.state.highlander).toBeNull();
  f.resume(10);
});

test.each([0, 1, 419, 420])('R age %i preserves exact saved bytes and 500-tick future', (age) => {
  const f = fixture();
  f.cast();
  f.w.step(age);
  f.resume();
});

test('strict save validation rejects foreign, expired, forged, unearned and former-schema R states', () => {
  const f = fixture();
  f.cast();
  f.w.step(5);
  const saved = JSON.parse(f.w.snapshot());
  const mutations: ((s: any, o: any) => void)[] = [
    (s, o) => {
      s.player.highlander = o.highlander;
    },
    (_s, o) => {
      o.highlander.endTick++;
    },
    (s, o) => {
      o.highlander.startTick = s.tick + 1;
    },
    (_s, o) => {
      o.highlander.pausedTicks++;
    },
    (_s, o) => {
      o.highlander.rank = 2;
    },
    (_s, o) => {
      o.highlander.extensionCount++;
      o.highlander.endTick += 420;
      o.highlander.lastExtensionTick = 1;
    },
    (_s, o) => {
      o.highlander.lastExtensionTick = 1;
    },
    (_s, o) => {
      o.highlander.takedownsAtCast = 1;
    },
    (_s, o) => {
      o.kills++;
    },
    (s) => {
      s.version = 141;
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(saved),
      own = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    mutate(raw, own);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});

test('repeated takedowns extend from the existing deadline, without resetting paused time or over-refunding ready spells', () => {
  const f = fixture();
  expect(f.w.learnSpell('w', f.yi.id)).toBeNull();
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  f.cast();
  f.cast('w');
  f.w.step(30);
  f.state.cooldowns.e = f.w.tick - 5;
  const ready = f.state.cooldowns.e,
    end = f.state.highlander!.endTick;
  f.w.damage(f.yi, f.victim(), 1e9, 'true');
  f.w.damage(f.yi, f.victim(), 1e9, 'true');
  expect(f.state.highlander).toMatchObject({
    extensionCount: 2,
    endTick: end + 840,
    pausedTicks: 30,
  });
  expect(f.state.cooldowns.e).toBe(ready);
  f.resume();
});

test('ability haste changes R cooldown, while duration and additive Heal haste stay independent', () => {
  const f = fixture();
  f.state.inventory = ['codex'];
  const ticks = Math.ceil(f.w.abilityResources('r', f.yi.id).cooldownSeconds * 60);
  expect(ticks).toBeLessThan(5100);
  f.cast();
  expect(f.state.cooldowns.r - f.w.tick).toBe(ticks);
  expect(f.state.highlander!.endTick - f.w.tick).toBe(420);
  f.yi.summonerHealSpeedUntil = f.w.tick + 60;
  expect(f.w.movementSpeed(f.yi)).toBeCloseTo(f.yi.speed * 1.7);
  f.resume();
});
