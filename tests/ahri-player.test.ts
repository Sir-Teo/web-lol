import { expect, test, vi } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { selectableChampion } from '../src/content/champion-profiles';
import { instantSpell, minimapSpell, targetedSpell } from '../src/input/spell-controls';
import { ahriAimGeometry } from '../src/render/ahri-aim';
import {
  ahriDescription,
  ahriPreviewResources,
  ahriPassiveDescription,
} from '../src/ui/ahri-spells';
import { prepareMatchImport } from '../src/storage/match-files';

const fixture = {
  ...PRACTICE_FIXTURE,
  developmentAhri: true as const,
  lineOfSight: () => true,
  inBrush: () => false,
  reachable: (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
  findPath: (_a: { x: number; y: number }, b: { x: number; y: number }) => [{ x: b.x, y: b.y }],
};
function setup() {
  const w = new World(false, fixture, 'ahri');
  w.nextWaveTick = Infinity;
  return w;
}

test('Ahri player construction requires the trusted practice context and leaves the public chooser closed', () => {
  expect(() => new World(false, PRACTICE_FIXTURE, 'ahri')).toThrow(/development NPC/);
  expect(() => new World(false, { ...fixture, id: 'rift' }, 'ahri')).toThrow(/development NPC/);
  expect(() => selectableChampion('ahri')).toThrow();
  expect(PRACTICE_FIXTURE.developmentAhri).toBeUndefined();
  const w = setup();
  expect(w.hero.champion).toBe('ahri');
  expect(w.hero.name).toBe('Ahri');
  expect(w.hero.range).toBe(550);
  expect(w.hero.mana).toBe(418);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(w.player.eCharges).toBe(0);
  expect(w.player.qStacks).toBe(0);
  expect(w.ahriCounters).toEqual([{ sourceId: w.hero.id, stacks: 0, lastKillTick: null }]);
});

test('human Ahri saves round-trip in her context and reject ordinary practice or serialized permission injection', () => {
  const w = setup(),
    saved = w.snapshot();
  expect(World.fromSnapshot(saved, fixture).snapshot()).toBe(saved);
  expect(() => World.fromSnapshot(saved, PRACTICE_FIXTURE)).toThrow(/Ahri/);
  const raw = JSON.parse(saved);
  raw.developmentAhri = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), PRACTICE_FIXTURE)).toThrow();
});

test('Ahri W is instant while Q/E/R use local point aiming without inheriting Focus or Hawkshot controls', () => {
  const w = setup();
  expect(instantSpell(w, 'w')).toBe(true);
  for (const a of ['q', 'e', 'r'] as const) {
    expect(instantSpell(w, a)).toBe(false);
    expect(minimapSpell(w, a)).toBe(false);
    expect(targetedSpell(w, a)).toBe(false);
  }
  expect(instantSpell(w, 'd')).toBe(false);
  expect(instantSpell(w, 'f')).toBe(true);
});

test('Q and E guides show simulated range and width, including an independent angled endpoint', () => {
  expect(ahriAimGeometry('e', { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual([
    { x: 0, y: -60 },
    { x: 1000, y: -60 },
    { x: 1000, y: 60 },
    { x: 0, y: 60 },
    { x: 0, y: -60 },
  ]);
  const q = ahriAimGeometry('q', { x: 10, y: 20 }, { x: 13, y: 24 });
  expect(q).toHaveLength(5);
  expect(q[1].x).toBeCloseTo(690, 9);
  expect(q[1].y).toBeCloseTo(760, 9);
  expect(q[2].x).toBeCloseTo(530, 9);
  expect(q[2].y).toBeCloseTo(880, 9);
  const rich = { x: 0, y: 0, id: 123 };
  for (const point of ahriAimGeometry('q', rich, { x: 50, y: 0 }))
    expect(Object.keys(point).sort()).toEqual(['x', 'y']);
});

test('R guide fits the existing vertex budget and shows the corrected landing footprint', () => {
  const points = ahriAimGeometry('r', { x: 0, y: 0 }, { x: 500, y: 500 }, { x: 200, y: 300 }, 65);
  expect(points).toHaveLength(35);
  expect(points[0]).toEqual({ x: 0, y: 0 });
  expect(points.at(-1)).toEqual({ x: 0, y: 0 });
  for (const p of points.slice(1, -1)) expect(Math.hypot(p.x - 200, p.y - 300)).toBeCloseTo(65, 9);
  expect(ahriAimGeometry('r', { x: 0, y: 0 }, { x: 500, y: 0 }, null)).toEqual([]);
  expect(ahriAimGeometry('q', { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
});

test('spell previews and descriptions use Ahri damage, control, healing and cast resources', () => {
  expect(ahriPreviewResources('q')).toEqual({ mana: 55, cooldownSeconds: 7 });
  expect(ahriPreviewResources('w')).toEqual({ mana: 30, cooldownSeconds: 9 });
  expect(ahriPreviewResources('e')).toEqual({ mana: 60, cooldownSeconds: 12 });
  expect(ahriPreviewResources('r')).toEqual({ mana: 100, cooldownSeconds: 140 });
  expect(ahriDescription('q', 1, 20)).toContain('45 true damage');
  expect(ahriDescription('w', 1, 20)).toContain('48 magic damage');
  expect(ahriDescription('e', 1, 20)).toContain('97 magic damage');
  expect(ahriDescription('r', 1, 20)).toContain('82 magic damage');
  expect(ahriPassiveDescription(1, 20)).toContain('39 health');
  for (const a of ['q', 'w', 'e', 'r'] as const)
    expect(ahriDescription(a, 1, 20)).not.toMatch(/Focus|hawk|frost/i);
});

test('private player import checks reject another champion before any write and allow the exact Ahri checkpoint', async () => {
  const w = setup(),
    persist = vi.fn(async () => {}),
    other = new World(false, PRACTICE_FIXTURE);
  await expect(
    prepareMatchImport(new File([other.snapshot()], 'ashe.json'), fixture, persist, 'ahri')
  ).rejects.toThrow(/Ahri match files only/);
  expect(persist).not.toHaveBeenCalled();
  const saved = w.snapshot(),
    prepared = await prepareMatchImport(new File([saved], 'ahri.json'), fixture, persist, 'ahri');
  expect(persist).not.toHaveBeenCalled();
  await prepared.load();
  expect(persist).toHaveBeenCalledExactlyOnceWith(saved);
});

test('player Q windup, R dash and passive consumption preserve exact future simulation', () => {
  for (const phase of ['q', 'r', 'passive'] as const) {
    const w = setup();
    w.gainExperience(1e6);
    w.learnSpell('q');
    w.learnSpell('r');
    if (phase === 'passive') {
      const target = w.spawn('champion', 'red', { x: w.hero.x + 500, y: w.hero.y }, 'lux');
      target.ai = false;
      w.damage(w.hero, target, 1e6, 'true');
    } else
      w.enqueue({
        type: 'cast',
        unit: w.hero.id,
        ability: phase,
        point: { x: w.hero.x + 900, y: w.hero.y },
      });
    w.step(5);
    const copy = World.fromSnapshot(w.snapshot(), fixture);
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('Charm tooltip preserves its two-decimal ranked durations', () => {
  expect(ahriDescription('e', 2, 0)).toContain('1.35 seconds');
  expect(ahriDescription('e', 4, 0)).toContain('1.65 seconds');
});
