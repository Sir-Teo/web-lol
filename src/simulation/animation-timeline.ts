import type { MobilePose } from '../render/mobile-pose';
export interface PoseLayer {
  clip: string;
  time: number;
  rate: number;
  loop: boolean;
  weight: number;
}
export interface AnimationTimeline {
  tick: number;
  primary: MobilePose;
  transition: { startTick: number; outgoing: PoseLayer[] } | null;
}
export const ANIMATION_FADE_TICKS = 0.08 * 60;
function timeAt(
  layer: Pick<PoseLayer, 'time' | 'rate' | 'loop' | 'clip'>,
  seconds: number,
  durations: Readonly<Record<string, number>>
) {
  const duration = durations[layer.clip];
  const time = Math.max(0, layer.time + seconds * layer.rate);
  return layer.loop && duration > 0 ? time % duration : Math.min(time, duration);
}
/** Explicit normal-blend layers. The remainder below unit weight is rest pose,
 * matching Three's normal animation blending. This is the local 80 ms policy,
 * not a reconstruction of the native animation graph's transitions.
 */
export function animationLayers(
  state: AnimationTimeline,
  at: number,
  durations: Readonly<Record<string, number>>
): PoseLayer[] {
  const transition = state.transition;
  const share = transition
    ? Math.max(0, Math.min(1, (at - transition.startTick) / ANIMATION_FADE_TICKS))
    : 1;
  const layers: PoseLayer[] = [];
  if (share > 0)
    layers.push({
      ...state.primary,
      time: timeAt(state.primary, (at - state.tick) / 60, durations),
      weight: share,
    });
  if (transition && share < 1)
    for (const layer of transition.outgoing) {
      const weight = layer.weight * (1 - share);
      if (weight > 0)
        layers.push({
          ...layer,
          time: timeAt(layer, (at - transition.startTick) / 60, durations),
          weight,
        });
    }
  return layers;
}
export function advanceAnimationTimeline(
  previous: AnimationTimeline | null,
  primary: MobilePose,
  tick: number,
  durations: Readonly<Record<string, number>>
): AnimationTimeline {
  let transition = previous?.transition ?? null;
  if (!previous || primary.cut) transition = null;
  else if (previous.primary.clip !== primary.clip) {
    transition = {
      startTick: tick,
      outgoing: animationLayers(previous, tick, durations)
        .filter((layer) => layer.clip !== primary.clip && layer.weight > 1e-8)
        .map(({ clip, time, rate, loop, weight }) => ({ clip, time, rate, loop, weight })),
    };
  } else if (transition && tick - 1 >= transition.startTick + ANIMATION_FADE_TICKS)
    transition = null;
  return { tick, primary, transition };
}
