import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const rows: string[] = [];
  errors.set(page, rows);
  page.on('pageerror', (e) => rows.push(e.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
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
    const killer = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    killer.hp = killer.maxHp = 100000;
    for (const v of w.units) {
      v.ai = false;
      w.setOrder(v, { type: 'idle' });
    }
    return { victim: u.id, killer: killer.id };
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
        const c = a.leonaDeath.controller,
          owned = c && ([...c.voices].find(([, v]: any) => v.source === node) as any);
        if (owned) {
          const kind = owned[1].kind;
          row = {
            key: owned[0],
            kind,
            variant: c.buffers[kind].indexOf(node.buffer),
            lead: when - a.context.currentTime,
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
    (window as any).__DEATH_AUDIO__ = p;
  });
}
const comparable = (rows: any[]) => rows.map(({ stops: _stops, lead: _lead, ...r }) => r);
for (const phase of [60, 151])
  test(`both death layers restore at age ${phase} ticks through Save/reload and exact futures`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const ids = await boot(page);
    await instrument(page);
    const prepared = await page.evaluate(
      ({ victim, killer, phase }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          a = g.audio,
          p = (window as any).__DEATH_AUDIO__;
        w.damage(w.unit(killer), w.unit(victim), 1e9, 'true');
        p.update();
        const initial = structuredClone(p.calls);
        w.step(phase);
        a.enabled = false;
        a.enabled = true;
        p.calls = [];
        const snapshot = w.snapshot(),
          rng = w.random.state,
          id = w.nextId;
        p.update();
        const copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
        copy.step(400);
        return {
          initial,
          calls: p.calls,
          snapshot,
          future: copy.snapshot(),
          record: w.championState(victim).leonaDeathVisuals[0],
          deathLog: w.events.some((e: any) => e.type === 'death' && e.unit === victim),
          sameSave: snapshot === w.snapshot(),
          sameRng: rng === w.random.state,
          sameId: id === w.nextId,
          synth: p.synth,
        };
      },
      { ...ids, phase }
    );
    expect(prepared.initial.map((r: any) => [r.kind, r.variant, r.offset, r.rate, r.loop])).toEqual(
      [
        ['first', 0, 0, 1, false],
        ['second', 0, 0, 1, false],
      ]
    );
    expect(prepared.initial[1].lead).toBeCloseTo(1.75, 2);
    for (const r of prepared.initial) expect(r.gain).toBeCloseTo(0.2 * 10 ** (-10 / 20), 6);
    expect(prepared.calls).toHaveLength(2);
    expect(prepared.calls[0].offset).toBeCloseTo(phase / 60, 6);
    expect(prepared.calls[1].offset).toBeCloseTo(Math.max(0, (phase - 105) / 60), 6);
    expect(prepared.calls[1].lead).toBeCloseTo(Math.max(0, (105 - phase) / 60), 2);
    expect(prepared.deathLog).toBe(phase < 150);
    expect(prepared.sameSave && prepared.sameRng && prepared.sameId).toBe(true);
    expect(prepared.synth).toBe(0);
    expect(JSON.parse(prepared.snapshot).version).toBe(130);
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
        w = g.world,
        p = (window as any).__DEATH_AUDIO__;
      p.update();
      const snapshot = w.snapshot(),
        copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
      copy.step(400);
      return {
        calls: p.calls,
        snapshot,
        future: copy.snapshot(),
        deathLog: w.events.some((e: any) => e.type === 'death'),
        synth: p.synth,
      };
    });
    expect(restored.snapshot).toBe(prepared.snapshot);
    expect(restored.future).toBe(prepared.future);
    expect(comparable(restored.calls)).toEqual(comparable(prepared.calls));
    expect(restored.deathLog).toBe(false);
    expect(restored.synth).toBe(0);
    writeFileSync(
      info.outputPath('saved-death.json'),
      JSON.stringify({ phase, prepared, restored, errors: errors.get(page) }, null, 2)
    );
  });

test('a hidden accepted death cannot expose either layer after later corpse reveal', async ({
  page,
}, info) => {
  await boot(page);
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DEATH_AUDIO__;
    w.units = [w.hero];
    const victim = w.spawn('champion', 'red', { x: 3500, y: 0 }, 'leona'),
      killer = w.spawnMonster({ x: 3650, y: 0 }, null, 'red');
    for (const u of w.units) u.ai = false;
    w.damage(killer, victim, 1e9, 'true');
    p.update();
    const hidden = p.calls.length;
    Object.assign(w.hero, { x: 3500, y: 500, previous: { x: 3500, y: 500 } });
    w.step(2);
    p.update();
    return {
      hidden,
      calls: p.calls,
      visible: w.visible(victim, 'blue'),
      record: w.championState(victim.id).leonaDeathVisuals[0],
    };
  });
  expect(result.hidden).toBe(0);
  expect(result.calls).toEqual([]);
  expect(result.visible).toBe(true);
  expect(result.record.audience).not.toContain('blue');
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});

