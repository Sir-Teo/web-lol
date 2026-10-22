import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Unit } from '../src/simulation/types';
import { CREST_OF_CINDERS } from '../src/content/crest-of-cinders';
import {
  cinderDamagePerTick,
  cinderSlow,
  redBuffHealingPerSecond,
  RED_BUFF_DURATION_TICKS,
} from '../src/simulation/red-buff';
import { experienceToNextLevel } from '../src/simulation/progression';

function setup(champion: 'ashe' | 'lux' | 'garen' = 'lux') {
  const w = new World(false, PRACTICE_FIXTURE, champion);
  w.nextWaveTick = 1_000_000_000;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  return w;
}
function clear(w: World, killer = w.hero) {
  w.damage(killer, w.spawnMonster({ x: killer.x + 200, y: killer.y }, null, 'red'), 99999, 'true');
}
function target(w: World) {
  const u = w.spawn('dummy', 'red', { x: 200, y: 0 });
  u.hp = u.maxHp = 10000;
  u.armor = 0;
  return u;
}
function land(w: World, u: Unit) {
  const before = u.cinderBurn?.appliedTick ?? -1;
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: u.id } });
  for (let i = 0; i < 300 && (u.cinderBurn?.appliedTick ?? -1) <= before; i++) w.step();
  expect(u.cinderBurn?.appliedTick).toBeGreaterThan(before);
  w.setOrder(w.hero, { type: 'idle' });
}

test('Cinders retains primary-source values, unbound native placeholders and script-selected pixels', () => {
  const pin = JSON.parse(readFileSync('docs/reference/crest-of-cinders-source.json', 'utf8'));
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(sha(pin.parent.path)).toBe(pin.parent.sha256);
  expect(sha(pin.icon.path)).toBe(pin.icon.sha256);
  expect(pin.strings.redMonsterTooltip.value).toContain('for 2 minutes');
  expect(pin.strings.buffTooltip.value).toContain('champions, turrets or epic monsters');
  expect(pin.strings.buffTooltip.value).toContain('@f4@');
  expect(pin.scriptInventory['data/spells/blessingofthelizardelder.luabin64'].constants).toContain(
    'BuffCampRed.dds'
  );
  expect([cinderDamagePerTick(1) * 3, cinderDamagePerTick(18) * 3]).toEqual([15, 54]);
  expect(CREST_OF_CINDERS.healTiers.map((t) => t.level)).toEqual([1, 4, 6, 11]);
});

test('Red last hits grant one independent refreshing buff and retain prior qualifying damage lockout', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  w.damage(enemy, w.hero, 1, 'true');
  clear(w);
  expect(w.player.redBuff).toEqual({ startTick: 0, endTick: 7200, nextRegenTick: 30 });
  expect(w.player.redBuffHealReadyTick).toBe(300);
  expect(w.championState(enemy.id)!.redBuff).toBeNull();
  w.step(17);
  clear(w);
  expect(w.player.redBuff).toEqual({ startTick: 17, endTick: 7217, nextRegenTick: 47 });
  expect(w.player.redBuffHealReadyTick).toBe(300);
  w.damage(enemy, w.spawnMonster({ x: 500, y: 200 }, null, 'blue'), 99999, 'true');
  expect(w.championState(enemy.id)!.blueBuff).not.toBeNull();
  expect(w.championState(enemy.id)!.redBuff).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('a real Lux attack burns in three true-damage instances and slows once, through a saved pulse boundary', () => {
  const w = setup();
  clear(w);
  const u = target(w);
  land(w, u);
  const applied = w.tick;
  expect(u.hp).toBe(10000 - w.hero.damage - 5);
  expect(u.slows.find((s) => s.kind === 'cinders')).toMatchObject({
    sourceId: w.hero.id,
    startMultiplier: 0.95,
    endTick: applied + 180,
  });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(59);
  copy.step(59);
  expect(u.hp).toBe(10000 - w.hero.damage - 5);
  w.step();
  copy.step();
  expect(u.hp).toBe(10000 - w.hero.damage - 10);
  w.step(60);
  copy.step(60);
  expect(u.hp).toBe(10000 - w.hero.damage - 15);
  expect(u.cinderBurn).toBeNull();
  expect(copy.snapshot()).toBe(w.snapshot());
  w.step(60);
  expect(u.slows.find((s) => s.kind === 'cinders')).toBeUndefined();
});

test('reapplying a burn refreshes its duration while preserving phase and avoiding an extra instant tick', () => {
  const w = setup();
  clear(w);
  const u = target(w);
  land(w, u);
  const old = structuredClone(u.cinderBurn!);
  const hp = u.hp;
  land(w, u);
  const pulses = Math.max(0, 1 + Math.floor((w.tick - old.nextTick) / 60));
  expect(hp - u.hp).toBeCloseTo(w.hero.damage + pulses * 5);
  expect(u.cinderBurn!.phaseTick).toBe(old.phaseTick);
  expect(u.cinderBurn!.endTick).toBe(w.tick + 120);
  expect(u.slows.filter((s) => s.kind === 'cinders')).toHaveLength(1);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('Ashe flurry applies one on-hit burn while ordinary spells do not apply Cinders', () => {
  const w = setup('ashe');
  clear(w);
  const u = target(w);
  w.player.qStacks = 4;
  w.player.qStackExpiry = 1000;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: u });
  w.step();
  land(w, u);
  const initial = u.cinderBurn!.appliedTick;
  w.step(15);
  expect(u.cinderBurn!.appliedTick).toBe(initial);
  const v = setup();
  clear(v);
  const t = target(v);
  v.enqueue({ type: 'cast', unit: v.hero.id, ability: 'q', point: t });
  v.step(60);
  expect(t.rootUntil).toBeGreaterThan(v.tick);
  expect(t.cinderBurn).toBeNull();
});

test('Garen Q applies melee Cinders, whereas Judgment does not', () => {
  const w = setup('garen');
  clear(w);
  expect(w.learnSpell('q')).toBeNull();
  const u = target(w);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: u });
  w.step();
  land(w, u);
  expect(u.slows.find((s) => s.kind === 'cinders')?.startMultiplier).toBe(0.9);
  const v = setup('garen');
  clear(v);
  v.learnSpell('e');
  const t = target(v);
  v.enqueue({ type: 'cast', unit: v.hero.id, ability: 'e', point: t });
  v.step(60);
  expect(t.hp).toBeLessThan(t.maxHp);
  expect(t.cinderBurn).toBeNull();
});

