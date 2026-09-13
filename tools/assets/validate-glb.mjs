import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';

for (const name of (await readdir('public/assets/models'))
  .filter((name) => name.endsWith('.glb'))
  .sort()) {
  const path = `public/assets/models/${name}`;
  const bytes = await readFile(path);
  const manifest = JSON.parse(await readFile(path.replace('.glb', '.json'), 'utf8'));
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
    `${path}: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings; ${manifest.clips.length} animations, ${manifest.triangles} triangles`
  );
  if (report.issues.numErrors || report.issues.numWarnings) {
    console.error(JSON.stringify(report.issues, null, 2));
    process.exitCode = 1;
  }
}
