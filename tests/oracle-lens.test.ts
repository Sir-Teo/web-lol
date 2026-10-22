import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ORACLE_POLICY as P } from '../src/content/trinkets';
import { swapTrinket, rechargeProgress, resetTrinket } from '../src/simulation/trinkets';
import { requestOracle, wardDetected, wardDisabled } from '../src/simulation/oracle-lens';
import type { Unit } from '../src/simulation/types';

function setup(hidden = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    spawns: { blue: { x: 0, y: 0 }, red: { x: 4000, y: 0 } },
    initialUnits: [],
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
    lineWalkable: () => true,
    lineOfSight: () => !hidden,
  });
  w.nextWaveTick = 1e9;
  return w;
}
function resume(w: World, ticks = 1) {
  const before = w.snapshot(),
    copy = World.fromSnapshot(before, w.battlefield);
  expect(copy.snapshot()).toBe(before);
  w.step(ticks);
  copy.step(ticks);
  expect(copy.snapshot()).toBe(w.snapshot());
}
function enemyWard(w: World): { ward: Unit; owner: Unit } {
  const owner = w.spawn('champion', 'red', { x: 500, y: 0 });
  owner.ai = false;
  w.enqueue({ type: 'ward', unit: owner.id, point: { x: 300, y: 0 } });
  w.step(141);
  Object.assign(owner, { x: 3000, y: 0, previous: { x: 3000, y: 0 } });
  return { owner, ward: w.units.find((u) => u.kind === 'ward')! };
}

test('free fountain swaps conserve charge stock, completed recharge work and short cooldowns', () => {
  const w = setup();
  w.step(2100);
  const stock = w.player.trinket.charges,
    progress = rechargeProgress(w.player.trinket, w.tick);
  expect(swapTrinket(w, 'oracle')).toBeNull();
  expect(w.player.gold).toBe(500);
  expect(w.player.inventory.every((i) => i === null)).toBe(true);
  expect(w.player.trinket).toMatchObject({
    kind: 'oracle',
    charges: stock,
    rechargeDurationTicks: 9600,
  });
  expect(rechargeProgress(w.player.trinket, w.tick)).toBe(progress);
  for (let i = 0; i < 20; i++) {
    expect(swapTrinket(w, i % 2 === 0 ? 'ward' : 'oracle')).toBeNull();
    expect(rechargeProgress(w.player.trinket, w.tick)).toBe(progress);
    expect(w.player.trinket.charges).toBe(stock);
  }
  expect(requestOracle(w, w.hero)).toBeNull();
  const cooldown = w.player.trinket.cooldownTick;
  expect(swapTrinket(w, 'ward')).toBeNull();
  expect(w.player.trinket.cooldownTick).toBe(cooldown);
  expect(w.player.trinket.charges).toBe(0);
  resume(w, 200);
});

test('swaps require fountain or death, clear approach intent, and leave accepted deliveries independent', () => {
  const approaching = setup();
  approaching.enqueue({ type: 'ward', unit: approaching.hero.id, point: { x: 1200, y: 0 } });
  approaching.step();
  expect(approaching.player.trinket.order).not.toBeNull();
  const stock = approaching.player.trinket.charges;
  expect(swapTrinket(approaching, 'oracle')).toBeNull();
  expect(approaching.player.trinket.order).toBeNull();
  expect(approaching.hero.order.type).toBe('idle');
  expect(approaching.player.trinket.charges).toBe(stock);
  resume(approaching);
  const w = setup();
  Object.assign(w.hero, { x: 500 });
  expect(swapTrinket(w, 'oracle')).toContain('fountain');
  Object.assign(w.hero, { x: 0 });
  w.enqueue({ type: 'ward', unit: w.hero.id, point: { x: 300, y: 0 } });
  w.step();
  expect(w.pendingWards).toHaveLength(1);
  expect(swapTrinket(w, 'oracle')).toBeNull();
  resetTrinket(w.player.trinket);
  resume(w, 20);
  expect(w.units.filter((u) => u.kind === 'ward')).toHaveLength(1);
  expect(w.player.trinket.charges).toBe(2);
  const enemy = w.spawn('champion', 'red', { x: 2000, y: 0 });
  enemy.ai = false;
  w.damage(enemy, w.hero, 1e6, 'true');
  expect(swapTrinket(w, 'ward')).toBeNull();
  resume(w);
});

