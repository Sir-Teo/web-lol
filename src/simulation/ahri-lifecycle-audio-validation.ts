import { AHRI_LIFECYCLE_AUDIO_TICKS as T } from '../content/ahri-lifecycle-audio-timing';
import { championDeathTicks } from './champion-death';
import { ahriLifecycleAudioExpiry, type AhriLifecycleAudioRecord } from './ahri-lifecycle-audio';
import type { ChampionState, Team, Unit } from './types';
export function validateAhriLifecycleAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: Pick<ChampionState, 'id' | 'level'>;
  otherChampions: Pick<ChampionState, 'id' | 'level'>[];
  ahriLifecycleAudio?: AhriLifecycleAudioRecord[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri lifecycle audio history.');
  };
  const records = state.ahriLifecycleAudio ?? [],
    keys = new Set<string>(),
    pending = new Set<number>();
  let previousId = -1,
    previousTick = -1;
  for (const r of records) {
    const u = state.units.find((u) => u.id === r.sourceId),
      owner = [state.player, ...state.otherChampions].find((o) => o.id === r.sourceId),
      key = `${r.sourceId}:${r.startTick}`;
    if (
      u?.champion !== 'ahri' ||
      u.team !== r.team ||
      !owner ||
      r.levelAtDeath > owner.level ||
      keys.has(key) ||
      r.id <= previousId ||
      r.id <= r.sourceId ||
      r.id >= state.nextId ||
      r.startTick < previousTick ||
      r.startTick > state.tick ||
      r.respawnTick !== r.startTick + championDeathTicks(r.levelAtDeath, r.startTick) ||
      state.tick >= ahriLifecycleAudioExpiry(r) ||
      (r.respawn && r.terminalTick !== null)
    )
      fail();
    keys.add(key);
    previousId = r.id;
    previousTick = r.startTick;
    for (const a of [r.audience, r.respawn?.audience])
      if (
        a &&
        (!a.includes(r.team) ||
          new Set(a).size !== a.length ||
          a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join())
      )
        fail();
    if (r.respawn) {
      if (
        r.respawn.tick !== r.respawnTick ||
        r.respawn.tick > state.tick ||
        (u!.deadAt !== null && u!.deadAt < r.respawn.tick)
      )
        fail();
    } else {
      if (
        u!.hp > 0 ||
        u!.deadAt !== r.startTick ||
        u!.respawnTick !== r.respawnTick ||
        u!.x !== r.origin.x ||
        u!.y !== r.origin.y ||
        pending.has(r.sourceId)
      )
        fail();
      pending.add(r.sourceId);
      if (r.terminalTick === null) {
        if (state.winner || state.tick >= r.respawnTick) fail();
      } else if (
        !state.winner ||
        r.terminalTick !== state.tick ||
        r.terminalTick < r.startTick ||
        r.terminalTick > r.respawnTick
      )
        fail();
    }
  }
  for (const u of state.units)
    if (
      u.champion === 'ahri' &&
      u.hp <= 0 &&
      u.deadAt !== null &&
      (!state.winner || state.tick < u.deadAt + T.death) &&
      !pending.has(u.id)
    )
      fail();
}
