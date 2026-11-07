/** Local presentation retention, not native callback or constructor timing.
 * Twelve seconds cover the longest authored finite linger (10.35 s). Long-lived
 * fully bound single particles retain independent birth/charge anchors. */
export const AHRI_R_VISUAL_HISTORY_TICKS = 720;
export const AHRI_R_VISUAL_POSE_TICKS = 720;
/** Profile 49 is one sixty-second particle with per-update source binding.
 * Keep its complete path only while it can still be alive. Two updates cover
 * first-update birth and fractional render neighbours; this is local retention. */
export const AHRI_R_LAYOUT_SOURCE_POSE_TICKS = 60 * 60 + 2;
export function ahriRSourcePoseTicks(startTick: number, stopTick: number | null, tick: number) {
  return stopTick === null && tick - startTick <= AHRI_R_LAYOUT_SOURCE_POSE_TICKS
    ? AHRI_R_LAYOUT_SOURCE_POSE_TICKS
    : AHRI_R_VISUAL_POSE_TICKS;
}
