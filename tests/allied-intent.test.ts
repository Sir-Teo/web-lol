import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { alliedChampionIntent } from '../src/ui/allied-intent';
import { createLaneMatch } from '../src/simulation/lane-match';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import type { TeamGoal } from '../src/simulation/bot-team';

const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const battlefield = createRift(
  new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  ),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function fixture() {
  const world = createLaneMatch(battlefield);
  const ally = world.units.find((u) => u.kind === 'champion' && u.team === 'blue' && u.ai)!;
  const enemy = world.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  const anchor = world.units.find((u) => u.kind === 'turret' && u.team === 'red')!;
  const goal: TeamGoal = {
    unitId: ally.id,
    kind: 'advance',
    targetId: anchor.id,
    point: { x: anchor.x - 1000, y: anchor.y },
    issuedTick: 0,
    observedTick: 0,
    expiresTick: 180,
    score: 90,
  };
  world.teamPlans!.blue.assignments = [goal];
  return { world, ally, enemy, goal };
}
test('a friendly live plan is derived without modifying its saved match, and expires on its exact deadline', () => {
  const { world, ally, goal } = fixture();
  const before = world.snapshot();
  expect(alliedChampionIntent(world, ally)).toBe('Advancing');
  expect(world.snapshot()).toBe(before);
  world.tick = goal.expiresTick - 1;
  expect(alliedChampionIntent(world, ally)).toBe('Advancing');
  world.tick++;
  expect(alliedChampionIntent(world, ally)).toBeNull();
});
test('opponents cannot expose owner records or team plans through the intent projection', () => {
  const { world, enemy, goal } = fixture();
  world.teamPlans!.red.assignments = [{ ...goal, unitId: enemy.id }];
  const original = world.championState.bind(world);
  vi.spyOn(world, 'championState').mockImplementation((id) => {
    if (id === enemy.id) throw new Error('Enemy owner record read');
    return original(id);
  });
  Object.defineProperty(world.teamPlans!, 'red', {
    get() {
      throw new Error('Enemy plan read');
    },
  });
  expect(alliedChampionIntent(world, enemy)).toBeNull();
});
test('the human and manually controlled allies have no automated intent, including an AI-marked QA human', () => {
  const { world, ally, goal } = fixture();
  world.hero.ai = true;
  world.teamPlans!.blue.assignments.push({ ...goal, unitId: world.hero.id });
  expect(alliedChampionIntent(world, world.hero)).toBeNull();
  ally.ai = false;
  expect(alliedChampionIntent(world, ally)).toBeNull();
});
test('recall and retreat take precedence over an old job, and dead allies have no current intent', () => {
  const { world, ally } = fixture();
  const owner = world.championState(ally.id)!;
  ally.aiRetreating = true;
  owner.recallEnd = world.tick + 480;
  expect(alliedChampionIntent(world, ally)).toBe('Recalling');
  owner.recallEnd = null;
  expect(alliedChampionIntent(world, ally)).toBe('Retreating');
  ally.hp = 0;
  expect(alliedChampionIntent(world, ally)).toBeNull();
});
test('practice and a finished match do not advertise stale team jobs', () => {
  const { world, ally } = fixture();
  world.matchMode = 'practice';
  expect(alliedChampionIntent(world, ally)).toBeNull();
  world.matchMode = 'lanes';
  world.winner = 'blue';
  expect(alliedChampionIntent(world, ally)).toBeNull();
});
