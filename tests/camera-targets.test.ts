import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { cameraKeyTarget } from '../src/input/camera-targets';
import { createLaneMatch } from '../src/simulation/lane-match';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';

const raw = readFileSync('public/assets/maps/rift-nav.bin');
const battlefield = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
test('F1 selects the human and camera lookup leaves a saved match unchanged', () => {
  const world = createLaneMatch(battlefield);
  const saved = world.snapshot();
  expect(cameraKeyTarget(world, 'f1')).toBe(world.hero);
  for (const key of ['f0', 'f6', 'f12', 'q', 'f', ''])
    expect(cameraKeyTarget(world, key)).toBeNull();
  expect(world.snapshot()).toBe(saved);
});
test('teammate keys follow scoreboard order without reordering or selecting opponents', () => {
  const world = createLaneMatch(battlefield, 'lux');
  const expected = world.units
    .filter((u) => u.kind === 'champion' && u.team === 'blue' && u.id !== world.player.id)
    .map((u) => u.id)
    .sort((a, b) => a - b);
  world.units.reverse();
  Object.freeze(world.units);
  const order = world.units.map((u) => u.id);
  expect(['f2', 'f3', 'f4', 'f5'].map((key) => cameraKeyTarget(world, key)?.id)).toEqual(expected);
  expect(world.units.map((u) => u.id)).toEqual(order);
});
test('allied deaths retain a camera target while enemy champions remain excluded', () => {
  const world = createLaneMatch(battlefield);
  const ally = cameraKeyTarget(world, 'f2')!;
  ally.hp = 0;
  ally.deadAt = world.tick;
  expect(cameraKeyTarget(world, 'f2')).toBe(ally);
  for (const key of ['f2', 'f3', 'f4', 'f5'])
    expect(cameraKeyTarget(world, key)?.team).toBe(world.hero.team);
});
test('practice exposes only the human shortcut', () => {
  const world = createLaneMatch(battlefield);
  world.matchMode = 'practice';
  expect(cameraKeyTarget(world, 'f1')).toBe(world.hero);
  expect(cameraKeyTarget(world, 'f2')).toBeNull();
});
test('a missing teammate slot fails safely', () => {
  const world = createLaneMatch(battlefield);
  world.units = world.units.filter(
    (u) => u.id === world.player.id || u.team !== world.hero.team || u.kind !== 'champion'
  );
  expect(cameraKeyTarget(world, 'f2')).toBeNull();
});
