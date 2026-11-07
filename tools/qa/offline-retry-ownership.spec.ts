// The dedicated config enables the production panel gate; controlled pack methods
// isolate UI ownership without claiming service-worker or cache verification.
import { test, expect } from '@playwright/test';

for (const outcome of ['success', 'failure after manifest'] as const)
  test(`offline manifest retry owns its pending check through ${outcome}`, async ({ page }) => {
    await page.route('**/offline-retry-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><script type="module" src="/@vite/client"></script><main></main>',
      })
    );
    await page.goto('/offline-retry-probe');
    await page.evaluate(async () => {
      const [{ OfflinePack }, { mountOfflinePack }] = await Promise.all([
        import('/src/storage/offline-pack.ts'),
        import('/src/ui/offline-pack.ts'),
      ]);
      const state: any = { checks: 0, downloads: 0, pending: [], instance: null };
      OfflinePack.prototype.check = async function () {
        state.instance = this;
        if (++state.checks === 1) throw Error('Manifest temporarily unavailable');
        return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
      };
      OfflinePack.prototype.download = async function () {
        state.downloads++;
      };
      const dispose = mountOfflinePack(document.querySelector('main')!);
      (window as any).__OFFLINE_RETRY__ = { state, dispose };
    });
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
    await page.evaluate((outcome) => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      s.instance.manifest = {
        format: 1,
        id: 'a'.repeat(64),
        workerPolicySha256: 'b'.repeat(64),
        bytes: 100,
        files: [{ path: 'index.html', bytes: 100, sha256: 'c'.repeat(64) }],
      };
      if (outcome === 'success') s.pending[0].resolve({ complete: false, files: 0, bytes: 0 });
      else s.pending[0].reject(Error('Cache temporarily unavailable'));
    }, outcome);
    await expect(page.locator('[data-offline="download"]')).toBeEnabled();
    await expect(page.locator('.offline-status')).toContainText(
      outcome === 'success' ? '0.0 MB of verified files' : 'Cache temporarily unavailable'
    );
    expect(await page.evaluate(() => (window as any).__OFFLINE_RETRY__.state.downloads)).toBe(0);
    await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
  });
