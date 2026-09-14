import { describe, expect, it } from 'vitest';
import { luxIlluminationTriggerBirths } from '../src/render/lux-illumination-trigger-births';
import { luxIlluminationTriggerAppearance as appearance } from '../src/render/lux-illumination-trigger-appearance';
import { particleAtlasUv } from '../src/render/particle-atlas';

const births = luxIlluminationTriggerBirths(123, 1 / 60);
function at(name: string, phase: number) {
  const birth = births.find((p) => p.name === name)!;
  return appearance({ ...birth, age: birth.life * phase })!;
}
describe('Illumination trigger lifetime appearance', () => {
  it('samples ring growth, alpha and rotation with uniform scaling after the curve', () => {
    const initial = at('innerring', 0),
      peak = at('innerring', 0.1);
    expect(initial.size[0]).toBeCloseTo(90);
    expect(initial.size.every((v) => v === initial.size[0])).toBe(true);
    expect(initial.color).toEqual([1, 1, 1, 0]);
    expect(peak.size[0]).toBeCloseTo(96);
    expect(peak.color[3]).toBeCloseTo(1);
    expect(at('innerring', 0.35).color[3]).toBeCloseTo(0.14000152);
    expect(at('innerring', 0.8).rotation).toEqual(initial.rotation);
    expect(at('outerring', 0.25).size[0]).toBeCloseTo(170);
  });
  it('uses both lifetime lookup axes on the outer ring and a fixed atlas cell', () => {
    const a = at('outerring', 0.25),
      b = at('outerring', 0.9);
    expect(a.lookup).toEqual([0.625, 0.25]);
    expect(b.lookup).toEqual([0.95, 0.9]);
    expect(a.atlas).toEqual({ columns: 2, rows: 3, frame: 4 });
    expect(b.atlas).toEqual(a.atlas);
    expect(particleAtlasUv(2, 3, 4, 0, 0)).toEqual([0, 2 / 3]);
    expect(particleAtlasUv(2, 3, 4, 1, 1)).toEqual([0.5, 1]);
    expect(at('rays', 0.5).lookup).toEqual([0.5, 1]);
  });
  it('keeps source-channel palette mixers distinct and separates tint from lookup', () => {
    const sparks = at('sparks', 0.2),
      motes = at('motes', 0.75);
    expect(sparks.palette!.row).toBe(0.95);
    expect(motes.palette!.row).toBe(0.65);
    expect(sparks.palette!.mix).toEqual([0, 1, 0, 0]);
    expect(motes.palette!.mix).toEqual([1, 0, 0, 0]);
    expect(sparks.palette!.texture).toBe(motes.palette!.texture);
    expect(sparks.color[1]).toBeCloseTo(0.85097998);
    expect(sparks.color[3]).toBeCloseTo(0.749004);
    expect(motes.color[1]).toBeCloseTo(0.74509799);
    expect(motes.color[3]).toBe(births.find((p) => p.name === 'motes')!.color[3]);
    expect(motes.size.every((v) => v === motes.size[0])).toBe(true);
    expect(at('innerring', 0.3).palette).toBeNull();
  });
  it('samples each ray by its own lifetime and rejects expired particles', () => {
    const ray = births.find((p) => p.name === 'rays')!;
    const a = at('rays', 0),
      b = at('rays', 0.25);
    expect(a.size[0]).toBeCloseTo(ray.size[0] * 2);
    expect(a.size[1]).toBeCloseTo(ray.size[1] * 8);
    expect(b.size[1]).toBeCloseTo(ray.size[1] * 6);
    expect(b.size[2]).toBe(0);
    expect(b.color[3]).toBeCloseTo(0.8);
    for (const age of [-1, NaN, Infinity, ray.life]) expect(appearance({ ...ray, age })).toBeNull();
    const again = at('sparks', 0.2);
    again.palette!.mix[0] = 99;
    again.size[0] = 99;
    expect(at('sparks', 0.2).palette!.mix).toEqual([0, 1, 0, 0]);
    expect(at('sparks', 0.2).size[0]).not.toBe(99);
  });
});
