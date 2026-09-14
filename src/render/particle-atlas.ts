/** Static atlas cell in source texture coordinates: U right, V down.
 * The texture must use flipY=false. This does not implement animated books,
 * within-cell wrapping, scroll, rotation, padding or native filtering.
 */
export function particleAtlasUv(
  columns: number,
  rows: number,
  frame: number,
  u: number,
  v: number
): [number, number] {
  if (
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    !Number.isSafeInteger(rows) ||
    rows < 1 ||
    !Number.isSafeInteger(columns * rows) ||
    !Number.isSafeInteger(frame) ||
    frame < 0 ||
    frame >= columns * rows ||
    !Number.isFinite(u) ||
    !Number.isFinite(v) ||
    u < 0 ||
    u > 1 ||
    v < 0 ||
    v > 1
  )
    throw new RangeError('Invalid static particle atlas cell or local UV');
  return [((frame % columns) + u) / columns, (Math.floor(frame / columns) + v) / rows];
}
