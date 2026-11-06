import { AHRI_R } from '../content/ahri-r';
import { AHRI_R_POLICY as R } from '../content/ahri-r-policy';
import { spiritRushAudioExpiry, type AhriSpiritRushAudioRecord } from './ahri-spirit-rush-audio';
import type { SpiritRush } from './ahri-spirit-rush';
import type { FoxFireCast } from './ahri-fox-fires';
import type { AhriOrb } from './ahri-orbs';
import type { ChampionState, Projectile, Team, Unit } from './types';
import type { Vec2 } from './math';

export function validateSpiritRushAudio(state: {
  tick: number;
  nextId: number;
  winner: Team | null;
  units: Unit[];
  player: ChampionState;
  otherChampions: ChampionState[];
  projectiles: Projectile[];
  ahriOrbs: AhriOrb[];
  ahriFoxFires: FoxFireCast[];
  ahriRushes: SpiritRush[];
  ahriSpiritRushAudio?: AhriSpiritRushAudioRecord[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Ahri Spirit Rush audio history.');
  };
  const equal = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
  const records = state.ahriSpiritRushAudio ?? [],
    ids = new Set<number>(),
    keys = new Set<string>();
  const maximumDashTicks = Math.ceil((AHRI_R.dashDistance / AHRI_R.baseDashSpeed) * 60);
  let previousTick = -1;
  for (const r of records) {
    const owner = state.units.find((u) => u.id === r.sourceId),
      champion = [state.player, ...state.otherChampions].find((s) => s.id === r.sourceId);
    const live = state.ahriRushes.find((a) => a.id === r.id),
      key = `${r.sourceId}:${r.startTick}`;
    if (
      ids.has(r.id) ||
      keys.has(key) ||
      r.id >= state.nextId ||
      owner?.champion !== 'ahri' ||
      owner.team !== r.team ||
      !champion?.spellRanks.r ||
      r.startTick < 1 ||
      r.startTick > state.tick ||
      r.startTick < previousTick ||
      state.tick >= spiritRushAudioExpiry(r) ||
      r.windowEndTick < r.startTick + R.recastWindowTicks ||
      r.windowEndTick >
        Math.max(
          r.startTick + R.recastWindowTicks,
          state.tick + Math.round(AHRI_R.passiveDurationExtensionSeconds * 60)
        ) ||
      state.units.some((u) => u.id === r.id) ||
      state.projectiles.some((p) => p.id === r.id) ||
      state.ahriOrbs.some((o) => o.id === r.id) ||
      state.ahriFoxFires.some((f) => f.id === r.id)
    )
      fail();
    ids.add(r.id);
    keys.add(key);
    previousTick = r.startTick;
    for (const a of [
      r.audience,
      r.end?.audience,
      ...r.bursts.flatMap((b) => [b.audience, ...b.bolts.map((p) => p.end?.audience)]),
    ])
      if (
        a &&
        (!a.includes(r.team) ||
          new Set(a).size !== a.length ||
          a.join() !== ['blue', 'red'].filter((t) => a.includes(t as Team)).join())
      )
        fail();
    if (
      !r.bursts.length ||
      r.bursts[0].tick !== r.startTick ||
      !equal(r.origin, r.bursts[0].origin) ||
      r.audience.join() !== r.bursts[0].audience.join()
    )
      fail();
    if (
      live &&
      (live.sourceId !== r.sourceId ||
        live.team !== r.team ||
        live.startTick !== r.startTick ||
        live.endTick !== r.windowEndTick ||
        live.bursts.length !== r.bursts.length ||
        (live.stopTick !== null) !== !!r.end ||
        (r.end && (r.end.tick !== live.stopTick || r.end.reason !== live.stopReason)))
    )
      fail();
    if (
      !live &&
      (!r.end || r.bursts.some((b) => b.dashEndTick === null || b.bolts.some((p) => !p.end)))
    )
      fail();
    if (r.end) {
      if (
        r.end.tick < r.startTick ||
        r.end.tick > state.tick ||
        (r.end.reason !== 'match-end' && r.end.tick > r.windowEndTick)
      )
        fail();
      if (r.end.reason === 'expired' && r.end.tick !== r.windowEndTick) fail();
      if (r.end.reason === 'death' && owner!.deadAt !== r.end.tick) fail();
      if (r.end.reason === 'match-end' && (!state.winner || r.end.tick !== state.tick)) fail();
    }
    for (let i = 0; i < r.bursts.length; i++) {
      const b = r.bursts[i],
        actual = live?.bursts[i],
        targets = new Set<number>();
      if (
        b.index !== i ||
        b.tick > state.tick ||
        b.tick >= r.windowEndTick ||
        (r.end && b.tick > r.end.tick) ||
        (i > 0 && b.tick < r.bursts[i - 1].tick + R.recastLockoutTicks) ||
        (b.dashEndTick !== null &&
          (b.dashEndTick < b.tick ||
            b.dashEndTick > state.tick ||
            b.dashEndTick > b.tick + maximumDashTicks))
      )
        fail();
      if (
        actual &&
        (actual.startTick !== b.tick ||
          actual.index !== b.index ||
          !equal(actual.origin, b.origin) ||
          actual.stopTick !== b.dashEndTick ||
          actual.bolts.length !== b.bolts.length)
      )
        fail();
      for (let j = 0; j < b.bolts.length; j++) {
        const p = b.bolts[j],
          e = p.end,
          bolt = actual?.bolts[j],
          target = state.units.find((u) => u.id === p.targetId);
        if (
          p.index !== j ||
          targets.has(p.targetId) ||
          p.targetId >= state.nextId ||
          p.targetId === r.sourceId ||
          (target &&
            (target.team === r.team ||
              ['ward', 'turret', 'nexus', 'inhibitor'].includes(target.kind)))
        )
          fail();
        targets.add(p.targetId);
        const steps = (e?.tick ?? state.tick) - b.tick + 1;
        if (
          Math.hypot(p.currentPoint.x - b.origin.x, p.currentPoint.y - b.origin.y) >
          (steps * AHRI_R.missile.speed) / 60 + 1e-6
        )
          fail();
        if (
          e &&
          (e.tick < b.tick ||
            e.tick > state.tick ||
            e.tick > b.tick + R.maximumBoltTicks ||
            !equal(p.currentPoint, e.point) ||
            (e.reason === 'expired' && e.tick !== b.tick + R.maximumBoltTicks) ||
            (e.reason === 'match-end' && (!state.winner || e.tick !== state.tick)))
        )
          fail();
        if (
          bolt &&
          (bolt.index !== p.index ||
            bolt.targetId !== p.targetId ||
            !equal(bolt.position, p.currentPoint) ||
            (bolt.stopTick !== null) !== !!e ||
            (e && (e.tick !== bolt.stopTick || e.reason !== bolt.stopReason)))
        )
          fail();
      }
    }
    if (
      state.winner &&
      (!r.end || r.bursts.some((b) => b.dashEndTick === null || b.bolts.some((p) => !p.end)))
    )
      fail();
  }
  for (const live of state.ahriRushes) if (!records.some((r) => r.id === live.id)) fail();
}
