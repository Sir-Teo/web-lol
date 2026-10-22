import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import wolves from '../src/content/wolf-camps.json';
import { MONSTERS, monsterSpawnClipTicks } from '../src/content/monsters';
import { RIFT_CAMPS, campLeadupTicks } from '../src/content/rift-camps';
import { NavGrid } from '../src/simulation/navgrid';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
import { impactTargetRig } from '../src/content/impact-target';
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
const definition = RIFT_CAMPS.find((c) => c.id === 'order-wolves')!;
function lane(ready = true) {
  const w = createLaneMatch(rift);
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  if (ready) {
    w.tick = definition.firstReadyTick - 1;
    w.step();
  }
  return w;
}
function pack(w: World) {
  const camp = w.jungleCamps.find((c) => c.id === 'order-wolves')!;
  return { camp, units: camp.unitIds.map((id) => w.unit(id!)!) };
}
function approach(w: World) {
  Object.assign(w.hero, definition.point, { previous: { ...definition.point } });
}
function retreat(w: World) {
  Object.assign(w.hero, rift.spawns.blue);
}

test('both wolf rigs and three-member groups retain source hashes, source omissions and opposite mini spawn assignments', () => {
  const pin = JSON.parse(readFileSync(wolves.sourcePin, 'utf8'));
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(sha(wolves.sourcePin)).toBe(wolves.sourcePinSha256);
  for (const p of Object.values(pin.parents) as any[]) expect(sha(p.path)).toBe(p.sha256);
  expect(pin.extraction.files).toHaveLength(51);
  expect(wolves.profiles['wolf-mini'].sourceDamage).toBeNull();
  expect(wolves.profiles['wolf-mini'].sourceMinionScore).toBeNull();
  expect(wolves.camps.map((c) => c.members.map((m) => m.spawnClip))).toEqual([
    ['spawn', 'spawn_mini1', 'spawn_mini2'],
    ['spawn', 'spawn_mini2', 'spawn_mini1'],
  ]);
  for (const [key, slug, count] of [
    ['wolf', 'sru-murkwolf', 20],
    ['wolf-mini', 'sru-murkwolfmini', 25],
  ] as const) {
    const m = JSON.parse(readFileSync(`public/assets/models/${slug}-base.json`, 'utf8'));
    expect(m.definitionsSha256).toBe(wolves.sourcePinSha256);
    expect(m.output.sha256).toBe(sha(`public/assets/models/${slug}-base.glb`));
    expect(m.output.sha256).toBe(wolves.profiles[key].modelSha256);
    expect(m.clips).toHaveLength(count);
  }
});

test('all three source members emerge together but keep their own pose aliases and animation tails', () => {
  const w = lane(false),
    leadup = campLeadupTicks(definition);
  expect(leadup).toBe(40);
  w.tick = definition.firstReadyTick - leadup - 1;
  w.step();
  const { camp, units } = pack(w);
  expect(camp.unitIds).toHaveLength(3);
  expect(w.jungleCamps).toHaveLength(RIFT_CAMPS.length);
  expect(units.map((u) => u.monster!.species)).toEqual(['wolf', 'wolf-mini', 'wolf-mini']);
  for (const [i, u] of units.entries()) {
    expect(u.monster!.home).toEqual(definition.members[i].point);
    expect(u.monster!.spawn!.clip).toBe(definition.members[i].spawnClip);
    expect(w.vulnerable(u)).toBe(false);
    expect(impactTargetRig(u)).toBe(i === 0 ? 'sru-murkwolf-base' : 'sru-murkwolfmini-base');
  }
  w.step(20);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(20);
  copy.step(20);
  expect(copy.snapshot()).toBe(w.snapshot());
  for (const u of units) {
    expect(w.vulnerable(u)).toBe(true);
    const p = mobilePose(u, undefined, w.tick, 1, mobileClipDurations(u)!);
    expect(p.clip).toBe(u.monster!.spawn!.clip);
    expect(p.time).toBeCloseTo(40 / 60);
  }
  expect(monsterSpawnClipTicks('wolf-mini', 'spawn_mini1')).toBe(79);
  expect(monsterSpawnClipTicks('wolf-mini', 'spawn_mini2')).toBe(119);
});

test('one hit alerts only its own pack and a leash loss resets every survivor together', () => {
  const w = lane();
  approach(w);
  const { camp, units } = pack(w);
  w.damage(w.hero, units[1], 10, 'true');
  for (const u of units)
    expect(u.monster).toMatchObject({ phase: 'engaged', targetId: w.hero.id, spawn: null });
  const other = w.jungleCamps.find((c) => c.id === 'chaos-wolves')!;
  for (const id of other.unitIds) expect(w.unit(id!)!.monster!.phase).toBe('idle');
  w.step();
  expect(units.some((u) => u.releaseTick !== null)).toBe(true);
  retreat(w);
  w.step(250);
  for (const u of units) {
    expect(u.monster!.phase).toBe('idle');
    expect(u.hp).toBe(u.maxHp);
  }
  expect(camp.nextSpawnTick).toBeNull();
  expect(camp.cleanupTicks.every((t) => t === null)).toBe(true);
});

