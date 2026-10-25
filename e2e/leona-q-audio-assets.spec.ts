import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { LEONA_Q_AUDIO as P } from '../src/content/leona-q-audio';

test('all thirteen Daybreak source masters, decode with every float sample and headroom intact', async ({
  page,
}, info) => {
  await page.goto('/tools/qa/particle-color-preview.html');
  const variants = [
    ...P.cast.variants,
    ...P.attack.variants,
    ...P.hit.variants,
    ...P.buff.variants,
  ];
  const result = await page.evaluate(async (variants) => {
    const context = new OfflineAudioContext(1, 1, 44100);
    return Promise.all(
      variants.map(async (v) => {
        const response = await fetch('/' + v.url);
        if (!response.ok) throw new Error(`Daybreak audio ${response.status}`);
        const raw = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))]
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('');
        const view = new DataView(raw);
        let source: Float32Array | undefined;
        for (let offset = 12; offset < raw.byteLength;) {
          const tag = String.fromCharCode(...new Uint8Array(raw, offset, 4)),
            size = view.getUint32(offset + 4, true);
          if (tag === 'data') source = new Float32Array(raw.slice(offset + 8, offset + 8 + size));
          offset += 8 + size + (size % 2);
        }
        if (!source) throw new Error('Missing float samples');
        const decoded = await context.decodeAudioData(raw.slice(0));
        let differences = 0,
          peak = 0;
        for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
          const pcm = decoded.getChannelData(channel);
          for (let i = 0; i < pcm.length; i++) {
            if (pcm[i] !== source[i * decoded.numberOfChannels + channel]) differences++;
            peak = Math.max(peak, Math.abs(pcm[i]));
          }
        }
        return {
          hash,
          frames: decoded.length,
          sourceFrames: source.length / decoded.numberOfChannels,
          channels: decoded.numberOfChannels,
          rate: decoded.sampleRate,
          differences,
          peak,
        };
      })
    );
  }, variants);
  writeFileSync(info.outputPath('decoded-samples.json'), JSON.stringify(result, null, 2));
  expect(result).toHaveLength(13);
  for (const [i, r] of result.entries()) {
    expect(r.hash).toBe(variants[i].sha256);
    expect(r.frames).toBe(variants[i].frames);
    expect(r.frames).toBe(r.sourceFrames);
    expect(r.channels).toBe(variants[i].channels);
    expect(r.rate).toBe(44100);
    expect(r.differences).toBe(0);
    expect(r.peak).toBe(variants[i].peak);
    expect(r.peak).toBeGreaterThan(0);
  }
});

test('ordinary Ashe loads no unrequested Daybreak source table or masters', async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (
      /\/src\/(?:audio\/leona-q(?:-state)?\.ts|content\/leona-q-audio\.ts)|\/assets\/audio\/leona-q-/.test(
        request.url()
      )
    )
      requests.push(request.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  writeFileSync(
    info.outputPath('ordinary-load.json'),
    JSON.stringify({ requests }, null, 2) + '\n'
  );
});
