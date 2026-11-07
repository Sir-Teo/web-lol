import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.ahriEParticles.ready), {
      timeout: 60000,
    })
    .toBe(true);
}

test('keyboard E loads its exact asset closure and restores cast, flight, hit and both buff packets', async ({
  page,
}, info) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-e-')) requests.push(new URL(r.url()).pathname);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const aim = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    w.setOrder(w.hero, { type: 'idle' });
    Object.assign(w.hero, { x: 300, y: -225, previous: { x: 300, y: -225 }, ai: false });
    const target = w.spawn('champion', 'red', { x: 900, y: -675 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.learnSpell('e');
    v.zoom = 0.6;
    v.recenter({ x: 600, y: -450 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriEVisuals.length) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    g.setPaused(false);
    return v.screenPoint({ x: 900, y: -675 });
  });
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriEVisuals.length))
    .toBe(1);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const digest = (array: any, count: number, itemSize: number) => {
      const bytes = new Uint8Array(
        array.buffer,
        array.byteOffset,
        count * itemSize * array.BYTES_PER_ELEMENT
      );
      let hash = 2166136261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return (hash >>> 0).toString(16);
    };
    const attr = (a: any, count = a?.count) =>
      a
        ? {
            count,
            itemSize: a.itemSize,
            type: a.array.constructor.name,
            hash: digest(a.array, count, a.itemSize),
          }
        : null;
    g.__eSeen = new Set<number>();
    g.__eCapture = () => {
      const e = g.view.ahriEParticles;
      return {
        surfaces: [...e.surfaces.models]
          .sort(([a]: any, [b]: any) => a.localeCompare(b))
          .map(([key, m]: any) => {
            g.__eSeen.add(m.userData.profileIndex);
            return {
              key,
              profile: m.userData.profileIndex,
              position: m.position.toArray(),
              quaternion: m.quaternion.toArray(),
              scale: m.scale.toArray(),
              color: m.material.uniforms.particleColor.value.toArray(),
              lookup: m.material.uniforms.lookupUv.value.toArray(),
              uv: m.material.uniforms.sourceUvTransform.value.toArray(),
              erosion: m.material.uniforms.erosionParameters?.value.toArray(),
              positionBytes: attr(m.geometry.getAttribute('position')),
              uvBytes: attr(m.geometry.getAttribute('uv')),
              colorBytes: attr(m.geometry.getAttribute('_source_vertex_bgra')),
              index: attr(m.geometry.getIndex()),
              unboundPalette: m.userData.unboundPalette,
            };
          }),
        ribbons: [...e.models]
          .sort(([a]: any, [b]: any) => a.localeCompare(b))
          .map(([key, m]: any) => {
            g.__eSeen.add(m.userData.profileIndex);
            const count = m.geometry.drawRange.count;
            return {
              key,
              profile: m.userData.profileIndex,
              count,
              attributes: Object.fromEntries(
                [
                  'position',
                  'uv',
                  'sourceTint',
                  'sourceLookup',
                  'sourceErosion',
                  'sourceMultUv',
                ].map((name) => [name, attr(m.geometry.getAttribute(name), count)])
              ),
            };
          }),
        skins: [...e.castSkins.models]
          .sort(([a]: any, [b]: any) => a.localeCompare(b))
          .map(([key, m]: any) => {
            g.__eSeen.add(m.root.userData.profileIndex);
            const bones: any[] = [];
            m.sampler.renderRoot.traverse((node: any) => {
              if (node.isSkinnedMesh && node.visible) {
                node.skeleton.update();
                const array = node.skeleton.boneMatrices;
                bones.push(digest(array, array.length, 1));
              }
            });
            return {
              key,
              profile: m.root.userData.profileIndex,
              position: m.root.position.toArray(),
              rotation: m.root.quaternion.toArray(),
              bones,
              color: m.material.uniforms.particleColor.value.toArray(),
              erosion: m.material.uniforms.erosionParameters.value.toArray(),
              uv: m.material.uniforms.sourceUvTransform.value.toArray(),
            };
          }),
        fallbacks: e.attachmentFallbacks,
        unboundSkin: e.unboundSkinProfiles,
      };
    };
  });
  const evidence: any[] = [];
  for (const [phase, offset] of [
    ['cast', 12],
    ['flight', 25],
    ['hit', 0],
    ['control', 60],
    ['late', 180],
  ] as const) {
    const result = await page.evaluate(
      ({ phase, offset }) => {
        const g = (window as any).__GAME__,
          w = g.world,
          v = g.view,
          r = w.ahriEVisuals[0];
        if (phase === 'hit') {
          while (!r.hit && w.tick < r.castTick + 100) w.step();
          if (!r.hit) throw Error('Expected observed Charm contact');
          w.step();
        } else w.step(r.castTick + offset - w.tick);
        v.render(w, 1, v.previousElapsed);
        g.hud.update(60);
        const saved = w.snapshot(),
          before = g.__eCapture(),
          copy = w.constructor.fromSnapshot(saved, w.battlefield);
        v.render(copy, 1, v.previousElapsed);
        const restored = g.__eCapture();
        v.render(w, 1, v.previousElapsed);
        return {
          phase,
          tick: w.tick,
          before,
          restored,
          unchanged: copy.snapshot() === saved,
          provisional: [...v.projectileModels.values()].some(
            (m: any) => m.name === 'Ahri provisional Charm'
          ),
          charm: r.buff !== null,
        };
      },
      { phase, offset }
    );
    expect(result.unchanged).toBe(true);
    expect(result.restored).toEqual(result.before);
    expect(result.provisional).toBe(false);
    if (phase === 'cast') expect(result.before.skins).toHaveLength(1);
    if (phase === 'flight') expect(result.before.ribbons).toHaveLength(3);
    if (phase === 'control') expect(result.charm).toBe(true);
    evidence.push(result);
    if (phase !== 'late')
      await page.screenshot({ path: info.outputPath('ahri-e-' + phase + '.png') });
  }
  const seen = await page.evaluate(() =>
    [...(window as any).__GAME__.__eSeen].sort((a: any, b: any) => a - b)
  );
  expect(seen).toHaveLength(28);
  expect(seen).not.toContain(3);
  expect(new Set(requests).size).toBe(13);
  expect(requests.filter((p) => p.endsWith('.glb'))).toHaveLength(2);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-e-packets.json'),
    JSON.stringify({ requests, seen, evidence, errors }, null, 2)
  );
});

