import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import red from '../src/content/red-brambleback.json';
import { MONSTERS } from '../src/content/monsters';
import { RIFT_CAMPS } from '../src/content/rift-camps';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { NavGrid } from '../src/simulation/navgrid';
import { createRift } from '../src/content/rift';
import { mobilePose } from '../src/render/mobile-pose';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';
import { impactTargetRig } from '../src/content/impact-target';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function lane() {
  const w = createLaneMatch(rift);
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  return w;
}
function encounter() {
  const w = new World(false, PRACTICE_FIXTURE, 'lux');
  w.nextWaveTick = 1_000_000_000;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  return { w, unit: w.spawnMonster({ x: 200, y: 0 }, null, 'red') };
}

test('Red retains recovered range, distinct script camp settings and the placed Skin3 conflict', () => {
  const pin = JSON.parse(readFileSync(red.sourcePin, 'utf8'));
  expect(sha(red.sourcePin)).toBe(red.sourcePinSha256);
  for (const p of Object.values(pin.parents) as any[]) expect(sha(p.path)).toBe(p.sha256);
  const parent = JSON.parse(readFileSync(pin.parents['jungle-character-source'].path, 'utf8'));
  const root =
    parent.records['data/characters/sru_red/sru_red.bin'][
      'Characters/SRU_Red/CharacterRecords/Root'
    ];
  expect(red.stats.range).toBe(root.attackRangeModifiable.baseValue);
  expect(red.stats.range).toBe(200);
  expect(red.radius).toBe(120);
  expect(red.pathfindingRadius).toBe(60);
  expect(red.castFrame).toBe(16);
  expect(pin.camps.map((c: any) => [c.index, c.lookup, c.group])).toEqual([
    [4, 'OrderRedBuff1', [{ character: 'SRU_Red', animation: 'spawn' }]],
    [10, 'ChaosRedBuff1', [{ character: 'SRU_Red', animation: 'spawn' }]],
  ]);
  expect(pin.skinSelection).toMatchObject({ localSkin: 0, skin3Name: 'SRU_Red_Baron' });
  const map = JSON.parse(readFileSync(pin.parents['jungle-map-source'].path, 'utf8'));
  expect(
    map.records.neutralCharacterEntities
      .filter(
        (e: any) =>
          e.record.Character.CharacterRecord === 'Characters/SRU_Red/CharacterRecords/Root'
      )
      .map((e: any) => e.record.Character.Skin)
  ).toEqual(['Characters/SRU_Red/Skins/Skin3', 'Characters/SRU_Red/Skins/Skin3']);
  expect(
    pin.scriptInventory['data/characters/sru_red/charscriptsru_red.luabin64'].instructions.map(
      (i: any) => i.op
    )
  ).toEqual(['RETURN']);
});

test('Red rig retains every atomic clip, its source scale and separate zero-length look-at poses', () => {
  const pin = JSON.parse(readFileSync(red.sourcePin, 'utf8'));
  const m = JSON.parse(readFileSync('public/assets/models/sru-red-base.json', 'utf8'));
  expect(m.definitionsSha256).toBe(red.sourcePinSha256);
  expect(m.output.sha256).toBe(sha('public/assets/models/sru-red-base.glb'));
  expect(m.output.sha256).toBe(red.modelSha256);
  expect(m.clips).toHaveLength(15);
  expect(m.clips.filter((c: any) => c.durationSeconds === 0)).toHaveLength(3);
  expect(Object.fromEntries(m.clips.map((c: any) => [c.state, c.source]))).toEqual(
    pin.models.SRU_Red.atomicClips
  );
  expect(m.unitScale).toBeCloseTo(0.02075000047683716);
  expect([m.triangles, m.bones]).toEqual([3766, 69]);
  const { unit } = encounter();
  expect(impactTargetRig(unit)).toBe('sru-red-base');
  for (const [alias, c] of Object.entries(red.clips))
    expect(mobileClipDurations(unit)![alias]).toBe(c.durationSeconds);
  expect(MONSTERS.red.spawnLeadupTicks).toBe(100);
  expect(MONSTERS.red.spawnClipTicks).toBe(240);
});

