import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import profile from '../src/content/rift-gromp-camps.json';

const raw = readFileSync('docs/reference/jungle-script-source.json');
const pin = JSON.parse(raw.toString());

test('Lua 5.1 reader handles independent synthetic chunks and rejects malformed carriers', () => {
  expect(() =>
    execFileSync('python3', ['tools/assets/test-lua51.py'], { stdio: 'pipe' })
  ).not.toThrow();
});

test('Gromp calendar keeps published baseline and provisional respawn separate from legacy evidence', () => {
  expect(profile.sourcePinSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(pin.extraction.archive).toBe('DATA/FINAL/Scripts.wad.client');
  expect(pin.extraction.referenceVersion).toBe('16.18.8175716');
  expect(pin.extraction.files).toHaveLength(9);
  expect(pin.mapSourcePinSha256).toBe(
    createHash('sha256').update(readFileSync(pin.mapSourcePin)).digest('hex')
  );
  expect(profile.firstSpawnSeconds).toBe(67);
  expect(profile.respawnSeconds).toBe(135);
  expect(pin.camps.map((c: any) => c.legacyFirstSpawnSeconds)).toEqual([99, 99]);
  expect(pin.camps.map((c: any) => c.legacyRespawnSeconds)).toEqual([135, 135]);
  const guard = pin.evidence.nativeBridgeGuard.instructions;
  expect(guard.find((i: any) => i.pc === 1384).operands[1]).toEqual({
    constant: 'RawLSDeprecationNeutralMinions',
  });
  expect(guard.find((i: any) => i.pc === 1387).operands[1]).toEqual({ targetPc: 1416 });
});

test('both camps use script-linked locators rather than placed characters or camp anchors', () => {
  for (const [index, camp] of profile.camps.entries()) {
    const source = pin.camps[index],
      position = source.locator.transform[3];
    expect(camp.sourceIndex).toBe(source.index);
    expect(source.group).toEqual([{ character: 'SRU_Gromp', animation: 'spawn' }]);
    expect(camp.point).toEqual({ x: position[0] - 7425, y: 7425 - position[2] });
    expect(camp.anchorEntity).toBe(source.anchorEntity);
    expect(source.lookup.toLowerCase()).toBe(source.locator.name.toLowerCase());
  }
  expect(profile.camps[1].point).toEqual({ x: 5278.62890625, y: 981.01611328125 });
  const characters = JSON.parse(readFileSync('docs/reference/jungle-map-source.json', 'utf8'))
    .records.neutralCharacterEntities;
  expect(
    characters.some(
      (v: any) =>
        v.record.transform[3][0] - 7425 === profile.camps[1].point.x &&
        7425 - v.record.transform[3][2] === profile.camps[1].point.y
    )
  ).toBe(false);
});
