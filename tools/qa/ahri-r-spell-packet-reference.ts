import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { ahriRParticles } from 'frozen-r-spell-particles';
const context = {
  boundObjectSize: 100,
  root: (time: number) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
const rows = [];
for (const system of ['Ahri_R_mis_02', 'Ahri_R_Tar'] as const)
  for (const seed of [927, 13])
    for (const time of [0.1, 0.43, 1, 2, 4, 5])
      for (const stopSeconds of [Infinity, 0.4, 0]) {
        const particles = ahriRParticles(system, seed, time, stopSeconds, context);
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
