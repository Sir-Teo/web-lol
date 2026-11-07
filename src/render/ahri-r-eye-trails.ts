import { Euler, Quaternion, Vector3 } from 'three';
import type { Team } from '../simulation/types';
import {
  AHRI_R_PROFILES as profiles,
  AHRI_R_PREPARED_EYE_TRAIL_PROFILES,
  type AhriRParticle,
} from './ahri-r-particles';
import {
  rBuffVisualPose,
  rBuffVisualKnown,
  type RBuffVisualGroup,
} from './ahri-r-persistent-history';
import type { PackedTrailPoint } from './source-packed-trail-ribbon';
import type { SourceUvDraw } from './source-uv-layer';
const up = new Vector3(0, 1, 0);
/** Actor-facing arbitrary trails use saved eye positions, not a missile tilt.
 * Binding motion is already committed in each particle's world offset. The
 * selected local ordinary-ribbon mode measures live-run distance in the packed
 * writer; its unused lifetime odometer is deliberately not reconstructed. */
export function rEyeTrailPoints(
  group: RBuffVisualGroup,
  particles: readonly AhriRParticle[],
  positionAt: (tick: number) => Vector3 | null,
  at: number,
  team: Team = 'blue'
): PackedTrailPoint[] {
  if (group.system !== 'Ahri_R_Eyes') return [];
  const uv = (draw: AhriRParticle['uv']): SourceUvDraw => ({
    turn: 0,
    scaleU: draw.scale[0],
    scaleV: draw.scale[1],
    offsetU: draw.offset[0],
    offsetV: draw.offset[1],
    cellU: draw.cell[0],
    cellV: draw.cell[1],
  });
  return particles
    .filter((p) => AHRI_R_PREPARED_EYE_TRAIL_PROFILES.some((index) => index === p.profileIndex))
    .sort((a, b) => a.profileIndex - b.profileIndex || a.ordinal - b.ordinal)
    .map((p) => {
      const profile = profiles[p.profileIndex],
        tick = group.startTick + p.bornTick;
      if (
        p.bind !== 0 ||
        profile.particleLocal ||
        !p.tiling ||
        p.sourceBasis ||
        (profile.trail!.mode !== null && profile.trail!.mode !== 0)
      )
        throw Error('Unsupported R eye-trail attachment/mode');
      const pose = rBuffVisualPose(group, tick),
        point = pose ? positionAt(tick) : null;
      const frame = new Quaternion();
      if (profile.local && pose) frame.setFromAxisAngle(up, pose.facing);
      const offset = new Vector3(-p.offset[0], p.offset[1], p.offset[2]).applyQuaternion(frame);
      const rotation = new Quaternion().setFromEuler(
        new Euler(
          ...(p.rotation.map((value) => (value * Math.PI) / 180) as [number, number, number]),
          'YXZ'
        )
      );
      const side = new Vector3(1, 0, 0).applyQuaternion(rotation);
      side.x *= -1;
      side.applyQuaternion(frame);
      return {
        profileIndex: p.profileIndex,
        position: point
          ? [
              point.x * 100 + offset.x - (p.worldOffset?.[0] ?? 0),
              point.y * 100 + offset.y + (p.worldOffset?.[1] ?? 0),
              point.z * 100 + offset.z + (p.worldOffset?.[2] ?? 0),
            ]
          : [0, 0, 0],
        side: side.toArray(),
        halfWidth: p.size[0],
        tiling: p.tiling.slice(0, 2),
        odometer: 0,
        uv: uv(p.uv),
        multUv: p.multUv ? uv(p.multUv) : null,
        color: p.color,
        lookup: p.lookup,
        erosion: p.erosion,
        visible: !!point && rBuffVisualKnown(group, p.sourceBind > 0 ? at : tick, team),
      };
    });
}