test('Red melee contact uses its own frame, releases no missile and keeps private retaliation', () => {
  const { w, unit } = encounter();
  const blue = w.spawnMonster({ x: 0, y: 500 }, null, 'blue');
  w.damage(w.hero, unit, 1, 'true');
  w.step();
  const release = unit.releaseTick!;
  expect(release - w.tick).toBe(32);
  expect(blue.monster.phase).toBe('idle');
  const hp = w.hero.hp;
  w.step(31);
  expect(w.hero.hp).toBe(hp);
  w.step();
  expect(w.hero.hp).toBeLessThan(hp);
  expect(w.projectiles.some((p) => p.source === unit.id)).toBe(false);
  expect(w.grompAttackVisuals).toEqual([]);
  const pose = mobilePose(unit, undefined, w.tick, 1, mobileClipDurations(unit)!);
  expect(pose.clip).toBe('attack1');
  expect(pose.time).toBeCloseTo(16 / 30);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  Object.assign(w.hero, { x: -1600, y: 0 });
  Object.assign(copy.hero, { x: -1600, y: 0 });
  w.step(200);
  copy.step(200);
  expect(unit.monster.phase).toBe('idle');
  expect(unit.hp).toBe(unit.maxHp);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Red pays its own Root rewards, cleans up its corpse and does not grant a Blue buff', () => {
  const { w, unit } = encounter();
  const before = { gold: w.player.gold, xp: w.player.xp, cs: w.player.cs };
  w.damage(w.hero, unit, 99999, 'true');
  expect(w.player.gold - before.gold).toBe(90);
  expect(w.player.xp - before.xp).toBe(95);
  expect(w.player.cs - before.cs).toBe(4);
  expect(w.player.blueBuff).toBeNull();
  expect(w.firstBloodClaimed).toBe(false);
  const retention = MONSTERS.red.policy.corpseLifetimeTicks;
  w.step(retention - 1);
  expect(w.unit(unit.id)).toBeDefined();
  w.step();
  expect(w.unit(unit.id)).toBeUndefined();
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('Red protection precedes both Blue births and keeps an exact saved source pose through readiness', () => {
  const w = lane(),
    profile = MONSTERS.red;
  const definition = RIFT_CAMPS.find((c) => c.id === 'order-red')!;
  const birth = definition.firstReadyTick - profile.spawnLeadupTicks;
  w.tick = birth - 2;
  w.step();
  expect(w.units.some((u) => u.kind === 'monster')).toBe(false);
  w.step();
  expect(w.jungleCamps).toHaveLength(6);
  const camp = w.jungleCamps.find((c) => c.id === 'order-red')!;
  const unit = w.unit(camp.unitId!)!;
  expect(w.units.filter((u) => u.kind === 'monster')).toHaveLength(2);
  expect(unit.monster).toMatchObject({ species: 'red', phase: 'spawning', home: definition.point });
  expect(rift.reachable(unit, red.pathfindingRadius)).toEqual(definition.point);
  expect(w.visible(unit, 'blue')).toBe(false);
  expect(w.visible(unit, 'red')).toBe(false);
  const hp = unit.hp;
  w.damage(w.hero, unit, 100, 'true');
  expect(w.applyRoot(unit, 60)).toBe(false);
  expect(w.applySilence(unit, 60)).toBe(false);
  expect(unit.hp).toBe(hp);
  expect(unit.rootUntil).toBe(0);
  expect(unit.silenceUntil).toBe(0);
  w.step(35);
  const savedPose = unit.animationTimeline;
  const copy = World.fromSnapshot(w.snapshot(), rift);
  expect(copy.unit(unit.id)!.animationTimeline).toEqual(savedPose);
  w.step(65);
  copy.step(65);
  expect(w.vulnerable(unit)).toBe(true);
  expect(unit.monster?.spawn).not.toBeNull();
  expect(copy.snapshot()).toBe(w.snapshot());
  w.damage(w.hero, unit, 1, 'true');
  expect(unit.monster?.spawn).toBeNull();
});

test('Red camps respawn independently after corpse-free saves, preserving the other four calendars', () => {
  const w = lane(),
    profile = MONSTERS.red;
  w.tick = 55 * 60 - 1;
  w.step();
  const camp = w.jungleCamps.find((c) => c.id === 'order-red')!;
  const other = w.jungleCamps.find((c) => c.id === 'chaos-red')!;
  const unit = w.unit(camp.unitId!)!,
    id = unit.id,
    otherId = other.unitId;
  const blue = structuredClone(w.jungleCamps.filter((c) => c.id.endsWith('blue')));
  w.damage(w.hero, unit, 99999, 'true');
  const deadline = w.tick + 300 * 60;
  expect(camp).toEqual({ id: 'order-red', unitId: null, nextSpawnTick: deadline });
  expect(w.jungleCamps.filter((c) => c.id.endsWith('blue'))).toEqual(blue);
  w.step(400);
  expect(w.unit(id)).toBeUndefined();
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.tick = copy.tick = deadline - profile.spawnLeadupTicks - 1;
  w.step();
  copy.step();
  const fresh = w.unit(camp.unitId!)!;
  expect(fresh.monster?.phase).toBe('spawning');
  expect(fresh.id).not.toBe(id);
  expect(other.unitId).toBe(otherId);
  w.step(profile.spawnLeadupTicks);
  copy.step(profile.spawnLeadupTicks);
  expect(fresh.monster).toMatchObject({ species: 'red', home: unit.monster!.home, phase: 'idle' });
  expect(fresh.hp).toBe(2300);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('schema rejects missing Red calendars, crossed species and shifted Red protection clocks', () => {
  const w = lane();
  w.tick = 55 * 60 - 1;
  w.step();
  const saved = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.jungleCamps = s.jungleCamps.filter((c: any) => c.id !== 'order-red');
    },
    (s: any) => {
      s.jungleCamps.find((c: any) => c.id === 'order-red').unitId = s.jungleCamps.find(
        (c: any) => c.id === 'order-blue'
      ).unitId;
    },
    (s: any) => {
      s.units.find((u: any) => u.monster?.species === 'red').monster.species = 'blue';
    },
    (s: any) => {
      s.units.find((u: any) => u.monster?.species === 'red').monster.spawn.startTick++;
    },
  ]) {
    const s = structuredClone(saved);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
  }
});
