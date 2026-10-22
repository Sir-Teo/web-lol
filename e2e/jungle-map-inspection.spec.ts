import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pin = JSON.parse(readFileSync('docs/reference/jungle-map-source.json', 'utf8'));

test('jungle sources load on demand, overlay actual client anchors and keep templates separate through toggles and resizing', async ({
  page,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  expect(requests.some((url) => url.includes('jungle-map-inspection'))).toBe(false);
  const button = page.getByRole('button', { name: 'Jungle sources' });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByRole('region', { name: 'Jungle source inspection' });
  await expect(panel).toBeVisible();
  await expect(page.locator('#jungle-camp option')).toHaveCount(18);
  const source = pin.records.campEntities.find(
    (c: any) =>
      pin.records.identifiers[c.record.NeutralCamp.CampIdentifier].CampName === 'Order Blue'
  );
  await page.locator('#jungle-camp').selectOption(source.key);
  await page.getByRole('button', { name: 'Show selected anchor' }).click();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveCount(0);
  const before = await page.evaluate(() => {
    const m = (window as any).__MAP__,
      j = m.jungle;
    m.scene.updateMatrixWorld(true);
    return {
      camps: j.groups.camps.children.map((mesh: any) => ({
        key: mesh.userData.key,
        position: mesh.position.toArray(),
        geometry: mesh.geometry.uuid,
        material: mesh.material.uuid,
      })),
      characters: j.groups.characters.children.length,
      recommendations: j.groups.recommendations.children.length,
      hidden: [j.groups.characters.visible, j.groups.recommendations.visible],
      target: m.camera.position.toArray(),
    };
  });
  expect(before.camps).toHaveLength(18);
  expect(before.characters).toBe(53);
  expect(before.recommendations).toBe(16);
  expect(before.hidden).toEqual([false, false]);
  // Independent raw-BIN oracle; no catalog point helper is used here.
  for (const actual of before.camps) {
    const p = pin.records.campEntities.find((c: any) => c.key === actual.key).record.transform[3];
    expect(actual.position).toEqual([(p[0] - 7425) * 0.01, p[1] * 0.01, (7425 - p[2]) * 0.01]);
  }
  const detail = JSON.parse(await page.locator('#jungle-details').innerText());
  expect(detail.anchor.position).toEqual(source.record.transform[3].slice(0, 3));
  expect(detail.recommendation.position).toEqual([3700, 0, 8000]);
  await page.locator('#jungle-characters').check();
  await page.locator('#jungle-recommendations').check();
  await page.screenshot({ path: 'artifacts/jungle-map-blue-source.png' });
  await button.click();
  await expect(panel).toBeHidden();
  await button.click();
  await expect(panel).toBeVisible();
  const after = await page.evaluate(() => {
    const j = (window as any).__MAP__.jungle;
    return {
      camps: j.groups.camps.children.map((mesh: any) => ({
        key: mesh.userData.key,
        position: mesh.position.toArray(),
        geometry: mesh.geometry.uuid,
        material: mesh.material.uuid,
      })),
      visible: [j.groups.characters.visible, j.groups.recommendations.visible],
    };
  });
  expect(after.camps).toEqual(before.camps);
  expect(after.visible).toEqual([true, true]);
  await page.setViewportSize({ width: 960, height: 720 });
  const bounds = await panel.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
  await expect(page.locator('.jungle-source-label')).toHaveText('Order Blue');
  await page.screenshot({ path: 'artifacts/jungle-map-source-small.png' });
  expect(errors).toEqual([]);
});

test('a failed source-module request offers a reload that clears Chrome module failure state', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/src/dev/jungle-map-inspection.ts*', (route) => {
    attempts++;
    return attempts === 1 ? route.abort('failed') : route.continue();
  });
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  const button = page.getByRole('button', { name: 'Jungle sources' });
  await button.click();
  await expect(page.locator('#status')).toContainText('Jungle inspection could not load.');
  const reload = page.getByRole('button', { name: 'Reload map to retry' });
  await expect(reload).toBeEnabled();
  await expect(reload).toHaveAttribute('aria-pressed', 'false');
  await Promise.all([page.waitForEvent('load'), reload.click()]);
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  await page.getByRole('button', { name: 'Jungle sources' }).click();
  await expect(page.getByRole('region', { name: 'Jungle source inspection' })).toBeVisible();
  await expect(page.locator('#status')).toBeHidden();
  expect(attempts).toBe(2);
});
