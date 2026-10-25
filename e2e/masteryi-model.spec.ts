import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

test('Master Yi development rig renders all atomic clips and keeps captured silhouettes inside the frame', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('requestfailed', (request) => errors.push(request.url()));
  const loaded = page.waitForResponse((response) => response.url().endsWith('/masteryi-base.glb'));
  await page.goto('/tools/qa/masteryi-model.html');
  await page.waitForFunction(() => (window as any).ready === true);
  const response = await loaded;
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  expect(bytes.length).toBe(6487088);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '7aae9e8e486c34d780113349c4a4d06830a5498a906ff291a49263090da471cc'
  );
  const clips: { name: string; duration: number }[] = await page.evaluate(
    () => (window as any).review.clips
  );
  expect(clips).toHaveLength(47);
  const poses = [];
  for (const clip of clips)
    for (const fraction of [0, 0.37, 1]) {
      const state = await page.evaluate(
        ({ name, time }) => (window as any).review.choose(name, time),
        { name: clip.name, time: clip.duration * fraction }
      );
      expect(state.bones).toBe(90);
      expect(state.finite).toBe(true);
      expect(state.calls).toBeGreaterThan(0);
      expect(state.triangles).toBe(9144);
      expect(
        state.projectedCorners.every(
          (v: number[]) => Math.abs(v[0]) < 0.9 && Math.abs(v[1]) < 0.9 && v[2] > -1 && v[2] < 1
        )
      ).toBe(true);
      poses.push(state);
    }
  await page.locator('#time').press('Home');
  await page.locator('#time').press('ArrowRight');
  expect((await page.evaluate(() => (window as any).review.state())).time).toBeGreaterThan(0);
  const captures = [];
  for (const name of [
    'entry_56f6d84b',
    'run',
    'spell1',
    'spell2_in',
    'spell2_loop',
    'spell3',
    'death',
    'recall_in',
  ]) {
    await page.locator('#clip').selectOption(name);
    const clip = clips.find((c) => c.name === name)!;
    await page.locator('#time').evaluate((element, value) => {
      (element as HTMLInputElement).value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, clip.duration * 0.37);
    const state = await page.evaluate(() => (window as any).review.state());
    expect(state.clip).toBe(name);
    expect(state.time).toBeCloseTo(clip.duration * 0.37, 3);
    const silhouette = await page.evaluate(() => (window as any).review.silhouette());
    expect(silhouette.count).toBeGreaterThan(100);
    expect(silhouette.minX).toBeGreaterThan(20);
    expect(silhouette.minY).toBeGreaterThan(20);
    expect(silhouette.maxX).toBeLessThan(silhouette.width - 20);
    expect(silhouette.maxY).toBeLessThan(silhouette.height - 20);
    captures.push({ name, state, silhouette });
    await page.screenshot({ path: info.outputPath(`masteryi-${name}.png`) });
  }
  for (const angle of ['1', '2', '3']) {
    await page.locator('#angle').selectOption(angle);
    await page.evaluate(() => (window as any).review.silhouette());
    await page.screenshot({ path: info.outputPath(`masteryi-view-${angle}.png`) });
  }
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('masteryi-model.json'),
    JSON.stringify({ clips: 47, poses, captures, errors, nativeEquivalent: false }, null, 2) + '\n'
  );
});
