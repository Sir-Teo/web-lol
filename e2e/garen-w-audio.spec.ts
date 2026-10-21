import { expect, test, type Page } from '@playwright/test';
import { GAREN_W_AUDIO as P } from '../src/content/garen-w-audio';

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
      w.hero.x = w.hero.y = 0;
      w.hero.previous = { x: 0, y: 0 };
      w.learnSpell('w');
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
          w.events.filter((e: any) => e.type === 'cast'),
          w.tick
        );
      },
    };
    const create = a.context.createBufferSource.bind(a.context),
      createGain = a.context.createGain.bind(a.context),
      oscillator = a.context.createOscillator.bind(a.context);
    a.context.createGain = () => {
      const gain = createGain(),
        set = gain.gain.setValueAtTime.bind(gain.gain),
        target = gain.gain.setTargetAtTime.bind(gain.gain);
      gain.scheduledValues = [];
      gain.scheduledTargets = [];
      gain.gain.setValueAtTime = (value: number, when: number) => {
        gain.scheduledValues.push([value, when]);
        return set(value, when);
      };
      gain.gain.setTargetAtTime = (value: number, when: number, constant: number) => {
        gain.scheduledTargets.push([value, when, constant]);
        return target(value, when, constant);
      };
      return gain;
    };
    a.context.createBufferSource = () => {
      const source = create(),
        start = source.start.bind(source);
      source.start = (when: number, offset: number) => {
        const sound = a.garenW.controller;
        const kind =
          sound && Object.keys(sound.buffers).find((k) => sound.buffers[k].includes(source.buffer));
        if (kind)
          probe.calls.push({
            kind,
            variant: sound.buffers[kind].indexOf(source.buffer),
            offset,
            loop: source.loop,
            loopStart: source.loopStart,
            loopEnd: source.loopEnd,
          });
        start(when, offset);
      };
      return source;
    };
    a.context.createOscillator = () => {
      probe.synth++;
      return oscillator();
    };
    (window as any).__W_AUDIO__ = probe;
  }, reset);
}
async function open(page: Page) {
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.audio.garenW.status)).toBe('ready');
  await instrument(page);
}
test('Courage cast and source loop survive shield loss, pause/mute, natural expiry and a saved stop-fade phase', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__W_AUDIO__,
      sound = a.garenW.controller;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step();
    p.update();
    p.update();
    const accepted = p.calls.slice();
    w.damage(w.hero, w.hero, 70, 'true');
    w.step(90);
    p.update();
    const shield = w.shieldAmount(w.hero),
      active = sound.voices.size;
    a.setPaused(true);
    await a.transition;
    const paused = a.context.state;
    a.setPaused(false);
    await a.transition;
    p.update();
    const noPauseDuplicate = p.calls.length === accepted.length;
    a.enabled = false;
    const muted = sound.voices.size;
    a.enabled = true;
    p.update();
    const resumed = p.calls.slice(accepted.length);
    w.step(150);
    p.update();
    const end = p.calls.filter((c: any) => c.kind === 'end');
    w.step(6);
    p.update();
    const loop = [...sound.voices.values()].find((v: any) => v.kind === 'active') as any;
    return {
      accepted,
      shield,
      active,
      paused,
      noPauseDuplicate,
      muted,
      resumed,
      end,
      synth: p.synth,
      fade: loop.envelope.gain.value,
      reason: w.player.garenWVisual.endReason,
      stop: w.player.garenWVisual.stopTick,
      tick: w.tick,
    };
  });
  expect(result.accepted.map((c: any) => c.kind)).toEqual(['cast', 'active']);
  const active = result.accepted.find((c: any) => c.kind === 'active'),
    clip = P.active.variants[active.variant];
  expect(active.loop).toBe(true);
  expect(active.loopStart).toBe(clip.loop.start / 44100);
  expect(active.loopEnd).toBe(clip.loop.end / 44100);
  expect(result.shield).toBe(0);
  expect(result.active).toBe(2);
  expect(result.paused).toBe('suspended');
  expect(result.noPauseDuplicate).toBe(true);
  expect(result.muted).toBe(0);
  expect(result.resumed.map((c: any) => [c.kind, c.offset])).toEqual([
    ['cast', 1.5],
    ['active', 1.5],
  ]);
  expect(result.end).toHaveLength(1);
  expect(result.end[0].offset).toBe(0);
  expect(result.synth).toBe(0);
  expect(result.reason).toBe('expired');
  expect(result.tick - result.stop).toBe(6);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await instrument(page, false);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      p = (window as any).__W_AUDIO__,
      sound = g.audio.garenW.controller;
    p.update();
    p.update();
    return {
      snapshot: g.world.snapshot(),
      calls: p.calls,
      fade: [...sound.voices.values()]
        .find((v: any) => v.kind === 'active')
        ?.envelope.scheduledValues.at(-1)[0],
    };
  });
  expect(restored.snapshot).toBe(saved);
  expect(restored.calls.map((c: any) => [c.kind, c.offset])).toEqual([
    ['active', 4.1],
    ['end', 0.1],
  ]);
  expect(restored.fade).toBeCloseTo(0.6, 1);
  await page.waitForFunction(
    () =>
      ![...(window as any).__GAME__.audio.garenW.controller.voices.values()].some(
        (v: any) => v.kind === 'active'
      )
  );
  const after = await page.evaluate(() => {
    const p = (window as any).__W_AUDIO__;
    p.update();
    return p.calls.length;
  });
  expect(after).toBe(2);
  await page.waitForFunction(
    () => (window as any).__GAME__.audio.garenW.controller.voices.size === 0
  );
  expect(
    await page.evaluate(() => {
      const p = (window as any).__W_AUDIO__;
      p.update();
      return p.calls.length;
    })
  ).toBe(2);
  expect(errors).toEqual([]);
});
for (const reason of ['death', 'match-end'] as const)
  test(`Courage ${reason} stops its loop and retains a finite cast tail without an ending cue or frozen-clock replay`, async ({
    page,
  }) => {
    await open(page);
    const result = await page.evaluate((reason) => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__W_AUDIO__;
      w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
      w.step();
      p.update();
      if (reason === 'death') w.damage(w.hero, w.hero, 1e6, 'true');
      else {
        const nexus = w.spawn('nexus', 'red', { x: 0, y: 0 });
        w.damage(w.hero, nexus, 1e6, 'true');
      }
      p.update();
      return { reason: w.player.garenWVisual.endReason, calls: p.calls };
    }, reason);
    expect(result.reason).toBe(reason);
    expect(result.calls.map((c: any) => c.kind)).toEqual(['cast', 'active']);
    if (reason === 'match-end') {
      // The result menu suspends the shared context just like other menus.
      // Resume it explicitly to verify finite tail cleanup at a frozen world tick.
      await page.getByRole('heading', { name: 'Victory', exact: true }).waitFor();
      await page.evaluate(async () => {
        const a = (window as any).__GAME__.audio;
        a.setPaused(false);
        await a.transition;
      });
    }
    await page.waitForFunction(
      () => (window as any).__GAME__.audio.garenW.controller.voices.size === 0
    );
    const final = await page.evaluate(() => {
      const p = (window as any).__W_AUDIO__;
      p.update();
      p.update();
      return p.calls.length;
    });
    expect(final).toBe(2);
  });
