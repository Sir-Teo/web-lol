import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { GAREN_AA_AUDIO as P } from '../src/content/garen-aa-audio';
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function open(page: Page, reset = true, url = '/?scene=fixture&champion=garen') {
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
    const sound = a.garenAA.controller,
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

test('all thirty-four unique masters decode to exact floats with unchanged source headroom', async ({
  page,
}) => {
  await open(page);
  const clips = [...new Map(P.flatMap((p) => p.variants.map((v) => [v.id, v] as const))).values()];
  const result = await page.evaluate(async (clips) => {
    const sound = (window as any).__GAME__.audio.garenAA.controller;
    return Promise.all(
      clips.map(async (c) => {
        const raw = await (await fetch('/' + c.url)).arrayBuffer(),
          v = new DataView(raw);
        let data: ArrayBuffer | undefined;
        for (let i = 12; i < raw.byteLength;) {
          const tag = String.fromCharCode(...new Uint8Array(raw, i, 4)),
            size = v.getUint32(i + 4, true);
          if (tag === 'data') data = raw.slice(i + 8, i + 8 + size);
          i += 8 + size + (size % 2);
        }
        if (!data) throw Error('Missing float data');
        const expected = new Float32Array(data),
          buffer = sound.buffers.get(c.id),
          pcm = buffer.getChannelData(0);
        let differences = 0,
          peak = 0;
        for (let i = 0; i < pcm.length; i++) {
          if (pcm[i] !== expected[i]) differences++;
          peak = Math.max(peak, Math.abs(pcm[i]));
        }
        const digest = async (b: ArrayBuffer) =>
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('');
        return {
          id: c.id,
          frames: buffer.length,
          rate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          differences,
          peak,
          wav: await digest(raw),
          pcm: await digest(data),
        };
      })
    );
  }, clips);
  expect(result).toHaveLength(34);
  for (const c of clips) {
    const r = result.find((r) => r.id === c.id)!;
    expect(r).toMatchObject({
      frames: c.frames,
      rate: 44100,
      channels: 1,
      differences: 0,
      peak: c.peak,
      wav: c.sha256,
      pcm: c.pcmSha256,
    });
  }
  writeFileSync('artifacts/garen-aa-decoding.json', JSON.stringify(result, null, 2) + '\n');
});

test('two actual normal animations and all four skin-material hits use their own source profiles', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { garenAttackAnimation } = await import('/src/content/garen-attack-animation.ts');
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels(['red']);
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      p = (window as any).__AA__,
      cases = [];
    for (const [want, material] of [
      ['attack1', 'Flesh'],
      ['attack2', 'Flesh'],
      ['attack1', 'Metal'],
      ['attack2', 'Stone'],
      ['attack1', 'Wood'],
    ]) {
      w.units = [w.hero];
      w.setOrder(w.hero, { type: 'idle' });
      w.hero.x = w.hero.y = 400;
      w.hero.previous = { x: 400, y: 400 };
      p.update();
      const caster = w.spawn(
        'champion',
        material === 'Stone' ? 'red' : 'blue',
        { x: 0, y: 0 },
        'garen'
      );
      caster.ai = false;
      const target =
        material === 'Wood'
          ? w.spawnMonster({ x: 90, y: 0 }, null, 'red')
          : w.spawn(
              material === 'Flesh' ? 'dummy' : 'siege',
              material === 'Stone' ? 'blue' : 'red',
              { x: 90, y: 0 }
            );
      target.ai = false;
      target.hp = target.maxHp = 1e6;
      while (garenAttackAnimation(caster.id, w.tick + 1) !== want) w.step();
      w.setOrder(caster, { type: 'attack', target: target.id });
      w.step();
      const r = w.championState(caster.id).garenAAVisuals[0],
        before = p.calls.length;
      p.update();
      w.step(8);
      v.recenter(caster);
      v.zoom = 0.55;
      v.render(w, 1, v.previousElapsed);
      const clip = v.models.get(caster.id).actionName;
      w.step(r.releaseTick - w.tick);
      p.update();
      cases.push({
        want,
        material,
        kind: r.kind,
        clip,
        impact: r.impact,
        calls: p.calls.slice(before),
      });
      w.setOrder(caster, { type: 'idle' });
    }
    return { cases, synth: p.synth };
  });
  expect(result.synth).toBe(0);
  expect(result.cases).toHaveLength(5);
  for (const c of result.cases) {
    expect(c.kind).toBe(c.want);
    expect(c.clip).toBe(c.want);
    expect(c.impact.material).toBe(c.material);
    expect(c.calls).toHaveLength(2);
    const profiles = c.calls.map((v: any) => P[v.profileIndex]);
    expect(profiles[0]).toMatchObject({ kind: c.want, phase: 'cast', material: null });
    expect(profiles[1]).toMatchObject({ kind: c.want, phase: 'hit', material: c.material });
  }
  await page.screenshot({
    path: 'artifacts/garen-aa-source-swing.png',
    style: '.modal-backdrop{visibility:hidden!important}',
  });
  writeFileSync('artifacts/garen-aa-materials.json', JSON.stringify(result, null, 2) + '\n');
});

