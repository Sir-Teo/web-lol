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
    const target = w.spawn('siege', 'red', { x: 150, y: 0 });
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
        const c = a.leonaAA.controller,
          owned = c && ([...c.voices].find(([, v]: any) => v.source === node) as any),
          kind = owned?.[1].kind;
        if (kind) {
          row = {
            key: owned[0],
            kind,
            variant: c.buffers[kind].indexOf(node.buffer),
            offset,
            lead: when - a.context.currentTime,
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
    (window as any).__AA_AUDIO__ = probe;
  });
}
const comparable = (rows: any[]) =>
  rows.map(({ stops: _stops, gain: _gain, lead: _lead, ...rest }) => rest);

for (const mode of ['attack1', 'attack2', 'crit', 'spell2_attack'] as const) {
  test(`ordinary ${mode} source voices restore through Save/reload with identical futures`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ids = await boot(page);
    await instrument(page);
    const prepared = await page.evaluate(
      async ({ caster, target, mode }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          p = (window as any).__AA_AUDIO__,
          a = g.audio,
          u = w.unit(caster),
          s = w.championState(caster);
        if (mode === 'crit')
          s.inventory.push('agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge');
        else if (mode === 'spell2_attack') {
          w.learnSpell('w', caster);
          w.enqueue({ type: 'cast', unit: caster, ability: 'w', point: u });
          w.step();
        } else {
          const { leonaAttackAnimation } = await import('/src/content/leona-presentation.ts');
          while (leonaAttackAnimation(caster, w.tick + 1) !== mode) w.step();
        }
        w.setOrder(u, { type: 'attack', target });
        w.step();
        p.update();
        const start = structuredClone(p.calls),
          r = s.leonaAAVisuals[0];
        w.step(u.releaseTick - w.tick + 3);
        a.enabled = false;
        a.enabled = true;
        p.calls = [];
        p.update();
        const snapshot = w.snapshot(),
          copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
        copy.step(90);
        return {
          start,
          calls: p.calls,
          record: r,
          snapshot,
          future: copy.snapshot(),
          synth: p.synth,
        };
      },
      { ...ids, mode }
    );
    expect(prepared.record.kind).toBe(mode);
    expect(prepared.start).toHaveLength(1);
    expect(prepared.start[0].kind).toBe(mode === 'crit' ? 'criticalCast' : 'normalCast');
    expect(prepared.start[0].lead).toBeCloseTo(
      mode === 'attack1' || mode === 'spell2_attack' ? 0.04 : 0,
      2
    );
    expect(prepared.start[0].offset).toBe(0);
    const hit = prepared.calls.find(
      (c: any) => c.kind === (mode === 'crit' ? 'criticalHit' : 'hitMetal')
    );
    expect(hit).toBeTruthy();
    expect(hit.rate).toBeGreaterThanOrEqual(2 ** (-300 / 1200));
    expect(hit.rate).toBeLessThanOrEqual(2 ** (300 / 1200));
    expect(hit.loop).toBe(false);
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
        p = (window as any).__AA_AUDIO__;
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
      JSON.stringify({ mode, prepared, restored, errors }, null, 2)
    );
  });
}

test('a canceled source cast finishes once at a frozen tick without a contact or restart', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const first = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA_AUDIO__,
      u = w.unit(caster);
    w.setOrder(u, { type: 'attack', target });
    w.step();
    p.update();
    w.setOrder(u, { type: 'move', point: { x: 0, y: 500 } });
    w.step(3);
    p.update();
    return { calls: p.calls, record: w.championState(caster).leonaAAVisuals[0] };
  }, ids);
  expect(first.calls.map((c: any) => c.kind)).toEqual(['normalCast']);
  expect(first.record.cancelTick).not.toBeNull();
  expect(first.record.impact).toBeNull();
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.leonaAA.controller.voices.size === 0
  );
  const last = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__AA_AUDIO__,
      before = g.world.snapshot();
    for (let i = 0; i < 20; i++) p.update();
    return {
      calls: p.calls,
      finished: g.audio.leonaAA.controller.finished.size,
      sameSave: before === g.world.snapshot(),
    };
  });
  expect(last.calls).toHaveLength(1);
  expect(last.finished).toBe(1);
  expect(last.sameSave).toBe(true);
  writeFileSync(info.outputPath('canceled-finite.json'), JSON.stringify({ first, last }, null, 2));
});

