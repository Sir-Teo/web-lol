import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_ATTACK_AUDIO_PROFILES as P } from '../src/content/ahri-attack-audio-policy';
for (const critical of [false, true])
  test(`Ahri ${critical ? 'critical' : 'ordinary'} source attack audio follows right-click windup release contact and restoration`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/assets/audio/ahri-attack/')) requests.push(r.url());
    });
    await page.goto('/?scene=fixture&champion=ahri');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriAA.status))
      .toBe('ready');
    const point = await page.evaluate((critical) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.projectiles = [];
      w.ahriAttackAudio = [];
      w.nextWaveTick = 1e9;
      w.pendingSpawns = [];
      w.setOrder(w.hero, { type: 'idle' });
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
      w.battlefield.lineOfSight = () => true;
      w.battlefield.inBrush = () => false;
      w.gainExperience(1e6);
      w.championState(w.hero.id).inventory = critical ? Array(6).fill('agility') : [];
      const target = w.spawn('dummy', 'red', { x: 450, y: 0 });
      Object.assign(target, { ai: false, hp: 10000, maxHp: 10000, armor: 0 });
      w.random.state = 1;
      g.view.zoom = 0.6;
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      const step = w.step;
      let phase = 0;
      w.step = function (this: any, ...args: any[]) {
        const result = step.apply(this, args),
          r = this.ahriAttackAudio[0];
        if (phase === 0 && r) {
          phase = 1;
          g.setPaused(true);
        } else if (phase === 1 && r?.launch) {
          phase = 2;
          g.setPaused(true);
        } else if (phase === 2 && r?.launch?.end?.reason === 'hit') {
          this.step = step;
          this.setOrder(this.hero, { type: 'idle' });
          g.setPaused(true);
        }
        return result;
      };
      const point = g.view.screenPoint(target, 0.65);
      if (g.view.pick(w, point.x, point.y)?.id !== target.id)
        throw Error('Attack fixture does not pick its intended target');
      return point;
    }, critical);
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriAttackAudio.length), {
        timeout: 30000,
      })
      .toBe(1);
    const capture = () =>
      page.evaluate(async () => {
        const g = (window as any).__GAME__,
          a = g.audio,
          c = a.ahriAA.controller,
          w = g.world;
        g.setPaused(true);
        a.setPaused(false);
        a.unlock();
        await a.transition;
        await a.context.resume();
        const saved = w.snapshot();
        c.reset();
        a.updateAhri(w, w.hero);
        const result = {
          critical: w.ahriAttackAudio[0].critical,
          launch: w.ahriAttackAudio[0].launch,
          voices: [...c.voices].map(([key, v]: any) => ({
            key,
            rate: v.source.playbackRate.value,
            gain: v.gain.gain.value,
            frames: v.source.buffer.length,
            loop: v.source.loop,
            stopAge: v.stopAge,
          })),
          unchanged: w.snapshot() === saved,
        };
        a.setPaused(true);
        return result;
      });
    const windup = await capture();
    expect(windup.critical).toBe(critical);
    expect(windup.launch).toBeNull();
    expect(windup.voices).toHaveLength(1);
    expect(windup.voices[0].key).toMatch(/:cast$/);
    expect(windup.unchanged).toBe(true);
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await expect
      .poll(
        () => page.evaluate(() => !!(window as any).__GAME__.world.ahriAttackAudio[0]?.launch),
        { timeout: 30000 }
      )
      .toBe(true);
    const launch = await capture();
    expect(launch.launch?.end).toBeNull();
    expect(launch.voices).toHaveLength(2);
    expect(launch.voices.some((v: any) => v.key.endsWith(':launch'))).toBe(true);
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as any).__GAME__.world.ahriAttackAudio[0]?.launch?.end?.reason
          ),
        { timeout: 30000 }
      )
      .toBe('hit');
    await page.screenshot({
      path: info.outputPath(`ahri-${critical ? 'critical' : 'ordinary'}-contact.png`),
    });
    const contact = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world,
        a = g.audio,
        c = a.ahriAA.controller;
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
          rate: v.source.playbackRate.value,
          gain: v.gain.gain.value,
          frames: v.source.buffer.length,
          loop: v.source.loop,
          stopAge: v.stopAge,
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
          pcmSha256: Array.from(new Uint8Array(digest), (n) =>
            n.toString(16).padStart(2, '0')
          ).join(''),
        });
      }
      const r = w.ahriAttackAudio[0],
        result = {
          initial,
          muted,
          resumed,
          restored,
          clips,
          critical: r.critical,
          contact: r.launch.end,
          projectiles: w.projectiles.length,
          damagedTarget: w.unit(r.targetId).hp < w.unit(r.targetId).maxHp,
          unchanged: w.snapshot() === saved && copy.snapshot() === saved,
        };
      c.reset();
      a.setPaused(true);
      return result;
    });
    expect(requests).toHaveLength(12);
    expect(new Set(requests).size).toBe(12);
    expect(contact.clips).toHaveLength(12);
    expect(contact.critical).toBe(critical);
    expect(contact.damagedTarget).toBe(true);
    expect(contact.contact.reason).toBe('hit');
    expect(contact.projectiles).toBe(0);
    expect(contact.initial).toHaveLength(3);
    expect(contact.initial.every((v: any) => !v.loop)).toBe(true);
    expect(contact.initial.some((v: any) => v.key.endsWith(':hit'))).toBe(true);
    expect(contact.muted).toBe(0);
    expect(contact.resumed).toEqual(contact.initial);
    expect(contact.restored).toEqual(contact.initial);
    expect(contact.unchanged).toBe(true);
    for (const clip of Object.values(P).flatMap((p) => [...p.variants]))
      expect(contact.clips.find((c: any) => c.id === clip.id)).toMatchObject({
        frames: clip.frames,
        sampleRate: 44100,
        channels: 1,
        pcmSha256: clip.pcmSha256,
      });
    expect(errors).toEqual([]);
    await writeFile(
      info.outputPath('audio-evidence.json'),
      JSON.stringify({ critical, requests, windup, launch, ...contact, errors }, null, 2)
    );
  });
test('non-Ahri rosters request no Ahri attack masters', async ({ page }) => {
  test.setTimeout(180000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-attack/')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&champion=ashe');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriAA.status)).toBe('idle');
});
