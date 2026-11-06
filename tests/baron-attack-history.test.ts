import { BARON_BASIC_CAST_TICKS } from '../src/content/baron-basic-audio-timing';
import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';
import {
  BARON_ATTACK_FLIGHT_TAIL_TICKS,
  BARON_ATTACK_HIT_HISTORY_TICKS,
  BARON_ATTACK_PATH_FRAMES,
} from '../src/content/baron-attack-presentation';
import { TICK_RATE } from '../src/content/rules';

const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
function launched(battlefield = field) {
  const w = createBaronEncounter(battlefield),
    b = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, b, 1, 'true');
  w.step();
  w.step(b.releaseTick! - w.tick);
  const visual = w.baronAttackVisuals[0];
  expect(visual).toBeDefined();
  return { w, b, visual };
}
function impact() {
  const f = launched();
  for (let i = 0; i < 90 && !f.visual.impact; i++) f.w.step();
  expect(f.visual.impact).not.toBeNull();
  return f;
}
const restore = (w: World) => World.fromSnapshot(w.snapshot(), w.battlefield);

test('source envelopes reproduce offline and bind the local simulation clock', () => {
  execFileSync('python3', ['tools/assets/export-baron-full-history-bounds.py', '--check'], {
    env: { ...process.env, PYTHONPATH: 'tools/assets' },
    stdio: 'pipe',
  });
  expect(TICK_RATE).toBe(60);
  expect([
    BARON_ATTACK_FLIGHT_TAIL_TICKS,
    BARON_ATTACK_HIT_HISTORY_TICKS,
    BARON_ATTACK_PATH_FRAMES,
  ]).toEqual([87, 125, 312]);
});

test('release reuses the projectile identity and records exact post-step distance', () => {
  const { w, b, visual } = launched(),
    p = w.projectiles.find((p) => p.id === visual.id)!;
  expect(visual).toMatchObject({
    id: p.id,
    sourceId: b.id,
    targetId: w.hero.id,
    launchTick: p.launchTick,
    stopTick: null,
    impact: null,
  });
  expect(visual.frames).toHaveLength(1);
  expect(visual.frames[0]).toMatchObject({ tick: w.tick, x: p.x, y: p.y });
  expect(visual.frames[0].distance).toBeCloseTo(1300 / 60, 10);
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('homing flight and stopped contact restore the exact future', () => {
  const { w, visual } = launched();
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: -400, y: 100 } });
  w.step(5);
  const saved = restore(w);
  w.step(70);
  saved.step(70);
  expect(saved.snapshot()).toBe(w.snapshot());
  const current = w.baronAttackVisuals.find((v) => v.id === visual.id)!;
  expect(current.stopReason).toBe('hit');
  expect(current.impact).not.toBeNull();
  const post = restore(w);
  w.step(180);
  post.step(180);
  expect(post.snapshot()).toBe(w.snapshot());
});

