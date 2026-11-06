import { AHRI_ORB_AUDIO_TICKS as AUDIO } from '../content/ahri-orb-audio-timing';
import { AHRI_Q_CAST_TIMING as T } from '../content/ahri-q-cast-timing';
import type { AhriQCastVisual } from './ahri-q-cast-visuals';
import type { AhriOrbAudioRecord } from './ahri-orb-audio';
import type { ChampionState, Team, Unit } from './types';
export function validateAhriQCastVisuals(state: {
  tick: number;
  winner: Team | null;
  units: Unit[];
  player: Pick<ChampionState, 'id' | 'pendingCast'>;
  otherChampions: Pick<ChampionState, 'id' | 'pendingCast'>[];
  ahriOrbAudio?: AhriOrbAudioRecord[];
  ahriQCastVisuals?: AhriQCastVisual[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri Q cast visual history.');
  };
  const keys = new Set<string>();
  let previous = -1;
  for (const r of state.ahriQCastVisuals ?? []) {
    const u = state.units.find((u) => u.id === r.sourceId),
      owner = [state.player, ...state.otherChampions].find((o) => o.id === r.sourceId),
      key = r.sourceId + ':' + r.castTick;
    if (
      u?.champion !== 'ahri' ||
      u.team !== r.team ||
      !owner ||
      keys.has(key) ||
      r.castTick < previous ||
      r.castTick > state.tick ||
      state.tick >= r.castTick + T.historyTicks ||
      (r.aim.x === r.origin.x && r.aim.y === r.origin.y)
    )
      fail();
    const audio = (state.ahriOrbAudio ?? []).find(
      (a) => a.sourceId === r.sourceId && a.castTick === r.castTick
    );
    if (
      (state.tick < r.castTick + AUDIO.cast && !audio) ||
      (audio &&
        (audio.origin.x !== r.origin.x ||
          audio.origin.y !== r.origin.y ||
          audio.aim.x !== r.aim.x ||
          audio.aim.y !== r.aim.y))
    )
      fail();
    keys.add(key);
    previous = r.castTick;
    if (r.birth) {
      if (
        r.birth.tick !== r.castTick + T.delayTicks ||
        r.birth.tick > state.tick ||
        !r.birth.audience.includes(r.team) ||
        r.birth.audience.join() !==
          ['blue', 'red'].filter((t) => r.birth!.audience.includes(t as Team)).join()
      )
        fail();
    } else {
      const cast = owner!.pendingCast,
        audio = (state.ahriOrbAudio ?? []).find(
          (a) => a.sourceId === r.sourceId && a.castTick === r.castTick
        );
      if (
        state.winner ||
        u!.hp <= 0 ||
        state.tick >= r.castTick + T.delayTicks ||
        cast?.ability !== 'q' ||
        cast.startTick !== r.castTick ||
        !audio ||
        audio.cancelTick !== null ||
        audio.origin.x !== r.origin.x ||
        audio.origin.y !== r.origin.y ||
        audio.aim.x !== r.aim.x ||
        audio.aim.y !== r.aim.y
      )
        fail();
    }
  }
  for (const owner of [state.player, ...state.otherChampions]) {
    const u = state.units.find((u) => u.id === owner.id),
      cast = owner.pendingCast;
    if (
      !state.winner &&
      u?.champion === 'ahri' &&
      u.hp > 0 &&
      cast?.ability === 'q' &&
      state.tick < cast.startTick + T.delayTicks &&
      !keys.has(owner.id + ':' + cast.startTick)
    )
      fail();
  }
}
