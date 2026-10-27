/** Freeze the accepted source graph before Solar ray packet changes. */
import { mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
export async function solarRayReference(output) {
  output = resolve(output);
  assert(!existsSync(output), 'Reference directory already exists');
  mkdirSync(output, { recursive: true });
  const commit = 'd72dd86fe75cc43e0b137bdf29e2ccc28f125cfc';
  assert(/^[0-9a-f]{40}$/.test(commit), 'Reference must be a complete commit hash');
  const archive = execFileSync(
      'git',
      ['archive', commit, 'src', 'package.json', 'package-lock.json', 'tsconfig.json'],
      { maxBuffer: 32 * 1024 * 1024 }
    ),
    source = resolve(output, 'source');
  mkdirSync(source);
  writeFileSync(resolve(output, 'source.tar'), archive);
  execFileSync('tar', ['-xf', '-', '-C', source], { input: archive });
  assert(
    readFileSync(resolve(source, 'package-lock.json')).equals(readFileSync('package-lock.json')),
    'Reference lock differs'
  );
  symlinkSync(resolve('node_modules'), resolve(source, 'node_modules'), 'dir');
  const entry = resolve(source, 'entry.ts');
  writeFileSync(
    entry,
    [
      "export { SourceParticleSurfaces } from './src/render/source-particle-surfaces';",
      "export { solarParticles, SOLAR_PROFILES } from './src/render/leona-solar-particles';",
      "export { LeonaSolarSurfaces } from './src/render/leona-solar-surfaces';",
    ].join('\n') + '\n'
  );
  const bundle = await rolldown({ input: entry, platform: 'node', external: ['three'] }),
    module = resolve(output, 'baseline.mjs');
  try {
    await bundle.write({ file: module, format: 'esm' });
  } finally {
    await bundle.close();
  }
  const sha = (raw) => createHash('sha256').update(raw).digest('hex'),
    reading = {
      commit,
      archiveSha256: sha(archive),
      sourceSha256: sha(readFileSync(resolve(source, 'src/render/source-particle-surfaces.ts'))),
      moduleSha256: sha(readFileSync(module)),
      module,
    };
  writeFileSync(resolve(output, 'reference.json'), JSON.stringify(reading, null, 2) + '\n');
  return reading;
}
