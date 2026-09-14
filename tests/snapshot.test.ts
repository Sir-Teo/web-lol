import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);

function continueIdentically(world: World, ticks = 600) {
  const saved = world.snapshot();
  const restored = World.fromSnapshot(saved, world.battlefield);
  expect(restored.snapshot()).toBe(saved);
  expect(restored.hero).not.toBe(world.hero);
  for (let i = 0; i < ticks; i++) {
    world.step();
    restored.step();
    if (i % 30 === 0) expect(restored.snapshot()).toBe(world.snapshot());
  }
  expect(restored.snapshot()).toBe(world.snapshot());
  return restored;
}

for (const mode of ['cast', 'move', 'attackMove'] as const)
  test(`queued ${mode} copies only coordinates from a unit and restores before execution`, () => {
    const w = new World(false);
    w.nextWaveTick = Infinity;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 300, y: w.hero.y });
    const point = { x: target.x, y: target.y };
    if (mode === 'cast') w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
    else w.enqueue({ type: 'order', unit: w.hero.id, order: { type: mode, point: target } });
    target.x += 100;
    const command = w.commands[0];
    const queuedPoint =
      command.type === 'cast'
        ? command.point
        : command.type === 'order' && 'point' in command.order
          ? command.order.point
          : undefined;
    expect(queuedPoint).toEqual(point);
    continueIdentically(w, 120);
  });

test('restores active combat, missiles, queued commands, random state and disabled deadlines exactly', () => {
  const w = new World(false);
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
  const enemy = w.spawn('dummy', 'red', { x: 400, y: 0 });
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: enemy });
  w.step(16);
  expect(w.projectiles.length).toBeGreaterThan(0);
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: enemy.id } });
  w.hero.nextThink = Infinity;
  w.random.next();
  const restored = continueIdentically(w);
  expect(restored.nextWaveTick).toBe(Infinity);
  expect(restored.hero.nextThink).toBe(Infinity);
});

test('restores full-Rift queued waves and terrain navigation without changing the future', () => {
  const w = new World(true, rift);
  w.step(30 * 60 + 1);
  expect(w.pendingSpawns.length).toBeGreaterThan(0);
  continueIdentically(w);
});

test('preserves hidden structure knowledge and regrowth deadlines', () => {
  const w = new World(true, rift);
  w.nextWaveTick = Infinity;
  const inhibitor = w.units.find((u) => u.kind === 'inhibitor' && u.team === 'red')!;
  inhibitor.hp = 0;
  inhibitor.deadAt = 0;
  inhibitor.respawnTick = 4;
  inhibitor.structureKnowledge = { blue: 0, red: 0 };
  const restored = continueIdentically(w, 60);
  const revived = restored.unit(inhibitor.id)!;
  expect(revived.hp).toBeGreaterThan(0);
  expect(revived.structureKnowledge).toEqual({ blue: 0, red: null });
});

test('restores recall and terminal match state without accidental advancement', () => {
  const w = new World(false);
  w.enqueue({ type: 'recall', unit: w.hero.id });
  w.step();
  expect(w.player.recallEnd).not.toBeNull();
  continueIdentically(w);
  w.winner = 'blue';
  const saved = w.snapshot();
  const restored = World.fromSnapshot(saved, PRACTICE_FIXTURE);
  restored.step(100);
  expect(restored.snapshot()).toBe(saved);
});

for (const field of [
  'version',
  'ruleset',
  'identities',
  'player',
  'health',
  'lane',
  'timer',
  'unknown',
] as const)
  test(`rejects invalid ${field} without mutating the running match`, () => {
    const w = new World(false),
      saved = w.snapshot(),
      bad = JSON.parse(saved);
    if (field === 'version') bad.version = 4;
    if (field === 'ruleset') bad.ruleset = 'old-build';
    if (field === 'identities') bad.units.push(bad.units[0]);
    if (field === 'player') bad.player.id = 999;
    if (field === 'health') bad.units[0].hp = -1;
    if (field === 'lane') bad.units[0].lane = 90;
    if (field === 'timer') bad.nextWaveTick = null;
    if (field === 'unknown') bad.injected = true;
    expect(() => World.fromSnapshot(JSON.stringify(bad), PRACTICE_FIXTURE)).toThrow();
    expect(w.snapshot()).toBe(saved);
  });

test('rejects wrong battlefields, malformed JSON and invalid numeric simulation state', () => {
  const w = new World(false);
  expect(() => World.fromSnapshot(w.snapshot(), rift)).toThrow(/battlefield/);
  expect(() => World.fromSnapshot('{', PRACTICE_FIXTURE)).toThrow('Saved match could not be read.');
  w.hero.x = NaN;
  expect(() => w.snapshot()).toThrow(/numeric/);
});
