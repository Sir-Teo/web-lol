import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { MASTER_YI_Q_AUDIO as P } from '../src/content/masteryi-q-audio';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  test.setTimeout(120000);
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function probe(page: Page, reset = true) {
  await page.evaluate(async (reset) => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio;
    g.setPaused(true);
    if (reset) {
      w.units = [w.hero];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      w.hero.ai = false;
      Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
      w.setOrder(w.hero, { type: 'idle' });
      w.gainExperience(1e6);
      w.learnSpell('q');
      w.events = [];
    }
    a.unlock();
    await a.transition;
    await a.context.resume();
    const sound = a.masterYiQ.controller,
      p = {
        calls: [] as any[],
        synth: 0,
        update: () => {
          a.paused = false;
          a.updateGaren(w);
          a.update(
            w.events.filter(
              (e: any) => e.type === 'cast' && e.champion === 'masteryi' && e.text === 'q'
            ),
            w.tick
          );
        },
      };
    const create = a.context.createBufferSource.bind(a.context),
      osc = a.context.createOscillator.bind(a.context);
    a.context.createBufferSource = () => {
      const node = create(),
        start = node.start.bind(node);
      node.start = (when: number, offset: number) => {
        const media = [...sound.buffers].find(([, b]) => b === node.buffer)?.[0];
        const entry = [...sound.voices].find(([, v]: any) => v.source === node);
        if (media && entry)
          p.calls.push({
            media,
            key: entry[0],
            profileIndex: Number(entry[0].split(':').at(-1)),
            markIndex: Number(entry[0].split(':').at(-2)),
            when,
            offset,
            rate: node.playbackRate.value,
            gain: entry[1].gain.gain.value,
            frames: node.buffer.length,
            sampleRate: node.buffer.sampleRate,
            loop: node.loop,
          });
        return start(when, offset);
      };
      return node;
    };
    a.context.createOscillator = () => {
      p.synth++;
      return osc();
    };
    (window as any).__Q_AUDIO__ = p;
  }, reset);
}
async function open(page: Page) {
  await page.goto('/?scene=fixture&champion=masteryi');
  await ready(page);
  await probe(page);
}

test('all seven native float masters retain exact PCM hashes and headroom in browser AudioBuffers', async ({
  page,
}, info) => {
  await open(page);
  const actual = await page.evaluate(async () => {
    const a = (window as any).__GAME__.audio.masterYiQ.controller,
      rows = [];
    for (const [id, buffer] of a.buffers) {
      const channel = buffer.getChannelData(0);
      let peak = 0;
      for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
      const digest = await crypto.subtle.digest('SHA-256', channel.buffer);
      rows.push({
        id,
        frames: buffer.length,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        peak,
        pcmSha256: Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join(
          ''
        ),
      });
    }
    return rows.sort((a, b) => a.id - b.id);
  });
  const expected = P.flatMap((p) => p.variants)
    .map((v) => ({
      id: v.id,
      frames: v.frames,
      sampleRate: v.sampleRate,
      channels: v.channels,
      peak: v.peak,
      pcmSha256: v.pcmSha256,
    }))
    .sort((a, b) => a.id - b.id);
  expect(actual).toEqual(expected);
  expect(actual.filter((v) => v.peak > 1)).toHaveLength(3);
  writeFileSync(info.outputPath('browser-float-masters.json'), JSON.stringify(actual, null, 2));
});

