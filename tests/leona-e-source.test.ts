import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const pin = json('docs/reference/leona-e-particles.json');
const decoded = json('docs/reference/leona-e-particles-decoded.json');
const model = json('docs/reference/leona-model.json');
const keys = [
  'Leona_E_ZB_sfx_01',
  'Leona_E_cas_arrive',
  'Leona_E_mis_dash',
  'Leona_E_mis_weapon',
  'Leona_E_tar',
];

test('Zenith retains every declared system and every enabled/disabled emitter without treating the sound carrier as a visual', () => {
  const map = model.skin.data['Characters/Leona/Skins/Skin0/Resources'].resourceMap;
  expect(Object.keys(pin.resources).sort()).toEqual(keys);
  expect(
    Object.keys(map)
      .filter((k) => k.startsWith('Leona_E_'))
      .sort()
  ).toEqual(keys);
  expect(pin.extraction.manifest).toEqual(model.extraction.manifest);
  expect(decoded.sourcePinSha256).toBe(sha(readFileSync('docs/reference/leona-e-particles.json')));
  const entries: any[] = [];
  for (const key of keys) {
    const r = pin.resources[key];
    expect(r.record).toBe(map[key]);
    const summary = decoded.systems[key].emitters;
    expect(summary).toHaveLength(r.definition.complexEmitterDefinitionData.length);
    for (const [i, e] of r.definition.complexEmitterDefinitionData.entries()) {
      expect(summary[i]).toMatchObject({
        index: i,
        name: e.emitterName,
        disabled: e.disabled ?? false,
        primitive: e.primitive?.__type ?? 'billboard',
        definitionSha256: sha(JSON.stringify(e)),
        explicitFields: Object.keys(e).sort(),
        playbackImplemented: false,
      });
      entries.push(e);
    }
  }
  expect(entries).toHaveLength(33);
  expect(entries.filter((e) => !e.disabled)).toHaveLength(20);
  expect(entries.filter((e) => e.disabled)).toHaveLength(13);
  expect(decoded.scope.visualEmitterRecords).toBe(19);
  expect(decoded.scope.soundOnlySystems).toEqual(['Leona_E_ZB_sfx_01']);
  expect(decoded.acceptance.runtimeIntegrated).toBe(false);
  expect(decoded.acceptance.nativeRenderingVerified).toBe(false);
});

test('Zenith packages all forty-two exact decoded textures including the native PATH override dependency', () => {
  expect(decoded.textures).toHaveLength(42);
  expect(decoded.pathResolutions).toEqual(pin.pathResolutions);
  const resolved = pin.pathResolutions[0];
  expect(resolved).toMatchObject({
    raw: '{97d68dc062eb5dfa}',
    wadPathHash: '97d68dc062eb5dfa',
    binType: 'PATH (18)',
    path: 'assets/characters/leona/skins/base/particles/leona_base_z_empty32.tex',
  });
  expect(pin.resources.Leona_E_mis_dash.definition.materialOverrideDefinitions[0].baseTexture).toBe(
    resolved.raw
  );
  expect(
    decoded.textures.find((t: any) => t.source.path === resolved.path).source.wadPathHash
  ).toBe(resolved.wadPathHash);
  for (const t of decoded.textures) {
    const bytes = readFileSync(t.path);
    expect(bytes.length).toBe(t.bytes);
    expect(sha(bytes)).toBe(t.sha256);
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([t.width, t.height]);
  }
});

test('Zenith keeps source mesh streams, the disabled inner sword and a byte-identical shared Eclipse cone', () => {
  expect(decoded.meshes).toHaveLength(4);
  expect(
    decoded.meshes.map((m: any) => [
      m.sourceVertices,
      m.triangles,
      m.sourceVertexColors,
      m.sourceFaceColors,
    ])
  ).toEqual([
    [40, 40, false, false],
    [183, 351, true, false],
    [333, 648, false, true],
    [333, 648, false, true],
  ]);
  for (const m of decoded.meshes) {
    const bytes = readFileSync('public' + m.output.path);
    expect(bytes.length).toBe(m.output.bytes);
    expect(sha(bytes)).toBe(m.output.sha256);
    expect(m.exportedCorners).toBe(m.triangles * 3);
    expect(m.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
    expect(Object.keys(m.attributeSha256)).not.toContain('NORMAL');
    expect(Object.keys(m.attributeSha256)).toEqual(
      expect.arrayContaining(['POSITION', '_SOURCE_POSITION', 'TEXCOORD_0'])
    );
    expect(json(('public' + m.output.path).replace('.glb', '.json'))).toEqual(m);
  }
  const shared = decoded.meshes.find(
    (m: any) => m.output.path === '/assets/models/leona-w-contact-cone.glb'
  );
  const w = json('docs/reference/leona-w-particles-decoded.json');
  expect(shared).toEqual(w.meshes.find((m: any) => m.output.path === shared.output.path));
  const emitters = pin.resources.Leona_E_mis_weapon.definition.complexEmitterDefinitionData;
  expect(emitters[1].disabled).toBe(true);
  expect(emitters[1].primitive.mMesh.mSimpleMeshName.toLowerCase()).toBe(
    decoded.meshes[3].source.path
  );
});

test('Zenith keeps authored trail/period fields and system sound links without inventing native dispatch', () => {
  const weapon = pin.resources.Leona_E_mis_weapon.definition.complexEmitterDefinitionData;
  const trails = weapon.filter(
    (e: any) => !e.disabled && e.primitive?.__type === 'VfxPrimitiveArbitraryTrail'
  );
  expect(
    trails.map((e: any) => [
      e.emitterName,
      e.primitive.mTrail.mMode,
      e.primitive.mTrail.mCutoff,
      e.primitive.mTrail.mSmoothingMode,
    ])
  ).toEqual([
    ['Kayn_Primay_Broken', 1, 1200, 1],
    ['Trail1', 1, 3000, 1],
  ]);
  expect(weapon[3]).toMatchObject({ period: 5, timeActiveDuringPeriod: 0.5, lifetime: 0.25 });
  const bank = model.skin.data['Characters/Leona/Skins/Skin0'].skinAudioProperties.bankUnits.find(
    (b: any) => b.name === 'Leona_Base_SFX'
  );
  const sounds = Object.values(pin.resources).flatMap((r: any) =>
    [r.definition.soundOnCreateDefault, r.definition.soundPersistentDefault].filter(Boolean)
  );
  expect(sounds).toHaveLength(4);
  for (const sound of sounds) expect(bank.events).toContain(sound);
  expect(pin.resources.Leona_E_ZB_sfx_01.definition.soundOnCreateDefault).toBe(
    'Play_sfx_Leona_LeonaZenithBladeMissile_hit'
  );
});
