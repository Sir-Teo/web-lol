import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { CREST_OF_INSIGHT } from '../src/content/crest-of-insight';
import { ASHE_E } from '../src/content/ashe-e';
import { LUX } from '../src/content/lux-progression';
import { TICK_RATE } from '../src/content/rules';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { experienceToNextLevel } from '../src/simulation/progression';
import { hastedCooldownTicks } from '../src/simulation/ability-haste';
import { BLUE_BUFF_DURATION_TICKS, blueBuffManaPerSecond } from '../src/simulation/blue-buff';

function setup(champion: 'ashe' | 'lux' | 'garen' = 'ashe') {
  const w = new World(false, PRACTICE_FIXTURE, champion);
  w.nextWaveTick = 1_000_000_000;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  return w;
}
function clear(w: World, killer = w.hero) {
  const blue = w.spawnMonster({ x: killer.x + 250, y: killer.y }, null, 'blue');
  w.damage(killer, blue, 100_000, 'true');
  return blue;
}
function level(w: World, target: number) {
  while (w.player.level < target) w.gainExperience(experienceToNextLevel(w.player.level));
}

test('Crest pins frozen duration/transfer tooltips and script-selected source pixels without inventing formula bindings', () => {
  const pin = JSON.parse(readFileSync('docs/reference/crest-of-insight-source.json', 'utf8'));
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(sha(pin.parent.path)).toBe(pin.parent.sha256);
  expect(sha(pin.icon.path)).toBe(pin.icon.sha256);
  expect(pin.strings.blueMonsterTooltip.value).toContain('for 2 minutes');
  expect(CREST_OF_INSIGHT.durationSeconds).toBe(120);
  expect(pin.strings.buffTooltip.value).toContain('transferred to their killer');
  expect(pin.strings.buffTooltip.value).toContain('@f2@ + @f3@%');
  expect(pin.limits.join(' ')).toContain('provisional local policy');
  expect(pin.localization.referenceVersion).toBe('16.18.8175716');
  expect(CREST_OF_INSIGHT.hasteTiers).toEqual([
    { level: 1, haste: 10 },
    { level: 6, haste: 15 },
    { level: 11, haste: 20 },
  ]);
});

test('only the Blue last hitter gains one refreshing buff, with independent champion ownership', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  const blue = w.spawnMonster({ x: 250, y: 0 }, null, 'blue');
  w.damage(w.hero, blue, 100, 'true');
  expect(w.player.blueBuff).toBeNull();
  w.damage(enemy, blue, 100_000, 'true');
  const state = w.championState(enemy.id)!;
  expect(w.player.blueBuff).toBeNull();
  expect(state.blueBuff).toEqual({ startTick: 0, endTick: 7200, nextRegenTick: 30 });
  w.step(17);
  clear(w, enemy);
  expect(state.blueBuff).toEqual({ startTick: 17, endTick: 7217, nextRegenTick: 47 });
  expect(w.abilityHaste(enemy.id)).toBe(10);
  const gromp = w.spawnMonster({ x: 750, y: 0 });
  w.damage(w.hero, gromp, 100_000, 'true');
  expect(w.player.blueBuff).toBeNull();
});

test('haste follows owner level 1/6/11 and adds to items through purchases, recipes and sale', () => {
  const w = setup();
  clear(w);
  w.player.gold = 10000;
  Object.assign(w.hero, w.battlefield.spawns.blue);
  expect(w.buy('mote')).toBeNull();
  expect(w.abilityHaste()).toBe(15);
  expect(w.buy('codex')).toBeNull();
  expect(w.player.inventory).toEqual(['codex']);
  expect(w.abilityHaste()).toBe(20);
  for (const [at, haste] of [
    [5, 20],
    [6, 25],
    [10, 25],
    [11, 30],
    [18, 30],
  ]) {
    level(w, at);
    expect(w.abilityHaste()).toBe(haste);
  }
  w.sell(0);
  expect(w.abilityHaste()).toBe(20);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('each supported kit captures buff haste for new spells, leaving summoners and windups alone', () => {
  for (const champion of ['ashe', 'lux', 'garen'] as const) {
    const w = setup(champion);
    if (champion === 'garen') expect(w.learnSpell('w')).toBeNull();
    const base = Object.fromEntries(
      ['w', 'e', 'd', 'f'].map((a) => [a, w.abilityResources(a as 'w')])
    );
    clear(w);
    for (const a of ['w', 'e', 'd', 'f'] as const) {
      expect(w.abilityResources(a).mana).toBe(base[a].mana);
      expect(w.abilityResources(a).cooldownSeconds).toBeCloseTo(
        base[a].cooldownSeconds / (a === 'd' || a === 'f' ? 1 : 1.1)
      );
    }
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: 500, y: 0 } });
    w.step();
    expect(w.player.cooldowns.w).toBe(1 + hastedCooldownTicks(base.w.cooldownSeconds, 10));
    if (champion !== 'garen') expect(w.player.pendingCast!.releaseTick).toBe(16);
  }
});

