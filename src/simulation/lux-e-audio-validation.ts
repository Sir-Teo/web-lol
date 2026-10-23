import { LUX_E_SOURCE as E } from '../content/lux-e';
import { LUX_E_AUDIO_TAIL_TICKS } from '../content/lux-e-audio-timing';
import { LUX_E_AUDIO_ROLES, type LuxEAudioHistory } from './lux-e-audio';
import type { ChampionState, Singularity, Unit, Team } from './types';

/** Cross-check cosmetic history against gameplay ownership, dispatch clocks and
 * surviving spells. Dropped old records cannot prove native random state. */
export function validateLuxEAudio(state: {
  luxEAudio: LuxEAudioHistory;
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: ChampionState;
  otherChampions: ChampionState[];
  singularities: Singularity[];
}) {
  const fail = () => {
    throw new Error('Saved match contains invalid Lucent audio history.');
  };
  const { records, counts } = state.luxEAudio;
  const used = Object.fromEntries(LUX_E_AUDIO_ROLES.map((k) => [k, new Set<number>()])) as Record<
    (typeof LUX_E_AUDIO_ROLES)[number],
    Set<number>
  >;
  const zones = new Set<number>();
  let priorCast = -1,
    priorTick = -1;
  for (const r of records) {
    const owner = state.units.find((u) => u.id === r.sourceId);
    const champion = [state.player, ...state.otherChampions].find((c) => c.id === r.sourceId);
    const pending = champion?.pendingCast;
    const winding = pending?.ability === 'e' && pending.startTick === r.startTick;
    if (winding && (pending.point.x !== r.aim.x || pending.point.y !== r.aim.y)) fail();
    if (
      owner?.champion !== 'lux' ||
      owner.team !== r.team ||
      r.startTick > state.tick ||
      r.castOrdinal <= priorCast ||
      r.startTick < priorTick ||
      (r.stopTick !== null &&
        (r.stopTick < r.startTick ||
          r.stopTick > state.tick ||
          state.tick >= r.stopTick + LUX_E_AUDIO_TAIL_TICKS)) ||
      Math.hypot(r.aim.x - r.point.x, r.aim.y - r.point.y) > E.castRange + 1e-6
    )
      fail();
    priorCast = r.castOrdinal;
    priorTick = r.startTick;
    for (const role of LUX_E_AUDIO_ROLES) {
      const ordinal =
        role === 'cast'
          ? r.castOrdinal
          : role === 'flight'
            ? r.launch?.ordinal
            : role === 'zone'
              ? r.arrival?.ordinal
              : r.hit?.ordinal;
      if (ordinal === undefined) continue;
      if (ordinal >= counts[role] || used[role].has(ordinal)) fail();
      used[role].add(ordinal);
    }
    const l = r.launch,
      a = r.arrival,
      h = r.hit;
    if ((r.flightStopPoint !== null) !== (l !== null && a === null && r.stopTick !== null)) fail();
    if (!l) {
      if (
        a ||
        h ||
        (r.stopTick === null ? !winding : winding || r.stopTick > r.startTick + E.castSeconds * 60)
      )
        fail();
      continue;
    }
    if (
      winding ||
      l.tick !== r.startTick + E.castSeconds * 60 ||
      l.tick > state.tick ||
      l.zoneId >= state.nextId ||
      zones.has(l.zoneId)
    )
      fail();
    zones.add(l.zoneId);
    const distance = Math.hypot(r.aim.x - l.origin.x, r.aim.y - l.origin.y);
    const arrival = l.tick + Math.max(0, Math.ceil(distance / (E.movementSpeed / 60) - 1e-9) - 1);
    if (a && (a.tick !== arrival || a.tick > state.tick)) fail();
    if (!a && state.tick >= arrival && r.stopTick === null) fail();
    if (r.flightStopPoint && r.stopTick !== null) {
      if (r.stopTick > arrival) fail();
      const onEndpoint = [0, 1].some((firstStep) => {
        const f = distance
          ? Math.min(
              1,
              Math.max(0, ((r.stopTick! - l.tick + firstStep) * E.movementSpeed) / 60) / distance
            )
          : 1;
        return (
          Math.hypot(
            r.flightStopPoint!.x - (l.origin.x + (r.aim.x - l.origin.x) * f),
            r.flightStopPoint!.y - (l.origin.y + (r.aim.y - l.origin.y) * f)
          ) < 1e-6
        );
      });
      if (!onEndpoint) fail();
    }
    if (
      h &&
      (!a ||
        h.tick < a.tick ||
        h.tick > a.tick + E.zoneSeconds * 60 ||
        h.tick > state.tick ||
        r.stopTick !== h.tick)
    )
      fail();
    const z = state.singularities.find((z) => z.id === l.zoneId);
    if (z) {
      if (r.stopTick !== null && !h) fail();
      if (
        z.sourceId !== r.sourceId ||
        z.launchTick !== l.tick ||
        z.origin.x !== l.origin.x ||
        z.origin.y !== l.origin.y ||
        z.point.x !== r.aim.x ||
        z.point.y !== r.aim.y ||
        z.arrivalTick !== (a?.tick ?? null) ||
        z.detonatedTick !== (h?.tick ?? null)
      )
        fail();
    } else if (r.stopTick === null || (!h && (state.winner === null || r.stopTick !== state.tick)))
      fail();
    if (r.stopTick !== null && r.stopTick < l.tick) fail();
  }
  if (counts.cast < counts.flight || counts.flight < counts.zone || counts.zone < counts.hit)
    fail();
  if (state.singularities.some((z) => !zones.has(z.id))) fail();
  for (const owner of [state.player, ...state.otherChampions]) {
    const cast = owner.pendingCast;
    if (cast?.ability !== 'e' || state.units.find((u) => u.id === owner.id)?.champion !== 'lux')
      continue;
    if (
      !records.some(
        (r) =>
          r.sourceId === owner.id &&
          r.startTick === cast.startTick &&
          r.stopTick === null &&
          r.launch === null
      )
    )
      fail();
  }
}
