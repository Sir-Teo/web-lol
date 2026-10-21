import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import source from '../docs/reference/garen-q-particles.json';
import decoded from '../docs/reference/garen-q-particles-decoded.json';
import model from '../docs/reference/garen-model.json';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (path: string) => hash(readFileSync(path));
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('Decisive Strike closes every dependency of all eleven frozen linked source systems', () => {
  expect(fileHash('docs/reference/garen-q-particles.json')).toBe(decoded.sourcePinSha256);
  expect(fileHash('docs/reference/garen-model.json')).toBe(decoded.modelPinSha256);
  const skin = model.skin.data,
    resources = skin['Characters/Garen/Skins/Skin0/Resources'].resourceMap;
  expect(Object.keys(source.resources).sort()).toEqual(
    Object.keys(resources)
      .filter((key) => key.startsWith('Garen_Q_'))
      .sort()
  );
  expect(
    Object.fromEntries(Object.entries(decoded.systems).map(([key, s]) => [key, s.emitterCount]))
  ).toEqual({
    Garen_Q_Silence: 1,
    Garen_Q_mis_axis_01: 3,
    Garen_Q_Sword_Swipe_Blur: 2,
    Garen_Q_Buf: 0,
    Garen_Q_Jump: 2,
    Garen_Q_Jump_Blur: 1,
    Garen_Q_Land: 5,
    Garen_Q_Cas: 4,
    Garen_Q_Cas_Sword: 4,
    Garen_Q_Sword_Trail: 1,
    Garen_Q_Tar: 8,
  });
  for (const [key, r] of Object.entries(source.resources)) {
    expect(resources[key as keyof typeof resources]).toBe(r.record);
    expect(source.extraction.files.some((f) => f.path === r.sourceBin)).toBe(true);
    expect(skin.__linked.map((p) => p.toLowerCase())).toContain(r.sourceBin);
  }
  const dependencies = [
    ...new Set(
      strings(source.resources)
        .filter((s) => s.toLowerCase().startsWith('assets/'))
        .map((s) => s.toLowerCase())
    ),
  ].sort();
  expect(source.extraction.files).toHaveLength(39);
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
});

test('Q textures and all four GLBs retain exact file hashes and every geometry attribute', async () => {
  expect(decoded.textures).toHaveLength(29);
  expect(decoded.textures.reduce((n, t) => n + t.bytes, 0)).toBe(1250707);
  for (const t of decoded.textures) {
    expect(fileHash(t.path)).toBe(t.sha256);
    expect(readFileSync(t.path).length).toBe(t.bytes);
    expect(source.extraction.files).toContainEqual(t.source);
  }
  expect(decoded.meshes.map((m) => [m.sourceVertices, m.triangles])).toEqual([
    [4, 2],
    [32, 16],
    [80, 76],
    [250, 500],
  ]);
  expect(decoded.meshes.reduce((n, m) => n + m.output.bytes, 0)).toBe(50208);
  for (const m of decoded.meshes) {
    const bytes = readFileSync('public' + m.output.path);
    expect(hash(bytes)).toBe(m.output.sha256);
    expect(bytes.length).toBe(m.output.bytes);
    expect(m.exportedCorners).toBe(m.triangles * 3);
    expect(m.sourceVersion).toEqual([3, 2]);
    expect(m.rawSourceBounds).toEqual([0, 0, 0, 0, 0, 0]);
    expect(m.tailHex).toHaveLength(48);
    const doc = await new NodeIO().readBinary(bytes),
      p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    for (const [name, expected] of [
      ['POSITION', m.positionFloat32Sha256],
      ['TEXCOORD_0', m.uvFloat32Sha256],
      ['_SOURCE_FACE_RGB', m.faceRgbSha256],
    ]) {
      const array = p.getAttribute(name)!.getArray()!;
      expect(hash(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))).toBe(expected);
    }
    expect(p.getIndices()).toBeNull();
    expect(m.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  }
});

test('Q preserves the absent buff emitter array and the source mesh/ray primitive declarations', () => {
  expect(source.resources.Garen_Q_Buf.definition).toEqual({
    particleName: 'Garen_Base_Q_Buf',
    particlePath: 'Characters/Garen/Skins/Skin0/Particles/Garen_Base_Q_Buf',
    objectPath: 'Characters/Garen/Skins/Skin0/Particles/Garen_Base_Q_Buf',
    __type: 'VfxSystemDefinitionData',
  });
  expect(decoded.systems.Garen_Q_Buf).toMatchObject({
    emitterArrayDeclared: false,
    emitterCount: 0,
    emitters: [],
  });
  expect(decoded.systems.Garen_Q_Sword_Trail.emitters[0].primitive).toBe('VfxPrimitiveMesh');
  expect(decoded.systems.Garen_Q_Tar.emitters[3].primitive).toBe('VfxPrimitiveRay');
});

test('Spell1 particle bindings preserve missing frames, missing bones and missing kill fields', () => {
  const events = decoded.animationParticleEvents;
  expect(Object.keys(events)).toHaveLength(4);
  expect(Object.values(events).map((e) => e.mEffectKey)).toEqual([
    'Garen_Q_Jump',
    'Garen_Q_Land',
    'Garen_Q_Sword_Trail',
    'Garen_Q_Jump_Blur',
  ]);
  const clip = model.animations.data['Characters/Garen/Animations/Skin0'].mClipDataMap.Spell1;
  expect(
    Object.fromEntries(
      Object.entries(clip.mEventDataMap)
        .filter(([, e]) => 'mEffectKey' in e && e.mEffectKey.startsWith('Garen_Q_'))
        .map(([key, e]) => ['Spell1:' + key, e])
    )
  ).toEqual(events);
  expect(events['Spell1:{c1241270}']).not.toHaveProperty('mStartFrame');
  expect(events['Spell1:{f5391780}']).not.toHaveProperty('mStartFrame');
  expect(events['Spell1:{ec25cf91}'].mStartFrame).toBe(9);
  expect(events['Spell1:{e35b3364}'].mStartFrame).toBe(8);
  expect(events['Spell1:{c1241270}'].mParticleEventDataPairList[0]).not.toHaveProperty('mBoneName');
  expect(events['Spell1:{ec25cf91}'].mParticleEventDataPairList[0]).not.toHaveProperty('mBoneName');
  expect(events['Spell1:{e35b3364}'].mParticleEventDataPairList[0].mBoneName).toBe(
    'C_Buffbone_Glb_Center_Loc'
  );
  expect(events['Spell1:{f5391780}'].mParticleEventDataPairList[0].mBoneName).toBe('Root');
  expect(events['Spell1:{e35b3364}']).not.toHaveProperty('mIsKillEvent');
});
