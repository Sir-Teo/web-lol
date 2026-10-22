import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import source from '../src/content/oracle-lens.json';
const hash = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
const pinBytes = readFileSync('docs/reference/oracle-lens-source.json');
const pin = JSON.parse(pinBytes.toString());

test('Oracle source preserves current duration, ordinary ammo slots and conflicting legacy text without assigning unknown bindings', () => {
  expect(hash(pinBytes)).toBe(source.sourceSha256);
  const item = pin.items.records['Items/3364'];
  const spell = pin.items.records['Items/Spells/TrinketSweeperLvl3'].mSpell;
  const values = Object.fromEntries(item.mDataValues.map((v: any) => [v.mName, v.mValue]));
  expect([
    source.durationSeconds,
    source.maxCharges,
    source.earlyRechargeSeconds,
    source.lateRechargeSeconds,
    source.startingRadius,
    source.endingRadius,
    source.cooldownSeconds,
  ]).toEqual([8, 2, 160, 100, 600, 750, 5]);
  expect([values.GameTimeThreshold, values.MaxAmmoPre]).toEqual([14, 1]);
  expect(spell.mMaxAmmo).toEqual([2, 2, 2, 2, 2, 2, -1]);
  expect([source.targeting, source.preservesRecall, source.ignoresAbilityHaste]).toEqual([
    'Self',
    true,
    true,
  ]);
  expect(pin.strings.entries.item_3364_activeexternal).toContain('6 seconds');
  expect(pin.strings.entries.generatedtip_item_3364_externaldescription).toContain('8 seconds');
  expect(
    pin.items.records['Items/3364/Particles/3364_Buff'].complexEmitterDefinitionData.find(
      (e: any) => e.emitterName === 'Trinket_Red'
    ).particleLifetime.constantValue
  ).toBe(10.5);
  expect(hash(readFileSync('public' + pin.icon.path))).toBe(pin.icon.sha256);
});

test('all seven original Oracle scripts remain metadata-only evidence without invented active callbacks', () => {
  expect(pin.scriptExtraction.files).toHaveLength(7);
  expect(pin.scriptExtraction.files.reduce((n: number, f: any) => n + f.bytes, 0)).toBe(1560);
  let instructions = 0;
  for (const functions of Object.values(pin.scriptInventory) as any[]) {
    expect(Object.keys(functions)).toEqual(['<main>']);
    const f = functions['<main>'];
    expect(f.children).toBe(0);
    expect(
      f.instructions.every((i: any) => ['LOADBOOL', 'LOADK', 'SETGLOBAL', 'RETURN'].includes(i.op))
    ).toBe(true);
    instructions += f.instructions.length;
  }
  expect(instructions).toBe(63);
  expect(pin.missingScriptPaths).toEqual([]);
});

test('Oracle package retains all original dependencies and distinguishes colorless radar from colored laser geometry', () => {
  const ledgerBytes = readFileSync('docs/reference/oracle-lens-assets.json');
  const assets = JSON.parse(ledgerBytes.toString());
  const report = JSON.parse(
    readFileSync('docs/reference/oracle-lens-geometry-verification.json', 'utf8')
  );
  expect(hash(ledgerBytes)).toBe(source.assetsSha256);
  expect(report.assetsSha256).toBe(source.assetsSha256);
  expect(assets.sourcePinSha256).toBe(source.sourceSha256);
  expect(pin.extraction.files).toHaveLength(21);
  expect(pin.extraction.files.reduce((n: number, f: any) => n + f.bytes, 0)).toBe(1308124);
  expect([assets.rig.triangles, assets.rig.bones, assets.rig.clips[0].durationSeconds]).toEqual([
    638, 3, 2,
  ]);
  expect(assets.meshes.map((m: any) => [m.triangles, m.flags, m.faceRgbSha256 === null])).toEqual([
    [186, 2, true],
    [408, 5, false],
    [64, 5, false],
  ]);
  expect(report.skinnedMesh).toMatchObject({
    vertices: 513,
    exactIndices: true,
    exactScaledPositions: true,
    exactUVs: true,
    exactWeights: true,
    exactWeightedJoints: true,
    bones: ['Base', 'Top', 'Eye'],
  });
  expect(assets.textures).toHaveLength(15);
  for (const m of [assets.rig, ...assets.meshes])
    expect(hash(readFileSync('public' + m.output.path))).toBe(m.output.sha256);
  for (const t of assets.textures) expect(hash(readFileSync(t.path))).toBe(t.sha256);
  for (const binding of Object.values(source.bindings)) {
    expect(hash(readFileSync('public/' + binding.mesh))).toBe(
      [assets.rig, ...assets.meshes].find((m: any) => m.output.path === '/' + binding.mesh).output
        .sha256
    );
    expect(assets.textures.some((t: any) => t.path === 'public/' + binding.texture)).toBe(true);
  }
});
