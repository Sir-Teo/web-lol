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
      await expect(page.locator('[data-offline="cancel"]')).toBeFocused();
      expect(await page.evaluate(() => (window as any).__OFFLINE_RETRY__.state.downloads)).toBe(1);
      await finishCheck(page, 1, true);
      await expect(action).toHaveText('Check and repair game pack');
      await expect(action).toBeEnabled();
      await expect(page.locator('[data-offline="cancel"]')).toBeHidden();
      await expect(action).toBeFocused();
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

test('real pack inspection recovers from cache-open failure without fetching pack files', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.addInitScript(() => {
    const state = { opens: 0 };
    (window as any).__OFFLINE_CACHE_BOUNDARY__ = state;
    const open = caches.open.bind(caches);
    caches.open = async (name: string) => {
      if (++state.opens === 1) throw Error('Cache temporarily unavailable');
      return open(name);
    };
  });
  await page.route('**/offline-pack.json', (route) =>
    route.fulfill({
      json: {
        format: 1,
        id: 'a'.repeat(64),
        workerPolicySha256: 'b'.repeat(64),
        bytes: 100,
        files: [{ path: 'index.html', bytes: 100, sha256: 'c'.repeat(64) }],
      },
    })
  );
  await page.route('**/offline-real-check-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><script type="module" src="/@vite/client"></script><main></main>',
    })
  );
  await page.goto('/offline-real-check-probe');
  await page.evaluate(async () => {
    const { mountOfflinePack } = await import('/src/ui/offline-pack.ts');
    (window as any).__OFFLINE_REAL_DISPOSE__ = mountOfflinePack(document.querySelector('main')!);
  });
  await expect(page.locator('.offline-status')).toHaveText('Cache temporarily unavailable');
  const retry = page.getByRole('button', { name: 'Retry pack check', exact: true });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByRole('button', { name: 'Download game pack', exact: true })).toBeEnabled();
  await expect(page.locator('.offline-status')).toContainText('0.0 MB of verified files');
  expect(await page.evaluate(() => (window as any).__OFFLINE_CACHE_BOUNDARY__.opens)).toBe(2);
  expect(requests.filter((path) => path === '/offline-pack.json')).toHaveLength(2);
  expect(requests).not.toContain('/index.html');
  await page.evaluate(() => (window as any).__OFFLINE_REAL_DISPOSE__());
});

for (const outcome of ['success', 'failure'] as const)
  test(`offline removal owns download and reload controls through ${outcome}`, async ({ page }) => {
    await openPanel(page);
    await page.getByRole('button', { name: 'Retry pack check', exact: true }).click();
    await finishCheck(page, 0, true);
    await expect(page.locator('[data-offline="reload"]')).toBeVisible();
    await page.evaluate(() => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      s.removes = 0;
      s.reloads = 0;
      s.instance.remove = async () => {
        s.removes++;
        await new Promise<void>((resolve, reject) => {
          s.finishRemove = resolve;
          s.failRemove = reject;
        });
      };
      s.instance.reload = async () => {
        s.reloads++;
      };
    });
    await page.getByRole('button', { name: 'Remove offline files', exact: true }).click();
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-offline="reload"]')!.click();
      document.querySelector<HTMLButtonElement>('[data-offline="download"]')!.click();
    });
    expect(
      await page.evaluate(() => {
        const s = (window as any).__OFFLINE_RETRY__.state;
        return { removes: s.removes, downloads: s.downloads, reloads: s.reloads };
      })
    ).toEqual({ removes: 1, downloads: 0, reloads: 0 });
    await expect(page.locator('.offline-status')).toHaveText('Removing offline files…');
    for (const action of ['remove', 'download', 'reload'])
      await expect(page.locator(`[data-offline="${action}"]`)).toBeDisabled();
    await page.evaluate((outcome) => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      if (outcome === 'success') s.finishRemove();
      else s.failRemove(Error('Cached files could not be removed'));
    }, outcome);
    await expect(page.locator('[data-offline="remove"]')).toBeEnabled();
    await expect(page.locator('[data-offline="download"]')).toBeEnabled();
    if (outcome === 'success') {
      await expect(page.locator('.offline-status')).toHaveText(
        'Offline files removed. Saved matches were kept.'
      );
      await expect(page.locator('[data-offline="reload"]')).toBeHidden();
    } else {
      await expect(page.locator('.offline-status')).toHaveText('Cached files could not be removed');
      await expect(page.locator('[data-offline="reload"]')).toBeEnabled();
    }
    await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
  });

