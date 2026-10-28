import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pin = JSON.parse(readFileSync('docs/reference/jungle-character-source.json', 'utf8'));
const epic = JSON.parse(readFileSync('docs/reference/epic-character-source.json', 'utf8'));

test('jungle review loads rigs on demand, scrubs every source pose and distinguishes absent fields and variants', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/tools/qa/jungle-characters.html');
  await page.waitForFunction(() => (window as any).__JUNGLE_CHARACTERS__?.ready);
  await expect(page.locator('#character option')).toHaveCount(14 + epic.characters.length);
  expect(
    await page
      .locator('#character option')
      .evaluateAll((options) =>
        options.slice(14).map((option) => (option as HTMLOptionElement).value)
      )
  ).toEqual(epic.characters);
  await page.getByText('Complete selected record', { exact: true }).click();
  expect(requests.filter((url) => url.endsWith('sru-gromp-base.glb'))).toHaveLength(0);
  for (const [name, count] of [
    ['SRU_Blue', 16],
    ['SRU_Gromp', 25],
  ] as const) {
    await page.locator('#character').selectOption(name);
    await expect(page.locator('#status')).toContainText(`${count} atomic clips`);
    await expect(page.locator('#clip')).toContainText(`${name.toLowerCase()}_attack1.anm`);
    const result = await page.evaluate((name) => {
      const api = (window as any).__JUNGLE_CHARACTERS__,
        entry = api.entries.get(name);
      let finite = true;
      const unchanged: string[] = [];
      const hidden: string[] = [],
        visible: string[] = [];
      entry.root.traverse((object: any) => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          (object.visible ? visible : hidden).push(material.userData.sourceSubmesh);
      });
      for (const clip of entry.clips) {
        api.chooseClip(clip.name);
        api.seek(0);
        const before: number[] = [];
        entry.root.traverse((o: any) => {
          if (o.isBone) before.push(...o.matrixWorld.elements);
        });
        api.seek(clip.duration * 0.47);
        const after: number[] = [];
        entry.root.traverse((o: any) => {
          if (o.isBone) after.push(...o.matrixWorld.elements);
        });
        finite &&= after.length > 0 && after.every(Number.isFinite);
        if (!after.some((v, i) => Math.abs(v - before[i]) > 1e-6)) unchanged.push(clip.name);
      }
      return { finite, unchanged, hidden, visible, id: entry.root.uuid };
    }, name);
    expect(result.finite).toBe(true);
    // The base idle and one-frame look poses contain constant source tracks.
    // Every other converted clip must change the skeleton at the sampled time.
    expect(result.unchanged.sort()).toEqual(
      (name === 'SRU_Blue'
        ? ['entry_6c2b2ee6', 'entry_317a4a65', 'entry_1df94e06', 'entry_c7cda7d1']
        : ['entry_48ca57fa', 'entry_8efaa000', 'entry_a8658ee7']
      ).sort()
    );
    expect(result.visible.length).toBeGreaterThan(0);
    expect(result.hidden.sort()).toEqual(
      name === 'SRU_Gromp' ? ['SRU_Gromp_mini_mat', 'Toad_Spawn_Mat'].sort() : []
    );
    const rootKey = `Characters/${name}/CharacterRecords/Root`;
    const root =
      pin.records[`data/characters/${name.toLowerCase()}/${name.toLowerCase()}.bin`][rootKey];
    expect(JSON.parse(await page.locator('#details').innerText())).toEqual(root);
    if (name === 'SRU_Blue') {
      await expect(page.locator('#values tr').filter({ hasText: 'Attack range' })).toContainText(
        'Absent'
      );
      await page.locator('#record').selectOption('{4b0294f6}');
      await expect(page.locator('#values tr').filter({ hasText: 'Health' })).toContainText('3750');
      await page.locator('#record').selectOption(rootKey);
    }
    const idle = Object.entries(pin.models[name].atomicClips).find(([, path]) =>
      /_(idle_normal|idle1)\.anm$/.test(path as string)
    )![0];
    await page
      .locator('#clip')
      .selectOption(idle.startsWith('{') ? `entry_${idle.slice(1, -1)}` : idle.toLowerCase());
    await page.locator('#time').evaluate((input: HTMLInputElement) => {
      input.value = '0.3';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.screenshot({ path: `artifacts/jungle-${name.toLowerCase()}-base.png` });
    // Rewind after a clamped terminal pose, then exercise real playback controls.
    await page.evaluate(() => {
      const api = (window as any).__JUNGLE_CHARACTERS__;
      api.seek(999);
      api.seek(0);
    });
    await page.locator('#play').click();
    await page.waitForFunction(
      () => Number((document.querySelector('#time') as HTMLInputElement).value) > 0.1
    );
    await page.locator('#play').click();
    await expect(page.locator('#play')).toHaveText('Play');
    await page.locator('#character').selectOption('SRU_MurkwolfMini');
    await expect(page.locator('#status')).toContainText('25 atomic clips');
    await expect(page.locator('#values tr').filter({ hasText: 'Attack damage' })).toContainText(
      'Absent'
    );
    await expect(page.locator('#play')).toBeEnabled();
    await page.locator('#character').selectOption(name);
    expect(
      await page.evaluate(
        (name) => (window as any).__JUNGLE_CHARACTERS__.entries.get(name).root.uuid,
        name
      )
    ).toBe(result.id);
  }
  for (const name of pin.characters) {
    await page.locator('#character').selectOption(name);
    await expect(page.locator('#record')).toHaveValue(`Characters/${name}/CharacterRecords/Root`);
    await expect(page.locator('#status')).toContainText(`${name} · base skin 0`);
  }
  expect(requests.filter((url) => url.endsWith('sru-blue-base.glb'))).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith('sru-gromp-base.glb'))).toHaveLength(1);
  await page.locator('#character').selectOption('SRU_Gromp');
  await page.setViewportSize({ width: 800, height: 720 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(800);
  await page.screenshot({ path: 'artifacts/jungle-characters-small.png' });
  expect(errors).toEqual([]);
});

