import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { LUX_E_AUDIO as P } from '../src/content/lux-e-audio';

async function evidence(name: string, value: unknown) {
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/lux-e-audio-${name}.json`, JSON.stringify(value, null, 2) + '\n');
}

async function open(page: Page) {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.hero.x = w.hero.y = -500;
    w.hero.previous = { x: -500, y: -500 };
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const p = {
      lux,
      calls: [] as any[],
      synth: 0,
      update: () => {
        a.updateLuxE(w, { x: 0, y: 0 });
        a.update(
          w.events.filter((e: any) => e.type === 'cast'),
          w.tick
        );
      },
      cast: () => {
        w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: 0 } });
        w.step();
      },
    };
    const createGain = a.context.createGain.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        set = gain.gain.setValueAtTime.bind(gain.gain),
        ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
      gain.scheduledValues = [];
      gain.scheduledRamps = [];
      gain.gain.setValueAtTime = (value: number, when: number) => {
        gain.scheduledValues.push([value, when]);
        return set(value, when);
      };
      gain.gain.linearRampToValueAtTime = (value: number, when: number) => {
        gain.scheduledRamps.push([value, when]);
        return ramp(value, when);
      };
      return gain;
    };
    const create = a.context.createBufferSource.bind(a.context),
      osc = a.context.createOscillator.bind(a.context);
    a.context.createOscillator = () => {
      p.synth++;
      return osc();
    };
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const [key, v] = [...a.luxE.voices].find(([, v]: any) => v.source === source) as any;
        p.calls.push({
          key,
          kind: v.kind,
          variant: v.variant,
          offset,
          loop: source.loop,
          frames: source.buffer.length,
          rate: source.buffer.sampleRate,
        });
        return start(when, offset);
      };
      return source;
    };
    (window as any).__E_AUDIO__ = p;
  });
}

test('all twelve source clips decode to the exact master PCM in Chrome', async ({ page }) => {
  await open(page);
  const clips = await page.evaluate(async () => {
    const a = (window as any).__GAME__.audio.luxE;
    const clips = [];
    for (const [kind, buffers] of Object.entries(a.buffers) as any)
      for (const [variant, b] of buffers.entries()) {
        const bytes = b.getChannelData(0).buffer;
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        clips.push({
          kind,
          variant,
          frames: b.length,
          rate: b.sampleRate,
          channels: b.numberOfChannels,
          hash: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''),
        });
      }
    return clips;
  });
  await evidence('pcm', clips);
  expect(clips).toHaveLength(12);
  for (const c of clips) {
    const clip = P[c.kind as keyof Omit<typeof P, 'attenuation'>].variants[c.variant];
    expect(c).toMatchObject({
      frames: clip.frames,
      rate: 44100,
      channels: 1,
      hash: clip.pcmSha256,
    });
  }
});

test('real finite voices respect delays, source fade, pause, mute, restored offsets and early recast', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__E_AUDIO__;
    p.cast();
    p.update();
    p.update();
    const cast = p.calls.slice();
    w.step(20);
    p.update();
    const before = p.calls.filter((c: any) => c.kind === 'flight').length;
    w.step();
    p.update();
    const flight = p.calls.filter((c: any) => c.kind === 'flight').at(-1);
    a.setPaused(true);
    await a.transition;
    const paused = a.context.state;
    a.setPaused(false);
    await a.transition;
    a.enabled = false;
    const muted = a.luxE.voices.size;
    w.step(53);
    a.enabled = true;
    p.update();
    const zone = p.calls.filter((c: any) => c.kind === 'zoneDelayed').at(-1);
    const fade = [...a.luxE.voices.values()].find((v: any) => v.kind === 'flight') as any;
    const remaining = fade.source.buffer.duration;
    const flightFade = fade.envelope.scheduledValues.at(-1)[0];
    const flightFadeDuration =
      fade.envelope.scheduledRamps.at(-1)[1] - fade.envelope.scheduledValues.at(-1)[1];
    const snapshot = w.snapshot();
    const { World } = await import('/src/simulation/world.ts');
    const restored = World.fromSnapshot(snapshot, w.battlefield);
    a.updateLuxE(restored, { x: 0, y: 0 });
    const afterRestore = p.calls.slice(-4);
    w.enqueue({ type: 'cast', unit: p.lux.id, ability: 'e', point: p.lux });
    w.step();
    p.update();
    const kinds = [...a.luxE.voices.values()].map((v: any) => v.kind);
    const early = w.spawn('champion', 'blue', { x: 0, y: 100 }, 'lux');
    w.enqueue({ type: 'cast', unit: early.id, ability: 'e', point: { x: 600, y: 100 } });
    w.step();
    p.update();
    w.enqueue({ type: 'cast', unit: early.id, ability: 'e', point: early });
    w.step(45);
    p.update();
    const earlyCalls = p.calls.filter((c: any) => c.key.startsWith(`${early.id}:`));
    return {
      earlyCalls,
      cast,
      before,
      flight,
      paused,
      muted,
      zone,
      remaining,
      flightFade,
      flightFadeDuration,
      afterRestore,
      kinds,
      synth: p.synth,
    };
  });
  expect(result.cast).toHaveLength(1);
  expect(result.cast[0]).toMatchObject({ kind: 'cast', offset: 0, loop: false });
  expect(result.before).toBe(0);
  expect(result.flight).toMatchObject({ offset: 0, loop: false, rate: 44100 });
  expect(result.flightFade).toBeCloseTo(2 / 3);
  expect(result.flightFadeDuration).toBeCloseTo(1);
  expect(result.earlyCalls.some((c: any) => c.kind === 'zone' || c.kind === 'zoneDelayed')).toBe(
    false
  );
  expect(result.earlyCalls.some((c: any) => c.kind === 'hit')).toBe(true);
  expect(result.paused).toBe('suspended');
  expect(result.muted).toBe(0);
  expect(result.zone).toMatchObject({ offset: 0, loop: false });
  expect(result.afterRestore.find((c: any) => c.kind === 'flight').offset).toBeCloseTo(53 / 60);
  expect(result.kinds).not.toContain('zone');
  expect(result.kinds).not.toContain('zoneDelayed');
  expect(result.kinds).toContain('hit');
  expect(result.synth).toBe(0);
  expect(errors).toEqual([]);
  await evidence('lifecycle', result);
});

test('fog disconnects enemy phase points and returns at the current phase; fallback cast never doubles', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__E_AUDIO__;
    const enemy = w.spawn('champion', 'red', { x: 0, y: 0 }, 'lux');
    enemy.ai = false;
    let seen = false;
    w.pointVisible = () => seen;
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'e', point: { x: 600, y: 0 } });
    w.step(25);
    a.updateLuxE(w);
    const hidden = a.luxE.voices.size;
    seen = true;
    a.updateLuxE(w);
    const heard = p.calls.slice();
    seen = false;
    a.updateLuxE(w);
    const gone = a.luxE.voices.size;
    w.step(10);
    seen = true;
    a.updateLuxE(w);
    const returned = p.calls.slice(heard.length);
    a.luxE.stop();
    p.calls = [];
    w.units = w.units.filter((u: any) => u.id !== enemy.id);
    w.singularities = [];
    w.luxEAudio.records = [];
    a.lastId = Math.max(0, ...w.events.map((e: any) => e.id));
    a.luxE.status = 'failed';
    p.cast();
    p.update();
    const fallback = p.synth;
    a.luxE.status = 'ready';
    p.update();
    return { hidden, heard, gone, returned, fallback, late: p.calls };
  });
  expect(result.hidden).toBe(0);
  expect(result.gone).toBe(0);
  expect(result.heard.find((c: any) => c.kind === 'flight').offset).toBeCloseTo(3 / 60);
  expect(result.returned.find((c: any) => c.kind === 'flight').offset).toBeCloseTo(13 / 60);
  expect(result.fallback).toBe(1);
  expect(result.late.filter((c: any) => c.kind === 'cast')).toEqual([]);
  await evidence('fog', result);
});

test('victory fades flight on the AudioContext clock while the checkpoint stays frozen', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__E_AUDIO__;
    p.cast();
    w.step(24);
    p.update();
    const nexus = w.spawn('nexus', 'red', { x: 5000, y: 5000 });
    w.damage(p.lux, nexus, 1e9, 'true');
    p.update();
    const snapshot = w.snapshot();
    const voices = () => [...a.luxE.voices.values()].map((v: any) => v.kind);
    const initial = voices();
    await new Promise((r) => setTimeout(r, 1750));
    p.update();
    return { initial, ended: voices(), same: w.snapshot() === snapshot };
  });
  expect(result.initial).toContain('flight');
  expect(result.ended).toEqual([]);
  expect(result.same).toBe(true);
  await evidence('victory', result);
});

test('a real missing source file falls back once and a successful retry cannot double the cast', async ({
  page,
}) => {
  const url = '**/' + P.cast.variants[0].url;
  await page.route(url, (route) => route.abort());
  await open(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.luxE.status)).toBe('failed');
  await page.evaluate(() => {
    const p = (window as any).__E_AUDIO__;
    p.cast();
    p.update();
  });
  await page.unroute(url);
  await page.evaluate(async () => {
    const a = (window as any).__GAME__.audio;
    await a.luxE.load();
    (window as any).__E_AUDIO__.update();
  });
  const result = await page.evaluate(() => ({
    status: (window as any).__GAME__.audio.luxE.status,
    synth: (window as any).__E_AUDIO__.synth,
    calls: (window as any).__E_AUDIO__.calls,
  }));
  expect(result.status).toBe('ready');
  expect(result.synth).toBe(1);
  expect(result.calls).toEqual([]);
  await evidence('retry', result);
});

test('simultaneous Lux owners share the source caps and saved avoid-repeat cycle', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      a = (window as any).__GAME__.audio,
      p = (window as any).__E_AUDIO__;
    for (let i = 0; i < 6; i++) {
      const lux = w.spawn('champion', 'blue', { x: 0, y: i * 40 }, 'lux');
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: { x: 600, y: i * 40 } });
    }
    w.step();
    p.update();
    const cast = [...a.luxE.voices.values()].filter((v: any) => v.kind === 'cast').length;
    const variants = p.calls.map((c: any) => c.variant),
      before = p.calls.length;
    p.update();
    const duplicate = p.calls.length - before;
    w.step(21);
    p.update();
    const early = w.spawn('champion', 'blue', { x: 0, y: 100 }, 'lux');
    w.enqueue({ type: 'cast', unit: early.id, ability: 'e', point: { x: 600, y: 100 } });
    w.step();
    p.update();
    w.enqueue({ type: 'cast', unit: early.id, ability: 'e', point: early });
    w.step(45);
    p.update();
    const earlyCalls = p.calls.filter((c: any) => c.key.startsWith(`${early.id}:`));
    return {
      earlyCalls,
      cast,
      variants,
      duplicate,
      flight: [...a.luxE.voices.values()].filter((v: any) => v.kind === 'flight').length,
    };
  });
  expect(result.cast).toBe(2);
  expect(result.flight).toBe(4);
  expect(result.duplicate).toBe(0);
  expect(result.variants).toEqual([0, 1, 2, 3, 0, 1]);
  await evidence('caps', result);
});
