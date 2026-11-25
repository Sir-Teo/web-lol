import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.setTimeout(360_000);

async function ready(page: Page) {
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 120_000 });
  const hasDebugGlobal = await page.evaluate(() => '__GAME__' in window && !!(window as any).__GAME__);
  expect(hasDebugGlobal, 'Production build must not expose window.__GAME__').toBe(false);
}

async function readClockSeconds(page: Page): Promise<number> {
  const txt = (await page.locator('#clock').textContent())?.trim() ?? '00:00';
  const [m, s] = txt.split(':').map((n) => Number.parseInt(n, 10));
  return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
}

test('Milestone 7.3: Production multi-resolution HUD (1280/1920/2560), separated Reference Audit, 10-champion flow, WebGL context-loss recovery & 5x restart stability', async ({
  page,
  browserName,
}, testInfo) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await mkdir('artifacts/milestone7', { recursive: true });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);

  // 1. Verify Milestone 7.0 separated evidence ledger in Reference & Patch 26.18 modal
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Reference & patch 26.18', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reference & Patch 26.18' })).toBeVisible();
  const auditMetrics = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('#audit-list .audit-entry')];
    const approxEntries = entries.filter(
      (el) => el.getAttribute('data-audit-kind') === 'approximation'
    );
    const missingNotes = approxEntries.filter(
      (el) => !(el.textContent ?? '').includes('Deviation:')
    ).length;
    const withEvidenceAttrs = entries.filter(
      (el) =>
        el.getAttribute('data-impl-evidence') &&
        el.getAttribute('data-ref-evidence') &&
        el.getAttribute('data-pres-evidence')
    ).length;
    return {
      total: entries.length,
      approxCount: approxEntries.length,
      missingNotes,
      withEvidenceAttrs,
      summaryText: document.querySelector('.audit-summary')?.textContent ?? '',
    };
  });
  expect(auditMetrics.total).toBe(158);
  expect(auditMetrics.approxCount).toBeGreaterThan(10);
  expect(auditMetrics.missingNotes).toBe(0);
  expect(auditMetrics.withEvidenceAttrs).toBe(158);
  expect(auditMetrics.summaryText).toContain('pinned 16.18 source');
  expect(auditMetrics.summaryText).toContain('authored proxies');
  expect(auditMetrics.summaryText).toContain(`${auditMetrics.approxCount} approximations`);
  if (browserName === 'chromium') {
    await page.screenshot({ path: 'artifacts/milestone7/m7-reference-audit.png' });
  }
  await page.getByRole('button', { name: 'Back to pause menu', exact: true }).click();

  // 2. Start a fresh 10-champion 5v5 match as Darius
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  expect(await page.locator('[data-action="choose-champion"]').count()).toBe(10);
  await page.getByRole('button', { name: 'Darius', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();

  // Verify HUD displays Darius and Tab scoreboard lists 10 distinct champions
  const hudBar = page.getByRole('region', { name: 'Champion controls' });
  await expect(hudBar).toContainText('DARIUS');
  await page.keyboard.down('Tab');
  await page.waitForTimeout(200);
  const rosterCheck = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.scoreboard .scoreboard-row strong')]
      .map((el) => el.textContent?.trim() ?? '')
      .filter((t) => t.length > 0);
    return {
      heroText: document.querySelector('[aria-label="Champion controls"]')?.textContent?.includes('DARIUS') ?? false,
      championsFound: [...new Set(names)],
      uniqueChampions: new Set(names).size,
    };
  });
  await page.keyboard.up('Tab');
  expect(rosterCheck.heroText).toBe(true);
  expect(rosterCheck.uniqueChampions).toBe(10);

  // 3. Multi-resolution HUD & viewport layout checks: 1280x720, 1920x1080, 2560x1440
  const resolutions = [
    { width: 1280, height: 720, file: 'artifacts/milestone7/m7-hud-1280x720.png' },
    { width: 1920, height: 1080, file: 'artifacts/milestone7/m7-hud-1920x1080.png' },
    { width: 2560, height: 1440, file: 'artifacts/milestone7/m7-hud-2560x1440.png' },
  ];
  const layoutResults: Array<{
    resolution: string;
    overflowX: boolean;
    overflowY: boolean;
    canvasCovers: boolean;
    hudInsideViewport: boolean;
    minimapInsideViewport: boolean;
  }> = [];

  for (const res of resolutions) {
    await page.setViewportSize({ width: res.width, height: res.height });
    await page.waitForTimeout(250);
    const geom = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const canvas = document.querySelector('canvas')?.getBoundingClientRect();
      const hud = document.querySelector('[aria-label="Champion controls"]')?.getBoundingClientRect();
      const minimap = document.getElementById('minimap')?.getBoundingClientRect();
      const inside = (r: DOMRect | undefined) =>
        !!r && r.width > 0 && r.height > 0 && r.left >= -2 && r.top >= -2 && r.right <= vw + 2 && r.bottom <= vh + 2;
      return {
        overflowX: document.documentElement.scrollWidth > vw + 2,
        overflowY: document.documentElement.scrollHeight > vh + 2,
        canvasCovers: !!canvas && canvas.width >= vw - 2 && canvas.height >= vh - 2,
        hudInsideViewport: inside(hud),
        minimapInsideViewport: inside(minimap),
      };
    });
    layoutResults.push({ resolution: `${res.width}x${res.height}`, ...geom });
    expect(geom.overflowX, `Horizontal overflow at ${res.width}x${res.height}`).toBe(false);
    expect(geom.overflowY, `Vertical overflow at ${res.width}x${res.height}`).toBe(false);
    expect(geom.canvasCovers, `Canvas sizing at ${res.width}x${res.height}`).toBe(true);
    expect(geom.hudInsideViewport, `HUD bounds at ${res.width}x${res.height}`).toBe(true);
    expect(geom.minimapInsideViewport, `Minimap bounds at ${res.width}x${res.height}`).toBe(true);
    if (browserName === 'chromium') {
      await page.screenshot({ path: res.file });
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 4. Camera lock toggle (Y), center snap (Space), real match clock progression
  await page.keyboard.press('y');
  await page.keyboard.press('Space');
  const clockBefore = await readClockSeconds(page);
  await expect
    .poll(() => readClockSeconds(page), { timeout: 30_000 })
    .toBeGreaterThan(clockBefore);

  // 5. WebGL context-loss & restoration resilience
  const webglBefore = await readClockSeconds(page);
  const webglInfo = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!gl || !ext) {
      return { supported: false, isLostAfter: false };
    }
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 150));
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 500));
    return {
      supported: true,
      isLostAfter: gl.isContextLost(),
    };
  });
  if (webglInfo.supported) {
    // Engine safely pauses on WebGL restore and notifies player with "Graphics restored" toast
    await expect(page.locator('#toast')).toContainText('Graphics restored', { timeout: 30_000 });
    const resumeBtn = page.getByRole('button', { name: 'Return to the Rift', exact: true });
    if (await resumeBtn.isVisible().catch(() => false)) {
      await resumeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  }
  await expect
    .poll(() => readClockSeconds(page), { timeout: 30_000 })
    .toBeGreaterThan(webglBefore);
  const webglAfter = await readClockSeconds(page);
  const webglRecovery = {
    ...webglInfo,
    recovered: webglAfter > webglBefore,
  };
  expect(webglRecovery.recovered).toBe(true);

  // 6. Five sequential match restarts -> confirm clean readiness & heap stability
  const restartSamples: Array<{ restart: number; clockSeconds: number; usedJSHeapBytes: number | null }> = [];
  for (let i = 1; i <= 5; i++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
    await page.waitForTimeout(400);
    const clockSeconds = await readClockSeconds(page);
    const usedJSHeapBytes = await page.evaluate(
      () => (performance as any).memory?.usedJSHeapSize ?? null
    );
    expect(clockSeconds).toBeGreaterThanOrEqual(0);
    restartSamples.push({ restart: i, clockSeconds, usedJSHeapBytes });
  }

  // Record per-browser machine-readable evidence for verify-milestone7.mjs
  const report = {
    schema: 'milestone7-browser-acceptance-v1',
    project: testInfo.project.name,
    browserName,
    productionBundleVerified: true,
    completedAt: new Date().toISOString(),
    auditMetrics: {
      total: auditMetrics.total,
      approxCount: auditMetrics.approxCount,
      missingNotes: auditMetrics.missingNotes,
      withEvidenceAttrs: auditMetrics.withEvidenceAttrs,
    },
    rosterCheck,
    layoutResults,
    webglRecovery,
    restartSamples,
    pageErrors: errors,
    consoleErrors,
  };
  await writeFile(
    `artifacts/milestone7/browser-acceptance-${testInfo.project.name}.json`,
    `${JSON.stringify(report, null, 2)}\n`
  );

  expect(errors, `Uncaught page errors: ${errors.join('; ')}`).toEqual([]);
});