test('Oracle detects a hidden enemy ward through terrain and disables only its sight until leaving range or expiry', () => {
  const w = setup(true),
    { ward } = enemyWard(w);
  expect(w.visible(ward, 'blue')).toBe(false);
  expect(swapTrinket(w, 'oracle')).toBeNull();
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.visible(ward, 'blue')).toBe(true);
  expect(w.visible(ward, 'red')).toBe(true);
  expect(wardDisabled(w, ward)).toBe(true);
  expect(w.visionSources('red').some((p) => p.x === ward.x && p.y === ward.y)).toBe(false);
  const expiry = ward.ward!.expireTick;
  Object.assign(w.hero, { x: -301 });
  expect(wardDetected(w, ward, 'blue')).toBe(false);
  expect(wardDisabled(w, ward)).toBe(false);
  Object.assign(w.hero, { x: 0 });
  expect(wardDisabled(w, ward)).toBe(true);
  resume(w, P.durationTicks - 1);
  expect(wardDisabled(w, ward)).toBe(true);
  resume(w);
  expect(w.player.trinket.scan).toBeNull();
  expect(w.visible(ward, 'blue')).toBe(false);
  expect(wardDisabled(w, ward)).toBe(false);
  expect(ward.ward!.expireTick).toBe(expiry);
});

test('an ordinary ward regains sight when its last overlapping scan ends', () => {
  const w = setup(),
    { ward } = enemyWard(w);
  expect(w.pointVisible({ x: 1100, y: 0 }, 'red')).toBe(true);
  swapTrinket(w, 'oracle');
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.pointVisible({ x: 1100, y: 0 }, 'red')).toBe(false);
  const ally = w.spawn('champion', 'blue', { x: 0, y: 0 });
  ally.ai = false;
  swapTrinket(w, 'oracle', ally.id);
  w.step(60);
  w.enqueue({ type: 'oracle', unit: ally.id });
  w.step();
  resume(w, P.durationTicks - 61);
  expect(w.player.trinket.scan).toBeNull();
  expect(wardDisabled(w, ward)).toBe(true);
  resume(w, 61);
  expect(wardDisabled(w, ward)).toBe(false);
  expect(w.pointVisible({ x: 1100, y: 0 }, 'red')).toBe(true);
});

test('hidden champions produce saved sampled echoes without ordinary vision, targetability or live movement tracking', () => {
  const w = setup(true),
    enemy = w.spawn('champion', 'red', { x: 400, y: 0 });
  enemy.ai = false;
  swapTrinket(w, 'oracle');
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  const scan = w.player.trinket.scan!;
  expect(scan.echoes).toHaveLength(1);
  expect(w.visible(enemy, 'blue')).toBe(false);
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: enemy.id } });
  w.step();
  expect(w.hero.releaseTick).toBeNull();
  expect(w.hero.attackCycle).toBeNull();
  const point = { ...scan.echoes[0].point };
  Object.assign(enemy, { x: 450, previous: { x: 450, y: 0 } });
  resume(w, scan.nextPulseTick - w.tick - 1);
  expect(scan.echoes[0].point).toEqual(point);
  resume(w);
  expect(scan.echoes[0].point.x).toBe(450);
  expect(w.player.observedStats.blue).not.toBeNull();
  expect(w.championState(enemy.id)!.observedStats.blue).toBeNull();
});