test('a cancelled swing has no hit and Q keeps its own independent source history', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      target = w.spawn('dummy', 'red', { x: 90, y: 0 });
    target.hp = target.maxHp = 10000;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    p.update();
    const r = w.player.garenAAVisuals[0];
    w.setOrder(w.hero, { type: 'idle' });
    w.step(20);
    p.update();
    const cancelled = { cancelTick: r.cancelTick, impact: r.impact, calls: p.calls.slice() };
    w.learnSpell('q');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step(25);
    p.update();
    return {
      cancelled,
      aaRecords: w.player.garenAAVisuals.length,
      qAttacks: w.player.garenQVisuals.at(-1).attacks.length,
      newCalls: p.calls.length - cancelled.calls.length,
    };
  });
  expect(result.cancelled.cancelTick).not.toBeNull();
  expect(result.cancelled.impact).toBeNull();
  expect(result.cancelled.calls).toHaveLength(1);
  expect(P[result.cancelled.calls[0].profileIndex].phase).toBe('cast');
  expect(result.aaRecords).toBe(1);
  expect(result.qAttacks).toBe(1);
  expect(result.newCalls).toBe(0);
  writeFileSync('artifacts/garen-aa-cancel.json', JSON.stringify(result, null, 2) + '\n');
});

test('real mid-windup save/reload retains the swing, its original source offset and the later material contact', async ({
  page,
}) => {
  await open(page);
  const prepared = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      target = w.spawn('siege', 'red', { x: 90, y: 0 });
    target.ai = false;
    target.hp = target.maxHp = 10000;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step(6);
    p.update();
    return { snapshot: w.snapshot(), kind: w.player.garenAAVisuals[0].kind, calls: p.calls };
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    prepared.snapshot
  );
  await open(page, false);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      r = w.player.garenAAVisuals[0];
    p.update();
    const restored = p.calls.slice();
    w.step(r.releaseTick - w.tick);
    p.update();
    return { restored, kind: r.kind, impact: r.impact, calls: p.calls };
  });
  expect(result.kind).toBe(prepared.kind);
  expect(result.restored).toHaveLength(1);
  expect(result.restored[0].offset).toBeCloseTo(5 / 60);
  expect(result.calls).toHaveLength(2);
  expect(result.impact.material).toBe('Metal');
  writeFileSync(
    'artifacts/garen-aa-reload.json',
    JSON.stringify({ ...result, identicalSnapshot: true }, null, 2) + '\n'
  );
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
    const caster = w.spawn('champion', 'red', { x: 90, y: 0 }, 'garen');
    caster.ai = false;
    const visible = w.visible.bind(w);
    w.visible = (u: any, t: any = 'blue') =>
      u.id === caster.id && t === 'blue' ? false : visible(u, t);
    w.setOrder(caster, { type: 'attack', target: w.hero.id });
    w.step();
    p.update();
    const hidden = p.calls.length,
      r = w.championState(caster.id).garenAAVisuals[0];
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
      voices: a.garenAA.controller.voices.size,
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
  writeFileSync('artifacts/garen-aa-fog-lethal.json', JSON.stringify(result, null, 2) + '\n');
});

