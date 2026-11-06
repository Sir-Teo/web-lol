import { Euler, Quaternion, Vector3 } from 'three';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import { AHRI_W_PROFILES as profiles, type ahriWParticles } from './ahri-w-particles';
import { wVisualPose, wVisualKnown, wVisualDistance, type WVisualGroup } from './ahri-w-history';
import type { PackedTrailPoint } from './source-packed-trail-ribbon';
import type { SourceUvDraw } from './source-uv-layer';
type Particle = ReturnType<typeof ahriWParticles>[number];
const up = new Vector3(0, 1, 0),
  tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
/** Match surface placement's source-X reflection and Y-forward missile frame.
 * World acceleration stays outside that frame. Ground returns scene metres. */
export function wTrailPoints(
  group: WVisualGroup,
  particles: readonly Particle[],
  ground: (point: Vec2) => number,
  team: Team = 'blue'
): PackedTrailPoint[] {
  const uv = (draw: Particle['uv']): SourceUvDraw => ({
    turn: 0,
    scaleU: draw.scale[0],
    scaleV: draw.scale[1],
    offsetU: draw.offset[0],
    offsetV: draw.offset[1],
    cellU: draw.cell[0],
    cellV: draw.cell[1],
  });
  return particles
    .filter((p) => profiles[p.profileIndex].kind === 'trail')
    .sort((a, b) => a.profileIndex - b.profileIndex || a.ordinal - b.ordinal)
    .map((p) => {
      const profile = profiles[p.profileIndex],
        tick = group.startTick + p.bornTick;
      const born = wVisualPose(group, tick)!;
      // Current W trails are unbound. Fail if a future source edit requires a
      // current-root interpolation path instead of silently using birth roots.
      if (
        p.bind !== 0 ||
        p.sourceBind !== 0 ||
        !profile.local ||
        profile.particleLocal ||
        !p.tiling
      )
        throw Error('Unsupported W trail attachment');
      const frame = new Quaternion().setFromAxisAngle(up, born.facing).multiply(tilt);
      const offset = new Vector3(-p.offset[0], p.offset[1], p.offset[2]).applyQuaternion(frame);
      const rotation = new Quaternion().setFromEuler(
        new Euler(
          ...(p.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
          'YXZ'
        )
      );
      const side = new Vector3(1, 0, 0).applyQuaternion(rotation);
      side.x *= -1;
      side.applyQuaternion(frame);
      return {
        profileIndex: p.profileIndex,
        position: [
          born.x + offset.x - (p.worldOffset?.[0] ?? 0),
          (ground(born) + 0.9) * 100 + offset.y + (p.worldOffset?.[1] ?? 0),
          born.y + offset.z + (p.worldOffset?.[2] ?? 0),
        ],
        side: side.toArray(),
        halfWidth: p.size[0],
        tiling: p.tiling.slice(0, 2),
        odometer: wVisualDistance(group, tick),
        uv: uv(p.uv),
        multUv: p.multUv ? uv(p.multUv) : null,
        color: p.color,
        lookup: p.lookup,
        erosion: p.erosion,
        visible: wVisualKnown(group, tick, team),
      };
    });
}
