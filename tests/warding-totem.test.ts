import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { WARD_SOURCE as S, WARD_POLICY as P } from '../src/content/warding-totem';
import { newTrinket, resetTrinket } from '../src/simulation/wards';
import type { Unit } from '../src/simulation/types';
function setup(champion: 'ashe' | 'lux' = 'ashe') {
  const w = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      spawns: { blue: { x: 0, y: 0 }, red: { x: 2000, y: 0 } },
      initialUnits: [],
      reachable: (p) => ({ x: p.x, y: p.y }),
      findPath: (_a, b) => [{ x: b.x, y: b.y }],
      lineWalkable: () => true,
      lineOfSight: () => true,
    },
    champion
  );
  w.nextWaveTick = 1_000_000_000;
  return w;
}
function place(w: World, x = 300, owner = w.hero): Unit {
  w.enqueue({ type: 'ward', unit: owner.id, point: { x, y: 0 } });
  w.step(P.placementTicks + 1);
  return w.units.filter((u) => u.kind === 'ward').at(-1)!;
}
function resume(w: World, ticks: number) {
  const before = w.snapshot(),
    copy = World.fromSnapshot(before, w.battlefield);
  expect(copy.snapshot()).toBe(before);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}

test('ward scalars retain original Root/item facts, metadata-only scripts and the source rig', () => {
  const pinPath = 'docs/reference/warding-totem-source.json';
  const bytes = readFileSync(pinPath),
    pin = JSON.parse(bytes.toString());
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(S.sourceSha256);
  const root =
    pin.records['data/characters/sightward/sightward.bin'][
      'Characters/SightWard/CharacterRecords/Root'
    ];
  expect([
    root.baseHPModifiable.baseValue,
    root.perceptionBubbleRadius,
    S.range,
    S.maxCharges,
    S.maxPlaced,
  ]).toEqual([3, 900, 625, 2, 3]);
  expect(root.unitTagsString).toContain('Special_UntargetableBySpells');
  for (const functions of Object.values(pin.scriptInventory) as any[])
    for (const f of Object.values(functions) as any[]) {
      expect(f.children).toBe(0);
      expect(
        f.instructions.every((i: any) =>
          ['LOADBOOL', 'LOADK', 'SETGLOBAL', 'RETURN', 'NEWTABLE', 'SETLIST'].includes(i.op)
        )
      ).toBe(true);
    }
  const rig = JSON.parse(readFileSync('public/assets/models/sightward-base.json', 'utf8'));
  expect([rig.triangles, rig.bones, rig.clips.length]).toEqual([336, 4, 5]);
  expect(rig.definitionsSha256).toBe(S.sourceSha256);
});

test('placement spends one charge, preserves channel/order and restores its in-flight delivery exactly', () => {
  const w = setup();
  w.player.recallEnd = 480;
  w.enqueue({ type: 'ward', unit: w.hero.id, point: { x: 300, y: 0 } });
  w.step();
  expect(w.player.trinket.charges).toBe(0);
  expect(w.player.recallEnd).toBe(480);
  expect(w.pendingWards).toHaveLength(1);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(0);
  resume(w, P.placementTicks - 1);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(0);
  resume(w, 1);
  const u = w.units.find((u) => u.kind === 'ward')!;
  expect(u).toMatchObject({
    hp: 3,
    maxHp: 3,
    x: 300,
    ward: { ownerId: w.hero.id, createdTick: 21, expireTick: 21 + 5400 },
  });
  expect(w.pendingWards).toEqual([]);
  resume(w, 100);
});

test('a far placement walks to range once, stops there, and replacement movement cancels without spending', () => {
  const w = setup();
  w.enqueue({ type: 'ward', unit: w.hero.id, point: { x: 1200, y: 0 } });
  w.step();
  expect(w.player.trinket.order).toEqual({ x: 1200, y: 0 });
  expect(w.player.trinket.charges).toBe(1);
  resume(w, 140);
  expect(w.player.trinket.order).toBeNull();
  expect(w.hero.order.type).toBe('idle');
  expect(w.hero.x).toBeGreaterThanOrEqual(575);
  expect(w.hero.x).toBeLessThan(590);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(1);
  const canceled = setup();
  canceled.enqueue({ type: 'ward', unit: canceled.hero.id, point: { x: 1200, y: 0 } });
  canceled.step(10);
  canceled.enqueue({ type: 'order', unit: canceled.hero.id, order: { type: 'idle' } });
  canceled.step(300);
  expect(canceled.player.trinket.order).toBeNull();
  expect(canceled.player.trinket.charges).toBe(1);
  expect(canceled.pendingWards).toEqual([]);
});

