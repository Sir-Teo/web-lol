import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BARON, baronStatsAtLevel } from '../src/content/baron';
import { monsterTags } from '../src/content/monster-tags';
import { SUMMONER_SMITE } from '../src/content/summoner-smite';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { equipSummoners, smiteTarget } from '../src/simulation/smite';
import { grantCompanion, companionDamageMultiplier } from '../src/simulation/owned-companions';
import { prepareMatchImport } from '../src/storage/match-files';
const trusted = { ...PRACTICE_FIXTURE, developmentBaron: true as const };
const encounter = () => createBaronEncounter(trusted);
const boss = (w: World) =>
  w.units.find((u) => u.kind === 'monster' && u.monster.species === 'baron')!;

test('Baron source scalars, model bytes and explicit aliases stay pinned independently of local policies', () => {
  const raw = readFileSync('docs/reference/epic-character-source.json');
  const root = JSON.parse(raw.toString()).records['data/characters/sru_baron/sru_baron.bin'][
    'Characters/SRU_Baron/CharacterRecords/Root'
  ];
  expect(BARON.characterSourceSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(BARON.baseStats.maxHp).toBe(root.baseHPModifiable.baseValue);
  expect(BARON.baseStats.damage).toBe(root.baseDamageModifiable.baseValue);
  expect(BARON.radius).toBe(root.overrideGameplayCollisionRadius);
  expect(monsterTags('baron')).toEqual(root.unitTagsString.split('|').map((s: string) => s.trim()));
  const model = JSON.parse(readFileSync('public/assets/models/sru-baron-base.json', 'utf8'));
  expect(BARON.modelSha256).toBe(model.output.sha256);
  expect(
    createHash('sha256')
      .update(readFileSync('public/assets/models/sru-baron-base.glb'))
      .digest('hex')
  ).toBe(BARON.modelSha256);
  for (const clip of Object.values(BARON.clips))
    expect(model.clips.find((c: any) => c.name === clip.name).durationSeconds).toBe(
      clip.durationSeconds
    );
  expect(BARON.clips.run).toEqual(BARON.clips.idle1);
  expect(BARON.baseStats.speed).toBe(300);
  expect(BARON.stats.speed).toBe(0);
});
test('published minimum and level-18 growth stay distinct from raw Root values', () => {
  expect(baronStatsAtLevel(1)).toEqual(baronStatsAtLevel(11));
  expect(baronStatsAtLevel(11)).toMatchObject({
    maxHp: 17791.75,
    damage: 350.5,
    armor: 104.2,
    magicResist: 67.1,
    speed: 0,
    range: 900,
  });
  expect(baronStatsAtLevel(18)).toMatchObject({
    maxHp: 19190,
    damage: 515,
    armor: 170,
    magicResist: 100,
  });
});
for (const level of [-1, 0, 1.5, 19, NaN, Infinity])
  test(`invalid preview level ${level} is rejected`, () =>
    expect(() => baronStatsAtLevel(level)).toThrow('integer'));
test('public and unrelated hosts reject Baron before mutating IDs or units', () => {
  const w = new World(false, PRACTICE_FIXTURE),
    before = w.snapshot();
  expect(() => w.spawnMonster({ x: 0, y: 0 }, null, 'baron')).toThrow('trusted');
  expect(w.snapshot()).toBe(before);
  expect(() => createBaronEncounter(PRACTICE_FIXTURE)).toThrow('trusted');
  expect(() => createBaronEncounter({ ...trusted, id: 'rift' })).toThrow('trusted');
  const unrelated = new World(false, trusted),
    plain = unrelated.snapshot();
  expect(() => unrelated.spawnMonster({ x: 0, y: 0 }, null, 'baron')).toThrow('trusted');
  expect(unrelated.snapshot()).toBe(plain);
});
for (const team of ['blue', 'red'] as const)
  test(`${team} can damage and receive real stationary Baron retaliation`, () => {
    const w = encounter(),
      b = boss(w),
      attacker = team === 'blue' ? w.hero : w.spawn('champion', 'red', { x: 0, y: 0 });
    attacker.ai = false;
    attacker.hp = attacker.maxHp = 10000;
    if (team === 'red') Object.assign(w.hero, { x: -3000, y: -2000 });
    w.enqueue({ type: 'order', unit: attacker.id, order: { type: 'attack', target: b.id } });
    w.step(180);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(attacker.hp).toBeLessThan(attacker.maxHp);
    expect(b.monster?.targetId).toBe(attacker.id);
    expect(b).toMatchObject({ x: 450, y: 0, speed: 0 });
    expect(w.visionSources('neutral')).toEqual([]);
  });
test('clear-sight out-of-range aggro cannot drag Baron; leaving the local leash resets at its exact home', () => {
  const w = createBaronEncounter({ ...trusted, lineOfSight: () => true }),
    b = boss(w);
  w.hero.hp = w.hero.maxHp = 10000;
  w.damage(w.hero, b, 3000, 'true');
  Object.assign(w.hero, { x: -630, y: 0 });
  w.step(120);
  expect(b).toMatchObject({ x: 450, y: 0 });
  expect(b.monster?.phase).toBe('engaged');
  Object.assign(w.hero, { x: -2000, y: 0 });
  w.step();
  expect(b.monster?.phase).toBe('returning');
  w.step(300);
  expect(b.hp).toBe(b.maxHp);
  expect(b.monster).toMatchObject({ phase: 'idle', targetId: null, home: { x: 450, y: 0 } });
  expect(b).toMatchObject({ x: 450, y: 0 });
});
test('mid-windup snapshot and future stay exact in the trusted host', () => {
  const w = encounter(),
    b = boss(w);
  w.damage(w.hero, b, 1, 'true');
  w.step(8);
  expect(b.releaseTick).toBeGreaterThan(w.tick);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, trusted);
  expect(copy.snapshot()).toBe(saved);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(() => World.fromSnapshot(saved, PRACTICE_FIXTURE)).toThrow('Baron');
  const forged = JSON.parse(saved);
  forged.encounter = null;
  expect(() => World.fromSnapshot(JSON.stringify(forged), trusted)).toThrow('Baron');
});
test('epic tags admit real Smite and exclude ordinary-monster companion damage modifiers', () => {
  const w = encounter(),
    b = boss(w);
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  w.player.inventory.push('scorchclaw');
  grantCompanion(w, 'scorchclaw', w.hero.id, { kind: 'purchase', consumedTick: null });
  expect(smiteTarget(w, w.hero, b)).toBe(true);
  expect(companionDamageMultiplier(w, w.hero, b, 'attack', 'physical')).toBe(1);
  expect(companionDamageMultiplier(w, b, w.hero, 'attack', 'physical')).toBe(1);
  const hp = b.hp;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: b, targetId: b.id });
  w.step();
  expect(b.hp).toBe(hp - 600);
  expect(w.player.smite!.charges).toBe(0);
  for (const [species, tags] of Object.entries(SUMMONER_SMITE.monsterTags))
    expect(monsterTags(species as keyof typeof SUMMONER_SMITE.monsterTags)).toEqual(tags);
});
test('controlled kills give no gold, XP, CS, companion feeds or kill recovery', () => {
  const w = encounter(),
    b = boss(w);
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  w.player.inventory.push('scorchclaw');
  const pet = grantCompanion(w, 'scorchclaw', w.hero.id, { kind: 'purchase', consumedTick: null });
  w.hero.hp -= 100;
  w.hero.mana -= 50;
  const reward = () => ({
    gold: w.player.gold,
    xp: w.player.xp,
    cs: w.player.cs,
    fed: pet.fed,
    bonus: pet.bonusTreats,
    first: pet.firstMonsterDone,
    hp: w.hero.hp,
    mana: w.hero.mana,
  });
  const before = reward(),
    eventStart = w.events.length;
  w.damage(w.hero, b, b.hp + 1, 'true');
  expect(b.hp).toBe(0);
  expect(reward()).toEqual(before);
  expect(w.firstBloodClaimed).toBe(false);
  expect(w.events.slice(eventStart).filter((e) => e.type === 'gold' || e.type === 'heal')).toEqual(
    []
  );
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, trusted).snapshot()).toBe(saved);
});
test('dead/cleared encounters retain private save and import boundaries', async () => {
  const w = encounter(),
    b = boss(w);
  w.damage(w.hero, b, b.hp + 1, 'true');
  w.step(BARON.policy.corpseLifetimeTicks + 1);
  const saved = w.snapshot();
  expect(w.units.some((u) => u.id === b.id)).toBe(false);
  expect(World.fromSnapshot(saved, trusted).snapshot()).toBe(saved);
  const persist = vi.fn(async () => {});
  const prepared = await prepareMatchImport(
    new File([saved], 'baron.json'),
    trusted,
    persist,
    undefined,
    undefined,
    'baron'
  );
  await prepared.load();
  expect(persist).toHaveBeenCalledWith(saved);
  const ordinary = new World(false, PRACTICE_FIXTURE);
  await expect(
    prepareMatchImport(
      new File([ordinary.snapshot()], 'ordinary.json'),
      trusted,
      persist,
      undefined,
      undefined,
      'baron'
    )
  ).rejects.toThrow('own encounter');
  await expect(
    prepareMatchImport(new File([saved], 'baron.json'), PRACTICE_FIXTURE, persist)
  ).rejects.toThrow('Baron');
  expect(persist).toHaveBeenCalledTimes(1);
});
