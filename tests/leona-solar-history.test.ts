import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import timing from '../src/content/leona-r-history-bounds.json';
import { solarVisualExpiry } from '../src/simulation/leona-r-visuals';
import { samePose } from '../src/simulation/pose-history';

function fixture() {
  const world = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  world.nextWaveTick = Infinity;
  world.hero.x = world.hero.y = -3000;
  const source = world.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona'),
    state = world.championState(source.id)!;
  world.gainExperience(2400, source.id);
  world.learnSpell('r', source.id);
  const cast = (point = { x: 500, y: 0 }) => {
    world.enqueue({ type: 'cast', unit: source.id, ability: 'r', point });
    world.step();
  };
  const target = (x = 500, y = 0) => {
    const u = world.spawn('dummy', 'red', { x, y });
    u.magicResist = 0;
    return u;
  };
  const restore = () => World.fromSnapshot(world.snapshot(), world.battlefield);
  return { world, source, state, cast, target, restore };
}
test('source-pinned retention covers all 44 enabled records, probability extremes and authored linger', () => {
  const bytes = readFileSync('docs/reference/leona-r-particles.json'),
    pin = JSON.parse(bytes.toString());
  expect(timing.sourcePinSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(timing.records).toHaveLength(44);
  expect(
    Object.values(pin.resources)
      .flatMap((r: any) => r.definition.complexEmitterDefinitionData)
      .filter((e: any) => !e.disabled)
  ).toHaveLength(44);
  expect(timing.bounds).toEqual({
    buff: 722,
    cast: 698,
    contact: 132,
    area: 704,
    impact: 884,
    history: 884,
    sourceWindow: 885,
  });
  expect(timing.records.find((r) => r.name === 'Bokeh')?.particleLifeUpper).toBe(3);
  expect(timing.records.find((r) => r.name === 'CenterDarkCore')?.particleLifeUpper).toBe(1);
  expect(timing.records.every((r) => r.historyTicks <= timing.bounds.history)).toBe(true);
});
test('accepted, released and impact phases survive exact restored futures after live R retires', () => {
  const f = fixture();
  const target = f.target();
  f.cast();
  expect(f.state.leonaRVisuals[0]).toMatchObject({
    startTick: 1,
    rank: 1,
    point: { x: 500, y: 0 },
    release: null,
    endTick: null,
    impact: null,
  });
  for (const tick of [1, 15, 16, 38, 39, 54, 170]) {
    f.world.step(tick - f.world.tick);
    const copy = f.restore();
    f.world.step();
    copy.step();
    expect(copy.snapshot()).toBe(f.world.snapshot());
  }
  const r = f.state.leonaRVisuals[0];
  expect(r.release?.tick).toBe(16);
  expect(r.endTick).toBe(39);
  expect(r.endReason).toBe('impact');
  expect(r.impact?.contacts.map((c) => c.targetId)).toEqual([target.id]);
  expect(r.impact?.contacts[0].frames).toHaveLength(timing.bounds.contact);
  expect(f.state.leonaR).toBeNull();
});
test('contact anchors precede lethal damage and same-tick Flash, with stable identity order', () => {
  const f = fixture(),
    dead = f.target(),
    flasher = f.world.spawn('champion', 'red', { x: 750, y: 0 }, 'lux');
  dead.hp = 1;
  f.cast();
  f.world.step(37);
  f.world.units.reverse();
  f.world.enqueue({ type: 'cast', unit: flasher.id, ability: 'd', point: { x: 1150, y: 0 } });
  f.world.step();
  const contacts = f.state.leonaRVisuals[0].impact!.contacts;
  expect(contacts.map((c) => c.targetId)).toEqual([dead.id, flasher.id]);
  expect(contacts[0]).toMatchObject({ point: { x: 500, y: 0 }, center: true, detachedTick: 39 });
  expect(contacts[1]).toMatchObject({ point: { x: 750, y: 0 }, center: false, detachedTick: null });
  expect(contacts[1].frames[0].x).toBe(1150);
  const frozen = structuredClone(contacts[0].frames[0]);
  f.world.step(20);
  expect(samePose(contacts[0].frames.at(-1)!, frozen)).toBe(true);
  expect(() => f.restore()).not.toThrow();
});
test('death cancellation and released posthumous impact retain distinct phases through respawn', () => {
  for (const released of [false, true]) {
    const f = fixture(),
      target = f.target();
    f.cast();
    if (released) f.world.step(15);
    f.world.damage(target, f.source, 1e6, 'true');
    const r = f.state.leonaRVisuals[0];
    expect(r.death?.tick).toBe(f.world.tick);
    expect(r.endReason).toBe(released ? null : 'death');
    const copy = f.restore();
    f.world.step(39 - f.world.tick);
    copy.step(39 - copy.tick);
    expect(copy.snapshot()).toBe(f.world.snapshot());
    expect(r.impact !== null).toBe(released);
    const freeze = structuredClone(r.death!.frame),
      respawn = r.death!.respawnTick;
    f.world.step(respawn - f.world.tick + 1);
    expect(f.source.hp).toBeGreaterThan(0);
    expect(samePose(r.frames.at(-1)!, freeze)).toBe(true);
    expect(() => f.restore()).not.toThrow();
  }
});
test('caster Flash changes release placement while the accepted area point stays fixed', () => {
  const f = fixture();
  f.cast();
  f.world.enqueue({ type: 'cast', unit: f.source.id, ability: 'd', point: { x: 0, y: 400 } });
  f.world.step(15);
  const r = f.state.leonaRVisuals[0];
  expect(r.castFrame).toMatchObject({ x: 0, y: 0 });
  expect(r.release).toMatchObject({ tick: 16, x: 0, y: 400 });
  expect(r.point).toEqual({ x: 500, y: 0 });
  expect(() => f.restore()).not.toThrow();
});
test('area visibility is saved independently of owner sight without granting area vision', () => {
  const f = fixture();
  f.world.battlefield.lineOfSight = () => false;
  f.cast();
  const r = f.state.leonaRVisuals[0];
  expect(r.castFrame.audience).toContain('blue');
  expect(r.areaAudience).toEqual([]);
  expect(r.frames[0].audience).toContain('blue');
  expect(r.frames[0].areaAudience).toEqual([]);
  f.world.battlefield.lineOfSight = () => true;
  f.world.step(38);
  expect(r.frames.at(-1)!.areaAudience).toContain('blue');
  expect(r.impact!.audience).toContain('blue');
  expect(r.areaAudience).toEqual([]);
  expect(f.world.visionAreas).toEqual([]);
  expect(() => f.restore()).not.toThrow();
});
test('rolling source frames and complete event anchors expire exactly at the conservative boundary', () => {
  const f = fixture();
  f.cast();
  f.world.step(38);
  const r = f.state.leonaRVisuals[0],
    end = solarVisualExpiry(r);
  f.state.cooldowns.r = 0;
  f.cast({ x: 0, y: 0 });
  f.world.step(38);
  expect(f.state.leonaRVisuals).toHaveLength(2);
  f.world.step(end - f.world.tick - 1);
  expect(f.state.leonaRVisuals).toHaveLength(2);
  expect(r.frames).toHaveLength(timing.bounds.sourceWindow);
  expect(r.castFrame.tick).toBe(1);
  expect(r.release?.tick).toBe(16);
  const copy = f.restore();
  f.world.step();
  copy.step();
  expect(copy.snapshot()).toBe(f.world.snapshot());
  expect(f.state.leonaRVisuals).toHaveLength(1);
});
test('terminal cancellation freezes accepted phase history and never creates a delayed impact', () => {
  for (const released of [false, true]) {
    const f = fixture();
    f.cast();
    if (released) f.world.step(15);
    const nexus = f.world.spawn('nexus', 'red', { x: 2000, y: 0 });
    f.world.damage(f.source, nexus, 1e6, 'true');
    const r = f.state.leonaRVisuals[0];
    expect(r.endReason).toBe('match-end');
    expect(r.impact).toBeNull();
    expect(r.release !== null).toBe(released);
    expect(() => f.restore()).not.toThrow();
    const saved = f.world.snapshot();
    f.world.step(1000);
    expect(f.world.snapshot()).toBe(saved);
  }
});
test('strict saves reject missing/foreign histories, forged phases, gaps and impossible impact participants', () => {
  const f = fixture();
  f.target();
  f.target(800);
  f.cast();
  const forge = (change: (s: any, o: any, r: any) => void) => {
    const s = JSON.parse(f.world.snapshot()),
      o = s.otherChampions.find((p: any) => p.id === f.source.id);
    change(s, o, o.leonaRVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.world.battlefield)).toThrow();
  };
  forge((_s, o) => (o.leonaRVisuals = []));
  forge((s, o) => {
    s.player.leonaRVisuals = o.leonaRVisuals;
    o.leonaRVisuals = [];
  });
  forge((_s, _o, r) => (r.endReason = 'impact'));
  forge((_s, _o, r) => r.castFrame.tick++);
  forge((_s, _o, r) => (r.point.x = 1201));
  forge((_s, _o, r) => r.frames[0].tick++);
  forge((_s, _o, r) => (r.frames[0].areaAudience = ['blue', 'blue']));
  f.world.step(38);
  forge((_s, _o, r) => r.release.tick++);
  forge((_s, _o, r) => r.endTick++);
  forge((_s, _o, r) => r.impact.contacts.reverse());
  forge((_s, _o, r) => (r.impact.contacts[0].center = false));
  forge((_s, _o, r) => (r.impact.contacts[0].point.x = 1000));
  forge((_s, _o, r) => (r.impact.contacts[0].targetRig = 'leona-base'));
  forge((_s, _o, r) => r.impact.contacts[0].frames[0].x++);
  forge((_s, _o, r) => (r.impact = null));
  expect(() => f.restore()).not.toThrow();
});
