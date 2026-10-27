/** Freeze the accepted source graph before Meditate ray packet changes. */
import { mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
export async function meditateRayReference(output) {
  output = resolve(output);
  assert(!existsSync(output), 'Reference directory already exists');
  mkdirSync(output, { recursive: true });
  const commit = '541d7bddbda752f997a473f330568ffd9499a88b';
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
      "export { meditateCastParticles } from './src/render/masteryi-w-cast-particles';",
      "export { meditateBuffParticles } from './src/render/masteryi-w-buff-particles';",
      "export { default as castData } from './src/content/masteryi-w-cast-particles.json';",
      "export { default as buffData } from './src/content/masteryi-w-buff-particles.json';",
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
