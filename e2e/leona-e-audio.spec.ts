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
    const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    if (u && !w.championState(u.id).spellRanks.e) w.learnSpell('e', u.id);
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
          g.world.events.filter((e: any) => e.type === 'cast'),
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
        const c = a.leonaE.controller,
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
    (window as any).__ZENITH_AUDIO__ = probe;
  });
}
const comparable = (rows: any[]) => rows.map(({ stops: _stops, gain: _gain, ...rest }) => rest);

test('real Zenith playback restores pitched contacts and in-flight fade offsets through Save/reload and mute', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await boot(page);
  await instrument(page);
  const prepared = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__ZENITH_AUDIO__,
      a = g.audio;
    w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    p.update();
    const activation = p.calls.map((c: any) => ({ ...c }));
    while (!w.championState(caster).leonaEVisuals[0].flight?.stopTick) w.step();
    w.step(7);
    a.enabled = false;
    a.enabled = true;
    p.calls = [];
    p.update();
    return {
      activation,
      calls: p.calls,
      snapshot: w.snapshot(),
      tick: w.tick,
      stop: w.championState(caster).leonaEVisuals[0].flight.stopTick,
      synth: p.synth,
    };
  }, ids);
  expect(prepared.activation.map((c: any) => [c.kind, c.offset, c.rate, c.loop])).toEqual([
    ['cast', 0, 1, false],
  ]);
  expect(prepared.calls.map((c: any) => c.kind).sort()).toEqual([
    'championContact',
    'contact',
    'dash',
    'flight',
  ]);
  const contact = prepared.calls.find((c: any) => c.kind === 'contact'),
    flight = prepared.calls.find((c: any) => c.kind === 'flight');
  expect(contact.rate).toBeCloseTo(2 ** 0.25, 6);
  expect(contact.offset).toBeGreaterThan(0);
  expect(
    flight.gain.some((g: any) => g[0] === 'setValueAtTime' && Math.abs(g[1] - 8 / 15) < 1e-6)
  ).toBe(true);
  expect(flight.stops.at(-1)).toBeCloseTo(8 / 60, 3);
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
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__ZENITH_AUDIO__;
    p.update();
    return { calls: p.calls, snapshot: g.world.snapshot(), synth: p.synth };
  });
  expect(restored.snapshot).toBe(prepared.snapshot);
  expect(comparable(restored.calls)).toEqual(comparable(prepared.calls));
  expect(restored.synth).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('saved-phases.json'),
    JSON.stringify({ prepared, restored, errors }, null, 2)
  );
});

test('hidden cast and launch stay silent after reveal while a terminal flight tail drains against a frozen save', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__ZENITH_AUDIO__;
    w.units = w.units.filter((u: any) => u.id !== caster && u.champion !== 'lux');
    const enemy = w.spawn('champion', 'red', { x: 3000, y: 0 }, 'leona');
    enemy.ai = false;
    w.learnSpell('e', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'e', point: { x: 3900, y: 0 } });
    w.step(21);
    p.update();
    const hidden = p.calls.length;
    Object.assign(w.hero, { x: 3150, y: 500, previous: { x: 3150, y: 500 } });
    w.step(3);
    p.update();
    const revealed = p.calls.length;
    const r = w.championState(enemy.id).leonaEVisuals[0],
      audiences = { cast: r.castFrame.audience, flight: r.flight.audience },
      visible = w.pointVisible(r.flight.frames.at(-1));
    w.step(150);
    p.update();
    p.calls = [];
    const own = w.spawn('champion', 'blue', { x: 3150, y: 500 }, 'leona');
    own.ai = false;
    w.learnSpell('e', own.id);
    w.enqueue({ type: 'cast', unit: own.id, ability: 'e', point: { x: 4000, y: 500 } });
    w.step(21);
    p.update();
    const inhibitor = w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 2500, y: 2500 });
    w.damage(w.hero, nexus, 1e9, 'true');
    p.update();
    const before = p.calls.map((c: any) => ({ ...c })),
      save = w.snapshot();
    a.leonaTerminalStart -= 4;
    p.update();
    return {
      hidden,
      revealed,
      audiences,
      visible,
      before,
      winner: w.winner,
      remaining: a.leonaE.controller.voices.size,
      sameSave: w.snapshot() === save,
    };
  }, ids);
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.audiences.cast).not.toContain('blue');
  expect(result.audiences.flight).not.toContain('blue');
  expect(result.visible).toBe(true);
  expect(result.before.some((c: any) => c.kind === 'flight')).toBe(true);
  expect(result.winner).toBe('blue');
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('visibility-terminal.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('unavailable source cast uses one synthesized fallback and suppresses a late source duplicate', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__ZENITH_AUDIO__,
      c = a.leonaE.controller;
    c.status = 'failed';
    w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    p.update();
    const synth = p.synth;
    c.status = 'ready';
    p.update();
    const late = p.calls.map((c: any) => c.kind);
    w.step(20);
    p.update();
    return {
      synth,
      late,
      calls: p.calls.map((c: any) => c.kind),
      suppressed: c.fallbackCasts.size,
    };
  }, ids);
  expect(result.synth).toBe(1);
  expect(result.late).toEqual([]);
  expect(result.calls).toEqual(['flight']);
  expect(result.suppressed).toBe(1);
  writeFileSync(info.outputPath('fallback.json'), JSON.stringify(result, null, 2));
});

test('ordinary Ashe fixture requests no Zenith audio table, controller or masters', async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (
      /\/src\/(audio\/leona-e(?:-state)?\.ts|content\/leona-e-audio\.ts)|\/assets\/audio\/leona-e-/.test(
        r.url()
      )
    )
      requests.push(r.url());
  });
  await boot(page, false);
  await page.waitForTimeout(200);
  expect(requests).toEqual([]);
  writeFileSync(info.outputPath('lazy.json'), JSON.stringify({ requests }, null, 2));
});

test('finite source cast completes once at a frozen tick and releases every owned audio node', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const ids = await boot(page);
  await instrument(page);
  await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    (window as any).__ZENITH_AUDIO__.update();
  }, ids);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.leonaE.controller.voices.size === 0
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__ZENITH_AUDIO__,
      c = g.audio.leonaE.controller,
      before = p.calls.length,
      tick = g.world.tick;
    for (let i = 0; i < 20; i++) p.update();
    return {
      before,
      after: p.calls.length,
      sameTick: g.world.tick === tick,
      finished: c.finished.size,
      voices: c.voices.size,
    };
  });
  expect(result).toEqual({ before: 1, after: 1, sameTick: true, finished: 1, voices: 0 });
  writeFileSync(info.outputPath('finite-completion.json'), JSON.stringify(result, null, 2));
});

test('failed source files settle readiness, keep one fallback cast and do not retry every frame', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-e-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaE.status)).toBe('failed');
  const result = await page.evaluate(({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__ZENITH_AUDIO__;
    w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    for (let i = 0; i < 30; i++) p.update();
    return { calls: p.calls, synth: p.synth };
  }, ids);
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(1);
  expect(requests).toHaveLength(21);
  expect(new Set(requests).size).toBe(21);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});
