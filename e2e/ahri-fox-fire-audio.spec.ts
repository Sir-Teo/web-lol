import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_FOX_FIRE_AUDIO_PROFILES as P } from '../src/content/ahri-fox-fire-audio-policy';

test('Fox-Fire source audio decodes exact masters and follows a keyboard cast through contact, mute and restore', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    media = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/ahri-fox-fire/')) media.add(response.url());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriFoxFire.status))
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
    w.learnSpell('w');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    let accepted = false;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (!accepted && this.ahriFoxFireAudio.length) {
        accepted = true;
        g.setPaused(true);
      } else if (
        this.ahriFoxFireAudio.some((r: any) => r.fires.every((f: any) => f.end?.reason === 'hit'))
      ) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return g.view.screenPoint({ x: 900, y: 0 });
  });
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('w');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriFoxFireAudio.length), {
      timeout: 30000,
    })
    .toBe(1);
  const activation = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      audio = g.audio,
      controller = audio.ahriFoxFire.controller;
    const saved = g.world.snapshot();
    audio.setPaused(false);
    audio.unlock();
    await audio.transition;
    await audio.context.resume();
    controller.reset();
    audio.updateAhri(g.world, g.world.hero);
    const loops = [...controller.voices.values()]
      .filter((v: any) => v.source.loop)
      .map((v: any) => ({
        loopStart: v.source.loopStart,
        loopEnd: v.source.loopEnd,
        frames: v.source.buffer.length,
        rate: v.source.playbackRate.value,
      }));
    audio.setPaused(true);
    return { loops, unchanged: g.world.snapshot() === saved };
  });
  expect(activation.loops).toEqual([
    {
      loopStart: 0,
      loopEnd: P.activation.variants[0].durationSeconds,
      frames: P.activation.variants[0].frames,
      rate: 1,
    },
  ]);
  expect(activation.unchanged).toBe(true);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__GAME__.world.ahriFoxFireAudio.some((r: any) =>
            r.fires.every((f: any) => f.end?.reason === 'hit')
          )
        ),
      { timeout: 30000 }
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('fox-fire-contact.png') });
  const contact = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      audio = g.audio,
      controller = audio.ahriFoxFire.controller;
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
      dispatch: w.ahriFoxFireAudio.map((r: any) => ({
        launches: r.fires.filter((f: any) => f.launch).length,
        hits: r.fires.filter((f: any) => f.end?.reason === 'hit').length,
        activationStop: r.activationStop?.reason,
      })),
      initial,
      muted,
      resumed,
      restored,
      clips,
      unchanged,
      resetVoices: controller.activeVoices,
    };
  });
  const result = { activation, ...contact };
  expect(media.size).toBe(11);
  expect(result.dispatch).toEqual([{ launches: 3, hits: 3, activationStop: 'released' }]);
  expect(result.initial.some((v: any) => v.key.includes(':hit:'))).toBe(true);
  expect(result.initial.some((v: any) => v.key.endsWith(':tail'))).toBe(true);
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
  await info.attach('fox-fire-audio-evidence', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
});

test('a fixture without Ahri keeps Fox-Fire audio idle and fetches no masters', async ({
  page,
}) => {
  test.setTimeout(180000);
  const media: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/audio/ahri-fox-fire/')) media.push(request.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriFoxFire.status)).toBe('idle');
  expect(media).toEqual([]);
});

test('native loop remains active until its saved stop and drains the original Exp1 domain', async ({
  page,
}, info) => {
  await page.route('**/fox-fire-envelope-fixture.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Fox-Fire loop rendering</title>',
    })
  );
  await page.goto('/fox-fire-envelope-fixture.html');
  const result = await page.evaluate(async () => {
    const { AhriFoxFireAudio } = await import('/src/audio/ahri-fox-fire.ts' as string);
    const controller = new AhriFoxFireAudio(),
      context = new OfflineAudioContext(1, 44100, 44100);
    const buffer = context.createBuffer(1, 4410, 44100);
    buffer.getChannelData(0).fill(1);
    const source = context.createBufferSource(),
      envelope = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.connect(envelope).connect(context.destination);
    source.start(0, 0.037);
    const voice = { source, envelope, stopAge: null };
    controller.scheduleEnvelope(voice, { loop: true, age: 0, endAge: Infinity, stopAge: null }, 0);
    controller.scheduleEnvelope(
      voice,
      {
        loop: true,
        age: 0.25,
        endAge: 0.45,
        stopAge: 0.25,
        fadeInSeconds: 0,
        stopFadeSeconds: 0.2,
        stopCurve: 6,
      },
      0.25
    );
    const pcm = (await context.startRendering()).getChannelData(0);
    let maximumError = 0,
      afterEndPeak = 0;
    for (let i = 0; i < 0.45 * 44100; i++) {
      const age = i / 44100,
        t = Math.max(0, Math.min(1, (age - 0.25) / 0.2));
      maximumError = Math.max(maximumError, Math.abs(pcm[i] - (1 - ((t + 1) * t) / 2)));
    }
    for (let i = Math.ceil(0.45 * 44100); i < pcm.length; i++)
      afterEndPeak = Math.max(afterEndPeak, Math.abs(pcm[i]));
    return {
      maximumError,
      afterEndPeak,
      beforeStop: pcm[Math.floor(0.24 * 44100)],
      stopAge: voice.stopAge,
    };
  });
  expect(result.maximumError).toBeLessThan(0.00001);
  expect(result.beforeStop).toBe(1);
  expect(result.afterEndPeak).toBe(0);
  expect(result.stopAge).toBe(0.25);
  await writeFile(
    info.outputPath('fox-fire-loop-evidence.json'),
    JSON.stringify(result, null, 2) + '\n'
  );
});
