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
      champion: 'ashe',
      audience: ['blue'],
      x: w.hero.x,
      y: w.hero.y,
    };
    a.update([event], w.tick);
    a.update([event], w.tick);
    a.update([{ ...event, id: id + 1 }], w.tick + 6);
    a.update([{ ...event, id: id + 2 }], w.tick + 12);
    const gain = [...a.voices.values()].map((n: any) => n.gain.value);
    const count = a.voices.size;
    a.update([{ ...event, id: id + 3, champion: 'lux' }], w.tick);
    const luxSampleCount = calls.length;
    a.setPaused(true);
    await a.transition;
    return {
      status: a.sourceStatus,
      calls,
      gain,
      time: a.context.currentTime,
      count,
      luxSampleCount,
    };
  });
  expect(initial.luxSampleCount).toBe(3);
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
    const [voice, gain] = [...a.voices.entries()].find(
      ([v]: any) => v.buffer === a.arrivalBuffer
    ) as any;
    // Expire the simulation descriptor explicitly. Web Audio owns a separate
    // clock, so an overloaded browser must not determine their relative ordering.
    const endTick = Math.max(...w.scoutVisuals.map((v: any) => v.endTick));
    w.step(endTick - w.tick);
    return {
      status: a.arrivalStatus,
      frames: voice.buffer.length,
      gain: gain.gain.value,
      remainingVisuals: w.scoutVisuals.length,
      voicesAfterVisuals: a.voices.size,
      duration: voice.buffer.duration,
    };
  });
  expect(initial.status).toBe('ready');
  expect(initial.frames).toBe(317887);
  expect(initial.gain).toBeCloseTo(0.2 * 10 ** (-9 / 20), 6);
  expect(initial.remainingVisuals).toBe(0);
  expect(initial.voicesAfterVisuals).toBe(1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.voices.size), {
      timeout: Math.ceil((initial.duration + 2) * 1000),
    })
    .toBe(0);
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

test('persistent linger restores loop phase, follows pause/mute, and cleans up on visibility loss', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
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
    w.step(345); // At the beginning of the authored 1.25-second stop fade.
    const saved = w.snapshot(),
      restored = w.constructor.fromSnapshot(saved, w.battlefield);
    a.setPaused(false);
    await a.transition;
    const starts: number[] = [],
      curves: number[][] = [];
    const create = a.context.createBufferSource.bind(a.context),
      createGain = a.context.createGain.bind(a.context);
    a.context.createBufferSource = () => {
      const voice = create(),
        start = voice.start.bind(voice);
      voice.start = (when: number, offset: number) => {
        starts.push(offset);
        start(when, offset);
      };
      return voice;
    };
    a.context.createGain = () => {
      const gain = createGain(),
        curve = gain.gain.setValueCurveAtTime.bind(gain.gain);
      gain.gain.setValueCurveAtTime = (values: Float32Array, when: number, duration: number) => {
        curves.push([values[0], values[128], values[256], duration]);
        return curve(values, when, duration);
      };
      return gain;
    };
    a.updateLinger(restored.scoutVisuals, restored.tick);
    const voice = [...a.lingerVoices.values()][0] as any;
    const initial = { loop: voice.loop, loopEnd: voice.loopEnd, count: a.lingerVoices.size };
    a.updateLinger(restored.scoutVisuals, restored.tick);
    a.setPaused(true);
    await a.transition;
    const time = a.context.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const frozen = a.context.currentTime === time;
    a.enabled = false;
    const muted = a.lingerVoices.size;
    a.enabled = true;
    a.setPaused(false);
    await a.transition;
    a.updateLinger(restored.scoutVisuals, restored.tick + 30);
    const resumed = a.lingerVoices.size;
    a.updateLinger([], restored.tick + 30);
    const removed = a.lingerVoices.size;
    a.setPaused(true);
    await a.transition;
    return {
      initial,
      starts,
      curves,
      frozen,
      muted,
      resumed,
      removed,
      level: 0.2 * 10 ** (-32 / 20),
    };
  });
  expect(result.initial.loop).toBe(true);
  expect(result.initial.loopEnd).toBeCloseTo(203769 / 44100, 8);
  expect(result.initial.count).toBe(1);
  expect(result.starts).toHaveLength(2);
  expect(result.starts[0]).toBeCloseTo(5 % (203769 / 44100), 8);
  expect(result.starts[1]).toBeCloseTo(5.5 % (203769 / 44100), 8);
  expect(result.curves[0][0]).toBeCloseTo(result.level, 8);
  expect(result.curves[0][1]).toBeCloseTo(result.level * 0.625, 8);
  expect(result.curves[0][2]).toBe(0);
  expect(result.curves[0][3]).toBeCloseTo(1.25, 8);
  expect(result).toMatchObject({ frozen: true, muted: 0, resumed: 1, removed: 0 });
});

