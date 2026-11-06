import { RECALL_DURATION_TICKS } from '../content/rules';
import { ahriRecallAudioExpiry, type AhriRecallAudioRecord } from './ahri-recall-audio';
import type { ChampionState, Team, Unit } from './types';
export function validateAhriRecallAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: Pick<ChampionState, 'id' | 'recallEnd'>;
  otherChampions: Pick<ChampionState, 'id' | 'recallEnd'>[];
  ahriRecallAudio?: AhriRecallAudioRecord[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri Recall audio history.');
  };
  let lastId = -1,
    lastTick = -1;
  const active = new Set<number>();
  for (const r of state.ahriRecallAudio ?? []) {
    const u = state.units.find((u) => u.id === r.sourceId),
      owner = [state.player, ...state.otherChampions].find((o) => o.id === r.sourceId);
    if (
      u?.champion !== 'ahri' ||
      u.team !== r.team ||
      !owner ||
      r.id <= lastId ||
      r.id <= r.sourceId ||
      r.id >= state.nextId ||
      r.startTick < lastTick ||
      r.startTick > state.tick ||
      r.completeTick !== r.startTick + RECALL_DURATION_TICKS ||
      state.tick >= ahriRecallAudioExpiry(r) ||
      !r.audience.includes(r.team) ||
      r.audience.join() !== ['blue', 'red'].filter((t) => r.audience.includes(t as Team)).join()
    )
      fail();
    lastId = r.id;
    lastTick = r.startTick;
    if (!r.end) {
      if (
        state.winner ||
        active.has(r.sourceId) ||
        u!.hp <= 0 ||
        owner!.recallEnd !== r.completeTick ||
        state.tick >= r.completeTick ||
        u!.x !== r.origin.x ||
        u!.y !== r.origin.y
      )
        fail();
      active.add(r.sourceId);
    } else {
      if (r.end.tick < r.startTick || r.end.tick > state.tick || r.end.tick > r.completeTick)
        fail();
      if (r.end.reason === 'complete' && r.end.tick !== r.completeTick) fail();
      if (r.end.reason === 'match-end' && (!state.winner || r.end.tick !== state.tick)) fail();
      if (r.end.reason !== 'complete' && r.end.tick >= r.completeTick) fail();
    }
  }
  for (const owner of [state.player, ...state.otherChampions]) {
    const u = state.units.find((u) => u.id === owner.id);
    if (
      u?.champion === 'ahri' &&
      owner.recallEnd !== null &&
      !state.winner &&
      !active.has(owner.id)
    )
      fail();
  }
}
