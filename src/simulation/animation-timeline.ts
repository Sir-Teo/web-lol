import type { MobilePose } from '../render/mobile-pose';
export interface PoseLayer {
  clip: string;
  time: number;
  rate: number;
  loop: boolean;
  unclampedTime: number;
  weight: number;
}
export interface AnimationTimeline {
  tick: number;
  primary: MobilePose;
  transition: { startTick: number; outgoing: PoseLayer[] } | null;
}
/** Owned snapshot of the known timeline schema. Primary poses and outgoing
 * layers contain scalar fields; every mutable object/array remains independent.
 * Keep source property order and numbers without serialization or quantization. */
export function cloneAnimationTimeline(state: AnimationTimeline | null): AnimationTimeline | null {
  if (state === null) return null;
  return {
    ...state,
    primary: { ...state.primary },
    transition: state.transition
      ? { ...state.transition, outgoing: state.transition.outgoing.map((layer) => ({ ...layer })) }
      : null,
  };
}
export const ANIMATION_FADE_TICKS = 0.08 * 60;
function timeAt(
  layer: Pick<PoseLayer, 'time' | 'rate' | 'loop' | 'unclampedTime' | 'clip'>,
  seconds: number,
  durations: Readonly<Record<string, number>>
) {
  const duration = durations[layer.clip];
  const time = Math.max(0, layer.unclampedTime + seconds * layer.rate);
  return {
    time: layer.loop && duration > 0 ? time % duration : Math.min(time, duration),
    unclampedTime: time,
  };
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
      ...timeAt(state.primary, (at - state.tick) / 60, durations),
      weight: share,
    });
  if (transition && share < 1)
    for (const layer of transition.outgoing) {
      const weight = layer.weight * (1 - share);
      if (weight > 0)
        layers.push({
          ...layer,
          ...timeAt(layer, (at - transition.startTick) / 60, durations),
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
        .map(({ clip, time, rate, loop, unclampedTime, weight }) => ({
          clip,
          time,
          rate,
          loop,
          unclampedTime,
          weight,
        })),
    };
  } else if (transition && tick - 1 >= transition.startTick + ANIMATION_FADE_TICKS)
    transition = null;
  return { tick, primary, transition };
}

export function validAnimationTimeline(
  timeline: AnimationTimeline | null,
  durations: Readonly<Record<string, number>> | undefined,
  at: number
): boolean {
  if (!!durations !== !!timeline) return false;
  if (!timeline || !durations) return true;
  const layers = [timeline.primary, ...(timeline.transition?.outgoing ?? [])];
  const outgoing = timeline.transition?.outgoing ?? [];
  return !(
    timeline.tick > at ||
    layers.some((layer) => {
      if (!Object.hasOwn(durations, layer.clip) || layer.time > durations[layer.clip] + 1e-7)
        return true;
      const duration = durations[layer.clip];
      const mappedTime =
        layer.loop && duration > 0
          ? layer.unclampedTime % duration
          : Math.min(layer.unclampedTime, duration);
      return Math.abs(layer.time - mappedTime) > 1e-7;
    }) ||
    new Set(outgoing.map((layer) => layer.clip)).size !== outgoing.length ||
    outgoing.some((layer) => layer.clip === timeline.primary.clip) ||
    outgoing.reduce((sum, layer) => sum + layer.weight, 0) > 1 + 1e-7 ||
    (timeline.transition &&
      (timeline.primary.cut ||
        timeline.transition.startTick > timeline.tick ||
        timeline.tick - 1 >= timeline.transition.startTick + ANIMATION_FADE_TICKS))
  );
}
