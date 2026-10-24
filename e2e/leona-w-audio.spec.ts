import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function boot(page: Page, npc = true) {
  await page.goto('/?scene=fixture' + (npc ? '&npc=leona' : ''));
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const u = w.units.find((u: any) => u.champion === 'leona');
    w.units = [w.hero, ...(u ? [u] : [])];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const v of w.units) v.ai = false;
    Object.assign(w.hero, { x: -300, y: 0, previous: { x: -300, y: 0 } });
    if (u) Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 10000;
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
      oscillator = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const s = create(),
        start = s.start.bind(s),
        stop = s.stop.bind(s);
      let row: any;
      s.start = (when: number, offset: number) => {
        const c = a.leonaW.controller,
          kind = c && Object.keys(c.buffers).find((k) => c.buffers[k].includes(s.buffer));
        if (kind) {
          row = {
            kind,
            variant: c.buffers[kind].indexOf(s.buffer),
            offset,
            loop: s.loop,
            stops: [],
          };
          probe.calls.push(row);
        }
        start(when, offset);
      };
      s.stop = (when?: number) => {
        if (row) row.stops.push(when === undefined ? null : when - a.context.currentTime);
        stop(when);
      };
      return s;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return oscillator();
    };
    (window as any).__LEONA_AUDIO__ = probe;
  });
}
async function cast(page: Page, caster: number) {
  return page.evaluate((caster) => {
    const w = (window as any).__GAME__.world,
      u = w.unit(caster);
    w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
    w.step();
    (window as any).__LEONA_AUDIO__.update();
    return w.tick;
  }, caster);
}
test('real Eclipse playback restores offsets through Save/reload, mute, hit and miss without looping or synthesized duplicates', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaW.status)).toBe('ready');
  const start = await cast(page, ids.caster);
  const active = await page.evaluate(() => (window as any).__LEONA_AUDIO__.calls);
  expect(active.map((c: any) => [c.kind, c.offset, c.loop])).toEqual([
    ['cast', 0, false],
    ['initial', 0, false],
  ]);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(187);
    g.audio.enabled = false;
    g.audio.enabled = true;
    (window as any).__LEONA_AUDIO__.calls = [];
    (window as any).__LEONA_AUDIO__.update();
  });
  const before = await page.evaluate(() => ({
    calls: (window as any).__LEONA_AUDIO__.calls,
    snapshot: (window as any).__GAME__.world.snapshot(),
  }));
  expect(before.calls.map((c: any) => c.kind)).toEqual(['initial', 'extended', 'hit']);
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
    (window as any).__LEONA_AUDIO__.update();
    return {
      calls: (window as any).__LEONA_AUDIO__.calls,
      snapshot: (window as any).__GAME__.world.snapshot(),
    };
  });
  expect(restored.snapshot).toBe(before.snapshot);
  const comparable = (rows: any[]) => rows.map(({ stops: _contextTimes, ...rest }) => rest);
  expect(comparable(restored.calls)).toEqual(comparable(before.calls));
  const miss = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(caster),
      p = (window as any).__LEONA_AUDIO__;
    w.step(700);
    g.audio.enabled = false;
    g.audio.enabled = true;
    w.unit(target).x = 3000;
    w.championState(caster).cooldowns.w = 0;
    u.mana = u.maxMana;
    w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
    w.step();
    w.step(185);
    p.calls = [];
    p.update();
    return { calls: p.calls, synth: p.synth, tick: w.tick };
  }, ids);
  expect(miss.calls.map((c: any) => c.kind)).toEqual(['initial', 'miss']);
  expect(miss.synth).toBe(0);
  expect(miss.calls.every((c: any) => c.loop === false)).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('saved-phases.json'),
    JSON.stringify({ start, active, before, restored, miss, errors }, null, 2)
  );
});
test('hidden activation stays silent after reveal; a newly visible burst plays once and terminal tails drain against a frozen save', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(async ({ caster }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      probe = (window as any).__LEONA_AUDIO__;
    // A real hidden enemy cast, followed by an ordinary visibility recomputation.
    w.units = w.units.filter((u: any) => u.id !== caster && u.champion !== 'lux');
    const enemy = w.spawn('champion', 'red', { x: 3000, y: 0 }, 'leona');
    enemy.ai = false;
    w.learnSpell('w', enemy.id);
    w.step();
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step();
    probe.update();
    const hidden = probe.calls.length;
    w.hero.x = 2850;
    w.hero.y = 0;
    w.hero.previous = { x: 2850, y: 0 };
    w.step(30);
    probe.update();
    const revealed = probe.calls.length;
    w.step(150);
    probe.update();
    const burst = probe.calls.map((c: any) => ({ ...c }));
    const inhibitor = w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1200, y: 1000 });
    w.damage(w.hero, nexus, 1e9, 'true');
    const save = w.snapshot();
    probe.update();
    a.leonaTerminalStart -= 8;
    probe.update();
    return {
      hidden,
      revealed,
      burst,
      winner: w.winner,
      remaining: a.leonaW.controller.voices.size,
      sameSave: save === w.snapshot(),
      born: w.championState(enemy.id).leonaWVisuals[0].frames[0].audience,
    };
  }, ids);
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.born).not.toContain('blue');
  expect(result.burst.map((c: any) => c.kind)).toEqual(['extended', 'hit']);
  expect(result.winner).toBe('blue');
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  writeFileSync(info.outputPath('audience-terminal.json'), JSON.stringify(result, null, 2));
});
test('late source loading preserves fallback cast identity and loads no Leona recordings in an ordinary startup', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/leona-w-') && r.url().endsWith('.wav')) requests.push(r.url());
  });
  await boot(page, false);
  expect(requests).toEqual([]);
  await instrument(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/audio/leona-w-*.wav', async (route) => {
    await held;
    await route.continue();
  });
  const id = await page.evaluate(async () => {
    const modulePath = '/src/render/models.ts';
    const models = await import(modulePath);
    await models.loadReferenceModels([], true);
    const g = (window as any).__GAME__,
      u = g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
    u.ai = false;
    g.world.learnSpell('w', u.id);
    g.audio.updateLeona(g.world);
    return u.id;
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.leonaW.status === 'loading');
  await cast(page, id);
  expect(await page.evaluate(() => (window as any).__LEONA_AUDIO__.synth)).toBe(1);
  release();
  await page.waitForFunction(() => (window as any).__GAME__.audio.leonaW.status === 'ready');
  const result = await page.evaluate(() => {
    const p = (window as any).__LEONA_AUDIO__;
    p.update();
    return { calls: p.calls, synth: p.synth };
  });
  expect(requests).toHaveLength(18);
  expect(result.calls.map((c: any) => c.kind)).toEqual(['initial']);
  expect(result.synth).toBe(1);
  writeFileSync(
    info.outputPath('late-load.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});

test('finite sources finish once at a frozen tick and release every Web Audio node', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const ids = await boot(page);
  await instrument(page);
  await cast(page, ids.caster);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.leonaW.controller.voices.size === 0
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__LEONA_AUDIO__,
      a = g.audio.leonaW.controller;
    const before = p.calls.length,
      tick = g.world.tick;
    for (let i = 0; i < 20; i++) p.update();
    return {
      before,
      after: p.calls.length,
      tick,
      sameTick: tick === g.world.tick,
      finished: a.finished.size,
      voices: a.voices.size,
    };
  });
  expect(result.before).toBe(2);
  expect(result.after).toBe(2);
  expect(result.sameTick).toBe(true);
  expect(result.finished).toBe(2);
  expect(result.voices).toBe(0);
  writeFileSync(info.outputPath('finite-completion.json'), JSON.stringify(result, null, 2));
});

test('failed source files settle readiness, keep one fallback cast and do not retry every frame', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-w-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaW.status)).toBe('failed');
  await cast(page, ids.caster);
  const result = await page.evaluate(() => {
    const p = (window as any).__LEONA_AUDIO__;
    for (let i = 0; i < 30; i++) p.update();
    return { calls: p.calls, synth: p.synth };
  });
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(1);
  expect(requests).toHaveLength(18);
  expect(new Set(requests).size).toBe(18);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});