test('a ward supplies team sight after its owner leaves, hides from ordinary enemy vision and expires exactly', () => {
  const w = setup();
  w.spawn('champion', 'red', { x: 500, y: 0 }).ai = false;
  const u = place(w, 600);
  expect(w.visible(u, 'red')).toBe(true);
  Object.assign(w.hero, { x: -2000, y: 0 });
  expect(w.pointVisible({ x: 1400, y: 0 }, 'blue')).toBe(true);
  w.step(P.revealTicks);
  expect(w.visible(u, 'red')).toBe(false);
  expect(w.visible(u, 'blue')).toBe(true);
  resume(w, 1);
  w.step(u.ward!.expireTick - w.tick - 1);
  expect(w.alive(u)).toBe(true);
  resume(w, 1);
  expect(w.alive(u)).toBe(false);
  expect(w.pointVisible({ x: 1400, y: 0 }, 'blue')).toBe(false);
  resume(w, P.corpseTicks + 1);
  expect(w.unit(u.id)).toBeUndefined();
});

for (const attackingChampion of ['ashe', 'lux'] as const)
  test(`${attackingChampion} basic hits remove one ward health, extend reveal and give no champion/minion kill credit`, () => {
    const w = setup();
    const enemy = w.spawn('champion', 'red', { x: 500, y: 0 }, attackingChampion);
    enemy.ai = false;
    const u = place(w);
    w.damage(enemy, u, 99999, 'true');
    expect(u.hp).toBe(3);
    enemy.damage = 10000;
    w.enqueue({ type: 'order', unit: enemy.id, order: { type: 'attack', target: u.id } });
    w.step(90);
    expect(u.hp).toBe(2);
    resume(w, 100);
    expect(u.hp).toBe(1);
    resume(w, 100);
    expect(u.hp).toBe(0);
    expect(w.championState(enemy.id)!.kills).toBe(0);
    expect(w.championState(enemy.id)!.cs).toBe(0);
    expect(w.player.deaths).toBe(0);
    expect(w.championState(enemy.id)!.gold).toBe(510);
  });

test('Light Binding crosses a ward without taking a hit slot, root or Illumination mark', () => {
  const w = setup('lux');
  const owner = w.spawn('champion', 'red', { x: 500, y: 0 });
  owner.ai = false;
  const enemy = w.spawn('champion', 'red', { x: 900, y: 0 });
  enemy.ai = false;
  const u = place(w, 300, owner);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: { x: 1200, y: 0 } });
  w.step(100);
  expect(owner.hp).toBeLessThan(owner.maxHp);
  expect(enemy.hp).toBeLessThan(enemy.maxHp);
  expect(u.hp).toBe(3);
  expect(u.rootUntil).toBe(0);
  expect(u.illumination).toEqual([]);
  resume(w, 60);
});

test('a fourth ward replaces only its owners oldest living ward without combat rewards', () => {
  const w = setup();
  const wards: Unit[] = [];
  for (let i = 0; i < 4; i++) {
    w.player.trinket = newTrinket(w.tick); // Diagnostic resource refill, not a natural four-cast route.
    wards.push(place(w, 200 + i * 40));
  }
  expect(wards.map((u) => u.hp)).toEqual([0, 3, 3, 3]);
  expect(w.units.filter((u) => u.kind === 'ward' && w.alive(u))).toHaveLength(3);
  expect([w.player.kills, w.player.cs, w.player.gold]).toEqual([0, 0, 500]);
  resume(w, 60);
});

test('charge clocks continue through death and a committed ward still lands after its owner dies', () => {
  const w = setup();
  const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
  enemy.ai = false;
  w.enqueue({ type: 'ward', unit: w.hero.id, point: { x: 300, y: 0 } });
  w.step();
  w.damage(enemy, w.hero, 99999, 'true');
  resume(w, P.placementTicks);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(1);
  expect(w.hero.hp).toBe(0);
  expect(w.player.trinket.charges).toBe(0);
  w.step(w.player.trinket.rechargeEndTick! - w.tick);
  expect(w.player.trinket.charges).toBe(1);
  resume(w, 1);
});