test('accepted scans preserve channel/order, survive swap, practice refill and owner death, and expire on their captured clock', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 2000, y: 0 });
  enemy.ai = false;
  swapTrinket(w, 'oracle');
  w.player.recallEnd = 480;
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.player.recallEnd).toBe(480);
  expect(w.hero.order.type).toBe('idle');
  const end = w.player.trinket.scan!.endTick;
  swapTrinket(w, 'ward');
  resetTrinket(w.player.trinket);
  w.damage(enemy, w.hero, 1e6, 'true');
  expect(w.player.trinket.scan!.endTick).toBe(end);
  resume(w, end - w.tick);
  expect(w.player.trinket.scan).toBeNull();
});

test('a recast after the short cooldown consumes a second charge and replaces the active scan', () => {
  const w = setup();
  swapTrinket(w, 'oracle');
  resetTrinket(w.player.trinket);
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  const firstEnd = w.player.trinket.scan!.endTick;
  expect(requestOracle(w, w.hero)).toContain('cooling');
  resume(w, P.cooldownTicks);
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.player.trinket.charges).toBe(0);
  expect(w.player.trinket.scan!.endTick).toBeGreaterThan(firstEnd);
  resume(w, P.durationTicks);
  expect(w.player.trinket.scan).toBeNull();
});

test('a detected ward takes three basic hits and retains the existing ward reward without CS or kill credit', () => {
  const w = setup(),
    { ward } = enemyWard(w);
  swapTrinket(w, 'oracle');
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  const gold = w.player.gold,
    cs = w.player.cs,
    kills = w.player.kills;
  w.enqueue({ type: 'order', unit: w.hero.id, order: { type: 'attack', target: ward.id } });
  resume(w, 300);
  expect(w.alive(ward)).toBe(false);
  expect(w.player.gold).toBe(gold + 10);
  expect([w.player.cs, w.player.kills]).toEqual([cs, kills]);
});

test('invalid saved charge conversion, scan clocks and silhouette history are rejected', () => {
  const w = setup(true),
    enemy = w.spawn('champion', 'red', { x: 400, y: 0 });
  enemy.ai = false;
  swapTrinket(w, 'oracle');
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  const saved = JSON.parse(w.snapshot());
  for (const mutate of [
    (s: any) => {
      s.player.trinket.rechargeStartProgress = 1;
    },
    (s: any) => {
      s.player.trinket.rechargeDurationTicks = 1;
    },
    (s: any) => {
      s.player.trinket.rechargeEndTick++;
    },
    (s: any) => {
      s.player.trinket.order = { x: 0, y: 0 };
    },
    (s: any) => {
      s.player.trinket.scan.endTick++;
    },
    (s: any) => {
      s.player.trinket.scan.radius = 751;
    },
    (s: any) => {
      s.player.trinket.scan.nextPulseTick++;
    },
    (s: any) => {
      s.player.trinket.scan.nextPulseTick = s.tick;
    },
    (s: any) => {
      s.player.trinket.scan.pulseStartTick = null;
    },
    (s: any) => {
      s.player.trinket.scan.pulseStartTick += 2;
    },
    (s: any) => {
      s.player.trinket.scan.echoes[0].targetId = w.hero.id;
    },
    (s: any) => {
      s.player.trinket.scan.echoes[0].point.x = 3000;
    },
    (s: any) => {
      s.player.trinket.scan.echoes[0].endTick++;
    },
    (s: any) => {
      s.player.trinket.scan.echoes.push(s.player.trinket.scan.echoes[0]);
    },
  ]) {
    const invalid = structuredClone(saved);
    mutate(invalid);
    expect(() => World.fromSnapshot(JSON.stringify(invalid), w.battlefield)).toThrow();
  }
});

test('Oracle permits root and silence, rejects stun and death, and cannot use a Ward charge without a swap', () => {
  const w = setup();
  expect(requestOracle(w, w.hero)).toContain('not equipped');
  for (const status of ['root', 'silence', 'stun', 'death'] as const) {
    const w = setup();
    swapTrinket(w, 'oracle');
    if (status === 'death') {
      const enemy = w.spawn('champion', 'red', { x: 3000, y: 0 });
      enemy.ai = false;
      w.damage(enemy, w.hero, 1e6, 'true');
    } else w.hero[`${status}Until`] = 200;
    const allowed = status === 'root' || status === 'silence';
    expect(requestOracle(w, w.hero) === null).toBe(allowed);
    expect(w.player.trinket.charges).toBe(allowed ? 0 : 1);
  }
});

