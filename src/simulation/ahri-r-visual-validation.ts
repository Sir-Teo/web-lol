import { championDeathTicks } from './champion-death';
import type { ChampionState, Team, Unit } from './types';
import type { SpiritRush } from './ahri-spirit-rush';
import type { AhriSpiritRushAudioRecord } from './ahri-spirit-rush-audio';
import type { AhriRVisualHistory, RVisualPose } from './ahri-r-visual-history';
import { validateRVisualMotion } from './ahri-r-visual-history-validation';
import { mobileRig } from '../content/mobile-clip-durations';
import { AHRI_R_VISUAL_HISTORY_TICKS as RETAIN } from '../content/ahri-r-visual-timing';
import { distance, type Vec2 } from './math';
const same = (a: Vec2, b: Vec2) => distance(a, b) <= 1e-6;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type Owner = Pick<ChampionState, 'id' | 'spellRanks'>;
export function validateRVisuals(
  state: {
    tick: number;
    nextId: number;
    winner: Team | null;
    units: Unit[];
    player: Owner;
    otherChampions: Owner[];
    ahriRushes: SpiritRush[];
    ahriSpiritRushAudio?: AhriSpiritRushAudioRecord[];
    ahriRVisuals?: AhriRVisualHistory[];
  },
  nonUnitIds: readonly number[] = []
) {
  const check = (ok: boolean) => {
    if (!ok) throw Error('Saved match contains invalid Ahri R visual history.');
  };
  const oldBodyDeath = (u: Unit, at: number) => {
    if (u.deadAt === at) return true;
    const next = u.deadAt ?? state.tick;
    const wait =
      u.kind === 'dummy' ? 180 : u.kind === 'champion' ? championDeathTicks(1, at) : Infinity;
    return next >= at + wait;
  };
  const records = state.ahriRVisuals ?? [],
    ids = new Set<number>(),
    keys = new Set<string>();
  const owners = [state.player, ...state.otherChampions];
  let previousTick = 0;
  const currentPose = (p: RVisualPose, u: Unit) =>
    check(
      p.tick === state.tick &&
        same(p.point, u) &&
        p.facing === u.facing &&
        p.radius === u.radius &&
        equal(p.animationTimeline, u.animationTimeline)
    );
  for (const r of records) {
    const source = state.units.find((u) => u.id === r.sourceId),
      owner = owners.find((o) => o.id === r.sourceId);
    const key = r.sourceId + ':' + r.startTick;
    check(
      !ids.has(r.id) &&
        !keys.has(key) &&
        r.id < state.nextId &&
        r.sourceId < state.nextId &&
        !!source &&
        source.champion === 'ahri' &&
        source.team === r.team &&
        !!owner &&
        owner.spellRanks.r > 0 &&
        r.startTick >= previousTick
    );
    ids.add(r.id);
    keys.add(key);
    previousTick = r.startTick;
    check(!state.units.some((u) => u.id === r.id));
    validateRVisualMotion(r, state.tick);
    if (!r.sourceEnd) currentPose(r.sourceFrames.at(-1)!, source!);
    else if (r.sourceEnd.reason === 'removed') check(!source);
    else check(oldBodyDeath(source!, r.sourceEnd.tick));
    if (r.end?.reason === 'match-end') check(!!state.winner && r.end.tick === state.tick);
    if (state.winner) check(r.end !== null);
    for (const c of r.changes) {
      if (c.reset) {
        check(
          c.reset.essenceId < state.nextId &&
            c.reset.victimId < state.nextId &&
            c.reset.essenceId !== r.id &&
            c.reset.victimId !== r.sourceId &&
            !state.units.some((u) => u.id === c.reset!.essenceId)
        );
        const victim = state.units.find((u) => u.id === c.reset!.victimId);
        if (victim) check(victim.kind === 'champion' && victim.team !== r.team);
      }
    }
    const live = state.ahriRushes.find((g) => g.id === r.id),
      audio = state.ahriSpiritRushAudio?.find((a) => a.id === r.id);
    if (live) {
      check(
        live.sourceId === r.sourceId &&
          live.team === r.team &&
          live.startTick === r.startTick &&
          live.endTick === r.windowEndTick &&
          live.remainingCasts === r.remainingCasts &&
          (live.stopTick !== null) === (r.end !== null)
      );
      if (r.end) check(r.end.tick === live.stopTick && r.end.reason === live.stopReason);
      for (const c of r.changes) if (c.reset) check(live.resets.some((e) => equal(e, c.reset)));
      for (const actual of live.bursts) {
        const end =
          actual.stopTick === null || actual.bolts.some((p) => p.stopTick === null)
            ? Infinity
            : Math.max(actual.stopTick, ...actual.bolts.map((p) => p.stopTick!));
        if (state.tick < end + RETAIN) check(r.bursts.some((b) => b.index === actual.index));
      }
    } else check(r.end !== null && r.bursts.every((b) => b.dashEnd && b.bolts.every((p) => p.end)));
    if (audio) {
      check(
        audio.sourceId === r.sourceId &&
          audio.team === r.team &&
          audio.startTick === r.startTick &&
          audio.windowEndTick === r.windowEndTick &&
          same(audio.origin, r.birthPose.point) &&
          (audio.end !== null) === (r.end !== null)
      );
      if (r.end)
        check(
          audio.end!.tick === r.end.tick &&
            audio.end!.reason === r.end.reason &&
            same(audio.end!.point, r.end.point)
        );
    }
    for (const b of r.bursts) {
      if (b.dashEnd?.reason === 'match-end') check(!!state.winner && b.dashEnd.tick === state.tick);
      check(owner!.spellRanks.r >= b.rank);
      const actual = live?.bursts.find((g) => g.index === b.index),
        sound = audio?.bursts.find((a) => a.index === b.index);
      if (live) check(!!actual);
      if (actual) {
        check(
          actual.rank === b.rank &&
            actual.startTick === b.startTick &&
            same(actual.origin, b.origin) &&
            same(actual.destination, b.destination) &&
            (actual.stopTick !== null) === (b.dashEnd !== null)
        );
        if (b.dashEnd)
          check(
            actual.stopTick === b.dashEnd.tick &&
              actual.stopReason === b.dashEnd.reason &&
              same(actual.stopPoint!, b.dashEnd.point) &&
              equal(actual.control, b.dashEnd.control)
          );
        else check(same(b.dashFrames.at(-1)!.point, source!));
        check(actual.bolts.length === b.bolts.length);
      }
      if (sound) {
        check(
          sound.tick === b.startTick &&
            same(sound.origin, b.origin) &&
            sound.dashEndTick === (b.dashEnd?.tick ?? null) &&
            sound.bolts.length === b.bolts.length
        );
      }
      for (const p of b.bolts) {
        check(
          p.targetId < state.nextId && p.targetId !== r.sourceId && !nonUnitIds.includes(p.targetId)
        );
        const target = state.units.find((u) => u.id === p.targetId);
        if (target)
          check(
            target.team !== r.team &&
              !['ward', 'turret', 'nexus', 'inhibitor'].includes(target.kind)
          );
        const bolt = actual?.bolts.find((g) => g.index === p.index),
          voice = sound?.bolts[p.index];
        if (bolt) {
          check(
            bolt.targetId === p.targetId &&
              (bolt.stopTick !== null) === (p.end !== null) &&
              same(bolt.position, p.frames.at(-1)?.point ?? p.birth.point)
          );
          if (p.end) check(bolt.stopTick === p.end.tick && bolt.stopReason === p.end.reason);
          if (p.frames.at(-1)?.tick === (bolt.stopTick ?? state.tick))
            check(same(bolt.previous, p.frames.at(-1)!.previous));
        }
        if (voice) {
          check(
            voice.targetId === p.targetId &&
              (voice.end !== null) === (p.end !== null) &&
              same(voice.currentPoint, p.frames.at(-1)?.point ?? p.birth.point)
          );
          if (p.end)
            check(
              voice.end!.tick === p.end.tick &&
                voice.end!.reason === p.end.reason &&
                same(voice.end!.point, p.end.point)
            );
        }
        if (p.end?.reason === 'match-end') check(!!state.winner && p.end.tick === state.tick);
        if (p.hit) {
          check(
            p.hit.targetTeam !== r.team &&
              (!target ||
                (target.team === p.hit.targetTeam && mobileRig(target) === p.hit.targetRig))
          );
          check(!!target || !!p.targetEnd);
          if (p.targetEnd?.reason === 'removed') check(!target);
          if (p.targetEnd?.reason === 'death' && target)
            check(oldBodyDeath(target, p.targetEnd.tick));
          if (!p.targetEnd && p.targetFrames.at(-1)!.tick === state.tick)
            currentPose(p.targetFrames.at(-1)!, target!);
        }
      }
    }
  }
  for (const live of state.ahriRushes) check(records.some((r) => r.id === live.id));
}
