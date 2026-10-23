import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Full source-quality deployment pack. No automatic downloads or reduced assets. */
export function offlinePack(): Plugin {
  let output = '';
  return {
    name: 'versioned-offline-pack',
    apply: 'build',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const walk = (
        directory: string,
        prefix = ''
      ): { path: string; bytes: number; sha256: string }[] =>
        readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
          const path = prefix + entry.name,
            file = resolve(directory, entry.name);
          if (entry.isDirectory()) return walk(file, path + '/');
          if (['offline-pack.json', 'offline-worker.js'].includes(path)) return [];
          return [
            {
              path,
              bytes: statSync(file).size,
              sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
            },
          ];
        });
      const files = walk(output).sort((a, b) => a.path.localeCompare(b.path, 'en'));
      const worker = readFileSync(new URL('./offline-worker.js', import.meta.url), 'utf8');
      const workerPolicySha256 = createHash('sha256').update(worker).digest('hex');
      const id = createHash('sha256')
        .update(JSON.stringify({ workerPolicySha256, files }))
        .digest('hex');
      const manifest = {
        format: 1,
        id,
        workerPolicySha256,
        bytes: files.reduce((sum, file) => sum + file.bytes, 0),
        files,
      };
      writeFileSync(resolve(output, 'offline-pack.json'), JSON.stringify(manifest));
      writeFileSync(
        resolve(output, 'offline-worker.js'),
        worker.replace(/\/\*__PACK__\*\/\s*null/, JSON.stringify(manifest))
      );
    },
  };
}
