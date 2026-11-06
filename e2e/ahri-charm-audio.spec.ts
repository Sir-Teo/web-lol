import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_CHARM_AUDIO as P } from '../src/content/ahri-charm-audio';

test('Charm source audio decodes exact masters and follows a keyboard cast through contact, mute and restore', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    media = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/ahri-charm/')) media.add(response.url());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriCharm.status))
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
    w.learnSpell('e');
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriCharmAudio.some((r: any) => r.hit)) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return g.view.screenPoint({ x: 900, y: 0 });
  });
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('e');
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).__GAME__.world.ahriCharmAudio.some((r: any) => r.hit)),
      { timeout: 30000 }
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('charm-contact.png') });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      audio = g.audio,
      controller = audio.ahriCharm.controller;
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
  expect(media.size).toBe(9);
  expect(result.initial.map((v: any) => Number(v.key.split(':').at(-1))).sort()).toEqual([0, 1, 2]);
  expect(result.muted).toBe(0);
  expect(result.resumed).toEqual(result.initial);
  expect(result.restored).toEqual(result.initial);
  expect(result.unchanged).toBe(true);
  expect(result.resetVoices).toBe(0);
  for (const clip of P.flatMap((p) => [...p.variants]))
    expect(result.clips.find((c: any) => c.id === clip.id)).toMatchObject({
      frames: clip.frames,
      sampleRate: 44100,
      channels: 1,
      pcmSha256: clip.pcmSha256,
      peak: clip.peak,
    });
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('audio-evidence.json'), JSON.stringify(result, null, 2) + '\n');
  await info.attach('charm-audio-evidence', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
});

test('a fixture without Ahri keeps Charm audio idle and fetches no masters', async ({ page }) => {
  test.setTimeout(180000);
  const media: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/audio/ahri-charm/')) media.push(request.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriCharm.status)).toBe('idle');
  expect(media).toEqual([]);
});
