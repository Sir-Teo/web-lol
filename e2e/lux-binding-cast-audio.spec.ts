import { expect, test } from '@playwright/test';

test('binding cast recordings schedule once, respect attenuation and voice cap, and stop on mute', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world;
    g.setPaused(true);
    w.events = [];
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [];
    let stops = 0;
    const create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const v = create(),
        start = v.start.bind(v),
        stop = v.stop.bind(v);
      v.start = (when: number, offset: number) => {
        calls.push({
          when,
          offset,
          now: a.context.currentTime,
          index: a.bindingCastBuffers.indexOf(v.buffer),
        });
        start(when, offset);
      };
      v.stop = (...args: any[]) => {
        stops++;
        stop(...args);
      };
      return v;
    };
    const id = a.lastId + 100,
      event = {
        id,
        tick: w.tick,
        type: 'cast',
        text: 'q',
        champion: 'lux',
        unit: w.hero.id,
        audience: ['blue'],
        x: 0,
        y: 0,
      };
    const listener = { x: 2000, y: 0 };
    a.update([event], w.tick + 12, listener);
    a.update([event], w.tick + 12, listener);
    const firstCount = calls.length,
      firstGain = [...a.voices.values()][0].gain.value;
    a.update([{ ...event, id: id + 1 }], w.tick + 12, listener);
    a.update([{ ...event, id: id + 2 }], w.tick + 12, listener);
    const capped = a.bindingCastVoices.size,
      cappedAll = a.voices.size,
      capStops = stops;
    a.setPaused(true);
    await a.transition;
    const pausedTime = a.context.currentTime;
    a.update([{ ...event, id: id + 3 }], w.tick + 12, listener);
    a.enabled = false;
    const muted = { all: a.voices.size, passive: a.bindingCastVoices.size };
    a.enabled = true;
    a.setPaused(false);
    await a.transition;
    a.update([{ ...event, id: id + 3 }], w.tick + 12, listener);
    const afterReplay = calls.length;
    a.update([{ ...event, id: id + 4 }], w.tick + 200, listener);
    const stale = calls.length;
    a.update([{ ...event, id: id + 5, tick: w.tick + 200 }], w.tick + 200, listener);
    const resumed = calls.length;
    a.enabled = false;
    return {
      status: a.bindingCastStatus,
      calls,
      firstCount,
      firstGain,
      capped,
      cappedAll,
      capStops,
      muted,
      afterReplay,
      stale,
      resumed,
      pausedTime,
    };
  });
  expect(result.status).toBe('ready');
  expect(result.firstCount).toBe(1);
  expect(result.firstGain).toBeCloseTo(0.2 * 10 ** (-28 / 20), 6);
  expect(result.calls[0].offset).toBeCloseTo(0.1, 8);
  expect(result.calls[0].when - result.calls[0].now).toBeCloseTo(0, 3);
  expect(new Set(result.calls.slice(0, 3).map((c) => c.index)).size).toBe(3);
  expect(result.capped).toBe(2);
  expect(result.cappedAll).toBe(2);
  expect(result.capStops).toBe(1);
  expect(result.muted).toEqual({ all: 0, passive: 0 });
  expect(result.afterReplay).toBe(3);
  expect(result.stale).toBe(3);
  expect(result.resumed).toBe(4);
});

test('binding cast voice completion releases owned nodes without replay', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world;
    g.setPaused(true);
    w.events = [];
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const event = {
      id: a.lastId + 100,
      tick: w.tick,
      type: 'cast',
      text: 'q',
      champion: 'lux',
      audience: ['blue'],
      x: 0,
      y: 0,
    };
    a.update([event], w.tick);
    a.update([event], w.tick);
  });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.bindingCastVoices.size)).toBe(1);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const a = (window as any).__GAME__.audio;
          return { passive: a.bindingCastVoices.size, all: a.voices.size };
        }),
      { timeout: 4000 }
    )
    .toEqual({ passive: 0, all: 0 });
});

test('queued Lux Q schedules the source delay and mute cancels its pending start', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.events = [];
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [];
    let oscillators = 0,
      stops = 0;
    const create = a.context.createBufferSource.bind(a.context);
    const createOscillator = a.context.createOscillator.bind(a.context);
    a.context.createOscillator = () => {
      oscillators++;
      return createOscillator();
    };
    a.context.createBufferSource = () => {
      const voice = create(),
        start = voice.start.bind(voice),
        stop = voice.stop.bind(voice);
      voice.start = (when: number, offset: number) => {
        calls.push({
          delay: when - a.context.currentTime,
          offset,
          source: a.bindingCastBuffers.includes(voice.buffer),
        });
        start(when, offset);
      };
      voice.stop = (...args: any[]) => {
        stops++;
        stop(...args);
      };
      return voice;
    };
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
    w.step();
    const events = w.events.filter((event: any) => w.eventVisible(event));
    a.update(events, w.tick, { x: 0, y: 0 });
    a.update(events, w.tick, { x: 0, y: 0 });
    const gain = [...a.voices.values()][0].gain.value;
    a.enabled = false;
    const cleared = a.voices.size === 0 && a.bindingCastVoices.size === 0;
    a.enabled = true;
    a.update(events, w.tick + 6);
    return {
      calls,
      oscillators,
      stops,
      cleared,
      gain,
      casts: events.filter((event: any) => event.type === 'cast').length,
      pending: w.championState(lux.id).pendingCast.ability,
    };
  });
  expect(result.casts).toBe(1);
  expect(result.pending).toBe('q');
  expect(result.calls).toHaveLength(1);
  expect(result.calls[0].source).toBe(true);
  expect(result.calls[0].delay).toBeCloseTo(0.1, 2);
  expect(result.calls[0].offset).toBe(0);
  expect(result.gain).toBeCloseTo(0.2 * 10 ** (-16 / 20), 6);
  expect(result.oscillators).toBe(0);
  expect(result.stops).toBe(1);
  expect(result.cleared).toBe(true);
});
