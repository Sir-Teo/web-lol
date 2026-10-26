import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { MASTER_YI_AA_AUDIO as P } from '../src/content/masteryi-aa-audio';
let errors: string[] = [];
test.beforeEach(({ page }) => {
  test.setTimeout(120000);
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function open(page: Page, reset = true, url = '/?scene=fixture&champion=masteryi') {
  if (reset) {
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  }
  await page.evaluate(async (reset) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    if (reset) {
      w.units = [w.hero];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
      w.setOrder(w.hero, { type: 'idle' });
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const sound = a.masterYiAA.controller,
      probe = {
        calls: [] as any[],
        synth: 0,
        update: () => {
          a.updateGaren(w);
          a.update(
            w.events.filter((e: any) => e.type === 'attack'),
            w.tick
          );
        },
      };
    const create = a.context.createBufferSource.bind(a.context),
      osc = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        if (sound) {
          const media = [...sound.buffers].find(([, b]) => b === source.buffer)?.[0],
            entry = [...sound.voices].find(([, v]: any) => v.source === source);
          if (media && entry)
            probe.calls.push({
              media,
              key: entry[0],
              profileIndex: Number(entry[0].split(':').at(-1)),
              when,
              offset,
              rate: source.playbackRate.value,
              gain: entry[1].gain.gain.value,
              frames: source.buffer.length,
              loop: source.loop,
            });
        }
        return start(when, offset);
      };
      return source;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return osc();
    };
    (window as any).__AA__ = probe;
  }, reset);
}

test('all 24 source masters preserve exact float PCM in real browser AudioBuffers', async ({
  page,
}, info) => {
  await open(page);
  const clips = [...new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const))).values()];
  const result = await page.evaluate(async (clips) => {
    const sound = (window as any).__GAME__.audio.masterYiAA.controller;
    return Promise.all(
      clips.map(async (c) => {
        const data = await (await fetch('/' + c.url)).arrayBuffer(),
          view = new DataView(data);
        let expected: Float32Array | undefined;
        for (let i = 12; i < data.byteLength;) {
          const tag = String.fromCharCode(...new Uint8Array(data, i, 4)),
            length = view.getUint32(i + 4, true);
          if (tag === 'data') expected = new Float32Array(data.slice(i + 8, i + 8 + length));
          i += 8 + length + (length % 2);
        }
        if (!expected) throw Error('No source PCM');
        const b = sound.buffers.get(c.id),
          pcm = b.getChannelData(0);
        let differences = 0,
          peak = 0;
        for (let i = 0; i < pcm.length; i++) {
          if (pcm[i] !== expected[i]) differences++;
          peak = Math.max(peak, Math.abs(pcm[i]));
        }
        return {
          id: c.id,
          frames: b.length,
          sampleRate: b.sampleRate,
          channels: b.numberOfChannels,
          differences,
          peak,
        };
      })
    );
  }, clips);
  for (const c of clips)
    expect(result.find((r) => r.id === c.id)).toEqual({
      id: c.id,
      frames: c.frames,
      sampleRate: 44100,
      channels: 1,
      differences: 0,
      peak: c.peak,
    });
  writeFileSync(info.outputPath('float-masters.json'), JSON.stringify(result, null, 2));
});

test('normal and critical swings play their own delayed cast and material impact without synthesized duplicates', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      cases = [];
    w.battlefield.lineOfSight = () => true;
    for (const critical of [false, true]) {
      g.audio.masterYiAA.stop();
      w.setOrder(w.hero, { type: 'idle' });
      const target = w.spawn('siege', 'red', { x: 90, y: 0 });
      target.ai = false;
      target.hp = target.maxHp = 100000;
      w.criticalChance = () => (critical ? 1 : 0);
      w.step(Math.max(1, w.hero.nextAttackTick - w.tick + 1));
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step();
      const r = w.player.masterYiAAAudio.at(-1),
        before = p.calls.length;
      p.update();
      w.step(r.releaseTick - w.tick);
      p.update();
      cases.push({ critical, record: structuredClone(r), calls: p.calls.slice(before) });
      w.setOrder(w.hero, { type: 'idle' });
      w.step(200);
      p.update();
    }
    return { cases, synth: p.synth };
  });
  expect(result.synth).toBe(0);
  for (const c of result.cases) {
    expect(c.record.kind).toBe(c.critical ? 'crit' : 'attack1');
    expect(c.record.impact.material).toBe('Metal');
    expect(c.calls).toHaveLength(2);
    for (const call of c.calls) {
      const profile = P[call.profileIndex];
      expect(profile.kind).toBe(c.record.kind);
      expect(profile.variants.some((v) => v.id === call.media)).toBe(true);
      expect(call.loop).toBe(false);
      expect(call.gain).toBeGreaterThan(0);
      expect(Math.abs(1200 * Math.log2(call.rate))).toBeLessThan(c.critical ? 200 : 100);
    }
    expect(P[c.calls[0].profileIndex].phase).toBe('cast');
    expect(P[c.calls[1].profileIndex].phase).toBe('hit');
  }
  writeFileSync(info.outputPath('attack-playback.json'), JSON.stringify(result, null, 2));
});

