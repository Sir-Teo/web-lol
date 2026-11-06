import { AHRI_SPIRIT_RUSH_AUDIO_TICKS as T } from '../content/ahri-spirit-rush-audio-timing';
import type { SpiritRush, SpiritBurst, SpiritBolt } from './ahri-spirit-rush';
import type { Vec2 } from './math';
import type { Team, Unit } from './types';
import type { World } from './world';

export interface AhriSpiritRushAudioRecord {
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  windowEndTick: number;
  origin: Vec2;
  audience: Team[];
  end: {
    tick: number;
    point: Vec2;
    reason: 'expired' | 'death' | 'match-end';
    audience: Team[];
  } | null;
  bursts: {
    index: number;
    tick: number;
    origin: Vec2;
    audience: Team[];
    dashEndTick: number | null;
    bolts: {
      index: number;
      targetId: number;
      currentPoint: Vec2;
      end: {
        tick: number;
        point: Vec2;
        reason: 'hit' | 'lost-target' | 'expired' | 'match-end';
        audience: Team[];
      } | null;
    }[];
  }[];
}
export interface SpiritRushAudioWorld {
  tick: number;
  ahriSpiritRushAudio?: AhriSpiritRushAudioRecord[];
  unit(id: number): Unit | undefined;
  pointVisible?(point: Vec2, team: Team): boolean;
}
const point = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: SpiritRushAudioWorld, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible?.(p, t));
const record = (w: Pick<SpiritRushAudioWorld, 'ahriSpiritRushAudio'>, rush: SpiritRush) =>
  w.ahriSpiritRushAudio?.find((r) => r.id === rush.id);
export function beginSpiritRushAudio(
  w: SpiritRushAudioWorld,
  rush: SpiritRush,
  burst: SpiritBurst
) {
  if (!w.ahriSpiritRushAudio) return;
  let r = record(w, rush);
  if (!r) {
    r = {
      id: rush.id,
      sourceId: rush.sourceId,
      team: rush.team,
      startTick: rush.startTick,
      windowEndTick: rush.endTick,
      origin: point(burst.origin),
      audience: audience(w, burst.origin, rush.team),
      end: null,
      bursts: [],
    };
    w.ahriSpiritRushAudio.push(r);
  }
  r.bursts.push({
    index: burst.index,
    tick: burst.startTick,
    origin: point(burst.origin),
    audience: audience(w, burst.origin, rush.team),
    dashEndTick: null,
    bolts: burst.bolts.map((b) => ({
      index: b.index,
      targetId: b.targetId,
      currentPoint: point(b.position),
      end: null,
    })),
  });
}
export function updateSpiritRushAudioWindow(
  w: Pick<SpiritRushAudioWorld, 'ahriSpiritRushAudio'>,
  rush: SpiritRush
) {
  const r = record(w, rush);
  if (r) r.windowEndTick = rush.endTick;
}
/** Dash completion is retained for exact restoration; finite cast audio is not cut. */
export function endSpiritDashAudio(w: SpiritRushAudioWorld, sourceId: number, dash: SpiritBurst) {
  for (const r of w.ahriSpiritRushAudio ?? []) {
    if (r.sourceId !== sourceId) continue;
    const b = r.bursts.find((b) => b.index === dash.index && b.tick === dash.startTick);
    if (b) b.dashEndTick = dash.stopTick;
  }
}
export function stopSpiritRushAudio(w: SpiritRushAudioWorld, rush: SpiritRush) {
  const r = record(w, rush);
  if (!r || r.end || rush.stopTick === null) return;
  r.windowEndTick = rush.endTick;
  const p = point(w.unit(r.sourceId) ?? r.origin);
  r.end = {
    tick: rush.stopTick,
    point: p,
    reason: rush.stopReason!,
    audience: audience(w, p, r.team),
  };
}
export function finishSpiritBoltAudio(
  w: SpiritRushAudioWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  bolt: SpiritBolt
) {
  const r = record(w, rush),
    b = r?.bursts[burst.index],
    p = point(bolt.position);
  if (!r || !b || b.bolts[bolt.index].end) return;
  const audio = b.bolts[bolt.index];
  audio.currentPoint = p;
  audio.end = {
    tick: w.tick,
    point: p,
    reason: bolt.stopReason!,
    audience: audience(w, p, r.team),
  };
}
export function finishAllSpiritRushAudio(w: World) {
  for (const r of w.ahriSpiritRushAudio) {
    const live = w.ahriRushes.find((a) => a.id === r.id);
    if (!r.end) {
      const p = point(w.unit(r.sourceId) ?? r.origin);
      r.end = { tick: w.tick, point: p, reason: 'match-end', audience: audience(w, p, r.team) };
    }
    for (const b of r.bursts) {
      b.dashEndTick ??= w.tick;
      for (const bolt of b.bolts) {
        if (bolt.end) continue;
        const p = point(live?.bursts[b.index].bolts[bolt.index].position ?? bolt.currentPoint);
        bolt.currentPoint = p;
        bolt.end = {
          tick: w.tick,
          point: p,
          reason: 'match-end',
          audience: audience(w, p, r.team),
        };
      }
    }
  }
}
export function spiritRushAudioExpiry(r: AhriSpiritRushAudioRecord) {
  if (!r.end || r.bursts.some((b) => b.dashEndTick === null || b.bolts.some((p) => !p.end)))
    return Infinity;
  let expiry = Math.max(r.end.tick + T.deactivate, r.end.tick + T.activationLocalStop);
  for (const b of r.bursts) {
    expiry = Math.max(expiry, b.tick + T.cast);
    for (const p of b.bolts) {
      expiry = Math.max(expiry, Math.min(b.tick + T.launch, p.end!.tick + T.launchStop));
      if (p.end!.reason === 'hit') expiry = Math.max(expiry, p.end!.tick + T.hit);
    }
  }
  return expiry;
}
/** Observe existing clocks/IDs only; no gameplay RNG or identity allocation. */
export function advanceSpiritRushAudio(w: World) {
  if (!w.ahriSpiritRushAudio.length) return;
  for (const r of w.ahriSpiritRushAudio) {
    const live = w.ahriRushes.find((a) => a.id === r.id);
    if (live) {
      r.windowEndTick = live.endTick;
      for (const b of r.bursts)
        for (const p of b.bolts)
          if (!p.end) p.currentPoint = point(live.bursts[b.index].bolts[p.index].position);
    }
    if (r.startTick === w.tick) r.audience = audience(w, r.origin, r.team);
    if (r.end?.tick === w.tick) r.end.audience = audience(w, r.end.point, r.team);
    for (const b of r.bursts) {
      if (b.tick === w.tick) b.audience = audience(w, b.origin, r.team);
      for (const p of b.bolts)
        if (p.end?.tick === w.tick) p.end.audience = audience(w, p.end.point, r.team);
    }
  }
  w.ahriSpiritRushAudio = w.ahriSpiritRushAudio.filter((r) => w.tick < spiritRushAudioExpiry(r));
}
