import { LEONA_RECALL_CLIPS } from '../content/leona-presentation';
// Source sequence order is pinned in the champion model reference records.
export const ASHE_RECALL_CLIPS = ['idle5', 'idle2'] as const;
export function recallAnimationPose(
  champion: import('../simulation/types').ChampionIdentity | undefined,
  seconds: number,
  durations: Readonly<Record<string, number>>
) {
  let time = Math.max(0, seconds);
  const clips =
    champion === 'leona'
      ? LEONA_RECALL_CLIPS
      : champion === 'garen'
        ? ['recall']
        : champion === 'lux'
          ? ['idle3', 'entry_b4dcde19']
          : ASHE_RECALL_CLIPS;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i],
      duration = durations[clip];
    if (!Number.isFinite(duration) || duration < 0) throw new Error(`Missing recall clip: ${clip}`);
    if (time < duration || i === clips.length - 1)
      return { clip, time: Math.min(time, duration), unclampedTime: time };
    time -= duration;
  }
  throw new Error('Empty recall sequence');
}
