import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { OfflinePack, parseOfflineManifest } from '../src/storage/offline-pack';

const base = new URL('https://rift.test/nested/rift/');
function fixture() {
  const bodies = new Map([
    ['index.html', '<p>Rift</p>'],
    ['assets/game.js', 'export const tick = 60;'],
    ['assets/model.bin', 'source rig'],
  ]);
  const files = [...bodies].map(([path, body]) => ({
    path,
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
  }));
  const manifest = {
    format: 1,
    id: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    workerPolicySha256: 'a'.repeat(64),
    bytes: files.reduce((s, f) => s + f.bytes, 0),
    files,
  };
  const caches = new Map<string, Map<string, Response>>();
  const key = (input: RequestInfo | URL) =>
    input instanceof Request ? input.url : new URL(String(input), base).href;
  const storage = {
    open: vi.fn(async (name: string) => {
      const entries = caches.get(name) ?? new Map();
      caches.set(name, entries);
      return {
        put: vi.fn(async (url: RequestInfo | URL, response: Response) => {
          entries.set(key(url), response.clone());
        }),
        match: vi.fn(async (url: RequestInfo | URL) => entries.get(key(url))?.clone()),
        delete: vi.fn(async (url: RequestInfo | URL) => entries.delete(key(url))),
        keys: vi.fn(async () => [...entries.keys()].map((url) => new Request(url))),
      } as unknown as Cache;
    }),
    keys: vi.fn(async () => [...caches.keys()]),
    delete: vi.fn(async (name: string) => caches.delete(name)),
  } as unknown as CacheStorage;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const name = new URL(key(input)).pathname.replace('/nested/rift/', '');
    if (name === 'offline-pack.json') return Response.json(manifest);
    const body = bodies.get(name);
    return new Response(body ?? 'missing', {
      status: body ? 200 : 404,
      headers: { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : 'text/html' },
    });
  });
  const enable = vi.fn(async () => {});
  const pack = new OfflinePack(base, { storage, fetch: fetcher as typeof fetch, enable });
  return { pack, storage, caches, fetcher, manifest, enable, bodies };
}

test('only a fully verified pack receives a ready marker and enables offline startup', async () => {
  const f = fixture();
  expect(await f.pack.check()).toEqual({ complete: false, files: 0, bytes: 0 });
  const progress = vi.fn();
  await f.pack.download(progress);
  expect(f.enable).toHaveBeenCalledOnce();
  expect(await f.pack.check()).toEqual({ complete: true, files: 3, bytes: f.manifest.bytes });
  expect(progress).toHaveBeenLastCalledWith({
    completed: 3,
    total: 3,
    bytes: f.manifest.bytes,
    totalBytes: f.manifest.bytes,
  });
  expect(
    f.caches
      .get(f.pack.cacheName)!
      .get(new URL('assets/game.js', base).href)!
      .headers.get('content-type')
  ).toBe('text/javascript');
});

test('cancellation keeps verified entries and resumes without redownloading them', async () => {
  const f = fixture();
  await f.pack.check();
  await expect(
    f.pack.download((p) => {
      if (p.completed === 1) f.pack.cancel();
    })
  ).rejects.toThrow(/cancelled/);
  expect(f.pack.busy).toBe(false);
  expect(f.enable).not.toHaveBeenCalled();
  expect(await f.pack.check()).toEqual({
    complete: false,
    files: 1,
    bytes: f.manifest.files[0].bytes,
  });
  const count = f.fetcher.mock.calls.length;
  await f.pack.download(() => {});
  expect(f.fetcher.mock.calls.length - count).toBe(2);
  expect((await f.pack.check()).complete).toBe(true);
});

test('wrong bytes never create a ready marker and retry repairs only missing files', async () => {
  const f = fixture();
  await f.pack.check();
  f.bodies.set('assets/game.js', 'changed version');
  await expect(f.pack.download(() => {})).rejects.toThrow(/verification/);
  expect(f.enable).not.toHaveBeenCalled();
  expect((await f.pack.check()).complete).toBe(false);
  f.bodies.set('assets/game.js', 'export const tick = 60;');
  const count = f.fetcher.mock.calls.length;
  await f.pack.download(() => {});
  expect(f.fetcher.mock.calls.length - count).toBe(2);
  const entries = f.caches.get(f.pack.cacheName)!;
  entries.delete(new URL('assets/model.bin', base).href);
  expect((await f.pack.check()).complete).toBe(false);
  expect(entries.has(new URL('.offline-complete', base).href)).toBe(false);
});

