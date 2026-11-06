import { AHRI_Q } from '../content/ahri-q';
import { AHRI_Q_POLICY as Q } from '../content/ahri-q-policy';
import { AHRI_Q_OUTWARD_SECONDS } from './ahri-orb-motion';
import { orbAudioExpiry, type AhriOrbAudioRecord } from './ahri-orb-audio';
import type { AhriOrb } from './ahri-orbs';
import type { ChampionState, Projectile, Team, Unit } from './types';
import type { Vec2 } from './math';

export function validateOrbAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: ChampionState;
  otherChampions: ChampionState[];
  projectiles: Projectile[];
  ahriOrbs: AhriOrb[];
  ahriOrbAudio?: AhriOrbAudioRecord[];
}) {
  const fail = () => {
    throw new Error('Saved match contains invalid Ahri Orb audio history.');
  };
  const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const records = state.ahriOrbAudio ?? [];
  const keys = new Set<string>(),
    ids = new Set<number>();
  let previousCast = -1;
  for (const r of records) {
    const owner = state.units.find((u) => u.id === r.sourceId);
    const champion = [state.player, ...state.otherChampions].find((s) => s.id === r.sourceId);
    const pending = champion?.pendingCast;
    const winding = pending?.ability === 'q' && pending.startTick === r.castTick;
    const key = `${r.sourceId}:${r.castTick}`;
    if (
      (r.origin.x === r.aim.x && r.origin.y === r.aim.y) ||
      owner?.champion !== 'ahri' ||
      owner.team !== r.team ||
      !champion?.spellRanks.q ||
      keys.has(key) ||
      r.castTick < 1 ||
      r.castTick < previousCast ||
      r.castTick > state.tick ||
      state.tick >= orbAudioExpiry(r)
    )
      fail();
    previousCast = r.castTick;
    keys.add(key);
    for (const audience of [
      r.castAudience,
      r.launch?.audience,
      r.turn?.audience,
      r.end?.audience,
      ...r.hits.map((h) => h.audience),
    ])
      if (audience && (new Set(audience).size !== audience.length || !audience.includes(r.team)))
        fail();
    if (
      r.cancelTick !== null &&
      (r.launch || r.cancelTick < r.castTick || r.cancelTick > state.tick)
    )
      fail();
    if (!r.launch) {
      if (
        r.turn ||
        r.end ||
        r.hits.length ||
        (r.cancelTick === null && (!winding || !equal(pending!.point, r.aim)))
      )
        fail();
      continue;
    }
    if (winding) fail();
    const l = r.launch,
      turn = r.turn,
      end = r.end;
    if (
      l.tick !== r.castTick + Math.round(AHRI_Q.castSeconds * 60) ||
      l.tick > state.tick ||
      l.id >= state.nextId ||
      ids.has(l.id) ||
      state.units.some((u) => u.id === l.id) ||
      state.projectiles.some((p) => p.id === l.id)
    )
      fail();
    ids.add(l.id);
    const dx = r.aim.x - l.origin.x,
      dy = r.aim.y - l.origin.y,
      length = Math.hypot(dx, dy);
    if (
      !length ||
      Math.abs(l.direction.x - dx / length) > 1e-6 ||
      Math.abs(l.direction.y - dy / length) > 1e-6
    )
      fail();
    if (turn) {
      if (
        turn.tick !== l.tick + Math.floor(AHRI_Q_OUTWARD_SECONDS * 60) ||
        turn.tick > state.tick ||
        !equal(l.currentPoint, turn.point) ||
        Math.hypot(
          turn.point.x - l.origin.x - l.direction.x * Q.outwardDistance,
          turn.point.y - l.origin.y - l.direction.y * Q.outwardDistance
        ) > 1e-6
      )
        fail();
    } else if (
      Math.hypot(l.currentPoint.x - l.origin.x, l.currentPoint.y - l.origin.y) >
      Q.outwardDistance + 1e-6
    )
      fail();
    const orb = state.ahriOrbs.find((o) => o.id === l.id);
    if (end) {
      if (
        orb ||
        end.tick < (turn?.tick ?? l.tick) ||
        end.tick > state.tick ||
        end.tick > l.tick + Q.maximumFlightTicks ||
        !equal(end.point, turn?.currentPoint ?? l.currentPoint) ||
        (end.reason === 'caught' && !turn) ||
        (end.reason === 'match-end' && !state.winner) ||
        (end.reason === 'expired' && end.tick !== l.tick + Q.maximumFlightTicks)
      )
        fail();
    } else {
      if (
        !orb ||
        state.winner ||
        orb.sourceId !== r.sourceId ||
        orb.team !== r.team ||
        orb.launchTick !== l.tick ||
        !equal(orb.origin, l.origin) ||
        !equal(orb.direction, l.direction) ||
        !equal(orb.position, turn?.currentPoint ?? l.currentPoint)
      )
        fail();
      if ((state.tick - l.tick + 1) / 60 > AHRI_Q_OUTWARD_SECONDS && !turn) fail();
    }
    const seen = { outward: new Set<number>(), return: new Set<number>() };
    let priorHit = l.tick,
      returned = false;
    for (const h of r.hits) {
      const target = state.units.find((u) => u.id === h.targetId);
      if (
        h.tick < priorHit ||
        h.tick > state.tick ||
        h.tick > (end?.tick ?? state.tick) ||
        h.targetId >= state.nextId ||
        h.targetId === r.sourceId ||
        seen[h.leg].has(h.targetId) ||
        (target &&
          (target.team === r.team ||
            ['turret', 'nexus', 'inhibitor', 'ward'].includes(target.kind)))
      )
        fail();
      if (h.leg === 'outward') {
        const x = h.point.x - l.origin.x,
          y = h.point.y - l.origin.y;
        const along = x * l.direction.x + y * l.direction.y;
        if (
          along < -1e-6 ||
          along > Q.outwardDistance + 1e-6 ||
          Math.abs(x * l.direction.y - y * l.direction.x) > 1e-6
        )
          fail();
        if (
          returned ||
          h.tick > (turn?.tick ?? state.tick) ||
          Math.hypot(h.point.x - l.origin.x, h.point.y - l.origin.y) > Q.outwardDistance + 1e-6
        )
          fail();
      } else {
        returned = true;
        if (!turn || h.tick < turn.tick) fail();
      }
      seen[h.leg].add(h.targetId);
      priorHit = h.tick;
    }
    if (
      orb &&
      (JSON.stringify([...seen.outward]) !== JSON.stringify(orb.outwardHits) ||
        JSON.stringify([...seen.return]) !== JSON.stringify(orb.returnHits))
    )
      fail();
  }
  for (const orb of state.ahriOrbs) if (!ids.has(orb.id)) fail();
  for (const champion of [state.player, ...state.otherChampions]) {
    const pending = champion.pendingCast;
    if (
      pending?.ability === 'q' &&
      state.units.find((u) => u.id === champion.id)?.champion === 'ahri' &&
      !keys.has(`${champion.id}:${pending.startTick}`)
    )
      fail();
  }
}
