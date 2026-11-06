import { AHRI_E_POLICY as E } from '../content/ahri-e-policy';
import { charmAudioExpiry, type AhriCharmAudioRecord } from './ahri-charm-audio';
import type { ChampionState, Projectile, Team, Unit } from './types';
import type { Vec2 } from './math';

export function validateCharmAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: ChampionState;
  otherChampions: ChampionState[];
  projectiles: Projectile[];
  ahriCharmAudio: AhriCharmAudioRecord[];
}) {
  const fail = () => {
    throw new Error('Saved match contains invalid Charm audio history.');
  };
  const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const keys = new Set<string>(),
    ids = new Set<number>();
  let priorTick = -1;
  for (const r of state.ahriCharmAudio) {
    const owner = state.units.find((u) => u.id === r.sourceId);
    const pending = [state.player, ...state.otherChampions].find(
      (s) => s.id === r.sourceId
    )?.pendingCast;
    const key = `${r.sourceId}:${r.castTick}`;
    if (
      owner?.champion !== 'ahri' ||
      owner.team !== r.team ||
      keys.has(key) ||
      r.castTick < priorTick ||
      r.castTick > state.tick ||
      state.tick >= charmAudioExpiry(r)
    )
      fail();
    keys.add(key);
    priorTick = r.castTick;
    for (const audience of [r.castAudience, r.launch?.audience, r.hit?.audience])
      if (audience && (new Set(audience).size !== audience.length || !audience.includes(r.team)))
        fail();
    if (
      r.cancelTick !== null &&
      (r.launch || r.cancelTick < r.castTick || r.cancelTick > state.tick)
    )
      fail();
    if (!r.launch) {
      if (
        r.stop ||
        r.hit ||
        (r.cancelTick === null && (pending?.ability !== 'e' || pending.startTick !== r.castTick))
      )
        fail();
      continue;
    }
    const l = r.launch,
      s = r.stop,
      h = r.hit;
    if (
      l.tick !== r.castTick + E.windupTicks ||
      l.tick > state.tick ||
      l.id >= state.nextId ||
      ids.has(l.id) ||
      state.units.some((u) => u.id === l.id) ||
      Math.hypot(l.currentPoint.x - l.point.x, l.currentPoint.y - l.point.y) > E.range + 1e-6
    )
      fail();
    ids.add(l.id);
    const projectile = state.projectiles.find((p) => p.id === l.id);
    if (!s) {
      if (
        !projectile ||
        projectile.type !== 'charm' ||
        projectile.source !== r.sourceId ||
        projectile.team !== r.team ||
        projectile.launchTick !== l.tick ||
        !projectile.origin ||
        !equal(projectile.origin, l.point) ||
        !equal(projectile, l.currentPoint) ||
        h ||
        state.winner
      )
        fail();
    } else {
      if (
        projectile ||
        s.tick < l.tick ||
        s.tick > state.tick ||
        !equal(s.point, l.currentPoint) ||
        (s.reason === 'match-end' && !state.winner) ||
        (s.reason === 'hit') !== !!h
      )
        fail();
      if (h) {
        const target = state.units.find((u) => u.id === h.targetId);
        if (
          h.tick !== s.tick ||
          !equal(h.point, s.point) ||
          h.targetId >= state.nextId ||
          h.targetId === r.sourceId ||
          (target && target.team === r.team)
        )
          fail();
      }
    }
  }
  for (const p of state.projectiles) if (p.type === 'charm' && !ids.has(p.id)) fail();
}
