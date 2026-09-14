import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { botDisengagePoint, type Combatant } from '../src/simulation/bot-disengage';
import { distance } from '../src/simulation/math';

const body = (x: number, y: number): Combatant => ({
  x,
  y,
  hp: 600,
  maxHp: 600,
  damage: 60,
  attackPeriod: 90,
});
test('an isolated champion backs away from a healthy pair, but fights with comparable support', () => {
  const actor = body(0, 0),
    enemies = [body(400, 100), body(400, -100)],
    home = { x: -2000, y: 0 };
  const point = botDisengagePoint(actor, [], enemies, home, () => true)!;
  expect(point.x).toBeLessThan(-200);
  for (const enemy of enemies)
    expect(distance(point, enemy)).toBeGreaterThan(distance(actor, enemy));
  expect(botDisengagePoint(actor, [body(-100, 0)], enemies, home, () => true)).toBeNull();
  expect(botDisengagePoint(actor, [], [enemies[0]], home, () => true)).toBeNull();
  expect(
    botDisengagePoint(
      actor,
      [],
      enemies.map((e) => ({ ...e, hp: 30 })),
      home,
      () => true
    )
  ).toBeNull();
});

test('flanking threats and blocked escape routes are considered together', () => {
  const actor = body(0, 0),
    enemies = [body(300, 0), body(-300, 0)];
  const point = botDisengagePoint(actor, [], enemies, { x: -2000, y: 0 }, (p) => p.y > 0)!;
  expect(point.y).toBeGreaterThan(200);
  expect(Math.min(...enemies.map((e) => distance(point, e)))).toBeGreaterThan(380);
  expect(botDisengagePoint(actor, [], enemies, { x: -2000, y: 0 }, () => false)).toBeNull();
});

function match(hiddenSecond = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -3000, y: 0 }, red: { x: 3000, y: 0 } },
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
    lineOfSight: (_a, b) => !hiddenSecond || b.y !== 100,
  });
  w.nextWaveTick = Infinity;
  w.hero.x = -3000;
  w.hero.y = 0;
  const bot = w.spawn('champion', 'blue', { x: 0, y: 0 });
  bot.ai = true;
  const a = w.spawn('champion', 'red', { x: 450, y: -100 });
  const b = w.spawn('champion', 'red', { x: 450, y: 100 });
  return { w, bot, a, b };
}
test('world bots disengage before starting a losing fight and resume with reinforcements', () => {
  const { w, bot, a } = match();
  w.step();
  expect(bot.order.type).toBe('move');
  expect(bot.x).toBeLessThan(0);
  expect(bot.aiRetreating).toBe(false); // Tactical spacing does not force a fountain trip.
  w.spawn('champion', 'blue', { x: -100, y: 0 });
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.order).toEqual({ type: 'attack', target: a.id });
});
test('hidden opponents do not change decisions and disengagement survives snapshot continuation', () => {
  const hidden = match(true);
  hidden.w.step();
  expect(hidden.bot.order).toEqual({ type: 'attack', target: hidden.a.id });
  const { w } = match();
  w.step();
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step(120);
  restored.step(120);
  expect(restored.snapshot()).toBe(w.snapshot());
});