test('scan radius and recharge capture average champion level independently of later level changes', () => {
  const w = setup(),
    enemy = w.spawn('champion', 'red', { x: 4000, y: 0 });
  enemy.ai = false;
  w.gainExperience(1e6, enemy.id);
  swapTrinket(w, 'oracle');
  expect(w.player.trinket.rechargeDurationTicks).toBe(7800);
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.player.trinket.scan!.radius).toBe(675);
  w.gainExperience(1e6);
  expect(w.player.trinket.scan!.radius).toBe(675);
  expect(w.player.trinket.rechargeDurationTicks).toBe(7800);
  resume(w, 7800 - w.tick);
  expect(w.player.trinket.rechargeDurationTicks).toBe(6000);
  resume(w, 6000);
  expect(w.player.trinket.charges).toBe(2);
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.player.trinket.scan!.radius).toBe(750);
  resume(w);
});

test('a match-ending Nexus hit on the sampling boundary preserves a valid frozen checkpoint', () => {
  const w = setup();
  // Keep the enemy champion hidden while allowing the controlled Nexus attack.
  w.battlefield.lineOfSight = (_from, to) => to.x < 200;
  const enemy = w.spawn('champion', 'red', { x: 400, y: 0 });
  enemy.ai = false;
  const nexus = w.spawn('nexus', 'red', { x: 100, y: 0 });
  nexus.hp = 1;
  swapTrinket(w, 'oracle');
  w.enqueue({ type: 'oracle', unit: w.hero.id });
  w.step();
  expect(w.player.trinket.scan!.echoes).toHaveLength(1);
  const pulse = w.player.trinket.scan!.nextPulseTick + P.echoTicks * 2;
  const attacker = w.spawn('melee', 'blue', { x: 100, y: 0 });
  attacker.ai = false;
  attacker.nextAttackTick = pulse - attacker.windupTicks;
  attacker.order = { type: 'attack', target: nexus.id };
  w.step(pulse - w.tick);
  expect(w.winner).toBe('blue');
  expect(w.tick).toBe(pulse);
  const saved = w.snapshot();
  const restored = World.fromSnapshot(saved, w.battlefield);
  expect(restored.snapshot()).toBe(saved);
  restored.step();
  expect(restored.snapshot()).toBe(saved);
});

test('a scan accepted between ticks keeps its actual first sampling phase through later reloads', () => {
  const w = setup(true),
    enemy = w.spawn('champion', 'red', { x: 400, y: 0 });
  enemy.ai = false;
  swapTrinket(w, 'oracle');
  expect(requestOracle(w, w.hero)).toBeNull();
  resume(w);
  expect(w.player.trinket.scan!.echoes).toHaveLength(1);
  resume(w, P.echoTicks);
  resume(w, P.echoTicks);
});

test('a match ending before the first pending sample retains a restorable initial scan clock', () => {
  const w = setup(),
    nexus = w.spawn('nexus', 'red', { x: 100, y: 0 });
  nexus.hp = 1;
  const attacker = w.spawn('melee', 'blue', { x: 100, y: 0 });
  attacker.ai = false;
  attacker.order = { type: 'attack', target: nexus.id };
  w.step();
  w.step(attacker.releaseTick! - w.tick - 1);
  swapTrinket(w, 'oracle');
  expect(requestOracle(w, w.hero)).toBeNull();
  w.step();
  expect(w.winner).toBe('blue');
  expect(w.player.trinket.scan!.pulseStartTick).toBeNull();
  expect(w.player.trinket.scan!.echoes).toEqual([]);
  const saved = w.snapshot();
  expect(World.fromSnapshot(saved, w.battlefield).snapshot()).toBe(saved);
});
