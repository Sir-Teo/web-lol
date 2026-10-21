import { expect, test } from '@playwright/test';

test('R source cast/hit/stereo kill play once, skip synthesis and resume after particles expire through death and save', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.garenR.status)).toBe('ready');
  const played = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      sound = a.garenR.controller;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.events = [];
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [],
      create = a.context.createBufferSource.bind(a.context),
      oscillator = a.context.createOscillator.bind(a.context);
    let synth = 0;
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const kind = Object.keys(sound.buffers).find((k) =>
          sound.buffers[k].includes(source.buffer)
        );
        calls.push({ kind, offset, loop: source.loop, channels: source.buffer.numberOfChannels });
        start(when, offset);
      };
      return source;
    };
    a.context.createOscillator = () => {
      synth++;
      return oscillator();
    };
    const update = () => {
      a.updateGaren(w);
      a.update(
        w.events.filter((e: any) => e.type === 'cast'),
        w.tick
      );
    };
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.maxHp = 2000;
    target.hp = 1;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
    w.step();
    update();
    update();
    const accepted = calls.slice();
    w.step(26);
    update();
    const before = calls.slice();
    w.step();
    update();
    update();
    const released = calls.slice();
    a.setPaused(true);
    await a.transition;
    const paused = a.context.state === 'suspended';
    a.setPaused(false);
    await a.transition;
    update();
    const pauseDuplicated = calls.length - released.length;
    a.enabled = false;
    const muted = sound.voices.size;
    w.step(180);
    a.enabled = true;
    update();
    const tail = calls.slice(released.length);
    g.view.render(w, 1, g.view.previousElapsed);
    const particles = g.view.garenJustice.models.size;
    const killer = w.spawn('champion', 'red', { x: 2000, y: 0 }, 'ashe');
    w.damage(killer, w.hero, 1e6, 'true');
    update();
    return {
      accepted,
      before,
      released,
      tail,
      synth,
      paused,
      pauseDuplicated,
      muted,
      particles,
      killed: w.player.garenRVisual.killed,
      afterDeath: sound.voices.size,
      saved: w.snapshot(),
    };
  });
  expect(played.accepted.map((c: any) => c.kind)).toEqual(['cast']);
  expect(played.before).toEqual(played.accepted);
  expect(played.released.map((c: any) => c.kind)).toEqual(['cast', 'hit', 'kill']);
  expect(played.released.map((c: any) => c.channels)).toEqual([1, 1, 2]);
  expect(played.released.every((c: any) => c.offset === 0 && !c.loop)).toBe(true);
  expect(played.tail.map((c: any) => [c.kind, c.offset])).toEqual([
    ['hit', 3],
    ['kill', 3],
  ]);
  expect(played.synth).toBe(0);
  expect(played.paused).toBe(true);
  expect(played.pauseDuplicated).toBe(0);
  expect(played.muted).toBe(0);
  expect(played.particles).toBe(0);
  expect(played.killed).toBe(true);
  expect(played.afterDeath).toBe(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      sound = a.garenR.controller;
    const saved = w.snapshot();
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const calls: any[] = [],
      create = a.context.createBufferSource.bind(a.context);
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        calls.push({
          kind: Object.keys(sound.buffers).find((k) => sound.buffers[k].includes(source.buffer)),
          offset,
          channels: source.buffer.numberOfChannels,
        });
        start(when, offset);
      };
      return source;
    };
    (window as any).__R_RESTORED_CALLS__ = calls;
    a.updateGaren(w);
    a.updateGaren(w);
    return { saved, calls };
  });
  expect(restored.saved).toBe(played.saved);
  expect(restored.calls).toEqual([
    { kind: 'hit', offset: 3, channels: 1 },
    { kind: 'kill', offset: 3, channels: 2 },
  ]);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.garenR.controller.voices.size === 0,
    undefined,
    { timeout: 10000 }
  );
  const ended = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.audio.updateGaren(g.world);
    const replayed = (window as any).__R_RESTORED_CALLS__.length;
    g.world.step(123);
    g.audio.updateGaren(g.world);
    return {
      replayed,
      after: g.audio.garenR.controller.voices.size,
      history: g.world.player.garenRVisual,
    };
  });
  expect(ended.replayed).toBe(2);
  expect(ended.after).toBe(0);
  expect(ended.history).toBeNull();
  expect(errors).toEqual([]);
});

test('cancelled R retains only its natural cast tail and nonfatal R never promotes a later target death into a kill cue', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      sound = a.garenR.controller;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.gainExperience(1e6);
    w.learnSpell('r');
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.hp = target.maxHp = 2000;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
    w.step();
    a.updateGaren(w);
    w.damage(target, w.hero, 1e6, 'true');
    w.step(27);
    a.updateGaren(w);
    const cancelled = [...sound.voices.values()].map((v: any) => v.kind);
    const stopped = w.player.garenRVisual.stopTick;
    // A fresh diagnostic caster exercises an independent nonfatal release.
    const caster = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    w.gainExperience(1e6, caster.id);
    w.learnSpell('r', caster.id);
    w.enqueue({ type: 'cast', unit: caster.id, ability: 'r', targetId: target.id, point: target });
    w.step(28);
    a.updateGaren(w);
    const state = w.championState(caster.id);
    w.damage(caster, target, 1e6, 'true');
    a.updateGaren(w);
    return {
      cancelled,
      stopped,
      killed: state.garenRVisual.killed,
      live: [...sound.voices.entries()]
        .filter(([key]: any) => key.startsWith(`${caster.id}:`))
        .map(([, v]: any) => v.kind),
    };
  });
  expect(result.cancelled).toEqual(['cast']);
  expect(result.stopped).not.toBeNull();
  expect(result.killed).toBe(false);
  expect(result.live).toEqual(['cast', 'hit']);
});

