/** Selected external appearance/age functions with supplied instance scale;
 * current inputs have no linger replacements or live probability tables. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const readers = [
  {
    path: '.cache/baron-emission-readers/engine/utils/sampleCurve.ts',
    sha256: '2acbaef37379bb8c4d6684c3716bad0311167a175c0132506148d349c5ba5230',
  },
  {
    path: '.cache/baron-emission-readers/engine/simulation/particleRead.ts',
    sha256: '1c2ac421e97d350cc1758785bab1f841fb95064c31ac9b81ebe214447bb811ab',
  },
];
const checked = (row) => {
  const raw = fs.readFileSync(row.path);
  assert.equal(createHash('sha256').update(raw).digest('hex'), row.sha256);
  return raw.toString();
};
const compile = (text, dependencies = {}) => {
  const exports = {};
  new Function(
    'exports',
    'dependencies',
    ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  )(exports, dependencies);
  return exports;
};
const curve = compile(checked(readers[0]));
const source = ts.createSourceFile(
    readers[1].path,
    checked(readers[1]),
    ts.ScriptTarget.Latest,
    true
  ),
  parts = [];
for (const statement of source.statements) {
  if (
    ts.isFunctionDeclaration(statement) &&
    ['appearance', 'age01', 'clamp01'].includes(statement.name?.text)
  )
    parts.push(statement.getText(source));
  if (ts.isVariableStatement(statement))
    for (const declaration of statement.declarationList.declarations)
      if (declaration.name.getText(source) === 'UNIFORMLY_SCALED')
        parts.push(`const ${declaration.getText(source)};`);
}
assert.equal(parts.length, 4);
const external = compile(
  `const {sampleCurveInto,flickerInto}=dependencies;
const QUAD_TYPE={cameraQuad:0,cameraUnitQuad:8,arbitraryQuad:1,mesh:3,attachedMesh:11},NOT_LINGERING=-1;
const instanceScaleOf=flex=>flex.instance;
function linger01(){throw Error('Linger appearance is outside this fixture');}
function sampleScalar(){throw Error('Legacy simple appearance is outside this fixture');}\n` +
    parts.join('\n'),
  curve
);
const programRaw = fs.readFileSync('.cache/baron-attack-program-v2/program.json'),
  programSha256 = '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
assert.equal(createHash('sha256').update(programRaw).digest('hex'), programSha256);
const birthPath = 'docs/reference/source-birth-value-samples.json',
  birthRaw = fs.readFileSync(birthPath),
  birthSha256 = '6b707674bbcd39e350a038ee4a125c36c4bef894bf420df9b0e0d05aaba51c63';
assert.equal(createHash('sha256').update(birthRaw).digest('hex'), birthSha256);
const births = JSON.parse(birthRaw);
const constant = (constant) => ({
  constant,
  times: [0],
  values: [constant],
  authoredKeyCount: 0,
  probabilities: [],
});
const decode = (text) => {
  const b = Buffer.from(text, 'hex');
  return Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
};
const definitions = JSON.parse(programRaw).profiles.map((p, index) => {
  const b = births.samples.find(
    (s) => s.definition === index && s.phase === 0 && s.pinned === null
  );
  return {
    name: `${p.role}-${p.index}-${p.name}`,
    definition: {
      scale: p.curves.scale0 ?? constant([1, 1, 1]),
      color: p.curves.Color ?? constant([1, 1, 1, 1]),
      uniform: !!p.settings.isUniformScale,
      geometry: p.geometry.kind,
      modulation: [1, 1, 1, 1],
    },
    birthScale: decode(b.expected.scale),
    birthColor: decode(b.expected.color),
  };
});
for (const geometry of ['billboard', 'mesh', 'arbitrary-trail'])
  definitions.push({
    name: `hdr-uniform-${geometry}`,
    definition: {
      scale: constant([2, 3, 4]),
      color: constant([2, 3, 4, 1.5]),
      uniform: true,
      geometry,
      modulation: [0.8, 1.2, 2, 3],
    },
    birthScale: [1 / 3, 2, 3],
    birthColor: [0.75, 0.625, 0.5, 1],
  });
const value = (d) => ({
  constant: d.constant,
  keys: d.authoredKeyCount ? d.times.map((time, i) => ({ time, values: d.values[i] })) : [],
  tables: [],
});
const kinds = { billboard: 0, quad: 1, mesh: 3, 'arbitrary-trail': 5, 'camera-trail': 4 };
const hex = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('hex'),
  samples = [];
for (const [definition, row] of definitions.entries())
  for (const age of [0, 0.125, 0.5, 1.25])
    for (const life of [0.75, null])
      for (const instanceScale of [1, 1 / 3]) {
        const d = row.definition,
          pool = {
            birthTime: new Float32Array([0]),
            lifetime: new Float32Array([life ?? Infinity]),
            lingerFrom: new Float32Array([-1]),
            serial: new Uint32Array([0]),
            birthScale: new Float32Array(row.birthScale),
            birthColor: new Float32Array(row.birthColor),
            flex: { instance: instanceScale },
          };
        const emitter = {
          scale0: value(d.scale),
          color: value(d.color),
          modulation: d.modulation,
          uniformScale: d.uniform,
          quadType: kinds[d.geometry],
          legacySimple: null,
          linger: null,
          flex: null,
        };
        const out = { scale: new Float32Array(3), color: new Float32Array(4) };
        external.appearance(pool, 0, emitter, age, out);
        samples.push({
          definition,
          age,
          life,
          instanceScale,
          expected: { scale: hex(out.scale), color: hex(out.color) },
        });
      }
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  readers,
  programSha256,
  birthValues: { path: birthPath, sha256: birthSha256 },
  scope:
    'Selected external no-flicker/no-linger complex appearance with resolved instance scale; no native execution.',
  definitions,
  samples,
};
const output = 'docs/reference/source-appearance-samples.json',
  text = JSON.stringify(record) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', samples: samples.length, nativeExecuted: false }));
