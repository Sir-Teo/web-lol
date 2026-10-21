import profile from '../content/garen-q-silence-particles.json';
import type { ChampionState } from '../simulation/types';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** One icon per recipient. Local coalescing selects its oldest still-active Q
 * application, with source ID as tie-breaker. Generic silence cannot create or
 * prolong it. The source ten-second particle life is not stretched to CC length. */
export function garenQSilenceParticles(
  sources: readonly { id: number; records: ChampionState['garenQVisuals'] }[],
  tick: number
) {
  const chosen = new Map<
    number,
    {
      sourceId: number;
      castTick: number;
      attackTick: number;
      targetId: number;
      startTick: number;
      endTick: number;
      age: number;
    }
  >();
  if (!Number.isFinite(tick)) return [];
  for (const source of sources)
    for (const record of source.records)
      for (const attack of record.attacks) {
        if (!attack.impact || attack.silenceEndTick === null) continue;
        const startTick = attack.impact.tick,
          age = (tick - startTick - 1) / 60;
        if (age < 0 || age >= profile.life || tick >= attack.silenceEndTick) continue;
        const old = chosen.get(attack.targetId);
        if (
          old &&
          (old.startTick < startTick || (old.startTick === startTick && old.sourceId <= source.id))
        )
          continue;
        chosen.set(attack.targetId, {
          sourceId: source.id,
          castTick: record.startTick,
          attackTick: attack.startTick,
          targetId: attack.targetId,
          startTick,
          endTick: attack.silenceEndTick,
          age,
        });
      }
  return [...chosen.values()]
    .sort((a, b) => a.targetId - b.targetId)
    .map((p) => ({
      ...p,
      scale: profile.size.map(
        (v, i) => v * sampleParticleCurve(profile.scale, p.age / profile.life, i)
      ),
      lookup: particleColorLookup(profile, p.age / profile.life, 0),
      frame: 0,
    }));
}
