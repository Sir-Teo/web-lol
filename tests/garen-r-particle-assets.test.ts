import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import source from '../docs/reference/garen-r-particles.json';
import decoded from '../docs/reference/garen-r-particles-decoded.json';
import model from '../docs/reference/garen-model.json';
import kill from '../docs/reference/garen-r-kill-particles.json';
import killLink from '../docs/reference/garen-r-kill-audio-link.json';

const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
test('R particle assets close every dependency of the three frozen source systems', () => {
  expect(hash('docs/reference/garen-r-particles.json')).toBe(decoded.sourcePinSha256);
  expect(hash('docs/reference/garen-model.json')).toBe(decoded.modelPinSha256);
  const skin = model.skin.data;
  const resourceMap = skin['Characters/Garen/Skins/Skin0/Resources'].resourceMap;
  expect(
    Object.values(source.resources).map((r) => r.definition.complexEmitterDefinitionData.length)
  ).toEqual([2, 3, 12]);
  for (const [name, record] of Object.entries(source.resources)) {
    expect(resourceMap[name as keyof typeof resourceMap]).toBe(record.record);
    expect(skin.__linked.map((s) => s.toLowerCase())).toContain(record.sourceBin);
  }
  const dependencies = [
    ...new Set(
      strings(source.resources)
        .filter((s) => s.toLowerCase().startsWith('assets/'))
        .map((s) => s.toLowerCase())
    ),
  ].sort();
  expect(
    source.extraction.files
      .filter((f) => !f.path.endsWith('.bin'))
      .map((f) => f.path)
      .sort()
  ).toEqual(dependencies);
  expect(
    [
      ...decoded.textures.map((t) => t.source.path),
      ...decoded.meshes.map((m) => m.source.path),
    ].sort()
  ).toEqual(dependencies);
});
test('R asset outputs retain recorded bytes, source triangle counts and exact round trips', () => {
  expect(decoded.meshes.map((m) => m.triangles)).toEqual([380, 320, 2, 2156]);
  for (const m of decoded.meshes) {
    expect(hash(`public${m.output.path}`)).toBe(m.output.sha256);
    expect(readFileSync(`public${m.output.path}`).length).toBe(m.output.bytes);
    expect(m.exportedCorners).toBe(m.triangles * 3);
    expect(m.rawSourceBounds).toEqual([0, 0, 0, 0, 0, 0]);
    expect(m.tailHex).toHaveLength(48);
    expect(m.validation).toEqual({ errors: 0, warnings: 0, roundTripAttributesExact: true });
  }
  expect(decoded.textures).toHaveLength(21);
  for (const t of decoded.textures) {
    expect(hash(t.path)).toBe(t.sha256);
    expect(readFileSync(t.path).length).toBe(t.bytes);
  }
});
test('the sole authored R particle event remains a frame-10 caster attachment', () => {
  const events = Object.values(decoded.animationParticleEvents);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    mEffectKey: 'Garen_R_Cas',
    mStartFrame: 10,
    mIsLoop: false,
    mIsKillEvent: false,
    mParticleEventDataPairList: [{ mBoneName: 'C_Buffbone_GLB_Layout_Loc' }],
  });
  expect(decoded.systems.Garen_R_Sword_Tar.unresolvedIdentifiers).toEqual([]);
  expect(decoded.systems.Garen_R_Tar_Impact.unresolvedIdentifiers).toEqual(['{ee39916f}']);
});

test('Champ_Kill closes its seven frozen texture dependencies without changing the sound binding pin', () => {
  expect(hash('docs/reference/garen-r-kill-audio-link.json')).toBe(kill.sourceLinkSha256);
  expect(killLink.particlePinSha256).toBe(hash('docs/reference/garen-r-particles.json'));
  expect(source.extraction.files).toContainEqual(killLink.sourceFile);
  expect(
    model.skin.data['Characters/Garen/Skins/Skin0/Resources'].resourceMap.Garen_R_Champ_Kill
  ).toBe(killLink.record);
  const dependencies = [
    ...new Set(
      strings(killLink.definition)
        .filter((s) => s.toLowerCase().startsWith('assets/'))
        .map((s) => s.toLowerCase())
    ),
  ].sort();
  expect(kill.extraction.files.map((f) => f.path).sort()).toEqual(dependencies);
  expect(kill.textures.map((t) => t.source.path).sort()).toEqual(dependencies);
  expect(kill.textures).toHaveLength(7);
  for (const t of kill.textures) {
    expect(hash(t.path)).toBe(t.sha256);
    expect(readFileSync(t.path).length).toBe(t.bytes);
    expect(kill.extraction.files).toContainEqual(t.source);
  }
});