for (const critical of [false, true])
  test(`${critical ? 'critical' : 'normal'} mid-windup Save match and reload retain exact history, pitch-adjusted seek and future impact`, async ({
    page,
  }, info) => {
    await open(page);
    const before = await page.evaluate((critical) => {
      const g = (window as any).__GAME__,
        w = g.world;
      const target = w.spawn('siege', 'red', { x: 90, y: 0 });
      target.ai = false;
      target.hp = target.maxHp = 100000;
      w.criticalChance = () => (critical ? 1 : 0);
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.step(critical ? 15 : 7);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(100);
      return {
        saved,
        future: copy.snapshot(),
        record: structuredClone(w.player.masterYiAAAudio[0]),
        tick: w.tick,
      };
    }, critical);
    expect(before.record.kind).toBe(critical ? 'crit' : 'attack1');
    expect(before.tick).toBeLessThan(before.record.releaseTick);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before.saved);
    await open(page, false);
    const after = await page.evaluate((savedTick) => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__AA__;
      p.update();
      const restored = p.calls.slice();
      w.step(w.player.masterYiAAAudio[0].releaseTick - w.tick);
      p.update();
      const calls = p.calls.slice(),
        impact = structuredClone(w.player.masterYiAAAudio[0].impact);
      w.step(100 - (w.tick - savedTick));
      return { restored, calls, impact, future: w.snapshot() };
    }, before.tick);
    expect(after.restored).toHaveLength(1);
    const restored = after.restored[0],
      profile = P[restored.profileIndex];
    expect(restored.offset).toBeCloseTo(
      ((before.tick - before.record.startTick) / 60 - profile.delaySeconds) * restored.rate,
      10
    );
    expect(after.calls).toHaveLength(2);
    expect(after.impact.material).toBe('Metal');
    expect(after.future).toBe(before.future);
    writeFileSync(
      info.outputPath('attack-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('ordinary startup skips Yi audio and late Yi presence fetches each unique master once', async ({
  page,
}, info) => {
  let requests = 0;
  page.on('request', (r) => {
    if (/masteryi-aa-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(requests).toBe(0);
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    g.audio.updateGaren(g.world);
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.masterYiAA.status === 'ready');
  expect(requests).toBe(24);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.audio.updateGaren(g.world);
  });
  expect(requests).toBe(24);
  writeFileSync(info.outputPath('late-presence.json'), JSON.stringify({ initial: 0, requests }));
});

test('unseen creation cannot reveal a cast, while a known lethal contact survives the last local vision source dying', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__AA__;
    w.hero.hp = 1;
    const caster = w.spawn('champion', 'red', { x: 90, y: 0 }, 'masteryi');
    caster.ai = false;
    const visible = w.visible.bind(w);
    w.visible = (u: any, t: any = 'blue') =>
      u.id === caster.id && t === 'blue' ? false : visible(u, t);
    w.setOrder(caster, { type: 'attack', target: w.hero.id });
    w.step();
    p.update();
    const hidden = p.calls.length,
      r = w.championState(caster.id).masterYiAAAudio[0];
    w.step(r.releaseTick - w.tick);
    p.update();
    const after = p.calls.slice(),
      vision = w.pointVisible(r.impact.point),
      audiences = { cast: r.castAudience, hit: r.impact.audience };
    w.visible = () => true;
    p.update();
    return {
      hidden,
      after,
      vision,
      audiences,
      dead: w.hero.hp === 0,
      later: p.calls.length,
      voices: a.masterYiAA.controller.voices.size,
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.dead).toBe(true);
  expect(result.vision).toBe(false);
  expect(result.audiences.cast).not.toContain('blue');
  expect(result.audiences.hit).toContain('blue');
  expect(result.after).toHaveLength(1);
  expect(P[result.after[0].profileIndex].phase).toBe('hit');
  expect(result.later).toBe(1);
  writeFileSync('artifacts/masteryi-aa-fog-lethal.json', JSON.stringify(result, null, 2) + '\n');
});

