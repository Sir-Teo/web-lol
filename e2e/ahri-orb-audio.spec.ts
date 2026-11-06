import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_ORB_AUDIO_PROFILES as P } from '../src/content/ahri-orb-audio-policy';

test('Orb source audio decodes exact masters and follows a keyboard cast through contact, mute and restore', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    media = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/ahri-orb/')) media.add(response.url());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriOrb.status))
    .toBe('ready');
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = 1e9;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    const target = w.spawn('champion', 'red', { x: 500, y: 0 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, magicResist: 0 });
    w.learnSpell('q');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriOrbAudio.some((r: any) => r.end?.reason === 'caught')) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return g.view.screenPoint({ x: 900, y: 0 });
  });
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('q');
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__GAME__.world.ahriOrbAudio.some((r: any) => r.end?.reason === 'caught')
        ),
      { timeout: 30000 }
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('orb-contact.png') });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      audio = g.audio,
      controller = audio.ahriOrb.controller;
    g.setPaused(true);
    audio.setPaused(false);
    audio.unlock();
    await audio.transition;
    await audio.context.resume();
    const saved = w.snapshot();
    // Screenshot capture can outlast a finite voice in software WebGL.
    // Reset ownership here to exercise a fresh checkpoint seek, while separate
    // controller tests verify natural-end suppression at a frozen tick.
    controller.reset();
    const capture = () =>
      [...controller.voices].map(([key, v]: any) => ({
        key,
        rate: v.source.playbackRate.value,
        gain: v.gain.gain.value,
        channels: v.source.buffer.numberOfChannels,
        frames: v.source.buffer.length,
        stopAge: v.stopAge,
      }));
    audio.updateAhri(w, w.hero);
    const initial = capture();
    audio.enabled = false;
    const muted = controller.activeVoices;
    audio.enabled = true;
    audio.updateAhri(w, w.hero);
    const resumed = capture();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    audio.updateAhri(copy, copy.hero);
    const restored = capture();
    const clips = [];
    for (const [id, buffer] of controller.buffers) {
      const pcm = buffer.getChannelData(0),
        digest = await crypto.subtle.digest('SHA-256', pcm.buffer);
      let peak = 0;
      for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
      clips.push({
        id,
        frames: buffer.length,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        peak,
        pcmSha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
          ''
        ),
      });
    }
    const unchanged = w.snapshot() === saved && copy.snapshot() === saved;
    controller.reset();
    audio.setPaused(true);
    return {
      initial,
      muted,
      resumed,
      restored,
      clips,
      unchanged,
      resetVoices: controller.activeVoices,
    };
  });
  expect(media.size).toBe(22);
  expect(result.initial.length).toBeGreaterThan(0);
  expect(result.initial.some((v: any) => v.key.endsWith(':deactivate'))).toBe(true);
  expect(result.muted).toBe(0);
  expect(result.resumed).toEqual(result.initial);
  expect(result.restored).toEqual(result.initial);
  expect(result.unchanged).toBe(true);
  expect(result.resetVoices).toBe(0);
  for (const clip of Object.values(P).flatMap((p) => [...p.variants]))
    expect(result.clips.find((c: any) => c.id === clip.id)).toMatchObject({
      frames: clip.frames,
      sampleRate: 44100,
      channels: 1,
      pcmSha256: clip.pcmSha256,
      peak: clip.peak,
    });
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('audio-evidence.json'), JSON.stringify(result, null, 2) + '\n');
  await info.attach('orb-audio-evidence', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
});

test('a fixture without Ahri keeps Orb audio idle and fetches no masters', async ({ page }) => {
  test.setTimeout(180000);
  const media: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/audio/ahri-orb/')) media.push(request.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriOrb.status)).toBe('idle');
  expect(media).toEqual([]);
});

test('native Web Audio retains outward Exp1 and return Linear stop domains', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { sourceEnvelopeEvents } = await import('/src/audio/source-envelope.ts' as string);
    const results = [];
    for (const c of [
      { stopCurve: 6, stopFadeSeconds: 0.5, age: 0 },
      { stopCurve: 6, stopFadeSeconds: 0.5, age: 0.4 },
      { stopCurve: 4, stopFadeSeconds: 0.75, age: 0 },
      { stopCurve: 4, stopFadeSeconds: 0.75, age: 0.6 },
    ]) {
      const state = { ...c, stopAge: 0.25, endAge: 0.25 + c.stopFadeSeconds, fadeInSeconds: 0 };
      const span = state.endAge - state.age;
      const context = new OfflineAudioContext(1, Math.ceil(span * 44100) + 128, 44100);
      const source = context.createConstantSource(),
        gain = context.createGain();
      source.connect(gain).connect(context.destination);
      source.start(0);
      source.stop(span);
      for (const event of sourceEnvelopeEvents(state)) {
        const time = event.age - state.age;
        if (event.kind === 'set') gain.gain.setValueAtTime(event.value, time);
        else gain.gain.linearRampToValueAtTime(event.value, time);
      }
      const pcm = (await context.startRendering()).getChannelData(0);
      let maximumError = 0,
        afterEndPeak = 0;
      for (let i = 0; i < Math.floor(span * 44100); i++) {
        const t = Math.max(
          0,
          Math.min(1, (state.age + i / 44100 - state.stopAge) / state.stopFadeSeconds)
        );
        const expected = 1 - (state.stopCurve === 4 ? t : ((t + 1) * t) / 2);
        maximumError = Math.max(maximumError, Math.abs(pcm[i] - expected));
      }
      for (let i = Math.ceil(span * 44100); i < pcm.length; i++)
        afterEndPeak = Math.max(afterEndPeak, Math.abs(pcm[i]));
      results.push({ ...state, maximumError, afterEndPeak });
    }
    return results;
  });
  for (const result of results) {
    expect(result.maximumError).toBeLessThan(0.00001);
    expect(result.afterEndPeak).toBe(0);
  }
  await writeFile(
    info.outputPath('orb-envelope-evidence.json'),
    JSON.stringify(results, null, 2) + '\n'
  );
});
