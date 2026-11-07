import { Euler, Quaternion, Vector3 } from 'three';
import type { Vec2 } from '../simulation/math';
import type { Team } from '../simulation/types';
import { AHRI_R_PROFILES as profiles, type ahriRParticles } from './ahri-r-particles';
import { rVisualPose, rVisualKnown, rVisualDistance, type RVisualGroup } from './ahri-r-history';
import type { PackedTrailPoint } from './source-packed-trail-ribbon';
import type { SourceUvDraw } from './source-uv-layer';
type Particle = ReturnType<typeof ahriRParticles>[number];
const up = new Vector3(0, 1, 0),
  tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
/** Match surface placement's source-X reflection and Y-forward missile frame.
 * World acceleration stays outside that frame. Ground returns scene metres. */
export function rTrailPoints(
  group: RVisualGroup,
  particles: readonly Particle[],
  ground: (point: Vec2) => number,
  at: number,
  team: Team = 'blue'
): PackedTrailPoint[] {
  if (group.role !== 'flight') return [];
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
      const born = rVisualPose(group, tick)!;
      // SourceBindingTimeline has already committed binding motion into the
      // world offset. Root rotation follows the authored local flag; bound
      // particles must not apply the caster translation a second time.
      // Positive partial binding uses current sight; geometry is clipped again
      // at its actual world point by the renderer. Ground-layer metadata does
      // not turn a trail primitive into a projected quad.
      if (p.bind !== 0 || profile.particleLocal || !p.tiling)
        throw Error('Unsupported R trail attachment');
      const frame = new Quaternion();
      if (profile.local) frame.setFromAxisAngle(up, born.facing).multiply(tilt);
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
          (ground(born) + 1) * 100 + offset.y + (p.worldOffset?.[1] ?? 0),
          born.y + offset.z + (p.worldOffset?.[2] ?? 0),
        ],
        side: side.toArray(),
        halfWidth: p.size[0],
        tiling: p.tiling.slice(0, 2),
        odometer: rVisualDistance(group, tick),
        uv: uv(p.uv),
        multUv: p.multUv ? uv(p.multUv) : null,
        color: p.color,
        lookup: p.lookup,
        erosion: p.erosion,
        visible: rVisualKnown(group, p.sourceBind > 0 ? at : tick, team),
      };
    });
}