test('ordinary startup skips Courage audio and a late Garen loads exactly eight cached masters', async ({
  page,
}) => {
  const requests: string[] = [],
    modules: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/garen-w-')) requests.push(r.url());
    if (r.url().includes('/src/audio/garen-w.ts')) modules.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(requests).toEqual([]);
  expect(modules).toEqual([]);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.spawn('champion', 'red', { x: 0, y: 0 }, 'garen');
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenW.status === 'ready');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    g.audio.updateGaren(g.world);
  });
  expect(requests).toHaveLength(8);
  expect(new Set(requests).size).toBe(8);
  expect(modules).toHaveLength(1);
});
test('failed Courage files establish one synthesized cast without repeated frame-driven requests', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/garen-w-')) requests.push(r.url());
  });
  await page.route('**/assets/audio/garen-w-*.wav', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' })
  );
  await page.goto('/?scene=fixture&champion=garen');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await instrument(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__W_AUDIO__;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: w.hero });
    w.step();
    for (let i = 0; i < 10; i++) p.update();
    return { status: g.audio.garenW.status, synth: p.synth, calls: p.calls.length };
  });
  expect(result).toEqual({ status: 'failed', synth: 1, calls: 0 });
  expect(requests).toHaveLength(8);
});
test('a Courage cast synthesized during late loading never doubles after readiness, while its active loop resumes', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/assets/audio/garen-w-*.wav', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await instrument(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const u = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'garen');
    w.learnSpell('w', u.id);
    g.audio.updateGaren(w);
    (window as any).__W_CASTER__ = u.id;
  });
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenW.status === 'loading');
  const synth = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__W_AUDIO__,
      id = (window as any).__W_CASTER__;
    w.enqueue({ type: 'cast', unit: id, ability: 'w', point: { x: 0, y: 0 } });
    w.step();
    p.update();
    w.step(30);
    return p.synth;
  });
  expect(synth).toBe(1);
  release();
  await page.waitForFunction(() => (window as any).__GAME__.audio.garenW.status === 'ready');
  const calls = await page.evaluate(() => {
    const p = (window as any).__W_AUDIO__;
    p.update();
    p.update();
    return p.calls;
  });
  expect(calls.map((c: any) => [c.kind, c.offset])).toEqual([['active', 0.5]]);
});
test('enemy Courage respects fog and resumes its saved age while listener distance gain stays separate', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__W_AUDIO__,
      a = g.audio;
    w.battlefield.lineOfSight = () => true;
    const enemy = w.spawn('champion', 'red', { x: 250, y: 0 }, 'garen');
    w.learnSpell('w', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: enemy });
    w.step();
    p.update();
    const before = a.garenW.controller.voices.size;
    w.hero.x = 5000;
    w.step();
    p.update();
    const hidden = a.garenW.controller.voices.size;
    w.hero.x = 0;
    w.step();
    p.update();
    const resumed = p.calls.slice(2),
      voices = [...a.garenW.controller.voices.values()] as any[];
    const near = voices.map((v) => v.spatial.gain.value);
    a.garenW.update(
      a.context,
      true,
      [
        {
          ...w.championState(enemy.id).garenWVisual,
          id: enemy.id,
          x: enemy.x,
          y: enemy.y,
          visible: true,
        },
      ],
      w.tick,
      { x: 5000, y: 0 }
    );
    return {
      before,
      hidden,
      resumed,
      near,
      far: voices.map((v) => v.spatial.scheduledTargets.at(-1)[0]),
      after: a.garenW.controller.voices.size,
    };
  });
  expect(result.before).toBe(2);
  expect(result.hidden).toBe(0);
  expect(result.after).toBe(2);
  expect(result.resumed.map((c: any) => c.kind)).toEqual(['cast', 'active']);
  for (const c of result.resumed) expect(c.offset).toBeCloseTo(2 / 60);
  expect(result.near.every((gain: number) => gain > 0)).toBe(true);
  for (let i = 0; i < result.near.length; i++) expect(result.far[i]).toBeLessThan(result.near[i]);
});
