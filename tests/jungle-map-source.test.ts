import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import catalog from '../src/content/jungle-map-inspection.json';

const raw = readFileSync('docs/reference/jungle-map-source.json');
const pin = JSON.parse(raw.toString());

test('jungle inspection is tied to the frozen map and its standard-mode metadata links', () => {
  expect(catalog.sourcePinSha256).toBe(createHash('sha256').update(raw).digest('hex'));
  expect(pin.extraction.referenceVersion).toBe('16.18.8175716');
  expect(pin.extraction.archive).toBe('DATA/FINAL/Maps/Shipping/Map11.wad.client');
  expect(pin.extraction.files.map((f: any) => f.path)).toEqual([
    'data/maps/shipping/map11/map11.bin',
    'data/maps/mapgeometry/map11/base_srx.materials.bin',
  ]);
  expect(pin.records.modeKey).toBe('Maps/Shipping/Map11/Modes/CLASSIC');
  expect(pin.records.mode.JungleRecommendationMapInformation).toBe(pin.records.locationKey);
  expect(pin.records.mode.DefaultJunglePathRecommendation).toBe(pin.records.routeKey);
});

test('every camp marker preserves its raw anchor and identifier instead of a recommendation or icon offset', () => {
  expect(catalog.camps).toHaveLength(18);
  expect(new Set(catalog.camps.map((c) => c.key)).size).toBe(18);
  for (const camp of catalog.camps) {
    const source = pin.records.campEntities.find((c: any) => c.key === camp.key);
    expect(camp.position).toEqual(source.record.transform[3].slice(0, 3));
    expect(camp.point).toEqual({ x: camp.position[0] - 7425, y: 7425 - camp.position[2] });
    expect(camp.component).toEqual(source.record.NeutralCamp);
    expect(camp.name).toBe(pin.records.identifiers[camp.identifier].CampName);
    expect(camp.identifierDefinition).toEqual(pin.records.identifiers[camp.identifier]);
  }
  const blue = catalog.camps.find((c) => c.name === 'Order Blue')!;
  expect(blue.position).toEqual([3893.85107421875, 28.06399917602539, 7869.8251953125]);
  expect(blue.component.MinimapIconOffset).toEqual([-80, 0, 40]);
  expect(catalog.recommendations.find((r) => r.name === 'Order Blue')!.position).toEqual([
    3700, 0, 8000,
  ]);
});

test('neutral source objects retain pads and off-map templates without inventing a spawn roster', () => {
  expect(catalog.neutralObjects).toHaveLength(53);
  expect(
    catalog.neutralObjects.filter((c) => c.character.includes('FaeLightWardPad'))
  ).toHaveLength(12);
  for (const object of catalog.neutralObjects) {
    const source = pin.records.neutralCharacterEntities.find((c: any) => c.key === object.key);
    expect(source.record.Team.Team).toBe(300);
    expect(object.position).toEqual(source.record.transform[3].slice(0, 3));
    expect(object.character).toBe(source.record.Character.CharacterRecord);
  }
  expect(catalog.neutralObjects.some((c) => c.position[2] < 0)).toBe(true);
  expect(Object.values(pin.records.identifiers).some((c: any) => c.CampName === 'Atakhan')).toBe(
    true
  );
  expect(catalog.camps.some((c) => c.name === 'Atakhan')).toBe(false);
  expect(catalog.camps.some((c) => c.name === 'ElderDragon')).toBe(false);
  const dragon = catalog.camps.find((c) => c.name === 'Dragon')!;
  const types = dragon.identifierDefinition['{7511a599}'];
  expect(types).toBeDefined();
  expect(types!.some((t) => t.TypeName === 'DragonElder')).toBe(true);
});

test('recommendation Index, Location and absent route fields remain distinct source observations', () => {
  expect(catalog.recommendations).toHaveLength(16);
  expect(catalog.recommendations.find((c) => c.name === 'Chaos OwlBear')).toMatchObject({
    index: 14,
    location: 6,
  });
  expect(catalog.recommendations.find((c) => c.name === 'Order Owlbear')).toMatchObject({
    index: 13,
    location: null,
  });
  expect(catalog.routes.OrderJunglePath.at(-2)).toEqual({ kind: 'TakeCamp', camp: null });
  expect(catalog.routes.OrderJunglePath.at(-1)).toEqual({ kind: 'TerminatePath', camp: null });
  expect(catalog.routes.ChaosJunglePath.map((step) => step.camp)).toEqual([
    7,
    6,
    8,
    9,
    10,
    11,
    null,
  ]);
});
