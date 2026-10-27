/** Frozen accepted Gromp missile sampler before color correction. */
import { mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
export async function grompAttackReference(
  output,
  commit = '546affe0c58fedec35ac94ac5130e1a3a0b3ef1f'
) {
  output = resolve(output);
  assert(!existsSync(output), 'Use a fresh reference directory');
  mkdirSync(output, { recursive: true });
  assert(/^[0-9a-f]{40}$/.test(commit), 'Reference requires a full commit identity');
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
    readFileSync(resolve(source, 'package-lock.json')).equals(readFileSync('package-lock.json'))
  );
  symlinkSync(resolve('node_modules'), resolve(source, 'node_modules'), 'dir');
  const entry = resolve(source, 'entry.ts'),
    module = resolve(output, 'baseline.mjs');
  writeFileSync(
    entry,
    "export { grompAttackParticles } from './src/render/gromp-attack-particles';\nexport { default as data } from './src/content/gromp-attack.json';\n"
  );
  const bundle = await rolldown({ input: entry, platform: 'node', external: ['three'] });
  try {
    await bundle.write({ file: module, format: 'esm' });
  } finally {
    await bundle.close();
  }
  const sha = (raw) => createHash('sha256').update(raw).digest('hex'),
    reading = {
      commit,
      archiveSha256: sha(archive),
      moduleSha256: sha(readFileSync(module)),
      module,
    };
  writeFileSync(resolve(output, 'reference.json'), JSON.stringify(reading, null, 2) + '\n');
  return reading;
}
