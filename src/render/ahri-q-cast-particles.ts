import data from '../content/ahri-q-cast-particles.json';
import { eclipseValue, eclipseUv, type EclipseValue } from './leona-eclipse-values';
/** The saved local event tick is already the first single-particle update.
 * No additional frame delay, World ID or gameplay random draw is introduced. */
export function ahriQCastParticles(time: number) {
  if (!Number.isFinite(time) || time < 0) return [];
  return data.profiles.flatMap((p, profileIndex) => {
    const sample = (v: EclipseValue) => eclipseValue(v, 0),
      life = sample(p.life)[0];
    if (time >= life) return [];
    const phase = time / life,
      scale = eclipseValue(p.scale, phase),
      size = sample(p.size).map((v, i) => v * scale[i]);
    if (p.uniform) size.fill(size[0]);
    const position = sample(p.position),
      spawn = sample(p.shape.offset),
      color = eclipseValue(p.color, phase);
    return [
      {
        profileIndex,
        ordinal: 1,
        bornTick: 0,
        age: time,
        naturalLife: life,
        life,
        phase,
        offset: position.map((v, i) => v + spawn[i]),
        worldOffset: [0, 0, 0],
        worldTravel: [0, 0, 0],
        size,
        color: sample(p.birthColor).map((v, i) => v * color[i]),
        rotation: sample(p.rotation),
        spawnTurn: [0, 0, 0, 1] as [number, number, number, number],
        travel: [0, 0, 0],
        stretch: 1,
        bind: sample(p.bind)[0],
        lookup: [0, 0] as [number, number],
        uv: eclipseUv(p.uv, time, life, 0, phase, 0, 0),
        uvRotationDegrees: sample(p.uv.rotationDegrees)[0],
        multUv: null,
        erosion: p.erosion ? eclipseValue(p.erosion.drive, phase)[0] : 0,
      },
    ];
  });
}
