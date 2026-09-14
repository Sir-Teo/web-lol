import { expect, test } from '@playwright/test';
test('Garen and Ahri load every source clip with valid poses and authored hidden submeshes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/roster-models.html');
  await page.waitForFunction(() => (window as any).__ROSTER_MODELS__?.ready);
  for (const [name, count] of [
    ['Garen', 36],
    ['Ahri', 55],
  ] as const) {
    const result = await page.evaluate((name) => {
      const api = (window as any).__ROSTER_MODELS__;
      api.choose(name);
      const entry = api.entries.get(name),
        hidden: string[] = [],
        textures = new Set();
      let valid = true,
        changed = 0;
      entry.root.traverse((o: any) => {
        if (o.isMesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.map) textures.add(m.map.uuid);
            if (!o.visible) hidden.push(m.userData.sourceSubmesh);
          }
        }
      });
      for (const clip of entry.clips) {
        api.chooseClip(clip.name);
        api.seek(0);
        const first: number[] = [];
        entry.root.traverse((o: any) => {
          if (o.isBone) first.push(...o.matrixWorld.elements);
        });
        api.seek(clip.duration * 0.37);
        const next: number[] = [];
        entry.root.traverse((o: any) => {
          if (o.isBone) next.push(...o.matrixWorld.elements);
        });
        valid &&= next.length > 0 && next.every(Number.isFinite);
        if (next.some((v, i) => Math.abs(v - first[i]) > 1e-6)) changed++;
      }
      api.choose(name);
      api.seek(0.3);
      return { count: entry.clips.length, valid, changed, hidden, textures: textures.size };
    }, name);
    expect(result.count).toBe(count);
    expect(result.valid).toBe(true);
    expect(result.changed).toBeGreaterThan(count * 0.8);
    expect(result.textures).toBe(name === 'Ahri' ? 2 : 1);
    expect(result.hidden).toEqual(name === 'Ahri' ? ['Tail_Large'] : []);
    await page.screenshot({ path: `artifacts/roster-${name.toLowerCase()}.png` });
    await page.locator('#champion').selectOption(name);
    await page.locator('#clip').selectOption(name === 'Garen' ? 'spell3_0' : 'run_fast');
    await page.locator('#play').click();
    await page.waitForFunction(
      () => Number((document.querySelector('#time') as HTMLInputElement).value) > 0.1
    );
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Play');
    await page.screenshot({ path: `artifacts/roster-${name.toLowerCase()}-action.png` });
  }
  expect(errors).toEqual([]);
});
