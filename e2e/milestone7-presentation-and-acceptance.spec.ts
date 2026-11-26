import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.setTimeout(300_000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
}

test('Milestone 7.3: Multi-resolution HUD readability (1280x720, 1920x1080, 2560x1440), split-evidence Reference modal, Eye of the Herald summon, and visual captures', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('artifacts/milestone7-visuals', { recursive: true });

  // 1. Load at 1920x1080 and start a full 10-champion 5v5 match so all HUD & Rift Objectives are active
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);

  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);

  const resumeBtn = page.getByRole('button', { name: 'Return to the Rift', exact: true });
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
  }

  // Verify HUD elements are visible and non-overlapping at 1920x1080
  const layout1080 = await page.evaluate(() => {
    const hud = document.querySelector('.champion-hud')?.getBoundingClientRect();
    const mini = document.querySelector('.minimap-shell')?.getBoundingClientRect();
    const top = document.querySelector('.match-identity')?.getBoundingClientRect();
    if (!hud || !mini || !top) return { ok: false, reason: 'missing hud elements' };
    const overlapsMini = !(
      hud.right <= mini.left ||
      hud.left >= mini.right ||
      hud.bottom <= mini.top ||
      hud.top >= mini.bottom
    );
    const insideViewport =
      hud.left >= 0 &&
      hud.right <= window.innerWidth &&
      hud.bottom <= window.innerHeight + 2 &&
      mini.right <= window.innerWidth &&
      mini.bottom <= window.innerHeight + 2;
    return { ok: !overlapsMini && insideViewport, overlapsMini, insideViewport };
  });
  expect(layout1080).toEqual({ ok: true, overlapsMini: false, insideViewport: true });

  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7-visuals/lane-1920x1080.png' });
  }

  // Open Reference & Patch 26.18 audit modal and verify split evidence attributes on all 158 entries
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Reference & patch 26.18', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reference & Patch 26.18' })).toBeVisible();
  const auditStats = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#audit-list .audit-entry'));
    const withSplitEvidence = rows.filter(
      (r) => r.dataset.implEvidence && r.dataset.refEvidence && r.dataset.presEvidence
    ).length;
    return { total: rows.length, withSplitEvidence };
  });
  expect(auditStats.total).toBe(158);
  expect(auditStats.withSplitEvidence).toBe(158);
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7-visuals/reference-audit-1920x1080.png' });
  }
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();

  // 2. Test Eye of the Herald HUD state + '4' hotkey summoning a lane Rift Herald unit
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const w = g.world;
    w.riftObjectives.herald.chargeHolder = {
      unitId: w.player.id,
      team: w.hero.team,
      endTick: w.tick + 60 * 180,
    };
  });
  await expect(page.locator('#trinket')).toHaveAttribute('data-herald-eye', 'true');
  await expect(page.locator('#trinket .trinket-charges')).toHaveText('EYE');

  // Press '4' to summon Rift Herald and verify unit spawns and Eye clears
  await page.keyboard.press('4');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const w = (window as any).__GAME__.world;
        return {
          hasHerald: w.units.some((u: any) => u.summonedObjective === 'rift-herald'),
          eyeCleared: w.riftObjectives.herald.chargeHolder === null,
        };
      })
    )
    .toEqual({ hasHerald: true, eyeCleared: true });
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7-visuals/herald-summon-1920x1080.png' });
  }

  // 3. 1280x720 responsiveness check & capture
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200);
  const layout720 = await page.evaluate(() => {
    const hud = document.querySelector('.champion-hud')?.getBoundingClientRect();
    const mini = document.querySelector('.minimap-shell')?.getBoundingClientRect();
    if (!hud || !mini) return { ok: false };
    const overlapsMini = !(
      hud.right <= mini.left ||
      hud.left >= mini.right ||
      hud.bottom <= mini.top ||
      hud.top >= mini.bottom
    );
    return {
      ok: !overlapsMini && hud.left >= 0 && mini.right <= window.innerWidth + 1,
      overlapsMini,
    };
  });
  expect(layout720).toEqual({ ok: true, overlapsMini: false });
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7-visuals/lane-1280x720.png' });
  }

  // 4. 2560x1440 responsiveness check & capture
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.waitForTimeout(200);
  const layout1440 = await page.evaluate(() => {
    const hud = document.querySelector('.champion-hud')?.getBoundingClientRect();
    const mini = document.querySelector('.minimap-shell')?.getBoundingClientRect();
    if (!hud || !mini) return { ok: false };
    const overlapsMini = !(
      hud.right <= mini.left ||
      hud.left >= mini.right ||
      hud.bottom <= mini.top ||
      hud.top >= mini.bottom
    );
    return {
      ok: !overlapsMini && mini.width >= 250 && hud.width > 500,
      overlapsMini,
    };
  });
  expect(layout1440).toEqual({ ok: true, overlapsMini: false });
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7-visuals/lane-2560x1440.png' });
  }

  expect(errors).toEqual([]);
});

test('Milestone 7.4: Ten sequential restarts lifecycle stability, pause clock freeze, and WebGL context-loss recovery', async ({
  page,
}) => {
  test.setTimeout(720_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);

  const resumeBtn = page.getByRole('button', { name: 'Return to the Rift', exact: true });
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
  }

  // Exercise 10 sequential restarts via pause menu reset (which replaces checkpoint + reloads) and verify no errors or canvas leaks
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      (window as any).__GAME__.world.step(10);
    });
    await page.locator('#pause-button').click();
    await Promise.all([page.waitForEvent('load'), page.locator('[data-action="reset"]').click()]);
    await ready(page);
    const resumeAfter = page.getByRole('button', { name: 'Return to the Rift', exact: true });
    if (await resumeAfter.isVisible().catch(() => false)) {
      await resumeAfter.click();
    }
    const check = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      tick: (window as any).__GAME__.world.tick,
    }));
    // Main WebGL canvas + minimap 2D canvas = 2 canvases max (no leaked WebGL contexts)
    expect(check.canvases).toBeLessThanOrEqual(2);
    expect(check.tick).toBeLessThan(600);
  }

  // Verify pause clock freeze (match time does not advance while paused)
  await page.locator('#pause-button').click();
  const tickWhenPaused = await page.evaluate(() => (window as any).__GAME__.world.tick);
  await page.waitForTimeout(350);
  const tickStillPaused = await page.evaluate(() => (window as any).__GAME__.world.tick);
  expect(tickStillPaused).toBe(tickWhenPaused);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();

  // Trigger simulated WebGL context loss and verify intact-world recovery dialog + snapshot exportability
  const contextRecovery = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const beforeSnapshot = g.world.snapshot();
    const ext = g.view.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!ext) return { supported: false, snapshotValid: beforeSnapshot.length > 100 };
    ext.loseContext();
    return { supported: true, snapshotValid: beforeSnapshot.length > 100 };
  });
  expect(contextRecovery.snapshotValid).toBe(true);
  if (contextRecovery.supported) {
    await expect(page.locator('.game-dialog')).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.view.renderer.getContext().getExtension('WEBGL_lose_context')?.restoreContext();
    });
  }

  expect(errors).toEqual([]);
});
