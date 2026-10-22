import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import krugs from '../src/content/krug-camps.json';
import { MONSTERS } from '../src/content/monsters';
import { RIFT_CAMPS, campLeadupTicks, campMemberHome } from '../src/content/rift-camps';
import { NavGrid } from '../src/simulation/navgrid';
import { createRift } from '../src/content/rift';
import { createLaneMatch } from '../src/simulation/lane-match';
import { World } from '../src/simulation/world';
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
const defs = RIFT_CAMPS.filter((c) => c.species === 'krug');
function lane(ready = true) {
  const w = createLaneMatch(rift, 'lux');
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  if (ready) {
    w.tick = 4019;
    w.step();
  }
  return w;
}
function pack(w: World, side = 0) {
  const camp = w.jungleCamps.find((c) => c.id === defs[side].id)!;
  return {
    camp,
    parents: camp.unitIds.slice(0, 2).map((id) => w.unit(id!)!),
    children: camp.unitIds.slice(2).flatMap((id) => (id === null ? [] : [w.unit(id)!])),
  };
}
function kill(w: World, id: number) {
  w.damage(w.hero, w.unit(id)!, 99999, 'true');
}

test('all three Krug rigs retain original stats, fractional scores, side clips and explicit script limitations', () => {
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const pin = JSON.parse(readFileSync(krugs.sourcePin, 'utf8'));
  expect(sha(krugs.sourcePin)).toBe(krugs.sourcePinSha256);
  for (const p of Object.values(pin.parents) as any[]) expect(sha(p.path)).toBe(p.sha256);
  expect(pin.extraction.files).toHaveLength(35);
  expect(pin.scriptExtraction.files).toHaveLength(6);
  for (const name of ['sru_krug', 'sru_krugmini', 'sru_krugminimini'])
    expect(
      pin.scriptInventory[`data/characters/${name}/charscript${name}.luabin64`][
        '<main>'
      ].instructions.map((i: any) => i.op)
    ).toEqual(['RETURN']);
  const parent = JSON.parse(readFileSync(pin.parents['jungle-character-source'].path, 'utf8'));
  for (const [species, name, slug, count] of [
    ['krug', 'SRU_Krug', 'sru-krug', 17],
    ['krug-medium', 'SRU_KrugMini', 'sru-krugmini', 16],
    ['krug-mini', 'SRU_KrugMiniMini', 'sru-krugminimini', 16],
  ] as const) {
    const p = krugs.profiles[species],
      root =
        parent.records[`data/characters/${name.toLowerCase()}/${name.toLowerCase()}.bin`][
          `Characters/${name}/CharacterRecords/Root`
        ],
      m = JSON.parse(readFileSync(`public/assets/models/${slug}-base.json`, 'utf8'));
    expect(p.sourceDamage).toBe(root.baseDamageModifiable.baseValue);
    expect(p.sourceMinionScore).toBe(root.minionScoreValue);
    expect(m.definitionsSha256).toBe(krugs.sourcePinSha256);
    expect(m.output.sha256).toBe(sha(`public/assets/models/${slug}-base.glb`));
    expect(m.output.sha256).toBe(p.modelSha256);
    expect(m.clips).toHaveLength(count);
  }
  expect([
    MONSTERS.krug.minionScore,
    MONSTERS['krug-medium'].minionScore,
    MONSTERS['krug-mini'].minionScore,
  ]).toEqual([2, 0.5, 0.25]);
  expect([
    MONSTERS.krug.policy.windupTicks,
    MONSTERS['krug-medium'].policy.windupTicks,
    MONSTERS['krug-mini'].policy.windupTicks,
  ]).toEqual([36, 25, 25]);
});

