import { AHRI_W_VISUAL_HISTORY_TICKS } from '../content/ahri-w-visual-timing';
import type { AhriFoxFireAudioRecord } from './ahri-fox-fire-audio';
import type { FoxFireCast } from './ahri-fox-fires';
import type { AhriWVisualHistory } from './ahri-w-visual-history';
import { validateWVisualMotion } from './ahri-w-visual-history-validation';
import type { Team, Unit } from './types';
import type { Vec2 } from './math';

const same = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
export function validateWVisuals(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  ahriFoxFires: FoxFireCast[];
  ahriFoxFireAudio?: AhriFoxFireAudioRecord[];
  ahriWVisuals?: AhriWVisualHistory[];
}) {
  const fail = () => {
    throw new Error('Saved match contains invalid Ahri W visual history.');
  };
  const records = state.ahriWVisuals ?? [];
  const seen = new Set<number>();
  let previous = 0;
  for (const r of records) {
    const source = state.units.find((u) => u.id === r.sourceId);
    const live = state.ahriFoxFires.find((c) => c.id === r.id);
    if (
      r.id <= previous ||
      r.id >= state.nextId ||
      r.sourceId >= state.nextId ||
      r.startTick < 1 ||
      !source ||
      source.champion !== 'ahri' ||
      source.team !== r.team
    )
      fail();
    previous = r.id;
    seen.add(r.id);
    validateWVisualMotion(r, state.tick);
    if (r.fires.some((f) => !f.end)) {
      if (!live || state.winner) fail();
    } else if (
      state.tick >=
      Math.max(...r.fires.map((f) => f.end!.tick)) + AHRI_W_VISUAL_HISTORY_TICKS
    )
      fail();
    for (const f of r.fires) {
      if (f.dispatch && f.dispatch.targetId >= state.nextId) fail();
      const target = f.dispatch && state.units.find((u) => u.id === f.dispatch!.targetId);
      if (
        target &&
        (target.team === r.team || ['ward', 'turret', 'nexus', 'inhibitor'].includes(target.kind))
      )
        fail();
      if (f.end?.reason === 'match-end' && (!state.winner || f.end.tick !== state.tick)) fail();
    }
    if (live) {
      if (
        live.sourceId !== r.sourceId ||
        live.team !== r.team ||
        live.startTick !== r.startTick ||
        live.releaseTick !== r.releaseTick ||
        live.facing !== r.facing
      )
        fail();
      for (const [index, fire] of live.fires.entries()) {
        const f = r.fires[index];
        if (
          (fire.phase === 'spent') !== (f.end !== null) ||
          fire.dispatchTick !== (f.dispatch?.tick ?? null) ||
          fire.targetId !== (f.dispatch?.targetId ?? null) ||
          fire.stopTick !== (f.end?.tick ?? null) ||
          fire.stopReason !== (f.end?.reason ?? null) ||
          !same(fire.position, f.end?.point ?? f.frames.at(-1)!.point)
        )
          fail();
      }
    }
    const audio = state.ahriFoxFireAudio?.find((a) => a.id === r.id);
    if (audio) {
      if (
        audio.sourceId !== r.sourceId ||
        audio.team !== r.team ||
        audio.startTick !== r.startTick ||
        audio.facing !== r.facing ||
        !same(audio.origin, r.origin)
      )
        fail();
      for (const [index, a] of audio.fires.entries()) {
        const f = r.fires[index];
        if (!!a.launch !== !!f.dispatch || !!a.end !== !!f.end) fail();
        if (
          a.launch &&
          f.dispatch &&
          (a.launch.tick !== f.dispatch.tick ||
            a.launch.targetId !== f.dispatch.targetId ||
            !same(a.launch.origin, f.dispatch.point) ||
            !same(a.launch.sourcePoint, f.dispatch.sourcePoint))
        )
          fail();
        if (
          a.launch &&
          (!same(a.launch.currentPoint, f.end?.point ?? f.frames.at(-1)!.point) ||
            a.launch.audience.join() !== f.dispatch!.audience.join())
        )
          fail();
        if (
          a.end &&
          f.end &&
          (a.end.tick !== f.end.tick ||
            a.end.reason !== f.end.reason ||
            !same(a.end.point, f.end.point))
        )
          fail();
        if (a.end && a.end.audience.join() !== f.end!.audience.join()) fail();
      }
    }
  }
  if (state.ahriFoxFires.some((c) => !seen.has(c.id))) fail();
  for (const audio of state.ahriFoxFireAudio ?? []) {
    const active = audio.fires.some((f) => !f.end);
    const lastEnd = Math.max(...audio.fires.map((f) => f.end?.tick ?? state.tick));
    if ((active || state.tick < lastEnd + AHRI_W_VISUAL_HISTORY_TICKS) && !seen.has(audio.id))
      fail();
  }
}
