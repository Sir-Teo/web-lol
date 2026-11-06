import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_RECALL_AUDIO_PROFILE as P } from '../src/content/ahri-recall-audio-policy';
for (const mode of ['complete', 'cancel'] as const)
  test(`keyboard Recall ${mode} uses exact finite master through mute and saved restoration`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const requests: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/assets/audio/ahri-recall/')) requests.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=fixture&champion=ahri');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriRecall.status))
      .toBe('ready');
    await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.projectiles = [];
      w.pendingSpawns = [];
      w.nextWaveTick = 1e9;
      w.setOrder(w.hero, { type: 'idle' });
      Object.assign(w.hero, {
        x: 0,
        y: 0,
        previous: { x: 0, y: 0 },
        ai: false,
        hp: w.hero.maxHp / 2,
        mana: w.hero.maxMana / 2,
      });
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      const step = w.step;
      w.step = function (this: any, ...args: any[]) {
        const result = step.apply(this, args);
        if (this.ahriRecallAudio.length) {
          this.step = step;
          g.setPaused(true);
        }
        return result;
      };
      g.setPaused(false);
    });
    await page.keyboard.press('b');
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriRecallAudio.length), {
        timeout: 30000,
      })
      .toBe(1);
    await page.screenshot({ path: info.outputPath('ahri-recall-channel.png') });
    const birth = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world,
        a = g.audio,
        c = a.ahriRecall.controller;
      g.setPaused(true);
      a.setPaused(false);
      a.unlock();
      await a.transition;
      await a.context.resume();
      c.reset();
      const saved = w.snapshot(),
        capture = () =>
          [...c.voices].map(([key, v]: any) => ({
            key,
            frames: v.source.buffer.length,
            rate: v.source.playbackRate.value,
            gain: v.gain.gain.value,
            loop: v.source.loop,
          }));
      a.updateAhri(w, w.hero);
      const initial = capture();
      a.enabled = false;
      const muted = c.activeVoices;
      a.enabled = true;
      a.updateAhri(w, w.hero);
      const resumed = capture();
      const copy = w.constructor.fromSnapshot(saved, w.battlefield);
      a.updateAhri(copy, copy.hero);
      const restored = capture();
      const [id, buffer] = [...c.buffers][0],
        pcm = buffer.getChannelData(0),
        digest = await crypto.subtle.digest('SHA-256', pcm.buffer);
      const result = {
        initial,
        muted,
        resumed,
        restored,
        unchanged: w.snapshot() === saved && copy.snapshot() === saved,
        id,
        frames: buffer.length,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        pcmSha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
          ''
        ),
      };
      c.reset();
      a.setPaused(true);
      return result;
    });
    expect(birth.initial).toHaveLength(1);
    expect(birth.initial[0].loop).toBe(false);
    expect(birth.muted).toBe(0);
    expect(birth.resumed).toEqual(birth.initial);
    expect(birth.restored).toEqual(birth.initial);
    expect(birth.unchanged).toBe(true);
    expect(birth).toMatchObject({
      id: P.variants[0].id,
      frames: P.variants[0].frames,
      channels: 1,
      sampleRate: 44100,
      pcmSha256: P.variants[0].pcmSha256,
    });
    const ending = await page.evaluate(async (mode) => {
      const g = (window as any).__GAME__,
        w = g.world,
        a = g.audio,
        c = a.ahriRecall.controller,
        r = w.ahriRecallAudio[0];
      w.step(mode === 'complete' ? r.completeTick - w.tick : 20);
      if (mode === 'cancel') w.setOrder(w.hero, { type: 'move', point: { x: 500, y: 0 } });
      const saved = w.snapshot();
      a.setPaused(false);
      await a.context.resume();
      c.reset();
      a.updateAhri(w, w.hero);
      const voices = c.activeVoices,
        end = r.end,
        home = w.hero.x === w.battlefield.spawns.blue.x && w.hero.y === w.battlefield.spawns.blue.y,
        full = w.hero.hp === w.hero.maxHp && w.hero.mana === w.hero.maxMana;
      const restored = w.constructor.fromSnapshot(saved, w.battlefield);
      a.updateAhri(restored, restored.hero);
      const restoredVoices = c.activeVoices,
        unchanged = w.snapshot() === saved && restored.snapshot() === saved;
      w.step(mode === 'complete' ? 100 : 2);
      a.updateAhri(w, w.hero);
      const expired = c.activeVoices;
      c.reset();
      a.setPaused(true);
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      return { voices, end, home, full, restoredVoices, unchanged, expired };
    }, mode);
    expect(ending.voices).toBe(1);
    expect(ending.restoredVoices).toBe(1);
    expect(ending.unchanged).toBe(true);
    expect(ending.expired).toBe(0);
    expect(ending.end.reason).toBe(mode === 'complete' ? 'complete' : 'cancelled');
    if (mode === 'complete') {
      expect(ending.home).toBe(true);
      expect(ending.full).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`ahri-recall-${mode}.png`) });
    expect(requests).toHaveLength(1);
    expect(errors).toEqual([]);
  });
