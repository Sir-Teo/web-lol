import { expect, test, type Page } from '@playwright/test';
import { ORACLE_AUDIO as P } from '../src/content/oracle-audio';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function equip(page: Page) {
  await page.keyboard.press('p');
  await page.locator('[data-trinket="oracle"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  await page.locator('.close-button').click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function instrument(page: Page, reset = true) {
  await page.evaluate(async (reset) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    if (reset) {
      w.units = [w.hero];
      w.pendingSpawns = [];
      w.nextWaveTick = 1e9;
      w.hero.ai = false;
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const p = { calls: [] as any[], update: () => a.updateOracle(w, { x: w.hero.x, y: w.hero.y }) };
    const createGain = a.context.createGain.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        curve = gain.gain.setValueCurveAtTime.bind(gain.gain);
      gain.curves = [];
      gain.gain.setValueCurveAtTime = (values: Float32Array, when: number, duration: number) => {
        gain.curves.push({ values: Array.from(values), when, duration });
        return curve(values, when, duration);
      };
      return gain;
    };
    const create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source),
        sound = a.oracle.controller;
      source.start = (when: number, offset: number) => {
        const kind = Object.keys(sound.buffers).find((k) => sound.buffers[k] === source.buffer);
        if (kind)
          p.calls.push({
            kind,
            offset,
            rate: source.playbackRate.value,
            loop: source.loop,
            loopStart: source.loopStart,
            loopEnd: source.loopEnd,
          });
        start(when, offset);
      };
      return source;
    };
    (window as any).__ORACLE_AUDIO__ = p;
  }, reset);
}
test('Oracle lazily loads its two concurrent activation layers, preserves pause/mute and restores an audio-only child tail with Ward equipped', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/\/oracle-\d+\.wav$/.test(r.url())) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.oracle.status)).toBe('idle');
  await equip(page);
  expect(requests).toHaveLength(3);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.oracle.status)).toBe('ready');
  await instrument(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__ORACLE_AUDIO__,
      sound = a.oracle.controller;
    w.enqueue({ type: 'oracle', unit: w.hero.id });
    w.step();
    p.update();
    p.update();
    const accepted = p.calls.slice(),
      start = w.player.trinket.scan.startTick,
      id = w.hero.id;
    const original = [...sound.voices.values()];
    a.setPaused(true);
    await a.transition;
    p.update();
    const paused = a.context.state,
      preserved = [...sound.voices.values()].every((v, i) => v === original[i]);
    a.setPaused(false);
    await a.transition;
    p.update();
    const noPauseDuplicate = p.calls.length === accepted.length;
    a.enabled = false;
    const muted = sound.voices.size;
    w.step(60);
    a.enabled = true;
    p.update();
    const resumed = p.calls.slice(accepted.length);
    w.step(start + 480 - w.tick);
    p.update();
    const stop = w.player.trinket.visuals[0].stopTick;
    w.step(15);
    p.update();
    const loop = [...sound.voices.entries()].find(([k]: any) => k.endsWith(':loop')) as any;
    const scheduledFade = loop[1].envelope.curves[0];
    sound.stop();
    p.update();
    const restoredLoop = [...sound.voices.entries()].find(([k]: any) => k.endsWith(':loop')) as any;
    const restoredFade = restoredLoop[1].envelope.curves[0];
    w.step(15);
    p.update();
    const ending = p.calls.filter((c: any) => c.kind === 'end');
    w.step(70);
    p.update();
    return {
      accepted,
      resumed,
      start,
      id,
      paused,
      preserved,
      noPauseDuplicate,
      muted,
      stop,
      scheduledFade,
      restoredFade,
      ending,
      tick: w.tick,
      histories: w.player.trinket.visuals.length,
    };
  });
  expect(result.accepted.map((c: any) => c.kind)).toEqual(['intro', 'loop']);
  expect(result.accepted.every((c: any) => c.offset === 0)).toBe(true);
  expect(result.accepted[0].loop).toBe(false);
  expect(result.accepted[1]).toMatchObject({
    loop: true,
    loopStart: 0,
    loopEnd: P.loop.durationSeconds,
  });
  for (const c of result.accepted) {
    expect(1200 * Math.log2(c.rate)).toBeGreaterThanOrEqual(-199);
    expect(1200 * Math.log2(c.rate)).toBeLessThanOrEqual(201);
  }
  expect(result.paused).toBe('suspended');
  expect(result.preserved).toBe(true);
  expect(result.noPauseDuplicate).toBe(true);
  expect(result.muted).toBe(0);
  expect(result.resumed.map((c: any) => c.kind)).toEqual(['intro', 'loop']);
  for (const c of result.resumed) {
    expect(c.offset).toBeCloseTo(c.rate, 6);
    expect(c.rate).toBe(result.accepted.find((v: any) => v.kind === c.kind).rate);
  }
  expect(result.stop).toBe(result.start + 480);
  expect(result.scheduledFade.duration).toBe(0.75);
  expect(result.scheduledFade.values).toHaveLength(257);
  expect(result.scheduledFade.values[0]).toBe(1);
  expect(result.scheduledFade.values[128]).toBe(0.625);
  expect(result.scheduledFade.values[256]).toBe(0);
  expect(result.restoredFade.duration).toBeCloseTo(0.5);
  expect(result.restoredFade.values[0]).toBeCloseTo(7 / 9, 6);
  expect(result.restoredFade.values[256]).toBe(0);
  expect(result.ending).toHaveLength(1);
  expect(result.ending[0].offset).toBe(0);
  expect(result.histories).toBe(1);
  // Keep the fixed child recording seekable after all particles retire and after a swap.
  await page.keyboard.press('p');
  await page.locator('[data-trinket="ward"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Trinket equipped');
  await page.locator('.close-button').click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.oracle.status)).toBe('ready');
  await instrument(page, false);
  const tail = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__ORACLE_AUDIO__,
      sound = a.oracle.controller;
    p.update();
    p.update();
    const calls = p.calls.slice();
    const voice = [...sound.voices.values()][0] as any;
    voice.source.onended();
    p.update();
    const completed = sound.voices.size,
      noReplay = p.calls.length === calls.length;
    w.step(w.player.trinket.visuals[0].stopTick + 190 - w.tick);
    p.update();
    return {
      calls,
      completed,
      noReplay,
      voices: sound.voices.size,
      finished: sound.finished.size,
      histories: w.player.trinket.visuals.length,
      kind: w.player.trinket.kind,
    };
  });
  expect(tail.calls).toHaveLength(1);
  expect(tail.calls[0]).toMatchObject({ kind: 'end', loop: false, rate: 1 });
  expect(tail.calls[0].offset).toBeCloseTo(70 / 60, 6);
  expect(tail).toMatchObject({
    completed: 0,
    noReplay: true,
    voices: 0,
    finished: 0,
    histories: 0,
    kind: 'ward',
  });
  expect(errors).toEqual([]);
});
test('an unavailable Oracle recording leaves the trinket usable and does not retry every frame', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('**/oracle-*.wav', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  await equip(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    w.enqueue({ type: 'oracle', unit: w.hero.id });
    w.step();
    for (let i = 0; i < 10; i++) a.updateOracle(w);
    return { kind: w.player.trinket.kind, scan: !!w.player.trinket.scan, status: a.oracle.status };
  });
  expect(result).toEqual({ kind: 'oracle', scan: true, status: 'failed' });
  expect(requests).toHaveLength(3);
});

