import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createRift } from '../src/content/rift';
import { RIFT_CAMPS, type RiftCampId } from '../src/content/rift-camps';
import { NavGrid } from '../src/simulation/navgrid';
import { createLaneMatch } from '../src/simulation/lane-match';
import { jungleRoute } from '../src/simulation/bot-jungle';
import { World } from '../src/simulation/world';

function battlefield() {
  const bytes = readFileSync('public/assets/maps/rift-nav.bin');
  return createRift(
    new NavGrid(
      JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    ),
    JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
  );
}

test('a Rift jungler leaves the Blue Sentinel brush boundary without injected movement orders', () => {
  const world = createLaneMatch(battlefield());
  world.nextWaveTick = 1_000_000_000;
  for (const unit of world.units) unit.ai = false;
  const camp = RIFT_CAMPS.find((c) => c.id === 'order-blue')!;
  world.tick = camp.firstReadyTick - 1;
  world.step();
  const actor = world.units.find(
    (unit) =>
      unit.kind === 'champion' &&
      unit.team === 'blue' &&
      world.championState(unit.id)!.role === 'jungle'
  )!;
  const point = { x: -3881.10489654541, y: -452.75579833984375 };
  Object.assign(actor, point, { previous: { ...point }, ai: true, nextThink: world.tick });
  world.setOrder(actor, { type: 'idle' });
  const state = world.championState(actor.id)!;
  state.jungle = {
    camp: camp.id as RiftCampId,
    cursor: jungleRoute('blue').findIndex((c) => c.id === camp.id),
    quietSince: world.tick,
    observations: [],
  };
  const activeCamp = world.jungleCamps.find((c) => c.id === camp.id)!;
  const monster = world.unit(activeCamp.unitIds[0]!)!;
  expect(world.battlefield.inBrush!(actor)).toBe(true);
  expect(world.battlefield.lineOfSight(actor, monster)).toBe(true);
  expect(world.battlefield.lineOfSight(monster, actor)).toBe(false);
  expect(world.visible(monster, 'blue')).toBe(true);
  const initial = world.snapshot();
  const restored = World.fromSnapshot(initial, battlefield());
  expect(restored.snapshot()).toBe(initial);
  let leftBrush = false;
  let engagedFromClearSight = false;
  for (let i = 0; i < 300; i++) {
    world.step();
    restored.step();
    if (!world.battlefield.inBrush!(actor)) leftBrush = true;
    if (monster.monster!.phase === 'engaged' && world.battlefield.lineOfSight(monster, actor))
      engagedFromClearSight = true;
    if (i % 30 === 0) expect(restored.snapshot()).toBe(world.snapshot());
    expect(world.visionSources('neutral')).toEqual([]);
  }
  expect(leftBrush).toBe(true);
  expect(engagedFromClearSight).toBe(true);
  expect(Math.hypot(actor.x - point.x, actor.y - point.y)).toBeGreaterThan(20);
  expect(restored.snapshot()).toBe(world.snapshot());
  expect(World.fromSnapshot(world.snapshot(), battlefield()).snapshot()).toBe(world.snapshot());
});
