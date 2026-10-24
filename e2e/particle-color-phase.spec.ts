import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('early capture includes actor pixels, excludes registered particle color and retires separate copies through recovery', async ({
  page,
}, info) => {
  await page.goto('/tools/qa/particle-color-phase-preview.html');
  await page.waitForFunction(() => !!(window as any).__PARTICLE_PHASE__);
  const before = await page.evaluate(() => (window as any).__PARTICLE_PHASE__.probe());
  expect(before.early).toEqual([
    [0, 0, 255, 255],
    [255, 0, 0, 255],
  ]);
  expect(before.late).toEqual([
    [255, 0, 0, 255],
    [255, 0, 0, 255],
  ]);
  expect(before.same).toBe(true);
  expect(before.error).toBe(0);
  expect(before.copies).toEqual({ early: true, late: true });
  expect(before.retired).toEqual({ early: true, late: true });
  expect(before.state).toEqual({
    clear: true,
    shadows: true,
    reset: true,
    visible: [true, true, true],
    background: true,
  });
  const recovered = await page.evaluate(() => (window as any).__PARTICLE_PHASE__.recover());
  expect(recovered).toEqual(before);
  writeFileSync(
    info.outputPath('phase-order.json'),
    JSON.stringify({ before, recovered }, null, 2)
  );
});
