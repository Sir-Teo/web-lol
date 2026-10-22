import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { equipSummoners } from '../src/simulation/smite';
import { COMPANION_ITEMS } from '../src/content/companion-items';
import { grantCompanion } from '../src/simulation/owned-companions';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';

function setup(smite = true) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [] }, 'lux');
  w.nextWaveTick = 1_000_000_000;
  if (smite) equipSummoners(w.player, { d: 'flash', f: 'smite' });
  return w;
}
function kill(w: World, ownerId = w.player.id) {
  const u = w.spawnMonster({ x: 1000, y: 1000 });
  w.damage(w.unit(ownerId)!, u, 999999, 'true');
}
function feed(w: World, n: number) {
  for (let i = 0; i < n; i++) kill(w);
}
function resume(w: World) {
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(60);
  copy.step(60);
  expect(copy.snapshot()).toBe(w.snapshot());
}

test('starter catalog preserves original price, Smite requirement, groups, zero-sale metadata and PNGs', () => {
  const pin = JSON.parse(readFileSync('docs/reference/companion-items-source.json', 'utf8')),
    parent = JSON.parse(readFileSync(pin.parent.path, 'utf8')),
    sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(sha(pin.parent.path)).toBe(pin.parent.sha256);
  expect(pin.blade.record.mItemGroups).toContain('Items/ItemGroups/DoransItems');
  expect(pin.groups['Items/ItemGroups/DoransItems'].mMaxGroupOwnable).toBe(1);
  expect(pin.groups['Items/ItemGroups/GoldItems'].mMaxGroupOwnable).toBe(1);
  for (const item of COMPANION_ITEMS) {
    const raw = parent.itemSource.records[`Items/${item.icon}`];
    expect([item.price, item.sell, raw.price, raw.sellBackModifier]).toEqual([450, 0, 450, 0]);
    expect(raw.mRequiredSpellName).toBe('SummonerSmite');
    expect([
      item.damage,
      item.hp,
      item.speed,
      item.armor,
      item.magicResist,
      item.abilityPower,
    ]).toEqual([0, 0, 0, 0, 0, 0]);
    const icon = pin.icons.find((i: any) => i.path.endsWith(`/${item.icon}.png`));
    expect(sha(icon.path)).toBe(icon.sha256);
    expect(readFileSync(icon.path).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});
test('Smite is required in either slot and ordinary items wait until a companion is owned', () => {
  const w = setup(false),
    before = w.snapshot();
  expect(w.buy('gustwalker')).toBe('Requires Smite');
  expect(w.snapshot()).toBe(before);
  equipSummoners(w.player, { d: 'smite', f: 'heal' });
  expect(w.buy('boots')).toBe('Buy a jungle companion first');
  expect(w.buy('gustwalker')).toBeNull();
  expect(w.player.gold).toBe(50);
  w.player.gold = 300;
  expect(w.buy('boots')).toBeNull();
  expect(w.hero.speed).toBe(355);
});
test('each variant buys one separate owned actor without changing combat stats or giving free upgrades', () => {
  for (const kind of ['gustwalker', 'scorchclaw', 'mosstomper'] as const) {
    const w = setup(),
      stats = { hp: w.hero.maxHp, damage: w.hero.damage, speed: w.hero.speed },
      units = w.units.length;
    expect(w.buy(kind)).toBeNull();
    expect(w.player.inventory).toEqual([kind]);
    expect(w.units).toHaveLength(units);
    expect(w.companions[0]).toMatchObject({
      kind,
      fed: 0,
      passive: null,
      acquisition: { kind: 'purchase', consumedTick: null },
    });
    expect({ hp: w.hero.maxHp, damage: w.hero.damage, speed: w.hero.speed }).toEqual(stats);
    expect(w.abilitySpec('f').name).toBe('Smite');
    resume(w);
  }
});
test('starter conflicts block both directions and selling the prior Doran item permits a companion', () => {
  const w = setup(false);
  w.buy('blade');
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  w.player.gold = 500;
  const before = w.snapshot();
  expect(w.buy('mosstomper')).toBe('You already own a Doran item');
  expect(w.snapshot()).toBe(before);
  expect(w.sell(0)).toBeNull();
  expect(w.buy('mosstomper')).toBeNull();
  w.player.gold = 1000;
  expect(w.buy('blade')).toContain('starter item group');
  for (const item of COMPANION_ITEMS)
    expect(w.buy(item.id)).toBe('You already own a jungle companion');
});
test('invalid gold, capacity, access and winner purchases preserve the entire checkpoint', () => {
  for (const reason of ['gold', 'capacity', 'fountain', 'winner'] as const) {
    const w = setup(false);
    w.player.gold = 10000;
    if (reason === 'capacity') for (let i = 0; i < 6; i++) w.buy('sword');
    equipSummoners(w.player, { d: 'flash', f: 'smite' });
    if (reason === 'gold') w.player.gold = 449;
    if (reason === 'fountain') w.hero.x += 1000;
    if (reason === 'winner') w.winner = 'blue';
    const before = w.snapshot();
    expect(w.buy('scorchclaw')).not.toBeNull();
    expect(w.snapshot()).toBe(before);
  }
});
test('companions cannot be sold or replaced, including while dead', () => {
  const w = setup();
  w.buy('scorchclaw');
  const before = w.snapshot();
  expect(w.sell(0)).toBe('Jungle companions cannot be sold');
  expect(w.snapshot()).toBe(before);
  const e = w.spawn('champion', 'red', { x: w.hero.x + 200, y: w.hero.y });
  w.damage(e, w.hero, 999999, 'true');
  expect(w.sell(0)).toBe('Jungle companions cannot be sold');
  expect(w.hero.hp).toBe(0);
  resume(w);
});
test('purchase while dead preserves death and creates an owned actor that survives the respawn save', () => {
  const w = setup(),
    e = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(e, w.hero, 999999, 'true');
  const respawn = w.hero.respawnTick;
  expect(w.buy('gustwalker')).toBeNull();
  expect(w.hero.hp).toBe(0);
  expect(w.hero.respawnTick).toBe(respawn);
  resume(w);
});
test('first evolution keeps the item; full growth consumes its actual moved slot and preserves persistent ownership', () => {
  for (const [kind, slot, expected] of [
    ['gustwalker', 5, ['sword', 'sword', 'sword', 'sword', 'sword']],
    ['scorchclaw', 3, ['sword', 'sword', 'sword', null, 'sword', 'sword']],
    ['mosstomper', 0, [null, 'sword', 'sword', 'sword', 'sword', 'sword']],
  ] as const) {
    const w = setup();
    w.buy(kind);
    w.player.gold = 10000;
    for (let i = 0; i < 5; i++) expect(w.buy('sword')).toBeNull();
    w.moveItem(0, slot);
    feed(w, 15);
    expect(w.abilitySpec('f').name).toBe('Unleashed Smite');
    expect(w.player.inventory[slot]).toBe(kind);
    resume(w);
    feed(w, 20);
    expect(w.player.inventory).toEqual(expected);
    expect(w.companions[0].acquisition).toEqual({ kind: 'purchase', consumedTick: w.tick });
    expect(w.companions[0].passive?.kind).toBe(kind);
    expect(w.abilitySpec('f').name).toBe('Primal Smite');
    const before = w.snapshot();
    expect(w.buy(kind)).toContain('already own');
    expect(w.buy('blade')).toContain('starter item group');
    expect(w.snapshot()).toBe(before);
    expect(w.buy('boots')).toBeNull();
    expect(w.player.inventory).toHaveLength(6);
    resume(w);
  }
});
test('bonus feeding can cross full growth once without consuming another item or repeating its removal', () => {
  const w = setup();
  w.buy('gustwalker');
  feed(w, 33);
  const p = w.companions[0];
  w.tick = p.nextTreatTick! - 1;
  w.step();
  expect(p.bonusTreats).toBe(1);
  kill(w);
  expect(p.fed).toBe(35);
  expect(w.player.inventory).toEqual([]);
  const consumed = (p.acquisition as any).consumedTick;
  w.step();
  kill(w);
  expect((p.acquisition as any).consumedTick).toBe(consumed);
  resume(w);
});
test('posthumous full growth consumes the starter without restoring health or shielding a dead owner', () => {
  const w = setup();
  w.buy('mosstomper');
  feed(w, 34);
  const e = w.spawn('champion', 'red', { x: 0, y: 0 });
  w.damage(e, w.hero, 999999, 'true');
  kill(w);
  expect(w.player.inventory).toEqual([]);
  expect(w.hero.hp).toBe(0);
  expect(w.hero.shields).toEqual([]);
  expect(w.companions[0].fed).toBe(35);
  resume(w);
});
test('other champion purchase and progression use only that owner gold, item and companion', () => {
  const w = setup(false),
    u = w.spawn('champion', 'red', w.battlefield.spawns.red);
  u.ai = false;
  equipSummoners(w.championState(u.id)!, { d: 'smite', f: 'flash' });
  const before = { gold: w.player.gold, items: [...w.player.inventory] };
  expect(w.buy('scorchclaw', u.id)).toBeNull();
  for (let i = 0; i < 35; i++) kill(w, u.id);
  expect({ gold: w.player.gold, items: w.player.inventory }).toEqual(before);
  expect(w.championState(u.id)!.inventory).toEqual([]);
  expect(w.companions[0].ownerId).toBe(u.id);
  resume(w);
});
test('saved purchase states reject missing/mismatched items, duplicate starters and invented consumption', () => {
  const w = setup();
  w.buy('gustwalker');
  const original = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => (s.player.inventory = []),
    (s: any) => (s.player.inventory = ['scorchclaw']),
    (s: any) => s.player.inventory.push('scorchclaw'),
    (s: any) => s.player.inventory.push('blade'),
    (s: any) => (s.companions = []),
    (s: any) => (s.companions[0].acquisition.consumedTick = s.tick),
  ]) {
    const saved = structuredClone(original);
    mutate(saved);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  feed(w, 35);
  const complete = JSON.parse(w.snapshot());
  complete.player.inventory.push('gustwalker');
  expect(() => World.fromSnapshot(JSON.stringify(complete), w.battlefield)).toThrow();
});
test('purchases work on the imported Rift and real camp last hits feed through saved camp calendars', () => {
  const bytes = readFileSync('public/assets/maps/rift-nav.bin'),
    rift = createRift(
      new NavGrid(
        JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      ),
      JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
    ),
    w = createLaneMatch(rift, 'lux', { d: 'flash', f: 'smite' });
  w.nextWaveTick = 1_000_000_000;
  for (const u of w.units) u.ai = false;
  expect(w.buy('mosstomper')).toBeNull();
  w.tick = 5399;
  w.step(12);
  const camp = w.jungleCamps.find((c) => c.id === 'order-gromp')!,
    u = w.unit(camp.unitIds[0]!)!;
  w.damage(w.hero, u, 999999, 'true');
  expect(w.companions.find((p) => p.ownerId === w.hero.id)!.fed).toBe(2);
  expect(camp.unitIds[0]).toBeNull();
  expect(camp.nextSpawnTick).toBeGreaterThan(w.tick);
  resume(w);
});
test('free fixture grants cannot masquerade as purchases or bypass the starter group', () => {
  const w = setup(false);
  w.encounter = 'gromp';
  w.buy('blade');
  equipSummoners(w.player, { d: 'flash', f: 'smite' });
  expect(() => grantCompanion(w, 'gustwalker')).toThrow();
  expect(() =>
    grantCompanion(w, 'gustwalker', w.player.id, { kind: 'purchase', consumedTick: null })
  ).toThrow();
});
