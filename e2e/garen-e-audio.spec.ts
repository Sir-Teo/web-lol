import { expect, test } from '@playwright/test';

test('Judgment source phases resume without synth duplication and use independent active/end stop fades', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.garenE.status)).toBe('ready');
  await page.locator('#loading').waitFor({ state: 'detached' });
  const r = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      sound = a.garenE;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.battlefield.lineOfSight = () => true;
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [],
      create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const kind = Object.keys(sound.buffers).find((k) =>
          sound.buffers[k].includes(source.buffer)
        );
        calls.push({ kind, offset, loop: source.loop });
        start(when, offset);
      };
      return source;
    };
    let synthesized = 0;
    const oscillator = a.context.createOscillator.bind(a.context);
    a.context.createOscillator = () => {
      synthesized++;
      return oscillator();
    };
    const createGain = a.context.createGain.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        set = gain.gain.setValueAtTime.bind(gain.gain),
        ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
      gain.sets = [];
      gain.ramps = [];
      gain.gain.setValueAtTime = (v: number, t: number) => {
        gain.sets.push(v);
        return set(v, t);
      };
      gain.gain.linearRampToValueAtTime = (v: number, t: number) => {
        gain.ramps.push(t - a.context.currentTime);
        return ramp(v, t);
      };
      return gain;
    };
    const update = () => {
      a.updateGaren(w);
      a.update(
        w.events.filter((e: any) => e.type === 'cast' || e.type === 'judgment-hit'),
        w.tick
      );
    };
    w.learnSpell('e');
    w.events = [];
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
    w.step();
    update();
    update();
    const first = calls.slice();
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    target.hp = target.maxHp = 10000;
    w.step(74);
    update();
    const hitCalls = calls.filter((c) => c.kind === 'hit').length;
    const saved = w.snapshot();
    a.enabled = false;
    const muted = sound.voices.size;
    a.enabled = true;
    Object.assign(w, w.constructor.fromSnapshot(saved, w.battlefield));
    update();
    const restored = calls.slice(-2);
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
    w.step();
    update();
    const active = [...sound.voices.values()].find((v: any) => v.kind === 'active') as any;
    const activeRamp = active.envelope.ramps.at(-1),
      activeRampCount = active.envelope.ramps.length;
    a.updateGaren(w, { x: 4000, y: 0 });
    const cameraPreservedFade = active.envelope.ramps.length === activeRampCount;
    w.step(24);
    a.enabled = false;
    a.enabled = true;
    update();
    const late = [...sound.voices.values()].find((v: any) => v.kind === 'active') as any;
    const lateEnvelope = late.envelope.sets.at(-1),
      lateRamp = late.envelope.ramps.at(-1);
    const killer = w.spawn('dummy', 'red', { x: 200, y: 0 });
    w.damage(killer, w.hero, 1e6, 'true');
    update();
    const end = [...sound.voices.values()].find((v: any) => v.kind === 'end') as any;
    const endRamp = end.envelope.ramps.at(-1);
    a.setPaused(true);
    await a.transition;
    const pausedState = a.context.state,
      before = calls.length;
    update();
    const pausedCreated = calls.length - before;
    a.enabled = false;
    const cleaned = sound.voices.size;
    return {
      first,
      hitCalls,
      restored,
      muted,
      synthesized,
      activeRamp,
      cameraPreservedFade,
      lateEnvelope,
      lateRamp,
      endRamp,
      pausedState,
      pausedCreated,
      cleaned,
      allOnce: calls.every((c) => !c.loop),
      status: sound.status,
    };
  });
  expect(r.first.map((c: any) => c.kind)).toEqual(['cast', 'active']);
  expect(r.first.every((c: any) => c.offset === 0)).toBe(true);
  expect(r.hitCalls).toBe(2);
  expect(r.restored.map((c: any) => c.kind)).toEqual(['cast', 'active']);
  expect(r.restored.every((c: any) => c.offset === 74 / 60)).toBe(true);
  expect(r.synthesized).toBe(0);
  expect(r.muted).toBe(0);
  expect(r.cleaned).toBe(0);
  expect(r.activeRamp).toBeCloseTo(0.8, 2);
  expect(r.cameraPreservedFade).toBe(true);
  expect(r.lateEnvelope).toBeCloseTo(0.5);
  expect(r.lateRamp).toBeCloseTo(0.4, 2);
  expect(r.endRamp).toBeCloseTo(0.125, 2);
  expect(r.pausedState).toBe('suspended');
  expect(r.pausedCreated).toBe(0);
  expect(r.allOnce).toBe(true);
  expect(r.status).toBe('ready');
  expect(errors).toEqual([]);
});

test('Garen recordings load on presence and hidden enemies never create source voices', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/garen-e-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.battlefield.lineOfSight = () => true;
    const garen = w.spawn('champion', 'red', { x: 4000, y: 0 }, 'garen');
    w.learnSpell('e', garen.id);
    return garen.id;
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenE.status === 'ready');
  expect(new Set(requests).size).toBe(13);
  const r = await page.evaluate(async (id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      garen = w.unit(id);
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    w.enqueue({ type: 'cast', unit: id, ability: 'e', point: garen });
    w.step();
    a.updateGaren(w);
    const hidden = a.garenE.voices.size;
    garen.x = 100;
    w.step();
    a.updateGaren(w);
    const visible = a.garenE.voices.size;
    garen.x = 4000;
    w.step();
    a.updateGaren(w);
    const hiddenAgain = a.garenE.voices.size;
    a.enabled = false;
    return { hidden, visible, hiddenAgain };
  }, id);
  expect(r).toEqual({ hidden: 0, visible: 2, hiddenAgain: 0 });
});

test('missing Judgment recordings preserve playable synthesized cast feedback without repeated loads', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/assets/audio/garen-e-*.wav', async (route) => {
    requests++;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.audio.garenE.status === 'failed');
  const r = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    let tones = 0;
    const create = a.context.createOscillator.bind(a.context);
    a.context.createOscillator = () => {
      tones++;
      return create();
    };
    w.learnSpell('e');
    w.events = [];
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: w.hero });
    w.step();
    for (let i = 0; i < 5; i++) {
      a.updateGaren(w);
      a.update(w.events, w.tick);
    }
    const active = !!w.player.garenE;
    a.enabled = false;
    return { tones, active, sourceVoices: a.garenE.voices.size };
  });
  expect(r).toEqual({ tones: 1, active: true, sourceVoices: 0 });
  expect(requests).toBe(13);
});