test('flight layers restore phase and source gain, stop at arrival, and clean up independently', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      original = g.audio;
    const a = new original.constructor();
    a.flightBuffers = original.flightBuffers;
    a.flightStatus = original.flightStatus;
    g.setPaused(true);
    a.unlock();
    await a.transition;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 10000, y: w.hero.y },
    });
    w.step(166); // Restore 2.5 seconds into flight.
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    // Isolate manually controlled saved state from the page's ongoing audio update.
    w.projectiles = [];
    a.lastId = w.nextId;
    a.setPaused(false);
    await a.transition;
    const starts: any[] = [],
      ramps: number[] = [],
      levels: number[] = [];
    const create = a.context.createBufferSource.bind(a.context),
      createGain = a.context.createGain.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        starts.push({ offset, loop: source.loop, buffer: a.flightBuffers.indexOf(source.buffer) });
        start(when, offset);
      };
      return source;
    };
    a.context.createGain = () => {
      const gain = createGain(),
        ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
      const set = gain.gain.setValueAtTime.bind(gain.gain);
      let first = true;
      gain.gain.setValueAtTime = (value: number, when: number) => {
        if (first) levels.push(value);
        first = false;
        return set(value, when);
      };
      gain.gain.linearRampToValueAtTime = (value: number, when: number) => {
        ramps.push(when - a.context.currentTime);
        return ramp(value, when);
      };
      return gain;
    };
    a.updateFlight(restored.projectiles, restored.scoutVisuals, restored.tick);
    a.updateFlight(restored.projectiles, restored.scoutVisuals, restored.tick);
    const initial = a.flightVoices.size;
    a.setPaused(true);
    await a.transition;
    const time = a.context.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const frozen = a.context.currentTime === time;
    a.enabled = false;
    const muted = a.flightVoices.size;
    a.enabled = true;
    a.setPaused(false);
    await a.transition;
    restored.step(90);
    a.updateFlight(restored.projectiles, restored.scoutVisuals, restored.tick);
    const afterVariantEnd = [...a.flightVoices.values()].map((v: any) => v.loop);
    a.updateFlight([], [], restored.tick + 90);
    const cleared = a.flightVoices.size;
    a.setPaused(true);
    await a.transition;
    return {
      status: a.flightStatus,
      initial,
      starts: starts.slice(0, 2),
      levels: levels.slice(0, 2),
      ramps: ramps.slice(0, 2),
      frozen,
      muted,
      afterVariantEnd,
      cleared,
    };
  });
  expect(result.status).toBe('ready');
  expect(result.initial).toBe(2);
  expect(result.starts.map((s: any) => s.loop)).toEqual([false, true]);
  expect(result.starts.map((s: any) => s.offset)).toEqual([2.5, 2.5]);
  expect(result.levels[0]).toBeCloseTo(0.2 * 10 ** (-8 / 20), 7);
  expect(result.levels[1]).toBeCloseTo(0.2 * 10 ** (-26 / 20), 7);
  expect(result.ramps[0]).toBeCloseTo(result.ramps[1], 2);
  expect(result).toMatchObject({ frozen: true, muted: 0, afterVariantEnd: [true], cleared: 0 });
});

test('both flight layers complete the arrival fade without restarting on a delayed simulation frame', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      original = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'e',
      point: { x: w.hero.x + 700, y: w.hero.y },
    });
    w.step(45);
    const a = new original.constructor();
    a.flightBuffers = original.flightBuffers;
    a.flightStatus = original.flightStatus;
    a.unlock();
    await a.transition;
    const stops: number[] = [],
      create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        stop = source.stop.bind(source);
      source.stop = (when: number) => {
        stops.push(when - a.context.currentTime);
        stop(when);
      };
      return source;
    };
    a.updateFlight([], w.scoutVisuals, w.tick);
    const initial = a.flightVoices.size;
    await new Promise((resolve) => setTimeout(resolve, 350));
    const ended = a.flightVoices.size,
      finished = a.finishedFlight.size;
    a.updateFlight([], w.scoutVisuals, w.tick);
    const replayed = a.flightVoices.size;
    await a.context.close();
    return { initial, ended, finished, replayed, stops };
  });
  expect(result).toMatchObject({ initial: 2, ended: 0, finished: 2, replayed: 0 });
  expect(result.stops).toHaveLength(2);
  for (const stop of result.stops) expect(stop).toBeCloseTo(0.15, 2);
});

test('an event waits for a pending audio resume and plays exactly once afterward', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio;
    g.setPaused(true);
    a.unlock();
    await a.transition;
    const resume = a.context.resume.bind(a.context);
    let release!: () => void;
    a.context.resume = () =>
      new Promise<void>((resolve, reject) => {
        release = () => {
          void resume().then(resolve, reject);
        };
      });
    a.setPaused(false);
    await Promise.resolve();
    const before = a.lastId;
    const event = { id: before + 100, tick: g.world.tick, type: 'scout-arrival', x: 0, y: 0 };
    a.update([event], g.world.tick);
    const pending = { lastId: a.lastId, voices: a.voices.size };
    release();
    await a.transition;
    a.context.resume = resume;
    a.update([event], g.world.tick);
    a.update([event], g.world.tick);
    const played = [...a.voices.keys()].filter(
      (voice: any) => voice.buffer === a.arrivalBuffer
    ).length;
    a.setPaused(true);
    await a.transition;
    a.update([{ ...event, id: event.id + 1 }], g.world.tick);
    const pausedLastId = a.lastId;
    a.enabled = false;
    return { before, pending, eventId: event.id, played, pausedLastId };
  });
  expect(result.pending).toEqual({ lastId: result.before, voices: 0 });
  expect(result.played).toBe(1);
  expect(result.pausedLastId).toBe(result.eventId + 1);
});
