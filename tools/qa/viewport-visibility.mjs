/** Counts projected anchors, not model bounds, occlusion or HUD coverage. */
export function anchorInsideViewport(point, width, height) {
  return point.visible && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
}
