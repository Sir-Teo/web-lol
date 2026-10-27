import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { selectableChampion } from '../src/content/champion-profiles';
import {
  instantSpell,
  minimapSpell,
  targetedSpell,
  spellTarget,
  targetInstruction,
} from '../src/input/spell-controls';
import {
  masterYiPreviewResources,
  masterYiDescription,
  masterYiPassiveDescription,
} from '../src/ui/masteryi-spells';
import { prepareMatchImport } from '../src/storage/match-files';
const fixture = {
  ...PRACTICE_FIXTURE,
  developmentMasterYi: true as const,
  lineOfSight: () => true,
  inBrush: () => false,
  reachable: (p: { x: number; y: number }) => ({ ...p }),
  findPath: (_a: { x: number; y: number }, b: { x: number; y: number }) => [{ ...b }],
};
function setup() {
  const w = new World(false, fixture, 'masteryi');
  w.nextWaveTick = Infinity;
  return w;
}

test('human Master Yi requires a trusted practice context and keeps ordinary/Rift selection closed', () => {
  expect(() => new World(false, PRACTICE_FIXTURE, 'masteryi')).toThrow(/development NPC/);
  expect(() => new World(false, { ...fixture, id: 'rift' }, 'masteryi')).toThrow(/development NPC/);
  expect(() => selectableChampion('masteryi')).toThrow();
  expect(PRACTICE_FIXTURE.developmentMasterYi).toBeUndefined();
  const w = setup();
  expect(w.hero.champion).toBe('masteryi');
  expect(w.hero.name).toBe('Master Yi');
  expect(w.hero.range).toBe(175);
  expect(w.hero.speed).toBe(355);
  expect(w.hero.mana).toBe(251);
  expect(w.player.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(w.player.skillPoints).toBe(1);
  expect(w.player.qStacks).toBe(0);
  expect(w.player.eCharges).toBe(0);
  expect(w.player.doubleStrike).toEqual({ stacks: 0, expiresTick: 0, strike: null });
});

test('own player saves round-trip only in the trusted scene; serialized permission cannot authorize loading', () => {
  const w = setup(),
    saved = w.snapshot();
  expect(World.fromSnapshot(saved, fixture).snapshot()).toBe(saved);
  expect(() => World.fromSnapshot(saved, PRACTICE_FIXTURE)).toThrow(/Master Yi/);
  const raw = JSON.parse(saved);
  raw.developmentMasterYi = true;
  expect(() => World.fromSnapshot(JSON.stringify(raw), PRACTICE_FIXTURE)).toThrow();
  const lanes = JSON.parse(saved);
  lanes.matchMode = 'lanes';
  expect(() => World.fromSnapshot(JSON.stringify(lanes), fixture)).toThrow();
});

test('human Q is targeted; W/E/R are instant without borrowing Focus or minimap controls', () => {
  const w = setup();
  expect(instantSpell(w, 'q')).toBe(false);
  expect(targetedSpell(w, 'q')).toBe(true);
  for (const a of ['w', 'e', 'r'] as const) {
    expect(instantSpell(w, a)).toBe(true);
    expect(targetedSpell(w, a)).toBe(false);
  }
  for (const a of ['q', 'w', 'e', 'r'] as const) expect(minimapSpell(w, a)).toBe(false);
  expect(instantSpell(w, 'd')).toBe(false);
  expect(instantSpell(w, 'f')).toBe(true);
  expect(targetInstruction(w, 'q')).toMatch(/Hold Q.*600/);
});

test('Q cursor selection shares enemy/range/protection rules with the actual cast', () => {
  const w = setup();
  w.hero.x = w.hero.y = 0;
  const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
  expect(spellTarget(w, 'q', target)).toBe(target);
  target.x = 600.01;
  expect(spellTarget(w, 'q', target)).toBeUndefined();
  target.x = 300;
  expect(spellTarget(w, 'q', w.hero)).toBeUndefined();
  const structure = w.spawn('turret', 'red', { x: 100, y: 0 });
  expect(spellTarget(w, 'q', structure)).toBeUndefined();
  w.damage(w.hero, target, 1e9, 'true');
  expect(spellTarget(w, 'q', target)).toBeUndefined();
});

test('Q cursor cannot acquire another vanished Yi even while his position is known', () => {
  const w = setup();
  w.hero.x = w.hero.y = 0;
  const enemy = w.spawn('champion', 'red', { x: 300, y: 0 }, 'masteryi');
  enemy.ai = false;
  expect(w.learnSpell('q', enemy.id)).toBeNull();
  w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', targetId: w.hero.id, point: w.hero });
  w.step();
  expect(w.visible(enemy, 'blue')).toBe(true);
  expect(w.targetable(enemy)).toBe(false);
  expect(spellTarget(w, 'q', enemy)).toBeUndefined();
  expect(World.fromSnapshot(w.snapshot(), fixture).snapshot()).toBe(w.snapshot());
});

test('unlearned resource previews and descriptions use own ranks, AD/AP and true-damage values', () => {
  expect(masterYiPreviewResources('q')).toEqual({ mana: 50, cooldownSeconds: 20 });
  expect(masterYiPreviewResources('w')).toEqual({ mana: 40, cooldownSeconds: 10 });
  expect(masterYiPreviewResources('e')).toEqual({ mana: 0, cooldownSeconds: 14 });
  expect(masterYiPreviewResources('r')).toEqual({ mana: 100, cooldownSeconds: 85 });
  expect(masterYiDescription('q', 1, 65, 0, 0)).toContain('65.5 physical damage');
  expect(masterYiDescription('q', 1, 65, 0, 0)).toContain('60 bonus physical damage to monsters');
  expect(masterYiDescription('q', 5, 65, 0, 0)).toContain('160 bonus physical damage to monsters');
  expect(masterYiDescription('e', 1, 165, 100, 0)).toContain('55 additional true damage');
  expect(masterYiDescription('w', 1, 65, 0, 100)).toContain('220 base health');
  expect(masterYiDescription('r', 3, 65, 0, 0)).toContain(
    '65% bonus attack speed, 60% movement speed'
  );
  expect(masterYiPassiveDescription(3)).toContain('Double Strike is ready');
  for (const a of ['q', 'w', 'e', 'r'] as const)
    expect(masterYiDescription(a, 1, 65, 0, 0)).not.toMatch(/Focus|Hawkshot|frost/i);
});

test('all five own ability/passive icons are exact pinned versioned PNGs in the manifest', () => {
  const m = JSON.parse(readFileSync('public/assets/reference-manifest.json', 'utf8'));
  const reference = JSON.parse(readFileSync('docs/reference/masteryi/ddragon-16.18.1.json', 'utf8'))
    .data.MasterYi;
  const icons = [reference.passive.image.full, ...reference.spells.map((s: any) => s.image.full)];
  expect(icons).toHaveLength(5);
  for (const name of icons) {
    const path = `/assets/icons/${name}`,
      row = m.assets.find((r: any) => r.path === path),
      raw = readFileSync('public' + path);
    expect(row.source).toContain('/cdn/16.18.1/img/');
    expect(raw.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(createHash('sha256').update(raw).digest('hex')).toBe(row.sha256);
    expect(raw.length).toBe(row.bytes);
  }
});

test('file imports preserve human Yi identity and reject an ordinary NPC checkpoint before persistence', async () => {
  const w = setup(),
    persist = vi.fn(async () => {}),
    file = new File([w.snapshot()], 'yi.json', { type: 'application/json' });
  const prepared = await prepareMatchImport(file, fixture, persist, 'masteryi');
  expect(persist).not.toHaveBeenCalled();
  await prepared.load();
  expect(persist).toHaveBeenCalledWith(w.snapshot());
  const npc = new World(false, PRACTICE_FIXTURE);
  npc.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  const denied = vi.fn(async () => {});
  await expect(
    prepareMatchImport(new File([npc.snapshot()], 'npc.json'), fixture, denied, 'masteryi')
  ).rejects.toThrow(/Master Yi match files only/);
  expect(denied).not.toHaveBeenCalled();
});
