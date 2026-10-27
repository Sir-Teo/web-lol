import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import w from '../src/content/leona-w-particles.json';
import aa from '../src/content/garen-aa-particles.json';
import q from '../src/content/garen-q-impact-particles.json';
import r from '../src/content/garen-r-particles.json';

const raw = (file: string) => JSON.parse(readFileSync('docs/reference/' + file, 'utf8'));
test('the five retained modern rays keep their native packet integration assumptions', () => {
  const ws = raw('leona-w-particles.json'),
    as = raw('garen-aa-particles-source.json').definitions,
    qs = raw('garen-q-particles.json'),
    rs = raw('garen-r-kill-audio-link.json');
  const definitions = [
    ...[3, 8].map((index) => ({
      profile: w.profiles[index],
      definition:
        ws.resources[w.profiles[index].system].definition.complexEmitterDefinitionData[
          w.profiles[index].index
        ],
      blend: 0,
    })),
    {
      profile: aa.profiles[9],
      definition:
        as.resources[aa.profiles[9].system].definition.complexEmitterDefinitionData[
          aa.profiles[9].index
        ],
      blend: 0,
    },
    {
      profile: q[3],
      definition: qs.resources.Garen_Q_Tar.definition.complexEmitterDefinitionData[q[3].index],
      blend: 4,
    },
    {
      profile: r[18],
      definition: rs.definition.complexEmitterDefinitionData[r[18].index],
      blend: 4,
    },
  ];
  for (const { profile, definition, blend } of definitions) {
    expect(profile.kind).toBe('ray');
    expect(definition.primitive.__type).toBe('VfxPrimitiveRay');
    expect(definition.modulationFactor).toBeUndefined();
    expect(profile.blend).toBe(blend);
    expect(definition.uvScale).toBeUndefined();
    expect(definition.birthUvScrollRate).toBeUndefined();
  }
  for (const index of [3, 8]) {
    const p = w.profiles[index];
    for (const uv of [p.uv, p.multiplier!.uv]) {
      expect(uv.divisions).toEqual([1, 1]);
      expect(uv.frames).toBe(1);
      expect(uv.randomStart).toBe(false);
      expect(uv.scale.values).toEqual([[1, 1]]);
      expect(uv.offset.values).toEqual([[0, 0]]);
      expect(uv.birthScroll.values).toEqual([[0, 0]]);
      expect(uv.scroll.values).toEqual([[0, 0]]);
    }
  }
  expect([aa.profiles[9].lookup, q[3].lookup, r[18].lookup]).toEqual([null, null, null]);
  expect([aa.profiles[9].atlas.grid, q[3].atlas.grid, r[18].atlas.grid]).toEqual([
    [1, 1],
    [1, 1],
    [1, 1],
  ]);
});
