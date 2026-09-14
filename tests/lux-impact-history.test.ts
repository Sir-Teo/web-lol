import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_IMPACT_HISTORY_TICKS } from '../src/content/lux-impact-presentation';
function launch(critical = false, kind: 'dummy' | 'champion' | 'melee' = 'dummy') {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    findPath: (_from, to) => [{ ...to }],
  });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 500, y: 500 }, 'lux');
  const target = w.spawn(kind, 'red', { x: 1000, y: 500 });
  target.hp = target.maxHp = 10000;
  target.ai = false;
  w.setOrder(lux, { type: 'attack', target: target.id });
  for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
  w.setOrder(lux, { type: 'idle' });
  if (critical) w.projectiles[0].critical = true;
  return { w, lux, target };
}
function hit(critical = false) {
  const setup = launch(critical);
  while (setup.w.projectiles.length) setup.w.step();
  expect(setup.w.luxImpactVisuals).toHaveLength(1);
  return setup;
}
it('records actual contacts with normal/critical identity and resumes target motion after saves', () => {
  for (const critical of [false, true]) {
    const { w, target, lux } = hit(critical),
      v = w.luxImpactVisuals[0];
    expect(v).toMatchObject({
      sourceId: lux.id,
      targetId: target.id,
      critical,
      startTick: w.tick,
      detachedTick: null,
    });
    expect(v.frames).toEqual([
      { tick: w.tick, x: target.x, y: target.y, facing: target.facing, animationTimeline: null },
    ]);
    expect(w.luxAttackVisuals[0].stopTick).toBe(v.startTick);
    const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
    for (let i = 0; i < LUX_IMPACT_HISTORY_TICKS; i++) {
      target.x += 3;
      restored.unit(target.id)!.x += 3;
      w.step();
      restored.step();
      expect(restored.snapshot()).toBe(w.snapshot());
      if (i < LUX_IMPACT_HISTORY_TICKS - 1)
        expect(w.luxImpactVisuals[0].frames.at(-1)!.x).toBe(target.x);
    }
    expect(w.luxImpactVisuals).toEqual([]);
  }
});
it('does not invent impact when the flight loses a target; freezes after death or removal', () => {
  const lost = launch();
  lost.target.hp = 0;
  lost.w.step();
  expect(lost.w.luxImpactVisuals).toEqual([]);
  for (const remove of [false, true]) {
    const { w, target } = hit();
    const point = { x: target.x, y: target.y, facing: target.facing, animationTimeline: null };
    if (remove) w.units = w.units.filter((u) => u.id !== target.id);
    else target.hp = 0;
    w.step();
    expect(w.luxImpactVisuals[0].detachedTick).toBe(w.tick);
    if (!remove) {
      target.hp = 100;
      target.x += 1000;
    }
    w.step();
    expect(w.luxImpactVisuals[0].frames.at(-1)).toEqual({ tick: w.tick, ...point });
    expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  }
});
it('retains a lethal impact and rejects inconsistent, duplicated or gapped saved histories', () => {
  const { w, target } = launch(true);
  target.hp = 1;
  while (w.projectiles.length) w.step();
  expect(w.luxImpactVisuals[0].detachedTick).toBe(w.tick);
  w.step(2);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  const text = w.snapshot();
  const mutations = [
    (s: any) => s.luxImpactVisuals.push(s.luxImpactVisuals[0]),
    (s: any) => s.luxImpactVisuals[0].frames[1].tick++,
    (s: any) => s.luxImpactVisuals[0].frames[1].x++,
    (s: any) => (s.luxImpactVisuals[0].sourceId = target.id),
    (s: any) => s.luxImpactVisuals[0].startTick++,
    (s: any) => (s.luxImpactVisuals[0].detachedTick = s.tick + 1),
    (s: any) => (s.luxImpactVisuals[0].critical = 'true'),
    (s: any) => (s.luxImpactVisuals[0].id = s.nextId),
  ];
  for (const mutate of mutations) {
    const s = JSON.parse(text);
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});
it('captures independent mobile poses after movement and recall, then freezes the full detached pose', () => {
  const { w, target, lux } = launch(false, 'champion');
  while (w.projectiles.length) w.step();
  const effect = w.luxImpactVisuals[0];
  expect(effect.targetRig).toBe('ashe-base');
  const first = effect.frames[0];
  expect(first.animationTimeline).toEqual(target.animationTimeline);
  expect(first.animationTimeline).not.toBe(target.animationTimeline);
  const initial = structuredClone(first);
  w.setOrder(target, { type: 'move', point: { x: target.x + 1000, y: target.y + 500 } });
  w.step(3);
  expect(effect.frames.at(-1)).toMatchObject({
    facing: target.facing,
    animationTimeline: target.animationTimeline,
  });
  expect(effect.frames.at(-1)!.animationTimeline!.primary.kind).toBe('run');
  expect(first).toEqual(initial);
  const restored = World.fromSnapshot(w.snapshot(), w.battlefield);
  w.step();
  restored.step();
  expect(restored.snapshot()).toBe(w.snapshot());
  w.setOrder(target, { type: 'idle' });
  w.championState(target.id)!.recallEnd = w.tick + 1;
  w.step();
  expect(effect.frames.at(-1)).toMatchObject(w.battlefield.spawns.red);
  expect(effect.frames.at(-1)!.animationTimeline).toEqual(target.animationTimeline);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  w.damage(lux, target, 100000, 'physical');
  w.step();
  const detached = structuredClone(effect.frames.at(-1)!);
  expect(detached.animationTimeline!.primary.kind).toBe('death');
  target.x += 100;
  target.facing += 1;
  w.step(2);
  expect(effect.frames.at(-1)).toEqual({ ...detached, tick: w.tick });
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
  for (const mutate of [
    (s: any) => (s.luxImpactVisuals[0].targetRig = 'absent'),
    (s: any) => (s.luxImpactVisuals[0].targetRig = null),
    (s: any) => (s.luxImpactVisuals[0].frames[0].animationTimeline.primary.clip = 'toString'),
    (s: any) => s.luxImpactVisuals[0].frames[0].animationTimeline.tick++,
    (s: any) => s.luxImpactVisuals[0].frames.at(-1).facing++,
    (s: any) => (s.luxImpactVisuals[0].frames.at(-1).animationTimeline.primary.time += 0.01),
  ]) {
    const s = JSON.parse(w.snapshot());
    mutate(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});

it('retains rig identity and the final mobile pose when the target disappears', () => {
  const { w, target } = launch(false, 'melee');
  while (w.projectiles.length) w.step();
  const effect = w.luxImpactVisuals[0];
  w.setOrder(target, { type: 'move', point: { x: target.x + 300, y: target.y } });
  w.step(2);
  const captured = structuredClone(effect.frames.at(-1)!);
  w.units = w.units.filter((u) => u.id !== target.id);
  w.step(2);
  expect(effect.targetRig).toBe('red-melee');
  expect(effect.detachedTick).toBe(captured.tick + 1);
  expect(effect.frames.at(-1)).toEqual({ ...captured, tick: w.tick });
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
