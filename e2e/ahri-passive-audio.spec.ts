import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { AHRI_PASSIVE_AUDIO_PROFILES as P } from '../src/content/ahri-passive-audio-policy';

for (const kind of ['champion', 'minion'] as const)
  test(`Essence Theft ${kind} source audio follows a real keyboard Q kill through consumption and restore`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('/assets/audio/ahri-passive/')) requests.push(r.url());
    });
    await page.goto('/?scene=fixture&champion=ahri');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.audio.ahriPassive.status))
      .toBe('ready');
    const point = await page.evaluate((kind) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = 1e9;
      w.pendingSpawns = [];
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
      w.battlefield.lineOfSight = () => true;
      w.battlefield.inBrush = () => false;
      w.gainExperience(1e6);
      w.learnSpell('q');
      w.hero.hp = 100;
      if (kind === 'minion')
        for (let i = 0; i < 8; i++) {
          const v = w.spawn('melee', 'red', { x: 400, y: 0 });
          v.ai = false;
          w.damage(w.hero, v, 1e6, 'true');
        }
      const target = w.spawn(
        kind === 'champion' ? 'champion' : 'melee',
        'red',
        { x: 400, y: 0 },
        kind === 'champion' ? 'lux' : undefined
      );
      Object.assign(target, { ai: false, hp: 1, magicResist: 0 });
      w.step();
      g.view.zoom = 0.6;
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      const step = w.step;
      let born = false;
      w.step = function (this: any, ...args: any[]) {
        const result = step.apply(this, args);
        if (!born && this.ahriPassiveAudio.length) {
          born = true;
          g.setPaused(true);
        } else if (this.ahriPassiveAudio.some((r: any) => r.end?.reason === 'consumed')) {
          this.step = step;
          g.setPaused(true);
        }
        return result;
      };
      return g.view.screenPoint({ x: 900, y: 0 });
    }, kind);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await page.keyboard.press('q');
    await expect
      .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriPassiveAudio.length), {
        timeout: 30000,
      })
      .toBe(1);
    const birth = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        a = g.audio,
        c = a.ahriPassive.controller;
      a.setPaused(false);
      a.unlock();
      await a.transition;
      await a.context.resume();
      c.reset();
      a.updateAhri(g.world, g.world.hero);
      const result = {
        keys: [...c.voices.keys()],
        stopped: g.world.ahriPassiveAudio[0].end,
        kind: g.world.ahriPassiveAudio[0].kind,
      };
      a.setPaused(true);
      return result;
    });
    expect(birth.kind).toBe(kind);
    expect(birth.stopped).toBeNull();
    expect(birth.keys).toHaveLength(1);
    expect(birth.keys[0]).toMatch(/:launch$/);
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__GAME__.world.ahriPassiveAudio[0]?.end?.reason),
        { timeout: 30000 }
      )
      .toBe('consumed');
    await page.screenshot({ path: info.outputPath(`passive-${kind}-contact.png`) });
    const contact = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world,
        a = g.audio,
        c = a.ahriPassive.controller;
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
      const healed = w.ahriEssences[0].healed;
      const unchanged = w.snapshot() === saved && copy.snapshot() === saved;
      c.reset();
      a.setPaused(true);
      // Retain the arrival source tail after the gameplay Essence is pruned.
      w.step(40);
      const lateSave = w.snapshot();
      const lateCopy = w.constructor.fromSnapshot(lateSave, w.battlefield);
      a.setPaused(false);
      c.reset();
      a.updateAhri(lateCopy, lateCopy.hero);
      const late = capture();
      const gameplayEssences = lateCopy.ahriEssences.length;
      c.reset();
      a.setPaused(true);
      return {
        initial,
        muted,
        resumed,
        restored,
        clips,
        unchanged,
        healed,
        late,
        gameplayEssences,
        lateUnchanged: lateCopy.snapshot() === lateSave,
      };
    });
    expect(requests).toHaveLength(5);
    expect(new Set(requests).size).toBe(5);
    expect(contact.initial).toHaveLength(kind === 'champion' ? 3 : 2);
    expect(contact.initial.every((v: any) => v.rate === 1 && !v.loop)).toBe(true);
    expect(
      contact.initial.some((v: any) =>
        v.key.endsWith(kind === 'champion' ? ':orbBuffActivate' : ':minionHeal')
      )
    ).toBe(true);
    expect(contact.muted).toBe(0);
    expect(contact.resumed).toEqual(contact.initial);
    expect(contact.restored).toEqual(contact.initial);
    expect(contact.unchanged).toBe(true);
    expect(contact.healed).toBeGreaterThan(0);
    expect(contact.gameplayEssences).toBe(0);
    expect(contact.lateUnchanged).toBe(true);
    expect(contact.late.length).toBeGreaterThan(0);
    expect(contact.clips).toHaveLength(5);
    for (const clip of Object.values(P).flatMap((p) => [...p.variants]))
      expect(contact.clips.find((v: any) => v.id === clip.id)).toMatchObject({
        frames: clip.frames,
        sampleRate: 44100,
        channels: 1,
        pcmSha256: clip.pcmSha256,
      });
    expect(errors).toEqual([]);
    await writeFile(
      info.outputPath('audio-evidence.json'),
      JSON.stringify({ kind, requests, birth, ...contact, errors }, null, 2)
    );
  });

test('non-Ahri rosters request no Essence Theft masters', async ({ page }) => {
  test.setTimeout(180000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/ahri-passive/')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&champion=ashe');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.ahriPassive.status)).toBe('idle');
});
