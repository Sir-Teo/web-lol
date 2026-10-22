import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import raptors from '../src/content/raptor-camps.json';
import { MONSTERS } from '../src/content/monsters';
import { RIFT_CAMPS, campLeadupTicks, campMemberHome } from '../src/content/rift-camps';
import { NavGrid } from '../src/simulation/navgrid';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { mobilePose } from '../src/render/mobile-pose';
import { mobileClipDurations } from '../src/content/mobile-clip-durations';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const definitions = RIFT_CAMPS.filter((c) => c.species === 'raptor');
function lane(ready = true) {
  const w = createLaneMatch(rift, 'lux');
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  if (ready) {
    w.tick = 3299;
    w.step();
  }
  return w;
}
function pack(w: World, side = 0) {
  const camp = w.jungleCamps.find((c) => c.id === definitions[side].id)!;
  return { camp, units: camp.unitIds.map((id) => w.unit(id!)!) };
}

test('raptor Root rewards and all side-specific clips/locators remain linked to original source bytes', () => {
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const pin = JSON.parse(readFileSync(raptors.sourcePin, 'utf8'));
  expect(sha(raptors.sourcePin)).toBe(raptors.sourcePinSha256);
  for (const p of Object.values(pin.parents) as any[]) expect(sha(p.path)).toBe(p.sha256);
  expect(pin.extraction.files).toHaveLength(58);
  expect(new Set(pin.camps.flatMap((c: any) => c.members.map((m: any) => m.lookup))).size).toBe(12);
  const parent = JSON.parse(readFileSync(pin.parents['jungle-character-source'].path, 'utf8'));
  for (const [species, name, slug, count] of [
    ['raptor', 'SRU_Razorbeak', 'sru-razorbeak', 23],
    ['raptor-mini', 'SRU_RazorbeakMini', 'sru-razorbeakmini', 25],
  ] as const) {
    const profile = raptors.profiles[species];
    const root =
      parent.records[`data/characters/${name.toLowerCase()}/${name.toLowerCase()}.bin`][
        `Characters/${name}/CharacterRecords/Root`
      ];
    expect(profile.sourceDamage).toBe(root.baseDamageModifiable.baseValue);
    expect(profile.sourceMinionScore).toBe(root.minionScoreValue);
    expect(profile.gold).toBe(root.goldGivenOnDeath);
    expect(profile.experience).toBe(root.expGivenOnDeath);
    const m = JSON.parse(readFileSync(`public/assets/models/${slug}-base.json`, 'utf8'));
    expect(m.definitionsSha256).toBe(raptors.sourcePinSha256);
    expect(m.output.sha256).toBe(sha(`public/assets/models/${slug}-base.glb`));
    expect(m.output.sha256).toBe(profile.modelSha256);
    expect(m.clips).toHaveLength(count);
    for (const clip of Object.values(profile.clips))
      expect(m.clips.find((c: any) => c.name === clip.name).durationSeconds).toBe(
        clip.durationSeconds
      );
  }
  expect(raptors.profiles['raptor-mini'].sourceMinionScore).toBe(0.4000000059604645);
  expect(MONSTERS['raptor-mini'].minionScore).toBe(0.4);
});

test('six members retain side-specific protected lead-ups and independent spawn tails through saves', () => {
  expect(definitions.map(campLeadupTicks)).toEqual([60, 40]);
  expect(definitions.map((c) => c.members.map((m) => m.spawnClip))).toEqual([
    ['spawn', 'spawn4', 'spawn2', 'spawn3', 'spawn2', 'spawn4'],
    ['north_spawn', 'north_spawn4', 'north_spawn2', 'north_spawn3', 'north_spawn2', 'north_spawn4'],
  ]);
  for (const [side, definition] of definitions.entries()) {
    const w = lane(false),
      leadup = campLeadupTicks(definition);
    w.tick = definition.firstReadyTick - leadup - 1;
    w.step();
    const { camp, units } = pack(w, side);
    expect(w.jungleCamps).toHaveLength(10);
    expect(camp.unitIds).toHaveLength(6);
    for (const [slot, u] of units.entries()) {
      expect(u.monster!.home).toEqual(campMemberHome(definition, slot, rift));
      expect(
        rift.reachable(u.monster!.home, MONSTERS[u.monster!.species].pathfindingRadius)
      ).toEqual(u.monster!.home);
      expect(u.monster!.spawn!.clip).toBe(definition.members[slot].spawnClip);
      w.damage(w.hero, u, 99999, 'true');
      expect(u.hp).toBe(u.maxHp);
    }
    w.step(20);
    const copy = World.fromSnapshot(w.snapshot(), rift);
    w.step(leadup - 20);
    copy.step(leadup - 20);
    expect(copy.snapshot()).toBe(w.snapshot());
    for (const u of units) {
      expect(w.vulnerable(u)).toBe(true);
      const pose = mobilePose(u, undefined, w.tick, 1, mobileClipDurations(u)!);
      expect(pose.clip).toBe(u.monster!.spawn!.clip);
      expect(pose.time).toBeCloseTo(leadup / 60);
    }
  }
});