for (const outcome of ['success', 'failure'] as const)
  test(`offline reload owns the panel actions through ${outcome}`, async ({ page }) => {
    await openPanel(page);
    await page.getByRole('button', { name: 'Retry pack check', exact: true }).click();
    await finishCheck(page, 0, true);
    await expect(page.locator('[data-offline="reload"]')).toBeVisible();
    await page.evaluate(() => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      s.reloads = 0;
      s.removes = 0;
      s.instance.reload = async () => {
        s.reloads++;
        await new Promise<void>((resolve, reject) => {
          s.finishReload = resolve;
          s.failReload = reject;
        });
      };
      s.instance.remove = async () => {
        s.removes++;
      };
    });
    await page.getByRole('button', { name: 'Reload cached game', exact: true }).click();
    await expect(page.locator('.offline-status')).toHaveText('Preparing cached game reload…');
    for (const action of ['download', 'remove', 'reload'])
      await expect(page.locator(`[data-offline="${action}"]`)).toBeDisabled();
    await page.evaluate(() => {
      for (const name of ['reload', 'remove', 'download'])
        document.querySelector<HTMLButtonElement>(`[data-offline="${name}"]`)!.click();
    });
    expect(
      await page.evaluate(() => {
        const s = (window as any).__OFFLINE_RETRY__.state;
        return { reloads: s.reloads, removes: s.removes, downloads: s.downloads };
      })
    ).toEqual({ reloads: 1, removes: 0, downloads: 0 });
    await page.evaluate((outcome) => {
      const s = (window as any).__OFFLINE_RETRY__.state;
      if (outcome === 'success') s.finishReload();
      else s.failReload(Error('Cached game could not be activated'));
    }, outcome);
    for (const action of ['download', 'remove', 'reload'])
      await expect(page.locator(`[data-offline="${action}"]`)).toBeEnabled();
    if (outcome === 'failure')
      await expect(page.locator('.offline-status')).toHaveText(
        'Cached game could not be activated'
      );
    await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
  });

for (const operation of ['check', 'remove', 'reload'] as const)
  test(`busy offline action ${operation} keeps keyboard focus in the panel`, async ({ page }) => {
    await openPanel(page);
    if (operation !== 'check') {
      await page.getByRole('button', { name: 'Retry pack check', exact: true }).click();
      await finishCheck(page, 0, true);
      await expect(page.locator('[data-offline="reload"]')).toBeVisible();
      await page.evaluate((operation) => {
        const s = (window as any).__OFFLINE_RETRY__.state;
        s.instance[operation] = async () =>
          new Promise<void>((resolve, reject) => {
            s.finishAction = resolve;
            s.failAction = reject;
          });
      }, operation);
    }
    const action = page.locator(
      `[data-offline="${operation === 'check' ? 'download' : operation}"]`
    );
    await action.focus();
    await action.click();
    expect(
      await page.evaluate(() => document.querySelector('main')!.contains(document.activeElement))
    ).toBe(true);
    await expect(page.locator('.offline-status')).toBeFocused();
    if (operation === 'check') await finishCheck(page, 0);
    else
      await page.evaluate(() =>
        (window as any).__OFFLINE_RETRY__.state.failAction(
          Error('Operation temporarily unavailable')
        )
      );
    await expect(action).toBeEnabled();
    await expect(action).toBeFocused();
    await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
  });

test('completing an offline check does not take focus from another control', async ({ page }) => {
  await openPanel(page);
  await page.getByRole('button', { name: 'Retry pack check', exact: true }).click();
  await expect(page.locator('.offline-status')).toBeFocused();
  await page.evaluate(() => {
    const back = document.createElement('button');
    back.id = 'elsewhere';
    back.textContent = 'Different control';
    document.querySelector('main')!.after(back);
  });
  const elsewhere = page.getByRole('button', { name: 'Different control', exact: true });
  await elsewhere.click();
  await finishCheck(page, 0);
  await expect(page.getByRole('button', { name: 'Download game pack', exact: true })).toBeEnabled();
  await expect(elsewhere).toBeFocused();
  await page.evaluate(() => (window as any).__OFFLINE_RETRY__.dispose());
});