test('initial emergence creates only the two source members and keeps north variants through exact saved readiness', () => {
  expect(defs.map(campLeadupTicks)).toEqual([52, 52]);
  for (const [side, d] of defs.entries()) {
    const w = lane(false);
    w.tick = d.firstReadyTick - 53;
    w.step();
    const { camp, parents, children } = pack(w, side);
    expect(w.jungleCamps).toHaveLength(12);
    expect(camp.unitIds.slice(2)).toEqual(Array(6).fill(null));
    expect(children).toEqual([]);
    expect(camp.splitWaves).toEqual([]);
    for (const [i, u] of parents.entries()) {
      expect(u.monster!.home).toEqual(campMemberHome(d, i, rift));
      expect(w.vulnerable(u)).toBe(false);
      expect(u.monster!.spawn!.clip).toBe(
        side === 0 ? 'spawn' : i === 0 ? 'spawn_nj' : 'spawn_north_jung'
      );
    }
    w.step(26);
    const copy = World.fromSnapshot(w.snapshot(), rift);
    w.step(26);
    copy.step(26);
    expect(copy.snapshot()).toBe(w.snapshot());
    for (const u of parents) {
      expect(w.vulnerable(u)).toBe(true);
      expect(mobilePose(u, undefined, w.tick, 1, mobileClipDurations(u)!).clip).toBe(
        u.monster!.spawn!.clip
      );
    }
  }
});

test('an Ancient kill waits exactly one second and restores a pending split independently of its corpse', () => {
  const w = lane(),
    { camp, parents } = pack(w);
  kill(w, parents[0].id);
  expect(camp.nextSpawnTick).toBeNull();
  expect(camp.splitWaves[0]).toMatchObject({
    parentSlot: 0,
    deathTick: w.tick,
    readyTick: w.tick + 60,
    status: 'pending',
  });
  w.step(30);
  w.units = w.units.filter((u) => u.id !== parents[0].id);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(29);
  copy.step(29);
  expect(pack(w).children).toHaveLength(0);
  w.step();
  copy.step();
  expect(pack(w).children).toHaveLength(4);
  expect(camp.splitWaves[0].status).toBe('spawned');
  expect(copy.snapshot()).toBe(w.snapshot());
  for (const u of pack(w).children) {
    expect(u.monster!.species).toBe('krug-mini');
    expect(rift.reachable(u.monster!.home, 30)).toEqual(u.monster!.home);
    expect(u.monster!.spawn).toBeNull();
  }
  w.step(100);
  expect(pack(w).children).toHaveLength(4);
});

test('both parent kills can leave an empty pending camp without starting respawn, then produce exactly six minis', () => {
  const w = lane(),
    { camp, parents } = pack(w);
  const before = { gold: w.player.gold, xp: w.player.xp };
  for (const u of parents) kill(w, u.id);
  expect(camp.unitIds.every((id) => id === null)).toBe(true);
  expect(camp.nextSpawnTick).toBeNull();
  expect(camp.splitWaves).toHaveLength(2);
  expect(w.player.gold - before.gold).toBe(25);
  expect(w.player.cs).toBe(2.5);
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(60);
  copy.step(60);
  expect(pack(w).children).toHaveLength(6);
  expect(copy.snapshot()).toBe(w.snapshot());
  const childGold = w.player.gold;
  for (const u of pack(w).children) kill(w, u.id);
  expect(w.player.gold - childGold).toBe(84);
  expect(w.player.xp - before.xp).toBe(121);
  expect(w.player.cs).toBe(4);
  expect(camp.nextSpawnTick).toBe(w.tick + 8100);
  expect(camp.splitWaves).toEqual([]);
});

test('medium-first clear retains its two minis while a living leader shares retaliation and resets', () => {
  const w = lane(),
    { camp, parents } = pack(w);
  Object.assign(
    w.hero,
    rift.reachable({ x: parents[1].x + 150, y: parents[1].y + 100 }, w.hero.radius)
  );
  kill(w, parents[1].id);
  w.step(60);
  expect(pack(w).children).toHaveLength(2);
  expect(camp.cleanupTicks.every((t) => t === null)).toBe(true);
  for (const u of pack(w).children) expect(u.monster!.targetId).toBe(w.hero.id);
  Object.assign(w.hero, rift.spawns.blue);
  w.step(350);
  for (const u of [parents[0], ...pack(w).children]) {
    expect(u.monster!.phase).toBe('idle');
    expect(u.hp).toBe(u.maxHp);
  }
  expect(camp.nextSpawnTick).toBeNull();
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
});

