import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const pin = JSON.parse(await readFile('docs/reference/lux-character.json'));
const bytes = await readFile('.cache/lux-16.18.json');
assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
const source = JSON.parse(bytes);
const root = source['Characters/Lux/CharacterRecords/Root'];
assert.deepEqual(root, pin.records['Characters/Lux/CharacterRecords/Root']);
const names = ['LuxBasicAttack', 'LuxBasicAttack2'];
const records = Object.fromEntries(
  names.map((name) => {
    const path = `Characters/Lux/Spells/${name}`;
    assert(source[path], `Missing ${path}`);
    return [path, source[path]];
  })
);
await writeFile(
  'docs/reference/lux-attack-variants.json',
  JSON.stringify(
    {
      url: pin.url,
      sha256: pin.sha256,
      basicAttack: root.basicAttack,
      extraAttacks: root.extraAttacks,
      records,
    },
    null,
    2
  ) + '\n'
);
