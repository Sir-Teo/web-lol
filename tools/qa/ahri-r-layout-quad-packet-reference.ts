import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { ahriRParticles } from 'frozen-r-layout-quad-particles';
const context = {
  boundObjectSize: 100,
  root: (time: number) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
const rows = [];
for (const system of ['Ahri_R_Ready_tar'] as const)
  for (const seed of [927, 13])
    for (const time of [0.43, 1.5, 5.25, 9.99, 10.01, 10.02, 1000000])
      for (const stopSeconds of [Infinity, 0.4, 15]) {
        const particles = ahriRParticles(system, seed, time, stopSeconds, context).filter(
          (p: { profileIndex: number }) => p.profileIndex === 50
        );
        rows.push({
          system,
          seed,
          time,
          stopSeconds: Number.isFinite(stopSeconds) ? stopSeconds : null,
          count: particles.length,
          sha256: createHash('sha256').update(JSON.stringify(particles)).digest('hex'),
        });
      }
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n', { flag: 'wx' });
