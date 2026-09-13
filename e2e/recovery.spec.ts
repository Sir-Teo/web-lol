import { expect, test } from '@playwright/test';

test('real graphics loss blocks input and resume, restores the same frame, and survives a second loss', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.mouse.move(850, 400);
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  const frozen = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await page.keyboard.press('h');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(frozen);
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  await expect(page.getByRole('button', { name: 'Return to the Rift' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart match' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/browser-graphics-lost.png' });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(frozen);
  // The second loss compares every restored framebuffer byte with a frozen baseline.
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext();
    const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
    (window as any).__recoveryPixels = data;
    v.renderer.forceContextLoss();
  });
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const pixels = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      previous = (window as any).__recoveryPixels;
    const current = new Uint8Array(previous.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      current
    );
    let differences = 0,
      nonzero = 0;
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== previous[i]) differences++;
      if (current[i]) nonzero++;
    }
    delete (window as any).__recoveryPixels;
    return { differences, nonzero };
  });
  expect(pixels.nonzero).toBeGreaterThan(100000);
  expect(pixels.differences).toBe(0);
  await page.screenshot({ path: 'artifacts/browser-graphics-restored.png' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(frozen);
  await page.getByRole('button', { name: 'Return to the Rift' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.snapshot()))
    .not.toBe(frozen);
});

test('focus interruption clears held input and requires explicit resume', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.mouse.move(850, 400);
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.keyboard.up('w');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.keyboard.up('Space');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  await page.getByRole('button', { name: 'Return to the Rift' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.snapshot()))
    .not.toBe(snapshot);
});

test('graphics loss during asset loading recovers after assets arrive', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/assets/models/ashe-base.glb', async (route) => {
    intercepted = true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/?scene=fixture');
    await page.locator('#battlefield').waitFor();
    await expect.poll(() => intercepted).toBe(true);
    await page.evaluate(() => {
      const canvas = document.querySelector('#battlefield') as HTMLCanvasElement;
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      (window as any).__lossExtension = extension;
      extension.loseContext();
    });
    await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeAttached();
    await page.evaluate(() => {
      (window as any).__lossExtension.restoreContext();
      delete (window as any).__lossExtension;
    });
    release();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
    const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  } finally {
    release();
  }
});

test('failed recovery remains blocked and a later successful restoration preserves the match', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const r = (window as any).__GAME__.view.renderer;
    const original = r.compileAsync.bind(r);
    r.compileAsync = () => {
      r.compileAsync = original;
      return Promise.reject(new Error('Injected shader recovery failure'));
    };
    r.forceContextLoss();
  });
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Graphics recovery interrupted' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await expect(page.getByRole('button', { name: 'Return to the Rift' })).toHaveCount(0);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
});

test('hidden-document handler cannot be resumed by closing an existing menu', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await expect(page.getByRole('heading', { name: 'Item shop' })).toBeVisible();
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.snapshot()))
    .not.toBe(snapshot);
});

test('a second loss cancels pending warmup and a stale completion cannot resume recovery', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const r = (window as any).__GAME__.view.renderer,
      original = r.compileAsync.bind(r);
    r.compileAsync = () => {
      r.compileAsync = original;
      (window as any).__warmupStarted = true;
      return new Promise<void>((resolve) => {
        (window as any).__finishOldWarmup = resolve;
      });
    };
    r.forceContextLoss();
  });
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await page.waitForFunction(() => (window as any).__warmupStarted);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await page.waitForFunction(() => (window as any).__GAME__.hud.graphicsState === 'lost');
  await page.evaluate(() => (window as any).__finishOldWarmup());
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__GAME__.hud.graphicsState)).toBe('lost');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
});

test('a page that starts hidden stays paused without waiting for a visibility event', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  );
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.tick)).toBe(0);
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__GAME__.world.tick)).toBe(0);
  await page.getByRole('button', { name: 'Return to the Rift' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.tick))
    .toBeGreaterThan(0);
});
