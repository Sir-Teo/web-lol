import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const directory = 'docs/reference/ahri/';
const pin = json(directory + 'character.json');
const declarations = json(directory + 'declarations.json');
const external = json(directory + 'ddragon-16.18.1.json').data.Ahri;
const records = pin.records;
const spell = (id: string) => declarations.spells.find((entry: any) => entry.id === id);
const missile = (ability: string, id: string) =>
  declarations.missiles[`Characters/Ahri/Spells/${ability}Ability/${id}`];
const named = (id: string, name: string) =>
  spell(id).dataValues.find((value: any) => value.name === name).rankValues;

test('Ahri retains the complete archive closure, source bytes and matching model cohort', () => {
  for (const input of declarations.inputs) {
    const bytes = readFileSync(directory + input.file);
    expect(bytes.length).toBe(input.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(input.sha256);
  }
  expect(records).toEqual(json(directory + 'names.json'));
  expect(Object.keys(records).filter((key) => key !== '__linked')).toHaveLength(64);
  expect(records.__linked).toEqual([]);
  expect(declarations.sourceRecordCount).toBe(64);
  expect(pin.sha256).toBe(
    declarations.inputs.find((input: any) => input.file === 'names.json').sha256
  );
  const model = json('docs/reference/ahri-model.json');
  for (const field of ['referenceVersion', 'manifest', 'archive']) {
    expect(declarations.extraction[field]).toEqual(model.extraction[field]);
  }
  expect(declarations.extraction.files).toEqual([
    {
      path: 'data/characters/ahri/ahri.bin',
      wadPathHash: 'a847c7a46bc6730e',
      sha256: '121997c9c4ef2ff0f671b659d64d2e22cb71208216ddcc3c4f552a17f196d2cb',
      bytes: 30475,
    },
  ]);
});

test('all 18 stat comparisons retain raw floats and the unresolved AD-growth disagreement', () => {
  expect(declarations.stats).toHaveLength(18);
  const root = records['Characters/Ahri/CharacterRecords/Root'];
  expect(declarations.character.declaration).toEqual(root);
  for (const entry of declarations.stats) {
    const source = entry.field.split('.').reduce((value: any, key: string) => value[key], root);
    expect(entry.sourceValue).toBe(source);
    expect(entry.dataDragonValue).toBe(external.stats[entry.dataDragonField]);
    expect(entry.agreesWithinFloat32Tolerance).toBe(
      Math.abs(source * entry.sourceToDataDragonFactor - entry.dataDragonValue) <= 1e-6
    );
  }
  expect(declarations.stats.filter((entry: any) => !entry.agreesWithinFloat32Tolerance)).toEqual([
    expect.objectContaining({ name: 'damageGrowth', sourceValue: 3, dataDragonValue: 0 }),
  ]);
  expect(root.basicAttack).toEqual({
    mAttackDelayCastOffsetPercent: -0.10000000149011612,
    mAttackProbability: 0.5,
    __type: 'AttackSlotData',
  });
  expect(root.basicAttack).not.toHaveProperty('mAttackDelayCastOffsetPercentAttackSpeedRatio');
});

test('rank tables match independent client arrays and preserve complete root spell declarations', () => {
  expect(declarations.spells.map((entry: any) => entry.id)).toEqual([
    'AhriQ',
    'AhriW',
    'AhriE',
    'AhriR',
  ]);
  for (const [index, entry] of declarations.spells.entries()) {
    const raw = records[entry.record].mSpell;
    expect(entry.declaration).toEqual(raw);
    expect(entry.maxRanks).toBe(external.spells[index].maxrank);
    expect(entry.maxRanks).toBe(raw.mClientData.mTooltipData.mLists.LevelUp.levelCount);
    expect(entry.cooldownSecondsByRank).toEqual(external.spells[index].cooldown);
    expect(entry.manaByRank).toEqual(external.spells[index].cost);
    expect(entry.displayRangeByRank).toEqual(external.spells[index].range);
    expect(entry.dataValues).toHaveLength(raw.DataValues.length);
    for (const [valueIndex, value] of entry.dataValues.entries()) {
      expect(value.name).toBe(raw.DataValues[valueIndex].name);
      expect(value.raw).toEqual(raw.DataValues[valueIndex].values);
      expect(value.rankValues).toEqual(value.raw.slice(1, entry.maxRanks + 1));
    }
  }
});

test('all ten missile spells retain legacy arrays and every explicit specification field', () => {
  const missiles = Object.fromEntries(
    Object.entries(records)
      .filter(([, value]: [string, any]) => value.mSpell?.mMissileSpec)
      .map(([key, value]: [string, any]) => [key, value.mSpell])
  );
  expect(Object.keys(missiles)).toHaveLength(10);
  expect(declarations.missiles).toEqual(missiles);
});

test('Q keeps root damage separate from both accelerating legs and their differing legacy damage fields', () => {
  const q = spell('AhriQ');
  expect(q.declaration.missileSpeed).toBe(1100);
  expect(named('AhriQ', 'BaseDamage')).toEqual([35, 60, 85, 110, 135]);
  expect(q.declaration.mSpellCalculations.TotalDamage.mFormulaParts[1].mCoefficient).toBe(0.5);
  const outgoing = missile('AhriQ', 'AhriQMissile');
  const returning = missile('AhriQ', 'AhriQReturnMissile');
  expect(outgoing.mCoefficient).toBe(0.4000000059604645);
  expect(returning.mCoefficient).toBe(0.6000000238418579);
  expect(outgoing.mEffectAmount[0].value).toEqual([20, 50, 80, 110, 140, 170, 200]);
  expect(returning.mEffectAmount[0].value).toEqual([35, 55, 75, 95, 115, 135, 155]);
  expect(outgoing.mMissileSpec.movementComponent).toMatchObject({
    __type: 'AcceleratingMovement',
    mAcceleration: -3200,
    mMinSpeed: 400,
    mMaxSpeed: 2500,
    mInitialSpeed: 2500,
    mTracksTarget: false,
  });
  expect(returning.mMissileSpec.movementComponent).toMatchObject({
    __type: 'AcceleratingMovement',
    mAcceleration: 1900,
    mMinSpeed: 60,
    mMaxSpeed: 2600,
    mInitialSpeed: 60,
    mVisualsTrackHiddenTargets: true,
    mProjectTargetToCastRange: true,
  });
  for (const leg of [outgoing, returning]) {
    expect(leg.mMissileSpec.mMissileWidth).toBe(100);
    expect(leg.mMissileSpec.behaviors.map((behavior: any) => behavior.__type)).toEqual([
      'CastOnHit',
      'DestroyOnMovementComplete',
    ]);
  }
  expect(missile('AhriE', 'AhriEMissile').mMissileSpec.behaviors).toContainEqual({
    __type: 'DestroyOnHit',
  });
});

test('W lifetimes, E display ranges and R counts retain their separate declarations and mode override', () => {
  expect(named('AhriW', 'FlameDuration')).toEqual([2.5, 2.5, 2.5, 2.5, 2.5]);
  expect(missile('AhriW', 'AhriWMissile').mMissileSpec.movementComponent.mLifetime).toBe(5);
  expect(spell('AhriE').displayRangeByRank).toEqual([975, 975, 975, 975, 975]);
  expect(missile('AhriE', 'AhriEMissile').castRangeDisplayOverride[0]).toBe(1175);
  expect(spell('AhriR').displayRangeByRank).toEqual([450, 450, 450]);
  expect(named('AhriR', 'RDashDistance')).toEqual([500, 500, 500]);
  expect(named('AhriR', 'RMaxCasts')).toEqual([3, 3, 3]);
  expect(named('AhriR', 'RResetCasts')).toEqual([1, 1, 1]);
  expect(spell('AhriR').declaration.DataValuesModeOverride.cherry.SpellDataValues[0]).toEqual({
    name: 'RResetCasts',
    values: [2, 2, 2, 2, 2, 2, 2],
    __type: 'SpellDataValue',
  });
  expect(spell('AhriR').calculationLinks).toContainEqual(
    expect.objectContaining({ spelling: 'rAPCoefficient', dataValue: 'RAPCoefficient' })
  );
});

test('passive expressions retain interpolation endpoints without claiming triggers or runtime integration', () => {
  const passiveRecords = Object.fromEntries(
    Object.entries(records).filter(([key]) =>
      key.startsWith('Characters/Ahri/Spells/AhriPassiveAbility')
    )
  );
  expect(declarations.passive).toEqual(passiveRecords);
  const passive =
    declarations.passive['Characters/Ahri/Spells/AhriPassiveAbility/AhriPassive'].mSpell;
  expect(passive.mSpellCalculations.ChampionHeal.mFormulaParts[0]).toEqual({
    mStartValue: 75,
    mEndValue: 165,
    __type: 'ByCharLevelInterpolationCalculationPart',
  });
  expect(passive.mSpellCalculations.MinionHeal.mFormulaParts[0]).toEqual({
    mStartValue: 35,
    mEndValue: 95,
    __type: 'ByCharLevelInterpolationCalculationPart',
  });
  expect(declarations.acceptance).toEqual({
    playable: false,
    productionRosterExpanded: false,
    nativeBehaviorVerified: false,
    runtimePolicyGenerated: false,
  });
});
