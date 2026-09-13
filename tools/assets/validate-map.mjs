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
const navigation = JSON.parse(await fs.readFile(`${base}rift-nav.json`, 'utf8'));
if (hash(await fs.readFile(`${base}rift-nav.bin`)) !== navigation.output.sha256)
  throw new Error('Navigation payload hash mismatch');
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
