import { expect, test } from '@playwright/test';
test('attachment inspector samples real animated targets and exposes missing structure bones', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-hit-attachments.html');
  await page.waitForFunction(() => (window as any).__LUX_HIT_ATTACHMENTS__?.ready);
  await page.locator('#clip').selectOption('run');
  await page.locator('#phase').fill('0.25');
  const first = await page.evaluate(() => (window as any).__LUX_HIT_ATTACHMENTS__.state());
  expect(first.positions.every((p: any) => p?.length === 3)).toBe(true);
  expect(first.positions[0]).not.toEqual(first.positions[1]);
  await page.locator('#phase').fill('0.65');
  expect(
    (await page.evaluate(() => (window as any).__LUX_HIT_ATTACHMENTS__.state())).positions
  ).not.toEqual(first.positions);
  await page.locator('#phase').fill('0.25');
  expect(await page.evaluate(() => (window as any).__LUX_HIT_ATTACHMENTS__.state())).toEqual(first);
  await page.screenshot({ path: 'artifacts/lux-hit-attachments-ashe.png' });
  for (const name of ['ashe-base', 'lux-base', 'red-melee', 'blue-inhibitor']) {
    await page.locator('#model').selectOption(name);
    await page.waitForFunction(
      (name) => (window as any).__LUX_HIT_ATTACHMENTS__.state().model === name,
      name
    );
    const positions = (await page.evaluate(() => (window as any).__LUX_HIT_ATTACHMENTS__.state()))
      .positions;
    expect(positions.filter((p: any) => p !== null)).toHaveLength(
      name === 'blue-inhibitor' ? 0 : 2
    );
    const result = await page.evaluate(() => {
      const clips = document.querySelector<HTMLSelectElement>('#clip')!,
        phase = document.querySelector<HTMLInputElement>('#phase')!;
      let maxError = 0,
        count = 0;
      for (const option of Array.from(clips.options)) {
        clips.value = option.value;
        clips.dispatchEvent(new Event('change'));
        for (const value of [0.83, 0.1, 1, 0, 0.5]) {
          phase.value = String(value);
          phase.dispatchEvent(new Event('input'));
          const state = (window as any).__LUX_HIT_ATTACHMENTS__.state();
          maxError = Math.max(maxError, ...state.sampleErrors);
          count++;
        }
      }
      return { maxError, count };
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.maxError).toBeLessThan(1e-7);
  }
  expect(errors).toEqual([]);
});
