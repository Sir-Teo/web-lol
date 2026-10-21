import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profile from '../src/content/garen-q-particles.json';
import audit from '../docs/reference/garen-q-particle-profiles.json';
import source from '../docs/reference/garen-q-particles.json';
import { garenQTrailParticles } from '../src/render/garen-q-particles';
import type { ChampionState } from '../src/simulation/types';

const records: ChampionState['garenQVisuals'] = [
  {
    startTick: 100,
    rank: 1,
    stopTick: null,
    endReason: null,
    attacks: [
      {
        startTick: 110,
        releaseTick: 129,
        endTick: 205,
        targetId: 2,
        origin: { x: 0, y: 0 },
        facing: 1,
        stopTick: null,
        endReason: null,
        impact: null,
        landing: null,
      },
    ],
  },
];
test('Q trail pins its complete source mesh profile, explicit bone/frame and default evidence', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  expect(hash(audit.output.path)).toBe(audit.output.sha256);
  expect(hash('docs/reference/garen-q-particles.json')).toBe(audit.sourcePinSha256);
  expect(hash('docs/reference/garen-q-particles-decoded.json')).toBe(audit.decodedAssetsSha256);
  expect(hash('docs/reference/garen-spin-defaults.json')).toBe(audit.defaultsEvidenceSha256);
  const e = source.resources.Garen_Q_Sword_Trail.definition.complexEmitterDefinitionData[0];
  expect(profile.scale).toEqual(e.birthScale0.constantValue);
  expect(profile.rotation).toEqual(e.birthRotation0.constantValue);
  expect(profile.position).toEqual(e.EmitterPosition.constantValue);
  expect(profile.scroll).toEqual(e.birthUvScrollRate.constantValue);
  expect(profile.count).toBe(2);
  expect(profile.life).toBe(0.25);
  expect(profile.bone).toBe('C_Buffbone_Glb_Center_Loc');
  expect(profile.startFrame).toBe(8);
  expect(
    new Set([...audit.implemented, ...audit.deferred].map((e) => e.system + ':' + e.index)).size
  ).toBe(31);
});
test('Q trail follows captured frame-8 timing, two source births, exact life and deterministic scroll/lookup', () => {
  expect(garenQTrailParticles(records, NaN)).toEqual([]);
  expect(garenQTrailParticles(records, 126)).toEqual([]);
  const first = garenQTrailParticles(records, 127);
  expect(first).toHaveLength(2);
  expect(first[0]).toMatchObject({
    bornTick: 127,
    age: 0,
    facing: 1,
    lookup: [0, 1],
    scroll: [-0, 0],
  });
  const mid = garenQTrailParticles(records, 134.5)[0];
  expect(mid.age).toBe(0.125);
  expect(mid.lookup).toEqual([0.5, 1]);
  expect(mid.scroll).toEqual([-0.1875, 0]);
  expect(garenQTrailParticles(records, 142)).toEqual([]);
  expect(garenQTrailParticles(JSON.parse(JSON.stringify(records)), 134.5)[0]).toEqual(mid);
});
test('Q pose stops before birth suppress future frame events; stops after birth remove the bone-bound trail immediately', () => {
  for (const stopTick of [112, 126, 127, 130]) {
    const copy = structuredClone(records),
      a = copy[0].attacks[0];
    a.stopTick = stopTick;
    a.endReason = 'target-lost';
    expect(garenQTrailParticles(copy, 135)).toEqual([]);
    expect(garenQTrailParticles(copy, stopTick)).toEqual([]);
    if (stopTick > 127) expect(garenQTrailParticles(copy, stopTick - 0.01)).toHaveLength(2);
  }
});
