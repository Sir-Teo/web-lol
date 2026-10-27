import type * as THREE from 'three';
import type { Vec2 } from '../simulation/math';
import type { EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { SOLAR_PROFILES, solarParticles } from './leona-solar-particles';
import { solarBirthFrame, solarDrawGroups, type SolarDrawGroup } from './leona-solar-history';
import { zenithPoseAt } from './leona-zenith-history';
import { solarSurfaceAssets } from './leona-solar-surface-assets';
import { solarSurfaceAccepted } from './leona-solar-surface-profiles';
import { SourceParticleSurfaces, type SurfaceProgram } from './source-particle-surfaces';
export { loadLeonaSolarSurfaces } from './leona-solar-surface-assets';

const program: SurfaceProgram<SolarDrawGroup> = {
  name: 'Leona R',
  attachment: 'saved-phase-root',
  profiles: SOLAR_PROFILES,
  assets: solarSurfaceAssets,
  accepts: solarSurfaceAccepted,
  vertexColor: (index) => (SOLAR_PROFILES[index].kind === 'ray' ? 'bgra-unorm8' : undefined),
  *records(world) {
    for (const source of world.units) {
      const state = world.championState(source.id);
      if (!state?.leonaRVisuals.length) continue;
      for (const r of state.leonaRVisuals)
        for (const group of solarDrawGroups(source.id, source.team, r))
          yield { sourceId: source.id, castTick: r.startTick, group };
    }
  },
  particles: (group, tick) =>
    solarParticles(
      group.role,
      group.seed,
      (tick - group.startTick) / 60,
      (group.stopTick - group.startTick) / 60,
      group.radius
    ).map((p) => ({ ...p, worldOffset: p.accelerationOffset })),
  birthVisible: (group, bornTick, terminal) => !!solarBirthFrame(group, bornTick, terminal),
  pose: (group, tick) => zenithPoseAt(group.frames, tick),
  particleFacing: (profile, born, current) => (profile.particleLocal ? current : born),
};

/** Source assets with local saved-root/fixed-area placement and pinned65a7
 * orbital order. Native attachment, render state and dispatch are unverified. */
export class LeonaSolarSurfaces extends SourceParticleSurfaces<SolarDrawGroup> {
  constructor(
    scene: THREE.Scene,
    distortion: THREE.Scene,
    ground: (p: Vec2) => number,
    resources?: EclipseSurfaceAssets,
    early?: THREE.Scene
  ) {
    const rayTint = [0, 0, 0, 1];
    super(
      scene,
      distortion,
      ground,
      {
        ...program,
        tint(index, color) {
          const p = SOLAR_PROFILES[index];
          if (p.kind !== 'ray' || (p.blend !== 0 && p.blend !== 2)) return undefined;
          // Native Ray mode0/2 multiplies float32 RGB by A, then writes A=1
          // before byte conversion. Retain the sampler's authored RGBA array.
          const alpha = Math.fround(color[3]);
          for (let lane = 0; lane < 3; lane++)
            rayTint[lane] = Math.fround(Math.fround(color[lane]) * alpha);
          return rayTint;
        },
        distortionTarget(index) {
          const mode = SOLAR_PROFILES[index].distortion?.mode;
          if (mode === 1) return distortion;
          if (mode === 2 && early) return early;
          throw Error('Solar distortion needs an explicit supported phase list');
        },
      },
      resources
    );
  }
}
