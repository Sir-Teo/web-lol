import { expect, test } from '@playwright/test';

test('missile recording follows live flight, impact fade, mute, visibility and saved phase', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world,
      audio = a.bindingFlight;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    for (const x of [300, 603]) w.spawn('dummy', 'red', { x, y: 0 });
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [];
    const create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        calls.push({ offset, loop: source.loop, variant: audio.buffers.indexOf(source.buffer) });
        start(when, offset);
      };
      return source;
    };
    const createGain = a.context.createGain.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
      gain.ramps = [];
      gain.sets = [];
      const set = gain.gain.setValueAtTime.bind(gain.gain);
      gain.gain.setValueAtTime = (value: number, when: number) => {
        gain.sets.push({ value, when });
        return set(value, when);
      };
      gain.gain.linearRampToValueAtTime = (value: number, when: number) => {
        gain.ramps.push({ value, after: when - a.context.currentTime });
        return ramp(value, when);
      };
      return gain;
    };
    const update = (listener = { x: 2100, y: 0 }) =>
      a.updateBindingFlight(w.projectiles, w.bindingStops, w.tick, listener);
    w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
    w.step(5);
    update();
    update();
    const id = w.projectiles[0].id,
      voice = audio.voices.get(id);
    const initial = { count: calls.length, gain: voice.spatial.gain.value };
    w.step(40);
    update();
    const faded = {
      stopTick: voice.stopTick,
      envelope: voice.envelope.sets.at(-1).value,
      expected: 1 - (w.tick - w.bindingStops[0].stopTick) / 180,
      ramp: voice.envelope.ramps.at(-1),
      ramps: voice.envelope.ramps.length,
    };
    update({ x: 5000, y: 0 });
    const cameraKeptEnvelope = voice.envelope.ramps.length === faded.ramps;
    const saved = w.snapshot();
    a.enabled = false;
    const muted = audio.voices.size;
    a.enabled = true;
    Object.assign(w, w.constructor.fromSnapshot(saved, w.battlefield));
    update();
    const restored = {
      count: calls.length,
      envelope: audio.voices.get(id).envelope.sets.at(-1).value,
    };
    a.setPaused(true);
    await a.transition;
    update();
    const paused = { state: a.context.state, count: calls.length };
    a.updateBindingFlight([], [], w.tick, { x: 0, y: 0 });
    const hidden = audio.voices.size;
    a.setPaused(false);
    await a.transition;
    update();
    const revealed = calls.length;
    a.enabled = false;
    return {
      status: audio.status,
      calls,
      initial,
      faded,
      cameraKeptEnvelope,
      muted,
      restored,
      paused,
      hidden,
      revealed,
    };
  });
  expect(result.status).toBe('ready');
  expect(result.initial.count).toBe(1);
  expect(result.initial.gain).toBeCloseTo(0.2 * 10 ** (-19 / 20), 6);
  expect(result.calls[0]).toEqual({ offset: 5 / 60, loop: false, variant: 0 });
  expect(result.faded.envelope).toBeCloseTo(result.faded.expected, 3);
  expect(result.faded.ramp.value).toBe(0);
  expect(result.faded.ramp.after).toBeCloseTo(result.faded.expected * 3, 2);
  expect(result.cameraKeptEnvelope).toBe(true);
  expect(result.muted).toBe(0);
  expect(result.restored.count).toBe(2);
  expect(result.calls[1]).toEqual({ offset: 0.75, loop: false, variant: 0 });
  expect(result.restored.envelope).toBeCloseTo(result.faded.expected, 3);
  expect(result.paused).toEqual({ state: 'suspended', count: 2 });
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(3);
});

test('flight voice cap and natural completion never restart an old sound on a frozen frame', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const initial = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world,
      audio = a.bindingFlight;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    audio.testStarts = 0;
    const create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const s = create(),
        start = s.start.bind(s);
      s.start = (...args: any[]) => {
        audio.testStarts++;
        start(...args);
      };
      return s;
    };
    for (let i = 0; i < 5; i++) w.releaseLightBinding(lux, { x: 1300, y: 0 }, 80);
    a.updateBindingFlight(w.projectiles, [], w.tick, { x: 0, y: 0 });
    a.updateBindingFlight(w.projectiles, [], w.tick, { x: 0, y: 0 });
    return { voices: audio.voices.size, starts: audio.testStarts, stolen: audio.finished.size };
  });
  expect(initial).toEqual({ voices: 4, starts: 5, stolen: 1 });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.bindingFlight.voices.size), {
      timeout: 5000,
    })
    .toBe(0);
  const final = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world;
    a.updateBindingFlight(w.projectiles, [], w.tick, { x: 0, y: 0 });
    const result = { voices: a.bindingFlight.voices.size, starts: a.bindingFlight.testStarts };
    a.updateBindingFlight([], [], w.tick, { x: 0, y: 0 });
    return { ...result, finished: a.bindingFlight.finished.size };
  });
  expect(final).toEqual({ voices: 0, starts: 5, finished: 0 });
});
