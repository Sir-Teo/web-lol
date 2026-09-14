import { expect, it } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_IMPACT_HISTORY_TICKS } from '../src/content/lux-impact-presentation';
function launch(critical = false) {
  const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 500, y: 500 }, 'lux');
  const target = w.spawn('dummy', 'red', { x: 1000, y: 500 });
  target.hp = target.maxHp = 10000;
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
    expect(v.frames).toEqual([{ tick: w.tick, x: target.x, y: target.y }]);
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
    const point = { x: target.x, y: target.y };
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
