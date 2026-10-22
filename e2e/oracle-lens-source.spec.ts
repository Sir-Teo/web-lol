import { expect, test } from '@playwright/test';

test('the original Oracle scanner animates and every static source mesh reaches the GPU', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/oracle-lens.html');
  await page.waitForFunction(() => (window as any).__ORACLE_SOURCE__?.ready);
  const captures = [];
  const expectedTriangles: Record<string, number> = {
    Trinket_Red: 638,
    RadarMesh: 186,
    CoreLaser: 408,
    Lasers: 64,
  };
  for (const name of ['Trinket_Red', 'RadarMesh', 'CoreLaser', 'Lasers']) {
    await page.locator('#asset').selectOption(name);
    const result = await page.evaluate((name) => {
      const a = (window as any).__ORACLE_SOURCE__,
        entry = a.entries.get(name);
      const matrices = () => {
        const values: number[] = [];
        entry.root.traverse((o: any) => {
          if (o.isBone) values.push(...o.matrixWorld.elements);
        });
        return values;
      };
      a.seek(0);
      const first = matrices();
      a.seek(0.74);
      const next = matrices(),
        gl = a.renderer.getContext(),
        width = gl.drawingBufferWidth,
        height = gl.drawingBufferHeight;
      const read = () => {
        const p = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return p;
      };
      a.render();
      const visible = read();
      entry.root.visible = false;
      a.render();
      const hidden = read();
      entry.root.visible = true;
      a.render();
      let changed = 0;
      for (let i = 0; i < visible.length; i += 4)
        if (
          visible[i] !== hidden[i] ||
          visible[i + 1] !== hidden[i + 1] ||
          visible[i + 2] !== hidden[i + 2]
        )
          changed++;
      let triangles = 0,
        textured = 0;
      entry.root.traverse((o: any) => {
        if (o.isMesh) {
          triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
          if (o.material.map) textured++;
        }
      });
      return {
        name,
        changed,
        triangles,
        textured,
        bones: next.length / 16,
        finite: next.every(Number.isFinite),
        animated: next.some((v, i) => Math.abs(v - first[i]) > 1e-6),
        duration: entry.clip?.duration ?? 0,
      };
    }, name);
    expect(result.changed).toBeGreaterThan(100);
    expect(result.textured).toBeGreaterThan(0);
    expect(result.triangles).toBe(expectedTriangles[name]);
    expect(result.finite).toBe(true);
    if (name === 'Trinket_Red')
      expect([result.bones, result.animated, result.duration]).toEqual([3, true, 2]);
    captures.push(result);
    await page.screenshot({ path: `artifacts/oracle-source-${name.toLowerCase()}.png` });
  }
  await page.locator('#asset').selectOption('Trinket_Red');
  await page.locator('#time').fill('0');
  await page.locator('#play').click();
  await page.waitForFunction(
    () => Number((document.querySelector('#time') as HTMLInputElement).value) > 0.1
  );
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('Play');
  expect(errors).toEqual([]);
  await test
    .info()
    .attach('oracle-source-gpu', {
      body: JSON.stringify(captures, null, 2),
      contentType: 'application/json',
    });
});
