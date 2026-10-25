import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(({ page }) => expect(browserErrors.get(page)).toEqual([]));
async function boot(page: Page) {
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.hud.closeModal();
    g.setPaused(true);
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -200, y: 0, previous: { x: -200, y: 0 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) {
      v.ai = false;
      w.setOrder(v, { type: 'idle' });
    }
    return { caster: u.id, target: target.id };
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
    const p: any = { calls: [], synth: 0, update: () => a.updateLeona(g.world, { x: 0, y: 0 }) },
      create = a.context.createBufferSource.bind(a.context),
      oscillator = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const node = create(),
        start = node.start.bind(node),
        stop = node.stop.bind(node);
      let row: any;
      node.start = (when: number, offset: number) => {
        const c = a.leonaSunlight.controller,
          owned = c && ([...c.voices].find(([, v]: any) => v.source === node) as any);
        if (owned) {
          row = {
            key: owned[0],
            variant: c.buffers.hit.indexOf(node.buffer),
            offset,
            rate: node.playbackRate.value,
            loop: node.loop,
            gain: owned[1].spatial.gain.value,
            stops: [],
          };
          p.calls.push(row);
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
      p.synth++;
      return oscillator();
    };
    (window as any).__SUNLIGHT_AUDIO__ = p;
  });
}
const comparable = (rows: any[]) => rows.map(({ stops: _stops, ...r }) => r);
for (const lethal of [false, true]) {
  test(`accepted ${lethal ? 'lethal' : 'moving'} Sunlight source contact restores through Save/reload with identical futures`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ids = await boot(page);
    await instrument(page);
    const prepared = await page.evaluate(
      ({ caster, target, lethal }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          p = (window as any).__SUNLIGHT_AUDIO__,
          a = g.audio,
          t = w.unit(target);
        if (lethal) t.hp = 10;
        w.applySunlight(w.unit(caster), t);
        w.damage(w.hero, t, 1, 'physical');
        p.update();
        const initial = structuredClone(p.calls);
        if (!lethal) w.setOrder(t, { type: 'move', point: { x: 600, y: 0 } });
        w.step(7);
        a.enabled = false;
        a.enabled = true;
        p.calls = [];
        p.update();
        const snapshot = w.snapshot(),
          copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
        copy.step(90);
        return {
          initial,
          calls: p.calls,
          snapshot,
          future: copy.snapshot(),
          record: w.sunlightVisuals[0],
          synth: p.synth,
        };
      },
      { ...ids, lethal }
    );
    expect(prepared.initial).toHaveLength(1);
    expect(prepared.initial[0]).toMatchObject({ offset: 0, rate: 1, loop: false });
    expect(prepared.initial[0].gain).toBeCloseTo(0.2 * 10 ** (-12 / 20), 6);
    expect(prepared.calls).toHaveLength(1);
    expect(prepared.calls[0].offset).toBeCloseTo(7 / 60, 6);
    expect(prepared.record.sourceId).toBe(ids.caster);
    expect(prepared.record.targetId).toBe(ids.target);
    expect(prepared.record.detachedTick === null).toBe(!lethal);
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
        p = (window as any).__SUNLIGHT_AUDIO__;
      p.update();
      const snapshot = g.world.snapshot(),
        copy = g.world.constructor.fromSnapshot(snapshot, g.world.battlefield);
      copy.step(90);
      return { calls: p.calls, snapshot, future: copy.snapshot(), synth: p.synth };
    });
    expect(restored.snapshot).toBe(prepared.snapshot);
    expect(restored.future).toBe(prepared.future);
    expect(comparable(restored.calls)).toEqual(comparable(prepared.calls));
    expect(restored.synth).toBe(0);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('saved-source.json'),
      JSON.stringify({ lethal, prepared, restored, errors }, null, 2)
    );
  });
}

