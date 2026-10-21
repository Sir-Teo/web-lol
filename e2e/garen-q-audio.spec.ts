import { expect, test, type Page } from '@playwright/test';

async function instrument(page: Page, reset = true) {
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
      w.learnSpell('q');
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const probe = {
      calls: [] as any[],
      synth: 0,
      update: () => {
        a.updateGaren(w);
        a.update(
          w.events.filter((e: any) => ['cast', 'attack'].includes(e.type)),
          w.tick
        );
      },
    };
    const createGain = a.context.createGain.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        set = gain.gain.setValueAtTime.bind(gain.gain);
      gain.scheduledValues = [];
      gain.gain.setValueAtTime = (value: number, when: number) => {
        gain.scheduledValues.push([value, when]);
        return set(value, when);
      };
      return gain;
    };
    const create = a.context.createBufferSource.bind(a.context),
      oscillator = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const sound = a.garenQ.controller,
          kind =
            sound &&
            Object.keys(sound.buffers).find((k) => sound.buffers[k].includes(source.buffer));
        if (kind)
          probe.calls.push({
            kind,
            when,
            offset,
            loop: source.loop,
            variant: sound.buffers[kind].indexOf(source.buffer),
          });
        start(when, offset);
      };
      return source;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return oscillator();
    };
    (window as any).__Q_AUDIO__ = probe;
  }, reset);
}
async function open(page: Page) {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await instrument(page);
}
test('Q source cast, both committed attack actions and consumed ending survive mute and a saved partial stop fade', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__,
      a = g.audio;
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    p.update();
    const initial = [...p.calls],
      release = w.hero.releaseTick;
    w.step(release - w.tick);
    p.update();
    w.setOrder(w.hero, { type: 'idle' });
    const atRelease = [...p.calls];
    a.enabled = false;
    w.step(6);
    a.enabled = true;
    p.update();
    const voice = [...a.garenQ.controller.voices.values()].find(
      (v: any) => v.kind === 'active'
    ) as any;
    return {
      initial,
      atRelease,
      synth: p.synth,
      reason: w.player.garenQVisuals[0].endReason,
      fade: voice.envelope.scheduledValues.at(-1)[0],
      source: p.calls.slice(atRelease.length),
      snapshot: w.snapshot(),
    };
  });
  expect(result.initial.map((c: any) => c.kind)).toEqual([
    'cast',
    'active',
    'attack',
    'attackDelayed',
  ]);
  expect(result.initial[3].when - result.initial[2].when).toBeCloseTo(0.23, 9);
  expect(result.initial.every((c: any) => !c.loop)).toBe(true);
  expect(result.atRelease.at(-1).kind).toBe('end');
  expect(result.reason).toBe('consumed');
  expect(result.synth).toBe(0);
  expect(result.fade).toBeCloseTo(0.6, 4);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await instrument(page, false);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__;
    p.update();
    const voice = [...g.audio.garenQ.controller.voices.values()].find(
      (v: any) => v.kind === 'active'
    ) as any;
    const data = {
      snapshot: w.snapshot(),
      calls: [...p.calls],
      fade: voice.envelope.scheduledValues.at(-1)[0],
    };
    w.step(210);
    p.update();
    return {
      ...data,
      remaining: g.audio.garenQ.controller.voices.size,
      history: w.player.garenQVisuals,
    };
  });
  expect(restored.snapshot).toBe(result.snapshot);
  expect(restored.calls.map((c: any) => [c.kind, c.variant, c.offset, c.loop])).toEqual(
    result.source.map((c: any) => [c.kind, c.variant, c.offset, c.loop])
  );
  expect(restored.fade).toBeCloseTo(0.6, 4);
  expect(restored.remaining).toBe(0);
  expect(restored.history).toEqual([]);
});
test('cancelled Q swing keeps its accepted delayed action through early death, without a false ending cue', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__,
      a = g.audio;
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    p.update();
    w.damage(w.hero, target, 1e6, 'true');
    w.step(2);
    w.damage(w.hero, w.hero, 1e6, 'true');
    a.garenQ.stop();
    p.calls = [];
    p.update();
    return {
      calls: p.calls,
      reason: w.player.garenQVisuals[0].endReason,
      attacks: w.player.garenQVisuals[0].attacks,
      cycle: w.hero.attackCycle,
      synth: p.synth,
    };
  });
  expect(result.reason).toBe('death');
  expect(result.cycle).toBeNull();
  expect(result.attacks).toHaveLength(1);
  expect(result.calls.map((c: any) => c.kind)).toEqual([
    'cast',
    'active',
    'attack',
    'attackDelayed',
  ]);
  expect(result.calls[3].when - result.calls[2].when).toBeCloseTo(0.23 - 2 / 60, 9);
  expect(result.synth).toBe(0);
});
test('Q asset failure keeps bounded cast and attack fallback without repeated source fetches', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('**/assets/audio/garen-q-*.wav', async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 503, body: 'injected' });
  });
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__;
    const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    p.update();
    w.step(w.hero.releaseTick - w.tick);
    p.update();
    p.update();
    p.update();
    return { status: g.audio.garenQ.status, calls: p.calls, synth: p.synth };
  });
  expect(result.status).toBe('failed');
  expect(result.calls).toEqual([]);
  expect(result.synth).toBe(2);
  expect(requests).toHaveLength(13);
});
test('a late Garen loads one Q resource set and never doubles cast/attack cues synthesized while loading', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  await page.route('**/assets/audio/garen-q-*.wav', async (route) => {
    requests.push(route.request().url());
    await gate;
    await route.continue();
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  await instrument(page);
  const early = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__;
    const garen = w.spawn('champion', 'blue', { x: 250, y: 0 }, 'garen'),
      target = w.spawn('dummy', 'red', { x: 350, y: 0 });
    garen.nextThink = Infinity;
    w.learnSpell('q', garen.id);
    w.setOrder(garen, { type: 'attack', target: target.id });
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'q', point: garen });
    w.step();
    p.update();
    w.step(garen.releaseTick - w.tick);
    p.update();
    w.setOrder(garen, { type: 'idle' });
    return { synth: p.synth, id: garen.id };
  });
  expect(early.synth).toBe(2);
  release();
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenQ.status === 'ready');
  const late = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__;
    p.update();
    const first = p.calls.map((c: any) => c.kind);
    w.championState(id).cooldowns.q = 0;
    w.enqueue({ type: 'cast', unit: id, ability: 'q', point: w.unit(id) });
    w.step();
    p.update();
    return { first, all: p.calls.map((c: any) => c.kind), synth: p.synth };
  }, early.id);
  expect(late.first).toEqual(['active', 'end']);
  expect(late.all).toContain('cast');
  expect(late.synth).toBe(2);
  expect(requests).toHaveLength(13);
  expect(new Set(requests).size).toBe(13);
});
test('enemy Q sound follows fog and resumes its original age while listener gain stays separate from the stop fade', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__,
      a = g.audio;
    w.battlefield.lineOfSight = () => true;
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    enemy.nextThink = Infinity;
    w.learnSpell('q', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: enemy });
    w.step();
    p.update();
    const initial = p.calls.length;
    Object.assign(w.hero, { x: 5000, y: 0, previous: { x: 5000, y: 0 } });
    w.step();
    p.update();
    const hidden = a.garenQ.controller.voices.size;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.step();
    p.update();
    const resumed = p.calls.slice(initial);
    const state = w.championState(enemy.id);
    w.step(state.garenQ.attackUntil - w.tick + 6);
    p.update();
    const active = [...a.garenQ.controller.voices.values()].find(
        (v: any) => v.kind === 'active'
      ) as any,
      before = active.envelope.scheduledValues.at(-1)[0];
    a.updateGaren(w, { x: 1500, y: 0 });
    return { hidden, resumed, before, after: active.envelope.scheduledValues.at(-1)[0] };
  });
  expect(result.hidden).toBe(0);
  expect(result.resumed.length).toBe(2);
  expect(result.resumed.every((c: any) => c.offset > 0)).toBe(true);
  expect(result.before).toBeCloseTo(0.6, 4);
  expect(result.after).toBeCloseTo(result.before, 5);
});
for (const reason of ['death', 'match-end'] as const)
  test(`Q ${reason} keeps finite source tails without an ending cue or frozen-clock replay`, async ({
    page,
  }) => {
    await open(page);
    const result = await page.evaluate((reason) => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__Q_AUDIO__;
      const target = w.spawn('dummy', 'red', { x: 100, y: 0 });
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
      w.step();
      p.update();
      if (reason === 'death') w.damage(w.hero, w.hero, 1e6, 'true');
      else {
        const nexus = w.spawn('nexus', 'red', { x: 0, y: 0 });
        w.damage(w.hero, nexus, 1e6, 'true');
      }
      p.update();
      return { reason: w.player.garenQVisuals[0].endReason, calls: p.calls };
    }, reason);
    expect(result.reason).toBe(reason);
    expect(result.calls.map((c: any) => c.kind)).toEqual([
      'cast',
      'active',
      'attack',
      'attackDelayed',
    ]);
    if (reason === 'match-end') {
      await page.getByRole('heading', { name: 'Victory', exact: true }).waitFor();
      await page.evaluate(async () => {
        const a = (window as any).__GAME__.audio;
        a.setPaused(false);
        await a.transition;
      });
    }
    await page.waitForFunction(
      () => (window as any).__GAME__.audio.garenQ.controller.voices.size === 0
    );
    expect(
      await page.evaluate(() => {
        const p = (window as any).__Q_AUDIO__;
        p.update();
        p.update();
        return p.calls.length;
      })
    ).toBe(4);
  });
