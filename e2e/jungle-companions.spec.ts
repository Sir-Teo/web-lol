import { expect, test } from '@playwright/test';

test('all companion skins show both source forms and scrub every retained atomic state', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  await page.goto('/tools/qa/jungle-characters.html?character=SRU_Jungle_Companions/Skin0');
  await page.waitForFunction(() => (window as any).__JUNGLE_CHARACTERS__?.ready);
  await expect(page.locator('#character option')).toHaveCount(14);
  for (let i = 0; i < 3; i++) {
    const name = `SRU_Jungle_Companions/Skin${i}`;
    await page.locator('#character').selectOption(name);
    await expect(page.locator('#status')).toContainText(`${[28, 26, 30][i]} atomic clips`);
    await expect(page.locator('#form')).toHaveValue('Adult');
    await expect(page.locator('#pose-note')).toContainText('Native pet growth');
    const result = await page.evaluate((name) => {
      const a = (window as any).__JUNGLE_CHARACTERS__,
        entry = a.entries.get(name);
      let finite = true;
      for (const c of entry.clips) {
        a.chooseClip(c.name);
        a.seek(c.duration * 0.47);
        entry.root.traverse((o: any) => {
          if (o.isBone) finite &&= o.matrixWorld.elements.every(Number.isFinite);
        });
      }
      a.chooseClip('idle1');
      a.seek(0.5);
      return { finite, count: entry.clips.length };
    }, name);
    expect(result.finite).toBe(true);
    expect(result.count).toBe([28, 26, 30][i]);
    for (const form of ['Adult', 'Baby']) {
      await page.locator('#form').selectOption(form);
      const sample = await page.evaluate(
        ({ name, form }) => {
          const a = (window as any).__JUNGLE_CHARACTERS__,
            entry = a.entries.get(name),
            visible: string[] = [],
            gl = a.renderer.getContext(),
            before = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
            after = new Uint8Array(before.length);
          entry.root.traverse((o: any) => {
            if (o.isMesh && o.visible) visible.push(o.material.userData.sourceSubmesh);
          });
          a.renderer.render(a.scene, a.camera);
          gl.readPixels(
            0,
            0,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            before
          );
          entry.root.visible = false;
          a.renderer.render(a.scene, a.camera);
          gl.readPixels(
            0,
            0,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            after
          );
          entry.root.visible = true;
          a.renderer.render(a.scene, a.camera);
          let pixels = 0;
          for (let j = 0; j < before.length; j += 4)
            if (
              before[j] !== after[j] ||
              before[j + 1] !== after[j + 1] ||
              before[j + 2] !== after[j + 2]
            )
              pixels++;
          return { visible, pixels, expected: form };
        },
        { name, form }
      );
      expect(sample.visible).toEqual([form]);
      expect(sample.pixels).toBeGreaterThan(500);
      await page.screenshot({ path: `artifacts/jungle-companion-${i}-${form.toLowerCase()}.png` });
    }
  }
  expect(errors).toEqual([]);
});