test('contact stores the swept endpoint and follows later target Flash poses', () => {
  const { w, visual } = impact(),
    hit = visual.impact!;
  expect(hit.point).toEqual({ x: visual.frames.at(-1)!.x, y: visual.frames.at(-1)!.y });
  expect(Math.hypot(hit.point.x - w.hero.x, hit.point.y - w.hero.y)).toBeCloseTo(
    w.hero.radius + 8,
    7
  );
  const oldPoint = { ...hit.point };
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: -400, y: 0 } });
  w.step();
  expect(hit.frames.at(-1)!.x).toBe(w.hero.x);
  expect(w.hero.x).toBeLessThan(-300);
  expect(hit.point).toEqual(oldPoint);
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('source death does not retire an already released flight or its hit', () => {
  const { w, b, visual } = launched();
  w.damage(w.hero, b, 1e6, 'true');
  const copy = restore(w);
  w.step(35);
  copy.step(35);
  expect(visual.stopReason).toBe('hit');
  expect(visual.impact).not.toBeNull();
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('target death before contact retires without inventing a hit and expires exactly', () => {
  const { w, b, visual } = launched();
  w.damage(b, w.hero, 1e6, 'true');
  w.step();
  expect(visual.stopReason).toBe('target-lost');
  expect(visual.impact).toBeNull();
  expect(restore(w).snapshot()).toBe(w.snapshot());
  const end = Math.max(
    visual.launchTick + BARON_BASIC_CAST_TICKS,
    visual.stopTick! + BARON_ATTACK_FLIGHT_TAIL_TICKS
  );
  w.step(end - w.tick - 1);
  expect(w.baronAttackVisuals.some((v) => v.id === visual.id)).toBe(true);
  w.step();
  expect(w.baronAttackVisuals.some((v) => v.id === visual.id)).toBe(false);
});

test('death after contact detaches the finalized body pose without following later corpse movement', () => {
  const { w, b, visual } = impact(),
    hit = visual.impact!;
  w.damage(b, w.hero, 1e6, 'true');
  w.step();
  expect(hit.detachedTick).toBe(w.tick);
  const frame = structuredClone(hit.frames.at(-1)!);
  w.hero.x += 100;
  w.step(3);
  expect(hit.frames.at(-1)).toEqual({ ...frame, tick: w.tick });
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('contact retention outlives the flight tail and retires on its exact bound', () => {
  const { w, visual } = impact(),
    end = Math.max(
      visual.launchTick + BARON_BASIC_CAST_TICKS,
      visual.impact!.startTick + BARON_ATTACK_HIT_HISTORY_TICKS
    );
  w.step(BARON_ATTACK_FLIGHT_TAIL_TICKS);
  expect(w.baronAttackVisuals.some((v) => v.id === visual.id)).toBe(true);
  expect(restore(w).snapshot()).toBe(w.snapshot());
  w.step(end - w.tick - 1);
  expect(w.baronAttackVisuals.some((v) => v.id === visual.id)).toBe(true);
  w.step();
  expect(w.baronAttackVisuals.some((v) => v.id === visual.id)).toBe(false);
});

test('historical visibility is immutable when a stopped root becomes visible again', () => {
  const { w, b, visual } = launched();
  w.damage(b, w.hero, 1e6, 'true');
  w.step();
  expect(visual.stopReason).toBe('target-lost');
  let visible = false;
  w.pointVisible = () => visible;
  w.step(2);
  const hidden = visual.frames.at(-1)!;
  expect(hidden.audience).toEqual([]);
  visible = true;
  w.step();
  expect(visual.frames.at(-1)!.audience).toEqual(['blue', 'red']);
  expect(hidden.audience).toEqual([]);
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('a saved detached contact rejects later pose movement', () => {
  const { w, b, visual } = impact();
  w.damage(b, w.hero, 1e6, 'true');
  w.step(3);
  const raw = JSON.parse(w.snapshot()),
    saved = raw.baronAttackVisuals.find((v: any) => v.id === visual.id);
  expect(saved.impact.detachedTick).not.toBeNull();
  saved.impact.frames.at(-1).facing += 0.1;
  expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
});

test('a stopped presentation ID cannot alias a live gameplay unit', () => {
  const { w, visual } = impact();
  const raw = JSON.parse(w.snapshot());
  raw.baronAttackVisuals.find((v: any) => v.id === visual.id).id = w.hero.id;
  expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
});

test('a long range expiry retains its full launch prefix and absolute odometer', () => {
  const wide = {
    ...field,
    half: 10000,
    reachable: (point: { x: number; y: number }) => ({ ...point }),
    lineWalkable: () => true,
    findPath: (_from: { x: number; y: number }, to: { x: number; y: number }) => [{ ...to }],
  };
  const { w, visual } = launched(wide);
  for (let i = 0; i < 200 && visual.stopTick === null; i++) {
    const p = w.projectiles.find((p) => p.id === visual.id)!;
    w.hero.x = p.x - 3500;
    w.hero.y = p.y;
    w.step();
    if (i === 100) {
      expect(visual.frames).toHaveLength(w.tick - visual.launchTick + 1);
      expect(visual.frames[0].tick).toBe(visual.launchTick);
      expect(restore(w).snapshot()).toBe(w.snapshot());
    }
  }
  expect(visual.stopReason).toBe('range');
  expect(visual.frames).toHaveLength(w.tick - visual.launchTick + 1);
  expect(visual.frames[0].tick).toBe(visual.launchTick);
  expect(visual.frames.at(-1)!.distance).toBeCloseTo(4000, 7);
  expect(visual.frames.length).toBeLessThan(BARON_ATTACK_PATH_FRAMES);
  expect(visual.frames[0].distance).toBeCloseTo(1300 / 60, 7);
  expect(restore(w).snapshot()).toBe(w.snapshot());
});

test('an unrelated melee victory freezes the released attack without an invented contact', () => {
  const { w, visual } = launched(),
    previous = structuredClone(visual.frames.at(-1)!);
  const finisher = w.spawn('melee', 'blue', { x: -500, y: -500 });
  const nexus = w.spawn('nexus', 'red', { x: -450, y: -500 });
  nexus.hp = 1;
  w.setOrder(finisher, { type: 'attack', target: nexus.id });
  finisher.releaseTick = w.tick + 1;
  finisher.attackTarget = nexus.id;
  w.step();
  expect(w.winner).toBe('blue');
  expect(visual.stopReason).toBe('match-end');
  expect(visual.impact).toBeNull();
  expect(visual.frames.at(-1)!.distance).toBe(previous.distance);
  const saved = w.snapshot();
  expect(restore(w).snapshot()).toBe(saved);
  w.step(60);
  expect(w.snapshot()).toBe(saved);
});

for (const [name, edit] of [
  [
    'missing flight',
    (s: any) => {
      s.baronAttackVisuals = [];
    },
  ],
  [
    'duplicate flight',
    (s: any) => {
      s.baronAttackVisuals.push(structuredClone(s.baronAttackVisuals[0]));
    },
  ],
  [
    'wrong source',
    (s: any) => {
      s.baronAttackVisuals[0].sourceId = s.player.id;
    },
  ],
  [
    'wrong target',
    (s: any) => {
      s.baronAttackVisuals[0].targetId = s.baronAttackVisuals[0].sourceId;
    },
  ],
  [
    'future launch',
    (s: any) => {
      s.baronAttackVisuals[0].launchTick = s.tick + 1;
    },
  ],
  [
    'gapped ticks',
    (s: any) => {
      s.baronAttackVisuals[0].frames[1].tick++;
    },
  ],
  [
    'wrong odometer',
    (s: any) => {
      s.baronAttackVisuals[0].frames.at(-1).distance++;
    },
  ],
  [
    'wrong endpoint',
    (s: any) => {
      s.baronAttackVisuals[0].frames.at(-1).x++;
    },
  ],
  [
    'wrong facing',
    (s: any) => {
      s.baronAttackVisuals[0].frames.at(-1).facing += 0.1;
    },
  ],
  [
    'noncanonical audience',
    (s: any) => {
      s.baronAttackVisuals[0].frames[0].audience = ['red', 'blue'];
    },
  ],
  [
    'forged hit',
    (s: any) => {
      s.baronAttackVisuals[0].stopReason = 'hit';
    },
  ],
] as const)
  test(`saved active Baron history rejects ${name}`, () => {
    const { w } = launched();
    w.step(3);
    const raw = JSON.parse(w.snapshot());
    edit(raw);
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
  });

for (const [name, edit] of [
  [
    'missing contact',
    (v: any) => {
      v.impact = null;
    },
  ],
  [
    'wrong contact clock',
    (v: any) => {
      v.impact.startTick++;
    },
  ],
  [
    'wrong contact point',
    (v: any) => {
      v.impact.point.x++;
    },
  ],
  [
    'wrong target radius',
    (v: any) => {
      v.impact.targetRadius++;
    },
  ],
  [
    'wrong target team',
    (v: any) => {
      v.impact.targetTeam = 'red';
    },
  ],
  [
    'missing pose',
    (v: any) => {
      v.impact.frames.pop();
    },
  ],
  [
    'forged pose endpoint',
    (v: any) => {
      v.impact.frames.at(-1).x++;
    },
  ],
  [
    'missing owner visibility',
    (v: any) => {
      v.impact.frames[0].audience = [];
    },
  ],
  [
    'future detachment',
    (v: any, s: any) => {
      v.impact.detachedTick = s.tick + 1;
    },
  ],
  [
    'range instead of hit',
    (v: any) => {
      v.stopReason = 'range';
    },
  ],
  [
    'moved stopped root',
    (v: any) => {
      v.frames.at(-1).x++;
    },
  ],
] as const)
  test(`saved Baron contact rejects ${name}`, () => {
    const { w, visual } = impact();
    w.step(2);
    const raw = JSON.parse(w.snapshot());
    const saved = raw.baronAttackVisuals.find((v: any) => v.id === visual.id);
    edit(saved, raw);
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
  });

test('saved release pose stays independent through source death and rejects edited clocks', () => {
  const { w, b, visual } = launched();
  const pose = JSON.stringify(visual.launchPose);
  expect(visual.launchPose.animationTimeline?.primary.kind).toBe('attack');
  expect(visual.launchPose.tick).toBe(visual.launchTick);
  w.damage(w.hero, b, 1e6, 'true');
  w.step(10);
  expect(JSON.stringify(visual.launchPose)).toBe(pose);
  expect(restore(w).snapshot()).toBe(w.snapshot());
  for (const edit of ['clock', 'position', 'kind', 'missing']) {
    const snapshot = JSON.parse(w.snapshot());
    const saved = snapshot.baronAttackVisuals[0];
    if (edit === 'clock') saved.launchPose.animationTimeline.tick--;
    if (edit === 'position') saved.launchPose.x++;
    if (edit === 'kind') saved.launchPose.animationTimeline.primary.kind = 'death';
    if (edit === 'missing') delete saved.launchPose;
    expect(() => World.fromSnapshot(JSON.stringify(snapshot), w.battlefield)).toThrow();
  }
});

test('release owns its initial target point independently of later target movement', () => {
  const { w, visual } = launched();
  const initial = { x: w.hero.x, y: w.hero.y };
  expect(visual.initialTargetPoint).toEqual(initial);
  w.hero.x += 100;
  w.step();
  expect(visual.initialTargetPoint).toEqual(initial);
  expect(restore(w).baronAttackVisuals.find((v) => v.id === visual.id)!.initialTargetPoint).toEqual(
    initial
  );
  for (const change of ['missing', 'nonfinite', 'outside flight cap']) {
    const raw = JSON.parse(w.snapshot()),
      saved = raw.baronAttackVisuals.find((v: any) => v.id === visual.id);
    if (change === 'missing') delete saved.initialTargetPoint;
    else if (change === 'nonfinite') saved.initialTargetPoint.x = null;
    else saved.initialTargetPoint.x = saved.origin.x + 5000;
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield)).toThrow();
  }
});