test('registration failure reports unavailable offline startup, with reusable verified data', async () => {
  const f = fixture();
  await f.pack.check();
  f.enable.mockRejectedValueOnce(new Error('blocked'));
  await expect(f.pack.download(() => {})).rejects.toThrow(/startup could not be enabled/);
  const count = f.fetcher.mock.calls.length;
  await f.pack.download(() => {});
  expect(f.fetcher.mock.calls.length).toBe(count);
});

test('HTTP failure and quota exhaustion never enable an incomplete pack', async () => {
  const f = fixture();
  await f.pack.check();
  f.fetcher.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
  await expect(f.pack.download(() => {})).rejects.toThrow(/Could not download/);
  expect(f.enable).not.toHaveBeenCalled();
  const cache = await f.storage.open(f.pack.cacheName);
  const original = f.storage.open;
  f.storage.open = async () =>
    ({
      ...cache,
      put: async () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    }) as Cache;
  await expect(f.pack.download(() => {})).rejects.toThrow(/storage is full/);
  f.storage.open = original;
  expect((await f.pack.check()).complete).toBe(false);
});

test('unsafe paths, duplicates, mismatched byte totals and unsupported formats are rejected', () => {
  const f = fixture();
  for (const path of [
    '../escape',
    'https://other.test/file',
    '/root',
    'assets//a',
    'assets/./a',
    'a?b',
    'a#b',
    'a%2fb',
  ]) {
    const invalid = structuredClone(f.manifest);
    invalid.files[0].path = path;
    expect(() => parseOfflineManifest(invalid)).toThrow(/invalid/);
  }
  for (const change of [
    (p: any) => p.files.push(p.files[0]),
    (p: any) => p.bytes++,
    (p: any) => (p.format = 2),
    (p: any) => (p.files[0].sha256 = 'bad'),
    (p: any) => (p.files[0].bytes = -1),
  ]) {
    const invalid = structuredClone(f.manifest);
    change(invalid);
    expect(() => parseOfflineManifest(invalid)).toThrow(/invalid/);
  }
});

test('new versions reuse unchanged verified files from the same scope without network transfers', async () => {
  const f = fixture();
  await f.pack.check();
  await f.pack.download(() => {});
  const old = f.pack.cacheName;
  f.manifest.id = 'b'.repeat(64);
  f.manifest.workerPolicySha256 = 'c'.repeat(64);
  await f.pack.check();
  const count = f.fetcher.mock.calls.length;
  await f.pack.download(() => {});
  expect(f.fetcher.mock.calls.length).toBe(count);
  expect(f.caches.has(old)).toBe(true);
  expect((await f.pack.check()).complete).toBe(true);
});

test('repair rehashes cached bodies even when stale verification headers still match', async () => {
  const f = fixture();
  await f.pack.check();
  await f.pack.download(() => {});
  const cache = await f.storage.open(f.pack.cacheName);
  const url = new URL('assets/model.bin', base);
  const original = (await cache.match(url))!;
  await cache.put(url, new Response('broken rig', { headers: original.headers }));
  const count = f.fetcher.mock.calls.length;
  await f.pack.download(() => {});
  expect(f.fetcher.mock.calls.length - count).toBe(1);
  expect(await (await cache.match(url))!.text()).toBe('source rig');
});

test('checking a valid pack keeps it usable by other tabs, including after cancellation', async () => {
  const f = fixture();
  await f.pack.check();
  await f.pack.download(() => {});
  await expect(
    f.pack.download((p) => {
      expect(f.caches.get(f.pack.cacheName)!.has(new URL('.offline-complete', base).href)).toBe(
        true
      );
      if (p.completed === 1) f.pack.cancel();
    })
  ).rejects.toThrow(/cancelled/);
  expect((await f.pack.check()).complete).toBe(true);
});
