import type * as THREE from 'three';
import type { Vec2 } from '../simulation/math';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { ZENITH_PROFILES, zenithParticles } from './leona-zenith-particles';
import {
  zenithBirthFrame,
  zenithDrawGroups,
  zenithPoseAt,
  type ZenithDrawGroup,
} from './leona-zenith-history';
import { zenithSurfaceAssets } from './leona-zenith-surface-assets';
import { zenithSurfaceAccepted } from './leona-zenith-surface-profiles';
import { SourceParticleSurfaces, type SurfaceProgram } from './source-particle-surfaces';
import { eclipseValue } from './leona-eclipse-values';
export { loadLeonaZenithSurfaces } from './leona-zenith-surface-assets';

const program: SurfaceProgram<ZenithDrawGroup> = {
  name: 'Leona E',
  attachment: 'saved-phase-root',
  profiles: ZENITH_PROFILES,
  assets: zenithSurfaceAssets,
  accepts: zenithSurfaceAccepted,
  *records(world) {
    for (const source of world.units) {
      const state = world.championState(source.id);
      if (!state?.leonaEVisuals.length) continue;
      for (const r of state.leonaEVisuals)
        for (const group of zenithDrawGroups(source.id, r))
          if (group.role !== 'sound') yield { sourceId: source.id, castTick: r.startTick, group };
    }
  },
  particles: (group, tick) => {
    const time = (tick - group.startTick) / 60;
    return zenithParticles(
      group.role,
      group.seed,
      time,
      (group.stopTick - group.startTick) / 60,
      group.radius
    ).map((p) => {
      const profile = ZENITH_PROFILES[p.profileIndex],
        emitterPhase =
          profile.emitterLife && profile.emitterLife > 0
            ? Math.min(1, time / profile.emitterLife)
            : 0,
        acceleration = eclipseValue(profile.acceleration, emitterPhase);
      if (!acceleration.some((v) => v !== 0)) return p;
      const worldOffset = acceleration.map((v) => v * p.phase * p.life * p.life),
        worldTravel = acceleration.map((v) => v * p.life);
      return {
        ...p,
        worldOffset,
        worldTravel,
        offset: p.offset.map((v, i) => v - worldOffset[i]),
        travel: p.travel.map((v, i) => v - worldTravel[i]),
      };
    });
  },
  birthVisible: (group, bornTick, terminal) => !!zenithBirthFrame(group, bornTick, terminal),
  pose: (group, tick) => zenithPoseAt(group.frames, tick),
  missileFrame: (group) => group.role === 'weapon',
  particleFacing: (profile, born, current) => (profile.particleLocal ? current : born),
};

/** Local unit/missile-root placement uses saved phase histories. Native particle
 * CPU attachment and material dispatch remain unverified. No sword normal or
 * reflection fallback is supplied by this surface path. */
export class LeonaZenithSurfaces extends SourceParticleSurfaces<ZenithDrawGroup> {
  constructor(
    scene: THREE.Scene,
    distortion: THREE.Scene,
    ground: (p: Vec2) => number,
    resources?: EclipseSurfaceAssets
  ) {
    super(scene, distortion, ground, program, resources);
  }
}
