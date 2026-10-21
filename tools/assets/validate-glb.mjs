import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';

// These three source meshes share a conversion ledger instead of sidecar files.
const bindingMeshes = JSON.parse(
  await readFile('docs/reference/lux-binding-target-meshes.json', 'utf8')
).outputs;

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
  const manifest = grouped
    ? { output: grouped, triangles: grouped.triangles }
    : JSON.parse(await readFile(manifestPath, 'utf8'));
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
    `${path}: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings; ${manifest.clips?.length ?? 0} animations, ${manifest.triangles} triangles`
  );
  if (report.issues.numErrors || report.issues.numWarnings) {
    console.error(JSON.stringify(report.issues, null, 2));
    process.exitCode = 1;
  }
}
