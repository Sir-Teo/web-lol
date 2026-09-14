import { expect, test } from '@playwright/test';
import audit from '../docs/reference/lux-attack-impact-audit.json' with { type: 'json' };

test('native palette operation preserves source alpha and applies scroll after saturation before tint', async ({
  page,
}) => {
  for (const emitters of Object.values(audit.variants)) {
    const fields = emitters.find((e) => e.name === 'sparks')!.paletteFields!;
    expect(fields.palleteSrcMixColor.constantValue).toEqual([0, 1, 0, 0]);
    expect(fields.paletteSelector.constantValue).toEqual([9, 0, 0]);
    expect(fields.paletteCount).toBe(10);
  }
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/particle-palette.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_PALETTE__?.ready);
  const palette = Array.from({ length: 8 * 4 * 4 }, (_, i) => (i * 47 + 31) % 256);
  const cases = [
    { source: [60, 145, 225, 83], mix: [0, 1, 0, 0], row: 0.625, scroll: [0, 0] },
    { source: [60, 145, 225, 0], mix: [0, 1, 0, 0], row: 0.625, scroll: [0, 0] },
    { source: [60, 145, 225, 83], mix: [-4, 0, 0, 0], row: 0.125, scroll: [0.3, 0.5] },
    { source: [60, 145, 225, 83], mix: [0, 0, 4, 0], row: 0.875, scroll: [-0.3, -0.5] },
    { source: [60, 145, 225, 83], mix: [0, 0, 0, 1], row: 0.125, scroll: [0, 0] },
    { source: [60, 145, 225, 83], mix: [0.2, 0.3, 0.4, 0.1], row: 0.625, scroll: [0, 0] },
  ];
  for (const c of cases)
    for (const multiplier of [undefined, [150, 90, 220, 180]]) {
      const p = {
        ...c,
        palette,
        width: 8,
        height: 4,
        lookup: [170, 210, 120, 190],
        tint: [0.3, 0.7, 0.6, 0.4],
        multiplier,
      };
      const actual = await page.evaluate((p) => (window as any).__PARTICLE_PALETTE__.probe(p), p);
      const dot = c.source.reduce((sum, value, i) => sum + (value / 255) * c.mix[i], 0);
      const x = Math.min(
        7,
        Math.max(0, Math.floor((Math.min(1, Math.max(0, dot)) + c.scroll[0]) * 8))
      );
      const y = Math.min(3, Math.max(0, Math.floor((c.row + c.scroll[1]) * 4)));
      const rgba = [...palette.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 3), c.source[3]];
      const expected = rgba.map((v, i) =>
        Math.round((((v * p.lookup[i]) / 255) * p.tint[i] * (multiplier?.[i] ?? 255)) / 255)
      );
      actual.forEach((v: number, i: number) =>
        expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1)
      );
    }
  await expect(page.locator('#status')).toContainText('9 / 9 · V=0.95');
  await page.screenshot({ path: 'artifacts/lux-spark-palette.png', fullPage: true });
  await page.locator('#row').fill('0');
  await expect(page.locator('#status')).toContainText('0 / 9 · V=0.05');
  expect(errors).toEqual([]);
});
