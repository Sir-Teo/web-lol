import { expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  jungleDecision,
  jungleRoute,
  assignRole,
  type JungleBotState,
} from '../src/simulation/bot-jungle';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createLaneMatch } from '../src/simulation/lane-match';
import { createRift } from '../src/content/rift';
import { NavGrid } from '../src/simulation/navgrid';
import { World } from '../src/simulation/world';
import { MATCH_ROLES } from '../src/content/bot-roles';
import type { RiftCampId } from '../src/content/rift-camps';
const metadata = JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8'));
const bytes = readFileSync('public/assets/maps/rift-nav.bin');
const rift = createRift(
  new NavGrid(metadata, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
function fresh(): JungleBotState {
  return { camp: null, cursor: 0, quietSince: 0, observations: [] };
}
test('empty-camp memory requires actual sight and a quiet split window; hidden state is not a planner input', () => {
  for (const team of ['blue', 'red'] as const) {
    const route = jungleRoute(team),
      camp = route[0],
      state = fresh();
    const seen = {
      tick: camp.firstReadyTick,
      team,
      actor: camp.point,
      monsters: [],
      visibleHomes: new Set<RiftCampId>(),
    };
    expect(jungleDecision(state, seen).type).toBe('wait');
    expect(state.camp).toBe(camp.id);
    jungleDecision(state, { ...seen, tick: seen.tick + 600 });
    expect(state.observations).toEqual([]);
    jungleDecision(state, {
      ...seen,
      tick: seen.tick + 601,
      visibleHomes: new Set([camp.id as RiftCampId]),
    });
    expect(state.camp).toBeNull();
    expect(state.cursor).toBe(1);
    expect(state.observations).toEqual([
      { camp: camp.id, seenTick: seen.tick + 601, retryTick: seen.tick + 2401 },
    ]);
    expect(jungleDecision(state, { ...seen, tick: seen.tick + 602 }).type).toBe('move');
    expect(state.camp).toBe(route[1].id);
  }
});
test('jungle targets require observed targetability, protect delayed children and approach inside the camp leash before attacking', () => {
  const state = fresh(),
    camp = jungleRoute('blue')[0];
  const observed = {
    tick: 6000,
    team: 'blue' as const,
    actor: { x: camp.point.x + 900, y: camp.point.y },
    monsters: [
      {
        id: 100,
        camp: camp.id as RiftCampId,
        ...camp.point,
        targetable: true,
        lineOfSightToActor: true,
      },
    ],
    visibleHomes: new Set<RiftCampId>([camp.id as RiftCampId]),
  };
  expect(jungleDecision(state, observed)).toEqual({ type: 'move', point: camp.point });
  expect(jungleDecision(state, { ...observed, tick: 6018, actor: camp.point })).toEqual({
    type: 'attack',
    target: 100,
  });
  expect(
    jungleDecision(state, {
      ...observed,
      tick: 6036,
      actor: camp.point,
      monsters: [{ ...observed.monsters[0], targetable: false }],
    })
  ).toEqual({ type: 'wait' });
  jungleDecision(state, { ...observed, tick: 6140, actor: camp.point, monsters: [] });
  expect(state.camp).toBe(camp.id);
  jungleDecision(state, { ...observed, tick: 6156, actor: camp.point, monsters: [] });
  expect(state.camp).toBeNull();
});
test('five positions include funded Smite companions and keep player input and opposite-side assignments independent', () => {
  for (const champion of ['ashe', 'lux'] as const) {
    const w = createLaneMatch(rift, champion);
    for (const team of ['blue', 'red'] as const) {
      const roster = w.units.filter((u) => u.kind === 'champion' && u.team === team);
      expect(roster.map((u) => w.championState(u.id)!.role).sort()).toEqual(
        [...MATCH_ROLES].sort()
      );
      const jungle = roster.find((u) => w.championState(u.id)!.role === 'jungle')!,
        s = w.championState(jungle.id)!;
      expect(jungle.lane).toBeNull();
      expect(jungle.ai).toBe(true);
      expect(s.summoners).toEqual({ d: 'smite', f: 'flash' });
      expect(s.gold).toBe(50);
      expect(s.inventory).toEqual(['mosstomper']);
      expect(w.companions.find((p) => p.ownerId === jungle.id)?.acquisition.kind).toBe('purchase');
    }
    expect(w.hero.ai).toBe(false);
    expect(w.player.role).toBe(champion === 'lux' ? 'mid' : 'carry');
    expect(w.player.gold).toBe(500);
    expect(World.fromSnapshot(w.snapshot(), rift).snapshot()).toBe(w.snapshot());
  }
});
test('both jungle bots clear real Rift camps, feed purchased companions and resume a live route exactly after a save', () => {
  const w = createLaneMatch(rift);
  w.nextWaveTick = 1e9;
  for (const u of w.units)
    if (u.kind === 'champion' && w.championState(u.id)!.role !== 'jungle') u.ai = false;
  w.step(24000);
  const summaries = w.units
    .filter((u) => u.kind === 'champion' && w.championState(u.id)!.role === 'jungle')
    .map((u) => {
      const s = w.championState(u.id)!;
      return {
        team: u.team,
        hp: u.hp,
        level: s.level,
        cs: s.cs,
        deaths: s.deaths,
        position: { x: u.x, y: u.y },
        order: u.order,
        jungle: s.jungle,
        pet: w.companions.find((p) => p.ownerId === u.id)?.fed,
      };
    });
  writeFileSync('.cache/jungle-clear-probe.json', JSON.stringify(summaries, null, 2) + '\n');
  for (const s of summaries) {
    expect(s.cs).toBeGreaterThanOrEqual(24);
    expect(s.level).toBeGreaterThanOrEqual(4);
    expect(s.pet).toBeGreaterThanOrEqual(6);
    expect(s.jungle!.observations).toHaveLength(6);
    expect(s.deaths).toBe(0);
  }
  const copy = World.fromSnapshot(w.snapshot(), rift);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
}, 60000);
test('saved assignments reject missing, duplicate, enemy-side or future camp memory', () => {
  const w = createLaneMatch(rift),
    base = JSON.parse(w.snapshot());
  const jungle = base.otherChampions.find((s: any) => s.role === 'jungle');
  for (const mutate of [
    (s: any) => delete s.role,
    (s: any) => (s.role = 'top'),
    (s: any) => (s.jungle = null),
    (s: any) => (s.jungle.quietSince = 1),
    (s: any) => (s.jungle.camp = 'chaos-blue'),
    (s: any) => (s.jungle.observations = [{ camp: 'order-blue', seenTick: 1, retryTick: 1801 }]),
  ]) {
    const bad = structuredClone(base),
      state = bad.otherChampions.find((s: any) => s.id === jungle.id);
    mutate(state);
    expect(() => World.fromSnapshot(JSON.stringify(bad), rift)).toThrow();
  }
});

test('a support leaves nearby carry farm available but can farm alone', () => {
  for (const nearby of [true, false]) {
    const w = new World(false, { ...PRACTICE_FIXTURE, initialUnits: [], lineOfSight: () => true });
    w.nextWaveTick = 1e9;
    w.hero.x = nearby ? 0 : -5000;
    w.hero.y = 0;
    assignRole(w.player, 'carry');
    const support = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    support.ai = true;
    const state = w.championState(support.id)!;
    assignRole(state, 'support');
    state.trinket.charges = 0;
    const minion = w.spawn('melee', 'red', { x: 250, y: 0 });
    minion.ai = false;
    minion.hp = 5;
    w.step(2);
    expect(support.order.type === 'attack' && support.order.target === minion.id).toBe(!nearby);
  }
});
test('support brush wards spend existing trinket stock and do not repeatedly issue placements', () => {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    spawns: { blue: { x: -6000, y: 0 }, red: { x: 6000, y: 0 } },
    inBrush: () => true,
    lineOfSight: () => true,
  });
  w.nextWaveTick = 1e9;
  w.hero.x = -6000;
  const support = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  support.ai = true;
  const state = w.championState(support.id)!;
  assignRole(state, 'support');
  const stock = state.trinket.charges;
  w.step(180);
  expect(w.units.filter((u) => u.kind === 'ward' && u.ward?.ownerId === support.id)).toHaveLength(
    1
  );
  expect(state.trinket.charges).toBe(stock - 1);
  expect(w.commands.filter((c) => c.type === 'ward')).toEqual([]);
});

