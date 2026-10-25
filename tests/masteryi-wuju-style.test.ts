import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_E } from '../src/content/masteryi-e';
import { WUJU_STYLE_TICKS, wujuStyleDamage } from '../src/simulation/masteryi-wuju-style';

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
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const state = w.championState(yi.id)!;
  if (rank > 1) w.gainExperience(1e6, yi.id);
  for (let n = 0; n < rank; n++) expect(w.learnSpell('e', yi.id)).toBeNull();
  const cast = () => {
    w.enqueue({ type: 'cast', unit: yi.id, ability: 'e', point: yi });
    w.step();
  };
  const primary = (victim = target) => {
    w.setOrder(yi, { type: 'attack', target: victim.id });
    w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
    w.step(yi.releaseTick! - w.tick);
    w.setOrder(yi, { type: 'idle' });
  };
  return { w, yi, target, state, cast, primary };
}

test('standard E retains ranked damage, bonus-stat formula, public resource and separate source omissions', () => {
  const source = JSON.parse(readFileSync('docs/reference/masteryi/character.json', 'utf8')).records;
  const spell = source[MASTER_YI_E.declaration].mSpell;
  expect(MASTER_YI_E.baseDamageByRank).toEqual([20, 25, 30, 35, 40]);
  expect(MASTER_YI_E.baseDamageByRank).toEqual(spell.DataValues[0].values.slice(1, 6));
  expect(spell.mSpellCalculations.TotalDamage.mFormulaParts[1]).toMatchObject({
    mStat: 2,
    mStatFormula: 2,
    mDataValue: 'ADRatio',
  });
  expect(MASTER_YI_E.sourceMana).toBeNull();
  expect(MASTER_YI_E.sourceAnimation).toBeNull();
  expect(MASTER_YI_E.publicManaByRank).toEqual([0, 0, 0, 0, 0]);
  expect(spell.mana).toBeUndefined();
  expect(spell.mAnimationName).toBeUndefined();
  expect(MASTER_YI_E.authoredCastSeconds).toBe(spell.spellCastTime);
  expect(MASTER_YI_E.durationSeconds).toBe(5);
  expect(MASTER_YI_E.legacySwordVFXSeconds).toBe(3);
});