test('healing and slow tiers follow the owner level and current maximum health', () => {
  const w = setup();
  clear(w);
  for (const [level, rate, ranged] of [
    [1, 0.005, 0.05],
    [4, 0.01, 0.05],
    [6, 0.015, 0.075],
    [11, 0.03, 0.1],
    [18, 0.03, 0.1],
  ]) {
    while (w.player.level < level) w.gainExperience(experienceToNextLevel(w.player.level));
    expect(redBuffHealingPerSecond(w.player, w.hero.maxHp, w.tick)).toBeCloseTo(
      (w.hero.maxHp * rate) / 5
    );
    expect(cinderSlow(level, false)).toBe(ranged);
    expect(cinderSlow(level, true)).toBe(2 * ranged);
  }
});

test('healing pulses stop for champion/turret damage including shields, but not non-epic monster damage', () => {
  const w = setup(),
    control = setup();
  clear(w);
  w.hero.hp = control.hero.hp = 200;
  w.step(29);
  control.step(29);
  expect(w.hero.hp).toBeCloseTo(control.hero.hp);
  w.step();
  control.step();
  expect(w.hero.hp - control.hero.hp).toBeCloseTo((w.hero.maxHp * 0.005) / 10);
  const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  w.hero.shields.push({ sourceId: w.hero.id, amount: 100, endTick: 1000 });
  w.damage(enemy, w.hero, 1, 'true');
  expect(w.player.redBuffHealReadyTick).toBe(330);
  w.step(299);
  expect(redBuffHealingPerSecond(w.player, w.hero.maxHp, w.tick)).toBe(0);
  w.step();
  expect(redBuffHealingPerSecond(w.player, w.hero.maxHp, w.tick)).toBeGreaterThan(0);
  w.damage(w.spawnMonster({ x: 200, y: 0 }), w.hero, 1, 'true');
  expect(w.player.redBuffHealReadyTick).toBe(330);
  w.damage(w.spawn('turret', 'red', { x: 1000, y: 0 }), w.hero, 1, 'true');
  expect(w.player.redBuffHealReadyTick).toBe(630);
});

test('champion deaths transfer both crests and an uncredited neutral execution retains the original clocks', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  clear(w);
  w.damage(w.hero, w.spawnMonster({ x: 200, y: 300 }, null, 'blue'), 99999, 'true');
  w.step(17);
  w.damage(enemy, w.hero, 99999, 'true');
  expect(w.player.redBuff).toBeNull();
  expect(w.player.blueBuff).toBeNull();
  expect(w.championState(enemy.id)!.redBuff!.endTick).toBe(7217);
  expect(w.championState(enemy.id)!.blueBuff!.endTick).toBe(7217);
  const v = setup();
  clear(v);
  const buff = structuredClone(v.player.redBuff);
  v.damage(v.spawnMonster({ x: 200, y: 0 }, null, 'red'), v.hero, 99999, 'true');
  expect(v.player.redBuff).toEqual(buff);
  const hp = v.hero.hp;
  v.step(30);
  expect(v.hero.hp).toBe(hp);
  expect(v.player.redBuff!.nextRegenTick).toBe(60);
  expect(World.fromSnapshot(v.snapshot(), v.battlefield).snapshot()).toBe(v.snapshot());
});

