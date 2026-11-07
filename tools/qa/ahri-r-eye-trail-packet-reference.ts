import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { ahriRParticles } from 'frozen-r-eye-trail-particles';
const context = {
  boundObjectSize: 100,
  root: (time: number) => ({ x: time * 120, y: time * time * 8, height: 100, facing: time / 4 }),
};
const rows = [];
for (const system of ['Ahri_R_Eyes'] as const)
  for (const seed of [927, 13])
    for (const time of [0.43, 1.5, 2.99, 3.05, 5.25, 49.5, 50.5, 52, 1000000.2])
      for (const stopSeconds of [Infinity, 0.4, 15]) {
        const particles = ahriRParticles(system, seed, time, stopSeconds, context).filter(
          (p: { profileIndex: number }) => p.profileIndex === 47 || p.profileIndex === 48
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
