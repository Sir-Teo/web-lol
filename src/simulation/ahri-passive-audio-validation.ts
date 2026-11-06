import { AHRI_PASSIVE } from '../content/ahri-passive';
import { AHRI_PASSIVE_POLICY as P } from '../content/ahri-passive-policy';
import { acceleratingMotion } from './ahri-orb-motion';
import { distance, type Vec2 } from './math';
import { isLaneMinionKind, type Team, type Unit } from './types';
import type { AhriEssence } from './ahri-essences';
import { passiveAudioExpiry, type AhriPassiveAudioRecord } from './ahri-passive-audio';

export function validatePassiveAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  ahriEssences: AhriEssence[];
  ahriPassiveAudio?: AhriPassiveAudioRecord[];
  projectiles: { id: number }[];
  ahriOrbs: { id: number }[];
  ahriFoxFires: { id: number }[];
  ahriRushes: { id: number }[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri passive audio history.');
  };
  const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const records = state.ahriPassiveAudio ?? [],
    ids = new Set<number>();
  const foreign = [
    ...state.units,
    ...state.projectiles,
    ...state.ahriOrbs,
    ...state.ahriFoxFires,
    ...state.ahriRushes,
  ];
  let previousTick = -1;
  for (const r of records) {
    const owner = state.units.find((u) => u.id === r.sourceId),
      victim = state.units.find((u) => u.id === r.victimId);
    const live = state.ahriEssences.find((e) => e.id === r.id),
      at = r.end?.tick ?? state.tick;
    if (
      ids.has(r.id) ||
      r.id >= state.nextId ||
      foreign.some((o) => o.id === r.id) ||
      owner?.champion !== 'ahri' ||
      owner.team !== r.team ||
      r.victimId >= state.nextId ||
      r.victimId === r.sourceId ||
      r.victimId === r.id ||
      (victim &&
        (victim.team === r.team ||
          (r.kind === 'champion'
            ? victim.kind !== 'champion'
            : !isLaneMinionKind(victim.kind) && victim.kind !== 'monster'))) ||
      r.startTick < previousTick ||
      r.startTick > state.tick ||
      state.tick >= passiveAudioExpiry(r) ||
      at < r.startTick ||
      at > state.tick ||
      at - r.startTick > P.maximumPursuitTicks ||
      (!r.end &&
        (state.winner !== null ||
          !live ||
          owner.hp <= 0 ||
          at - r.startTick >= P.maximumPursuitTicks)) ||
      distance(r.origin, r.currentPoint) >
        acceleratingMotion((at - r.startTick + 1) / 60, AHRI_PASSIVE.missile).distance + 1e-6
    )
      fail();
    ids.add(r.id);
    previousTick = r.startTick;
    for (const a of [r.audience, r.end?.audience])
      if (
        a &&
        (!a.includes(r.team) ||
          new Set(a).size !== a.length ||
          a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join())
      )
        fail();
    if (
      r.end &&
      (!equal(r.currentPoint, r.end.point) ||
        (r.end.reason === 'match-end' && (!state.winner || r.end.tick !== state.tick)) ||
        (r.end.reason === 'expired' && r.end.tick !== r.startTick + P.maximumPursuitTicks) ||
        (r.end.reason === 'death' && owner?.deadAt !== r.end.tick))
    )
      fail();
    if (
      live &&
      (live.sourceId !== r.sourceId ||
        live.victimId !== r.victimId ||
        live.team !== r.team ||
        live.kind !== r.kind ||
        live.startTick !== r.startTick ||
        !equal(live.origin, r.origin) ||
        !equal(live.position, r.currentPoint) ||
        live.stopTick !== (r.end?.tick ?? null) ||
        live.stopReason !== (r.end?.reason ?? null))
    )
      fail();
    if (!live && !r.end) fail();
  }
  for (const e of state.ahriEssences) {
    const expiry = passiveAudioExpiry({
      startTick: e.startTick,
      kind: e.kind,
      end:
        e.stopTick === null
          ? null
          : { tick: e.stopTick, point: e.position, reason: e.stopReason!, audience: [] },
    });
    if (state.tick < expiry && !ids.has(e.id)) fail();
  }
}
