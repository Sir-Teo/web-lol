import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { GAREN_P_AUDIO as P } from '../src/content/garen-p-audio';
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});
async function open(page: Page, reset = true) {
  if (reset) {
    await page.goto('/?scene=fixture&champion=garen');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  }
  await page.evaluate(async (reset) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    if (reset) {
      w.units = [w.hero];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
      w.setOrder(w.hero, { type: 'idle' });
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.setPaused(false);
    await a.transition;
    const sound = a.garenP.controller,
      probe = {
        calls: [] as any[],
        synth: 0,
        update: () => a.updateGaren(w),
        state: () =>
          [...sound.voices.values()].map((v: any) => ({
            kind: v.kind,
            loop: v.source.loop,
            loopStart: v.source.loopStart,
            loopEnd: v.source.loopEnd,
            frames: v.source.buffer.length,
            sets: v.envelope.values,
            ramps: v.envelope.ramps,
            spatial: v.spatial.gain.value,
          })),
      };
    const source = a.context.createBufferSource.bind(a.context),
      gain = a.context.createGain.bind(a.context),
      osc = a.context.createOscillator.bind(a.context);
    a.context.createGain = () => {
      const n = gain(),
        set = n.gain.setValueAtTime.bind(n.gain),
        ramp = n.gain.linearRampToValueAtTime.bind(n.gain);
      n.values = [];
      n.ramps = [];
      n.gain.setValueAtTime = (v: number, t: number) => {
        n.values.push([v, t]);
        return set(v, t);
      };
      n.gain.linearRampToValueAtTime = (v: number, t: number) => {
        n.ramps.push([v, t]);
        return ramp(v, t);
      };
      return n;
    };
    a.context.createBufferSource = () => {
      const n = source(),
        start = n.start.bind(n);
      n.start = (when: number, offset: number) => {
        const kind = Object.keys(sound.buffers).find((k) => sound.buffers[k] === n.buffer);
        if (kind) probe.calls.push({ kind, when, offset, loop: n.loop, frames: n.buffer.length });
        return start(when, offset);
      };
      return n;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return osc();
    };
    (window as any).__P_AUDIO__ = probe;
  }, reset);
}

test('both source masters decode with exact float samples, frames and headroom in Chrome', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(
    async (profiles) => {
      const sound = (window as any).__GAME__.audio.garenP.controller;
      return Promise.all(
        profiles.map(async ({ kind, clip }) => {
          const raw = await (await fetch('/' + clip.url)).arrayBuffer(),
            view = new DataView(raw);
          let data: ArrayBuffer | undefined;
          for (let i = 12; i < raw.byteLength;) {
            const tag = String.fromCharCode(...new Uint8Array(raw, i, 4)),
              size = view.getUint32(i + 4, true);
            if (tag === 'data') data = raw.slice(i + 8, i + 8 + size);
            i += 8 + size + (size % 2);
          }
          if (!data) throw Error('Missing float PCM');
          const source = new Float32Array(data),
            buffer = sound.buffers[kind],
            pcm = buffer.getChannelData(0);
          let differences = 0,
            peak = 0;
          for (let i = 0; i < pcm.length; i++) {
            if (pcm[i] !== source[i]) differences++;
            peak = Math.max(peak, Math.abs(pcm[i]));
          }
          const digest = async (b: ArrayBuffer) =>
            [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('');
          return {
            kind,
            frames: buffer.length,
            rate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            differences,
            peak,
            wav: await digest(raw),
            pcm: await digest(data),
          };
        })
      );
    },
    (['onset', 'active'] as const).map((kind) => ({ kind, clip: P[kind].clip }))
  );
  for (const r of result) {
    const clip = P[r.kind as 'onset' | 'active'].clip;
    expect(r).toMatchObject({
      frames: clip.frames,
      rate: 44100,
      channels: 1,
      differences: 0,
      peak: clip.peak,
      wav: clip.sha256,
      pcm: clip.pcmSha256,
    });
  }
  writeFileSync('artifacts/garen-p-audio-decoding.json', JSON.stringify(result, null, 2) + '\n');
});

