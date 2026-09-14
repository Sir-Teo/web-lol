import { expect, test } from '@playwright/test';
import source from '../docs/reference/lux-attack-impact.json' with { type: 'json' };

test('static atlas cells preserve source row order and RGBA through the particle shader', async ({
  page,
}) => {
  for (const record of Object.values(source.records)) {
    const outer = record.complexEmitterDefinitionData.find(
      (e) => !('{33f36f05}' in e && e['{33f36f05}']) && e.texture.endsWith('/GlobalTargetHit01.tex')
    )!;
    expect(outer.texDiv).toEqual([2, 3]);
    expect(outer.numFrames).toBe(6);
    expect(outer['{76f8ad24}']).toBe(4);
  }
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-impact-source.html');
  await page.waitForFunction(() => (window as any).__LUX_IMPACT_ATLAS__?.ready);
  // A deliberately asymmetric 2 × 3 atlas, with distinct per-pixel RGBA including
  // zero-alpha nonzero RGB. CPU reference crops rows directly, without UV math.
  const width = 8,
    height = 12;
  const data = Array.from(
    { length: width * height * 4 },
    (_, i) => (i * 37 + Math.floor(i / 4) * 19) % 256
  );
  data[3] = 0;
  for (let frame = 0; frame < 6; frame++) {
    const actual = await page.evaluate(
      ({ data, width, height, frame }) =>
        (window as any).__LUX_IMPACT_ATLAS__.probe(data, width, height, frame),
      { data, width, height, frame }
    );
    const expected: number[] = [];
    for (let row = 3; row >= 0; row--) {
      const start = ((Math.floor(frame / 2) * 4 + row) * width + (frame % 2) * 4) * 4;
      expected.push(...data.slice(start, start + 16));
    }
    expect(actual, `frame ${frame}, bottom-up WebGL readback`).toEqual(expected);
  }
  await page.getByLabel('Atlas frame').selectOption('4');
  await expect(page.locator('#atlas-status')).toContainText('Frame 4 · column 0, row 2');
  await page.locator('#atlas-cell').screenshot({ path: 'artifacts/lux-impact-atlas-frame4.png' });
  expect(errors).toEqual([]);
});