test('leader-first cleanup cancels the unclaimed medium split and pays no reward for any removed survivor', () => {
  const w = lane(),
    { camp, parents } = pack(w);
  kill(w, parents[0].id);
  const score = w.player.cs,
    xp = w.player.xp;
  w.step(600);
  expect(camp.splitWaves.find((s) => s.parentSlot === 1)?.status).toBe('cancelled');
  expect(camp.unitIds.slice(6)).toEqual([null, null]);
  expect(pack(w).children).toHaveLength(4);
  expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  w.step(60);
  expect(camp.unitIds.every((id) => id === null)).toBe(true);
  expect(camp.nextSpawnTick).toBe(w.tick + 8100);
  expect(w.player.cs).toBe(score);
  expect(w.player.xp).toBe(xp);
  expect(camp.splitWaves).toEqual([]);
});

test('descendants refresh their own marked clocks while fighting and preserve a partial clear through saved respawn', () => {
  const w = lane(),
    { camp, parents } = pack(w);
  Object.assign(
    w.hero,
    rift.reachable({ x: parents[0].x + 150, y: parents[0].y + 100 }, w.hero.radius)
  );
  kill(w, parents[0].id);
  w.step(60);
  const children = pack(w).children;
  expect(children.every((u) => u.monster!.targetId === w.hero.id)).toBe(true);
  w.step(100);
  expect(camp.cleanupTicks.slice(2, 6)).toEqual(Array(4).fill(w.tick + 600));
  kill(w, children[0].id);
  Object.assign(w.hero, rift.spawns.blue);
  w.step(300);
  expect(w.unit(children[0].id)).toBeUndefined();
  const copy = World.fromSnapshot(w.snapshot(), rift);
  expect(copy.snapshot()).toBe(w.snapshot());
  for (const world of [w, copy]) {
    const p = pack(world);
    for (const id of [...p.camp.unitIds]) if (id !== null) kill(world, id);
    world.step(60);
    for (const u of pack(world).children) kill(world, u.id);
    world.step(300);
  }
  expect(copy.snapshot()).toBe(w.snapshot());
  const ready = camp.nextSpawnTick!;
  for (const world of [w, copy]) {
    world.tick = ready - 53;
    world.step(53);
    expect(pack(world).parents.map((u) => u.hp)).toEqual([1400, 650]);
    expect(pack(world).children).toEqual([]);
    expect(pack(world).camp.splitWaves).toEqual([]);
  }
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('saved splits reject missing waves, duplicate parents, early births, wrong deadlines and forged child homes', () => {
  const w = lane(),
    { parents } = pack(w);
  kill(w, parents[0].id);
  const data = JSON.parse(w.snapshot());
  const camp = (s: any) => s.jungleCamps.find((c: any) => c.id === defs[0].id);
  for (const mutate of [
    (s: any) => camp(s).splitWaves.pop(),
    (s: any) => camp(s).splitWaves.push(structuredClone(camp(s).splitWaves[0])),
    (s: any) => camp(s).splitWaves[0].readyTick++,
    (s: any) => {
      camp(s).splitWaves[0].status = 'spawned';
    },
    (s: any) => {
      camp(s).splitWaves[0].parentSlot = 1;
    },
    (s: any) => {
      camp(s).nextSpawnTick = s.tick + 8100;
    },
  ]) {
    const s = structuredClone(data);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
  }
  w.step(60);
  const s = JSON.parse(w.snapshot()),
    id = pack(w).children[0].id;
  s.units.find((u: any) => u.id === id).monster.home.x++;
  expect(() => World.fromSnapshot(JSON.stringify(s), rift)).toThrow();
});
