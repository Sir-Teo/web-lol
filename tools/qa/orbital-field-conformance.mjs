/** Execute the exact pinned orbital operator after TypeScript erasure; compare
 * this local operator across guards and deterministic varied Float32 inputs. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordBytes = await fs.readFile('docs/reference/masteryi/w-fields-reader.json');
assert.equal(hash(recordBytes), 'b67cb8e90ae6521816579a06ae1b4274bd6ae11befc28d75fca948fd8abff3c7');
const record = JSON.parse(recordBytes),
  source = record.files.find((row) => row.path.endsWith('/forceFields.ts')),
  raw = await fs.readFile(source.path);
assert.equal(hash(raw), source.sha256);
const ast = ts.createSourceFile('forceFields.ts', raw.toString(), ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'orbitFieldInto'
);
assert.ok(fn);
const constants = ast.statements.filter(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((d) =>
      ['ON_AXIS', 'STILL'].includes(d.name.getText(ast))
    )
);
assert.equal(constants.length, 2);
const text =
  'type Vector=ArrayLike<number>;\n' +
  constants.map((n) => n.getFullText(ast)).join('\n') +
  '\n' +
  fn.getFullText(ast) +
  '\n' +
  ast.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) && ['attractInto', 'within'].includes(node.name?.text)
    )
    .map((node) => node.getFullText(ast))
    .join('\n');
const dir = '.cache/masteryi-field-motion-cloud/oracle';
await fs.mkdir(dir, { recursive: true });
const compile = (text) =>
  ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
await fs.writeFile(dir + '/pinned.mjs', compile(text));
const local = await fs.readFile('src/render/particle-orbital-motion.ts', 'utf8');
await fs.writeFile(dir + '/local.mjs', compile(local));
const { orbitFieldInto, attractInto } = await import(
    pathToFileURL(process.cwd() + '/' + dir + '/pinned.mjs').href
  ),
  { redirectOrbitalVelocity, attractParticleVelocity } = await import(
    pathToFileURL(process.cwd() + '/' + dir + '/local.mjs').href
  );
const rows = [];
const check = (velocity, point, axis) => {
  const expected = new Float32Array(velocity),
    actual = new Float32Array(velocity),
    position = new Float32Array(point);
  orbitFieldInto(expected, position, [0, 0, 0], axis);
  redirectOrbitalVelocity(actual, position, axis);
  assert.deepEqual(actual, expected);
  rows.push({
    velocity: [...new Float32Array(velocity)],
    point: [...position],
    axis,
    output: [...actual],
  });
};
for (const point of [
  [0, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0.01, 10, 0],
  [0.01, -10, 0],
  [10, 0, 0],
])
  for (const v of [
    [3, 4, 0],
    [-3, 4, -2],
    [0, 4, 0],
    [0.0001, 0, 0],
  ])
    check(v, point, [0, 1, 0]);
let word = 0x517cc1b7;
const draw = () => {
  word = (Math.imul(word, 1664525) + 1013904223) >>> 0;
  return (word / 0x100000000) * 2 - 1;
};
for (let index = 0; index < 2048; index++) {
  const velocity = [draw() * 200, draw() * 200, draw() * 200],
    point = [draw() * 400, draw() * 400, draw() * 400],
    axis = [draw(), draw(), draw()];
  const length = Math.hypot(...axis);
  check(
    velocity,
    point,
    axis.map((v) => v / length)
  );
}
const attractionRows = [];
const checkAttraction = (velocity, point, centre, strength, radius, dt) => {
  const expected = new Float32Array(velocity),
    actual = new Float32Array(velocity),
    position = new Float32Array(point);
  attractInto(expected, position, centre, strength, radius, dt);
  attractParticleVelocity(actual, position, { position: centre, strength, radius }, dt);
  assert.deepEqual(actual, expected);
  attractionRows.push({
    velocity: [...new Float32Array(velocity)],
    point: [...position],
    centre,
    strength,
    radius,
    dt,
    output: [...actual],
  });
};
for (const point of [
  [0, 0, 0],
  [0.5, 0, 0],
  [1, 0, 0],
  [200, 0, 0],
  [200.001, 0, 0],
])
  for (const dt of [0, 1 / 60, 0.5]) checkAttraction([3, 4, 5], point, [0, 0, 0], 100, 200, dt);
for (let index = 0; index < 2048; index++)
  checkAttraction(
    [draw() * 200, draw() * 200, draw() * 200],
    [draw() * 400, draw() * 400, draw() * 400],
    [draw() * 100, draw() * 100, draw() * 100],
    draw() * 100,
    Math.abs(draw()) * 500,
    Math.abs(draw()) / 10
  );
const result = {
  sourceSha256: source.sha256,
  sourceFunctionSha256: hash(fn.getFullText(ast)),
  localSha256: hash(local),
  cases: rows.length,
  exactFloat32Matches: true,
  rows,
  attractionCases: attractionRows.length,
  attractionRows,
};
await fs.writeFile(dir + '/result.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    ...result,
    rows: result.rows.length,
    attractionRows: result.attractionRows.length,
  })
);