test('R audio stays unloaded for Ashe and loads one cached seven-file set when Garen appears', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/garen-r-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.garenR.status)).toBe('idle');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.spawn('champion', 'red', { x: 4000, y: 0 }, 'garen');
    g.audio.updateGaren(g.world);
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenR.status === 'ready');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 10; i++) g.audio.updateGaren(g.world);
  });
  expect(requests).toHaveLength(7);
  expect(new Set(requests).size).toBe(7);
});

test('missing R recordings establish startup fallback without repeated fetches or source/synth duplication', async ({
  page,
}) => {
  let requests = 0;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/assets/audio/garen-r-*.wav', (route) => {
    requests++;
    return route.fulfill({ status: 503, body: 'not available' });
  });
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.garenR.status)).toBe('failed');
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.events = [];
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    let synth = 0;
    const oscillator = a.context.createOscillator.bind(a.context);
    a.context.createOscillator = () => {
      synth++;
      return oscillator();
    };
    const target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'r', targetId: target.id, point: target });
    w.step();
    for (let i = 0; i < 10; i++) {
      a.updateGaren(w);
      a.update(
        w.events.filter((e: any) => e.type === 'cast'),
        w.tick
      );
    }
    return { synth, voices: a.garenR.controller.voices.size };
  });
  expect(requests).toBe(7);
  expect(result.synth).toBe(1);
  expect(result.voices).toBe(0);
  expect(errors).toEqual([]);
});

test('an incoming lethal R retains recipient-team hit/kill audio after the last local vision source dies', async ({
  page,
}) => {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    w.battlefield.lineOfSight = () => true;
    const enemy = w.spawn('champion', 'red', { x: 1500, y: 0 }, 'garen'),
      recipient = w.spawn('champion', 'blue', { x: 1750, y: 0 }, 'lux');
    recipient.hp = 1;
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    w.enqueue({
      type: 'cast',
      unit: enemy.id,
      ability: 'r',
      targetId: recipient.id,
      point: recipient,
    });
    w.step();
    w.battlefield.lineOfSight = () => false;
    w.step(27);
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    a.updateGaren(w, { x: 1750, y: 0 });
    return {
      dead: recipient.deadAt !== null,
      casterVisible: w.visible(enemy),
      pointVisible: w.pointVisible(recipient),
      kinds: [...a.garenR.controller.voices.values()].map((v: any) => v.kind),
    };
  });
  expect(result.dead).toBe(true);
  expect(result.casterVisible).toBe(false);
  expect(result.pointVisible).toBe(false);
  expect(result.kinds).toEqual(['hit', 'kill']);
});

test('a cast synthesized while late R assets load never doubles its source cast, but keeps source release cues', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/assets/audio/garen-r-*.wav', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const fallback = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = 0;
    a.unlock();
    await a.transition;
    await a.context.resume();
    a.paused = false;
    const caster = w.spawn('champion', 'blue', { x: 100, y: 0 }, 'garen'),
      target = w.spawn('champion', 'red', { x: 250, y: 0 }, 'lux');
    target.hp = 1;
    w.gainExperience(1e6, caster.id);
    w.learnSpell('r', caster.id);
    w.events = [];
    (window as any).__R_LOADING_CALLS__ = [];
    let synth = 0;
    const oscillator = a.context.createOscillator.bind(a.context),
      create = a.context.createBufferSource.bind(a.context);
    a.context.createOscillator = () => {
      synth++;
      return oscillator();
    };
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const sound = a.garenR.controller;
        (window as any).__R_LOADING_CALLS__.push(
          Object.keys(sound.buffers).find((k) => sound.buffers[k].includes(source.buffer))
        );
        start(when, offset);
      };
      return source;
    };
    w.enqueue({ type: 'cast', unit: caster.id, ability: 'r', targetId: target.id, point: target });
    w.step();
    a.updateGaren(w);
    a.update(
      w.events.filter((e: any) => e.type === 'cast'),
      w.tick
    );
    return { synth, status: a.garenR.status };
  });
  expect(fallback.synth).toBe(1);
  expect(fallback.status).toBe('loading');
  release();
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenR.status === 'ready');
  const calls = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.audio.updateGaren(g.world);
    g.world.step(27);
    g.audio.updateGaren(g.world);
    return (window as any).__R_LOADING_CALLS__;
  });
  expect(calls).toEqual(['hit', 'kill']);
});
