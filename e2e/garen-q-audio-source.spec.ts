import { expect, test } from '@playwright/test';
import { GAREN_Q_AUDIO as P } from '../src/content/garen-q-audio';

test('Decisive Strike audition schedules both attack actions with source delay and stops the nonlooping active with its source fade', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    const calls = {
      start: [] as any[],
      stop: [] as any[],
      gain: [] as number[],
      gainTime: [] as number[],
      ramp: [] as any[],
    };
    (window as any).__Q_CALLS__ = calls;
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop,
      set = AudioParam.prototype.setValueAtTime,
      ramp = AudioParam.prototype.linearRampToValueAtTime;
    AudioBufferSourceNode.prototype.start = function (...args) {
      calls.start.push({ when: args[0] ?? 0, loop: this.loop, frames: this.buffer?.length });
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      calls.stop.push({ when: args[0] ?? 0 });
      return stop.apply(this, args);
    };
    AudioParam.prototype.setValueAtTime = function (value, time) {
      calls.gain.push(value);
      calls.gainTime.push(time);
      return set.call(this, value, time);
    };
    AudioParam.prototype.linearRampToValueAtTime = function (value, time) {
      calls.ramp.push({ value, time });
      return ramp.call(this, value, time);
    };
  });
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
  await expect(page.locator('article')).toHaveCount(5);
  await expect(page.locator('#status')).toContainText('13 source recordings');
  await page.getByLabel('Attack immediate variant').selectOption('2');
  await page.getByLabel('Attack delayed variant').selectOption('3');
  await page.getByRole('button', { name: 'Play attack event', exact: true }).click();
  const attack = await page.evaluate(() => (window as any).__Q_CALLS__);
  expect(attack.start).toHaveLength(2);
  expect(attack.start[1].when - attack.start[0].when).toBeCloseTo(0.23, 9);
  expect(attack.start.map((s: any) => s.frames)).toEqual([
    P.attack.variants[2].frames,
    P.attackDelayed.variants[3].frames,
  ]);
  expect(attack.start.every((s: any) => s.loop === false)).toBe(true);
  expect(attack.gain[0]).toBeCloseTo(0.2 * 10 ** (-12 / 20), 12);
  expect(attack.gain[1]).toBeCloseTo(0.2 * 10 ** (-14 / 20), 12);
  await page.getByLabel('Active variant', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Play active', exact: true }).click();
  const active = await page.evaluate(() => (window as any).__Q_CALLS__);
  expect(active.start.at(-1)).toMatchObject({ loop: false, frames: 346185 });
  expect(active.gain.at(-1)).toBeCloseTo(0.2 * 10 ** (-16 / 20), 12);
  await page.getByRole('button', { name: 'Stop active (250 ms)', exact: true }).click();
  const ended = await page.evaluate(() => (window as any).__Q_CALLS__);
  expect(ended.ramp.at(-1).value).toBe(0);
  expect(ended.stop.at(-1).when - ended.gainTime.at(-1)).toBeCloseTo(0.25, 9);
  await expect(page.locator('#status')).toContainText('250 ms linear fade');
  await page.getByRole('button', { name: 'Stop all', exact: true }).click();
  await page.screenshot({ path: 'artifacts/garen-q-audio-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('all thirteen Decisive Strike recordings decode with exact source floats, frames and headroom in Chrome', async ({
  page,
}) => {
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
  const variants = [P.cast, P.active, P.end, P.attack, P.attackDelayed].flatMap((p) => [
    ...p.variants,
  ]);
  const actual = await page.evaluate(async (variants) => {
    const buffers = (window as any).__GAREN_Q_AUDIO_PREVIEW__.buffers as Map<number, AudioBuffer>;
    return Promise.all(
      variants.map(async (v) => {
        const response = await fetch('/' + v.url),
          raw = await response.arrayBuffer();
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
        if (!source) throw new Error('Missing source float data');
        const buffer = buffers.get(v.id)!,
          pcm = buffer.getChannelData(0);
        let differences = 0,
          peak = 0;
        for (let i = 0; i < pcm.length; i++) {
          if (pcm[i] !== source[i]) differences++;
          peak = Math.max(peak, Math.abs(pcm[i]));
        }
        return {
          hash,
          differences,
          peak,
          frames: buffer.length,
          channels: buffer.numberOfChannels,
          rate: buffer.sampleRate,
        };
      })
    );
  }, variants);
  for (const [i, v] of variants.entries()) {
    expect(actual[i]).toEqual({
      hash: v.sha256,
      differences: 0,
      peak: v.peak,
      frames: v.frames,
      channels: 1,
      rate: 44100,
    });
  }
});

test('Q audio loads all thirteen masters only on Garen presence', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/garen-q-')) requests.push(r.url());
  });
  for (const url of ['/?scene=fixture', '/?scene=fixture&champion=garen']) {
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (url === '/?scene=fixture') expect(requests).toEqual([]);
  }
  expect(requests).toHaveLength(13);
  expect(new Set(requests.map((r) => new URL(r).pathname))).toEqual(
    new Set(
      [P.cast, P.active, P.end, P.attack, P.attackDelayed].flatMap((p) =>
        p.variants.map((v) => '/' + v.url)
      )
    )
  );
});
