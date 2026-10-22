import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
const path = 'docs/reference/jungle-companions-source.json';
const pin = JSON.parse(readFileSync(path, 'utf8'));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest = (i: number) =>
  JSON.parse(readFileSync(`public/assets/models/sru-jungle-companions-skin${i}-base.json`, 'utf8'));
const skins = (i: number) =>
  pin.records[`data/characters/sru_jungle_companions/skins/skin${i}.bin`][
    `Characters/SRU_Jungle_Companions/Skins/Skin${i}`
  ].skinMeshProperties;
const values = (record: any) =>
  Object.fromEntries(record.mDataValues.map((v: any) => [v.mName, v.mValue]));

test('three companion rigs retain original archive and parent provenance', () => {
  for (const p of Object.values(pin.parents) as any[]) expect(sha(p.path)).toBe(p.sha256);
  expect(pin.extraction.files).toHaveLength(70);
  expect(pin.scriptExtraction.files).toHaveLength(12);
  expect(pin.extraction.files.reduce((n: number, f: any) => n + f.bytes, 0)).toBe(4162971);
  for (let i = 0; i < 3; i++) {
    const m = manifest(i);
    expect(m.definitionsSha256).toBe(sha(path));
    expect(sha('public' + m.output.path)).toBe(m.output.sha256);
    expect(m.sourceSkinIndex).toBe(i);
    expect(m.sourceArchive).toBe(pin.extraction.archive);
    expect(m.bones).toBe([57, 60, 67][i]);
    expect(m.triangles).toBe([10699, 12024, 8042][i]);
  }
});
test('all 84 atomic graph states survive conversion including shared animation resources', () => {
  const sources = new Set(pin.extraction.files.map((f: any) => f.path));
  for (let i = 0; i < 3; i++) {
    const model = pin.models[`SRU_Jungle_Companions/Skin${i}`],
      m = manifest(i),
      paths = Object.values(model.atomicClips) as string[];
    expect(m.clips).toHaveLength([28, 26, 30][i]);
    expect(m.clips.length).toBe(paths.length);
    expect(new Set(paths).size).toBeLessThan(paths.length);
    for (const [state, p] of Object.entries(model.atomicClips)) {
      expect(sources.has(p)).toBe(true);
      expect(m.clips.find((c: any) => c.state === state).source).toBe(p);
    }
  }
});
test('Adult/Baby geometry and distinct source diffuse assignments remain separate with authored scale policy', () => {
  for (let i = 0; i < 3; i++) {
    const m = manifest(i),
      s = skins(i);
    expect(m.initialSubmeshesToHide).toEqual(['Baby']);
    expect(Object.keys(m.materialTextures).sort()).toEqual(['Adult', 'Baby']);
    expect(m.materialTextures.Adult).not.toBe(m.materialTextures.Baby);
    expect(m.unitScale).toBe(0.01 * (s.skinScale ?? 1));
    const b = readFileSync('public' + m.output.path),
      g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    expect(g.materials.map((x: any) => x.extras.sourceSubmesh).sort()).toEqual(['Adult', 'Baby']);
    expect(
      g.materials.find((x: any) => x.extras.sourceSubmesh === 'Baby').extras.defaultHidden
    ).toBe(true);
  }
  expect(skins(0).skinScale).toBeUndefined();
  expect(skins(1).skinScale).toBeUndefined();
  expect(skins(2).skinScale).toBeCloseTo(0.8);
});
test('companion items preserve Smite requirements, zero sale value, groups and counter discrepancy', () => {
  for (const code of ['1101', '1102', '1103']) {
    const r = pin.itemSource.records['Items/' + code],
      dd = pin.dataDragon.items[code],
      v = values(r);
    expect(r.mRequiredSpellName).toBe('SummonerSmite');
    expect(r.price).toBe(450);
    expect(dd.gold.sell).toBe(0);
    expect(r.sellBackModifier).toBe(0);
    expect(r.mItemGroups).toContain('Items/ItemGroups/DoransItems');
    expect(r.mItemGroups).toContain('Items/ItemGroups/GoldItems');
    expect(v.TotalCounters).toBe(35);
    expect(v.Breakpoint1).toBe(20);
    expect(pin.strings.entries[`item_${code}_tooltipextended`]).toContain('@Breakpoint1@ Treats');
    expect(r.DataValuesModeOverride.SWIFTPLAY.DataValues).not.toEqual(r.mDataValues);
  }
  expect(pin.itemSource.records['Items/ItemGroups/DoransItems'].mMaxGroupOwnable).toBe(1);
  expect(pin.published.firstEvolutionKills).toBe(15);
  expect(pin.published.fullQuestCounters).toBe(35);
});
test('Puppy controller values and absent reward entries are preserved rather than silently filled', () => {
  const r = pin.records['data/characters/sru_jungle_companions/sru_jungle_companions.bin'];
  const spell = (Object.values(r) as any[]).find(
    (x) => x?.mScriptName === 'PuppyControllerBuff'
  ).mSpell;
  const data = Object.fromEntries(spell.DataValues.map((x: any) => [x.name, x.values?.[0]]));
  expect(data.TreatTimer).toBe(60);
  expect(data.LongTreatTimer).toBe(90);
  expect(data.TreatGold).toBe(20);
  expect(data.TreatXP).toBe(80);
  expect(data.FirstMonsterBonusXP).toBe(150);
  expect(data.DamageAmp).toBeCloseTo(1.1);
  expect(data.MonsterDamageTaken).toBe(0.5);
  expect(data.LargeMonsterBonusGold).toBeUndefined();
  expect(data.LargeMonsterBonusXP).toBeUndefined();
  const heal = pin.shared.records['Shared/Spells/Monster_Heal_Mis'].mSpell;
  expect(heal.DataValues.find((x: any) => x.name === 'BaseHealCap').values[0]).toBe(250);
});
test('all twelve selected original scripts are metadata or RETURN stubs without active callbacks', () => {
  let total = 0;
  for (const [path, script] of Object.entries(pin.scriptInventory) as [string, any][]) {
    expect(Object.keys(script)).toEqual(['<main>']);
    const f = script['<main>'];
    expect(f.children).toBe(0);
    total += f.instructions.length;
    expect(
      f.instructions.every((x: any) =>
        [
          'LOADK',
          'LOADBOOL',
          'SETGLOBAL',
          'RETURN',
          ...(path.endsWith('monster_heal_mis.luabin64') ? ['NEWTABLE', 'SETLIST'] : []),
        ].includes(x.op)
      )
    ).toBe(true);
    if (path.endsWith('monster_heal_mis.luabin64')) {
      expect(f.instructions.slice(6, 10).map((x: any) => x.op)).toEqual([
        'NEWTABLE',
        'LOADK',
        'SETLIST',
        'SETGLOBAL',
      ]);
      expect(f.instructions[7].operands[1]).toEqual({ constant: 'PantheonSkin06' });
      expect(f.instructions[9].operands[1]).toEqual({ constant: 'SpellFXOverrideSkins' });
    }
  }
  expect(total).toBe(84);
});