test('a hidden accepted Sunlight contact stays silent after later reveal', async ({
  page,
}, info) => {
  await boot(page);
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__SUNLIGHT_AUDIO__;
    w.units = [w.hero];
    const leona = w.spawn('champion', 'red', { x: 3500, y: 0 }, 'leona'),
      ally = w.spawn('champion', 'red', { x: 3500, y: 100 }, 'garen'),
      target = w.spawnMonster({ x: 3650, y: 0 }, null, 'red');
    target.hp = target.maxHp = 100000;
    for (const u of w.units) u.ai = false;
    w.applySunlight(leona, target);
    w.damage(ally, target, 1, 'physical');
    p.update();
    const hidden = p.calls.length;
    Object.assign(w.hero, { x: 3500, y: 500, previous: { x: 3500, y: 500 } });
    w.step(2);
    p.update();
    return {
      hidden,
      calls: p.calls,
      audience: w.sunlightVisuals[0].audience,
      visible: w.visible(target, 'blue'),
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.calls).toEqual([]);
  expect(result.visible).toBe(true);
  expect(result.audience).not.toContain('blue');
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});

test('finite Sunlight completes once at a frozen tick and releases every node', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.applySunlight(w.unit(caster), w.unit(target));
    w.damage(w.hero, w.unit(target), 1, 'physical');
    (window as any).__SUNLIGHT_AUDIO__.update();
  }, ids);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.leonaSunlight.controller.voices.size === 0
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__SUNLIGHT_AUDIO__,
      c = g.audio.leonaSunlight.controller,
      saved = g.world.snapshot();
    for (let i = 0; i < 20; i++) p.update();
    return {
      calls: p.calls,
      remaining: c.voices.size,
      finished: c.finished.size,
      sameSave: saved === g.world.snapshot(),
    };
  });
  expect(result.calls).toHaveLength(1);
  expect(result.remaining).toBe(0);
  expect(result.finished).toBe(1);
  expect(result.sameSave).toBe(true);
  writeFileSync(info.outputPath('finite.json'), JSON.stringify(result, null, 2));
});

test('Sunlight match-end tails drain on the audio clock without changing saved gameplay', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__SUNLIGHT_AUDIO__;
    w.applySunlight(w.unit(caster), w.unit(target));
    w.damage(w.hero, w.unit(target), 1, 'physical');
    p.update();
    const before = a.leonaSunlight.controller.voices.size;
    const inhibitor = w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 2500, y: 2500 });
    w.damage(w.hero, nexus, 1e9, 'true');
    p.update();
    const saved = w.snapshot(),
      tick = w.tick;
    a.leonaTerminalStart -= 4;
    p.update();
    return {
      before,
      remaining: a.leonaSunlight.controller.voices.size,
      sameSave: saved === w.snapshot(),
      sameTick: tick === w.tick,
      winner: w.winner,
    };
  }, ids);
  expect(result.before).toBe(1);
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  expect(result.sameTick).toBe(true);
  expect(result.winner).toBe('blue');
  writeFileSync(info.outputPath('terminal.json'), JSON.stringify(result, null, 2));
});

test('same-tick Sunlight consumptions preserve distinct serials and the authored two-voice cap', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__SUNLIGHT_AUDIO__,
      c = g.audio.leonaSunlight.controller;
    for (let i = 0; i < 10; i++) {
      w.applySunlight(w.unit(caster), w.unit(target));
      w.damage(w.hero, w.unit(target), 1, 'physical');
    }
    p.update();
    const voices = [...c.voices.keys()],
      finished = c.finished.size;
    g.audio.enabled = false;
    return {
      calls: p.calls,
      voices,
      finished,
      afterMute: c.voices.size,
      start: w.sunlightVisuals[0].startTick,
    };
  }, ids);
  expect(result.calls).toHaveLength(10);
  expect(result.voices).toEqual([`9:${result.start}:hit`, `10:${result.start}:hit`]);
  expect(result.finished).toBe(8);
  expect(result.afterMute).toBe(0);
  writeFileSync(info.outputPath('caps.json'), JSON.stringify(result, null, 2));
});

test('failed Sunlight masters settle readiness without frame retries or invented fallback cues', async ({
  page,
}, info) => {
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-sunlight-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaSunlight.status)).toBe(
    'failed'
  );
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__SUNLIGHT_AUDIO__;
    w.applySunlight(w.unit(caster), w.unit(target));
    w.damage(w.hero, w.unit(target), 1, 'physical');
    for (let i = 0; i < 30; i++) p.update();
    return { calls: p.calls, synth: p.synth, records: w.sunlightVisuals.length };
  }, ids);
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(0);
  expect(result.records).toBe(1);
  expect(requests).toHaveLength(3);
  expect(new Set(requests).size).toBe(3);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});
