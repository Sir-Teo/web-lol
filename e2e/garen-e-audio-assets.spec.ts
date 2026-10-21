import { expect, test } from '@playwright/test';
import { GAREN_E_AUDIO as P } from '../src/content/garen-e-audio';

test('all thirteen Judgment recordings decode with every float sample and headroom intact', async ({
  page,
}) => {
  await page.goto('/tools/qa/particle-color-preview.html');
  const variants = [P.cast, P.active, P.end, P.hit].flatMap((p) => p.variants);
  const result = await page.evaluate(async (variants) => {
    const context = new OfflineAudioContext(1, 1, 44100);
    return Promise.all(
      variants.map(async (v) => {
        const response = await fetch('/' + v.url);
        if (!response.ok) throw new Error(`Judgment audio ${response.status}`);
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
        const decoded = await context.decodeAudioData(raw.slice(0)),
          pcm = decoded.getChannelData(0);
        let differences = 0,
          peak = 0;
        for (let i = 0; i < pcm.length; i++) {
          if (pcm[i] !== source[i]) differences++;
          peak = Math.max(peak, Math.abs(pcm[i]));
        }
        return {
          hash,
          frames: pcm.length,
          sourceFrames: source.length,
          channels: decoded.numberOfChannels,
          rate: decoded.sampleRate,
          differences,
          peak,
        };
      })
    );
  }, variants);
  for (const [i, r] of result.entries()) {
    expect(r.hash).toBe(variants[i].sha256);
    expect(r.frames).toBe(variants[i].frames);
    expect(r.frames).toBe(r.sourceFrames);
    expect(r.channels).toBe(1);
    expect(r.rate).toBe(44100);
    expect(r.differences).toBe(0);
    expect(r.peak).toBe(variants[i].peak);
    expect(r.peak).toBeGreaterThan(1);
  }
});
