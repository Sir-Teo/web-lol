/** Execute the same pinned reader helpers used by the existing Lux lookup audit. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';

const reference = JSON.parse(await readFile('docs/reference/particle-color-lookup.json'));
const base = `https://raw.githubusercontent.com/LeagueToolkit/ltk-manager/${reference.revision}/src/modules/workshop/bin/`;
const names = ['binHash.ts', 'vfx/enums.ts', 'vfx/readValue.ts', 'vfx/readVfxSystem.ts'];
const files = await Promise.all(
  names.map(async (name) => {
    const url = base + name,
      response = await fetch(url);
    assert(response.ok, `${response.status}: ${url}`);
    const code = await response.text(),
      sha256 = createHash('sha256').update(code).digest('hex');
    const prior = reference.files.find((f) => f.url === url);
    if (prior) assert.equal(sha256, prior.sha256);
    await mkdir('.cache/garen-spin-reader', { recursive: true });
    await writeFile(`.cache/garen-spin-reader/${name.split('/').at(-1)}`, code);
    return { name, url, code, sha256 };
  })
);
const compile = (code) =>
  ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
const moduleUrl = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const hashUrl = moduleUrl(compile(files[0].code)),
  enumUrl = moduleUrl(compile(files[1].code));
const { nameHash } = await import(hashUrl);
const { COLOR_LOOKUP } = await import(enumUrl);
const code = compile(files[2].code)
  .replace('from "../binHash"', `from "${hashUrl}"`)
  .replace('from "./enums"', `from "${enumUrl}"`);
const { curve, DEFAULT, pairOr } = await import(moduleUrl(code));
const reader = files[3].code;
for (const text of [
  'birthScale0: curve(field(node, FIELD.birthScale0), DEFAULT.one3)',
  'color: curve(field(node, FIELD.color), DEFAULT.white)',
  'scale0: curve(field(node, FIELD.scale0), DEFAULT.one3)',
  'lookupX: enumByte(field(node, FIELD.lookupX), COLOR_LOOKUP, COLOR_LOOKUP.lifetime)',
  'lookupY: enumByte(field(node, FIELD.lookupY), COLOR_LOOKUP, COLOR_LOOKUP.constant)',
  'lookupOffsets: pairOr(field(node, FIELD.lookupOffsets), [0, 0])',
  'lookupScales: pairOr(field(node, FIELD.lookupScales), [1, 1])',
])
  assert(reader.includes(text), `Reader mapping changed: ${text}`);
const defaults = {
  birthScale: curve(null, DEFAULT.one3).constant,
  scale: curve(null, DEFAULT.one3).constant,
  color: curve(null, DEFAULT.white).constant,
  lookupTypes: [COLOR_LOOKUP.lifetime, COLOR_LOOKUP.constant],
  lookupScales: pairOr(null, [1, 1]),
  lookupOffsets: pairOr(null, [0, 0]),
};
assert.deepEqual(defaults.birthScale, [1, 1, 1]);
assert.deepEqual(defaults.color, [1, 1, 1, 1]);
assert.deepEqual(defaults.lookupTypes, [1, 0]);
const explicitScale = curve(
  {
    type: 'struct',
    fields: [
      { hash: nameHash('constantValue'), value: { type: 'vector', values: [150, 150, 150] } },
    ],
  },
  DEFAULT.one3
).constant;
assert.deepEqual(explicitScale, [150, 150, 150]);
const result = {
  revision: reference.revision,
  files: files.map(({ code, ...f }) => f),
  defaults,
  explicitScale,
  status:
    'Executed pinned readValue helpers and verified readVfxSystem field mappings. Schema reconstruction evidence; native CPU defaults and sampler parity remain unverified.',
};
const path = 'docs/reference/garen-spin-defaults.json';
let previous;
try {
  previous = JSON.parse(await readFile(path));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
if (previous) assert.deepEqual(result, previous, 'Pinned reader/default evidence changed');
else await writeFile(path, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ defaults, explicitScale, verifiedFiles: files.length }));