test('both critical layers retain source pitch/gain and drain once after actual victory', async ({
  page,
}) => {
  await open(page);
  const prepared = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA__,
      target = w.spawn('champion', 'red', { x: 90, y: 0 }, 'lux');
    target.ai = false;
    target.hp = 1;
    w.criticalChance = () => 1;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    p.update();
    const r = w.player.garenAAVisuals[0];
    w.step(r.releaseTick - w.tick);
    p.update();
    const nexus = w.spawn('nexus', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    p.update();
    return { snapshot: w.snapshot(), kind: r.kind, calls: p.calls };
  });
  expect(prepared.kind).toBe('crit');
  expect(prepared.calls).toHaveLength(4);
  for (const c of prepared.calls) {
    const profile = P[c.profileIndex];
    expect(c.rate).toBeCloseTo(2 ** (profile.pitchCents / 1200));
    expect(c.loop).toBe(false);
    expect(c.gain).toBeGreaterThan(0);
  }
  expect(prepared.calls[0].when).toBe(prepared.calls[1].when);
  expect(prepared.calls[2].when).toBe(prepared.calls[3].when);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.garenAA.controller.voices.size === 0,
    {},
    { timeout: 5000 }
  );
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__AA__;
    g.audio.enabled = false;
    g.audio.enabled = true;
    p.update();
    return {
      snapshot: g.world.snapshot(),
      calls: p.calls.length,
      voices: g.audio.garenAA.controller.voices.size,
    };
  });
  expect(after.snapshot).toBe(prepared.snapshot);
  expect(after.calls).toBe(4);
  expect(after.voices).toBe(0);
  writeFileSync(
    'artifacts/garen-aa-critical.json',
    JSON.stringify(
      {
        prepared: { kind: prepared.kind, calls: prepared.calls },
        after: { calls: after.calls, voices: 0, unchanged: true },
      },
      null,
      2
    ) + '\n'
  );
});

test('missing/late media keep one bounded fallback and an explicit retry never doubles that swing', async ({
  page,
}) => {
  let attempts = 0,
    requests = 0;
  page.on('request', (r) => {
    if (/garen-aa-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.route('**/garen-aa-1246050.wav', (route) => {
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
    const r = w.player.garenAAVisuals[0];
    w.step(r.releaseTick - w.tick);
    for (let i = 0; i < 20; i++) p.update();
    return {
      status: g.audio.garenAA.status,
      calls: p.calls.length,
      synth: p.synth,
      start: r.startTick,
    };
  });
  expect(failed).toMatchObject({ status: 'failed', calls: 0, synth: 1 });
  expect(attempts).toBe(1);
  expect(requests).toBe(34);
  await page.unroute('**/garen-aa-1246050.wav');
  const recovered = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__AA__;
    await a.garenAA.load();
    p.update();
    const oldCalls = p.calls.length;
    w.step(w.hero.nextAttackTick - w.tick + 1);
    p.update();
    const r = w.player.garenAAVisuals.at(-1);
    w.step(r.releaseTick - w.tick);
    p.update();
    return {
      status: a.garenAA.status,
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
  expect(requests).toBe(35);
  writeFileSync(
    'artifacts/garen-aa-failure.json',
    JSON.stringify({ failed, recovered, attempts, requests }, null, 2) + '\n'
  );
});

test('ordinary Ashe startup skips attack masters and a late Garen loads each unique media once', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (r) => {
    if (/garen-aa-\d+\.wav$/.test(r.url())) requests++;
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(requests).toBe(0);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const u = g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    u.ai = false;
    g.audio.updateGaren(g.world);
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenAA.status === 'ready');
  expect(requests).toBe(34);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.audio.updateGaren(g.world);
  });
  expect(requests).toBe(34);
  writeFileSync(
    'artifacts/garen-aa-late-presence.json',
    JSON.stringify({ requests, uniqueMedia: 34, initial: 0 }, null, 2) + '\n'
  );
});
