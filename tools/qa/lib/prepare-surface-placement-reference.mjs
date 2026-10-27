/** Freeze the complete pre-optimization source graph before bundling its renderer. */
import { mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
export async function placementReference(output) {
  output = resolve(output);
  assert(!existsSync(output), 'Reference directory already exists');
  mkdirSync(output, { recursive: true });
  const commit = '6fd50c9aad1aac17891df3bc88e1db32d21b99b4',
    archive = execFileSync(
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
    "export { SourceParticleSurfaces } from './src/render/source-particle-surfaces';\nexport { primaryHitParticles } from './src/render/masteryi-primary-hit-particles';\nexport { default as data } from './src/content/masteryi-primary-hit-particles.json';\n"
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
