import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { GAREN_Q_AUDIO as P } from '../src/content/garen-q-audio';

test('Decisive Strike audition schedules both attack actions with source delay and stops the nonlooping active with its source fade', async ({
  page,
}, info) => {
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
  await page.screenshot({ path: info.outputPath('garen-q-audio-preview.png'), fullPage: true });
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

test('a valid WAV with altered source samples is refused before audition readiness', async ({
  page,
}, info) => {
  const clip = P.cast.variants[0],
    changed = Buffer.from(readFileSync('public/' + clip.url));
  let offset = 12;
  while (changed.toString('ascii', offset, offset + 4) !== 'data') {
    const length = changed.readUInt32LE(offset + 4);
    offset += 8 + length + (length % 2);
  }
  changed.writeFloatLE(0.125, offset + 8);
  await page.route('**/' + clip.url, (r) =>
    r.fulfill({ status: 200, contentType: 'audio/wav', body: changed })
  );
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(
    () =>
      (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready ||
      document.querySelector('#status')?.textContent?.includes('Unable to load')
  );
  expect(await page.evaluate(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__.ready)).toBe(false);
  await expect(page.locator('#status')).toContainText('Source WAV SHA-256 differs');
  await expect(page.getByRole('button', { name: 'Play activation', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('altered-source-refused.png'), fullPage: true });
});

for (const control of ['stop-all', 'stop-active', 'unrelated stop-active', 'hidden-tab'] as const)
  test(`pending context activation respects ${control} ownership`, async ({ page }, info) => {
    await page.addInitScript(() => {
      const state = { starts: [] as number[], release: null as null | (() => Promise<void>) };
      (window as any).__Q_PENDING_RESUME__ = state;
      const resume = AudioContext.prototype.resume,
        start = AudioBufferSourceNode.prototype.start;
      AudioContext.prototype.resume = function () {
        const context = this;
        return new Promise<void>((resolve, reject) => {
          state.release = async () => {
            try {
              await resume.call(context);
              resolve();
            } catch (error) {
              reject(error);
            }
          };
        });
      };
      AudioBufferSourceNode.prototype.start = function (...args) {
        state.starts.push(this.buffer?.length ?? 0);
        return start.apply(this, args);
      };
    });
    await page.goto('/tools/qa/garen-q-audio-preview.html');
    await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
    if (control === 'stop-active')
      await page.getByRole('button', { name: 'Play active', exact: true }).click();
    else await page.locator('#attack').click();
    await page.waitForFunction(
      () => typeof (window as any).__Q_PENDING_RESUME__.release === 'function'
    );
    if (control === 'hidden-tab')
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    else await page.locator(control === 'stop-all' ? '#stop-all' : '#stop-active').click();
    await page.evaluate(async () => {
      await (window as any).__Q_PENDING_RESUME__.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const starts = await page.evaluate(() => (window as any).__Q_PENDING_RESUME__.starts);
    expect(starts).toHaveLength(control === 'unrelated stop-active' ? 2 : 0);
    await page.locator('#stop-all').click();
    writeFileSync(
      info.outputPath('pending-resume-ownership.json'),
      JSON.stringify({ control, starts }, null, 2) + '\n'
    );
  });

test('hiding the audition stops playing voices without restarting them on return', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls = { starts: 0, stops: 0 };
    (window as any).__Q_VISIBILITY__ = calls;
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      calls.starts++;
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      calls.stops++;
      return stop.apply(this, args);
    };
  });
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
  await page.getByRole('button', { name: 'Play active', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__Q_VISIBILITY__.starts)).toBe(1);
  const visibility = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await visibility(false);
  expect(await page.evaluate(() => (window as any).__Q_VISIBILITY__)).toEqual({
    starts: 1,
    stops: 0,
  });
  await visibility(true);
  await expect(page.locator('#status')).toHaveText('Audition stopped.');
  expect(await page.evaluate(() => (window as any).__Q_VISIBILITY__)).toEqual({
    starts: 1,
    stops: 1,
  });
  await visibility(false);
  expect(await page.evaluate(() => (window as any).__Q_VISIBILITY__)).toEqual({
    starts: 1,
    stops: 1,
  });
});

async function monitorCalls(page: any, controlledClock = false) {
  await page.addInitScript((controlled: boolean) => {
    const calls = {
      starts: 0,
      sets: [] as { value: number; time: number }[],
      ramps: [] as { value: number; time: number }[],
      stops: [] as number[],
      clock: 100,
    };
    (window as any).__Q_MONITOR__ = calls;
    if (controlled)
      Object.defineProperty(AudioContext.prototype, 'currentTime', { get: () => calls.clock });
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop,
      set = AudioParam.prototype.setValueAtTime,
      ramp = AudioParam.prototype.linearRampToValueAtTime;
    AudioBufferSourceNode.prototype.start = function (...args) {
      calls.starts++;
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      calls.stops.push(args[0] ?? 0);
      return stop.apply(this, args);
    };
    AudioParam.prototype.setValueAtTime = function (value, time) {
      calls.sets.push({ value, time });
      return set.call(this, value, time);
    };
    AudioParam.prototype.linearRampToValueAtTime = function (value, time) {
      calls.ramps.push({ value, time });
      return ramp.call(this, value, time);
    };
  }, controlledClock);
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
}
async function changeMonitor(page: any, value: number) {
  await page.locator('#level').evaluate((input: HTMLInputElement, value: number) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
test('monitor control rescales both playing attack layers without restarting them', async ({
  page,
}) => {
  await monitorCalls(page);
  await page.locator('#attack').click();
  await page.waitForFunction(() => (window as any).__Q_MONITOR__.starts === 2);
  await changeMonitor(page, 0.6);
  const calls = await page.evaluate(() => (window as any).__Q_MONITOR__);
  expect(calls.starts).toBe(2);
  for (const [i, kind] of (['attack', 'attackDelayed'] as const).entries())
    expect(calls.sets.slice(-2)[i].value).toBeCloseTo(
      0.6 * 10 ** ((P[kind].gainDb + P[kind].variants[0].gainDb) / 20),
      12
    );
  await expect(page.locator('#level-value')).toHaveText('60%');
  await page.locator('#stop-all').click();
});
test('monitor control preserves the remaining active stop fade and its original deadline', async ({
  page,
}) => {
  await monitorCalls(page, true);
  await page.getByLabel('Active variant', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Play active', exact: true }).click();
  await page.waitForFunction(() => (window as any).__Q_MONITOR__.starts === 1);
  await page.locator('#stop-active').click();
  await page.evaluate(() => {
    (window as any).__Q_MONITOR__.clock = 100.1;
  });
  await changeMonitor(page, 0.4);
  const calls = await page.evaluate(() => (window as any).__Q_MONITOR__);
  const sourceGain = 10 ** ((P.active.gainDb + P.active.variants[1].gainDb) / 20);
  expect(calls.sets.at(-1).value).toBeCloseTo(0.4 * sourceGain * (0.15 / 0.25), 12);
  expect(calls.sets.at(-1).time).toBe(100.1);
  expect(calls.ramps.at(-1)).toEqual({ value: 0, time: 100.25 });
  expect(calls.stops).toEqual([100.25]);
  expect(calls.starts).toBe(1);
  await page.locator('#stop-all').click();
});

test('finite attack audition stays playing until its final layer ends and then reports completion', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { started: 0, ended: [] as number[] };
    (window as any).__Q_FINITE_STATUS__ = state;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const index = state.started++;
      this.addEventListener('ended', () => state.ended.push(index), { once: true });
      return start.apply(this, args);
    };
  });
  await page.goto('/tools/qa/garen-q-audio-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_Q_AUDIO_PREVIEW__?.ready);
  await page.locator('#attack').click();
  await page.waitForFunction(() => (window as any).__Q_FINITE_STATUS__.ended.includes(0));
  expect(await page.evaluate(() => (window as any).__Q_FINITE_STATUS__.ended)).toEqual([0]);
  await expect(page.locator('#status')).toContainText('Playing attack immediate + attack delayed');
  await page.waitForFunction(() => (window as any).__Q_FINITE_STATUS__.ended.includes(1));
  await expect(page.locator('#status')).toHaveText('Finished attack immediate + attack delayed.');
});
