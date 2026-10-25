import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function boot(page: Page, npc = true) {
  await page.goto('/?scene=fixture' + (npc ? '&npc=leona' : ''));
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.hud.closeModal();
    g.setPaused(true);
    w.units = [w.hero, ...(u ? [u] : [])];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 800, y: -100, previous: { x: 800, y: -100 } });
    if (u) Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    if (u && !w.championState(u.id).spellRanks.q) w.learnSpell('q', u.id);
    return { caster: u?.id, target: target.id };
  });
}
async function instrument(page: Page) {
  await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      a = g.audio;
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const probe: any = {
      calls: [],
      synth: 0,
      update: () => {
        a.updateLeona(g.world, { x: 0, y: 0 });
        a.update(
          g.world.events.filter((e: any) => e.type === 'cast' || e.type === 'attack'),
          g.world.tick
        );
      },
    };
    const create = a.context.createBufferSource.bind(a.context),
      gain = a.context.createGain.bind(a.context),
      oscillator = a.context.createOscillator.bind(a.context);
    a.context.createGain = () => {
      const node = gain();
      node.__probe = [];
      for (const name of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues']) {
        const original = node.gain[name].bind(node.gain);
        node.gain[name] = (...args: any[]) => {
          node.__probe.push([
            name,
            ...args.map((v: number, i: number) =>
              i === args.length - 1 ? v - a.context.currentTime : v
            ),
          ]);
          return original(...args);
        };
      }
      return node;
    };
    a.context.createBufferSource = () => {
      const node = create(),
        start = node.start.bind(node),
        stop = node.stop.bind(node);
      let row: any;
      node.start = (when: number, offset: number) => {
        const c = a.leonaQ.controller,
          kind = c && Object.keys(c.buffers).find((k) => c.buffers[k].includes(node.buffer));
        if (kind) {
          const owned = [...c.voices].find(([, v]: any) => v.source === node) as any;
          row = {
            key: owned[0],
            kind,
            variant: c.buffers[kind].indexOf(node.buffer),
            offset,
            rate: node.playbackRate.value,
            loop: node.loop,
            stops: [],
            gain: owned[1].envelope.__probe,
          };
          probe.calls.push(row);
        }
        start(when, offset);
      };
      node.stop = (when?: number) => {
        if (row) row.stops.push(when === undefined ? null : when - a.context.currentTime);
        stop(when);
      };
      return node;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return oscillator();
    };
    (window as any).__DAYBREAK_AUDIO__ = probe;
  });
}
const comparable = (rows: any[]) => rows.map(({ stops: _stops, gain: _gain, ...rest }) => rest);

test('Daybreak source cast, swing, hit and stop fade restore through Save/reload with identical futures', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await boot(page);
  await instrument(page);
  const prepared = await page.evaluate(async ({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DAYBREAK_AUDIO__,
      a = g.audio;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(caster) });
    w.step();
    p.update();
    const activation = structuredClone(p.calls);
    w.setOrder(w.unit(caster), { type: 'attack', target });
    w.step(19);
    a.enabled = false;
    a.enabled = true;
    p.calls = [];
    p.update();
    const snapshot = w.snapshot();
    const copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
    copy.step(90);
    return {
      activation,
      calls: p.calls,
      snapshot,
      future: copy.snapshot(),
      tick: w.tick,
      synth: p.synth,
    };
  }, ids);
  expect(prepared.activation.map((c: any) => [c.kind, c.loop, c.offset])).toEqual([
    ['buff', true, 0],
    ['cast', false, 0],
  ]);
  expect(prepared.calls.map((c: any) => c.kind).sort()).toEqual(['attack', 'buff', 'cast', 'hit']);
  expect(prepared.calls.find((c: any) => c.kind === 'buff').stops.at(-1)).toBeCloseTo(27 / 60, 3);
  expect(
    prepared.calls
      .find((c: any) => c.kind === 'buff')
      .gain.some((v: any) => v[0] === 'setValueAtTime' && Math.abs(v[1] - 0.9) < 1e-6)
  ).toBe(true);
  expect(prepared.synth).toBe(0);
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
  });
  await instrument(page);
  const restored = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      p = (window as any).__DAYBREAK_AUDIO__;
    p.update();
    const snapshot = g.world.snapshot();
    const copy = g.world.constructor.fromSnapshot(snapshot, g.world.battlefield);
    copy.step(90);
    return { calls: p.calls, snapshot, future: copy.snapshot(), synth: p.synth };
  });
  expect(restored.snapshot).toBe(prepared.snapshot);
  expect(restored.future).toBe(prepared.future);
  expect(comparable(restored.calls)).toEqual(comparable(prepared.calls));
  expect(restored.synth).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('saved-phases.json'),
    JSON.stringify({ prepared, restored, errors }, null, 2)
  );
});

