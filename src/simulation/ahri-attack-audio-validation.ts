import { AHRI_COMBAT_POLICY } from '../content/ahri-combat-policy';
import { AHRI } from '../content/ahri-progression';
import { ahriAttackAudioExpiry, type AhriAttackAudioRecord } from './ahri-attack-audio';
import { distance, type Vec2 } from './math';
import type { Team, Unit, Projectile } from './types';
export function validateAhriAttackAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  projectiles: Projectile[];
  ahriAttackAudio?: AhriAttackAudioRecord[];
  ahriOrbs: { id: number }[];
  ahriFoxFires: { id: number }[];
  ahriRushes: { id: number }[];
  ahriEssences: { id: number }[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri attack audio history.');
  };
  const eq = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const records = state.ahriAttackAudio ?? [],
    keys = new Set<string>(),
    ids = new Set<number>();
  const foreign = [
    ...state.units,
    ...state.ahriOrbs,
    ...state.ahriFoxFires,
    ...state.ahriRushes,
    ...state.ahriEssences,
  ];
  let previousTick = -1;
  for (const r of records) {
    const source = state.units.find((u) => u.id === r.sourceId),
      key = `${r.sourceId}:${r.startTick}`;
    if (
      keys.has(key) ||
      source?.champion !== 'ahri' ||
      source.team !== r.team ||
      r.targetId >= state.nextId ||
      r.targetId === r.sourceId ||
      state.units.some((u) => u.id === r.targetId && u.team === r.team) ||
      [
        ...state.projectiles,
        ...state.ahriOrbs,
        ...state.ahriFoxFires,
        ...state.ahriRushes,
        ...state.ahriEssences,
      ].some((n) => n.id === r.targetId) ||
      r.startTick < 1 ||
      r.startTick > state.tick ||
      r.startTick < previousTick ||
      r.releaseTick <= r.startTick ||
      r.releaseTick > r.startTick + AHRI_COMBAT_POLICY.ordinaryWindupTicks ||
      state.tick >= ahriAttackAudioExpiry(r) ||
      (r.launch && r.cancel)
    )
      fail();
    keys.add(key);
    previousTick = r.startTick;
    for (const a of [r.audience, r.launch?.audience, r.launch?.end?.audience])
      if (
        a &&
        (!a.includes(r.team) ||
          new Set(a).size !== a.length ||
          a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join())
      )
        fail();
    if (
      r.cancel &&
      (r.cancel.tick < r.startTick ||
        r.cancel.tick > Math.min(state.tick, r.releaseTick) ||
        (r.cancel.reason === 'death' && source?.deadAt !== r.cancel.tick) ||
        (r.cancel.reason === 'match-end' && (!state.winner || r.cancel.tick !== state.tick)))
    )
      fail();
    if (
      !r.launch &&
      !r.cancel &&
      (state.winner ||
        state.tick >= r.releaseTick ||
        source!.hp <= 0 ||
        source!.releaseTick !== r.releaseTick ||
        source!.attackTarget !== r.targetId ||
        source!.attackCycle?.startTick !== r.startTick ||
        !!source!.attackCycle?.critical !== r.critical)
    )
      fail();
    const launch = r.launch;
    if (!launch) continue;
    const p = state.projectiles.find((p) => p.id === launch.id),
      at = launch.end?.tick ?? state.tick;
    if (
      ids.has(launch.id) ||
      launch.id >= state.nextId ||
      foreign.some((n) => n.id === launch.id) ||
      launch.id === r.targetId ||
      launch.tick !== r.releaseTick ||
      launch.tick > state.tick ||
      at < launch.tick ||
      at > state.tick ||
      at - launch.tick + 1 > Math.ceil((4000 * 60) / AHRI.missileSpeed) ||
      distance(launch.origin, launch.currentPoint) >
        Math.min(4000, ((at - launch.tick + 1) * AHRI.missileSpeed) / 60) + 1e-6 ||
      (!launch.end && (!p || state.winner)) ||
      (launch.end && p)
    )
      fail();
    ids.add(launch.id);
    if (
      p &&
      (p.type !== 'attack' ||
        p.source !== r.sourceId ||
        p.target !== r.targetId ||
        p.team !== r.team ||
        !!p.critical !== r.critical ||
        p.launchTick !== launch.tick ||
        !p.origin ||
        !eq(p.origin, launch.origin) ||
        !eq(p, launch.currentPoint) ||
        p.speed !== AHRI.missileSpeed ||
        Math.abs(p.remaining - (4000 - ((state.tick - launch.tick + 1) * AHRI.missileSpeed) / 60)) >
          1e-6)
    )
      fail();
    if (
      launch.end &&
      (!eq(launch.currentPoint, launch.end.point) ||
        (launch.end.reason === 'range' &&
          launch.end.tick - launch.tick + 1 !== Math.ceil((4000 * 60) / AHRI.missileSpeed)) ||
        (launch.end.reason === 'match-end' && (!state.winner || launch.end.tick !== state.tick)))
    )
      fail();
  }
  for (const u of state.units)
    if (
      u.champion === 'ahri' &&
      u.releaseTick !== null &&
      !records.some(
        (r) =>
          r.sourceId === u.id && r.startTick === u.attackCycle?.startTick && !r.cancel && !r.launch
      )
    )
      fail();
  for (const p of state.projectiles)
    if (
      p.type === 'attack' &&
      state.units.some((u) => u.id === p.source && u.champion === 'ahri') &&
      !ids.has(p.id)
    )
      fail();
}