test('unseen monster health and actual respawn clocks cannot alter a jungle scouting decision', () => {
  const a = createLaneMatch(rift);
  a.nextWaveTick = 1e9;
  for (const u of a.units) if (u.kind === 'champion') u.ai = false;
  a.step(4200);
  const b = World.fromSnapshot(a.snapshot(), rift);
  const id = a.units.find(
    (u) => u.kind === 'champion' && u.team === 'blue' && a.championState(u.id)!.role === 'jungle'
  )!.id;
  const actor = a.unit(id)!;
  const hidden = a.units.filter((u) => u.kind === 'monster' && !a.visible(u, actor.team));
  expect(hidden.length).toBeGreaterThan(0);
  for (const monster of hidden) b.unit(monster.id)!.hp = 1;
  for (const camp of b.jungleCamps) camp.nextSpawnTick = 100000;
  for (const w of [a, b]) {
    w.unit(id)!.ai = true;
    w.unit(id)!.nextThink = w.tick + 1;
    w.step();
  }
  expect(b.unit(id)!.order).toEqual(a.unit(id)!.order);
  expect(b.championState(id)!.jungle).toEqual(a.championState(id)!.jungle);
});

for (const team of ['blue', 'red'] as const)
  test(`${team} approaches a visible camp instead of repeatedly attacking through a brush boundary`, () => {
    const state = fresh(),
      camp = jungleRoute(team)[0];
    const monster = {
      id: 100,
      camp: camp.id as RiftCampId,
      ...camp.point,
      targetable: true,
      lineOfSightToActor: false,
    };
    const observed = {
      tick: 6000,
      team,
      actor: { x: camp.point.x + 200, y: camp.point.y },
      monsters: [monster],
      visibleHomes: new Set<RiftCampId>([camp.id as RiftCampId]),
    };
    expect(jungleDecision(state, observed)).toEqual({ type: 'move', point: camp.point });
    expect(
      jungleDecision(state, {
        ...observed,
        tick: 6018,
        monsters: [{ ...monster, lineOfSightToActor: true }],
      })
    ).toEqual({ type: 'attack', target: monster.id });
    expect(
      jungleDecision(state, {
        ...observed,
        tick: 6036,
        monsters: [{ ...monster, targetable: false }],
      })
    ).toEqual({ type: 'wait' });
    expect(state.observations).toEqual([]);
    const hidden = fresh();
    expect(
      jungleDecision(hidden, {
        ...observed,
        monsters: [],
        visibleHomes: new Set<RiftCampId>(),
      })
    ).toEqual({ type: 'wait' });
    expect(hidden.observations).toEqual([]);
  });
