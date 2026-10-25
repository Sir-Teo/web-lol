import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { selectableChampion } from '../src/content/champion-profiles';
import { createGrompEncounter } from '../src/simulation/gromp-encounter';
import { instantSpell, minimapSpell, targetedSpell } from '../src/input/spell-controls';
import { LEONA_HUD_SPELLS, leonaDescription, leonaPreviewResources } from '../src/ui/leona-spells';
import { leonaAimGeometry } from '../src/render/leona-aim';

function setup() {
  const w = new World(
    false,
    {
      ...PRACTICE_FIXTURE,
      initialUnits: [],
      inBrush: () => false,
      lineOfSight: () => true,
      lineWalkable: () => true,
      findPath: (_a, b) => [{ ...b }],
      reachable: (p) => ({ ...p }),
    },
    'leona'
  );
  w.nextWaveTick = Infinity;
  return w;
}

test('the human fixture starts unlearned and does not spend skill points through bot allocation', () => {
  const w = setup();
  expect(w.hero).toMatchObject({ champion: 'leona', ai: false, maxHp: 646, maxMana: 302 });
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.eCharges).toBe(0);
  w.step(120);
  expect(w.player.skillPoints).toBe(1);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Leona remains outside ordinary Rift construction, spawning and roster selection', () => {
  const battlefield = { ...PRACTICE_FIXTURE, id: 'rift' as const, initialUnits: [] };
  expect(() => new World(false, battlefield, 'leona')).toThrow(/development/);
  const w = new World(false, battlefield);
  expect(() => w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona')).toThrow(/development/);
  expect(() => selectableChampion('leona')).toThrow(/development/);
  const raw = JSON.parse(w.snapshot());
  raw.units.find((u: { id: number }) => u.id === raw.player.id).champion = 'leona';
  expect(() => World.fromSnapshot(JSON.stringify(raw), battlefield)).toThrow(/Leona/);
});

test('human W/R overlap restores the player identity and exact delayed combat future', () => {
  const w = setup();
  w.hero.x = w.hero.y = 0;
  w.gainExperience(2400);
  for (const key of ['q', 'e', 'w', 'w', 'w', 'r'] as const) expect(w.learnSpell(key)).toBeNull();
  const enemy = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
  enemy.ai = false;
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: enemy });
  w.step(8);
  expect(w.player.leonaW).not.toBeNull();
  expect(w.player.leonaR?.released).toBe(false);
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  expect(copy.hero.champion).toBe('leona');
  for (const world of [w, copy]) world.step(210);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(enemy.hp).toBeLessThan(enemy.maxHp - 150);
});

test('the controlled Gromp encounter supports the same development player and saved future', () => {
  const w = createGrompEncounter(PRACTICE_FIXTURE, 'leona');
  const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.hero.champion).toBe('leona');
  expect(w.units.some((u) => u.kind === 'monster')).toBe(true);
});

test('Q/W are instant and E/R are point aims without Hawkshot minimap or targeted-R behavior', () => {
  const w = setup();
  for (const key of ['q', 'w', 'e', 'r'] as const) {
    expect(instantSpell(w, key)).toBe(key === 'q' || key === 'w');
    expect(minimapSpell(w, key)).toBe(false);
    expect(targetedSpell(w, key)).toBe(false);
  }
  expect(instantSpell(w, 'd')).toBe(false);
  expect(instantSpell(w, 'f')).toBe(true);
});

test('unlearned previews and spell descriptions use Leona rank/AP/level values', () => {
  expect(
    ['q', 'w', 'e', 'r'].map((key) => leonaPreviewResources(key as keyof typeof LEONA_HUD_SPELLS))
  ).toEqual([
    { mana: 30, cooldownSeconds: 5 },
    { mana: 60, cooldownSeconds: 14 },
    { mana: 40, cooldownSeconds: 12 },
    { mana: 100, cooldownSeconds: 90 },
  ]);
  expect(leonaDescription('q', 1, 100, 6)).toMatch(/40 bonus magic damage/);
  expect(leonaDescription('q', 1, 100, 6)).toMatch(/67 magic damage/);
  expect(leonaDescription('w', 3, 100, 6)).toMatch(/Gain 35 armor plus 20%/);
  expect(leonaDescription('w', 3, 100, 6)).toMatch(/by 16 per hit, up to 50%/);
  expect(leonaDescription('w', 3, 100, 6)).toMatch(/deal 155 magic damage/);
  expect(leonaDescription('e', 2, 100, 6)).toMatch(/130 magic damage/);
  expect(leonaDescription('r', 1, 100, 6)).toMatch(/deal 230 magic damage/);
  expect(leonaDescription('r', 1, 100, 6)).toMatch(/Stun enemies in the center for 1.75 seconds/);
});

test('Leona HUD icons retain the pinned Data Dragon identities and manifest bytes', () => {
  const reference = JSON.parse(readFileSync('docs/reference/leona/ddragon-16.18.1.json', 'utf8'))
    .data.Leona;
  const manifest = JSON.parse(readFileSync('public/assets/reference-manifest.json', 'utf8'));
  for (const [i, spec] of Object.values(LEONA_HUD_SPELLS).entries()) {
    expect(spec.name).toBe(reference.spells[i].name);
    expect(spec.icon + '.png').toBe(reference.spells[i].image.full);
  }
  for (const name of ['leona', ...Object.values(LEONA_HUD_SPELLS).map((s) => s.icon)]) {
    const path = `/assets/icons/${name}.png`,
      record = manifest.assets.find((r: { path: string }) => r.path === path),
      bytes = readFileSync('public' + path);
    expect(record.source).toMatch(
      /^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/16\.18\.1\/img\//
    );
    expect(bytes.length).toBe(record.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.sha256);
  }
});

test('E guide follows the full 900-unit sweep with a 70-unit half width at a translated origin', () => {
  const shape = leonaAimGeometry('e', { x: 100, y: -50 }, { x: 100, y: 0 });
  expect(shape.outline).toHaveLength(5);
  expect(shape.center).toEqual([]);
  expect(shape.outline[0].x).toBeCloseTo(170);
  expect(shape.outline[0].y).toBeCloseTo(-50);
  expect(shape.outline[1].x).toBeCloseTo(170);
  expect(shape.outline[1].y).toBeCloseTo(850);
  expect(shape.outline[2].x).toBeCloseTo(30);
  expect(shape.outline[4]).toEqual(shape.outline[0]);
});

test('R guides share the clamped cast center and retain distinct 300/120 radii', () => {
  for (const point of [
    { x: 3000, y: 4000 },
    { x: 300, y: 400 },
    { x: 0, y: 0 },
  ]) {
    const shape = leonaAimGeometry('r', { x: 0, y: 0 }, point),
      center = point.x === 3000 ? { x: 720, y: 960 } : point;
    for (const [points, radius] of [
      [shape.outline, 300],
      [shape.center, 120],
    ] as const) {
      expect(points).toHaveLength(33);
      for (const p of points)
        expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(radius, 6);
    }
  }
});