test('mana pulses use the current maximum, clamp at full, and resume their exact phase after a save', () => {
  const w = setup('lux');
  clear(w);
  const control = setup('lux');
  w.hero.mana = control.hero.mana = 10;
  w.step(29);
  control.step(29);
  expect(w.hero.mana).toBeCloseTo(control.hero.mana);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  restored.step();
  control.step();
  expect(w.hero.mana - control.hero.mana).toBeCloseTo(2.5 + 0.005 * w.hero.maxMana);
  expect(restored.snapshot()).toBe(w.snapshot());
  Object.assign(w.hero, w.battlefield.spawns.blue);
  w.player.gold = 1000;
  w.buy('sapphire');
  Object.assign(w.hero, { x: 0, y: 0 });
  w.hero.mana = 0;
  const before = w.hero.mana;
  w.step(30);
  const baseRegen = (30 / 60) * LUX.manaRegen;
  expect(w.hero.mana - before).toBeCloseTo(baseRegen + 2.5 + 0.005 * w.hero.maxMana);
  w.hero.mana = w.hero.maxMana - 0.01;
  w.step(30);
  expect(w.hero.mana).toBe(w.hero.maxMana);
});

test('manaless Garen gains haste without creating a mana pool', () => {
  const w = setup('garen');
  clear(w);
  w.step(60);
  expect(w.abilityHaste()).toBe(10);
  expect(w.hero.maxMana).toBe(0);
  expect(w.hero.mana).toBe(0);
  expect(blueBuffManaPerSecond(w.hero.maxMana)).toBe(0);
});

test('champion kills transfer and refresh onto an already-buffed killer without duplicating effects', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  clear(w);
  clear(w, enemy);
  w.step(45);
  w.damage(enemy, w.hero, 100_000, 'true');
  expect(w.player.blueBuff).toBeNull();
  const state = w.championState(enemy.id)!;
  expect(state.blueBuff).toEqual({ startTick: 45, endTick: 7245, nextRegenTick: 75 });
  expect(w.abilityHaste(enemy.id)).toBe(10);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('credited monster executions transfer, while true non-epic executions retain the original clock through respawn', () => {
  for (const credited of [false, true]) {
    const w = setup(),
      enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
    clear(w);
    const buff = structuredClone(w.player.blueBuff);
    const gromp = w.spawnMonster({ x: 250, y: 0 });
    w.hero.mana = 0;
    if (credited) w.damage(enemy, w.hero, 1, 'true');
    w.damage(gromp, w.hero, 100_000, 'true');
    if (credited) {
      expect(w.player.blueBuff).toBeNull();
      expect(w.championState(enemy.id)!.blueBuff?.endTick).toBe(7200);
    } else {
      expect(w.player.blueBuff).toEqual(buff);
      const savedMana = w.hero.mana;
      w.step(30);
      expect(w.hero.mana).toBe(savedMana);
      expect(w.player.blueBuff?.nextRegenTick).toBe(60);
      const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
      w.step(w.hero.respawnTick! - w.tick);
      restored.step(restored.hero.respawnTick! - restored.tick);
      expect(w.hero.deadAt).toBeNull();
      expect(w.player.blueBuff?.startTick).toBe(buff!.startTick);
      expect(restored.snapshot()).toBe(w.snapshot());
    }
  }
});

test('uncredited structure execution removes the buff, and dead killers can receive a fresh transfer', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  clear(w);
  const turret = w.spawn('turret', 'blue', { x: 600, y: 0 });
  w.damage(turret, enemy, 100_000, 'true'); // Set up a posthumous enemy missile recipient.
  expect(enemy.deadAt).toBe(0);
  w.damage(enemy, w.hero, 100_000, 'true');
  expect(w.player.blueBuff).toBeNull();
  expect(w.championState(enemy.id)!.blueBuff?.endTick).toBe(7200);
  const v = setup();
  clear(v);
  v.damage(v.spawn('turret', 'red', { x: 600, y: 0 }), v.hero, 100_000, 'true');
  expect(v.player.blueBuff).toBeNull();
});