test('an existing burn survives owner death and credits a posthumous kill/transfer', () => {
  const w = setup();
  clear(w);
  const enemy = w.spawn('champion', 'red', { x: 200, y: 0 });
  enemy.ai = false;
  land(w, enemy);
  const next = enemy.cinderBurn!.nextTick;
  w.damage(enemy, w.hero, 99999, 'true');
  enemy.hp = 1;
  w.step(next - w.tick);
  expect(enemy.deadAt).toBe(next);
  expect(w.player.kills).toBe(1);
  expect(w.player.redBuff!.startTick).toBe(next);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('buff expiry removes new procs while an already-applied burn keeps its saved deadline', () => {
  const w = setup();
  clear(w);
  const u = target(w);
  w.tick = RED_BUFF_DURATION_TICKS - 50;
  land(w, u);
  expect(u.cinderBurn!.endTick).toBeGreaterThan(RED_BUFF_DURATION_TICKS);
  w.step(RED_BUFF_DURATION_TICKS - w.tick);
  expect(w.player.redBuff).toBeNull();
  expect(u.cinderBurn).not.toBeNull();
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  copy.step(180);
  expect(u.cinderBurn).toBeNull();
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('checkpoints reject shifted buff/pulse clocks, forged burn values and invalid owners', () => {
  const w = setup();
  clear(w);
  const u = target(w);
  land(w, u);
  for (const mutate of [
    (s: any) => {
      s.player.redBuff.nextRegenTick++;
    },
    (s: any) => {
      s.player.redBuff.endTick++;
    },
    (s: any) => {
      s.player.redBuffHealReadyTick = s.tick + 301;
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).cinderBurn.sourceId = u.id;
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).cinderBurn.nextTick++;
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).cinderBurn.endTick++;
    },
    (s: any) => {
      s.units.find((v: any) => v.id === u.id).cinderBurn.damagePerTick = 1000;
    },
    (s: any) => {
      delete s.player.redBuff;
    },
    (s: any) => {
      s.units
        .find((v: any) => v.id === u.id)
        .slows.find((v: any) => v.kind === 'cinders').endTick += 10000;
    },
  ]) {
    const s = JSON.parse(w.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

test('shield absorption preserves on-hit burn/slow while structures and protected camps reject both', () => {
  const w = setup();
  clear(w);
  const u = target(w);
  u.shields = [{ sourceId: u.id, amount: 1000, endTick: 1000 }];
  land(w, u);
  expect(u.hp).toBe(u.maxHp);
  expect(u.shields[0].amount).toBe(1000 - w.hero.damage - 5);
  expect(u.cinderBurn).not.toBeNull();
  const v = setup();
  clear(v);
  const tower = v.spawn('turret', 'red', { x: 200, y: 0 });
  v.enqueue({ type: 'order', unit: v.hero.id, order: { type: 'attack', target: tower.id } });
  v.step(60);
  expect(tower.hp).toBeLessThan(tower.maxHp);
  expect(tower.cinderBurn).toBeNull();
  expect(tower.slows).toEqual([]);
  const p = setup();
  clear(p);
  const camp = p.spawnMonster({ x: 200, y: 0 }, { startTick: 0, readyTick: 100 }, 'red');
  p.enqueue({ type: 'order', unit: p.hero.id, order: { type: 'attack', target: camp.id } });
  p.step(60);
  expect(camp.hp).toBe(camp.maxHp);
  expect(camp.cinderBurn).toBeNull();
  expect(camp.slows).toEqual([]);
});

test('burn last hits pay neutral rewards and refresh Red through the ordinary damage/death path', () => {
  const w = setup();
  clear(w);
  const camp = w.spawnMonster({ x: 200, y: 0 }, null, 'red');
  land(w, camp);
  const next = camp.cinderBurn!.nextTick;
  const before = { cs: w.player.cs, xp: w.player.xp, gold: w.player.gold };
  camp.hp = 1;
  w.step(next - w.tick);
  expect(camp.deadAt).toBe(next);
  expect(w.player.cs - before.cs).toBe(4);
  expect(w.player.xp - before.xp).toBe(95);
  expect(w.player.gold - before.gold).toBe(90);
  expect(w.player.redBuff!.startTick).toBe(next);
});