test('a fixture without Ahri fetches no Recall master', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-recall/')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&champion=ashe');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriRecall.status)).toBe('idle');
  expect(requests).toEqual([]);
});

test('native Recall master applies the local 20 ms Linear release without inventing a source stop', async ({
  page,
}, info) => {
  await page.route('**/recall-envelope-fixture.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Recall local finite release</title>',
    })
  );
  await page.goto('/recall-envelope-fixture.html');
  const result = await page.evaluate(async () => {
    const { AhriRecallAudio } = await import('/src/audio/ahri-recall.ts' as string);
    const controller = new AhriRecallAudio(),
      context = new OfflineAudioContext(1, 44100, 44100);
    const buffer = context.createBuffer(1, 44100, 44100);
    buffer.getChannelData(0).fill(1);
    const source = context.createBufferSource(),
      envelope = context.createGain();
    source.buffer = buffer;
    source.loop = false;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.connect(envelope).connect(context.destination);
    source.start(0);
    const voice = { source, envelope, stopAge: null };
    controller.scheduleEnvelope(
      voice,
      { age: 0, endAge: 1, stopAge: null, fadeInSeconds: 0, stopFadeSeconds: 0.02, stopCurve: 4 },
      0
    );
    controller.scheduleEnvelope(
      voice,
      {
        age: 0.25,
        endAge: 0.27,
        stopAge: 0.25,
        fadeInSeconds: 0,
        stopFadeSeconds: 0.02,
        stopCurve: 4,
      },
      0.25
    );
    const pcm = (await context.startRendering()).getChannelData(0);
    let maximumError = 0,
      afterEndPeak = 0;
    for (let i = 0; i < Math.floor(0.27 * 44100); i++) {
      const t = Math.max(0, Math.min(1, (i / 44100 - 0.25) / 0.02));
      maximumError = Math.max(maximumError, Math.abs(pcm[i] - (1 - t)));
    }
    for (let i = Math.ceil(0.27 * 44100); i < pcm.length; i++)
      afterEndPeak = Math.max(afterEndPeak, Math.abs(pcm[i]));
    return {
      maximumError,
      afterEndPeak,
      beforeStop: pcm[Math.floor(0.24 * 44100)],
      stopAge: voice.stopAge,
      localReleaseSeconds: 0.02,
    };
  });
  expect(result.maximumError).toBeLessThan(0.00001);
  expect(result.beforeStop).toBe(1);
  expect(result.afterEndPeak).toBe(0);
  expect(result.stopAge).toBe(0.25);
  await writeFile(
    info.outputPath('recall-finite-release-evidence.json'),
    JSON.stringify(result, null, 2) + '\n'
  );
});
