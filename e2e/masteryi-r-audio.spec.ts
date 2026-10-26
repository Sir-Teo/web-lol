import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { MASTER_YI_R_AUDIO as P } from '../src/content/masteryi-r-audio';
let errors: string[] = [];
test.beforeEach(({ page }) => {
  test.setTimeout(120000);
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function open(page: Page, reset = true, url = '/?scene=fixture&champion=masteryi') {
  if (reset) {
    await page.goto(url);
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
      w.gainExperience(1e6);
      w.learnSpell('r');
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const sound = a.masterYiR.controller,
      probe = {
        calls: [] as any[],
        synth: 0,
        update: () => {
          a.updateGaren(w);
          a.update(
            w.events.filter(
              (e: any) => e.type === 'cast' && e.champion === 'masteryi' && e.text === 'r'
            ),
            w.tick
          );
        },
      };
    const create = a.context.createBufferSource.bind(a.context),
      osc = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        if (sound) {
          const media = [...sound.buffers].find(([, b]) => b === source.buffer)?.[0],
            entry = [...sound.voices].find(([, v]: any) => v.source === source);
          if (media && entry)
            probe.calls.push({
              media,
              key: entry[0],
              profileIndex: Number(entry[0].split(':').at(-1)),
              when,
              offset,
              rate: source.playbackRate.value,
              gain: entry[1].gain.gain.value,
              frames: source.buffer.length,
              loop: source.loop,
            });
        }
        return start(when, offset);
      };
      return source;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return osc();
    };
    (window as any).__AA__ = probe;
  }, reset);
}

test('both Highlander source masters retain exact float headroom in browser AudioBuffers', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(
    async (clips) => {
      const audio = (window as any).__GAME__.audio.masterYiR.controller;
      return Promise.all(
        clips.map(async (clip) => {
          const raw = await (await fetch('/' + clip.url)).arrayBuffer(),
            view = new DataView(raw);
          let expected: Float32Array | undefined;
          for (let i = 12; i < raw.byteLength;) {
            const tag = String.fromCharCode(...new Uint8Array(raw, i, 4)),
              size = view.getUint32(i + 4, true);
            if (tag === 'data') expected = new Float32Array(raw.slice(i + 8, i + 8 + size));
            i += 8 + size + (size % 2);
          }
          if (!expected) throw Error('Missing source PCM');
          const buffer = audio.buffers.get(clip.id),
            pcm = buffer.getChannelData(0);
          let differences = 0,
            peak = 0;
          for (let i = 0; i < pcm.length; i++) {
            if (pcm[i] !== expected[i]) differences++;
            peak = Math.max(peak, Math.abs(pcm[i]));
          }
          return {
            id: clip.id,
            frames: buffer.length,
            rate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            differences,
            peak,
          };
        })
      );
    },
    P.map((p) => p.variants[0])
  );
  for (const profile of P) {
    const clip = profile.variants[0];
    expect(result.find((r) => r.id === clip.id)).toEqual({
      id: clip.id,
      frames: clip.frames,
      rate: 44100,
      channels: 1,
      differences: 0,
      peak: clip.peak,
    });
  }
  writeFileSync(info.outputPath('highlander-float-masters.json'), JSON.stringify(result, null, 2));
});

