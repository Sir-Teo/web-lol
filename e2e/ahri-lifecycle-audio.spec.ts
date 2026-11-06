import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_LIFECYCLE_AUDIO_PROFILES as P } from '../src/content/ahri-lifecycle-audio-policy';
test('Ahri actual combat death and timed respawn play exact finite masters through mute and restoration', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-lifecycle/')) requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriLifecycle.status))
    .toBe('ready');
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.ahriLifecycleAudio = [];
    w.nextWaveTick = 1e9;
    w.pendingSpawns = [];
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, hp: 1, ai: false });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    const enemy = w.spawn('champion', 'red', { x: 400, y: 0 }, 'lux');
    Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000 });
    w.setOrder(enemy, { type: 'attack', target: w.hero.id });
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    let death = false;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args),
        r = this.ahriLifecycleAudio[0];
      if (!death && r) {
        death = true;
        this.setOrder(enemy, { type: 'idle' });
        g.setPaused(true);
      } else if (death && r?.respawn) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('s');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriLifecycleAudio.length), {
      timeout: 30000,
    })
    .toBe(1);
  await page.screenshot({ path: info.outputPath('ahri-combat-death.png') });
  const death = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      c = a.ahriLifecycle.controller;
    g.setPaused(true);
    a.setPaused(false);
    a.unlock();
    await a.transition;
    await a.context.resume();
    const saved = w.snapshot();
    c.reset();
    const capture = () =>
      [...c.voices].map(([key, v]: any) => ({
        key,
        frames: v.source.buffer.length,
        rate: v.source.playbackRate.value,
        gain: v.gain.gain.value,
        loop: v.source.loop,
      }));
    a.updateAhri(w, w.hero);
    const initial = capture();
    a.enabled = false;
    const muted = c.activeVoices;
    a.enabled = true;
    a.updateAhri(w, w.hero);
    const resumed = capture();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    a.updateAhri(copy, copy.hero);
    const restored = capture();
    const clips = [];
    for (const [id, buffer] of c.buffers) {
      const pcm = buffer.getChannelData(0),
        digest = await crypto.subtle.digest('SHA-256', pcm.buffer);
      clips.push({
        id,
        frames: buffer.length,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        pcmSha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
          ''
        ),
      });
    }
    const r = w.ahriLifecycleAudio[0],
      result = {
        initial,
        muted,
        resumed,
        restored,
        clips,
        dead: w.hero.hp === 0,
        respawn: r.respawn,
        feedbackIdentity: w.events.some(
          (e: any) => e.id === r.id && e.type === 'death' && e.unit === w.hero.id
        ),
        unchanged: w.snapshot() === saved && copy.snapshot() === saved,
      };
    c.reset();
    a.setPaused(true);
    return result;
  });
  expect(death.dead).toBe(true);
  expect(death.respawn).toBeNull();
  expect(death.feedbackIdentity).toBe(true);
  expect(death.initial).toHaveLength(1);
  expect(death.initial[0].key).toMatch(/:death$/);
  expect(death.initial[0].loop).toBe(false);
  expect(death.muted).toBe(0);
  expect(death.resumed).toEqual(death.initial);
  expect(death.restored).toEqual(death.initial);
  expect(death.unchanged).toBe(true);
  const waiting = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      c = a.ahriLifecycle.controller;
    w.step(w.ahriLifecycleAudio[0].respawnTick - w.tick - 1);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    a.setPaused(false);
    await a.context.resume();
    c.reset();
    a.updateAhri(w, w.hero);
    const result = {
      dead: w.hero.hp === 0,
      pending: w.ahriLifecycleAudio[0].respawn === null,
      voices: c.activeVoices,
      unchanged: w.snapshot() === saved && copy.snapshot() === saved,
    };
    c.reset();
    a.setPaused(true);
    w.step();
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return result;
  });
  expect(waiting).toEqual({ dead: true, pending: true, voices: 0, unchanged: true });
  await page.screenshot({ path: info.outputPath('ahri-timed-respawn.png') });
  const respawn = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      c = a.ahriLifecycle.controller;
    a.setPaused(false);
    await a.context.resume();
    const saved = w.snapshot();
    c.reset();
    const capture = () =>
      [...c.voices].map(([key, v]: any) => ({
        key,
        frames: v.source.buffer.length,
        loop: v.source.loop,
        rate: v.source.playbackRate.value,
        gain: v.gain.gain.value,
      }));
    a.updateAhri(w, w.hero);
    const initial = capture();
    a.enabled = false;
    const muted = c.activeVoices;
    a.enabled = true;
    a.updateAhri(w, w.hero);
    const resumed = capture();
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    a.updateAhri(copy, copy.hero);
    const restored = capture();
    const r = w.ahriLifecycleAudio[0],
      result = {
        initial,
        muted,
        resumed,
        restored,
        actualTick: r.respawn.tick,
        scheduledTick: r.respawnTick,
        hpFull: w.hero.hp === w.hero.maxHp,
        manaFull: w.hero.mana === w.hero.maxMana,
        spawn: r.respawn.point,
        expectedSpawn: w.battlefield.spawns.blue,
        unchanged: w.snapshot() === saved && copy.snapshot() === saved,
      };
    c.reset();
    a.setPaused(true);
    return result;
  });
  expect(respawn.initial).toHaveLength(1);
  expect(respawn.initial[0].key).toMatch(/:respawn$/);
  expect(respawn.initial[0].frames).toBe(P.respawn.variants[0].frames);
  expect(respawn.initial[0].loop).toBe(false);
  expect(respawn.actualTick).toBe(respawn.scheduledTick);
  expect(respawn.hpFull && respawn.manaFull).toBe(true);
  expect(respawn.spawn).toEqual(respawn.expectedSpawn);
  expect(respawn.muted).toBe(0);
  expect(respawn.resumed).toEqual(respawn.initial);
  expect(respawn.restored).toEqual(respawn.initial);
  expect(respawn.unchanged).toBe(true);
  expect(requests).toHaveLength(2);
  expect(new Set(requests).size).toBe(2);
  expect(death.clips).toHaveLength(2);
  for (const clip of Object.values(P).flatMap((p) => [...p.variants]))
    expect(death.clips.find((c: any) => c.id === clip.id)).toMatchObject({
      frames: clip.frames,
      sampleRate: 44100,
      channels: 1,
      pcmSha256: clip.pcmSha256,
    });
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('audio-evidence.json'),
    JSON.stringify({ requests, death, waiting, respawn, errors }, null, 2)
  );
});
test('a hidden enemy death never replays while its independently visible timed respawn becomes audible', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-lifecycle/')) requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriLifecycle.status))
    .toBe('ready');
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      c = a.ahriLifecycle.controller;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.ahriLifecycleAudio = [];
    w.nextWaveTick = 1e9;
    w.pendingSpawns = [];
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    const enemy = w.spawn('champion', 'red', { x: 4000, y: 0 }, 'ahri');
    enemy.ai = false;
    w.damage(w.hero, enemy, 1e6, 'true');
    const r = w.ahriLifecycleAudio[0];
    Object.assign(w.hero, { x: 4000, y: 0, previous: { x: 4000, y: 0 } });
    w.step();
    a.setPaused(false);
    a.unlock();
    await a.transition;
    await a.context.resume();
    c.reset();
    a.updateAhri(w, w.hero);
    const hidden = {
      audience: [...r.audience],
      currentlyVisible: w.pointVisible(r.origin, w.hero.team),
      voices: c.activeVoices,
    };
    c.reset();
    a.setPaused(true);
    const spawn = w.battlefield.spawns.red;
    Object.assign(w.hero, {
      x: spawn.x + 200,
      y: spawn.y,
      previous: { x: spawn.x + 200, y: spawn.y },
    });
    w.step(r.respawnTick - w.tick);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    a.setPaused(false);
    c.reset();
    a.updateAhri(w, w.hero);
    const capture = () =>
        [...c.voices].map(([key, v]: any) => ({
          key,
          frames: v.source.buffer.length,
          loop: v.source.loop,
        })),
      initial = capture();
    a.updateAhri(copy, copy.hero);
    const restored = capture();
    const result = {
      hidden,
      respawnAudience: r.respawn.audience,
      initial,
      restored,
      unchanged: w.snapshot() === saved && copy.snapshot() === saved,
      actualTick: r.respawn.tick,
      scheduledTick: r.respawnTick,
    };
    c.reset();
    a.setPaused(true);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return result;
  });
  expect(result.hidden).toEqual({ audience: ['red'], currentlyVisible: true, voices: 0 });
  expect(result.respawnAudience).toEqual(['blue', 'red']);
  expect(result.initial).toHaveLength(1);
  expect(result.initial[0].key).toMatch(/:respawn$/);
  expect(result.restored).toEqual(result.initial);
  expect(result.unchanged).toBe(true);
  expect(result.actualTick).toBe(result.scheduledTick);
  expect(requests).toHaveLength(2);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('ahri-visible-enemy-respawn.png') });
  await writeFile(
    info.outputPath('visibility-evidence.json'),
    JSON.stringify({ requests, result, errors }, null, 2)
  );
});
test('non-Ahri rosters request no lifecycle masters', async ({ page }) => {
  test.setTimeout(180000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-lifecycle/')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&champion=ashe');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriLifecycle.status)).toBe(
    'idle'
  );
});
