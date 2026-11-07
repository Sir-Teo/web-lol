// The dedicated config enables the production panel gate; controlled pack methods
// isolate UI ownership without claiming service-worker or cache verification.
import { test, expect, type Page } from '@playwright/test';

async function openPanel(page: Page, manifestOnFirstFailure = false) {
  await page.route('**/offline-retry-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><script type="module" src="/@vite/client"></script><main></main>',
    })
  );
  await page.goto('/offline-retry-probe');
  await page.evaluate(async (manifestOnFirstFailure) => {
    const [{ OfflinePack }, { mountOfflinePack }] = await Promise.all([
      import('/src/storage/offline-pack.ts'),
      import('/src/ui/offline-pack.ts'),
    ]);
    const state: any = {
      checks: 0,
      downloads: 0,
      pending: [],
      instance: null,
      manifest: {
        format: 1,
        id: 'a'.repeat(64),
        workerPolicySha256: 'b'.repeat(64),
        bytes: 100,
        files: [{ path: 'index.html', bytes: 100, sha256: 'c'.repeat(64) }],
      },
    };
    OfflinePack.prototype.check = async function () {
      state.instance = this;
      if (++state.checks === 1) {
        if (manifestOnFirstFailure) this.manifest = state.manifest;
        throw Error(
          manifestOnFirstFailure
            ? 'Cache temporarily unavailable'
            : 'Manifest temporarily unavailable'
        );
      }
      return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
    };
    OfflinePack.prototype.download = async function () {
      state.downloads++;
    };
    const dispose = mountOfflinePack(document.querySelector('main')!);
    (window as any).__OFFLINE_RETRY__ = { state, dispose };
  }, manifestOnFirstFailure);
}
async function finishCheck(page: Page, index: number, complete = false) {
  await page.evaluate(
    ({ index, complete }) => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      s.instance.manifest = s.manifest;
      s.pending[index].resolve({ complete, files: complete ? 1 : 0, bytes: complete ? 100 : 0 });
    },
    { index, complete }
  );
}
for (const outcome of ['success', 'failure after manifest'] as const)
  test(`offline manifest retry owns its pending check through ${outcome}`, async ({ page }) => {
    await openPanel(page);
    const retry = page.getByRole('button', { name: 'Retry pack check', exact: true });
    await expect(retry).toBeEnabled();
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-offline="download"]')!;
      button.click();
      button.click();
    });
    const pending = await page.evaluate(() => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      return { checks: s.checks, pending: s.pending.length, downloads: s.downloads };
    });
    expect(pending).toEqual({ checks: 2, pending: 1, downloads: 0 });
    await expect(retry).toBeDisabled();
    await expect(page.locator('.offline-status')).toHaveText('Checking offline files…');
    if (outcome === 'success') await finishCheck(page, 0);
    else
      await page.evaluate(() => {
        const s = (window as any).__OFFLINE_RETRY__.state;
        s.instance.manifest = s.manifest;
        s.pending[0].reject(Error('Cache temporarily unavailable'));
      });
    const action = page.locator('[data-offline="download"]');
    await expect(action).toBeEnabled();
    await expect(page.locator('.offline-status')).toContainText(
      outcome === 'success' ? '0.0 MB of verified files' : 'Cache temporarily unavailable'
    );
    if (outcome === 'failure after manifest') {
      await retry.click();
      expect(await page.evaluate(() => (window as any).__OFFLINE_RETRY__.state.downloads)).toBe(0);
      await finishCheck(page, 1);
      await expect(action).toHaveText('Download game pack');
      await expect(action).toBeEnabled();
    } else {
      await page.getByRole('button', { name: 'Download game pack', exact: true }).click();
      expect(await page.evaluate(() => (window as any).__OFFLINE_RETRY__.state.downloads)).toBe(1);
      await finishCheck(page, 1, true);
      await expect(action).toHaveText('Check and repair game pack');
      await expect(action).toBeEnabled();
      await expect(page.locator('[data-offline="cancel"]')).toBeHidden();
    }
    await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
  });
test('startup cache-check failure with a loaded manifest keeps an explicit check retry', async ({
  page,
}) => {
  await openPanel(page, true);
  const retry = page.getByRole('button', { name: 'Retry pack check', exact: true });
  await expect(page.locator('.offline-status')).toHaveText('Cache temporarily unavailable');
  await expect(retry).toBeEnabled();
  await retry.click();
  expect(await page.evaluate(() => (window as any).__OFFLINE_RETRY__.state.downloads)).toBe(0);
  await finishCheck(page, 0);
  await expect(page.getByRole('button', { name: 'Download game pack', exact: true })).toBeEnabled();
  await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
});
