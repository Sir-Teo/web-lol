import type * as THREE from 'three';
import type { Vec2 } from '../simulation/math';
import { ECLIPSE_PROFILES, eclipseParticles } from './leona-eclipse-particles';
import {
  eclipseBirthFrame,
  eclipseDrawGroups,
  eclipsePoseAt,
  type EclipseDrawGroup,
} from './leona-eclipse-history';
import { eclipseSurfaceAssets, type EclipseSurfaceAssets } from './leona-eclipse-surface-assets';
import { SourceParticleSurfaces, type SurfaceProgram } from './source-particle-surfaces';
export { loadLeonaEclipseSurfaces } from './leona-eclipse-surface-assets';

const program: SurfaceProgram<EclipseDrawGroup> = {
  name: 'Leona W',
  attachment: 'local-unit-root',
  profiles: ECLIPSE_PROFILES,
  assets: eclipseSurfaceAssets,
  accepts: (index) => ECLIPSE_PROFILES[index].kind !== 'skin',
  *records(world) {
    for (const source of world.units) {
      const state = world.championState(source.id);
      if (!state?.leonaWVisuals.length) continue;
      for (const r of state.leonaWVisuals)
        for (const group of eclipseDrawGroups(source.id, r))
          yield { sourceId: source.id, castTick: r.startTick, group };
    }
  },
  particles: (group, tick) =>
    eclipseParticles(
      group.role,
      group.seed,
      (tick - group.startTick) / 60,
      (group.stopTick - group.startTick) / 60,
      group.radius
    ),
  birthVisible: (group, bornTick, terminal) => !!eclipseBirthFrame(group, bornTick, terminal),
  pose: (group, tick) => eclipsePoseAt(group.frames, tick),
};

/** All non-skin W primitives retain their existing dispatch and draw policies. */
export class LeonaEclipseSurfaces extends SourceParticleSurfaces<EclipseDrawGroup> {
  constructor(
    scene: THREE.Scene,
    distortion: THREE.Scene,
    ground: (p: Vec2) => number,
    resources?: EclipseSurfaceAssets
  ) {
    super(scene, distortion, ground, program, resources);
  }
}