test('actual recovery schedules both source actions, partial fade-in stop and listener gain independently', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__P_AUDIO__;
    w.hero.hp -= 300;
    w.step(16);
    p.update();
    p.update();
    const begin = p.state(),
      calls = p.calls.slice();
    // A minion does not interrupt the passive. Full healing exercises its actual stop policy.
    const minion = w.spawn('melee', 'red', { x: 200, y: 0 });
    minion.ai = false;
    w.damage(minion, w.hero, 1, 'true');
    p.update();
    const minionHeld = w.player.garenPassiveVisuals.at(-1).stopTick === null;
    w.hero.hp = w.hero.maxHp;
    w.step();
    w.step(14);
    p.update();
    const end = p.state();
    const active = [...a.garenP.controller.voices.values()].find(
      (v: any) => v.kind === 'active'
    ) as any;
    const ramps = active.envelope.ramps.length;
    a.updateGaren(w, { x: 1515, y: 0 });
    return {
      begin,
      calls,
      minionHeld,
      end,
      moved: {
        sameRamps: active.envelope.ramps.length === ramps,
        spatial: active.spatial.gain.value,
      },
      synth: p.synth,
    };
  });
  expect(result.calls.map((c: any) => c.kind)).toEqual(['onset', 'active']);
  expect(result.calls[0].when).toBe(result.calls[1].when);
  const active = result.begin.find((v: any) => v.kind === 'active')!;
  expect(active).toMatchObject({
    loop: true,
    loopStart: 0,
    loopEnd: P.active.clip.durationSeconds,
    frames: P.active.clip.frames,
  });
  expect(active.sets[0][0]).toBe(0.5);
  expect(active.ramps[0][0]).toBe(1);
  const end = result.end.find((v: any) => v.kind === 'active')!;
  expect(end.sets.at(-1)[0]).toBeCloseTo((16 / 30) * (1 - 14 / 60));
  expect(end.ramps.at(-1)[0]).toBe(0);
  expect(result.minionHeld).toBe(true);
  expect(result.moved.sameRamps).toBe(true);
  expect(result.synth).toBe(0);
  writeFileSync('artifacts/garen-p-audio-scheduling.json', JSON.stringify(result, null, 2) + '\n');
});

test('pause/mute, a saved stopped onset and real reload preserve original source offsets', async ({
  page,
}) => {
  await open(page);
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__P_AUDIO__;
    w.hero.hp -= 300;
    w.step();
    w.hero.hp = w.hero.maxHp;
    w.step(190);
    p.update();
    const offset = p.calls[0].offset;
    a.setPaused(true);
    await a.transition;
    const paused = a.context.state;
    a.setPaused(false);
    await a.transition;
    p.update();
    const noPauseDuplicate = p.calls.length === 1;
    a.enabled = false;
    const muted = a.garenP.controller.voices.size;
    a.enabled = true;
    p.update();
    return {
      offset,
      paused,
      noPauseDuplicate,
      muted,
      resumed: p.calls.at(-1),
      snapshot: w.snapshot(),
      records: w.player.garenPassiveVisuals.length,
    };
  });
  expect(prepared.offset).toBeCloseTo(190 / 60);
  expect(prepared.paused).toBe('suspended');
  expect(prepared.noPauseDuplicate).toBe(true);
  expect(prepared.muted).toBe(0);
  expect(prepared.records).toBe(1);
  expect(prepared.resumed).toMatchObject({ kind: 'onset', loop: false, offset: 190 / 60 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(restored).toBe(prepared.snapshot);
  await open(page, false);
  const calls = await page.evaluate(() => {
    const p = (window as any).__P_AUDIO__;
    p.update();
    return p.calls;
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ kind: 'onset', offset: 190 / 60 });
  writeFileSync(
    'artifacts/garen-p-audio-reload.json',
    JSON.stringify(
      { prepared: { ...prepared, snapshot: undefined }, restored: true, calls },
      null,
      2
    ) + '\n'
  );
});