test('both finite layers finish once at a frozen tick after the authored delayed start', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const ids = await boot(page);
  await instrument(page);
  await page.evaluate(({ victim, killer }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.damage(w.unit(killer), w.unit(victim), 1e9, 'true');
    (window as any).__DEATH_AUDIO__.update();
  }, ids);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.leonaDeath.controller.voices.size === 0
  );
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__DEATH_AUDIO__,
      c = g.audio.leonaDeath.controller,
      saved = g.world.snapshot();
    for (let i = 0; i < 20; i++) p.update();
    return {
      calls: p.calls,
      remaining: c.voices.size,
      finished: c.finished.size,
      sameSave: saved === g.world.snapshot(),
    };
  });
  expect(result.calls).toHaveLength(2);
  expect(result.calls[1].lead).toBeCloseTo(1.75, 2);
  expect(result.remaining).toBe(0);
  expect(result.finished).toBe(2);
  expect(result.sameSave).toBe(true);
  writeFileSync(info.outputPath('finite.json'), JSON.stringify(result, null, 2));
});

test('result audio drains both death layers without advancing the winning save', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ victim, killer }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__DEATH_AUDIO__;
    w.damage(w.unit(killer), w.unit(victim), 1e9, 'true');
    p.update();
    const before = a.leonaDeath.controller.voices.size;
    const inhibitor = w.spawn('inhibitor', 'red', { x: 2000, y: 2000 });
    w.damage(w.hero, inhibitor, 1e9, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 2500, y: 2500 });
    w.damage(w.hero, nexus, 1e9, 'true');
    p.update();
    const saved = w.snapshot(),
      tick = w.tick;
    a.leonaTerminalStart -= 7;
    p.update();
    return {
      before,
      remaining: a.leonaDeath.controller.voices.size,
      sameSave: saved === w.snapshot(),
      sameTick: tick === w.tick,
      winner: w.winner,
      records: w.championState(victim).leonaDeathVisuals.length,
    };
  }, ids);
  expect(result.before).toBe(2);
  expect(result.remaining).toBe(0);
  expect(result.sameSave && result.sameTick).toBe(true);
  expect(result.winner).toBe('blue');
  expect(result.records).toBe(1);
  writeFileSync(info.outputPath('terminal.json'), JSON.stringify(result, null, 2));
});

test('direct-sound caps keep four voices for each layer and mute cancels pending nodes', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ victim, killer }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DEATH_AUDIO__,
      c = g.audio.leonaDeath.controller,
      victims = [w.unit(victim)];
    for (let i = 1; i < 6; i++)
      victims.push(w.spawn('champion', 'blue', { x: i * 20, y: 0 }, 'leona'));
    for (const u of w.units) u.ai = false;
    for (const u of victims) w.damage(w.unit(killer), u, 1e9, 'true');
    p.update();
    const voices = [...c.voices.keys()],
      finished = c.finished.size,
      start = w.tick,
      kept = victims
        .map((u: any) => u.id)
        .sort((a: number, b: number) => a - b)
        .slice(-4);
    g.audio.enabled = false;
    return { calls: p.calls, voices, finished, start, kept, afterMute: c.voices.size };
  }, ids);
  expect(result.calls).toHaveLength(12);
  for (const kind of ['first', 'second'])
    expect(result.voices.filter((k: string) => k.endsWith(':' + kind))).toEqual(
      result.kept.map((id: number) => `${id}:${result.start}:${kind}`)
    );
  expect(result.finished).toBe(4);
  expect(result.afterMute).toBe(0);
  writeFileSync(info.outputPath('caps.json'), JSON.stringify(result, null, 2));
});

test('failed death masters settle readiness without frame retries or synthetic fallback', async ({
  page,
}, info) => {
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-death-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaDeath.status)).toBe(
    'failed'
  );
  const result = await page.evaluate(({ victim, killer }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DEATH_AUDIO__;
    w.damage(w.unit(killer), w.unit(victim), 1e9, 'true');
    for (let i = 0; i < 30; i++) p.update();
    return {
      calls: p.calls,
      synth: p.synth,
      records: w.championState(victim).leonaDeathVisuals.length,
    };
  }, ids);
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(0);
  expect(result.records).toBe(1);
  expect(requests).toHaveLength(2);
  expect(new Set(requests).size).toBe(2);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});

test('an isolated player death keeps both accepted layers after losing its own vision', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture&champion=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const killer = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.visionAreas = [];
    w.projectiles = [];
    w.singularities = [];
    w.reveal = null;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    const killer = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    killer.ai = false;
    w.setOrder(killer, { type: 'idle' });
    return killer.id;
  });
  await instrument(page);
  const result = await page.evaluate((killer) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__DEATH_AUDIO__,
      c = g.audio.leonaDeath.controller;
    w.damage(w.unit(killer), w.hero, 1e9, 'true');
    p.update();
    const initial = p.calls.length;
    w.step(2);
    p.update();
    const record = w.player.leonaDeathVisuals[0];
    return {
      initial,
      calls: p.calls,
      voices: c.voices.size,
      record,
      pointVisible: w.pointVisible(record.point, 'blue'),
      dead: w.hero.deadAt !== null,
    };
  }, killer);
  expect(result.dead).toBe(true);
  expect(result.pointVisible).toBe(false);
  expect(result.record.audience).toContain('blue');
  expect(result.voices).toBe(2);
  expect(result.calls).toHaveLength(2);
  writeFileSync(info.outputPath('solo-player.json'), JSON.stringify(result, null, 2));
});
