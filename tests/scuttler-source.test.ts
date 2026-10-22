import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import profile from '../src/content/scuttler.json';
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const pin = JSON.parse(readFileSync(profile.sourcePin, 'utf8'));
const manifest = JSON.parse(readFileSync('public/assets/models/sru-crab-base.json', 'utf8'));
const point = (p: number[]) => ({ x: p[0] - 7425, y: 7425 - p[2] });

test('Scuttler rig and complete source inventory remain linked to original archive and parent hashes', () => {
  expect(profile.sourcePinSha256).toBe(sha(profile.sourcePin));
  for (const p of Object.values(pin.parents) as any[]) expect(p.sha256).toBe(sha(p.path));
  expect(pin.extraction.files).toHaveLength(22);
  expect(pin.scriptExtraction.files).toHaveLength(18);
  expect(manifest.definitionsSha256).toBe(profile.sourcePinSha256);
  expect(manifest.output.sha256).toBe(sha('public/assets/models/sru-crab-base.glb'));
  expect(profile.modelSha256).toBe(manifest.output.sha256);
  expect(manifest.triangles).toBe(4218);
  expect(manifest.bones).toBe(66);
  expect(manifest.skinScale).toBe(0.75);
  const ai = pin.scriptInventory['data/scripts/rivercrab.luabin64'];
  expect(ai.children).toHaveLength(9);
  expect(ai.children[2].instructions[0].operands[1]).toEqual({ constant: 'InMelee' });
  expect(ai.children[3].instructions[0].operands[2]).toEqual({ constant: false });
  expect(ai.children[4].constants).toContain('ServerCastSpellOnPos');
  expect(
    pin.scriptInventory['data/characters/sru_crab/charscriptsru_crab.luabin64'].instructions.map(
      (i: any) => i.op
    )
  ).toEqual(['RETURN']);
});

test('peaceful Root stats do not invent attack or death clips, and conflicting emergence records stay separate', () => {
  expect(profile.unitTags.split(' | ')).toContain(profile.peacefulTag);
  expect(profile.stats.damage).toBe(35);
  expect(manifest.clips).toHaveLength(17);
  expect(Object.keys(profile.clips)).toHaveLength(17);
  for (const c of Object.values(profile.clips))
    expect(manifest.clips.find((v: any) => v.name === c.name)).toMatchObject({
      state: c.sourceState,
      durationSeconds: c.durationSeconds,
    });
  expect(Object.keys(profile.clips).some((k) => /attack|death/.test(k))).toBe(false);
  expect(profile.rootUntargetableSpawnSeconds).toBe(1.5);
  expect(profile.camps.map((c) => c.legacyLeadupSeconds)).toEqual([2.2, 2.2]);
  expect(profile.clips.spawn.durationSeconds).toBeCloseTo(1.6);
  expect(profile.clips.hide.durationSeconds).toBeCloseTo(0.9666667);
  expect(profile.camps.map((c) => c.legacyFirstReadySeconds)).toEqual([146, 146]);
  expect(profile.firstReadyBaselineSeconds).toBe(175);
  expect(profile.shrineEffectAmountCandidates.map((v) => v![0])).toEqual([
    90, 0.30000001192092896, 2,
  ]);
});

test('both five-point river paths retain the open-constructor final point and named spawn locators', () => {
  for (const side of ['baron', 'dragon'] as const) {
    const src = pin.rivers[side].region,
      r = profile.rivers[side];
    expect(r.path).toHaveLength(5);
    expect(r.path).toEqual(Object.values(src.Path).map((p) => point(p as number[])));
    expect(r.center).toEqual(point(src.CenterPos));
    expect(r.start).toEqual(point(src.StartPos));
    expect(r.end).toEqual(point(src.EndPos));
    expect(r.initialOneBasedDestination).toBe(4);
    expect(r.initialDirection).toBe(-1);
  }
  expect(profile.rivers.baron.path.at(-1)).toEqual(point([5890, 0, 8810]));
  expect(profile.rivers.dragon.path.at(-1)).toEqual(point([9190, 0, 6030]));
  for (const [i, c] of profile.camps.entries()) {
    const source = pin.camps[i];
    expect(c.point).toEqual(point(source.members[0].locator.transform[3]));
    expect(source.members[0].lookup).toBe(i === 0 ? 'DragonEelCamp' : 'BaronEelCamp');
    expect(source.members[0].locator.name.toLowerCase()).toBe(
      source.members[0].lookup.toLowerCase()
    );
    expect(c.legacySpawnClip).toBe('crab_hide');
    expect(c.legacyRespawnSeconds).toBe(150);
  }
});

test('legacy coordinated selection and feature gates remain evidence rather than independent camp assumptions', () => {
  const selection = pin.evidence.deathSelection.instructions;
  expect(selection.find((i: any) => i.pc === 192).operands[1]).toEqual({
    constant: 'RawLSDeprecationNeutralMinions',
  });
  expect(selection.find((i: any) => i.pc === 220).operands[1]).toEqual({ constant: 4 });
  expect(selection.find((i: any) => i.pc === 222).operands[1]).toEqual({ constant: 25 });
  expect(selection.find((i: any) => i.pc === 227).operands[1]).toEqual({ constant: 75 });
  expect(selection.find((i: any) => i.pc === 238).operands[1]).toEqual({ constant: 15 });
  expect(selection.find((i: any) => i.pc === 246).operands[1]).toEqual({ constant: 16 });
  const components = pin.scriptInventory['data/scripts/rivercrab.luabin64'].constants;
  for (const c of [
    'WanderAndGraze',
    'SkittishMonster',
    'LockMovementToRiver',
    'NonAggressiveTauntBehavior',
  ])
    expect(components).toContain(c);
});