test('a Q buff loops past its master, seeks after mute and drains at match end without changing the save', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__DAYBREAK_AUDIO__;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(caster) });
    w.step();
    p.update();
    w.step(200);
    a.enabled = false;
    a.enabled = true;
    p.calls = [];
    p.update();
    const resumed = structuredClone(p.calls);
    const inhibitor = w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 2500, y: 2500 });
    w.damage(w.hero, nexus, 1e9, 'true');
    p.update();
    const save = w.snapshot(),
      stop = structuredClone(p.calls);
    a.leonaTerminalStart -= 4;
    p.update();
    return {
      resumed,
      stop,
      winner: w.winner,
      remaining: a.leonaQ.controller.voices.size,
      sameSave: save === w.snapshot(),
      synth: p.synth,
    };
  }, ids);
  expect(result.resumed).toHaveLength(1);
  expect(result.resumed[0].kind).toBe('buff');
  expect(result.resumed[0].loop).toBe(true);
  expect(result.resumed[0].stops).toEqual([]);
  expect(result.resumed[0].offset).toBeCloseTo((200 / 60) % 2.4997732426303854, 6);
  expect(result.stop[0].stops.at(-1)).toBeCloseTo(0.5, 2);
  expect(result.winner).toBe('blue');
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  expect(result.synth).toBe(0);
  writeFileSync(info.outputPath('loop-terminal.json'), JSON.stringify(result, null, 2));
});

test('hidden Q activation and attack stay silent after later reveal', async ({ page }, info) => {
  await boot(page);
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DAYBREAK_AUDIO__;
    w.units = [w.hero];
    const u = w.spawn('champion', 'red', { x: 3500, y: 0 }, 'leona'),
      target = w.spawn('dummy', 'neutral', { x: 3650, y: 0 });
    u.ai = false;
    target.hp = target.maxHp = 100000;
    w.learnSpell('q', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: u });
    w.step();
    w.setOrder(u, { type: 'attack', target: target.id });
    w.step();
    p.update();
    const hidden = p.calls.length;
    Object.assign(w.hero, { x: 3500, y: 500, previous: { x: 3500, y: 500 } });
    w.step(2);
    p.update();
    const r = w.championState(u.id).leonaQVisuals[0];
    return {
      hidden,
      revealed: p.calls.length,
      visible: w.visible(u, 'blue'),
      cast: r.frames[0].audience,
      attack: r.frames.find((f: any) => f.tick === r.attackStarts[0]).audience,
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.visible).toBe(true);
  expect(result.cast).not.toContain('blue');
  expect(result.attack).not.toContain('blue');
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});

test('failed Q cast and attack use one fallback each and suppress their late source duplicates', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__DAYBREAK_AUDIO__,
      c = a.leonaQ.controller;
    c.status = 'failed';
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(caster) });
    w.step();
    p.update();
    w.setOrder(w.unit(caster), { type: 'attack', target });
    w.step(16);
    p.update();
    const synth = p.synth;
    c.status = 'ready';
    p.update();
    return { synth, late: p.calls.map((c: any) => c.kind), suppressed: c.fallbackCasts.size };
  }, ids);
  expect(result.synth).toBe(2);
  expect(result.late).toEqual(['buff', 'hit']);
  expect(result.suppressed).toBe(2);
  writeFileSync(info.outputPath('fallback.json'), JSON.stringify(result, null, 2));
});

test('finite Q cast finishes once at a frozen tick while the owned buff keeps looping', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(caster) });
    w.step();
    (window as any).__DAYBREAK_AUDIO__.update();
  }, ids);
  await page.waitForFunction(() =>
    [...(window as any).__GAME__.audio.leonaQ.controller.voices.values()].every(
      (v: any) => v.kind === 'buff'
    )
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__DAYBREAK_AUDIO__,
      c = g.audio.leonaQ.controller,
      before = p.calls.length;
    const tick = g.world.tick;
    for (let i = 0; i < 20; i++) p.update();
    const remaining = c.voices.size;
    g.audio.enabled = false;
    return {
      before,
      after: p.calls.length,
      remaining,
      afterMute: c.voices.size,
      finished: c.finished.size,
      sameTick: tick === g.world.tick,
    };
  });
  expect(result).toEqual({
    before: 2,
    after: 2,
    remaining: 1,
    afterMute: 0,
    finished: 1,
    sameTick: true,
  });
  writeFileSync(info.outputPath('finite-completion.json'), JSON.stringify(result, null, 2));
});

test('failed Q masters settle readiness and do not retry every frame', async ({ page }, info) => {
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-q-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaQ.status)).toBe('failed');
  const result = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DAYBREAK_AUDIO__;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(caster) });
    w.step();
    for (let i = 0; i < 30; i++) p.update();
    return { calls: p.calls, synth: p.synth };
  }, ids);
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(1);
  expect(requests).toHaveLength(13);
  expect(new Set(requests).size).toBe(13);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});
