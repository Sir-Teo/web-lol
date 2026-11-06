import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const raw = readFileSync('docs/reference/baron-attack-source.json');
const pin = JSON.parse(raw.toString());
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('Baron missile and hit declarations bind through the frozen default attack and skin resolver', () => {
  expect(sha(raw)).toBe('4b300f952b2a768e1eaa5c5f9eda3dd397e457ba1ead19c10fbd9aaa02c3543a');
  for (const seed of pin.inputs.seeds) expect(sha(readFileSync(seed.path))).toBe(seed.sha256);
  const characters = JSON.parse(readFileSync(pin.inputs.seeds[0].path, 'utf8')).records[
    pin.binding.character
  ];
  const root = characters['Characters/SRU_Baron/CharacterRecords/Root'];
  expect(root.basicAttack.mAttackProbability).toBe(0);
  expect(root.extraAttacks).toHaveLength(1);
  expect(root.extraAttacks[0]).toMatchObject({
    mAttackProbability: 1,
    mAttackName: pin.binding.defaultAttackName,
  });
  const attack = characters[pin.binding.defaultAttackRecord];
  expect(attack.ObjectName).toBe(pin.binding.defaultAttackName);
  const skin = JSON.parse(readFileSync(pin.inputs.seeds[1].path, 'utf8')).records[pin.binding.skin];
  const resources = skin[pin.binding.resolver]['{d2f58721}'];
  for (const [role, count] of [
    ['missile', 9],
    ['hit', 12],
  ] as const) {
    const system = pin.systems[role];
    expect(attack.mSpell[system.effectField]).toBe(system.effectKey);
    expect(resources[system.effectKey]).toBe(system.recordReference);
    expect(system.definition.objectPath).toBe(system.recordReference);
    expect(system.definition.__type).toBe('VfxSystemDefinitionData');
    expect(system.definition.complexEmitterDefinitionData).toHaveLength(count);
    expect(skin.__linked.map((p: string) => p.toLowerCase())).toContain(system.sourceBin);
  }
});

test('every declared Baron attack asset belongs to the exact original file closure', () => {
  const assets = new Set<string>();
  const walk = (value: any) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    else if (typeof value === 'string' && value.toLowerCase().startsWith('assets/'))
      assets.add(value.toLowerCase());
  };
  Object.values(pin.systems).forEach((system: any) => walk(system.definition));
  expect([...assets].sort()).toEqual(pin.dependencies);
  expect(pin.dependencies.filter((p: string) => p.endsWith('.tex'))).toHaveLength(25);
  expect(pin.dependencies.filter((p: string) => p.endsWith('.scb'))).toHaveLength(2);
  const bins = new Set(Object.values(pin.systems).map((system: any) => system.sourceBin));
  // The skin's other linked multi-skin file is also retained as original binding context.
  const files = pin.extraction.files.map((f: any) => f.path);
  expect(new Set(files).size).toBe(29);
  expect(files).toHaveLength(29);
  for (const path of [...assets, ...bins]) expect(files).toContain(path);
  expect(pin.extraction.files.reduce((sum: number, row: any) => sum + row.bytes, 0)).toBe(1921359);
});
