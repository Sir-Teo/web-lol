import { expect, test } from 'vitest';
import { intersectsSelectionCylinder } from '../src/render/selection-cylinder';

const base = { x: 0, y: 10, z: 0 };
test('selection cylinder includes side and cap intersections at its actual elevation', () => {
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 3, y: 11, z: 0 }, direction: { x: -1, y: 0, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(true);
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 0, y: 20, z: 0 }, direction: { x: 0, y: -1, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(true);
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(true);
});

test('selection rejects rays outside the radius, above the cap or pointing away', () => {
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 1.21, y: 20, z: 0 }, direction: { x: 0, y: -1, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(false);
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 3, y: 11.56, z: 0 }, direction: { x: -1, y: 0, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(false);
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 3, y: 11, z: 0 }, direction: { x: 1, y: 0, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(false);
});

test('oblique rays must cross the radial and vertical intervals at the same time', () => {
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 3, y: 20, z: 0 }, direction: { x: -1, y: -1, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(false);
  expect(
    intersectsSelectionCylinder(
      { origin: { x: 3, y: 13, z: 0 }, direction: { x: -1, y: -1, z: 0 } },
      base,
      1.2,
      1.55
    )
  ).toBe(true);
});
