import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { championDeathTicks } from '../src/simulation/champion-death';
import { LEONA_DEATH_AUDIO_TICKS } from '../src/content/leona-death-audio-timing';
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    reachable: (p) => ({ ...p }),
    findPath: (_a, b) => [{ ...b }],
  });
  w.nextWaveTick = Infinity;
  const u = w.spawn('champion', 'red', { x: 150, y: 0 }, 'leona');
  for (const unit of w.units) unit.ai = false;
  const state = w.championState(u.id)!;
  return { w, u, state };
}
test('accepted Leona death retains its exact event clock, point and fixed audience without an extra gameplay identity', () => {
  const f = fixture();
  const id = f.w.nextId,
    events = f.w.events.length,
    rng = f.w.random.state;
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const event = f.w.events.find((e) => e.type === 'death' && e.unit === f.u.id)!;
  expect(f.w.nextId - id).toBe(f.w.events.length - events);
  expect(f.w.random.state).toBe(rng);
  expect(f.state.leonaDeathVisuals).toEqual([
    { startTick: event.tick, point: { x: event.x, y: event.y }, audience: event.audience },
  ]);
});
test('the saved death fact survives transient-event retirement and restores through the complete delayed tail', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  f.w.step(151);
  expect(f.w.events.some((e) => e.type === 'death' && e.unit === f.u.id)).toBe(false);
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  expect(copy.championState(f.u.id)!.leonaDeathVisuals).toHaveLength(1);
  f.w.step(LEONA_DEATH_AUDIO_TICKS - 151);
  copy.step(LEONA_DEATH_AUDIO_TICKS - 151);
  expect(f.state.leonaDeathVisuals).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('a visible birth copies its event audience and point without retaining mutable event references', () => {
  const f = fixture();
  Object.assign(f.w.hero, { x: -200, y: 0, previous: { x: -200, y: 0 } });
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const r = f.state.leonaDeathVisuals[0],
    event = f.w.events.find((e) => e.type === 'death' && e.unit === f.u.id)!;
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.audience).not.toBe(event.audience);
  event.audience.length = 0;
  event.x = 999;
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.point).toEqual({ x: 150, y: 0 });
  expect(
    World.fromSnapshot(f.w.snapshot(), f.w.battlefield).championState(f.u.id)!.leonaDeathVisuals
  ).toEqual([r]);
});

test('a hidden death keeps its birth audience through later corpse visibility and restore', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const r = f.state.leonaDeathVisuals[0];
  expect(r.audience).toEqual(['red']);
  Object.assign(f.w.hero, { x: 150, y: 500, previous: { x: 150, y: 500 } });
  f.w.step(2);
  expect(f.w.visible(f.u, 'blue')).toBe(true);
  expect(r.audience).toEqual(['red']);
  expect(
    World.fromSnapshot(f.w.snapshot(), f.w.battlefield).championState(f.u.id)!.leonaDeathVisuals
  ).toEqual([r]);
});

test('nonlethal damage, transient lookalikes and repeated damage against a corpse do not invent accepted deaths', () => {
  const f = fixture();
  f.w.emit('death', f.u, { unit: f.u.id });
  expect(f.state.leonaDeathVisuals).toEqual([]);
  f.w.damage(f.w.hero, f.u, 1, 'physical');
  expect(f.state.leonaDeathVisuals).toEqual([]);
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const saved = f.w.snapshot(),
    id = f.w.nextId;
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  expect(f.state.leonaDeathVisuals).toHaveLength(1);
  expect(f.w.nextId).toBe(id);
  expect(f.w.snapshot()).toBe(saved);
});

