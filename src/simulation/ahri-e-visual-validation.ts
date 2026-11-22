import { AHRI_E_VISUAL_HISTORY_TICKS } from '../content/ahri-e-visual-timing';
import type { AhriCharmAudioRecord } from './ahri-charm-audio';
import { eVisualEndTick, type AhriEVisualHistory } from './ahri-e-visual-history';
import { validateEVisualMotion } from './ahri-e-visual-history-validation';
import type { ChampionState, Projectile, Team, Unit } from './types';
import type { Vec2 } from './math';
import { mobileRig } from '../content/mobile-clip-durations';

const same = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
const sameControl = (a: NonNullable<Unit['charm']>, b: NonNullable<Unit['charm']>) =>
  a.sourceId === b.sourceId &&
  a.rank === b.rank &&
  a.startTick === b.startTick &&
  a.endTick === b.endTick &&
  a.tenacityApplied === b.tenacityApplied;
type Owner = Pick<ChampionState, 'id' | 'spellRanks' | 'pendingCast'>;
export function validateEVisuals(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: Owner;
  otherChampions: Owner[];
  projectiles: Projectile[];
  ahriCharmAudio?: AhriCharmAudioRecord[];
  ahriEVisuals?: AhriEVisualHistory[];
}) {
  const check = (ok: boolean): void => {
    if (!ok) throw Error('Saved match contains invalid Ahri E visual history.');
  };
  const records = state.ahriEVisuals ?? [];
  const keys = new Set<string>(),
    flights = new Set<number>(),
    activeTargets = new Set<number>();
  const owners = [state.player, ...state.otherChampions];
  let previousTick = 0;
  for (const r of records) {
    const key = r.sourceId + ':' + r.castTick;
    const source = state.units.find((u) => u.id === r.sourceId);
    const owner = owners.find((o) => o.id === r.sourceId);
    check(
      !keys.has(key) &&
        r.castTick >= previousTick &&
        r.sourceId < state.nextId &&
        !!source &&
        source.champion === 'ahri' &&
        source.team === r.team &&
        !!owner &&
        owner.spellRanks.e >= r.rank
    );
    keys.add(key);
    previousTick = r.castTick;
    const cursor = validateEVisualMotion(r, state.tick);
    const end = eVisualEndTick(r);
    check(
      state.tick < end + AHRI_E_VISUAL_HISTORY_TICKS && (!state.winner || Number.isFinite(end))
    );
    const sourceFrame = r.sourceFrames.at(-1)!;
    check(
      sourceFrame.tick === state.tick &&
        same(sourceFrame.point, source!) &&
        sourceFrame.facing === source!.facing &&
        sourceFrame.radius === source!.radius &&
        JSON.stringify(sourceFrame.animationTimeline) === JSON.stringify(source!.animationTimeline)
    );
    check(r.castAudience.join() === r.sourceFrames[0].audience.join());
    if (r.cancel?.reason === 'match-end') check(!!state.winner && r.cancel.tick === state.tick);
    if (!r.launch && !r.cancel) {
      const pending = owner!.pendingCast;
      check(
        !state.winner &&
          pending?.ability === 'e' &&
          pending.startTick === r.castTick &&
          pending.releaseTick === r.releaseTick &&
          pending.rank === r.rank &&
          same(pending.point, r.aim)
      );
    }
    if (r.launch) {
      check(r.launch.projectileId < state.nextId && !flights.has(r.launch.projectileId));
      flights.add(r.launch.projectileId);
      const live = state.projectiles.find((p) => p.id === r.launch!.projectileId);
      if (!r.stop) {
        check(
          !state.winner &&
            !!live &&
            live.type === 'charm' &&
            live.source === r.sourceId &&
            live.team === r.team &&
            live.charmRank === r.rank &&
            live.launchTick === r.launch.tick &&
            !!live.origin &&
            same(live.origin, r.launch.point) &&
            same(live.direction, r.launch.direction) &&
            live.speed === r.launch.speed &&
            live.radius === r.launch.radius &&
            !!cursor.point &&
            same(live, cursor.point) &&
            !!cursor.previous &&
            same(live.previous, cursor.previous) &&
            Math.abs(live.remaining - cursor.remaining!) <= 1e-6
        );
      } else check(!live);
      if (r.stop?.reason === 'match-end') check(!!state.winner && r.stop.tick === state.tick);
      const last = r.flightFrames.at(-1);
      if (r.stop && last?.tick === r.stop.tick)
        check(last.audience.join() === r.stop.audience.join());
    }
    if (r.hit) {
      check(
        r.hit.targetId < state.nextId &&
          r.hit.audience.join() === r.stop!.audience.join() &&
          r.hit.targetAudience.join() === r.targetFrames[0].audience.join()
      );
      const target = state.units.find((u) => u.id === r.hit!.targetId);
      check(!!target || !!r.targetEnd);
      if (r.targetEnd?.reason === 'removed') check(!target);
      if (target) {
        check(
          target.team === r.hit.targetTeam &&
            mobileRig(target) === r.hit.targetRig &&
            !['ward', 'turret', 'nexus', 'inhibitor'].includes(target.kind)
        );
        const frame = r.targetFrames.at(-1)!;
        if (!r.targetEnd)
          check(
            frame.tick === state.tick &&
              same(frame.point, target) &&
              frame.facing === target.facing &&
              frame.radius === target.radius &&
              JSON.stringify(frame.animationTimeline) === JSON.stringify(target.animationTimeline)
          );
      }
      if (r.buff) {
        check(r.buff.audience.join() === r.targetFrames[0].audience.join());
        if (r.buff.control.tenacityApplied) check(target?.kind === 'champion');
        if (!r.buff.stop) {
          check(
            !state.winner &&
              !!target &&
              target.hp > 0 &&
              !!target.charm &&
              sameControl(r.buff.control, target.charm) &&
              !activeTargets.has(target.id)
          );
          activeTargets.add(target!.id);
        }
        if (r.buff.stop && r.buff.stop.reason !== 'replaced' && target?.charm)
          check(!sameControl(r.buff.control, target.charm));
        if (r.buff.stop?.reason === 'match-end')
          check(!!state.winner && r.buff.stop.tick === state.tick);
      }
    }
    const audio = state.ahriCharmAudio?.find(
      (a) => a.sourceId === r.sourceId && a.castTick === r.castTick
    );
    if (audio) {
      check(
        audio.team === r.team &&
          same(audio.origin, r.origin) &&
          audio.cancelTick === (r.cancel?.tick ?? null) &&
          !!audio.launch === !!r.launch &&
          !!audio.stop === !!r.stop &&
          !!audio.hit === !!r.hit
      );
      if (audio.launch && r.launch)
        check(
          audio.launch.id === r.launch.projectileId &&
            audio.launch.tick === r.launch.tick &&
            same(audio.launch.point, r.launch.point) &&
            same(audio.launch.currentPoint, r.stop?.point ?? cursor.point!) &&
            audio.launch.audience.join() === r.launch.audience.join()
        );
      if (audio.stop && r.stop)
        check(
          audio.stop.tick === r.stop.tick &&
            same(audio.stop.point, r.stop.point) &&
            audio.stop.reason === (r.stop.reason === 'removed' ? 'range' : r.stop.reason)
        );
      if (audio.hit && r.hit)
        check(
          audio.hit.tick === r.hit.tick &&
            audio.hit.targetId === r.hit.targetId &&
            same(audio.hit.point, r.hit.point) &&
            audio.hit.audience.join() === r.hit.audience.join()
        );
    }
  }
  for (const owner of owners) {
    const pending = owner.pendingCast;
    if (pending?.ability !== 'e') continue;
    const source = state.units.find((u) => u.id === owner.id);
    if (source?.champion !== 'ahri') continue;
    check(
      records.some(
        (r) => r.sourceId === owner.id && r.castTick === pending.startTick && !r.launch && !r.cancel
      )
    );
  }
  for (const p of state.projectiles)
    if (p.type === 'charm') check(records.some((r) => r.launch?.projectileId === p.id && !r.stop));
  for (const audio of state.ahriCharmAudio ?? [])
    check(keys.has(audio.sourceId + ':' + audio.castTick));
}