test('leader and mini deaths keep ordered partial slots through corpse-free reload; only the final death schedules respawn', () => {
  const w = lane(),
    { camp, units } = pack(w);
  approach(w);
  const other = structuredClone(w.jungleCamps.filter((c) => c.id !== camp.id));
  w.damage(w.hero, units[0], 99999, 'true');
  w.damage(w.hero, units[1], 99999, 'true');
  expect(camp.unitIds).toEqual([null, null, units[2].id]);
  expect(camp.nextSpawnTick).toBeNull();
  expect(camp.cleanupTicks).toEqual([null, null, w.tick + 600]);
  retreat(w);
  w.step(400);
  expect(w.unit(units[0].id)).toBeUndefined();
  expect(w.unit(units[1].id)).toBeUndefined();
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.damage(w.hero, units[2], 99999, 'true');
  copy.damage(copy.hero, copy.unit(units[2].id)!, 99999, 'true');
  expect(camp.unitIds).toEqual([null, null, null]);
  expect(camp.cleanupTicks.every((t) => t === null)).toBe(true);
  const ready = w.tick + 135 * 60;
  expect(camp.nextSpawnTick).toBe(ready);
  expect(w.jungleCamps.filter((c) => c.id !== camp.id)).toEqual(other);
  w.tick = copy.tick = ready - campLeadupTicks(definition) - 1;
  w.step();
  copy.step();
  expect(camp.unitIds.every((id) => id !== null && !units.some((u) => u.id === id))).toBe(true);
  w.step(40);
  copy.step(40);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(camp.unitIds.map((id) => w.unit(id!)!.hp)).toEqual([1600, 630, 630]);
});

test('marked cleanup requires ten consecutive seconds outside champion combat and grants no survivor rewards', () => {
  const w = lane(),
    { camp, units } = pack(w);
  approach(w);
  w.damage(w.hero, units[0], 99999, 'true');
  w.step(650);
  expect(camp.unitIds.slice(1).every((id) => id !== null)).toBe(true);
  expect(camp.cleanupTicks.slice(1)).toEqual([w.tick + 600, w.tick + 600]);
  const before = { xp: w.player.xp, cs: w.player.cs };
  const copy = World.fromSnapshot(w.snapshot(), rift);
  retreat(w);
  retreat(copy);
  const cleanup = camp.cleanupTicks[1]!;
  w.step(cleanup - w.tick - 1);
  copy.step(cleanup - copy.tick - 1);
  expect(camp.unitIds.slice(1).every((id) => id !== null)).toBe(true);
  w.step();
  copy.step();
  expect(camp.unitIds).toEqual([null, null, null]);
  expect(camp.nextSpawnTick).toBe(cleanup + 135 * 60);
  expect({ xp: w.player.xp, cs: w.player.cs }).toEqual(before);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('manual wolf last hits grant individual Root gold/XP and the local four-CS camp total', () => {
  const w = lane(),
    { units } = pack(w);
  const before = { gold: w.player.gold, xp: w.player.xp, cs: w.player.cs };
  for (const u of units) w.damage(w.hero, u, 99999, 'true');
  expect(w.player.gold - before.gold).toBe(85);
  expect(w.player.xp - before.xp).toBe(80);
  expect(w.player.cs - before.cs).toBe(4);
  expect(w.player.blueBuff).toBeNull();
  expect(w.player.redBuff).toBeNull();
  expect(MONSTERS['wolf-mini'].stats.damage).toBe(20);
});

test('after the leader dies each small wolf owns its own ten-second cleanup clock', () => {
  const w = lane(),
    { camp, units } = pack(w);
  approach(w);
  w.damage(w.hero, units[0], 99999, 'true');
  units[2].monster!.phase = 'idle';
  units[2].monster!.targetId = null;
  w.setOrder(units[2], { type: 'idle' });
  const expiry = camp.cleanupTicks[2]!;
  w.step(600);
  expect(units[2].deadAt).toBe(expiry);
  expect(camp.unitIds).toEqual([null, units[1].id, null]);
  expect(camp.cleanupTicks).toEqual([null, w.tick + 600, null]);
  expect(camp.nextSpawnTick).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
});

test('group saves reject lost slots, duplicate/crossed members, wrong spawn variants and false cleanup clocks', () => {
  const w = lane(),
    { camp, units } = pack(w);
  const data = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.jungleCamps.find((c: any) => c.id === camp.id).unitIds.pop();
    },
    (s: any) => {
      s.jungleCamps.find((c: any) => c.id === camp.id).unitIds[2] = units[1].id;
    },
    (s: any) => {
      s.jungleCamps.find((c: any) => c.id === camp.id).unitIds.reverse();
    },
    (s: any) => {
      s.units.find((u: any) => u.id === units[1].id).monster.spawn.clip = 'spawn_mini2';
    },
    (s: any) => {
      s.jungleCamps.find((c: any) => c.id === camp.id).cleanupTicks[1] = s.tick + 600;
    },
  ]) {
    const s = structuredClone(data);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
  }
});
