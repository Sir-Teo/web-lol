import { expect, test } from '@playwright/test';
import { LUX_ILLUMINATION_AUDIO } from '../src/content/lux-illumination-audio';

test('browser decodes all passive recordings without losing float headroom or samples', async ({
  page,
}) => {
  await page.goto('/tools/qa/lux-illumination-trigger.html');
  const result = await page.evaluate(async (variants) => {
    const decoder = new OfflineAudioContext(1, 1, 44100);
    return Promise.all(
      variants.map(async (variant) => {
        const response = await fetch('/' + variant.url);
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        const encoded = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))]
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
        const view = new DataView(encoded);
        let data: Float32Array | undefined;
        for (let offset = 12; offset < encoded.byteLength;) {
          const tag = String.fromCharCode(...new Uint8Array(encoded, offset, 4));
          const size = view.getUint32(offset + 4, true);
          if (tag === 'data') data = new Float32Array(encoded.slice(offset + 8, offset + 8 + size));
          offset += 8 + size + (size % 2);
        }
        if (!data) throw new Error('Missing PCM payload');
        const decoded = await decoder.decodeAudioData(encoded.slice(0));
        const pcm = decoded.getChannelData(0);
        let differences = 0,
          peak = 0;
        for (let i = 0; i < pcm.length; i++) {
          if (pcm[i] !== data[i]) differences++;
          peak = Math.max(peak, Math.abs(pcm[i]));
        }
        return {
          hash,
          frames: pcm.length,
          sourceFrames: data.length,
          rate: decoded.sampleRate,
          channels: decoded.numberOfChannels,
          duration: decoded.duration,
          differences,
          peak,
        };
      })
    );
  }, LUX_ILLUMINATION_AUDIO.variants);
  result.forEach((recording, index) => {
    expect(recording.hash).toBe(LUX_ILLUMINATION_AUDIO.variants[index].sha256);
    expect(recording.duration).toBe(LUX_ILLUMINATION_AUDIO.variants[index].durationSeconds);
    expect(recording.frames).toBe(recording.sourceFrames);
    expect(recording.rate).toBe(44100);
    expect(recording.channels).toBe(1);
    expect(recording.differences).toBe(0);
    expect(recording.peak).toBeGreaterThan(1);
  });
});
