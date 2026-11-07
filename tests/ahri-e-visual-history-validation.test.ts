import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_E_POLICY } from '../src/content/ahri-e-policy';
import type { Projectile } from '../src/simulation/types';
import {
  advanceEVisualHistory,
  attachEVisualBuff,
  beginEVisualHistory,
  cancelEVisualCast,
  endEVisualFlight,
  finishAllEVisualHistory,
  launchEVisualHistory,
  refreshEVisualAudience,
  type EVisualObserverWorld,
  type AhriEVisualHistory,
} from '../src/simulation/ahri-e-visual-history';
import { validateEVisualMotion } from '../src/simulation/ahri-e-visual-history-validation';

type Mode = 'hit' | 'range' | 'terminal' | 'posthumous' | 'tenacity' | 'windup-death';
/** Observe real core objects through a separate adapter; this stays independent
 * of automatic World hooks when those are added. */
function trace(mode: Mode) {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  world.nextWaveTick = 1e9;
  Object.assign(world.hero, { x: -3000, y: -3000, ai: false });
  const source = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  source.ai = false;
  const target = world.spawn(
    'champion',
    'red',
    { x: 500, y: mode === 'range' ? 500 : 0 },
    mode === 'tenacity' ? 'garen' : 'lux'
  );
  Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
  world.learnSpell('e', source.id);
  if (mode === 'tenacity') {
    world.learnSpell('w', target.id);
    world.enqueue({ type: 'cast', unit: target.id, ability: 'w', point: target });
  }
  const aim = { x: 900, y: 0 };
  world.enqueue({ type: 'cast', unit: source.id, ability: 'e', point: aim });
  world.step();
  const observer: EVisualObserverWorld = {
    get tick() {
      return world.tick;
    },
    get winner() {
      return world.winner;
    },
    ahriEVisuals: [],
    get projectiles() {
      return world.projectiles;
    },
    unit: (id) => world.unit(id),
    alive: (u) => world.alive(u),
    visible: (u, team) => world.visible(u, team),
    pointVisible: (p, team) => world.pointVisible(p, team),
    championState: (id) => world.championState(id),
  };
  beginEVisualHistory(
    observer,
    source,
    aim,
    1,
    world.championState(source.id)!.pendingCast!.releaseTick
  );
  let held: Projectile | undefined;
  const record = observer.ahriEVisuals![0];
  validateEVisualMotion(record, world.tick);
  while (world.tick < 130 && !world.winner) {
    world.step();
    const before = world.snapshot();
    const shot = world.projectiles.find((p) => p.type === 'charm' && p.source === source.id);
    if (shot && !record.launch) {
      launchEVisualHistory(observer, record.castTick, { ...shot, remaining: AHRI_E_POLICY.range });
      held = shot;
    }
    const audio = world.ahriCharmAudio.find(
      (r) => r.sourceId === source.id && r.castTick === record.castTick
    );
    if (record.launch && !record.stop && audio?.stop) {
      if (!held) throw Error('Real projectile reference lost before its stop');
      endEVisualFlight(
        observer,
        held,
        audio.stop.point,
        audio.stop.reason,
        audio.hit ? world.unit(audio.hit.targetId) : undefined
      );
      if (target.charm?.startTick === world.tick) attachEVisualBuff(observer, held, target);
    }
    advanceEVisualHistory(observer);
    refreshEVisualAudience(observer);
    expect(world.snapshot()).toBe(before);
    validateEVisualMotion(record, world.tick);
    if (mode === 'windup-death' && world.tick === 5) {
      world.damage(target, source, 1e6, 'true');
      cancelEVisualCast(observer, source.id, 'death');
      validateEVisualMotion(record, world.tick);
    }
    if (mode === 'posthumous' && world.tick === 20) world.damage(target, source, 1e6, 'true');
    if (mode === 'terminal' && world.tick === 20) {
      const nexus = world.spawn('nexus', 'red', { x: 1500, y: 1500 });
      world.damage(world.hero, nexus, 1e6, 'true');
      const frozen = world.snapshot();
      finishAllEVisualHistory(observer);
      refreshEVisualAudience(observer);
      expect(world.snapshot()).toBe(frozen);
      validateEVisualMotion(record, world.tick);
    }
  }
  return { world, record };
}
for (const mode of ['hit', 'range', 'terminal', 'posthumous', 'tenacity', 'windup-death'] as const)
  test('replay genuine linear motion and sampled control through ' + mode, () => {
    const { world, record } = trace(mode);
    if (mode === 'windup-death') {
      expect(record.cancel).toEqual({ tick: 5, reason: 'death' });
      expect(record.launch).toBeNull();
      return;
    }
    expect(record.launch!.point).toEqual({ x: 0, y: 0 });
    expect(record.flightFrames[0].point.x).toBeGreaterThan(0);
    if (mode === 'range') {
      expect(record.stop!.reason).toBe('range');
      expect(record.buff).toBeNull();
    } else if (mode === 'terminal')
      expect(record.stop).toMatchObject({ tick: 20, reason: 'match-end' });
    else {
      expect(record.stop!.reason).toBe('hit');
      expect(record.buff!.stop!.reason).toBe('expired');
      expect(record.buff!.control.tenacityApplied).toBe(mode === 'tenacity');
    }
    validateEVisualMotion(record, world.tick);
  });

test('terminal launch can end before a moved sample without inventing a frame', () => {
  const { record } = trace('terminal');
  const r = structuredClone(record);
  r.sourceFrames = r.sourceFrames.filter((f) => f.tick <= r.launch!.tick);
  r.flightFrames = [];
  r.stop = {
    tick: r.launch!.tick,
    reason: 'match-end',
    point: { ...r.launch!.point },
    audience: ['blue'],
  };
  expect(() => validateEVisualMotion(r, r.launch!.tick)).not.toThrow();
  r.stop.point.x += 1;
  expect(() => validateEVisualMotion(r, r.launch!.tick)).toThrow();
});

test('reject forged clocks, swept contacts, motion, ownership, poses and audience shape', () => {
  const { world, record } = trace('hit');
  const mutations: ((r: AhriEVisualHistory) => void)[] = [
    (r) => r.releaseTick++,
    (r) => {
      r.facing = 0;
    },
    (r) => {
      r.launch!.direction.y = 0.25;
    },
    (r) => r.launch!.range++,
    (r) => r.sourceFrames[1].tick++,
    (r) => {
      r.sourceFrames[0].radius = 0;
    },
    (r) => r.flightFrames[1].previous.x++,
    (r) => r.flightFrames[1].point.y++,
    (r) => r.stop!.point.x++,
    (r) => r.stop!.tick++,
    (r) => (r.hit!.targetPoint.x += 10),
    (r) => r.hit!.targetRadius++,
    (r) => {
      r.hit!.targetTeam = r.team;
    },
    (r) => {
      r.hit!.targetAudience = ['blue'];
    },
    (r) => r.buff!.control.sourceId++,
    (r) => r.buff!.control.endTick++,
    (r) => {
      r.buff!.control.tenacityApplied = true;
    },
    (r) => r.buff!.stop!.tick--,
    (r) => r.targetFrames[0].tick++,
    (r) => r.flightFrames[0].audience.push('blue'),
  ];
  for (const [index, mutate] of mutations.entries()) {
    const r = structuredClone(record);
    mutate(r);
    expect(() => validateEVisualMotion(r, world.tick), 'mutation ' + index).toThrow();
  }
});