test('enemy fog hides both phases and returns only the current loop phase without audio asset retries', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (r) => {
    if (/garen-p-\d+\.wav$/.test(r.url())) requests++;
  });
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__P_AUDIO__,
      unit = w.spawn('champion', 'red', { x: 200, y: 0 }, 'garen');
    unit.hp -= 500;
    w.step(100);
    const visible = w.visible.bind(w),
      points = w.pointVisible.bind(w);
    w.visible = (u: any, t: any) => (u.id === unit.id ? false : visible(u, t));
    w.pointVisible = () => false;
    p.update();
    const hidden = p.calls.length;
    w.step(300);
    w.visible = visible;
    w.pointVisible = points;
    p.update();
    const shown = p.calls.slice();
    w.visible = (u: any, t: any) => (u.id === unit.id ? false : visible(u, t));
    p.update();
    const suppressed = a.garenP.controller.voices.size;
    w.visible = visible;
    p.update();
    return { hidden, shown, suppressed, returned: p.calls.slice(shown.length) };
  });
  expect(result.hidden).toBe(0);
  expect(result.shown).toHaveLength(1);
  expect(result.shown[0]).toMatchObject({ kind: 'active', loop: true });
  expect(result.shown[0].offset).toBeGreaterThan(0);
  expect(result.suppressed).toBe(0);
  expect(result.returned).toHaveLength(1);
  expect(requests).toBe(2);
  writeFileSync(
    'artifacts/garen-p-audio-fog.json',
    JSON.stringify({ ...result, requests }, null, 2) + '\n'
  );
});

test('actual victory drains the stop fade and onset once while saved state stays frozen', async ({
  page,
}) => {
  await open(page);
  const saved = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__P_AUDIO__;
    w.hero.hp -= 300;
    w.step(100);
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    p.update();
    return w.snapshot();
  });
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.garenP.controller.voices.size === 0,
    {},
    { timeout: 7000 }
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      a = g.audio,
      p = (window as any).__P_AUDIO__;
    const before = p.calls.length;
    a.enabled = false;
    a.enabled = true;
    for (let i = 0; i < 4; i++) p.update();
    return {
      snapshot: g.world.snapshot(),
      calls: p.calls.length,
      before,
      voices: a.garenP.controller.voices.size,
    };
  });
  expect(result.snapshot).toBe(saved);
  expect(result.calls).toBe(2);
  expect(result.before).toBe(2);
  expect(result.voices).toBe(0);
  writeFileSync(
    'artifacts/garen-p-audio-terminal.json',
    JSON.stringify({ ...result, snapshot: undefined, unchanged: true }, null, 2) + '\n'
  );
});

test('a missing source master remains silent without frame-driven retry or synthesized passive replacement', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/garen-p-433054605.wav', (route) => {
    attempts++;
    return route.abort();
  });
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__P_AUDIO__;
    w.hero.hp -= 300;
    w.step(120);
    for (let i = 0; i < 20; i++) p.update();
    return { status: a.garenP.status, calls: p.calls.length, synth: p.synth };
  });
  expect(result).toEqual({ status: 'failed', calls: 0, synth: 0 });
  expect(attempts).toBe(1);
  await page.unroute('**/garen-p-433054605.wav');
  let retryRequests = 0;
  page.on('request', (r) => {
    if (/garen-p-\d+\.wav$/.test(r.url())) retryRequests++;
  });
  const recovered = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      p = (window as any).__P_AUDIO__;
    const before = g.world.snapshot();
    await a.garenP.load();
    p.update();
    return {
      status: a.garenP.status,
      calls: p.calls,
      unchanged: before === g.world.snapshot(),
      synth: p.synth,
    };
  });
  expect(recovered.status).toBe('ready');
  expect(recovered.unchanged).toBe(true);
  expect(recovered.synth).toBe(0);
  expect(recovered.calls.map((c: any) => c.kind)).toEqual(['onset', 'active']);
  expect(retryRequests).toBe(1);
  writeFileSync(
    'artifacts/garen-p-audio-failure.json',
    JSON.stringify({ ...result, attempts, recovered, retryRequests }, null, 2) + '\n'
  );
});
