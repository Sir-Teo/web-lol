import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
for (const mode of ['gzip', 'decoded', 'corrupt'])
  test(`geometry transport validates ${mode} bytes and shares one buffer request`, async ({
    page,
  }) => {
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    let requests = 0;
    const manifest = {
      source: {
        uri: 'rift-geometry.bin',
        bytes: 8,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      gzip: { uri: 'rift-geometry.bin.gz', bytes: 28, sha256: '0'.repeat(64) },
    };
    await page.route('**/transport-test/rift-geometry-gzip.json', (route) =>
      route.fulfill({ json: manifest })
    );
    await page.route('**/transport-test/rift-geometry.bin.gz', (route) => {
      requests++;
      return route.fulfill({
        contentType: 'application/octet-stream',
        body: mode === 'gzip' ? gzipSync(bytes) : mode === 'corrupt' ? Buffer.alloc(8) : bytes,
      });
    });
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate(async () => {
      (window as any).__GAME__.setPaused(true);
      const { installMapGeometryTransport } = await import('/src/render/map-geometry-transport.ts');
      let factory: any;
      await installMapGeometryTransport(
        {
          register: (f: any) => {
            factory = f;
          },
        } as any,
        '/transport-test/'
      );
      const plugin = factory({
        json: {
          buffers: [
            { uri: 'rift-geometry.bin', byteLength: 8 },
            { uri: 'other.bin', byteLength: 8 },
          ],
          bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: 4 },
            { buffer: 0, byteOffset: 4, byteLength: 4 },
            { buffer: 1, byteLength: 4 },
            { buffer: 0, byteOffset: 7, byteLength: 4 },
          ],
        },
      });
      const fallback = plugin.loadBufferView(2);
      let invalid = '';
      try {
        plugin.loadBufferView(3);
      } catch (e) {
        invalid = String(e);
      }
      try {
        const buffers = await Promise.all([plugin.loadBufferView(0), plugin.loadBufferView(1)]);
        return {
          fallback,
          invalid,
          buffers: buffers.map((b) => [...new Uint8Array(b)]),
          error: '',
        };
      } catch (e) {
        return { fallback, invalid, buffers: [], error: String(e) };
      }
    });
    expect(requests).toBe(1);
    expect(result.fallback).toBe(null);
    expect(result.invalid).toContain('Invalid map geometry buffer view');
    if (mode === 'corrupt') expect(result.error).toContain('Map geometry hash mismatch');
    else {
      expect(result.error).toBe('');
      expect(result.buffers).toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]);
    }
  });
