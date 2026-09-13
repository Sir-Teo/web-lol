/** Verify prepared float source masters through Chrome's real Web Audio decoder. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = JSON.parse(await readFile('docs/reference/hawkshot-audio-decoded.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const media of inventory.media) {
    const bytes = await readFile(`.cache/hawkshot-audio-decoded/${media.id}.wav`);
    assert.equal(sha(bytes), media.wavSha256);
    const result = await page.evaluate(async ({ base64, rate }) => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const context = new OfflineAudioContext(1, 1, rate);
      const buffer = await context.decodeAudioData(bytes.buffer);
      // Re-interleave every sample; the Node caller compares the complete PCM
      // hash, including float headroom above 1, not just duration/metadata.
      const pcm = new Float32Array(buffer.length * buffer.numberOfChannels);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const channel = buffer.getChannelData(c);
        for (let i = 0; i < buffer.length; i++) pcm[i * buffer.numberOfChannels + c] = channel[i];
      }
      const raw = new Uint8Array(pcm.buffer);
      let binary = '';
      for (let i = 0; i < raw.length; i += 8192)
        binary += String.fromCharCode(...raw.subarray(i, i + 8192));
      return { frames: buffer.length, channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate, pcm: btoa(binary) };
    }, { base64: bytes.toString('base64'), rate: media.sampleRate });
    assert.equal(result.frames, media.frames);
    assert.equal(result.channels, media.channels);
    assert.equal(result.sampleRate, media.sampleRate);
    assert.equal(sha(Buffer.from(result.pcm, 'base64')), media.pcmSha256);
    console.log(`${media.id}: ${result.frames} frames; all decoded float samples match`);
  }
  console.log(`Verified ${inventory.media.length} recordings in ${browser.version()}`);
} finally {
  await browser.close();
}
