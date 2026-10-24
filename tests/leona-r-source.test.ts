import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const pin = json('docs/reference/leona-r-particles.json'),
  decoded = json('docs/reference/leona-r-particles-decoded.json'),
  model = json('docs/reference/leona-model.json');
const keys = [
  'Leona_R_buf',
  'Leona_R_cas',
  'Leona_R_hit_aoe_green',
  'Leona_R_hit_aoe_red',
  'Leona_R_hit_impact',
  'Leona_R_tar',
];
test('Solar Flare preserves all six aliases, 44 enabled and nine disabled definitions with every explicit declaration', () => {
  const map = model.skin.data['Characters/Leona/Skins/Skin0/Resources'].resourceMap;
  expect(Object.keys(pin.resources).sort()).toEqual(keys);
  expect(
    Object.keys(map)
      .filter((k) => k.startsWith('Leona_R_'))
      .sort()
  ).toEqual(keys);
  expect(pin.extraction.manifest).toEqual(model.extraction.manifest);
  expect(decoded.sourcePinSha256).toBe(sha(readFileSync('docs/reference/leona-r-particles.json')));
  const records: any[] = [];
  for (const key of keys) {
    const r = pin.resources[key],
      system = decoded.systems[key];
    expect(r.record).toBe(map[key]);
    const { complexEmitterDefinitionData: emitters, ...declaration } = r.definition;
    expect(system.declaration).toEqual(declaration);
    expect(system.emitters).toHaveLength(emitters.length);
    for (const [i, e] of emitters.entries()) {
      expect(system.emitters[i]).toMatchObject({
        index: i,
        name: e.emitterName,
        disabled: e.disabled ?? false,
        primitive: e.primitive?.__type ?? 'billboard',
        definitionSha256: sha(JSON.stringify(e)),
        explicitFields: Object.keys(e).sort(),
        missingBaseTexture: !e.texture,
        playbackImplemented: false,
      });
      records.push(e);
    }
  }
  expect(records).toHaveLength(53);
  expect(records.filter((e) => !e.disabled)).toHaveLength(44);
  expect(records.filter((e) => e.disabled)).toHaveLength(9);
  expect(decoded.acceptance).toEqual({
    runtimeIntegrated: false,
    nativeDispatchVerified: false,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  });
  expect(decoded.scope.excludedResources).toEqual([]);
});
test('all 41 TEX dependencies have exact packaged PNG bytes and original dimensions, including disabled dependencies', () => {
  expect(decoded.textures).toHaveLength(41);
  expect(decoded.pathResolutions).toEqual([]);
  const files = pin.extraction.files;
  expect(files.filter((f: any) => f.path.endsWith('.bin'))).toHaveLength(4);
  expect(files.filter((f: any) => f.path.endsWith('.tex'))).toHaveLength(41);
  expect(files.filter((f: any) => f.path.endsWith('.scb'))).toHaveLength(4);
  for (const t of decoded.textures) {
    expect(files.find((f: any) => f.path === t.source.path)).toEqual(t.source);
    const bytes = readFileSync(t.path);
    expect(bytes.length).toBe(t.bytes);
    expect(sha(bytes)).toBe(t.sha256);
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([t.width, t.height]);
  }
});
test('four source SCBs retain expanded positions, UV and both color streams while reusing exact E/W packages', () => {
  expect(
    decoded.meshes.map((m: any) => [
      m.sourceVertices,
      m.triangles,
      m.sourceVertexColors,
      m.sourceFaceColors,
    ])
  ).toEqual([
    [40, 40, false, false],
    [90, 162, true, false],
    [100, 160, true, true],
    [400, 720, true, false],
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
  for (const [name, file] of [
    ['leona-e-contact-cylinder', 'leona-e'],
    ['leona-w-smoke-01', 'leona-w'],
  ]) {
    const shared = decoded.meshes.find((m: any) => m.output.path.endsWith('/' + name + '.glb'));
    expect(shared).toEqual(
      json('docs/reference/' + file + '-particles-decoded.json').meshes.find(
        (m: any) => m.output.path === shared.output.path
      )
    );
  }
});
test('projection, noise, linger, missing texture and sound declarations stay explicit rather than becoming fallback draws', () => {
  const enabled = Object.values(pin.resources).flatMap((r: any) =>
    r.definition.complexEmitterDefinitionData.filter((e: any) => !e.disabled)
  ) as any[];
  const primitives = new Map<string, number>();
  for (const e of enabled) {
    const key = e.primitive?.__type ?? 'billboard';
    primitives.set(key, (primitives.get(key) ?? 0) + 1);
  }
  expect(Object.fromEntries(primitives)).toEqual({
    VfxPrimitiveAttachedMesh: 1,
    VfxPrimitiveArbitraryQuad: 23,
    billboard: 8,
    VfxPrimitiveMesh: 7,
    VfxPrimitiveRay: 3,
    VfxPrimitivePlanarProjection: 2,
  });
  for (const key of ['Leona_R_hit_aoe_green', 'Leona_R_hit_aoe_red']) {
    const r = pin.resources[key].definition;
    expect(r.visibilityRadius).toBe(5000);
    expect(r.complexEmitterDefinitionData[1].primitive.mProjection).toEqual({
      mYRange: 500,
      mFading: 500,
      __type: 'VfxProjectionDefinitionData',
    });
    expect(r.soundOnCreateDefault).toBe('Play_sfx_Leona_LeonaSolarFlare_buffactivate');
  }
  const ground = pin.resources.Leona_R_cas.definition.complexEmitterDefinitionData[6];
  expect(ground).toMatchObject({ stencilRef: 7, particleLingerType: 1 });
  expect(ground.stencilMode).toBeUndefined();
  const missing = pin.resources.Leona_R_buf.definition.complexEmitterDefinitionData[3];
  expect(missing.emitterName).toBe('Activate');
  expect(missing.texture).toBeUndefined();
  expect(decoded.systems.Leona_R_buf.emitters[3].missingBaseTexture).toBe(true);
  const noise = enabled.filter((e) => e.fieldCollectionDefinition?.fieldNoiseDefinitions);
  expect(noise.map((e) => e.emitterName)).toEqual(['motes_RAINBOW', 'Bokeh']);
  for (const e of noise) {
    expect(e.fieldCollectionDefinition.fieldNoiseDefinitions[0].axisFraction).toEqual([1, 1, 1]);
    expect(e.birthOrbitalVelocity.dynamics.probabilityTables).toHaveLength(3);
  }
  expect(pin.resources.Leona_R_hit_impact.definition.soundOnCreateDefault).toBe(
    'Play_sfx_Leona_LeonaSolarFlare_hit'
  );
});
