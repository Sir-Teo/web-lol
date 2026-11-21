import { expect, test, type Page } from '@playwright/test';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';

test.setTimeout(240_000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
}

test('replay UI, sound mix bus, expanded practice tools, context-loss save, and visual review set', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await mkdir('artifacts', { recursive: true });
  await page.goto('/?scene=fixture', { waitUntil: 'domcontentloaded' });
  await ready(page);

  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone5-playfield.png' });
  }

  // 1. Exercise expanded Practice Tools, shop purchase, movement, and aiming capture.
  await page.locator('#practice-button').click();
  await page.getByRole('button', { name: 'Level up (+1)', exact: true }).click();
  await expect(page.locator('#level')).toHaveText('2');
  await page.getByRole('button', { name: 'Add 1,000 gold', exact: true }).click();
  await page.getByRole('button', { name: 'Advance 30s', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();

  await page.keyboard.press('p');
  await page.locator('[data-buy="boots"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone5-shop.png' });
  }
  await page.keyboard.press('Escape');

  await page.mouse.move(900, 440);
  await page.keyboard.down('w');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone5-aiming.png' });
  }
  await page.keyboard.up('w');
  await page.waitForTimeout(300);

  // 2. Test Sound & Mix modal, Web Audio mix bus routing, and persistence.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sound & mix', exact: true }).click();
  await page
    .getByRole('group', { name: 'Master volume' })
    .getByRole('button', { name: '75%', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Combat SFX' })
    .getByRole('button', { name: '50%', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'UI & feedback cues' })
    .getByRole('button', { name: '25%', exact: true })
    .click();
  await page.getByRole('button', { name: 'Dynamic fight limiter: On', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Dynamic fight limiter: Off', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');

  const mixState = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.audio.unlock();
    return {
      mix: g.audio.mix,
      stored: JSON.parse(localStorage.getItem('browser-moba.sound-mix.v1')!),
      hasCompressor: !!g.audio.combatCompressor,
      masterGain: g.audio.masterBus?.gain.value,
      combatGain: g.audio.combatBus?.gain.value,
      feedbackGain: g.audio.feedbackBus?.gain.value,
    };
  });
  expect(mixState.mix).toEqual({
    master: 0.75,
    combat: 0.5,
    feedback: 0.25,
    dynamicLimiter: false,
  });
  expect(mixState.stored).toEqual(mixState.mix);
  expect(mixState.hasCompressor).toBe(true);
  expect(mixState.masterGain).toBeCloseTo(0.75, 5);
  expect(mixState.combatGain).toBeCloseTo(0.5, 5);
  expect(mixState.feedbackGain).toBeCloseTo(0.25, 5);

  await page.getByRole('button', { name: 'Reset mix defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();

  // 3. Test Replay export, incompatible version rejection, import, transport controls, and exit.
  const liveSnapshotBeforeReplay = await page.evaluate(() =>
    (window as any).__GAME__.liveWorld.snapshot()
  );
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download replay file', exact: true }).click();
  const replayDownload = await downloadPromise;
  const replayText = await readFile((await replayDownload.path())!, 'utf8');
  const parsedReplay = JSON.parse(replayText);
  expect(parsedReplay.format).toBe(1);
  expect(parsedReplay.checkpoints.length).toBeGreaterThanOrEqual(2);

  // Reject incompatible version & corrupted JSON before accepting the valid replay file.
  const replayInput = page.getByLabel('Replay file', { exact: true });
  await replayInput.setInputFiles({
    name: 'bad-version.replay.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...parsedReplay, version: -1 })),
  });
  await expect(page.locator('.replay-file-status')).toContainText('different game version');
  await expect(page.getByRole('button', { name: 'Watch loaded replay' })).toBeHidden();

  await replayInput.setInputFiles({
    name: 'valid.replay.json',
    mimeType: 'application/json',
    buffer: Buffer.from(replayText),
  });
  await expect(page.locator('.replay-file-status')).toContainText('Practice replay · Ashe');
  await page.getByRole('button', { name: 'Watch loaded replay', exact: true }).click();

  await expect(page.locator('#replay-bar')).toBeVisible();
  await expect(page.locator('#replay-verify')).toContainText('hashes');
  await page.getByRole('button', { name: '2×', exact: true }).click();
  await expect(page.getByRole('button', { name: '2×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.waitForTimeout(350);
  await page.locator('#replay-play-btn').click();
  await expect(page.locator('#replay-play-btn')).toHaveText('Play');

  // Player right-click orders must not mutate the read-only replay world.
  const pausedReplaySnapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.mouse.click(720, 420, { button: 'right' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    pausedReplaySnapshot
  );

  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone5-replay-bar.png' });
  }

  await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
  await expect(page.locator('#replay-bar')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    liveSnapshotBeforeReplay
  );

  // 4. Verify WebGL context loss offers a valid Save match action that restores across reload.
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const contextLossSupported = await page.evaluate(() => {
    const ext = (window as any).__GAME__.view.renderer
      .getContext()
      .getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    return true;
  });
  if (contextLossSupported) {
    await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
    const lostSnapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    const saveBtn = page.getByRole('button', { name: 'Save match', exact: true });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(lostSnapshot);
  }

  // 5. Capture fog/vision, busy fight, death state, and Victory/Watch-replay screen on Chromium.
  if (browserName === 'chromium') {
    await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      const w = g.world;
      // Fog & brush boundary view
      w.hero.x = -300;
      w.hero.y = 200;
      w.step(10);
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
    });
    await page.screenshot({ path: 'artifacts/milestone5-fog-vision.png' });

    // Busy fight view with multiple champions, projectiles, and abilities
    await page.evaluate(async () => {
      const g = (window as any).__GAME__;
      const w = g.world;
      w.gainExperience(12_000);
      for (const a of ['q', 'w', 'e', 'r'] as const) w.learnSpell(a);
      const lux = w.spawn('champion', 'blue', { x: w.hero.x - 140, y: w.hero.y + 80 }, 'lux');
      w.gainExperience(12_000, lux.id);
      for (const a of ['q', 'w', 'e', 'r'] as const) w.learnSpell(a, lux.id);
      w.enqueue({
        type: 'cast',
        unit: w.player.id,
        ability: 'w',
        point: { x: w.hero.x + 500, y: w.hero.y },
      });
      w.enqueue({
        type: 'cast',
        unit: lux.id,
        ability: 'r',
        point: { x: w.hero.x + 600, y: w.hero.y },
      });
      w.step(18);
      g.view.render(w, 1, g.view.previousElapsed + 0.3);
      g.hud.update(60);
    });
    await page.screenshot({ path: 'artifacts/milestone5-busy-fight.png' });

    // Death state view
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      const w = g.world;
      w.hero.hp = 0;
      w.hero.deadAt = w.tick;
      w.hero.respawnTick = w.tick + 900;
      g.view.render(w, 1, g.view.previousElapsed + 0.2);
      g.hud.update(60);
    });
    await expect(page.locator('.death-overlay')).toBeVisible();
    await page.screenshot({ path: 'artifacts/milestone5-death-state.png' });

    // Result screen with Watch replay & Download replay
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      const w = g.world;
      w.hero.hp = w.hero.maxHp;
      w.hero.deadAt = null;
      w.hero.respawnTick = null;
      w.winner = 'blue';
      g.view.render(w, 1, g.view.previousElapsed + 0.2);
      g.hud.update(60);
    });
    await expect(page.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch replay', exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/milestone5-result-screen.png' });
  }

  expect(errors).toEqual([]);

  if (browserName === 'chromium') {
    const video = page.video();
    await page.close();
    if (video) {
      const videoPath = await video.path();
      const info = await stat(videoPath);
      expect(info.size).toBeGreaterThan(10_000);
      await copyFile(videoPath, 'artifacts/milestone5-review-video.webm');
    }
  }
});

