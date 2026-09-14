import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';

const base = 'public/assets/maps/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await fs.readFile(`${base}rift.json`, 'utf8'));
const json = await fs.readFile(`${base}rift.gltf`);
if (hash(json) !== manifest.output.sha256) throw new Error('Map document hash mismatch');
for (const resource of manifest.resources) {
  const data = await fs.readFile(base + resource.uri);
  if (hash(data) !== resource.sha256 || data.length !== resource.bytes)
    throw new Error(`Map resource hash mismatch: ${resource.uri}`);
}
const transport = JSON.parse(await fs.readFile(`${base}rift-geometry-gzip.json`, 'utf8'));
const compressed = await fs.readFile(base + transport.gzip.uri);
const decoded = gunzipSync(compressed);
if (
  compressed.length !== transport.gzip.bytes ||
  hash(compressed) !== transport.gzip.sha256 ||
  decoded.length !== transport.source.bytes ||
  hash(decoded) !== transport.source.sha256 ||
  !decoded.equals(await fs.readFile(base + transport.source.uri))
)
  throw new Error('Compressed geometry verification failed');
const visibilityAudit = JSON.parse(
  await fs.readFile('docs/reference/map-initial-visibility.json', 'utf8')
);
const visibilityBytes = await fs.readFile('src/content/rift-initial-visibility.json');
const visibility = JSON.parse(visibilityBytes);
if (
  hash(json) !== visibilityAudit.sources['public/assets/maps/rift.gltf'] ||
  hash(visibilityBytes) !== visibilityAudit.outputSHA256
)
  throw new Error('Map initial visibility source/output hash mismatch');
const sourceNodeNames = new Set(
  JSON.parse(json)
    .nodes.filter((n) => n.mesh !== undefined)
    .map((n) => n.name)
);
const expectedHidden = visibilityAudit.hidden
  .map((record) => {
    if (
      !sourceNodeNames.has(record.node) ||
      visibilityAudit.controllers[record.controller]?.DefaultVisible !== false
    )
      throw new Error(`Unsupported default-hidden map node: ${record.node}`);
    return record.node;
  })
  .sort();
if (
  new Set(expectedHidden).size !== expectedHidden.length ||
  JSON.stringify(visibility.hiddenNodes) !== JSON.stringify(expectedHidden)
)
  throw new Error('Map initial visibility node coverage mismatch');
const navigation = JSON.parse(await fs.readFile(`${base}rift-nav.json`, 'utf8'));
if (hash(await fs.readFile(`${base}rift-nav.bin`)) !== navigation.output.sha256)
  throw new Error('Navigation payload hash mismatch');
const layout = JSON.parse(await fs.readFile('docs/reference/rift-layout-source.json', 'utf8'));
for (const output of layout.outputs) {
  if (hash(await fs.readFile(output.path)) !== output.sha256)
    throw new Error(`Layout artifact hash mismatch: ${output.path}`);
}
const report = await validator.validateString(json.toString(), {
  externalResourceFunction: (uri) => fs.readFile(base + uri),
  maxIssues: 1000,
});
console.log(
  `Map: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings; ${manifest.triangles} triangles, ${manifest.resources.length} hashed resources; navigation hash verified`
);
if (report.issues.numErrors || report.issues.numWarnings) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exitCode = 1;
}