test('an ordinary roster never requests E transports', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-e-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&npc=lux');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      ready: g.view.ahriEParticles.ready,
      ahri: g.world.units.some((u: any) => u.champion === 'ahri'),
    };
  });
  expect(state).toEqual({ ready: false, ahri: false });
  expect(requests).toEqual([]);
});

test('a genuine brush-hidden E flight reveals its bound core without replaying hidden cast skin', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    Object.assign(w.hero, { x: -350, y: -50, previous: { x: -350, y: -50 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    const enemy = w.spawn('champion', 'red', { x: -820, y: -50 }, 'ahri');
    enemy.ai = false;
    w.learnSpell('e', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'e', point: { x: -350, y: -50 } });
    w.step(20);
    v.zoom = 0.65;
    v.recenter({ x: -580, y: -50 });
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriEVisuals[0];
    const hidden = {
      insideBrush: w.battlefield.inBrush(enemy),
      heroOutside: !w.battlefield.inBrush(w.hero),
      castKnown: r.castAudience.includes('blue'),
      surfaces: v.ahriEParticles.surfaces.models.size,
      ribbons: v.ahriEParticles.models.size,
      skins: v.ahriEParticles.castSkins.models.size,
    };
    let entered = false;
    while (w.tick < r.castTick + 90) {
      w.step();
      if (w.projectiles.some((p: any) => p.type === 'charm' && w.pointVisible(p, 'blue'))) {
        entered = true;
        break;
      }
    }
    w.step(2);
    v.render(w, 1, v.previousElapsed);
    return {
      hidden,
      visible: {
        entered,
        surfaces: v.ahriEParticles.surfaces.models.size,
        ribbons: v.ahriEParticles.models.size,
        skins: v.ahriEParticles.castSkins.models.size,
        unseen: r.flightFrames.filter((f: any) => !f.audience.includes('blue')).length,
        seen: r.flightFrames.filter((f: any) => f.audience.includes('blue')).length,
        visiblePoints: [...v.ahriEParticles.models.values()].map(
          (m: any) => m.userData.visiblePoints
        ),
      },
    };
  });
  expect(result.hidden).toEqual({
    insideBrush: true,
    heroOutside: true,
    castKnown: false,
    surfaces: 0,
    ribbons: 0,
    skins: 0,
  });
  expect(result.visible.entered).toBe(true);
  expect(result.visible.surfaces).toBeGreaterThan(0);
  expect(result.visible.ribbons).toBeGreaterThan(0);
  expect(result.visible.skins).toBe(0);
  expect(result.visible.unseen).toBeGreaterThan(0);
  expect(result.visible.seen).toBeGreaterThan(0);
  expect(result.visible.visiblePoints.every((n: number) => n >= 2)).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-e-hidden-entry.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('committed E survives actual Flash and caster death and drains at victory without World steps', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    Object.assign(w.hero, { x: 0, y: 1000, previous: { x: 0, y: 1000 }, ai: false });
    w.setOrder(w.hero, { type: 'idle' });
    const target = w.spawn('champion', 'red', { x: 800, y: 1000 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.learnSpell('e');
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'e', point: { x: 1000, y: 1000 } });
    w.step(25);
    v.render(w, 1, v.previousElapsed);
    const r = w.ahriEVisuals[0],
      saved = w.snapshot();
    const before = {
      flight: w.projectiles.some((p: any) => p.type === 'charm'),
      draws: v.ahriEParticles.surfaces.models.size + v.ahriEParticles.models.size,
    };
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: w.summonerSlot('flash'),
      point: { x: -300, y: 1000 },
    });
    w.step();
    const flashed = w.hero.x;
    w.damage(target, w.hero, 1e6, 'true');
    while (!r.stop && w.tick < r.castTick + 90) w.step();
    v.render(w, 1, v.previousElapsed);
    const dead = { hp: w.hero.hp, end: r.stop?.reason, hit: r.hit !== null };
    w.step(400);
    v.render(w, 1, v.previousElapsed);
    const drained = {
      surfaces: v.ahriEParticles.surfaces.models.size,
      ribbons: v.ahriEParticles.models.size,
      skins: v.ahriEParticles.castSkins.models.size,
    };
    const terminal = w.constructor.fromSnapshot(saved, w.battlefield),
      nexus = terminal.spawn('nexus', 'red', { x: 1500, y: 1500 });
    terminal.damage(terminal.hero, nexus, 1e6, 'true');
    const snapshot = terminal.snapshot();
    v.render(terminal, 1, v.previousElapsed);
    v.ahriEParticles.update(terminal, 1, v.camera, 8);
    return {
      before,
      flashed,
      dead,
      drained,
      terminal: {
        winner: terminal.winner,
        unchanged: terminal.snapshot() === snapshot,
        surfaces: v.ahriEParticles.surfaces.models.size,
        ribbons: v.ahriEParticles.models.size,
        skins: v.ahriEParticles.castSkins.models.size,
      },
    };
  });
  expect(result.before.flight).toBe(true);
  expect(result.before.draws).toBeGreaterThan(0);
  expect(result.flashed).toBe(-300);
  expect(result.dead).toEqual({ hp: 0, end: 'hit', hit: true });
  expect(result.drained).toEqual({ surfaces: 0, ribbons: 0, skins: 0 });
  expect(result.terminal).toEqual({
    winner: 'blue',
    unchanged: true,
    surfaces: 0,
    ribbons: 0,
    skins: 0,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-e-flash-death-terminal.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});