test('large and small raptors deliver contact at their distinct source windups with exact saved continuation', () => {
  for (const [species, windup, period] of [
    ['raptor', 18, 90],
    ['raptor-mini', 24, 60],
  ] as const) {
    const w = new World(false, PRACTICE_FIXTURE);
    w.nextWaveTick = 1_000_000_000;
    Object.assign(w.hero, { x: 0, y: 0 });
    const u = w.spawnMonster({ x: 100, y: 0 }, null, species);
    w.damage(w.hero, u, 1, 'true');
    w.step();
    expect(u.windupTicks).toBe(windup);
    expect(u.attackPeriod).toBe(period);
    expect(u.releaseTick).toBe(w.tick + windup);
    const hp = w.hero.hp;
    w.step(windup - 1);
    expect(w.hero.hp).toBe(hp);
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step();
    copy.step();
    expect(w.hero.hp).toBeLessThan(hp);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('partial fractional last hits survive reload and all six kills total exactly four CS with Root gold/XP', () => {
  const w = lane(),
    { units } = pack(w);
  const before = { gold: w.player.gold, xp: w.player.xp };
  w.damage(w.hero, units[1], 99999, 'true');
  expect(w.player.cs).toBe(0.4);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  for (const world of [w, copy]) {
    for (const index of [2, 3, 4, 5, 0])
      world.damage(world.hero, world.unit(units[index].id)!, 99999, 'true');
    expect(world.player.cs).toBe(4);
    expect(world.player.gold - before.gold).toBe(75);
    expect(world.player.xp - before.xp).toBe(70);
    expect(world.player.blueBuff).toBeNull();
    expect(world.player.redBuff).toBeNull();
  }
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('five marked survivors retain individual ownership after corpse removal and cleanup respawns six fresh members', () => {
  const w = lane(),
    { camp, units } = pack(w);
  w.damage(w.hero, units[0], 99999, 'true');
  w.damage(w.hero, units[1], 99999, 'true');
  w.step(400);
  expect(w.unit(units[0].id)).toBeUndefined();
  expect(camp.unitIds).toEqual([null, null, ...units.slice(2).map((u) => u.id)]);
  const copy = World.fromSnapshot(w.snapshot(), rift),
    cs = w.player.cs,
    xp = w.player.xp;
  w.step(200);
  copy.step(200);
  expect(camp.unitIds).toEqual(Array(6).fill(null));
  expect(camp.nextSpawnTick).toBe(w.tick + 8100);
  expect(w.player.cs).toBe(cs);
  expect(w.player.xp).toBe(xp);
  expect(copy.snapshot()).toBe(w.snapshot());
  const ready = camp.nextSpawnTick!;
  for (const world of [w, copy]) {
    world.tick = ready - 61;
    world.step(61);
    const fresh = pack(world).units;
    expect(fresh).toHaveLength(6);
    expect(fresh.map((u) => u.hp)).toEqual([1200, 500, 500, 500, 500, 500]);
    expect(fresh.every((u) => !units.some((old) => old.id === u.id))).toBe(true);
  }
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Lux Singularity damages all six source-linked raptors and alerts only their own camp', () => {
  const w = lane(),
    { units } = pack(w);
  const point = {
    x: units.reduce((n, u) => n + u.x, 0) / 6,
    y: units.reduce((n, u) => n + u.y, 0) / 6,
  };
  const start = rift.reachable({ x: point.x - 300, y: point.y }, w.hero.radius, 'blue');
  Object.assign(w.hero, start);
  expect(w.learnSpell('e')).toBeNull();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
  w.step(70);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point });
  w.step();
  for (const u of units) {
    expect(u.hp).toBeLessThan(u.maxHp);
    expect(u.monster!.phase).toBe('engaged');
    expect(u.illumination.some((s) => s.sourceId === w.hero.id)).toBe(true);
  }
  for (const u of pack(w, 1).units) expect(u.monster!.phase).toBe('idle');
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
});

test('legacy blocked homes project into the camp and every pack can complete a full reset', () => {
  const w = lane();
  expect(definitions[0].members[0].point).not.toEqual(pack(w).units[0].monster!.home);
  for (const [side, definition] of definitions.entries()) {
    const { units } = pack(w, side);
    const home = campMemberHome(definition, 0, rift);
    Object.assign(w.hero, rift.reachable({ x: home.x + 100, y: home.y + 100 }, w.hero.radius));
    w.damage(w.hero, units[0], 20, 'true');
    w.step(30);
    Object.assign(w.hero, rift.spawns.blue);
    w.step(350);
    for (const u of units) {
      expect(u.monster!.phase).toBe('idle');
      expect(Math.hypot(u.x - u.monster!.home.x, u.y - u.monster!.home.y)).toBeLessThan(3);
      expect(u.hp).toBe(u.maxHp);
    }
    expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  }
});

test('camp saves reject side-crossed clips, wrong lead-ups, extra slots and noncanonical fractional CS', () => {
  const w = lane(),
    { camp, units } = pack(w),
    data = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => s.jungleCamps.find((c: any) => c.id === camp.id).unitIds.push(null),
    (s: any) => {
      s.units.find((u: any) => u.id === units[0].id).monster.spawn.clip = 'north_spawn';
    },
    (s: any) => {
      s.units.find((u: any) => u.id === units[0].id).monster.spawn.startTick += 20;
    },
    (s: any) => {
      s.units.find((u: any) => u.id === units[0].id).monster.home = definitions[0].members[0].point;
    },
    (s: any) => {
      s.player.cs = 0.4000000059604645;
    },
  ]) {
    const s = structuredClone(data);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
  }
});