for (const { critical, horizon } of [
  { critical: false, horizon: 30 },
  { critical: true, horizon: 30 },
  { critical: false, horizon: 100 },
])
  test(`real ${critical ? 'critical' : 'ordinary'} Q saves and restores both cast layers and only its declared contact cues${horizon === 100 ? ' after visual cleanup' : ''}`, async ({
    page,
  }, info) => {
    await open(page);
    const point = await page.evaluate((critical) => {
      const g = (window as any).__GAME__,
        w = g.world;
      if (critical) w.player.inventory = Array(6).fill('agility');
      const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
      target.hp = target.maxHp = 1e6;
      target.armor = 0;
      w.step();
      g.view.zoom = 0.6;
      g.view.recenter(w.hero);
      g.view.render(w, 1, g.view.previousElapsed);
      return g.view.screenPoint(target, 0.65);
    }, critical);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => {
      window.addEventListener('keyup', () => (window as any).__GAME__.setPaused(true), {
        once: true,
      });
      (window as any).__GAME__.setPaused(false);
    });
    await page.keyboard.press('q');
    const before = await page.evaluate(async (horizon) => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__Q_AUDIO__;
      g.setPaused(true);
      await g.audio.transition;
      g.audio.paused = false;
      await g.audio.context.resume();
      w.step();
      if (!w.player.alphaStrike) throw Error('Real Q was not admitted');
      g.audio.masterYiQ.stop();
      p.calls = [];
      p.update();
      w.step(w.player.alphaStrike.startTick + horizon - w.tick);
      p.update();
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(200);
      return {
        saved,
        future: copy.snapshot(),
        record: structuredClone(w.player.alphaAudio[0]),
        tick: w.tick,
        calls: p.calls.slice(),
        synth: p.synth,
      };
    }, horizon);
    const expectedProfiles = critical || horizon === 100 ? [0, 1] : [0, 1, 2];
    expect(before.calls.map((c) => c.profileIndex)).toEqual(expectedProfiles);
    expect(before.record.contacts).toHaveLength(critical ? 0 : horizon === 100 ? 4 : 1);
    expect(before.synth).toBe(0);
    expect(before.calls[0].when).toBe(before.calls[1].when);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before.saved);
    await probe(page, false);
    const after = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__Q_AUDIO__;
      p.update();
      const restored = p.calls.slice();
      w.step(200);
      p.update();
      return {
        restored,
        future: w.snapshot(),
        voices: g.audio.masterYiQ.controller.voices.size,
        synth: p.synth,
      };
    });
    expect(after.restored.map((c) => c.profileIndex)).toEqual(expectedProfiles);
    for (const c of after.restored) {
      const first = before.calls.find((v) => v.profileIndex === c.profileIndex)!;
      expect(c.media).toBe(first.media);
      expect(c.rate).toBe(first.rate);
      expect(c.gain).toBe(first.gain);
      expect(c.loop).toBe(false);
      const start = c.profileIndex === 2 ? before.record.contacts[0].tick : before.record.startTick;
      expect(c.offset).toBeCloseTo(((before.tick - start) / 60) * c.rate, 8);
    }
    expect(after.restored[0].when).toBe(after.restored[1].when);
    expect(after.future).toBe(before.future);
    expect(after.voices).toBe(0);
    expect(after.synth).toBe(0);
    writeFileSync(
      info.outputPath('q-audio-save-reload.json'),
      JSON.stringify({ before, after }, null, 2)
    );
  });

test('source cast layers apply independent global newest/oldest policies without per-frame resurrection', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = (window as any).__Q_AUDIO__,
      units = [w.hero];
    for (let i = 1; i < 4; i++) {
      const u = w.spawn('champion', 'blue', { x: i * 50, y: 0 }, 'masteryi');
      u.ai = false;
      w.learnSpell('q', u.id);
      units.push(u);
    }
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    for (const u of units)
      w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    p.update();
    for (let i = 0; i < 30; i++) p.update();
    return {
      ids: units.map((u) => u.id),
      calls: p.calls.slice(),
      voices: [...g.audio.masterYiQ.controller.voices.keys()],
      synth: p.synth,
    };
  });
  expect(result.calls).toHaveLength(7);
  expect(result.voices).toHaveLength(6);
  expect(result.synth).toBe(0);
  const owners = (profile: number) =>
    result.voices
      .filter((key) => key.endsWith(`:-1:${profile}`))
      .map((key) => Number(key.split(':')[0]));
  expect(owners(0)).toEqual(result.ids.slice(0, 3));
  expect(owners(1)).toEqual(result.ids.slice(1));
  expect(new Set(result.calls.map((c) => c.when)).size).toBe(1);
  writeFileSync(info.outputPath('global-cast-policies.json'), JSON.stringify(result, null, 2));
});