test('the victim identity controls death history and other champion states remain empty', () => {
  const f = fixture();
  f.w.damage(f.u, f.w.hero, 1e9, 'true');
  expect(f.state.leonaDeathVisuals).toEqual([]);
  expect(f.w.player.leonaDeathVisuals).toEqual([]);
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('retirement precedes every minimum respawn and a later accepted death gets a new clock and point', () => {
  for (let level = 1; level <= 18; level++)
    expect(championDeathTicks(level, 0)).toBeGreaterThan(LEONA_DEATH_AUDIO_TICKS);
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const first = structuredClone(f.state.leonaDeathVisuals[0]),
    respawn = f.u.respawnTick!;
  f.w.step(LEONA_DEATH_AUDIO_TICKS - 1);
  expect(f.state.leonaDeathVisuals).toEqual([first]);
  f.w.step();
  expect(f.state.leonaDeathVisuals).toEqual([]);
  f.w.step(respawn - f.w.tick);
  expect(f.u.hp).toBeGreaterThan(0);
  expect(f.u.deadAt).toBeNull();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  expect(f.state.leonaDeathVisuals).toHaveLength(1);
  expect(f.state.leonaDeathVisuals[0].startTick).toBe(respawn);
  expect(f.state.leonaDeathVisuals[0].point).toEqual({ x: f.u.x, y: f.u.y });
  expect(() => World.fromSnapshot(f.w.snapshot(), f.w.battlefield)).not.toThrow();
});

test('terminal gameplay retains the accepted death fact unchanged for later finite audio-clock draining', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const inhibitor = f.w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
  f.w.damage(f.w.hero, inhibitor, 1e9, 'true');
  const nexus = f.w.spawn('nexus', 'red', { x: 2500, y: 2500 });
  f.w.damage(f.w.hero, nexus, 1e9, 'true');
  expect(f.w.winner).toBe('blue');
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield);
  f.w.step(600);
  copy.step(600);
  expect(f.w.snapshot()).toBe(saved);
  expect(copy.snapshot()).toBe(saved);
  expect(f.state.leonaDeathVisuals).toHaveLength(1);
});

test('strict schema129 rejects missing, duplicated, future, contradictory and foreign death facts', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  f.w.step(2);
  const forge = (change: (s: any, owner: any, r: any) => void) => {
    const s = JSON.parse(f.w.snapshot()),
      owner = s.otherChampions.find((o: any) => o.id === f.u.id),
      r = owner.leonaDeathVisuals[0];
    change(s, owner, r);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((s) => (s.version = 128));
  forge((_s, o) => delete o.leonaDeathVisuals);
  forge((_s, o) => (o.leonaDeathVisuals = []));
  forge((_s, o, r) => o.leonaDeathVisuals.push(structuredClone(r)));
  forge((s, _o, r) => (r.startTick = s.tick + 1));
  forge((_s, _o, r) => r.startTick++);
  forge((_s, _o, r) => r.point.x++);
  forge((_s, _o, r) => (r.audience = []));
  forge((_s, _o, r) => (r.audience = ['red', 'red']));
  forge((_s, _o, r) => (r.audience = ['blue']));
  forge((_s, _o, r) => (r.audience = ['red', 'blue']));
  forge((_s, _o, r) => (r.sourceId = f.u.id));
  forge((s, _o, r) => (s.player.leonaDeathVisuals = [structuredClone(r)]));
  forge((s) => (s.units.find((u: any) => u.id === f.u.id).deadAt = null));
  forge((s) => (s.units.find((u: any) => u.id === f.u.id).hp = 1));
  forge((s) => (s.units.find((u: any) => u.id === f.u.id).respawnTick = null));
});

test('an expired captured fact cannot be reintroduced after its finite horizon', () => {
  const f = fixture();
  f.w.damage(f.w.hero, f.u, 1e9, 'true');
  const old = structuredClone(f.state.leonaDeathVisuals[0]);
  f.w.step(LEONA_DEATH_AUDIO_TICKS);
  const s = JSON.parse(f.w.snapshot());
  s.otherChampions.find((o: any) => o.id === f.u.id).leonaDeathVisuals = [old];
  expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow(
    /death|source history/i
  );
});
