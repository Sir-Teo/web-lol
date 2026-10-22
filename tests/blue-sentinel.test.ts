import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import blue from '../src/content/blue-sentinel.json';
import { MONSTERS } from '../src/content/monsters';
import { RIFT_CAMPS } from '../src/content/rift-camps';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { World } from '../src/simulation/world';
import { createLaneMatch } from '../src/simulation/lane-match';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { impactTargetRig } from '../src/content/impact-target';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

function encounter() {
  const world = new World(false, PRACTICE_FIXTURE);
  world.nextWaveTick = 1_000_000_000;
  Object.assign(world.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const unit = world.spawnMonster({ x: 200, y: 0 }, null, 'blue');
  return { world, unit };
}
function lane() {
  const world = createLaneMatch(rift);
  world.nextWaveTick = 1_000_000_000;
  for (const u of world.units) u.ai = false;
  return world;
}

test('Blue uses pinned Root stats while retaining an absent source range and the skin-selection conflict', () => {
  const pin = JSON.parse(readFileSync(blue.sourcePin, 'utf8'));
  expect(blue.sourcePinSha256).toBe(sha(blue.sourcePin));
  for (const parent of Object.values(pin.parents) as any[])
    expect(parent.sha256).toBe(sha(parent.path));
  expect(pin.camps.map((c: any) => c.group)).toEqual([
    [{ character: 'SRU_Blue', animation: 'spawn' }],
    [{ character: 'SRU_Blue', animation: 'spawn' }],
  ]);
  expect(pin.skinSelection).toMatchObject({ localSkin: 0, skin4Name: 'SRU_Blue_Baron' });
  const parent = JSON.parse(readFileSync(pin.parents['jungle-character-source'].path, 'utf8'));
  const root =
    parent.records['data/characters/sru_blue/sru_blue.bin'][
      'Characters/SRU_Blue/CharacterRecords/Root'
    ];
  expect(root).not.toHaveProperty('attackRangeModifiable');
  expect(blue.sourceAttackRange).toBeNull();
  expect(blue.stats.maxHp).toBe(root.baseHPModifiable.baseValue);
  expect(blue.stats.damage).toBe(root.baseDamageModifiable.baseValue);
  expect(blue.radius).toBe(root.overrideGameplayCollisionRadius);
  expect(blue.pathfindingRadius).toBe(root.pathfindingCollisionRadius);
  expect(MONSTERS.blue.policy.windupTicks / 60).toBeCloseTo(root.basicAttack.mAttackCastTime, 3);
});

test('normal-skin clip aliases and target sampling use the Blue rig independently of Gromp', () => {
  const { unit } = encounter(),
    manifest = JSON.parse(readFileSync('public/assets/models/sru-blue-base.json', 'utf8'));
  expect(blue.modelSha256).toBe(manifest.output.sha256);
  expect(impactTargetRig(unit)).toBe('sru-blue-base');
  for (const [alias, c] of Object.entries(blue.clips)) {
    expect(manifest.clips.find((v: any) => v.name === c.name).durationSeconds).toBe(
      c.durationSeconds
    );
    expect(mobileClipDurations(unit)![alias]).toBe(c.durationSeconds);
  }
  expect(MONSTERS.blue.spawnLeadupTicks).toBe(66);
  expect(MONSTERS.blue.spawnClipTicks).toBe(339);
});

test('Blue releases a physical melee hit at its own windup without a Gromp missile', () => {
  const { world, unit } = encounter();
  expect(unit).toMatchObject({
    team: 'neutral',
    name: 'Blue Sentinel',
    hp: 2300,
    damage: 66,
    armor: 42,
    magicResist: 42,
    speed: 275,
    radius: 131,
    missileSpeed: 0,
    range: 175,
  });
  world.damage(world.hero, unit, 1, 'true');
  world.step();
  const release = unit.releaseTick!;
  expect(release - world.tick).toBe(MONSTERS.blue.policy.windupTicks);
  const hp = world.hero.hp;
  world.step(release - world.tick - 1);
  expect(world.hero.hp).toBe(hp);
  world.step();
  expect(world.hero.hp).toBeLessThan(hp);
  expect(world.projectiles.some((p) => p.source === unit.id)).toBe(false);
  expect(world.grompAttackVisuals).toEqual([]);
  expect(unit.animationTimeline?.primary.clip).toBe('attack1');
});

test('Blue and Gromp keep private retaliation, different leashes and saved controllers', () => {
  const { world, unit } = encounter();
  const gromp = world.spawnMonster({ x: 0, y: 400 });
  world.damage(world.hero, unit, 100, 'true');
  expect(gromp.monster.phase).toBe('idle');
  Object.assign(world.hero, { x: 200, y: 850 });
  expect(PRACTICE_FIXTURE.lineOfSight(unit, world.hero)).toBe(true);
  world.step();
  expect(unit.monster.phase).toBe('engaged');
  const saved = world.snapshot(),
    restored = World.fromSnapshot(saved, PRACTICE_FIXTURE);
  expect(restored.snapshot()).toBe(saved);
  Object.assign(world.hero, { x: -1600, y: 0 });
  Object.assign(restored.hero, { x: -1600, y: 0 });
  world.step(200);
  restored.step(200);
  expect(unit.monster.phase).toBe('idle');
  expect(unit.hp).toBe(unit.maxHp);
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('Blue last hits use its own Root gold, experience and CS without champion credit', () => {
  const { world, unit } = encounter();
  const before = { gold: world.player.gold, xp: world.player.xp, cs: world.player.cs };
  world.damage(world.hero, unit, 99999, 'true');
  expect(world.player.gold - before.gold).toBe(90);
  expect(world.player.xp - before.xp).toBe(95);
  expect(world.player.cs - before.cs).toBe(4);
  expect(world.firstBloodClaimed).toBe(false);
  world.step(MONSTERS.blue.policy.corpseLifetimeTicks + 1);
  expect(world.unit(unit.id)).toBeUndefined();
  expect(World.fromSnapshot(world.snapshot(), PRACTICE_FIXTURE).snapshot()).toBe(world.snapshot());
});

test('Blue keeps species-specific first-ready, protection and clear/respawn calendars among six Rift camps', () => {
  const world = lane(),
    definition = RIFT_CAMPS.find((c) => c.id === 'order-blue')!;
  const profile = MONSTERS.blue,
    birth = definition.firstReadyTick - profile.spawnLeadupTicks;
  world.tick = birth - 2;
  world.step();
  expect(world.units.some((u) => u.kind === 'monster' && u.monster.species === 'blue')).toBe(false);
  world.step();
  const camp = world.jungleCamps.find((c) => c.id === 'order-blue')!;
  const unit = world.unit(camp.unitIds[0]!)!;
  expect(
    world.units.filter((u) => u.kind === 'monster' && u.monster.species === 'blue')
  ).toHaveLength(2);
  expect(unit.monster).toMatchObject({
    species: 'blue',
    phase: 'spawning',
    home: definition.point,
  });
  expect(world.vulnerable(unit)).toBe(false);
  expect(rift.reachable(unit, blue.pathfindingRadius)).toEqual(definition.point);
  const restoredBirth = World.fromSnapshot(world.snapshot(), rift);
  world.step(profile.spawnLeadupTicks);
  restoredBirth.step(profile.spawnLeadupTicks);
  expect(restoredBirth.snapshot()).toBe(world.snapshot());
  expect(world.vulnerable(unit)).toBe(true);
  expect(
    world.jungleCamps.filter((c) => c.id.endsWith('gromp')).every((c) => c.unitIds[0] === null)
  ).toBe(true);
  const oldId = unit.id;
  world.damage(world.hero, unit, 99999, 'true');
  const deadline = world.tick + 300 * 60;
  expect(camp.nextSpawnTick).toBe(deadline);
  world.step(400);
  expect(world.unit(oldId)).toBeUndefined();
  const restored = World.fromSnapshot(world.snapshot(), rift);
  world.tick = restored.tick = deadline - profile.spawnLeadupTicks - 2;
  world.step();
  restored.step();
  expect(camp.unitIds[0]).toBeNull();
  world.step();
  restored.step();
  const fresh = world.unit(camp.unitIds[0]!)!;
  expect(fresh.monster?.phase).toBe('spawning');
  expect(fresh.id).not.toBe(oldId);
  world.step(profile.spawnLeadupTicks);
  restored.step(profile.spawnLeadupTicks);
  expect(fresh.monster).toMatchObject({ species: 'blue', phase: 'idle', home: definition.point });
  expect(restored.snapshot()).toBe(world.snapshot());
});

test('camp checkpoints reject a crossed species, mismatched birth duration and missing Blue camp', () => {
  const world = lane();
  world.tick = 55 * 60 - 1;
  world.step();
  const saved = JSON.parse(world.snapshot());
  for (const mutate of [
    (s: any) => {
      s.jungleCamps = s.jungleCamps.filter((c: any) => c.id !== 'order-blue');
    },
    (s: any) => {
      s.units.find((u: any) => u.monster?.species === 'blue').monster.species = 'gromp';
    },
    (s: any) => {
      s.units.find((u: any) => u.monster?.species === 'blue').monster.spawn.readyTick++;
    },
  ]) {
    const value = structuredClone(saved);
    mutate(value);
    expect(() => World.fromSnapshot(JSON.stringify(value), rift)).toThrow();
  }
});
