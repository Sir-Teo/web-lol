import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AHRI } from '../src/content/ahri-progression';
import { CHAMPION_PROFILES, selectableChampion } from '../src/content/champion-profiles';
import { CRITICAL_ATTACKS } from '../src/content/critical-attacks';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { growthAtLevel, statPrecision } from '../src/simulation/progression';
import { World } from '../src/simulation/world';
import { mobilePose } from '../src/render/mobile-pose';
import { recallAnimationPose } from '../src/render/recall-animation';
import { impactTargetRig } from '../src/content/impact-target';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (point) => ({ ...point }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const target = w.spawn('dummy', 'red', { x: 450, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const state = w.championState(ahri.id)!;
  return { w, ahri, target, state };
}

test('Ahri owns her checked NPC stats and remains outside player selection and Rift spawning', () => {
  const { w, ahri, state } = setup();
  expect(ahri).toMatchObject({
    name: 'Ahri',
    maxHp: 590,
    maxMana: 418,
    damage: 53,
    armor: 21,
    range: 550,
    speed: 330,
    missileSpeed: 1750,
    windupTicks: 18,
  });
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(state.eCharges).toBe(0);
  expect(state.skillPoints).toBe(1);
  expect(CHAMPION_PROFILES.ahri.damageGrowth).toBe(3);
  expect(() => selectableChampion('ahri')).toThrow(/development/);
  expect(() => new World(false, PRACTICE_FIXTURE, 'ahri')).toThrow(/NPC/);
  const rift = new World(false, { ...PRACTICE_FIXTURE, id: 'rift' });
  expect(() => rift.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri')).toThrow(/development/);
  const raw = JSON.parse(w.snapshot());
  raw.player.id = ahri.id;
  raw.otherChampions = raw.otherChampions.filter((s: any) => s.id !== ahri.id);
  expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
});

test('unfinished W/E/R reject learning and commands without spending resources or borrowing Ashe state', () => {
  const { w, ahri, state } = setup();
  w.gainExperience(1e6, ahri.id);
  const mana = ahri.mana;
  expect(w.spellLearningError('q', ahri.id)).toBeNull();
  for (const ability of ['w', 'e', 'r'] as const) {
    expect(w.learnSpell(ability, ahri.id)).toMatch(/development/);
    expect(w.abilityResources(ability, ahri.id)).toEqual({ mana: 0, cooldownSeconds: 0 });
    w.enqueue({ type: 'cast', unit: ahri.id, ability, point: { x: 600, y: 0 } });
  }
  w.step(30);
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(state.skillPoints).toBe(18);
  expect(ahri.mana).toBe(mana);
  expect(state.qStacks).toBe(0);
  expect(state.eCharges).toBe(0);
  expect(w.projectiles).toEqual([]);
  expect(state.pendingCast).toBeNull();
  expect(state.castAnimation).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('basic attacks release one source-speed projectile and physical damage without Frost or Focus', () => {
  const { w, ahri, target, state } = setup();
  w.setOrder(ahri, { type: 'attack', target: target.id });
  w.step();
  const release = ahri.releaseTick!;
  expect(release - w.tick).toBe(18);
  w.step(release - w.tick - 1);
  expect(w.projectiles).toEqual([]);
  expect(target.hp).toBe(target.maxHp);
  w.step();
  expect(w.projectiles).toHaveLength(1);
  expect(w.projectiles[0]).toMatchObject({
    source: ahri.id,
    speed: 1750,
    damage: 53,
    empowered: false,
  });
  w.setOrder(ahri, { type: 'idle' });
  w.step(25);
  expect(target.maxHp - target.hp).toBe(53);
  expect(target.slowUntil).toBe(0);
  expect(target.slows).toEqual([]);
  expect(state.qStacks).toBe(0);
  expect(w.projectiles).toEqual([]);
});

test('cancelling a pending Ahri swing prevents launch and damage', () => {
  const { w, ahri, target } = setup();
  w.setOrder(ahri, { type: 'attack', target: target.id });
  w.step(6);
  w.setOrder(ahri, { type: 'move', point: { x: -300, y: 0 } });
  w.step(50);
  expect(w.projectiles).toEqual([]);
  expect(target.hp).toBe(target.maxHp);
});

test('ordinary critical attacks retain the shared critical policy and source crit pose', () => {
  const { w, ahri, target, state } = setup();
  state.inventory = Array(6).fill('agility');
  w.random.state = 1;
  w.setOrder(ahri, { type: 'attack', target: target.id });
  w.step();
  expect(ahri.attackCycle?.critical).toBe(true);
  const pose = mobilePose(ahri, state, w.tick, 1, MOBILE_CLIP_DURATIONS['ahri-base']);
  expect(pose.clip).toBe('crit');
  w.step(ahri.releaseTick! - w.tick);
  w.setOrder(ahri, { type: 'idle' });
  w.step(25);
  expect(target.maxHp - target.hp).toBe(53 * CRITICAL_ATTACKS.ordinaryMultiplier);
});

test('level growth and regeneration use Ahri data with the explicit BIN AD-growth policy', () => {
  const { w, ahri, state } = setup();
  w.gainExperience(1e6, ahri.id);
  expect(state.level).toBe(18);
  const growth = growthAtLevel(18);
  expect(ahri.maxHp).toBe(statPrecision(AHRI.hp + AHRI.hpGrowth * growth));
  expect(ahri.maxMana).toBe(statPrecision(AHRI.mana + AHRI.manaGrowth * growth));
  expect(ahri.damage).toBe(statPrecision(AHRI.damage + 3 * growth));
  expect(ahri.attackPeriod).toBe(
    Math.round(60 / (AHRI.attackSpeed + AHRI.attackSpeedRatio * AHRI.attackSpeedGrowth * growth))
  );
  ahri.hp = 100;
  ahri.mana = 100;
  w.step(60);
  expect(ahri.hp - 100).toBeCloseTo(AHRI.healthRegen + AHRI.healthRegenGrowth * growth, 4);
  expect(ahri.mana - 100).toBeCloseTo(AHRI.manaRegen + AHRI.manaRegenGrowth * growth, 4);
});

test('pending swings and launched projectiles restore exact state and 300-tick futures', () => {
  for (const age of [5, 25]) {
    const { w, ahri, target } = setup();
    w.setOrder(ahri, { type: 'attack', target: target.id });
    w.step(age);
    expect(age === 5 ? ahri.releaseTick !== null : w.projectiles.length > 0).toBe(true);
    const saved = w.snapshot();
    const copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('strict continuation rejects learned/cooling/casting Ahri spells and former schemas', () => {
  const { w, ahri } = setup();
  const saved = w.snapshot();
  for (const field of ['rank', 'cooldown', 'skillPoints', 'cast', 'version']) {
    const raw = JSON.parse(saved);
    const owner = raw.otherChampions.find((s: any) => s.id === ahri.id);
    if (field === 'rank') owner.spellRanks.q = 1;
    if (field === 'cooldown') owner.cooldowns.w = 100;
    if (field === 'skillPoints') owner.skillPoints = 0;
    if (field === 'cast') owner.castAnimation = { ability: 'q', startTick: 0 };
    if (field === 'version') raw.version = 130;
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
  }
});

test('all 55 Ahri clip endpoints and explicit body/recall bindings retain her own rig', () => {
  const meta = JSON.parse(readFileSync('public/assets/models/ahri-base.json', 'utf8'));
  const durations = MOBILE_CLIP_DURATIONS['ahri-base'];
  expect(Object.keys(durations)).toHaveLength(55);
  expect(durations).toEqual(
    Object.fromEntries(meta.clips.map((clip: any) => [clip.name, clip.durationSeconds]))
  );
  const { w, ahri, state } = setup();
  expect(impactTargetRig(ahri)).toBe('ahri-base');
  expect(mobilePose(ahri, state, w.tick, 1, durations).clip).toBe('idle_var2');
  w.setOrder(ahri, { type: 'move', point: { x: 400, y: 0 } });
  w.step(3);
  expect(mobilePose(ahri, state, w.tick, 1, durations).clip).toBe('run_in');
  expect(recallAnimationPose('ahri', 3, durations).clip).toBe('recall');
});
