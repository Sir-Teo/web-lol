import { AHRI_Q_PROJECTILE_HISTORY_TICKS } from '../content/ahri-q-projectile-timing';
import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { advanceAhriOrbMotion, type AhriOrbMotion } from './ahri-orb-motion';
import type { AhriOrb } from './ahri-orbs';
import type { AhriOrbAudioRecord } from './ahri-orb-audio';
import type { AhriQProjectileVisual } from './ahri-q-projectile-visuals';
import type { Team, Unit } from './types';
import type { Vec2 } from './math';

const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
export function validateQProjectileVisuals(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  ahriOrbs: AhriOrb[];
  ahriOrbAudio?: AhriOrbAudioRecord[];
  ahriQProjectileVisuals?: AhriQProjectileVisual[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri Q projectile visual history.');
  };
  const seen = new Set<number>();
  let previous = 0;
  for (const r of state.ahriQProjectileVisuals ?? []) {
    const source = state.units.find((u) => u.id === r.sourceId);
    const live = state.ahriOrbs.find((o) => o.id === r.id);
    if (
      r.id <= previous ||
      r.id >= state.nextId ||
      r.sourceId >= state.nextId ||
      r.launchTick < 1 ||
      r.launchTick > state.tick ||
      Math.abs(Math.hypot(r.direction.x, r.direction.y) - 1) > 1e-6 ||
      (source
        ? source.champion !== 'ahri' || source.team !== r.team
        : r.end?.reason !== 'lost-source') ||
      (r.end ? !!live : !live || !!state.winner)
    )
      fail();
    previous = r.id;
    seen.add(r.id);
    const checkAudience = (a: Team[]) => {
      if (
        !a.includes(r.team) ||
        a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join()
      )
        fail();
    };
    checkAudience(r.birthAudience);
    let motion: AhriOrbMotion = {
      origin: { ...r.origin },
      direction: { ...r.direction },
      position: { ...r.origin },
      previous: { ...r.origin },
      launchTick: r.launchTick,
      lastTick: r.launchTick - 1,
    };
    let turn: { tick: number; point: Vec2 } | null = null;
    let caught = false;
    let facing = Math.atan2(r.direction.y || 0, r.direction.x || 0);
    for (const f of r.frames) {
      if (
        caught ||
        f.tick !== motion.lastTick + 1 ||
        f.tick > state.tick ||
        f.tick - r.launchTick >= AHRI_Q_POLICY.maximumFlightTicks
      )
        fail();
      const movement = advanceAhriOrbMotion(motion, f.tick, f.sourcePoint);
      motion = movement.motion;
      caught = movement.finished;
      const returning = movement.segments.find((s) => s.leg === 'return');
      if (returning && !turn) turn = { tick: f.tick, point: returning.from };
      const segment = movement.segments.at(-1)!;
      const dx = segment.to.x - segment.from.x,
        dy = segment.to.y - segment.from.y;
      if (dx !== 0 || dy !== 0) facing = Math.atan2(dy || 0, dx || 0);
      if (!equal(f, motion.position) || f.facing !== facing) fail();
      checkAudience(f.audience);
    }
    if (
      !!turn !== !!r.turn ||
      (turn && r.turn && (turn.tick !== r.turn.tick || !equal(turn.point, r.turn.point)))
    )
      fail();
    if (r.turn) checkAudience(r.turn.audience);
    if (r.end) {
      const e = r.end;
      if (
        e.tick > state.tick ||
        e.tick < r.launchTick ||
        state.tick >= e.tick + AHRI_Q_PROJECTILE_HISTORY_TICKS ||
        !equal(e.point, motion.position)
      )
        fail();
      if (e.reason === 'caught') {
        if (!caught || e.tick !== motion.lastTick) fail();
      } else {
        if (caught) fail();
        if (e.reason === 'match-end') {
          if (!state.winner || (e.tick !== motion.lastTick && e.tick !== motion.lastTick + 1))
            fail();
        } else {
          if (
            e.tick !== motion.lastTick + 1 ||
            (e.reason === 'expired' &&
              e.tick - r.launchTick !== AHRI_Q_POLICY.maximumFlightTicks) ||
            (e.reason === 'lost-source' && source)
          )
            fail();
        }
      }
    } else if (
      caught ||
      motion.lastTick !== state.tick ||
      !live ||
      live.sourceId !== r.sourceId ||
      live.team !== r.team ||
      live.launchTick !== r.launchTick ||
      !equal(live.origin, r.origin) ||
      !equal(live.direction, r.direction) ||
      !equal(live.position, motion.position) ||
      !equal(live.previous, motion.previous)
    )
      fail();
    const audio = state.ahriOrbAudio?.find((a) => a.launch?.id === r.id);
    if (
      audio &&
      (audio.sourceId !== r.sourceId ||
        audio.team !== r.team ||
        audio.launch!.tick !== r.launchTick ||
        !equal(audio.launch!.origin, r.origin) ||
        !equal(audio.launch!.direction, r.direction) ||
        !!audio.turn !== !!r.turn ||
        (audio.turn &&
          r.turn &&
          (audio.turn.tick !== r.turn.tick || !equal(audio.turn.point, r.turn.point))) ||
        !!audio.end !== !!r.end ||
        (audio.end &&
          r.end &&
          (audio.end.tick !== r.end.tick ||
            audio.end.reason !== r.end.reason ||
            !equal(audio.end.point, r.end.point))))
    )
      fail();
  }
  if (state.ahriOrbs.some((o) => !seen.has(o.id))) fail();
  for (const audio of state.ahriOrbAudio ?? [])
    if (
      audio.launch &&
      (!audio.end || state.tick < audio.end.tick + AHRI_Q_PROJECTILE_HISTORY_TICKS) &&
      !seen.has(audio.launch.id)
    )
      fail();
}
