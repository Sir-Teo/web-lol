import { expect, test } from '@playwright/test';

test('private Baron candidate audio decodes float masters and follows saved combat without gameplay changes', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    media = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/baron-basic/')) media.add(response.url());
  });
  await page.goto('/?scene=fixture&encounter=baron');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.baronBasic.status))
    .toBe('ready');
  const point = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const boss = w.units.find((u: any) => u.monster?.species === 'baron');
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.baronAttackVisuals.some((r: any) => r.impact)) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return g.view.screenPoint(boss, 0.65);
  });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as any).__GAME__.world.baronAttackVisuals.some((r: any) => r.impact)
        ),
      { timeout: 25000 }
    )
    .toBe(true);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      audio = g.audio,
      controller = audio.baronBasic.controller;
    g.setPaused(true);
    audio.setPaused(false);
    audio.unlock();
    await audio.context.resume();
    const saved = w.snapshot();
    const capture = () =>
      [...controller.voices].map(([key, v]: any) => ({
        key,
        rate: v.source.playbackRate.value,
        gain: v.gain.gain.value,
        channels: v.source.buffer.numberOfChannels,
        frames: v.source.buffer.length,
      }));
    audio.updateBaronPreview(w, w.hero);
    const initial = capture();
    audio.enabled = false;
    const muted = controller.activeVoices;
    audio.enabled = true;
    audio.updateBaronPreview(w, w.hero);
    const resumed = capture();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    audio.updateBaronPreview(copy, copy.hero);
    const restored = capture();
    const peaks = [...controller.buffers].map(([id, buffer]: any) => {
      let peak = 0;
      for (const sample of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
      return { id, peak };
    });
    const unchanged = w.snapshot() === saved && copy.snapshot() === saved;
    controller.reset();
    const resetVoices = controller.activeVoices;
    audio.setPaused(true);
    return { initial, muted, resumed, restored, peaks, unchanged, resetVoices };
  });
  expect(media.size).toBe(8);
  expect(result.initial.length).toBeGreaterThan(0);
  expect(result.initial.some((v: any) => v.key.endsWith(':2'))).toBe(true);
  expect(result.initial.every((v: any) => v.channels === 1 && v.frames > 0 && v.gain < 0.06)).toBe(
    true
  );
  expect(result.muted).toBe(0);
  expect(result.resumed).toEqual(result.initial);
  expect(result.restored).toEqual(result.initial);
  expect(Math.max(...result.peaks.map((p: any) => p.peak))).toBeGreaterThan(1.36);
  expect(result.unchanged).toBe(true);
  expect(result.resetVoices).toBe(0);
  expect(errors).toEqual([]);
});
