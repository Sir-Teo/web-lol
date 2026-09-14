import fs from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const base = 'public/assets/maps/';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(await fs.readFile(base + 'rift.json', 'utf8'));
const uri = 'rift-geometry.bin',
  source = await fs.readFile(base + uri);
const pinned = manifest.resources.find((r) => r.uri === uri);
if (!pinned || hash(source) !== pinned.sha256 || source.length !== pinned.bytes)
  throw new Error('Map geometry source mismatch');
const encoded = gzipSync(source, { level: 9 });
if (!gunzipSync(encoded).equals(source)) throw new Error('Geometry roundtrip mismatch');
const output = uri + '.gz';
await fs.writeFile(base + output, encoded);
await fs.writeFile(
  base + 'rift-geometry-gzip.json',
  JSON.stringify(
    {
      source: { uri, bytes: source.length, sha256: hash(source) },
      gzip: { uri: output, bytes: encoded.length, sha256: hash(encoded) },
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify({
    sourceBytes: source.length,
    transferBytes: encoded.length,
    savedBytes: source.length - encoded.length,
  })
);
