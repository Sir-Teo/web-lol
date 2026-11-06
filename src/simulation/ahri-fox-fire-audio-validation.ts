import { AHRI_W_POLICY as W } from '../content/ahri-w-policy';
import { foxFireOrbitPoint, type FoxFireCast } from './ahri-fox-fires';
import { foxFireAudioExpiry, type AhriFoxFireAudioRecord } from './ahri-fox-fire-audio';
import type { AhriOrb } from './ahri-orbs';
import type { Vec2 } from './math';
import type { ChampionState, Projectile, Team, Unit } from './types';

export function validateFoxFireAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: ChampionState;
  otherChampions: ChampionState[];
  projectiles: Projectile[];
  ahriOrbs: AhriOrb[];
  ahriFoxFires: FoxFireCast[];
  ahriFoxFireAudio?: AhriFoxFireAudioRecord[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri Fox-Fire audio history.');
  };
  const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const records = state.ahriFoxFireAudio ?? [],
    identities = new Set<number>(),
    keys = new Set<string>();
  let previousTick = -1;
  for (const r of records) {
    const owner = state.units.find((u) => u.id === r.sourceId);
    const champion = [state.player, ...state.otherChampions].find((s) => s.id === r.sourceId);
    const live = state.ahriFoxFires.find((c) => c.id === r.id);
    if (
      identities.has(r.id) ||
      keys.has(`${r.sourceId}:${r.startTick}`) ||
      r.id >= state.nextId ||
      owner?.champion !== 'ahri' ||
      owner.team !== r.team ||
      !champion?.spellRanks.w ||
      r.startTick < 1 ||
      r.startTick < previousTick ||
      r.startTick > state.tick ||
      state.tick >= foxFireAudioExpiry(r) ||
      state.units.some((u) => u.id === r.id) ||
      state.projectiles.some((p) => p.id === r.id) ||
      state.ahriOrbs.some((o) => o.id === r.id)
    )
      fail();
    identities.add(r.id);
    keys.add(`${r.sourceId}:${r.startTick}`);
    previousTick = r.startTick;
    for (const a of [
      r.audience,
      r.activationStop?.audience,
      ...r.fires.flatMap((f) => [f.launch?.audience, f.end?.audience]),
    ]) {
      if (
        a &&
        (!a.includes(r.team) ||
          new Set(a).size !== a.length ||
          a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join())
      )
        fail();
    }
    if (
      live &&
      (live.sourceId !== r.sourceId ||
        live.team !== r.team ||
        live.startTick !== r.startTick ||
        live.facing !== r.facing)
    )
      fail();
    if (!live && r.fires.some((f) => !f.end)) fail();
    for (let i = 0; i < 3; i++) {
      const f = r.fires[i],
        l = f.launch,
        e = f.end,
        actual = live?.fires[i];
      if (f.index !== i) fail();
      if (l) {
        const expected = foxFireOrbitPoint(r, i, l.tick, l.sourcePoint),
          target = state.units.find((u) => u.id === l.targetId);
        if (
          l.tick < r.startTick + W.priorityDelayTicks ||
          l.tick >= r.startTick + W.orbitTicks ||
          l.tick > state.tick ||
          l.targetId >= state.nextId ||
          l.targetId === r.sourceId ||
          (target &&
            (target.team === r.team ||
              ['ward', 'turret', 'nexus', 'inhibitor'].includes(target.kind))) ||
          Math.hypot(l.origin.x - expected.x, l.origin.y - expected.y) > 1e-6
        )
          fail();
        if (e && !equal(l.currentPoint, e.point)) fail();
      }
      if (e) {
        if (
          e.tick < (l?.tick ?? r.startTick) ||
          e.tick > state.tick ||
          (l && e.tick > l.tick + W.maximumFlightTicks) ||
          (!l && e.tick > r.startTick + W.orbitTicks)
        )
          fail();
        if ((e.reason === 'hit' || e.reason === 'lost-target') && !l) fail();
        if (e.reason === 'death' && (l || owner!.deadAt !== e.tick)) fail();
        if (e.reason === 'match-end' && (!state.winner || e.tick !== state.tick)) fail();
        if (
          e.reason === 'expired' &&
          e.tick !== (l ? l.tick + W.maximumFlightTicks : r.startTick + W.orbitTicks)
        )
          fail();
      }
      if (actual) {
        if (!!l !== (actual.dispatchTick !== null) || !!e !== (actual.stopTick !== null)) fail();
        if (
          l &&
          (l.tick !== actual.dispatchTick ||
            l.targetId !== actual.targetId ||
            !equal(l.currentPoint, actual.position))
        )
          fail();
        if (
          e &&
          (e.tick !== actual.stopTick ||
            e.reason !== actual.stopReason ||
            !equal(e.point, actual.position))
        )
          fail();
        if (!l && !e && actual.phase !== 'orbit') fail();
      }
    }
    const orbiting = r.fires.some((f) => !f.launch && !f.end),
      stop = r.activationStop;
    if (orbiting === !!stop || (state.winner && (orbiting || r.fires.some((f) => !f.end)))) fail();
    if (stop) {
      if (
        stop.tick < r.startTick ||
        stop.tick > state.tick ||
        stop.tick > r.startTick + W.orbitTicks
      )
        fail();
      if (stop.reason === 'released') {
        if (
          r.fires.some((f) => !f.launch) ||
          stop.tick !== Math.max(...r.fires.map((f) => f.launch!.tick))
        )
          fail();
        const last = r.fires.find((f) => f.launch!.tick === stop.tick)!;
        if (!equal(stop.point, last.launch!.sourcePoint)) fail();
      }
      if (
        stop.reason === 'death' &&
        (owner!.deadAt !== stop.tick ||
          !r.fires.some((f) => !f.launch && f.end?.reason === 'death' && f.end.tick === stop.tick))
      )
        fail();
      if (
        stop.reason === 'expired' &&
        (stop.tick !== r.startTick + W.orbitTicks ||
          !r.fires.some(
            (f) => !f.launch && f.end?.reason === 'expired' && f.end.tick === stop.tick
          ))
      )
        fail();
      if (
        stop.reason === 'match-end' &&
        (!state.winner ||
          stop.tick !== state.tick ||
          !r.fires.some(
            (f) => !f.launch && f.end?.reason === 'match-end' && f.end.tick === stop.tick
          ))
      )
        fail();
      for (const f of r.fires) if (!f.launch && f.end && f.end.tick !== stop.tick) fail();
    }
  }
  for (const cast of state.ahriFoxFires) if (!records.some((r) => r.id === cast.id)) fail();
}
