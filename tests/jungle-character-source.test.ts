import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const raw = readFileSync('docs/reference/jungle-character-source.json');
const pin = JSON.parse(raw.toString());
const map = JSON.parse(readFileSync('docs/reference/jungle-map-source.json', 'utf8'));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const records = (name: string) =>
  pin.records[`data/characters/${name.toLowerCase()}/${name.toLowerCase()}.bin`];
const root = (name: string) => records(name)[`Characters/${name}/CharacterRecords/Root`];

test('ordinary jungle definitions and rig dependencies use the same frozen archive as the map', () => {
  expect(pin.extraction.manifest).toEqual(map.extraction.manifest);
  expect(pin.extraction.archive).toBe(map.extraction.archive);
  expect(pin.extraction.referenceVersion).toBe('16.18.8175716');
  expect(pin.characters).toHaveLength(11);
  expect(pin.extraction.files).toHaveLength(64);
  expect(new Set(pin.extraction.files.map((f: any) => f.path)).size).toBe(64);
  for (const name of pin.characters) {
    expect(root(name).__type).toBe('CharacterRecord');
    expect(root(name).mCharacterName).toBe(name);
  }
});

test('root and alternate records retain authored values without guessing active-mode selection', () => {
  const blue = Object.values(records('SRU_Blue')).filter(
    (v: any) => v.__type === 'CharacterRecord'
  ) as any[];
  expect(blue).toHaveLength(4);
  expect(blue.map((v) => v.baseHPModifiable.baseValue).sort((a, b) => a - b)).toEqual([
    1200, 2300, 2300, 3750,
  ]);
  expect(root('SRU_Blue')).toMatchObject({
    baseHPModifiable: { baseValue: 2300 },
    baseDamageModifiable: { baseValue: 66 },
    expGivenOnDeath: 95,
    goldGivenOnDeath: 90,
    experienceRadius: -1,
    overrideGameplayCollisionRadius: 131,
  });
  expect(root('SRU_Blue').attackRangeModifiable).toBeUndefined();
  expect(root('SRU_MurkwolfMini').baseDamageModifiable).toBeUndefined();
  expect(root('SRU_Blue').baseStaticHPRegenModifiable.baseValue).toBe(0);
  expect(root('Sru_Crab').unitTagsString.split(' | ')).toContain('Special_Peaceful');
});

for (const [name, count] of [
  ['SRU_Blue', 16],
  ['SRU_Gromp', 25],
] as const) {
  test(`${name} conversion preserves every authored atomic state and exact output provenance`, () => {
    const slug = name.toLowerCase().replaceAll('_', '-');
    const manifest = JSON.parse(readFileSync(`public/assets/models/${slug}-base.json`, 'utf8'));
    const bytes = readFileSync(`public/assets/models/${slug}-base.glb`);
    expect(hash(bytes)).toBe(manifest.output.sha256);
    expect(bytes.length).toBe(manifest.output.bytes);
    expect(manifest.definitionsSha256).toBe(hash(raw));
    expect(manifest.sourceManifest).toEqual(pin.extraction.manifest);
    expect(manifest.sources).toEqual(pin.extraction.files);
    const source = pin.models[name];
    expect(manifest.clips).toHaveLength(count);
    expect(Object.fromEntries(manifest.clips.map((c: any) => [c.state, c.source]))).toEqual(
      source.atomicClips
    );
    expect(manifest.clips.every((c: any) => c.durationSeconds > 0)).toBe(true);
    const skin =
      pin.records[`data/characters/${name.toLowerCase()}/skins/skin0.bin`][source.skinKey]
        .skinMeshProperties;
    expect(manifest.unitScale).toBe(0.01 * (skin.skinScale ?? 1));
    expect(manifest.triangles).toBeGreaterThan(100);
    expect(manifest.bones).toBeGreaterThan(10);
    expect(manifest.initialSubmeshesToHide).toEqual(
      name === 'SRU_Gromp' ? ['SRU_Gromp_Mini_Mat', 'Toad_Spawn_Mat'] : []
    );
    // The base review cannot silently become a placed Blue source object: those
    // source objects explicitly reference a different skin.
    const placed = map.records.neutralCharacterEntities.filter(
      (v: any) => v.record.Character.CharacterRecord === `Characters/${name}/CharacterRecords/Root`
    );
    expect(placed).toHaveLength(2);
    expect(new Set(placed.map((v: any) => v.record.Character.Skin))).toEqual(
      new Set([`Characters/${name}/Skins/Skin${name === 'SRU_Blue' ? 4 : 0}`])
    );
  });
}
