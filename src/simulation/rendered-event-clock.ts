/** First fixed-step crossing of a retained rendered sample clock.
 * This does not assign native animation callback semantics. */
export function renderedEventTick(
  record: { startTick: number; endTick: number },
  marker: { renderedSeconds: number; renderedDuration: number },
  errorMessage = 'Invalid rendered event cycle'
): number {
  if (
    !Number.isSafeInteger(record.startTick) ||
    !Number.isSafeInteger(record.endTick) ||
    record.endTick <= record.startTick ||
    !Number.isFinite(marker.renderedSeconds) ||
    !Number.isFinite(marker.renderedDuration) ||
    marker.renderedSeconds < 0 ||
    marker.renderedDuration <= 0 ||
    marker.renderedSeconds > marker.renderedDuration
  )
    throw RangeError(errorMessage);
  const duration = record.endTick - record.startTick;
  const rate = marker.renderedDuration / (duration / 60);
  let offset = Math.max(
    0,
    Math.ceil((marker.renderedSeconds / marker.renderedDuration) * duration)
  );
  while (offset > 0 && ((offset - 1) / 60) * rate >= marker.renderedSeconds) offset--;
  while ((offset / 60) * rate < marker.renderedSeconds) offset++;
  return record.startTick + offset;
}
