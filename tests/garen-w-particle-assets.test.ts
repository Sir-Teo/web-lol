import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import source from '../docs/reference/garen-w-particles.json';
import decoded from '../docs/reference/garen-w-particles-decoded.json';
import model from '../docs/reference/garen-model.json';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (path: string) => hash(readFileSync(path));
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
test('Courage closes every dependency of all seven frozen inline and linked source systems', () => {
  expect(fileHash('docs/reference/garen-w-particles.json')).toBe(decoded.sourcePinSha256);
  expect(fileHash('docs/reference/garen-model.json')).toBe(decoded.modelPinSha256);
  const skin = model.skin.data,
    resources = skin['Characters/Garen/Skins/Skin0/Resources'].resourceMap;
  expect(Object.keys(source.resources).sort()).toEqual(
    Object.keys(resources)
      .filter((key) => key.startsWith('Garen_W_'))
      .sort()
  );
  expect(
    Object.fromEntries(
      Object.entries(source.resources).map(([key, r]) => [
        key,
        r.definition.complexEmitterDefinitionData.length,
      ])
    )
  ).toEqual({
    Garen_W_Shoulder_L: 2,
    Garen_W_Shoulder_R: 2,
    Garen_W_Buff: 7,
    Garen_W_Cas: 4,
    Garen_W_Deflect: 1,
    Garen_W_Avatar: 2,
    Garen_W_Avatar_Fade: 2,
  });
  for (const [key, r] of Object.entries(source.resources)) {
    expect(resources[key as keyof typeof resources]).toBe(r.record);
    expect(source.extraction.files.some((f) => f.path === r.sourceBin)).toBe(true);
    expect([
      ...skin.__linked.map((p) => p.toLowerCase()),
      'data/characters/garen/skins/skin0.bin',
    ]).toContain(r.sourceBin);
  }
  expect(source.resources.Garen_W_Avatar.definition).toEqual(
    skin['Characters/Garen/Skins/Skin0/Particles/Garen_Base_W_Avatar']
  );
  expect(source.resources.Garen_W_Avatar_Fade.definition).toEqual(
    skin['Characters/Garen/Skins/Skin0/Particles/Garen_Base_W_Avatar_Fade']
  );
  const dependencies = [
    ...new Set(
      strings(source.resources)
        .filter((s) => s.toLowerCase().startsWith('assets/'))
        .map((s) => s.toLowerCase())
    ),
  ].sort();
  expect(source.extraction.files).toHaveLength(24);
  expect(
    source.extraction.files
      .filter((f) => !f.path.endsWith('.bin'))
      .map((f) => f.path)
      .sort()
  ).toEqual(dependencies);
  expect(
    [
      ...decoded.textures.map((t) => t.source.path),
      ...decoded.meshes.flatMap((m) => m.sourceAliases.map((s) => s.path)),
    ].sort()
  ).toEqual(dependencies);
  const inline = source.extraction.files.find(
    (f) => f.path === 'data/characters/garen/skins/skin0.bin'
  );
  expect(model.extraction.files).toContainEqual(inline);
});
test('Courage PNGs and both GLBs preserve exact recorded hashes and every exported geometry attribute', async () => {
  expect(decoded.textures).toHaveLength(18);
  expect(decoded.textures.reduce((n, t) => n + t.bytes, 0)).toBe(934113);
  for (const t of decoded.textures) {
    expect(fileHash(t.path)).toBe(t.sha256);
    expect(readFileSync(t.path).length).toBe(t.bytes);
    expect(source.extraction.files).toContainEqual(t.source);
  }
  expect(decoded.meshes.map((m) => [m.sourceVersion, m.sourceVertices, m.triangles])).toEqual([
    [[3, 2], 640, 1264],
    [[2, 2], 76, 124],
  ]);
  for (const m of decoded.meshes) {
    const bytes = readFileSync('public' + m.output.path);
    expect(hash(bytes)).toBe(m.output.sha256);
    expect(bytes.length).toBe(m.output.bytes);
    expect(m.exportedCorners).toBe(m.triangles * 3);
    const doc = await new NodeIO().readBinary(bytes),
      p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const attributeHash = (name: string) => {
      const array = p.getAttribute(name)!.getArray()!;
      return hash(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    };
    expect(attributeHash('POSITION')).toBe(m.positionFloat32Sha256);
    expect(attributeHash('TEXCOORD_0')).toBe(m.uvFloat32Sha256);
    expect(attributeHash('_SOURCE_FACE_RGB')).toBe(m.faceRgbSha256);
    expect(p.getIndices()).toBeNull();
    expect(m.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  }
});
test('legacy attached-mesh aliases retain their distinct layout and never acquire a fabricated shield pivot or bounds', () => {
  const [shield, arrow] = decoded.meshes;
  expect(shield.rawSourceBounds).toEqual([0, 0, 0, 0, 0, 0]);
  expect(shield.tailHex).toHaveLength(48);
  expect(arrow.sourceAliases.map((s) => s.path)).toEqual([
    'assets/particles/arrow01.scb',
    'assets/shared/particles/arrow01.scb',
  ]);
  expect(new Set(arrow.sourceAliases.map((s) => s.sha256)).size).toBe(1);
  expect(arrow.tailHex).toBe('');
  expect(arrow.centralPoint[2]).toBeCloseTo(0.4852991);
  expect(arrow.rawSourceBounds).not.toEqual(arrow.measuredMinMax);
  for (let axis = 0; axis < 3; axis++) {
    expect(arrow.rawSourceBounds[axis]).toBeCloseTo(arrow.measuredMinMax[axis]);
    expect(arrow.rawSourceBounds[axis + 3]).toBeCloseTo(
      arrow.measuredMinMax[axis + 3] - arrow.measuredMinMax[axis]
    );
  }
  expect(decoded.layoutReference).toMatchObject({
    revision: '76bf57bf4fd195343dec610bf0f912a06b910914',
  });
});
test('Courage keeps material overrides, attached-skin fields and undeclared emitter fields without inventing dispatch', () => {
  expect(decoded.animationParticleEvents).toEqual({});
  expect(decoded.avatarMaterialOverrides.Garen_W_Avatar_Fade[0].definition).toMatchObject({
    overrideBlendMode: 4,
    transitionSample: 0.0625,
    transitionTexture:
      'assets/characters/garen/skins/base/particles/garen_base_w_gold_trans_rgba.tex',
  });
  for (const name of ['Garen_W_Avatar', 'Garen_W_Avatar_Fade'] as const) {
    const e = source.resources[name].definition.complexEmitterDefinitionData[1];
    expect(e.primitive?.__type).toBe('VfxPrimitiveAttachedMesh');
    expect(e.sliceTechniqueRange).toBeGreaterThan(0);
  }
  expect(
    source.resources.Garen_W_Buff.definition.complexEmitterDefinitionData
      .slice(3)
      .every((e) => !('rate' in e) && !('texture' in e))
  ).toBe(true);
  expect(
    source.resources.Garen_W_Cas.definition.complexEmitterDefinitionData[0].particleLifetime
      .constantValue
  ).toBe(2.25);
  expect(
    source.resources.Garen_W_Buff.definition.complexEmitterDefinitionData[0].particleLifetime
      ?.constantValue
  ).toBe(6);
  expect(
    source.resources.Garen_W_Avatar.definition.complexEmitterDefinitionData[0].particleLifetime
      .constantValue
  ).toBe(7);
});
