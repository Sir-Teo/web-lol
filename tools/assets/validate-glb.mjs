import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';

// These particle meshes share source/conversion ledgers instead of sidecars.
const bindingMeshes = JSON.parse(
  await readFile('docs/reference/lux-binding-target-meshes.json', 'utf8')
).outputs;
const garenAttackMeshes = JSON.parse(
  await readFile('docs/reference/garen-aa-particles-source.json', 'utf8')
).assets.filter((row) => row.output?.file?.endsWith('.glb'));
// Yi's shared particle geometry is pinned by its runtime source profiles.
const yiMeshes = new Map();
function collectYiMeshes(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.url === 'string' && value.url.endsWith('.glb')) {
    const identity = value.output ?? value;
    if (!/^[a-f0-9]{64}$/.test(identity.sha256) || !Number.isInteger(identity.bytes))
      throw new Error(`Incomplete shared mesh identity: ${value.url}`);
    const path = `public/${value.url.replace(/^\//, '')}`;
    const existing = yiMeshes.get(path);
    if (
      existing &&
      (existing.output.sha256 !== identity.sha256 || existing.output.bytes !== identity.bytes)
    )
      throw new Error(`Conflicting shared mesh identity: ${path}`);
    yiMeshes.set(path, {
      output: { path, bytes: identity.bytes, sha256: identity.sha256 },
      triangles: value.triangles ?? (value.exportedCorners ? value.exportedCorners / 3 : undefined),
    });
  }
  for (const child of Object.values(value)) collectYiMeshes(child);
}
for (const profile of [
  'primary-trail',
  'passive-trail',
  'q-contact',
  'r-cast',
  'r-kill',
  'w-cast',
  'w-buff',
])
  collectYiMeshes(
    JSON.parse(await readFile(`src/content/masteryi-${profile}-particles.json`, 'utf8'))
  );

for (const name of (await readdir('public/assets/models'))
  .filter((name) => name.endsWith('.glb'))
  .sort()) {
  const path = `public/assets/models/${name}`;
  const bytes = await readFile(path);
  const manifestPath =
    name === 'ashe-q-arrow.glb'
      ? 'docs/reference/ashe-q-arrow-conversion.json'
      : path.replace('.glb', '.json');
  const grouped = bindingMeshes.find((entry) => entry.path === path);
  const garenAttack = garenAttackMeshes.find((entry) => entry.output.file === path);
  const manifest = grouped
    ? { output: grouped, triangles: grouped.triangles }
    : garenAttack
      ? { output: garenAttack.output, triangles: garenAttack.decoded.triangles }
      : (yiMeshes.get(path) ?? JSON.parse(await readFile(manifestPath, 'utf8')));
  if (manifest.output.bytes !== undefined && bytes.length !== manifest.output.bytes)
    throw new Error(`${name}: Asset does not match its recorded size`);
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.output.sha256)
    throw new Error(`${name}: Asset does not match its recorded hash`);
  for (const asset of manifest.auxiliaryAssets ?? []) {
    const data = await readFile(`public${asset.path}`);
    if (
      data.length !== asset.bytes ||
      createHash('sha256').update(data).digest('hex') !== asset.sha256
    )
      throw new Error(`${name}: Auxiliary asset differs: ${asset.path}`);
  }
  const report = await validator.validateBytes(bytes, { maxIssues: 1000 });
  console.log(
    `${path}: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings; ${manifest.clips?.length ?? 0} animations, ${manifest.triangles ?? report.info?.totalTriangleCount} triangles`
  );
  if (report.issues.numErrors || report.issues.numWarnings) {
    console.error(JSON.stringify(report.issues, null, 2));
    process.exitCode = 1;
  }
}
