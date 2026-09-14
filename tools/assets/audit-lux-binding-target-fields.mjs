/** Resolve target field names from exact pinned reader declarations, not guessed semantics. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { binFieldHash } from './bin-field.mjs';
const revision = '65a7d2a746b9d02d65dab788b5f7b8198d5e555e';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const pinBytes = await readFile('docs/reference/lux-binding-target-vfx.json');
const definition = JSON.parse(pinBytes).definition;
const unknown = new Set();
const collect = (value) => {
  if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      if (/^\{[a-f0-9]{8}\}$/.test(key)) unknown.add(key);
      collect(child);
    }
};
collect(definition);
const files = [],
  matches = new Map();
for (const name of ['readVfxSystem.ts', 'readSurface.ts', 'readValue.ts']) {
  const url = `https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/${revision}/src/modules/workshop/bin/vfx/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const code = await response.text();
  if (code !== (await readFile(`.cache/ltk-manager/src/modules/workshop/bin/vfx/${name}`, 'utf8')))
    throw new Error(`Inspected cache differs: ${name}`);
  files.push({ name, url, sha256: sha(code) });
  for (const [index, line] of code.split('\n').entries())
    for (const [, field] of line.matchAll(/nameHash\("([A-Za-z_][A-Za-z_0-9]*)"\)/g)) {
      const hash = binFieldHash(field);
      if (!unknown.has(hash)) continue;
      if (matches.has(hash) && matches.get(hash).name !== field)
        throw new Error(`Name collision: ${hash}`);
      matches.set(hash, { hash, name: field, file: name, line: index + 1 });
    }
  if (name === 'readValue.ts' && !code.includes('particleLifetime: constant([3])'))
    throw new Error('Particle lifetime default changed');
}
const resolve = (value) => {
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [matches.get(key)?.name ?? key, resolve(v)])
    );
  return value;
};
await writeFile(
  'docs/reference/lux-binding-target-fields.json',
  JSON.stringify(
    {
      sourcePinSha256: sha(pinBytes),
      revision,
      files,
      mappings: [...matches.values()].sort((a, b) => a.hash.localeCompare(b.hash)),
      unresolved: [...unknown].filter((h) => !matches.has(h)).sort(),
      readerDefaults: { particleLifetimeSeconds: 3 },
      resolvedDefinition: resolve(definition),
      status:
        'Hash-resolved names and pinned reader defaults. Native field semantics and renderer parity remain unverified.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  `Resolved ${matches.size} field names; ${unknown.size - matches.size} remain unresolved.`
);