test('own E learns normally while Q/R stay unavailable and no Hawkshot charges are granted', () => {
  const f = fixture(0);
  expect(f.w.spellLearningError('e', f.yi.id)).toBeNull();
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  expect(f.w.abilitySpec('e', f.yi.id).name).toBe('Wuju Style');
  expect(f.state.spellRanks).toEqual({ q: 0, w: 0, e: 1, r: 0 });
  expect(f.state.skillPoints).toBe(0);
  expect(f.state.eCharges).toBe(0);
  expect(f.w.spellLearningError('q', f.yi.id)).toMatch(/skill points/);
  expect(f.w.abilitySpec('q', f.yi.id).name).toBe('Alpha Strike');
  expect(f.w.learnSpell('e', f.yi.id)).toMatch(/No skill points/);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test('instant activation is free, has its own five-second clock and starts the fourteen-second cooldown', () => {
  const f = fixture();
  f.yi.mana = 0;
  f.cast();
  expect(f.state.wujuStyle).toEqual({
    startTick: f.w.tick,
    endTick: f.w.tick + 300,
    rank: 1,
    pausedTicks: 0,
  });
  expect(f.state.cooldowns.e).toBe(f.w.tick + 840);
  expect(f.yi.mana).toBeLessThan(1); // Ordinary resource regeneration still runs.
  expect(f.state.pendingCast).toBeNull();
  expect(f.state.castAnimation).toBeNull();
  expect(f.w.projectiles).toEqual([]);
  const buff = structuredClone(f.state.wujuStyle);
  f.cast();
  expect(f.state.wujuStyle).toEqual(buff);
});

test.each(['stun', 'silence', 'dead', 'unlearned'] as const)(
  '%s prevents activation without starting a cooldown or buff',
  (reason) => {
    const f = fixture(reason === 'unlearned' ? 0 : 1);
    if (reason === 'stun') f.yi.stunUntil = f.w.tick + 100;
    if (reason === 'silence') f.yi.silenceUntil = f.w.tick + 100;
    if (reason === 'dead') f.w.damage(f.target, f.yi, 1e9, 'true');
    f.cast();
    expect(f.state.wujuStyle).toBeNull();
    expect(f.state.cooldowns.e).toBe(0);
  }
);

test('root permits self empowerment and activation preserves an in-flight ordinary windup and attack deadline', () => {
  const f = fixture();
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step(5);
  const release = f.yi.releaseTick!,
    next = f.yi.nextAttackTick;
  f.yi.rootUntil = f.w.tick + 100;
  f.cast();
  expect(f.yi.releaseTick).toBe(release);
  expect(f.yi.nextAttackTick).toBe(next);
  expect(f.state.wujuStyle).not.toBeNull();
  f.w.step(release - f.w.tick);
  expect(f.target.maxHp - f.target.hp).toBe(85);
  expect(f.state.doubleStrike?.stacks).toBe(1);
});

test.each([1, 2, 3, 4, 5])(
  'rank %i deals own true on-hit damage without adding base AD or level growth to bonus AD',
  (rank) => {
    const f = fixture(rank);
    f.cast();
    const trueDamage = MASTER_YI_E.baseDamageByRank[rank - 1];
    expect(wujuStyleDamage(f.yi, f.state, f.w.tick)).toBe(trueDamage);
    f.primary();
    expect(f.target.maxHp - f.target.hp).toBeCloseTo(f.yi.damage + trueDamage, 5);
  }
);

test('bonus AD is sampled live at each contact, including equipment changes during the empowerment', () => {
  const f = fixture();
  f.cast();
  f.yi.damage += 50;
  expect(wujuStyleDamage(f.yi, f.state, f.w.tick)).toBeCloseTo(37.5, 5);
  f.primary();
  const hp = f.target.hp;
  f.yi.damage -= 50;
  f.primary();
  expect(hp - f.target.hp).toBe(85);
});

test('true damage bypasses armor and MR while shields absorb the physical and true components in order', () => {
  const f = fixture();
  f.target.armor = 100;
  f.target.magicResist = 10000;
  f.target.shields = [{ sourceId: f.w.hero.id, amount: 40, endTick: 1000 }];
  f.cast();
  f.primary();
  expect(f.target.maxHp - f.target.hp).toBe(12.5);
  expect(f.target.shields).toEqual([]);
});

test('Double Strike gets the full E on-hit on each contact while only physical child damage is halved', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.cast();
  const hp = f.target.hp;
  f.primary();
  expect(hp - f.target.hp).toBe(85);
  const strike = f.state.doubleStrike!.strike!;
  expect(strike.damage).toBe(32.5);
  f.w.step(strike.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBe(137.5);
  expect(f.state.doubleStrike?.stacks).toBe(1);
});

test('E can activate after a secondary is committed without modifying its captured physical payload or timing', () => {
  const f = fixture();
  for (let n = 0; n < 4; n++) f.primary();
  const strike = structuredClone(f.state.doubleStrike!.strike!);
  const hp = f.target.hp;
  f.cast();
  expect(f.state.doubleStrike!.strike).toEqual(strike);
  f.w.step(strike.releaseTick - f.w.tick);
  expect(hp - f.target.hp).toBe(52.5);
});

test('expiry between primary and child removes the secondary bonus without changing its physical damage', () => {
  const f = fixture();
  f.cast();
  for (let n = 0; n < 4; n++) f.primary();
  const strike = f.state.doubleStrike!.strike!;
  expect(f.state.wujuStyle!.endTick).toBeLessThan(strike.releaseTick);
  const hp = f.target.hp;
  f.w.step(strike.releaseTick - f.w.tick);
  expect(f.state.wujuStyle).toBeNull();
  expect(hp - f.target.hp).toBe(32.5);
});

test('a lethal primary E proc consumes ready Double Strike without scheduling a corpse contact', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.cast();
  f.target.hp = 75;
  f.primary();
  expect(f.target.hp).toBe(0);
  expect(f.state.doubleStrike).toMatchObject({ stacks: 0, expiresTick: 0, strike: null });
});

test('leveling and upgrading E during empowerment preserves the accepted buff rank and excludes new base AD', () => {
  const f = fixture();
  f.cast();
  f.w.gainExperience(1e6, f.yi.id);
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  expect(f.state.spellRanks.e).toBe(2);
  expect(f.state.wujuStyle?.rank).toBe(1);
  expect(wujuStyleDamage(f.yi, f.state, f.w.tick)).toBe(20);
  expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
});

test('critical physical damage never multiplies E true damage', () => {
  const f = fixture();
  f.state.inventory = Array(6).fill('agility');
  f.w.random.state = 1;
  f.cast();
  f.primary();
  expect(f.target.maxHp - f.target.hp).toBe(150);
});

test('buildings do not receive Wuju Style true damage', () => {
  const f = fixture();
  const turret = f.w.spawn('turret', 'red', { x: 150, y: 0 });
  turret.ai = false;
  turret.armor = 0;
  f.cast();
  f.primary(turret);
  expect(turret.maxHp - turret.hp).toBe(65);
});

test.each([-1, 0])('contact %i tick relative to expiry uses the exact buff boundary', (offset) => {
  const f = fixture();
  f.cast();
  const end = f.state.wujuStyle!.endTick,
    release = end + offset;
  f.w.step(release - f.yi.windupTicks - f.w.tick - 1);
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step();
  expect(f.yi.releaseTick).toBe(release);
  f.w.step(release - f.w.tick);
  expect(f.target.maxHp - f.target.hp).toBe(offset === -1 ? 85 : 65);
  if (!offset) expect(f.state.wujuStyle).toBeNull();
});

test('ability haste affects the accepted cooldown but leaves the five-second buff duration intact', () => {
  const f = fixture();
  f.state.inventory = ['chapter'];
  const ticks = Math.ceil(f.w.abilityResources('e', f.yi.id).cooldownSeconds * 60);
  expect(ticks).toBeLessThan(840);
  f.cast();
  expect(f.state.cooldowns.e - f.w.tick).toBe(ticks);
  expect(f.state.wujuStyle!.endTick - f.w.tick).toBe(WUJU_STYLE_TICKS);
});

test.each(['death', 'victory'] as const)(
  '%s clears empowerment and permits exact saved restoration',
  (reason) => {
    const f = fixture();
    f.cast();
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e9, 'true');
    else f.w.damage(f.yi, f.w.spawn('nexus', 'red', { x: 2000, y: 0 }), 1e9, 'true');
    expect(f.state.wujuStyle).toBeNull();
    expect(World.fromSnapshot(f.w.snapshot(), f.w.battlefield).snapshot()).toBe(f.w.snapshot());
  }
);

test('active E plus a pending Double Strike preserves exact bytes, damage and a 300-tick future', () => {
  const f = fixture();
  for (let n = 0; n < 3; n++) f.primary();
  f.cast();
  f.primary();
  f.w.step(3);
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  f.w.step(300);
  copy.step(300);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('strict saves reject foreign, expired, over-ranked and impossible E state while retaining supported learned E', () => {
  const f = fixture();
  f.cast();
  const saved = JSON.parse(f.w.snapshot());
  const mutations: ((s: any, o: any) => void)[] = [
    (s, o) => {
      s.player.wujuStyle = o.wujuStyle;
    },
    (_s, o) => {
      o.wujuStyle.endTick++;
    },
    (s, o) => {
      o.wujuStyle.startTick = s.tick + 1;
    },
    (_s, o) => {
      o.wujuStyle.rank = 2;
    },
    (_s, o) => {
      o.spellRanks.e = 0;
      o.skillPoints++;
    },
    (_s, o) => {
      o.spellRanks.e = 5;
      o.skillPoints = 0;
    },
    (_s, o) => {
      o.spellRanks.q = 1;
    },
    (s) => {
      s.version = 139;
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(saved),
      own = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    mutate(raw, own);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});
