import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { ahriRParticles } from 'frozen-r-layout-mesh-particles';
const context = {
  boundObjectSize: 100,
  root: (time: number) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
const rows = [];
for (const system of ['Ahri_R_Ready_tar'] as const)
  for (const profile of [51, 52, 54])
    for (const seed of [927, 13])
      for (const time of [0, 0.43, 1.02, 2.05, 5.25, 15, 29.5, 29.99, 30, 30.5, 31.1, 70.25])
        for (const stopSeconds of [Infinity, 0.4, 15]) {
          const particles = ahriRParticles(system, seed, time, stopSeconds, context).filter(
            (p: { profileIndex: number }) => p.profileIndex === profile
          );
          rows.push({
            system,
            profile,
            seed,
            time,
            stopSeconds: Number.isFinite(stopSeconds) ? stopSeconds : null,
            count: particles.length,
            sha256: createHash('sha256').update(JSON.stringify(particles)).digest('hex'),
          });
        }
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