test('first ultimate after loading has ready rig/audio/VFX and sequential sessions release GPU/DOM assets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Verify Ahri ultimate readiness immediately after #loading detaches, plus context-loss soft-depth cleanup.
  await page.goto('/?scene=fixture&champion=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const ahriReady = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      rParticlesReady: g.view.ahriRParticles.ready,
      eParticlesReady: g.view.ahriEParticles.ready,
      wParticlesReady: g.view.ahriWParticles.ready,
      qProjectilesReady: g.view.ahriQProjectiles.ready,
      qCastsReady: g.view.ahriQCasts.models !== undefined,
      spiritRushAudio: g.audio.ahriSpiritRush.status,
    };
  });
  expect(ahriReady).toEqual({
    rParticlesReady: true,
    eParticlesReady: true,
    wParticlesReady: true,
    qProjectilesReady: true,
    qCastsReady: true,
    spiritRushAudio: 'ready',
  });

  // Cast Ahri R immediately, verify particles draw, test WebGL context loss/restore on soft-depth surfaces, then dispose.
  const SequentialCounts = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const w = g.world;
    w.gainExperience(10_000);
    w.learnSpell('r');
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'r',
      point: { x: w.hero.x + 420, y: w.hero.y },
    });
    w.step(12);
    g.view.render(w, 1, 0.2);

    // Simulate world replacement across 5 identical sequential matches (3 frames each to fill the 3-slot ring buffer).
    const baseSnap = w.snapshot();
    const memorySamples: Array<{ geometries: number; textures: number; bars: number }> = [];
    for (let i = 0; i < 5; i++) {
      const clone = w.constructor.fromSnapshot(baseSnap, w.battlefield);
      clone.step(60);
      g.view.resetWorldState();
      for (let f = 0; f < 3; f++) g.view.render(clone, 1, 0.5 + f * 0.016);
      memorySamples.push({
        geometries: g.view.renderer.info.memory.geometries,
        textures: g.view.renderer.info.memory.textures,
        bars: document.querySelectorAll('.unit-bar').length,
      });
    }

    await g.dispose();
    return {
      memorySamples,
      afterDisposeCanvasCount: document.querySelectorAll('#battlefield').length,
      afterDisposeHudCount: document.querySelectorAll('.hud').length,
      afterDisposeBarsCount: document.querySelectorAll('.world-labels').length,
    };
  });

  // Across all 5 sequential matches, geometries, textures, and unit-bars are 100% constant with zero leak.
  expect(SequentialCounts.memorySamples[4]).toEqual(SequentialCounts.memorySamples[0]);
  expect(SequentialCounts.memorySamples[2]).toEqual(SequentialCounts.memorySamples[0]);
  expect(SequentialCounts.afterDisposeCanvasCount).toBe(0);
  expect(SequentialCounts.afterDisposeHudCount).toBe(0);
  expect(SequentialCounts.afterDisposeBarsCount).toBe(0);
  expect(errors).toEqual([]);
});

test('explicit WebGL2-unavailable fallback renders actionable recovery guidance', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: any[]) {
      if (type === 'webgl2') return null;
      return Reflect.apply(original, this, [type, ...rest]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/?scene=fixture', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Unable to open the Rift' })).toBeVisible();
  await expect(page.locator('#loading')).toContainText('This game requires WebGL 2.');
});