test('Oracle fog loss retires voices, reappearance seeks the loop and the child uses independent point sight and source attenuation', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await equip(page);
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__ORACLE_AUDIO__,
      sound = a.oracle.controller,
      ctx = a.context;
    const record = {
      id: 99,
      startTick: 0,
      origin: { x: 0, y: 0 },
      facing: 0,
      stopTick: null,
      endReason: null,
      childAnchor: null,
      x: 0,
      y: 0,
      visible: true,
      endVisible: true,
    };
    sound.update(ctx, true, [record], 120, { x: 0, y: 0 });
    const near = [...sound.voices.values()][0] as any,
      nearGain = near.spatial.gain.value;
    sound.update(ctx, true, [{ ...record, visible: false, endVisible: false }], 150, {
      x: 0,
      y: 0,
    });
    const hidden = sound.voices.size;
    sound.update(ctx, true, [record], 180, { x: 3000, y: 0 });
    const far = [...sound.voices.values()][0] as any,
      farGain = far.spatial.gain.value;
    const loopCalls = p.calls.filter((c: any) => c.kind === 'loop');
    const stopped = {
      ...record,
      stopTick: 200,
      endReason: 'recast',
      childAnchor: { point: { x: 100, y: 200 }, facing: 0 },
      visible: false,
    };
    sound.update(ctx, true, [stopped], 230, { x: 100, y: 200 });
    const child = [...sound.voices.values()][0] as any,
      childGain = child.spatial.gain.value;
    sound.update(ctx, true, [{ ...stopped, endVisible: false }], 240, { x: 100, y: 200 });
    return {
      hidden,
      nearGain,
      farGain,
      loopCalls,
      childGain,
      childCalls: p.calls.filter((c: any) => c.kind === 'end'),
      final: sound.voices.size,
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.final).toBe(0);
  expect(result.nearGain).toBeCloseTo(0.2 * 10 ** (-11 / 20), 6);
  expect(result.farGain / result.nearGain).toBeCloseTo(10 ** (-96.3 / 20), 8);
  expect(result.loopCalls).toHaveLength(2);
  expect(result.loopCalls[1].rate).toBe(result.loopCalls[0].rate);
  expect(result.loopCalls[1].offset).toBeCloseTo(
    (3 * result.loopCalls[1].rate) % P.loop.durationSeconds,
    6
  );
  expect(result.childCalls).toHaveLength(1);
  expect(result.childCalls[0].offset).toBe(0);
  expect(result.childGain).toBeCloseTo(0.2 * 10 ** (-8 / 20), 6);
});
test('the real Victory menu lets the delayed Oracle child finish once while its checkpoint stays frozen', async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await ready(page);
  await equip(page);
  await instrument(page);
  const saved = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__ORACLE_AUDIO__;
    w.enqueue({ type: 'oracle', unit: w.hero.id });
    w.step(20);
    p.update();
    const nexus = w.spawn('nexus', 'red', { x: 0, y: 0 });
    w.damage(w.hero, nexus, 1e6, 'true');
    p.update();
    return w.snapshot();
  });
  await page.getByRole('heading', { name: 'Victory', exact: true }).waitFor();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__ORACLE_AUDIO__.calls.filter((c: any) => c.kind === 'end').length
        ),
      { timeout: 10000 }
    )
    .toBe(1);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      state: g.audio.context.state,
      snapshot: g.world.snapshot(),
      child: g.world.player.trinket.visuals[0].childAnchor,
      paused: g.hud.paused,
    };
  });
  expect(result).toMatchObject({ state: 'running', snapshot: saved, child: null, paused: true });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.oracle.controller.voices.size), {
      timeout: 10000,
    })
    .toBe(0);
  const completed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__ORACLE_AUDIO__;
    p.update();
    p.update();
    return {
      endings: p.calls.filter((c: any) => c.kind === 'end').length,
      voices: g.audio.oracle.controller.voices.size,
      snapshot: g.world.snapshot(),
    };
  });
  expect(completed).toEqual({ endings: 1, voices: 0, snapshot: saved });
  expect(errors).toEqual([]);
});
