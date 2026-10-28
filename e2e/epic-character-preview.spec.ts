import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page, name: string) {
  await expect
    .poll(
      () =>
        page.evaluate((name) => {
          const q = (window as any).__JUNGLE_CHARACTERS__;
          return (
            !!q?.ready && (document.querySelector('#character') as HTMLSelectElement).value === name
          );
        }, name),
      { timeout: 20000 }
    )
    .toBe(true);
}
async function choose(page: Page, name: string) {
  await page.selectOption('#character', name);
  await ready(page, name);
}
async function pose(page: Page, name: string) {
  return page.evaluate((name) => {
    const e = (window as any).__JUNGLE_CHARACTERS__.entries.get(name);
    const values: number[] = [];
    e.root.traverse((o: any) => {
      if (o.isBone)
        values.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray());
    });
    return values;
  }, name);
}
async function scrub(page: Page, time: number) {
  await page.locator('#time').evaluate((input: HTMLInputElement, time) => {
    input.value = String(time);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, time);
}
test('epic base rigs retain bound clips, source records, hidden meshes and real scrubbed poses', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/jungle-characters.html?character=SRU_Baron');
  await ready(page, 'SRU_Baron');
  const rows = [];
  for (const [name, count] of [
    ['SRU_Baron', 85],
    ['SRU_RiftHerald', 27],
    ['SRU_Horde', 28],
  ] as const) {
    if (name !== 'SRU_Baron') await choose(page, name);
    await expect(page.locator('#clip option')).toHaveCount(count);
    const data = await page.evaluate((name) => {
      const e = (window as any).__JUNGLE_CHARACTERS__.entries.get(name);
      const clip = e.clips.find((c: any) =>
        c.tracks.some((t: any) => {
          const stride = t.getValueSize();
          return Array.from(t.values).some(
            (v: any, i: number) => i >= stride && Math.abs(v - t.values[i % stride]) > 1e-4
          );
        })
      );
      const hidden: any[] = [];
      e.root.traverse((o: any) => {
        if (o.isMesh) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms)
            if (m.userData.defaultHidden)
              hidden.push({ name: m.userData.sourceSubmesh, visible: o.visible });
        }
      });
      return {
        name,
        clip: { name: clip.name, duration: clip.duration },
        hidden,
        status: document.querySelector('#status')!.textContent,
      };
    }, name);
    await page.selectOption('#clip', data.clip.name);
    await scrub(page, 0);
    const before = await pose(page, name);
    await scrub(page, data.clip.duration * 0.37);
    await page.locator('#frame').click();
    const after = await pose(page, name);
    expect(before.length).toBeGreaterThan(0);
    expect(after.some((v, i) => Math.abs(v - before[i]) > 1e-5)).toBe(true);
    expect(data.hidden.every((h) => !h.visible)).toBe(true);
    if (name === 'SRU_Horde') {
      await expect(page.locator('#binding-audit')).toBeVisible();
      expect(await page.locator('#binding-audit pre').textContent()).toContain(
        'sru_horde_dormant.anm'
      );
      expect(data.status).toContain('28 bound clips / 32 source entries');
    } else await expect(page.locator('#binding-audit')).toBeHidden();
    await page.screenshot({ path: info.outputPath(name + '.png') });
    rows.push({ ...data, before, after });
  }
  await choose(page, 'SRU_Baron');
  await expect(
    page.locator('#values tr').filter({ hasText: 'Experience on death' }).locator('td').nth(1)
  ).toHaveText('0');
  await choose(page, 'SRU_RiftHerald');
  const alternate = await page
    .locator('#record option')
    .evaluateAll((options) =>
      options.find((o) => o.textContent !== 'Root')!.getAttribute('value')!
    );
  await page.selectOption('#record', alternate);
  await expect(
    page.locator('#values tr').filter({ hasText: 'Gold on death' }).locator('td').nth(1)
  ).toHaveText('Absent');
  await expect(
    page.locator('#values tr').filter({ hasText: 'Experience on death' }).locator('td').nth(1)
  ).toHaveText('600');
  await choose(page, 'SRU_Dragon_Fire');
  await expect(page.locator('#status')).toContainText('character definitions only');
  expect(
    await page.evaluate(() =>
      Array.from((window as any).__JUNGLE_CHARACTERS__.entries.values()).some(
        (e: any) => e.root.visible
      )
    )
  ).toBe(false);
  await choose(page, 'SRU_Blue');
  await expect(page.locator('#clip option')).toHaveCount(16);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('epic-preview.json'), JSON.stringify({ rows, errors }, null, 2));
});
test('a missing cached epic model can retry its real request', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/sru-horde-base.glb', (r) => r.abort('failed'));
  await page.goto('/tools/qa/jungle-characters.html?character=SRU_Horde');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#status')).toContainText('could not load');
  await page.unroute('**/sru-horde-base.glb');
  await page.locator('#retry').click();
  await ready(page, 'SRU_Horde');
  await expect(page.locator('#clip option')).toHaveCount(28);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('epic-retry.json'),
    JSON.stringify({ retried: true, errors }, null, 2)
  );
});
test('a late epic model response stays hidden after another selection becomes active', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/sru-riftherald-base.glb', async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto('/tools/qa/jungle-characters.html?character=SRU_Baron');
  await ready(page, 'SRU_Baron');
  await page.selectOption('#character', 'SRU_RiftHerald');
  await expect(page.locator('#status')).toContainText('Loading');
  await choose(page, 'SRU_Horde');
  release();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).__JUNGLE_CHARACTERS__.entries.has('SRU_RiftHerald')),
      { timeout: 20000 }
    )
    .toBe(true);
  const visibility = await page.evaluate(() =>
    Array.from((window as any).__JUNGLE_CHARACTERS__.entries.entries()).map(([name, e]: any) => ({
      name,
      visible: e.root.visible,
    }))
  );
  expect(visibility.filter((e) => e.visible).map((e) => e.name)).toEqual(['SRU_Horde']);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('epic-late-response.json'),
    JSON.stringify({ visibility, errors }, null, 2)
  );
});
