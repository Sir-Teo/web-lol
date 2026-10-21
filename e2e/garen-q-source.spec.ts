import { expect, test } from '@playwright/test';
import audit from '../docs/reference/garen-q-particles-decoded.json' with { type: 'json' };
test('Decisive Strike inspection loads all frozen textures, all four meshes and all eleven source systems', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/garen-q-source-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_SOURCE__?.ready);
  await expect(page.locator('#textures img')).toHaveCount(29);
  expect(
    await page
      .locator('#textures img')
      .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0))
  ).toBe(true);
  await expect(page.getByLabel('System').locator('option')).toHaveCount(11);
  for (const [name, suffix, version, triangles] of [
    ['Impact', 'impact', [3, 2], 2],
    ['Jump', 'jump', [3, 2], 16],
    ['Sword scroll', 'sword-scroll', [3, 2], 76],
    ['Weapon trail', 'weapon-trail', [3, 2], 500],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const state = await page.evaluate(() => (window as any).__GAREN_Q_SOURCE__);
    expect(state.selected).toBe(suffix);
    expect(state.triangles).toBe(triangles);
    expect(state.sourceVersion).toEqual(version);
    expect(state.bounds.every(Number.isFinite)).toBe(true);
    const mesh = audit.meshes.find((m) => m.output.path.endsWith(`garen-q-${suffix}.glb`))!;
    for (let axis = 0; axis < 3; axis++) {
      expect(state.bounds[axis]).toBeCloseTo(
        (mesh.measuredMinMax[axis + 3] - mesh.measuredMinMax[axis]) * audit.unitScale,
        6
      );
    }
    expect(Math.max(...state.bounds)).toBeGreaterThan(0);
  }
  await page.getByLabel('Wireframe').check();
  expect(await page.evaluate(() => (window as any).__GAREN_Q_SOURCE__.wireframe)).toBe(true);
  await page.waitForFunction(() => {
    const state = (window as any).__GAREN_Q_SOURCE__;
    return state.renderedRevision === state.revision && state.draw.lines > 0;
  });
  const visiblePixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 64) count++;
    return count;
  });
  expect(await page.evaluate(() => (window as any).__GAREN_Q_SOURCE__.glError)).toBe(0);
  expect(visiblePixels).toBeGreaterThan(10);
  await page.screenshot({ path: 'artifacts/garen-q-source-wireframe.png', fullPage: true });
  await page.getByLabel('Wireframe').uncheck();
  await expect(page.locator('#bindings tr')).toHaveCount(4);
  await expect(page.locator('#bindings tr').nth(0)).toHaveText(
    'Garen_Q_JumpAbsentAbsentfalsefalse'
  );
  await expect(page.locator('#bindings tr').nth(1)).toHaveText('Garen_Q_Land9Absentfalsefalse');
  await expect(page.locator('#bindings tr').nth(2)).toHaveText(
    'Garen_Q_Sword_Trail8C_Buffbone_Glb_Center_LocfalseAbsent'
  );
  await expect(page.locator('#bindings tr').nth(3)).toHaveText(
    'Garen_Q_Jump_BlurAbsentRootfalsefalse'
  );
  for (const [key, system] of Object.entries(audit.systems)) {
    await page.getByLabel('System').selectOption(key);
    await expect(page.locator('#emitters tr')).toHaveCount(system.emitterCount);
    expect(await page.evaluate(() => (window as any).__GAREN_Q_SOURCE__.system)).toBe(key);
  }
  await page.getByLabel('System').selectOption('Garen_Q_Buf');
  await expect(page.locator('#system-status')).toContainText('emitter array absent');
  await expect(page.locator('#definition')).not.toContainText('complexEmitterDefinitionData');
  await page.getByLabel('System').selectOption('Garen_Q_Sword_Trail');
  await expect(page.locator('#emitters')).toContainText('VfxPrimitiveMesh');
  await page.getByRole('button', { name: 'Weapon trail', exact: true }).click();
  await page.screenshot({ path: 'artifacts/garen-q-source-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});

// Shared W/E/R texture dependencies already have live consumers. Check only newly packaged Q assets.
test('Q graphics load only selected cast and weapon trail assets on Garen presence', async ({
  page,
}) => {
  const reused = new Set([
    'garen_alpha_12.png',
    'garen_aura_self.png',
    'garen_base_r_spikes.png',
    'garen_base_w_ground_glow.png',
    'garen_base_z_smoke_puffs.png',
    'garen_color-rampdown.png',
  ]);
  const newTextures = audit.textures
    .map((t) => t.path.replace(/^public/, ''))
    .filter((path) => !reused.has(path.split('/').at(-1)!));
  expect(newTextures).toHaveLength(23);
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/assets/models/garen-q-') || newTextures.includes(path)) requests.push(path);
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests.sort()).toEqual([
    '/assets/effects/garen_base_q_cas_activate.png',
    '/assets/effects/garen_base_q_cas_bubble.png',
    '/assets/effects/garen_base_q_cas_bubble_2.png',
    '/assets/effects/garen_base_q_cas_bubble_black.png',
    '/assets/effects/garen_base_q_cas_flare.png',
    '/assets/effects/garen_base_q_hit_flash.png',
    '/assets/effects/garen_base_q_sword_scroll.png',
    '/assets/effects/garen_base_q_wpn_trail.png',
    '/assets/models/garen-q-sword-scroll.glb',
    '/assets/models/garen-q-weapon-trail.glb',
  ]);
});

test('Q cast materials reproduce independent PNG products and ADD/SUBTRACT/alpha-add framebuffer results in every channel', async ({
  page,
}) => {
  const playback = await import('../docs/reference/garen-q-particle-profiles.json', {
    with: { type: 'json' },
  });
  const profiles = await import('../src/content/garen-q-cast-particles.json', {
    with: { type: 'json' },
  });
  await page.goto('/tools/qa/garen-q-source-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_SOURCE__?.ready);
  const background = [96, 144, 192, 224];
  for (const sample of playback.default.gpuSamples) {
    const blend = profiles.default[sample.profileIndex].blend;
    const tint = [...sample.tint];
    if (blend === 0 || blend === 2) {
      for (let i = 0; i < 3; i++) tint[i] *= tint[3];
      tint[3] = 1;
    }
    const source = sample.sourceRgba.map(
      (v, i) => ((v / 255) * tint[i] * sample.lookupRgba[i]) / 255
    );
    for (const product of [true, false]) {
      const actual = await page.evaluate(
        async (sample) => (window as any).__GAREN_Q_CAST_MATERIAL__.probe(sample),
        { ...sample, background, product }
      );
      const expected = source.map((v, i) =>
        Math.round(
          Math.max(
            0,
            Math.min(
              1,
              product
                ? v
                : blend === 2
                  ? (background[i] / 255) * (1 - v)
                  : background[i] / 255 + v * (blend === 4 ? source[3] : 1)
            )
          ) * 255
        )
      );
      for (let i = 0; i < 4; i++)
        expect(
          Math.abs(actual[i] - expected[i]),
          `profile ${sample.profileIndex}, product ${product}, channel ${i}`
        ).toBeLessThanOrEqual(1);
    }
  }
});
