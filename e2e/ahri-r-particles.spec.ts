import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('keyboard R loads its exact spell closure and restores flight, contact and flipbook packets', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-r-')) requests.push(new URL(r.url()).pathname);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriRParticles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
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
    const target = w.spawn('champion', 'red', { x: 600, y: -450 }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.gainExperience(1e6);
    w.learnSpell('r');
    v.zoom = 0.6;
    v.recenter({ x: 420, y: -315 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (this.ahriRVisuals.length) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    g.setPaused(false);
    return v.screenPoint({ x: 600, y: -450 });
  });
  await page.mouse.move(aim.x, aim.y);
  await page.keyboard.press('r');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.ahriRVisuals.length))
    .toBe(1);
  const flight = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    const seen = new Set<number>();
    const digest = (attribute: any, count: number) => {
      const bytes = new Uint8Array(
        attribute.array.buffer,
        attribute.array.byteOffset,
        count * attribute.itemSize * 4
      );
      let hash = 2166136261;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
      return (hash >>> 0).toString(16);
    };
    const capture = () => ({
      surfaces: [...v.ahriRParticles.surfaces.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          return {
            key,
            profile: m.userData.profileIndex,
            position: m.position.toArray(),
            quaternion: m.quaternion.toArray(),
            scale: m.scale.toArray(),
            color: m.material.uniforms.particleColor.value.toArray(),
            uv: m.material.uniforms.sourceUvTransform.value.toArray(),
            mips: m.material.uniforms.sourceTexture.value.mipmaps.length,
            colors: m.geometry.getAttribute('_source_vertex_bgra')?.count ?? 0,
            normals: !!m.geometry.getAttribute('normal'),
            soft: !!m.material.uniforms.softDepth,
            unboundPalette: m.userData.unboundPalette,
          };
        }),
      ribbons: [...v.ahriRParticles.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, m]: any) => {
          seen.add(m.userData.profileIndex);
          const count = m.geometry.drawRange.count;
          return {
            key,
            profile: m.userData.profileIndex,
            count,
            position: digest(m.geometry.getAttribute('position'), count),
            cell: digest(m.geometry.getAttribute('sourceCell'), count),
            multCell: digest(m.geometry.getAttribute('sourceMultCell'), count),
            mult: digest(m.geometry.getAttribute('sourceMultUv'), count),
            color: digest(m.geometry.getAttribute('sourceTint'), count),
            soft: !!m.material.uniforms.softDepth,
            cellSize: m.material.uniforms.sourceCellSize.value.toArray(),
            palette: m.material.userData.paletteBinding
              ? {
                  mix: m.material.uniforms.paletteSourceMix.value.toArray(),
                  row: m.material.uniforms.paletteRow.value,
                  filter: m.material.uniforms.paletteTexture.value.minFilter,
                  nativeConstructorVerified:
                    m.material.userData.paletteBinding.nativeConstructorVerified,
                }
              : null,
          };
        }),
    });
    const record = w.ahriRVisuals[0],
      draws = [];
    for (const offset of [2, 5, 8, 11]) {
      w.step(record.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(capture());
    }
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    g.__rCapture = capture;
    g.__rSeen = seen;
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      placeholder: v.spiritBoltModels.size,
      deferred: v.ahriRParticles.deferredProfiles.map((p: any) => ({
        index: p.profileIndex,
        reason: p.reason,
      })),
    };
  });
  expect(flight.unchanged).toBe(true);
  expect(flight.restored).toEqual(flight.before);
  expect(flight.placeholder).toBe(0);
  expect(flight.deferred).toHaveLength(32);
  expect(flight.before.ribbons.length).toBeGreaterThan(0);
  expect(flight.before.surfaces.some((m: any) => m.colors === 209 && !m.normals)).toBe(true);
  expect(flight.before.ribbons.some((m: any) => m.cellSize[0] === 0.5)).toBe(true);
  expect(flight.before.ribbons.some((m: any) => m.soft)).toBe(true);
  expect(flight.draws.flatMap((draw: any) => draw.ribbons).filter((m: any) => m.palette)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        profile: 30,
        palette: {
          mix: [0.9499961733818054, 0, 0, 0],
          row: 0.5,
          filter: 1006,
          nativeConstructorVerified: false,
        },
      }),
    ])
  );
  await page.screenshot({ path: info.outputPath('ahri-r-flight.png') });
  const hit = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      record = w.ahriRVisuals[0],
      draws = [];
    for (const offset of [15, 18, 22, 26, 32]) {
      w.step(record.startTick + offset - w.tick);
      v.render(w, 1, v.previousElapsed);
      draws.push(g.__rCapture());
    }
    const saved = w.snapshot(),
      before = g.__rCapture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = g.__rCapture();
    v.render(w, 1, v.previousElapsed);
    return {
      draws,
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      seen: [...g.__rSeen].sort((a: any, b: any) => a - b),
      hit: record.bursts[0].bolts[0].hit,
      attachments: v.ahriRParticles.attachmentFallbacks,
    };
  });
  expect(hit.unchanged).toBe(true);
  expect(hit.restored).toEqual(hit.before);
  expect(hit.seen).toHaveLength(21);
  expect(hit.hit.targetRig).toBe('lux-base');
  expect(hit.attachments).toEqual([]);
  expect(hit.draws.some((draw: any) => draw.surfaces.some((m: any) => m.unboundPalette))).toBe(
    true
  );
  await page.screenshot({ path: info.outputPath('ahri-r-contact.png') });
  const eyes = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const record = w.ahriRVisuals[0];
    w.step(record.startTick + 95 - w.tick);
    v.zoom = 2.2;
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    const capture = () =>
      [...v.ahriRParticles.buffSurfaces.models]
        .sort(([a]: any, [b]: any) => a.localeCompare(b))
        .map(([key, model]: any) => ({
          key,
          profile: model.userData.profileIndex,
          position: model.position.toArray(),
          quaternion: model.quaternion.toArray(),
          scale: model.scale.toArray(),
          color: model.material.uniforms.particleColor.value.toArray(),
          uv: model.material.uniforms.sourceUvTransform.value.toArray(),
          mips: model.material.uniforms.sourceTexture.value.mipmaps.length,
        }));
    const saved = w.snapshot(),
      before = capture(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = capture();
    v.render(w, 1, v.previousElapsed);
    return {
      before,
      restored,
      unchanged: copy.snapshot() === saved,
      attachments: v.ahriRParticles.attachmentFallbacks,
      textureRequests: performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/assets/effects/ahri-q-cast-b4f44f95abaa3e8a.png'))
        .length,
    };
  });
  expect(eyes.unchanged).toBe(true);
  expect(eyes.restored).toEqual(eyes.before);
  expect(eyes.before.length).toBeGreaterThanOrEqual(4);
  expect([...new Set(eyes.before.map((model: any) => model.profile))].sort()).toEqual([45, 46]);
  expect(eyes.before.every((model: any) => model.mips > 1)).toBe(true);
  expect(eyes.before.some((model: any) => model.key.includes(':buff:L_Eye:'))).toBe(true);
  expect(eyes.before.some((model: any) => model.key.includes(':buff:R_Eye:'))).toBe(true);
  expect(eyes.attachments).toEqual([]);
  expect(eyes.textureRequests).toBe(1);
  await page.screenshot({ path: info.outputPath('ahri-r-eye-glows.png') });
  expect(new Set(requests).size).toBe(6);
  expect(requests.some((path) => path.endsWith('.glb'))).toBe(false);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('ahri-r-packets.json'),
    JSON.stringify({ requests, flight, hit, eyes, errors }, null, 2)
  );
});

test('a roster without Ahri never requests R transports', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/effects/ahri-r-')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(20);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      ahri: g.world.units.some((u: any) => u.champion === 'ahri'),
      ready: g.view.ahriRParticles.ready,
    };
  });
  expect(result).toEqual({ ahri: false, ready: false });
  expect(requests).toEqual([]);
});
