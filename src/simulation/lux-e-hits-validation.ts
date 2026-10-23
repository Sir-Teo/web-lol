import { LUX_E_HIT_HISTORY_TICKS } from '../content/lux-e-hit';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { isStructureKind, type Singularity, type Unit } from './types';
export function validateLuxEHits(state: {
  tick: number;
  nextId: number;
  singularities: Singularity[];
  units: Unit[];
}) {
  const fail = () => {
    throw Error('Saved match contains invalid Lucent target-hit history.');
  };
  for (const zone of state.singularities) {
    const start = zone.detonatedTick;
    if (start === null || state.tick >= start + LUX_E_HIT_HISTORY_TICKS) {
      if (zone.hits.length) fail();
      continue;
    }
    const seen = new Set<number>();
    for (const hit of zone.hits) {
      const target = state.units.find((u) => u.id === hit.targetId),
        last = hit.frames.at(-1)!;
      if (
        seen.has(hit.targetId) ||
        hit.targetId >= state.nextId ||
        hit.targetTeam === zone.team ||
        (hit.targetTeam !== 'neutral' && !hit.audience.includes(hit.targetTeam)) ||
        Math.hypot(hit.contact.x - zone.x, hit.contact.y - zone.y) >
          LUX_E_POLICY.radius + hit.targetRadius + 1e-6 ||
        (target &&
          (target.team !== hit.targetTeam ||
            target.radius !== hit.targetRadius ||
            isStructureKind(target.kind) ||
            target.kind === 'ward')) ||
        hit.frames[0].x !== hit.contact.x ||
        hit.frames[0].y !== hit.contact.y ||
        hit.frames.length !== state.tick - start + 1 ||
        hit.frames.some((f, i) => f.tick !== start + i) ||
        (hit.detachedTick !== null &&
          (hit.detachedTick < start || hit.detachedTick > state.tick)) ||
        (hit.detachedTick === null &&
          (!target || target.hp <= 0 || last.x !== target.x || last.y !== target.y))
      )
        fail();
      seen.add(hit.targetId);
      if (hit.detachedTick !== null) {
        const stop = hit.frames[hit.detachedTick - start];
        if (
          hit.frames.some((f) => f.tick >= hit.detachedTick! && (f.x !== stop.x || f.y !== stop.y))
        )
          fail();
      }
    }
  }
}