test('a failed rig asset can retry and a late load cannot replace another selected character', async ({
  page,
}) => {
  test.setTimeout(60000);
  let attempts = 0;
  await page.route('**/sru-blue-base.glb', (route) =>
    ++attempts === 1 ? route.abort('failed') : route.continue()
  );
  await page.goto('/tools/qa/jungle-characters.html');
  await expect(page.getByRole('button', { name: 'Retry model load' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry model load' }).click();
  await expect(page.locator('#status')).toContainText('16 atomic clips');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/sru-gromp-base.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await page.locator('#character').selectOption('SRU_Gromp');
  await expect(page.locator('#status')).toContainText('Loading SRU_Gromp');
  await page.locator('#character').selectOption('Sru_Crab');
  release();
  await page.waitForFunction(() => (window as any).__JUNGLE_CHARACTERS__.entries.has('SRU_Gromp'));
  await expect(page.locator('#status')).toContainText('Sru_Crab · base skin 0 · 17 atomic clips');
  expect(
    await page.evaluate(() =>
      [...(window as any).__JUNGLE_CHARACTERS__.entries.entries()].every(
        ([name, entry]: any) => entry.root.visible === (name === 'Sru_Crab')
      )
    )
  ).toBe(true);
  await page.locator('#character').selectOption('SRU_Gromp');
  await expect(page.locator('#status')).toContainText('25 atomic clips');
  expect(attempts).toBe(2);
});

test('peaceful Scuttler review scrubs all seventeen source clips and renders emergence and hiding', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  await page.goto('/tools/qa/jungle-characters.html?character=Sru_Crab');
  await page.waitForFunction(() => (window as any).__JUNGLE_CHARACTERS__?.ready);
  await expect(page.locator('#status')).toContainText('Sru_Crab · base skin 0 · 17 atomic clips');
  await expect(page.locator('#values tr').filter({ hasText: 'Tags' })).toContainText(
    'Special_Peaceful'
  );
  await expect(page.locator('#clip option')).toHaveCount(17);
  const samples = await page.evaluate(() => {
    const api = (window as any).__JUNGLE_CHARACTERS__,
      entry = api.entries.get('Sru_Crab'),
      output = [];
    for (const clip of entry.clips) {
      api.chooseClip(clip.name);
      api.seek(0);
      const before: number[] = [];
      entry.root.traverse((o: any) => {
        if (o.isBone) before.push(...o.matrixWorld.elements);
      });
      api.seek(clip.duration * 0.47);
      const after: number[] = [];
      entry.root.traverse((o: any) => {
        if (o.isBone) after.push(...o.matrixWorld.elements);
      });
      output.push({
        name: clip.name,
        finite: after.every(Number.isFinite),
        bones: after.length / 16,
        changed: after.some((v, i) => Math.abs(v - before[i]) > 1e-6),
      });
    }
    return output;
  });
  expect(samples.every((s) => s.finite && s.bones === 66)).toBe(true);
  expect(samples.filter((s) => s.changed).length).toBeGreaterThan(10);
  for (const [name, seconds, file] of [
    ['entry_9dd9dc06', 0.3, 'idle'],
    ['entry_36b514cb', 0.8, 'emergence'],
    ['entry_448a6eb4', 0.45, 'hide'],
  ] as const) {
    await page.locator('#clip').selectOption(name);
    await page.locator('#time').evaluate((input: HTMLInputElement, t) => {
      input.value = String(t);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);
    const pixels = await page.evaluate(() => {
      const api = (window as any).__JUNGLE_CHARACTERS__,
        r = api.renderer,
        gl = r.getContext(),
        root = api.entries.get('Sru_Crab').root,
        a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
        b = new Uint8Array(a.length);
      r.render(api.scene, api.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a
      );
      root.visible = false;
      r.render(api.scene, api.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b
      );
      root.visible = true;
      r.render(api.scene, api.camera);
      let pixels = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++;
      return pixels;
    });
    if (file === 'hide') {
      const top = await page.evaluate(() => {
        const entry = (window as any).__JUNGLE_CHARACTERS__.entries.get('Sru_Crab');
        let top = -Infinity;
        entry.root.traverse((o: any) => {
          if (o.isSkinnedMesh) {
            o.computeBoundingBox();
            top = Math.max(top, o.boundingBox.max.y);
          }
        });
        return top;
      });
      expect(top).toBeLessThan(0);
      expect(pixels).toBe(0);
      await expect(page.locator('#pose-note')).toContainText('body below the grid');
    } else {
      expect(pixels).toBeGreaterThan(500);
      await expect(page.locator('#pose-note')).toBeHidden();
    }
    await page.screenshot({ path: `artifacts/scuttler-review-${file}.png` });
  }
  await page.evaluate(() => {
    const api = (window as any).__JUNGLE_CHARACTERS__;
    api.seek(999);
    api.seek(0);
  });
  await page.locator('#play').click();
  await page.waitForFunction(
    () => Number((document.querySelector('#time') as HTMLInputElement).value) > 0.1
  );
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Play');
  expect(errors).toEqual([]);
});
