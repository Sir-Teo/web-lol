import * as THREE from 'three';
import type { BaronAttackVisual } from '../simulation/baron-attack-visuals';
import type { Vec2 } from '../simulation/math';
import { sampleBaronFlightRoot } from './baron-flight-history';
import { sourceFlightBasis } from './source-flight-basis';

/** Local private-preview policy, not recovered native missile height routing.
 * The saved muzzle offset decays over the initial target's planar distance;
 * the supplied elevation takes over above each recorded path point's terrain.
 * Target movement/death after launch cannot rewrite earlier projected roots. */
export class BaronFlightProjection {
  private readonly muzzle: THREE.Vector3;
  private readonly planarDistance: number;
  constructor(
    private readonly effect: BaronAttackVisual,
    launchMatrix: THREE.Matrix4,
    initialTarget: Vec2,
    private readonly ground: (point: Vec2) => number,
    private readonly targetElevation: number
  ) {
    this.muzzle = new THREE.Vector3().setFromMatrixPosition(launchMatrix).multiplyScalar(100);
    if (
      ![
        ...this.muzzle.toArray(),
        initialTarget.x,
        initialTarget.y,
        effect.origin.x,
        effect.origin.y,
        targetElevation,
      ].every(Number.isFinite) ||
      targetElevation < 0
    )
      throw RangeError('Invalid Baron local flight projection');
    this.planarDistance = Math.max(
      1,
      Math.hypot(initialTarget.x - effect.origin.x, initialTarget.y - effect.origin.y)
    );
    if (!Number.isFinite(this.planarDistance))
      throw RangeError('Invalid Baron initial target distance');
  }
  point(tick: number) {
    const frame = sampleBaronFlightRoot(this.effect, tick);
    if (!frame) throw RangeError('Baron flight projection lacks retained root');
    const height = this.ground(frame);
    if (!Number.isFinite(height)) throw RangeError('Invalid Baron flight terrain height');
    const progress = Math.min(frame.distance / this.planarDistance, 1),
      remaining = 1 - progress;
    return [
      frame.x + (this.muzzle.x - this.effect.origin.x) * remaining,
      this.muzzle.y * remaining + (height * 100 + this.targetElevation) * progress,
      frame.y + (this.muzzle.z - this.effect.origin.y) * remaining,
    ];
  }
  sample(tick: number) {
    const origin = this.point(tick),
      at = Math.min(tick, this.effect.stopTick ?? tick),
      previous = Math.max(this.effect.launchTick, at - 1),
      a = this.point(previous),
      b = this.point(at);
    const direction = b.map((value, axis) => value - a[axis]);
    if (Math.hypot(...direction) === 0) {
      const frame = sampleBaronFlightRoot(this.effect, at)!;
      direction[0] = Math.sin(frame.facing);
      direction[2] = Math.cos(frame.facing);
    }
    return { origin, orientation: sourceFlightBasis(direction) };
  }
}