test('hidden cast stays silent after reveal while a later visible contact is admitted', async ({
  page,
}, info) => {
  await boot(page);
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA_AUDIO__;
    w.units = [w.hero];
    const u = w.spawn('champion', 'red', { x: 3500, y: 0 }, 'leona'),
      target = w.spawn('dummy', 'neutral', { x: 3650, y: 0 });
    u.ai = false;
    target.hp = target.maxHp = 100000;
    w.setOrder(u, { type: 'attack', target: target.id });
    w.step();
    p.update();
    const hidden = p.calls.length;
    Object.assign(w.hero, { x: 3500, y: 500, previous: { x: 3500, y: 500 } });
    w.step(2);
    p.update();
    const revealed = p.calls.length;
    w.step(u.releaseTick - w.tick);
    p.update();
    return { hidden, revealed, calls: p.calls, record: w.championState(u.id).leonaAAVisuals[0] };
  });
  expect(result.hidden).toBe(0);
  expect(result.revealed).toBe(0);
  expect(result.calls.map((c: any) => c.kind)).toEqual(['hitFlesh']);
  expect(result.record.castAudience).not.toContain('blue');
  expect(result.record.impact.audience).toContain('blue');
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});

test('failed attack uses one release fallback and suppresses every late source role', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__AA_AUDIO__,
      c = a.leonaAA.controller,
      u = w.unit(caster);
    c.status = 'failed';
    w.setOrder(u, { type: 'attack', target });
    w.step(u.releaseTick ? u.releaseTick - w.tick : 1);
    if (u.releaseTick && u.releaseTick > w.tick) w.step(u.releaseTick - w.tick);
    p.update();
    const synth = p.synth;
    c.status = 'ready';
    p.update();
    return { synth, calls: p.calls, suppressed: c.fallbackCasts.size };
  }, ids);
  expect(result.synth).toBe(1);
  expect(result.calls).toEqual([]);
  expect(result.suppressed).toBe(7);
  writeFileSync(info.outputPath('fallback.json'), JSON.stringify(result, null, 2));
});

test('failed attack masters settle readiness without frame retries', async ({ page }, info) => {
  const requests: string[] = [];
  await page.route('**/assets/audio/leona-aa-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  const ids = await boot(page);
  await instrument(page);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.leonaAA.status)).toBe('failed');
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__AA_AUDIO__,
      u = w.unit(caster);
    w.setOrder(u, { type: 'attack', target });
    w.step();
    w.step(u.releaseTick - w.tick);
    for (let i = 0; i < 30; i++) p.update();
    return { calls: p.calls, synth: p.synth };
  }, ids);
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(1);
  expect(requests).toHaveLength(17);
  expect(new Set(requests).size).toBe(17);
  writeFileSync(
    info.outputPath('failed-source.json'),
    JSON.stringify({ ...result, requests }, null, 2)
  );
});

test('ordinary source tails drain after match end while the saved world remains frozen', async ({
  page,
}, info) => {
  const ids = await boot(page);
  await instrument(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__AA_AUDIO__,
      u = w.unit(caster);
    w.setOrder(u, { type: 'attack', target });
    w.step();
    w.step(u.releaseTick - w.tick);
    p.update();
    const before = a.leonaAA.controller.voices.size;
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
      remaining: a.leonaAA.controller.voices.size,
      sameSave: saved === w.snapshot(),
      sameTick: tick === w.tick,
      winner: w.winner,
      synth: p.synth,
    };
  }, ids);
  expect(result.before).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  expect(result.sameTick).toBe(true);
  expect(result.winner).toBe('blue');
  expect(result.synth).toBe(0);
  writeFileSync(info.outputPath('terminal.json'), JSON.stringify(result, null, 2));
});
