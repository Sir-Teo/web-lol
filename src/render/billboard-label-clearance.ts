import { Camera, Vector3 } from 'three';

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface OverheadLabelBounds {
  viewport: ScreenRect;
  label: ScreenRect;
}
export type OverheadLabelReader = (unitId: number) => OverheadLabelBounds | undefined;
export const OVERHEAD_LABEL_GAP = 4;

const right = new Vector3(),
  up = new Vector3(),
  corner = new Vector3(),
  projected = new Vector3();

/** Local UI clearance in CSS pixels. Lift a camera-facing quad above its own
 * label, preserving projected X, depth, world scale and source appearance.
 * The caller retains the original attachment point; this is not native Flex sizing.
 * Returns the lift in pixels and updates the supplied center. */
export function clearBillboardLabel(
  center: Vector3,
  halfSize: { x: number; y: number },
  camera: Camera,
  viewport: ScreenRect,
  label: ScreenRect,
  gap = OVERHEAD_LABEL_GAP
) {
  if (
    ![
      ...center,
      halfSize.x,
      halfSize.y,
      viewport.left,
      viewport.top,
      viewport.width,
      viewport.height,
      label.left,
      label.top,
      label.width,
      label.height,
      gap,
    ].every(Number.isFinite) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    label.width <= 0 ||
    label.height <= 0 ||
    gap < 0
  )
    return 0;
  camera.updateMatrixWorld();
  projected.copy(center).project(camera);
  if (projected.z < -1 || projected.z > 1 || ![...projected].every(Number.isFinite)) return 0;
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  let left = Infinity,
    edge = -Infinity,
    bottom = -Infinity;
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      corner
        .copy(center)
        .addScaledVector(right, x * Math.abs(halfSize.x))
        .addScaledVector(up, y * Math.abs(halfSize.y))
        .project(camera);
      const px = viewport.left + ((corner.x + 1) * viewport.width) / 2,
        py = viewport.top + ((1 - corner.y) * viewport.height) / 2;
      left = Math.min(left, px);
      edge = Math.max(edge, px);
      bottom = Math.max(bottom, py);
    }
  if (edge < label.left || left > label.left + label.width) return 0;
  const lift = Math.max(0, bottom - label.top + gap);
  if (lift > 0) {
    projected.y += (2 * lift) / viewport.height;
    center.copy(projected).unproject(camera);
  }
  return lift;
}