test('a generic fallback consumes both cast layers once while later ordinary contact remains eligible', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__Q_AUDIO__,
      sound = a.masterYiQ.controller;
    const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 1e6;
    sound.status = 'failed';
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: target, targetId: target.id });
    w.step();
    p.update();
    const fallback = p.synth;
    sound.status = 'ready';
    p.update();
    const castCalls = p.calls.length;
    w.step(28);
    p.update();
    return { fallback, castCalls, calls: p.calls.slice(), synth: p.synth };
  });
  expect(result.fallback).toBeGreaterThan(0);
  expect(result.castCalls).toBe(0);
  expect(result.calls.map((c) => c.profileIndex)).toEqual([2]);
  expect(result.synth).toBe(result.fallback);
  writeFileSync(info.outputPath('fallback-contact.json'), JSON.stringify(result, null, 2));
});

test('ordinary startup skips Q masters and late presence retries only the failed file explicitly', async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (/\/masteryi-q-\d+\.wav$/.test(r.url())) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await ready(page);
  expect(requests).toEqual([]);
  let failed = '';
  await page.route('**/assets/audio/masteryi-q-*.wav', async (route) => {
    if (!failed) {
      failed = route.request().url();
      await route.fulfill({ status: 503, body: 'fixture failure' });
    } else await route.continue();
  });
  await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { loadReferenceModels } = await import('/src/render/models.ts');
    await loadReferenceModels([], false, false, true);
    g.world.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
    await g.audio.masterYiQ.load();
  });
  expect(requests).toHaveLength(7);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.masterYiQ.status)).toBe('failed');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    for (let i = 0; i < 30; i++) g.audio.updateGaren(g.world);
  });
  expect(requests).toHaveLength(7);
  await page.unroute('**/assets/audio/masteryi-q-*.wav');
  await page.evaluate(async () => {
    await (window as any).__GAME__.audio.masterYiQ.load();
  });
  expect(requests).toHaveLength(8);
  expect(requests.filter((url) => url === failed)).toHaveLength(2);
  expect(await page.evaluate(() => (window as any).__GAME__.audio.masterYiQ.status)).toBe('ready');
  writeFileSync(
    info.outputPath('late-source-retry.json'),
    JSON.stringify({ requests, failed }, null, 2)
  );
});

test('unseen cast stays silent, known contact survives its last vision source, and terminal time drains without world mutation', async ({
  page,
}, info) => {
  await open(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      a = g.audio,
      p = (window as any).__Q_AUDIO__;
    const enemy = w.spawn('champion', 'red', { x: 300, y: 0 }, 'masteryi');
    enemy.ai = false;
    w.learnSpell('q', enemy.id);
    const visible = w.visible.bind(w);
    w.visible = (u: any, t: any = 'blue') =>
      u.id === enemy.id && t === 'blue' ? false : visible(u, t);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'q', point: w.hero, targetId: w.hero.id });
    w.step();
    p.update();
    const unseen = p.calls.length;
    w.step(28);
    p.update();
    const known = p.calls.slice();
    w.damage(enemy, w.hero, 1e9, 'true');
    a.masterYiQ.stop();
    p.update();
    const afterDeath = p.calls.slice(known.length);
    const nexus = w.spawn('nexus', 'blue', { x: 1000, y: 1000 });
    w.damage(enemy, nexus, 1e9, 'true');
    p.update();
    const saved = w.snapshot();
    a.garenPTerminalStart -= 3;
    p.update();
    return {
      unseen,
      known,
      afterDeath,
      voices: a.masterYiQ.controller.voices.size,
      unchanged: w.snapshot() === saved,
      synth: p.synth,
    };
  });
  expect(result.unseen).toBe(0);
  expect(result.known.map((c) => c.profileIndex)).toEqual([2]);
  expect(result.afterDeath.map((c) => c.profileIndex)).toEqual([2]);
  expect(result.voices).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.synth).toBe(0);
  writeFileSync(info.outputPath('known-contact-terminal.json'), JSON.stringify(result, null, 2));
});
