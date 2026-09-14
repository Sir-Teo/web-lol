import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';

function lane(team: 'blue' | 'red' = 'red') {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -10000;
  const bot = w.spawn('champion', team, { x: 0, y: 0 });
  bot.ai = true;
  const enemy: 'blue' | 'red' = team === 'red' ? 'blue' : 'red';
  const healthy = w.spawn('melee', enemy, { x: 200, y: 0 });
  const weak = w.spawn('caster', enemy, { x: 500, y: 0 });
  healthy.speed = weak.speed = 0;
  healthy.nextAttackTick = weak.nextAttackTick = 10000;
  weak.hp = 20;
  return { w, bot, healthy, weak, enemy };
}

for (const team of ['blue', 'red'] as const) {
  test(`${team} bot takes a farther visible last hit and retains it across a saved windup`, () => {
    const { w, bot, healthy, weak } = lane(team);
    w.step();
    expect(bot.attackTarget).toBe(weak.id);
    const saved = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, saved]) {
      world.step(55);
      expect(world.unit(weak.id)!.hp).toBe(0);
      expect(world.unit(healthy.id)!.hp).toBe(healthy.maxHp);
      expect(world.championState(bot.id)!.cs).toBe(1);
    }
    expect(saved.snapshot()).toBe(w.snapshot());
  });
}

test('armor, sight and range prevent false last-hit opportunities', () => {
  for (const condition of ['armor', 'hidden', 'range']) {
    const { w, bot, healthy, weak } = lane();
    if (condition === 'armor') weak.armor = 1000;
    if (condition === 'hidden') w.battlefield.lineOfSight = (_a, b) => b.x < 400;
    if (condition === 'range') weak.x = 1000;
    w.step();
    expect(bot.attackTarget, condition).toBe(healthy.id);
  }
});

test('last-hit selection preserves a committed attack and prioritizes valuable minions', () => {
  const { w, bot, weak, enemy } = lane();
  const siege = w.spawn('siege', enemy, { x: 550, y: 0 });
  siege.hp = 20;
  siege.speed = 0;
  siege.goldBounty = 90;
  weak.goldBounty = 15;
  w.step();
  expect(bot.attackTarget).toBe(siege.id);
  const release = bot.releaseTick;
  weak.goldBounty = 200;
  bot.nextThink = w.tick + 1;
  w.step();
  expect(bot.attackTarget).toBe(siege.id);
  expect(bot.releaseTick).toBe(release);
});

test('close champion threats outrank farming and Q estimates only its first arrow', () => {
  const first = lane();
  first.healthy.x = 50;
  const threat = first.w.spawn('champion', first.enemy, { x: 100, y: 0 });
  first.w.step();
  expect(first.bot.attackTarget).toBe(threat.id);
  const second = lane();
  second.w.championState(second.bot.id)!.qUntil = 360;
  second.w.step();
  expect(second.bot.attackTarget).toBe(second.healthy.id);
});

function incoming(team: 'blue' | 'red' = 'red') {
  const setup = lane(team);
  const { w, bot, weak } = setup;
  bot.ai = false;
  weak.goldBounty = 90;
  const ally = w.spawn('caster', team, { x: weak.x - 200, y: weak.y });
  ally.damage = 50;
  ally.speed = 0;
  w.setOrder(ally, { type: 'attack', target: weak.id });
  w.step();
  w.step(ally.releaseTick! - w.tick);
  expect(w.projectiles.some((p) => p.source === ally.id && p.target === weak.id)).toBe(true);
  bot.ai = true;
  bot.nextThink = w.tick + 1;
  return { ...setup, ally };
}

for (const team of ['blue', 'red'] as const)
  test(`${team} bot avoids a last hit already claimed by an allied missile and saves the decision exactly`, () => {
    const { w, bot, healthy, weak } = incoming(team);
    healthy.hp = 25;
    const withoutForecast = World.fromSnapshot(w.snapshot(), w.battlefield);
    Object.assign(withoutForecast, { incomingAttacksClaimMinion: () => false });
    withoutForecast.step();
    expect(withoutForecast.unit(bot.id)!.attackTarget).toBe(weak.id);
    w.step();
    expect(bot.attackTarget).toBe(healthy.id);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (const world of [w, restored]) {
      world.step(55);
      expect(world.unit(healthy.id)!.hp).toBe(0);
      expect(world.unit(weak.id)!.hp).toBe(0);
      expect(world.championState(bot.id)!.cs).toBe(1);
    }
    expect(restored.snapshot()).toBe(w.snapshot());
  });

test('slow, nonlethal and exhausted allied missiles do not disqualify a last hit', () => {
  for (const condition of ['slow', 'nonlethal', 'exhausted']) {
    const { w, bot, weak, ally } = incoming();
    const missile = w.projectiles.find((p) => p.source === ally.id)!;
    if (condition === 'slow') missile.speed = 1;
    if (condition === 'nonlethal') missile.damage = 1;
    if (condition === 'exhausted') missile.remaining = 1;
    w.step();
    expect(bot.attackTarget, condition).toBe(weak.id);
  }
});

test('fallback acquisition also avoids the claimed minion when no last hit is available', () => {
  const { w, bot, healthy, weak } = incoming();
  healthy.x = 600;
  weak.x = 400;
  w.step();
  expect(bot.order).toEqual({ type: 'attack', target: healthy.id });
});

test('a bot holds for the only claimed minion and resumes movement after its death', () => {
  const { w, bot, healthy, weak } = incoming();
  w.units = w.units.filter((unit) => unit.id !== healthy.id);
  w.step();
  expect(bot.order).toEqual({ type: 'idle' });
  expect(bot.releaseTick).toBeNull();
  w.step(55);
  expect(weak.hp).toBe(0);
  expect(w.championState(bot.id)!.cs).toBe(0);
  expect(bot.order.type).toBe('move');
});
