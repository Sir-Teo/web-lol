import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
import pin from '../docs/reference/leona-w-particles.json';
import audit from '../docs/reference/leona-w-particles-decoded.json';
import model from '../docs/reference/leona-model.json';

const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

test('Eclipse source packaging covers every standard-game resource and all fifty records, including twenty disabled layers', () => {
  expect(audit.sourcePinSha256).toBe(hash(readFileSync('docs/reference/leona-w-particles.json')));
  expect(pin.extraction.manifest).toEqual(model.extraction.manifest);
  const resources = model.skin.data['Characters/Leona/Skins/Skin0/Resources'].resourceMap;
  expect(Object.keys(pin.resources).sort()).toEqual(
    Object.keys(resources)
      .filter((k) => k.startsWith('Leona_W_') && !k.includes('DoomBot'))
      .sort()
  );
  expect(Object.keys(audit.systems).sort()).toEqual(Object.keys(pin.resources).sort());
  for (const key of Object.keys(pin.resources) as (keyof typeof pin.resources)[]) {
    const r = pin.resources[key],
      packaged = audit.systems[key];
    expect(r.record).toBe(resources[key]);
    expect(packaged.record).toBe(r.record);
    expect(packaged.emitters).toHaveLength(r.definition.complexEmitterDefinitionData.length);
    r.definition.complexEmitterDefinitionData.forEach((e, i) => {
      expect(packaged.emitters[i]).toMatchObject({
        index: i,
        name: e.emitterName,
        disabled: 'disabled' in e ? e.disabled : false,
        explicitFields: Object.keys(e).sort(),
        definitionSha256: hash(JSON.stringify(e)),
      });
    });
  }
  const records = Object.values(audit.systems).flatMap((s) => s.emitters);
  expect(records).toHaveLength(50);
  expect(records.filter((e) => e.disabled)).toHaveLength(20);
  expect(audit.meshes.filter((m) => m.sourceVertexColors)).toHaveLength(4);
  expect(audit.meshes.filter((m) => m.sourceFaceColors)).toHaveLength(2);
});

test('all thirty-six Eclipse TEX dependencies retain pinned full-resolution PNG bytes', () => {
  expect(audit.textures).toHaveLength(36);
  expect(new Set(audit.textures.map((t) => t.source.path)).size).toBe(36);
  expect(audit.textures.map((t) => t.source).sort((a, b) => a.path.localeCompare(b.path))).toEqual(
    pin.extraction.files
      .filter((p) => p.path.endsWith('.tex'))
      .sort((a, b) => a.path.localeCompare(b.path))
  );
  for (const t of audit.textures) {
    const bytes = readFileSync(t.path);
    expect(bytes.length).toBe(t.bytes);
    expect(hash(bytes)).toBe(t.sha256);
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([t.width, t.height]);
  }
});

test.each(audit.meshes)(
  '$output.path preserves UV seams, raw coordinates and both authored color streams',
  async (m) => {
    const bytes = readFileSync('public' + m.output.path);
    expect(bytes.length).toBe(m.output.bytes);
    expect(hash(bytes)).toBe(m.output.sha256);
    expect(
      JSON.parse(readFileSync('public' + m.output.path.replace('.glb', '.json'), 'utf8'))
    ).toEqual(m);
    const report = await validator.validateBytes(bytes);
    expect([report.issues.numErrors, report.issues.numWarnings]).toEqual([0, 0]);
    const root = (await new NodeIO().readBinary(bytes)).getRoot();
    expect(root.listMeshes()).toHaveLength(1);
    const p = root.listMeshes()[0].listPrimitives()[0];
    expect(p.getIndices()).toBeNull();
    expect(p.getAttribute('POSITION')!.getCount()).toBe(m.triangles * 3);
    expect(p.getAttribute('TEXCOORD_0')!.getCount()).toBe(m.triangles * 3);
    const raw = p.getAttribute('_SOURCE_POSITION')!.getArray()!;
    expect(p.getAttribute('POSITION')!.getArray()).toEqual(Float32Array.from(raw, (v) => v * 0.01));
    expect(!!p.getAttribute('_SOURCE_VERTEX_BGRA')).toBe(m.sourceVertexColors);
    expect(!!p.getAttribute('_SOURCE_FACE_RGB')).toBe(m.sourceFaceColors);
    for (const semantic of p.listSemantics()) {
      const array = p.getAttribute(semantic)!.getArray()!;
      expect(hash(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))).toBe(
        (m.attributeSha256 as Record<string, string>)[semantic]
      );
    }
  }
);
