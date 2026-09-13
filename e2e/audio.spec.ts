import { expect, test } from '@playwright/test';

test('Hawkshot source cast preserves scheduling, shuffle, pause and mute lifecycle', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const initial = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio,
      w = g.world;
    g.setPaused(true);
    // The real context is unlocked by input in normal play. Enable it here to
    // inspect scheduled nodes without wall-clock simulation advancing the cast.
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [];
    const create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const voice = create(),
        start = voice.start.bind(voice);
      voice.start = (when: number, offset: number) => {
        calls.push({
          when,
          offset,
          at: a.context.currentTime,
          buffer: a.buffers.indexOf(voice.buffer),
        });
        start(when, offset);
      };
      return voice;
    };
    const id = Math.max(a.lastId, ...w.events.map((e: any) => e.id), 0) + 100;
    const event = {
      id,
      tick: w.tick,
      type: 'cast',
      text: 'e',
      audience: ['blue'],
      x: w.hero.x,
      y: w.hero.y,
    };
    a.update([event], w.tick);
    a.update([event], w.tick);
    a.update([{ ...event, id: id + 1 }], w.tick + 6);
    a.update([{ ...event, id: id + 2 }], w.tick + 12);
    const gain = [...a.voices.values()].map((n: any) => n.gain.value);
    a.setPaused(true);
    await a.transition;
    return {
      status: a.sourceStatus,
      calls,
      gain,
      time: a.context.currentTime,
      count: a.voices.size,
    };
  });
  expect(initial.status).toBe('ready');
  expect(initial.count).toBe(3);
  expect(new Set(initial.calls.map((c: any) => c.buffer)).size).toBe(3);
  expect(initial.calls[0].when - initial.calls[0].at).toBeCloseTo(0.15, 2);
  expect(initial.calls[1].when - initial.calls[1].at).toBeCloseTo(0.05, 2);
  expect(initial.calls[2].offset).toBeCloseTo(0.05, 5);
  for (const gain of initial.gain) expect(gain).toBeCloseTo(0.2 * 10 ** (-12 / 20), 6);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.context.currentTime)).toBe(
    initial.time
  );
  const muted = await page.evaluate(async () => {
    const a = (window as any).__GAME__.audio;
    a.enabled = false;
    const cleared = a.voices.size;
    a.enabled = true;
    a.setPaused(false);
    a.setPaused(true);
    a.setPaused(false);
    await a.transition;
    return { cleared, state: a.context.state, count: a.voices.size };
  });
  expect(muted).toEqual({ cleared: 0, state: 'running', count: 0 });
});

test('source cast finishes and restored event history never replays', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const count = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    a.unlock();
    await a.transition;
    a.setPaused(false);
    await a.transition;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 700, y: w.hero.y },
    });
    w.step();
    a.update(
      w.events.filter((e: any) => w.eventVisible(e)),
      w.tick
    );
    // Exercise the same constructor history priming used by checkpoint boot.
    const historical = new a.constructor(w.events);
    historical.context = a.context;
    historical.buffers = a.buffers;
    historical.sourceStatus = 'ready';
    historical.update(w.events, w.tick);
    return { live: a.voices.size, historical: historical.voices.size };
  });
  expect(count).toEqual({ live: 1, historical: 0 });
  await expect.poll(() => page.evaluate(() => (window as any).__GAME__.audio.voices.size)).toBe(0);
});

test('missing source audio keeps the match playable with synthesized cast feedback', async ({
  page,
}) => {
  await page.route('**/assets/audio/hawkshot-cast-*.wav', (route) => route.abort());
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio;
    g.setPaused(true);
    a.unlock();
    a.setPaused(false);
    await a.transition;
    a.update(
      [{ id: a.lastId + 1, tick: g.world.tick, type: 'cast', text: 'e', x: 0, y: 0 }],
      g.world.tick
    );
    return {
      status: a.sourceStatus,
      voices: [...a.voices.keys()].map((v: any) => v.constructor.name),
    };
  });
  expect(result).toEqual({ status: 'failed', voices: ['OscillatorNode'] });
});

test('source arrival outlasts its visual descriptor and releases its audio nodes', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const initial = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    a.unlock();
    await a.transition;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 700, y: w.hero.y },
    });
    w.step(45);
    const event = w.events.find((e: any) => e.type === 'scout-arrival');
    a.lastId = event.id - 1;
    g.setPaused(false);
    await a.transition;
    a.update(
      w.events.filter((e: any) => w.eventVisible(e)),
      w.tick
    );
    const [voice, gain] = [...a.voices.entries()][0] as any;
    return { status: a.arrivalStatus, frames: voice.buffer.length, gain: gain.gain.value };
  });
  expect(initial.status).toBe('ready');
  expect(initial.frames).toBe(317887);
  expect(initial.gain).toBeCloseTo(0.2 * 10 ** (-9 / 20), 6);
  await page.waitForFunction(() => (window as any).__GAME__.world.scoutVisuals.length === 0, null, {
    timeout: 12000,
  });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.voices.size)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).__GAME__.audio.voices.size)).toBe(0);
});

test('late arrival seeks to its age and fully elapsed arrival is silent', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio;
    g.setPaused(true);
    a.unlock();
    a.setPaused(false);
    await a.transition;
    const starts: number[] = [],
      create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        starts.push(offset);
        start(when, offset);
      };
      return source;
    };
    const event = { id: a.lastId + 1, tick: 100, type: 'scout-arrival', x: 0, y: 0 };
    a.update([event], 130);
    a.update([{ ...event, id: event.id + 1 }], 600);
    return { starts, voices: a.voices.size };
  });
  expect(result).toEqual({ starts: [0.5], voices: 1 });
});
