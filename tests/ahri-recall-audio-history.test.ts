import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { MID_EMPOWERED_RECALL_TICKS } from '../src/content/role-quests';
import { RECALL_DURATION_TICKS } from '../src/content/rules';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { SNAPSHOT_VERSION } from '../src/simulation/snapshot';
function setup(hidden = false) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => !hidden,
    inBrush: () => false,
  });
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  enemy.ai = false;
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  return { w, ahri, enemy };
}
test('empowered Ahri Recall saves during the channel and preserves its actual completion and audio tail', () => {
  const nav = readFileSync('public/assets/maps/rift-nav.bin');
  const grid = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    nav.buffer.slice(nav.byteOffset, nav.byteOffset + nav.byteLength)
  );
  const rift = createRift(
    grid,
    JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
  );
  const w = createLaneMatch({ ...rift, publicRift: true }, 'ahri');
  for (const unit of w.units) unit.ai = false;
  const quest = w.player.roleQuest!;
  quest.progress = quest.target;
  quest.completedTick = w.tick;
  w.enqueue({ type: 'recall', unit: w.hero.id });
  w.step();
  const r = w.ahriRecallAudio[0];
  expect(r.completeTick).toBe(241);
  const copy = restore(w);
  copy.step(240);
  w.step(240);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(r.end).toEqual({ tick: 241, point: w.battlefield.spawns.blue, reason: 'complete' });
  restore(w);
  const oldSave = { ...JSON.parse(w.snapshot()), version: SNAPSHOT_VERSION - 1 };
  expect(() => World.fromSnapshot(JSON.stringify(oldSave), w.battlefield)).toThrow();
  w.step(340);
  expect(w.ahriRecallAudio).toEqual([]);
  restore(w);
});
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('every frame retains accepted channel, exact actual return and finite tail through restore', () => {
  const { w, ahri } = setup();
  const r = w.ahriRecallAudio[0];
  expect(r.id).toBe(w.events.find((e) => e.text === 'Recalling…')!.id);
  expect(r.audience).toEqual(['blue', 'red']);
  expect(r.completeTick).toBe(481);
  for (let i = 1; i <= 581; i++) {
    const copy = restore(w);
    if (w.tick === 481) {
      expect(r.end?.reason).toBe('complete');
      expect(ahri.x).toBe(w.battlefield.spawns.blue.x);
    }
    if (w.tick === 580) expect(w.ahriRecallAudio).toHaveLength(1);
    if (w.tick === 581) expect(w.ahriRecallAudio).toHaveLength(0);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('orders, damage, silence and stun close history immediately without delayed observation', () => {
  for (const kind of ['move', 'damage', 'silence', 'stun'] as const) {
    const { w, ahri, enemy } = setup();
    w.step(19);
    if (kind === 'move') w.setOrder(ahri, { type: 'move', point: { x: 100, y: 0 } });
    if (kind === 'damage') w.damage(enemy, ahri, 1, 'true');
    if (kind === 'silence') w.applySilence(ahri, 60);
    if (kind === 'stun') w.applyStun(ahri, 60);
    expect(w.ahriRecallAudio[0].end).toEqual({
      tick: 20,
      point: { x: 0, y: 0 },
      reason: 'cancelled',
    });
    restore(w);
    w.step(2);
    expect(w.ahriRecallAudio).toHaveLength(0);
  }
});
test('hidden birth stays private and zero health loss preserves the channel', () => {
  const { w, ahri, enemy } = setup(true);
  expect(w.ahriRecallAudio[0].audience).toEqual(['blue']);
  w.damage(enemy, ahri, 0, 'true');
  expect(w.ahriRecallAudio[0].end).toBeNull();
  restore(w);
});
test('same-tick restart reuses distinct existing message identities without merging channels', () => {
  const { w, ahri } = setup();
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(3);
  expect(w.ahriRecallAudio.map((r) => r.end?.reason ?? 'active')).toEqual([
    'cancelled',
    'cancelled',
    'active',
  ]);
  restore(w);
});
test('a move on the scheduled completion tick cancels Recall and survives restore', () => {
  const { w, ahri } = setup();
  w.step(RECALL_DURATION_TICKS - 1);
  w.enqueue({ type: 'order', unit: ahri.id, order: { type: 'move', point: { x: 100, y: 0 } } });
  w.step();
  expect(w.ahriRecallAudio[0].end).toMatchObject({ tick: 481, reason: 'cancelled' });
  restore(w);
});

test('empowered Ahri Recall restores during the channel and its completion tail, including schema 185 saves', () => {
  const raw = readFileSync('public/assets/maps/rift-nav.bin');
  const nav = new NavGrid(
    JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  );
  const battlefield = {
    ...createRift(nav, JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))),
    publicRift: true as const,
  };
  const w = createLaneMatch(battlefield, 'ahri');
  const quest = w.player.roleQuest!;
  w.player.roleQuest = { ...quest, progress: quest.target, completedTick: 0 };
  w.enqueue({ type: 'recall', unit: w.hero.id });
  w.step();
  const end = w.tick + MID_EMPOWERED_RECALL_TICKS;
  expect(w.player.recallEnd).toBe(end);
  expect(w.ahriRecallAudio[0].completeTick).toBe(end);

  const restoreLegacy = () => {
    const legacy = JSON.parse(w.snapshot());
    legacy.version = 185;
    legacy.ruleset = 'e5e3cc7f70fae406cd8bf03ba5a5a90fc7dc87ab2e931ad190b5fe099897cad0';
    legacy.ahriRecallAudio[0].completeTick =
      legacy.ahriRecallAudio[0].startTick + RECALL_DURATION_TICKS;
    expect(World.fromSnapshot(JSON.stringify(legacy), battlefield).snapshot()).toBe(w.snapshot());
  };
  const copy = restore(w);
  restoreLegacy();
  w.step(MID_EMPOWERED_RECALL_TICKS);
  copy.step(MID_EMPOWERED_RECALL_TICKS);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(w.ahriRecallAudio[0].end).toMatchObject({ tick: end, reason: 'complete' });
  restore(w);
  restoreLegacy();
});
test('strict restore rejects forged ownership, clocks, audiences and completion position', () => {
  const { w } = setup();
  const mutations = [
    (r: any) => (r.id = 1),
    (r: any) => r.completeTick++,
    (r: any) => (r.audience = ['red']),
    (r: any) => r.origin.x++,
    (r: any) => (r.end = { tick: 1, point: { x: 0, y: 0 }, reason: 'complete' }),
  ];
  for (const mutate of mutations) {
    const saved = JSON.parse(w.snapshot());
    mutate(saved.ahriRecallAudio[0]);
    expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
  }
  w.step(480);
  const saved = JSON.parse(w.snapshot());
  saved.ahriRecallAudio[0].end.point.x++;
  expect(() => World.fromSnapshot(JSON.stringify(saved), w.battlefield)).toThrow();
});
test('victory closes active channels and preserves completed tails without advancing the World', () => {
  for (const completed of [false, true]) {
    const { w } = setup();
    if (completed) w.step(480);
    const r = w.ahriRecallAudio[0];
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    expect(r.end?.reason).toBe(completed ? 'complete' : 'match-end');
    restore(w);
    const saved = w.snapshot();
    w.step(1000);
    expect(w.snapshot()).toBe(saved);
  }
});
test('lethal damage closes the channel alongside real lifecycle death and dead commands add no audio', () => {
  const { w, ahri, enemy } = setup();
  w.damage(enemy, ahri, 1e6, 'true');
  expect(w.ahriRecallAudio[0].end?.reason).toBe('cancelled');
  expect(w.ahriLifecycleAudio).toHaveLength(1);
  restore(w);
  w.enqueue({ type: 'recall', unit: ahri.id });
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(1);
  w.step();
  expect(w.ahriRecallAudio).toHaveLength(0);
  restore(w);
});