test('snapshot validation rejects orphaned, crossed, expired, over-health and moving wards and invalid charge records', () => {
  const w = setup();
  place(w);
  const saved = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.units.find((u: any) => u.kind === 'ward').ward.ownerId = 999;
    },
    (s: any) => {
      s.units.find((u: any) => u.kind === 'ward').hp = 4;
    },
    (s: any) => {
      s.units.find((u: any) => u.kind === 'ward').speed = 1;
    },
    (s: any) => {
      s.units.find((u: any) => u.kind === 'ward').ward.expireTick = s.tick;
    },
    (s: any) => {
      s.player.trinket.charges = 2;
    },
    (s: any) => {
      s.player.trinket.rechargeEndTick = s.tick;
    },
    (s: any) => {
      s.pendingWards = [
        {
          ownerId: s.player.id,
          team: 'red',
          point: { x: 0, y: 0 },
          startTick: s.tick,
          readyTick: s.tick + 20,
          lifeTicks: 5400,
        },
      ];
    },
  ]) {
    const invalid = structuredClone(saved);
    mutate(invalid);
    expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  }
});

test('duration reads all champion levels while each recharge span retains its captured length', () => {
  const w = setup();
  const enemy = w.spawn('champion', 'red', { x: 2500, y: 0 });
  enemy.ai = false;
  w.gainExperience(1e6, enemy.id);
  expect(w.player.trinket.rechargeEndTick).toBe(12600);
  const u = place(w);
  expect(u.ward!.expireTick - u.ward!.createdTick).toBe(6300);
  expect(w.player.trinket.rechargeEndTick).toBe(12600);
  w.step(12600 - w.tick);
  expect(w.player.trinket).toMatchObject({
    charges: 1,
    rechargeStartTick: 12600,
    rechargeEndTick: 21600,
  });
  resume(w, 21600 - w.tick);
  expect(w.player.trinket).toMatchObject({
    charges: 2,
    rechargeStartTick: null,
    rechargeEndTick: null,
  });
  place(w);
  expect(w.player.trinket.rechargeEndTick! - w.player.trinket.rechargeStartTick!).toBe(9000);
});

test('in-range ward placement permits root and silence, rejects stun and death, and preserves resources on rejection', () => {
  for (const disabled of ['root', 'silence', 'stun', 'death'] as const) {
    const w = setup();
    if (disabled === 'root') w.hero.rootUntil = 120;
    if (disabled === 'silence') w.hero.silenceUntil = 120;
    if (disabled === 'stun') w.hero.stunUntil = 120;
    if (disabled === 'death') w.damage(w.hero, w.hero, 99999, 'true');
    place(w);
    const allowed = disabled === 'root' || disabled === 'silence';
    expect(w.player.trinket.charges).toBe(allowed ? 0 : 1);
    expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(allowed ? 1 : 0);
    resume(w, 1);
  }
});

test('Garen empowered melee consumes Q against a ward without bonus damage, silence or invalid saved target history', () => {
  const w = setup();
  const garen = w.spawn('champion', 'red', { x: 400, y: 0 }, 'garen');
  garen.ai = false;
  expect(w.learnSpell('q', garen.id)).toBeNull();
  const ward = place(w);
  w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: garen });
  w.enqueue({ type: 'order', unit: garen.id, order: { type: 'attack', target: ward.id } });
  w.step(30);
  expect(ward.hp).toBe(2);
  expect(ward.silenceUntil).toBe(0);
  expect(w.championState(garen.id)!.garenQ?.consumed).toBe(true);
  resume(w, 1);
});

test('practice reset readies the trinket while multiple already committed placements restore independently', () => {
  const w = setup();
  for (let i = 0; i < 3; i++) {
    w.enqueue({ type: 'ward', unit: w.hero.id, point: { x: 200 + i * 40, y: 0 } });
    w.step();
    resetTrinket(w.player.trinket);
  }
  expect(w.pendingWards).toHaveLength(3);
  expect(w.player.trinket).toMatchObject({ charges: 2, rechargeEndTick: null, cooldownTick: 0 });
  resume(w, P.placementTicks);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(3);
  expect(w.player.trinket.charges).toBe(2);
});
