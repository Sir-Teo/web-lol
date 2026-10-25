import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MASTER_YI } from '../src/content/masteryi-progression';
import { CHAMPION_PROFILES, selectableChampion } from '../src/content/champion-profiles';
import { CRITICAL_ATTACKS } from '../src/content/critical-attacks';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { growthAtLevel, statPrecision } from '../src/simulation/progression';
import { World } from '../src/simulation/world';
import { mobilePose } from '../src/render/mobile-pose';
import { recallAnimationPose } from '../src/render/recall-animation';
import { prepareMatchImport } from '../src/storage/match-files';
import { impactTargetRig } from '../src/content/impact-target';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (point) => ({ x: point.x, y: point.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  const masteryi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  masteryi.ai = false;
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const state = w.championState(masteryi.id)!;
  return { w, masteryi, target, state };
}

test('Master Yi owns his checked NPC stats and remains outside player selection and Rift spawning', () => {
  const { w, masteryi, state } = setup();
  expect(masteryi).toMatchObject({
    name: 'Master Yi',
    maxHp: 640,
    maxMana: 251,
    damage: 65,
    armor: 33,
    range: 175,
    speed: 355,
    missileSpeed: 0,
    windupTicks: 22,
  });
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(state.eCharges).toBe(0);
  expect(state.skillPoints).toBe(1);
  expect(CHAMPION_PROFILES.masteryi.damageGrowth).toBe(2.5);
  expect(() => selectableChampion('masteryi')).toThrow(/development/);
  expect(() => new World(false, PRACTICE_FIXTURE, 'masteryi')).toThrow(/NPC/);
  const rift = new World(false, { ...PRACTICE_FIXTURE, id: 'rift' });
  expect(() => rift.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi')).toThrow(/development/);
  const raw = JSON.parse(w.snapshot());
  raw.player.id = masteryi.id;
  raw.otherChampions = raw.otherChampions.filter((s: any) => s.id !== masteryi.id);
  expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
});

test('unfinished Q/R reject learning and queued casts without spending or borrowing Ashe capabilities', () => {
  const { w, masteryi, state } = setup();
  w.gainExperience(1e6, masteryi.id);
  const mana = masteryi.mana;
  for (const ability of ['q', 'r'] as const) {
    expect(w.spellLearningError(ability, masteryi.id)).toMatch(/not implemented/);
    expect(w.learnSpell(ability, masteryi.id)).toMatch(/not implemented/);
    expect(() => w.abilitySpec(ability, masteryi.id)).toThrow(/not implemented/);
    w.enqueue({ type: 'cast', unit: masteryi.id, ability, point: { x: 600, y: 0 } });
  }
  masteryi.stunUntil = w.tick + 20;
  w.step(30);
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(state.skillPoints).toBe(18);
  expect(masteryi.mana).toBe(mana);
  expect(state.qStacks).toBe(0);
  expect(state.eCharges).toBe(0);
  expect(w.projectiles).toEqual([]);
  expect(state.pendingCast).toBeNull();
  expect(state.castAnimation).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('ordinary melee contact deals physical damage at release without a projectile, Frost, Focus or extra strike', () => {
  const { w, masteryi, target, state } = setup();
  w.setOrder(masteryi, { type: 'attack', target: target.id });
  w.step();
  const release = masteryi.releaseTick!;
  expect(release - w.tick).toBe(22);
  w.step(release - w.tick - 1);
  expect(target.hp).toBe(target.maxHp);
  expect(w.projectiles).toEqual([]);
  w.step();
  expect(target.maxHp - target.hp).toBe(65);
  expect(w.projectiles).toEqual([]);
  w.setOrder(masteryi, { type: 'idle' });
  w.step(25);
  expect(target.maxHp - target.hp).toBe(65);
  expect(target.slows).toEqual([]);
  expect(target.slowUntil).toBe(0);
  expect(state.qStacks).toBe(0);
});

test('cancelling a pending Master Yi swing prevents launch and damage', () => {
  const { w, masteryi, target } = setup();
  w.setOrder(masteryi, { type: 'attack', target: target.id });
  w.step(6);
  w.setOrder(masteryi, { type: 'move', point: { x: -300, y: 0 } });
  w.step(50);
  expect(w.projectiles).toEqual([]);
  expect(target.hp).toBe(target.maxHp);
});

test('ordinary critical attacks retain the shared critical policy and source crit pose', () => {
  const { w, masteryi, target, state } = setup();
  state.inventory = Array(6).fill('agility');
  w.random.state = 1;
  w.setOrder(masteryi, { type: 'attack', target: target.id });
  w.step();
  expect(masteryi.attackCycle?.critical).toBe(true);
  const pose = mobilePose(masteryi, state, w.tick, 1, MOBILE_CLIP_DURATIONS['masteryi-base']);
  expect(pose.clip).toBe('entry_e1798980');
  w.step(masteryi.releaseTick! - w.tick);
  w.setOrder(masteryi, { type: 'idle' });
  w.step(25);
  expect(target.maxHp - target.hp).toBe(65 * CRITICAL_ATTACKS.ordinaryMultiplier);
});

test('level growth and regeneration use Master Yi data with the explicit BIN AD-growth policy', () => {
  const { w, masteryi, state } = setup();
  w.gainExperience(1e6, masteryi.id);
  expect(state.level).toBe(18);
  const growth = growthAtLevel(18);
  expect(masteryi.maxHp).toBe(statPrecision(MASTER_YI.hp + MASTER_YI.hpGrowth * growth));
  expect(masteryi.maxMana).toBe(statPrecision(MASTER_YI.mana + MASTER_YI.manaGrowth * growth));
  expect(masteryi.damage).toBe(statPrecision(MASTER_YI.damage + 2.5 * growth));
  expect(masteryi.attackPeriod).toBe(
    Math.round(
      60 /
        (MASTER_YI.attackSpeed + MASTER_YI.attackSpeedRatio * MASTER_YI.attackSpeedGrowth * growth)
    )
  );
  masteryi.hp = 100;
  masteryi.mana = 100;
  w.step(60);
  expect(masteryi.hp - 100).toBeCloseTo(
    MASTER_YI.healthRegen + MASTER_YI.healthRegenGrowth * growth,
    4
  );
  expect(masteryi.mana - 100).toBeCloseTo(
    MASTER_YI.manaRegen + MASTER_YI.manaRegenGrowth * growth,
    4
  );
});

test('pending swings and melee recovery restore exact state and 300-tick futures', () => {
  for (const age of [5, 25]) {
    const { w, masteryi, target } = setup();
    w.setOrder(masteryi, { type: 'attack', target: target.id });
    w.step(age);
    expect(
      age === 5
        ? masteryi.releaseTick !== null
        : masteryi.releaseTick === null && target.hp < target.maxHp
    ).toBe(true);
    const saved = w.snapshot();
    const copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('strict continuation rejects learned/cooling/casting Master Yi spells and former schemas', () => {
  const { w, masteryi } = setup();
  const saved = w.snapshot();
  for (const field of ['rank', 'cooldown', 'skillPoints', 'cast', 'version']) {
    const raw = JSON.parse(saved);
    const owner = raw.otherChampions.find((s: any) => s.id === masteryi.id);
    if (field === 'rank') owner.spellRanks.q = 1;
    if (field === 'cooldown') owner.cooldowns.w = 100;
    if (field === 'skillPoints') owner.skillPoints = 0;
    if (field === 'cast') owner.castAnimation = { ability: 'q', startTick: 0 };
    if (field === 'version') raw.version = 137;
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
  }
});

test('all 47 Master Yi clip endpoints and explicit body/recall bindings retain his own rig', () => {
  const meta = JSON.parse(readFileSync('public/assets/models/masteryi-base.json', 'utf8'));
  const durations = MOBILE_CLIP_DURATIONS['masteryi-base'];
  expect(Object.keys(durations)).toHaveLength(47);
  expect(durations).toEqual(
    Object.fromEntries(meta.clips.map((clip: any) => [clip.name, clip.durationSeconds]))
  );
  const { w, masteryi, state } = setup();
  expect(impactTargetRig(masteryi)).toBe('masteryi-base');
  expect(mobilePose(masteryi, state, w.tick, 1, durations).clip).toBe('entry_56f6d84b');
  w.setOrder(masteryi, { type: 'move', point: { x: 400, y: 0 } });
  w.step(3);
  expect(mobilePose(masteryi, state, w.tick, 1, durations).clip).toBe('run');
  expect(recallAnimationPose('masteryi', 3, durations).clip).toBe('recall_in');
  expect(recallAnimationPose('masteryi', 5, durations).clip).toBe('recall_loop');
});

test('NPC-scene file preparation requires Ashe and the expected NPC before persistence', async () => {
  const { w } = setup();
  let writes = 0;
  const persist = async () => {
    writes++;
  };
  const file = (world: World) =>
    new File([world.snapshot()], 'match.json', { type: 'application/json' });
  const plain = new World(false, w.battlefield);
  plain.nextWaveTick = Infinity;
  await expect(
    prepareMatchImport(file(plain), w.battlefield, persist, 'ashe', 'masteryi')
  ).rejects.toThrow(/requires a Master Yi NPC/);
  const lux = new World(false, w.battlefield, 'lux');
  lux.nextWaveTick = Infinity;
  lux.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  await expect(
    prepareMatchImport(file(lux), w.battlefield, persist, 'ashe', 'masteryi')
  ).rejects.toThrow(/match files only/);
  expect(writes).toBe(0);
  const prepared = await prepareMatchImport(file(w), w.battlefield, persist, 'ashe', 'masteryi');
  await prepared.load();
  expect(writes).toBe(1);
});
