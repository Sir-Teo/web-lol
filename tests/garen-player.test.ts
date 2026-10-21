import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { selectableChampion } from '../src/content/champion-profiles';
import {
  garenRTarget,
  instantSpell,
  minimapSpell,
  targetedSpell,
  garenRecastLockTicks,
} from '../src/input/spell-controls';
import { GAREN_SPELLS, garenDescription, garenPreviewResources } from '../src/ui/garen-spells';
import pin from '../docs/reference/garen-player-ui.json';
import manifest from '../public/assets/reference-manifest.json';

function setup() {
  const w = new World(false, { ...PRACTICE_FIXTURE, lineOfSight: () => true }, 'garen');
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = 0;
  return w;
}

test('Garen player practice owns a resource-free unlearned kit and never enters the production roster', () => {
  const w = setup();
  expect(w.hero.champion).toBe('garen');
  expect(w.hero.maxMana).toBe(0);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(() => selectableChampion('garen')).toThrow();
  expect(() => new World(false, { ...PRACTICE_FIXTURE, id: 'rift' }, 'garen')).toThrow(
    /development practice fixture/
  );
  const saved = JSON.parse(w.snapshot());
  saved.battlefield = 'rift';
  expect(() =>
    World.fromSnapshot(JSON.stringify(saved), { ...PRACTICE_FIXTURE, id: 'rift' })
  ).toThrow(/development practice fixture/);
  expect(() => World.fromSnapshot(w.snapshot(), { ...PRACTICE_FIXTURE, id: 'rift' })).toThrow(
    /different battlefield/
  );
});

test('human Garen spell controls are instant/self or explicit champion-target and reject minimap targeting', () => {
  const w = setup();
  expect((['q', 'w', 'e', 'r', 'd', 'f'] as const).map((a) => instantSpell(w, a))).toEqual([
    true,
    true,
    true,
    false,
    false,
    true,
  ]);
  expect(targetedSpell(w, 'r')).toBe(true);
  expect(targetedSpell(w, 'q')).toBe(false);
  expect(minimapSpell(w, 'r')).toBe(false);
  expect(minimapSpell(w, 'e')).toBe(false);
  const ashe = new World(false, PRACTICE_FIXTURE);
  expect(minimapSpell(ashe, 'e')).toBe(true);
  expect(minimapSpell(ashe, 'r')).toBe(true);
});

test('R target preview checks actual enemy champion identity, sight, liveness and center range', () => {
  const w = setup();
  const target = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  expect(garenRTarget(w, target)).toBe(target);
  target.x = 400.01;
  expect(garenRTarget(w, target)).toBeUndefined();
  target.x = 200;
  w.battlefield.lineOfSight = () => false;
  expect(garenRTarget(w, target)).toBeUndefined();
  w.battlefield.lineOfSight = () => true;
  expect(garenRTarget(w, w.spawn('dummy', 'red', { x: 100, y: 0 }))).toBeUndefined();
  expect(garenRTarget(w, w.spawn('champion', 'blue', { x: 100, y: 0 }))).toBeUndefined();
  w.damage(w.hero, target, 1e6, 'true');
  expect(garenRTarget(w, target)).toBeUndefined();
});

test('player Q/W/E and captured R preserve owned state and deterministic continuation across snapshots', () => {
  const w = setup();
  w.gainExperience(1e6);
  for (const a of ['q', 'w', 'e', 'r'] as const) w.learnSpell(a);
  const target = w.spawn('champion', 'red', { x: 300, y: 0 });
  target.hp = target.maxHp = 10000;
  for (const ability of ['q', 'w', 'e'] as const)
    w.enqueue({ type: 'cast', unit: w.hero.id, ability, point: w.hero });
  w.step(20);
  expect(w.player.garenQ).not.toBeNull();
  expect(w.player.garenW).not.toBeNull();
  expect(w.player.garenE).not.toBeNull();
  const spinning = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, spinning]) {
    world.enqueue({
      type: 'cast',
      unit: world.hero.id,
      ability: 'r',
      point: target,
      targetId: target.id,
    });
    world.step(10);
  }
  expect(spinning.snapshot()).toBe(w.snapshot());
  expect(w.player.pendingCast?.targetId).toBe(target.id);
  const committed = World.fromSnapshot(w.snapshot(), w.battlefield);
  for (const world of [w, spinning, committed]) world.step(35);
  expect(spinning.snapshot()).toBe(w.snapshot());
  expect(committed.snapshot()).toBe(w.snapshot());
});

test('Judgment recast lock matches its actual early-cancel boundary and post-spin cooldown', () => {
  const w = setup();
  w.learnSpell('e');
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step();
  expect(garenRecastLockTicks(w)).toBe(60);
  w.step(59);
  expect(garenRecastLockTicks(w)).toBe(1);
  w.step();
  expect(garenRecastLockTicks(w)).toBe(0);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
  w.step();
  expect(w.player.garenE).toBeNull();
  expect(w.abilityCooldownTicks('e')).toBe(540);
});

test('Garen tooltip values reflect current ranks, AD, bonus health and strikes without Ashe fallback', () => {
  expect(garenDescription('q', 1, 100, 0, 7)).toContain('80 bonus physical damage');
  expect(garenDescription('w', 1, 100, 200, 7)).toContain('Shield yourself for 101 damage');
  expect(garenDescription('e', 5, 100, 0, 9)).toContain('Spin 9 times');
  expect(garenDescription('e', 5, 100, 0, 9)).toContain('68 physical damage per strike');
  expect(garenDescription('r', 3, 100, 0, 9)).toContain('275 plus 35%');
  expect(garenPreviewResources('w')).toEqual({ mana: 0, cooldownSeconds: 22 });
  expect(garenPreviewResources('e')).toEqual({ mana: 0, cooldownSeconds: 9 });
});

test('spell labels and locally served icons match the pinned client metadata and hashes', () => {
  expect(pin.version).toBe('16.18.1');
  for (const [key, spec] of Object.entries(GAREN_SPELLS)) {
    const entry = pin.spells.find((s) => s.id === `Garen${key.toUpperCase()}`)!;
    expect(spec.name).toBe(entry.name);
    expect(`${spec.icon}.png`).toBe(entry.icon);
    const asset = manifest.assets.find((a) => a.path === `/assets/icons/${entry.icon}`)!;
    const bytes = readFileSync(`public${asset.path}`);
    expect(bytes.length).toBe(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  }
});