test('expiry removes haste before commands and leaves captured cooldowns unchanged', () => {
  const w = setup();
  clear(w);
  w.tick = BLUE_BUFF_DURATION_TICKS - 2;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: { x: 500, y: 0 } });
  w.step();
  const deadline = w.player.cooldowns.w;
  expect(deadline).toBe(w.tick + hastedCooldownTicks(18, 10));
  w.step();
  expect(w.player.blueBuff).toBeNull();
  expect(w.abilityHaste()).toBe(0);
  expect(w.player.cooldowns.w).toBe(deadline);
  const v = setup();
  clear(v);
  v.tick = BLUE_BUFF_DURATION_TICKS - 1;
  v.enqueue({ type: 'cast', unit: v.hero.id, ability: 'w', point: { x: 500, y: 0 } });
  v.step();
  expect(v.player.cooldowns.w).toBe(v.tick + 18 * TICK_RATE);
});

test('a retained buff expires during death and cannot transfer on an expired death boundary', () => {
  const w = setup();
  clear(w);
  w.tick = BLUE_BUFF_DURATION_TICKS - 30;
  w.damage(w.spawnMonster({ x: 250, y: 0 }), w.hero, 100_000, 'true');
  w.step(30);
  expect(w.hero.deadAt).not.toBeNull();
  expect(w.player.blueBuff).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  const v = setup();
  clear(v);
  v.tick = BLUE_BUFF_DURATION_TICKS;
  const enemy = v.spawn('champion', 'red', { x: 500, y: 0 });
  v.damage(enemy, v.hero, 100_000, 'true');
  expect(v.player.blueBuff).toBeNull();
  expect(v.championState(enemy.id)!.blueBuff).toBeNull();
});

test('Hawkshot and Judgment retain captured buff haste after it expires, with valid saved continuation', () => {
  const w = setup();
  clear(w);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 500, y: 0 } });
  w.step();
  const first = w.player.eRechargeTick!;
  expect(w.player.eRechargeDurationTicks).toBe(
    hastedCooldownTicks(ASHE_E.rechargeSecondsByRank[0], 10)
  );
  w.player.blueBuff = null;
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(first - w.tick);
  restored.step(first - restored.tick);
  expect(w.player.eCharges).toBe(2);
  expect(w.player.eRechargeDurationTicks).toBe(5400);
  expect(restored.snapshot()).toBe(w.snapshot());
  const g = setup('garen');
  expect(g.learnSpell('e')).toBeNull();
  clear(g);
  g.tick = BLUE_BUFF_DURATION_TICKS - 2;
  g.enqueue({ type: 'cast', unit: g.hero.id, ability: 'e', point: { x: 500, y: 0 } });
  g.step();
  const spin = g.player.garenE!;
  expect(spin.cooldownTicks).toBe(hastedCooldownTicks(9, 10));
  const copy = World.fromSnapshot(g.snapshot(), g.battlefield);
  const end = spin.endTick;
  g.step(end - g.tick);
  copy.step(end - copy.tick);
  expect(g.player.blueBuff).toBeNull();
  expect(g.player.cooldowns.e).toBe(end + hastedCooldownTicks(9, 10));
  expect(copy.snapshot()).toBe(g.snapshot());
});

test('checkpoint rejects future, expired, shifted, missing and malformed buff timelines', () => {
  const w = setup();
  clear(w);
  w.step(17);
  for (const mutate of [
    (s: any) => {
      s.player.blueBuff.startTick = 18;
    },
    (s: any) => {
      s.player.blueBuff.endTick++;
    },
    (s: any) => {
      s.player.blueBuff.nextRegenTick++;
    },
    (s: any) => {
      s.player.blueBuff.nextRegenTick = 0;
    },
    (s: any) => {
      s.player.blueBuff.nextRegenTick = 60;
    },
    (s: any) => {
      s.tick = s.player.blueBuff.endTick;
    },
    (s: any) => {
      delete s.player.blueBuff;
    },
    (s: any) => {
      s.player.blueBuff.stacks = 2;
    },
  ]) {
    const data = JSON.parse(w.snapshot());
    mutate(data);
    expect(() => World.fromSnapshot(JSON.stringify(data), w.battlefield)).toThrow();
  }
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(100);
  restored.step(100);
  expect(restored.snapshot()).toBe(w.snapshot());
});