test('missing/late media keep one bounded fallback and an explicit retry never doubles that swing', async ({
  page,
}) => {
  let attempts = 0,
    requests = 0;
  page.on('request', (r) => {
    if (/masteryi-aa-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.route('**/masteryi-aa-104024387.wav', (route) => {
    attempts++;
    return route.abort();
  });
  await open(page);
  const failed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      target = w.spawn('dummy', 'red', { x: 90, y: 0 });
    target.hp = target.maxHp = 10000;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const r = w.player.masterYiAAAudio[0];
    w.step(r.releaseTick - w.tick);
    for (let i = 0; i < 20; i++) p.update();
    return {
      status: g.audio.masterYiAA.status,
      calls: p.calls.length,
      synth: p.synth,
      start: r.startTick,
    };
  });
  expect(failed).toMatchObject({ status: 'failed', calls: 0, synth: 1 });
  expect(attempts).toBe(1);
  expect(requests).toBe(24);
  await page.unroute('**/masteryi-aa-104024387.wav');
  const recovered = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__AA__;
    await a.masterYiAA.load();
    p.update();
    const oldCalls = p.calls.length;
    w.step(w.hero.nextAttackTick - w.tick + 1);
    p.update();
    const r = w.player.masterYiAAAudio.at(-1);
    w.step(r.releaseTick - w.tick);
    p.update();
    return {
      status: a.masterYiAA.status,
      oldCalls,
      calls: p.calls,
      synth: p.synth,
      start: r.startTick,
    };
  });
  expect(recovered.status).toBe('ready');
  expect(recovered.oldCalls).toBe(0);
  expect(recovered.calls).toHaveLength(2);
  expect(recovered.synth).toBe(1);
  expect(recovered.start).toBeGreaterThan(failed.start);
  expect(requests).toBe(25);
  writeFileSync(
    'artifacts/masteryi-aa-failure.json',
    JSON.stringify({ failed, recovered, attempts, requests }, null, 2) + '\n'
  );
});

test('Leona uses her frozen Metal material, and Garen attacking player Yi saves and reloads exactly', async ({
  page,
}, info) => {
  await open(page);
  const before = await page.evaluate(async () => {
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], true, false, true);
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__;
    const leona = w.spawn('champion', 'red', { x: 90, y: 0 }, 'leona');
    leona.ai = false;
    w.setOrder(w.hero, { type: 'attack', target: leona.id });
    w.step();
    p.update();
    const r = w.player.masterYiAAAudio.at(-1);
    w.step(r.releaseTick - w.tick);
    p.update();
    const material = r.impact.material,
      calls = p.calls.slice();
    w.setOrder(w.hero, { type: 'idle' });
    const garen = w.spawn('champion', 'red', { x: -90, y: 0 }, 'garen');
    garen.ai = false;
    w.setOrder(garen, { type: 'attack', target: w.hero.id });
    w.step(5);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(120);
    return { material, calls, saved, future: copy.snapshot(), garenId: garen.id };
  });
  expect(before.material).toBe('Metal');
  expect(before.calls).toHaveLength(2);
  expect(P[before.calls[1].profileIndex]).toMatchObject({ phase: 'hit', material: 'Metal' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const after = await page.evaluate((garenId) => {
    const w = (window as any).__GAME__.world,
      saved = w.snapshot();
    w.step(120);
    return {
      saved,
      future: w.snapshot(),
      impact: w.championState(garenId).garenAAVisuals.at(-1)?.impact,
    };
  }, before.garenId);
  expect(after.saved).toBe(before.saved);
  expect(after.future).toBe(before.future);
  expect(after.impact.material).toBe('Flesh');
  writeFileSync(
    info.outputPath('champion-material-save.json'),
    JSON.stringify({ before, after }, null, 2)
  );
});