test('real R input saves its onset and reloads the exact later natural expiry without duplicate tones', async ({
  page,
}, info) => {
  await open(page);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('r');
  await page.evaluate(() =>
    window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), { once: true })
  );
  await page.keyboard.up('r');
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    w.step();
    if (!w.player.highlander) throw Error('Real R input was not accepted');
    w.step(20);
    p.update();
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield),
      futureTicks = w.player.highlander.endTick + 30 - w.tick;
    copy.step(futureTicks);
    return {
      saved,
      future: copy.snapshot(),
      futureTicks,
      record: structuredClone(w.player.highlanderAudio[0]),
      tick: w.tick,
      calls: p.calls.slice(),
      synth: p.synth,
    };
  });
  expect(before.calls).toHaveLength(1);
  expect(before.synth).toBe(0);
  expect(before.record.stop).toBeNull();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before.saved);
  await open(page, false);
  const after = await page.evaluate((futureTicks) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    p.update();
    const restored = p.calls.slice();
    w.step(futureTicks);
    p.update();
    return {
      restored,
      calls: p.calls.slice(),
      future: w.snapshot(),
      record: structuredClone(w.player.highlanderAudio[0]),
      tick: w.tick,
      synth: p.synth,
    };
  }, before.futureTicks);
  expect(after.restored).toHaveLength(1);
  expect(after.restored[0].offset).toBeCloseTo((before.tick - before.record.startTick) / 60);
  expect(after.calls).toHaveLength(2);
  expect(after.calls[1].profileIndex).toBe(1);
  expect(after.calls[1].offset).toBeCloseTo((after.tick - after.record.stop.tick) / 60);
  expect(after.record.stop.reason).toBe('expired');
  expect(after.future).toBe(before.future);
  expect(after.synth).toBe(0);
  writeFileSync(
    info.outputPath('highlander-input-save-reload.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});

test('takedown and Meditate extend the buff without restarting its finite onset', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    w.learnSpell('w');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    p.update();
    const start = w.player.highlander.startTick,
      victim = w.spawn('champion', 'red', { x: 150, y: 0 }, 'masteryi');
    victim.ai = false;
    w.damage(w.hero, victim, 1e6, 'true');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step(241);
    p.update();
    const active = structuredClone(w.player.highlander),
      callsWhileActive = p.calls.slice();
    w.step(active.endTick - w.tick);
    p.update();
    return {
      start,
      active,
      callsWhileActive,
      calls: p.calls.slice(),
      record: structuredClone(w.player.highlanderAudio[0]),
    };
  });
  expect(result.active.extensionCount).toBe(1);
  expect(result.active.pausedTicks).toBe(240);
  expect(result.active.startTick).toBe(result.start);
  expect(result.callsWhileActive).toHaveLength(1);
  expect(result.calls).toHaveLength(2);
  expect(result.calls.map((c: any) => c.profileIndex)).toEqual([0, 1]);
  expect(result.record.stop).toMatchObject({
    reason: 'expired',
    extensionCount: 1,
    pausedTicks: 240,
    tick: result.active.endTick,
  });
  writeFileSync(
    info.outputPath('highlander-extended-expiry.json'),
    JSON.stringify(result, null, 2)
  );
});

test('a missing onset uses one fallback, retries one file and still plays the separate natural ending', async ({
  page,
}, info) => {
  let requests = 0,
    attempts = 0;
  page.on('request', (r) => {
    if (/masteryi-r-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.route('**/masteryi-r-873615538.wav', (route) => {
    attempts++;
    return route.abort();
  });
  await open(page);
  const failed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    for (let i = 0; i < 20; i++) p.update();
    return { status: g.audio.masterYiR.status, calls: p.calls.length, synth: p.synth };
  });
  expect(failed).toEqual({ status: 'failed', calls: 0, synth: 1 });
  expect(attempts).toBe(1);
  expect(requests).toBe(2);
  await page.unroute('**/masteryi-r-873615538.wav');
  const recovered = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    await g.audio.masterYiR.load();
    p.update();
    const oldCalls = p.calls.length;
    w.step(w.player.highlander.endTick - w.tick);
    p.update();
    return { status: g.audio.masterYiR.status, oldCalls, calls: p.calls.slice(), synth: p.synth };
  });
  expect(recovered.status).toBe('ready');
  expect(recovered.oldCalls).toBe(0);
  expect(recovered.calls).toHaveLength(1);
  expect(recovered.calls[0].profileIndex).toBe(1);
  expect(recovered.synth).toBe(1);
  expect(requests).toBe(3);
  writeFileSync(
    info.outputPath('highlander-media-retry.json'),
    JSON.stringify({ failed, recovered, attempts, requests }, null, 2)
  );
});

test('an onset drains once after victory without inventing an expiry cue or changing the saved match', async ({
  page,
}, info) => {
  await open(page);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', point: w.hero });
    w.step();
    p.update();
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    p.update();
    return {
      saved: w.snapshot(),
      record: structuredClone(w.player.highlanderAudio[0]),
      calls: p.calls.length,
    };
  });
  expect(before.record.stop.reason).toBe('match-end');
  expect(before.calls).toBe(1);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.masterYiR.controller.voices.size === 0,
    {},
    { timeout: 5000 }
  );
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__AA__;
    g.audio.enabled = false;
    g.audio.enabled = true;
    p.update();
    return {
      saved: g.world.snapshot(),
      calls: p.calls.length,
      voices: g.audio.masterYiR.controller.voices.size,
    };
  });
  expect(after.saved).toBe(before.saved);
  expect(after.calls).toBe(1);
  expect(after.voices).toBe(0);
  writeFileSync(
    info.outputPath('highlander-terminal-tail.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});

test('ordinary startup skips Highlander masters and late Yi presence loads each one once', async ({
  page,
}, info) => {
  let requests = 0;
  page.on('request', (r) => {
    if (/masteryi-r-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(requests).toBe(0);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    g.audio.updateGaren(g.world);
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.masterYiR.status === 'ready');
  expect(requests).toBe(2);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 20; i++) g.audio.updateGaren(g.world);
  });
  expect(requests).toBe(2);
  writeFileSync(
    info.outputPath('highlander-late-loading.json'),
    JSON.stringify({ initial: 0, requests })
  );
});
