import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function fixture(page: Page, visible = true) {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate((visible) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('melee', 'red', { x: 300, y: 0 });
    target.hp = target.maxHp = 10000;
    target.ai = false;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step(31);
    w.pointVisible = () => visible;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step();
    w.setOrder(target, { type: 'move', point: { x: 600, y: 150 } });
    w.step(5);
    v.center = { x: 300, y: 0 };
    v.zoom = 0.55;
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const zone = w.singularities[0],
      key = `${zone.id}:${target.id}`;
    const capture = () => {
      const root = v.luxSingularities.hitModels.get(key);
      return root
        ? root.children.map((m: any) => ({
            name: m.name,
            position: Array.from(m.geometry.getAttribute('position').array),
            index: Array.from(m.geometry.index.array),
            count: m.geometry.drawRange.count,
            color: m.material.uniforms.particleColor.value.toArray(),
          }))
        : null;
    };
    (window as any).__E_HIT__ = { key, lux: lux.id, target: target.id, zone: zone.id, capture };
    return {
      audience: zone.hits[0].audience,
      frames: zone.hits[0].frames.length,
      models: v.luxSingularities.hitModels.size,
      capture: capture(),
    };
  }, visible);
}

test('moving target flash reconstructs from saved frames and survives actual graphics loss, then disposes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const setup = await fixture(page);
  expect(setup.models).toBe(1);
  expect(setup.frames).toBe(6);
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__E_HIT__;
    s.saved = w.snapshot();
    s.data = JSON.stringify(s.capture());
    const copy = w.constructor.fromSnapshot(s.saved, w.battlefield);
    v.render(copy, 1, v.previousElapsed);
    const restored = JSON.stringify(s.capture()) === s.data;
    const later = w.constructor.fromSnapshot(s.saved, w.battlefield);
    later.step(30);
    v.render(later, 1, v.previousElapsed);
    v.render(w, 1, v.previousElapsed);
    const seek = JSON.stringify(s.capture()) === s.data;
    const gl = v.renderer.getContext();
    s.pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      s.pixels
    );
    const root = v.luxSingularities.hitModels.get(s.key);
    root.visible = false;
    v.renderer.render(v.scene, v.camera);
    const without = new Uint8Array(s.pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      without
    );
    const contribution = without.reduce(
      (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
      0
    );
    root.visible = true;
    v.render(w, 1, v.previousElapsed);
    return { restored, seek, layers: s.capture(), contribution };
  });
  expect(before.restored && before.seek).toBe(true);
  expect(before.layers).toHaveLength(1);
  expect(before.contribution).toBeGreaterThan(0);
  await page.screenshot({
    path: 'artifacts/lux-e-hit-moving.png',
    style: '.modal-backdrop { visibility:hidden!important; }',
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__E_HIT__;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(s.pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const different = pixels.reduce(
      (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
      0
    );
    const buffers = JSON.stringify(s.capture()) === s.data,
      snapshot = w.snapshot() === s.saved;
    const root = v.luxSingularities.hitModels.get(s.key);
    let disposed = 0;
    root.children[0].geometry.addEventListener('dispose', () => disposed++);
    root.children[0].material.addEventListener('dispose', () => disposed++);
    w.step(20);
    v.render(w, 1, v.previousElapsed);
    return {
      different,
      buffers,
      snapshot,
      disposed,
      models: v.luxSingularities.hitModels.size,
      hits: w.singularities[0].hits.length,
    };
  });
  expect(after).toEqual({
    different: 0,
    buffers: true,
    snapshot: true,
    disposed: 2,
    models: 0,
    hits: 0,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-e-hit-recovery.json',
    JSON.stringify({ setup, before, after }, null, 2) + '\n'
  );
});

for (const visible of [true, false])
  test(`target hit ${visible ? 'hides and returns at the saved phase' : 'keeps its hidden creation audience'} under fog`, async ({
    page,
  }) => {
    const setup = await fixture(page, visible);
    expect(setup.models).toBe(visible ? 1 : 0);
    const result = await page.evaluate((visible) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view,
        s = (window as any).__E_HIT__;
      const previous = JSON.stringify(s.capture());
      w.pointVisible = () => false;
      v.render(w, 1, v.previousElapsed);
      const hidden = [...v.luxSingularities.hitModels.values()].every(
        (root: any) =>
          !root.visible && root.children.every((m: any) => m.geometry.drawRange.count === 0)
      );
      w.step(3);
      w.pointVisible = () => true;
      v.render(w, 1, v.previousElapsed);
      const current = JSON.stringify(s.capture()),
        saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      v.render(copy, 1, v.previousElapsed);
      return {
        hidden,
        restored: JSON.stringify(s.capture()) === current,
        models: v.luxSingularities.hitModels.size,
        snapshot: w.snapshot() === saved,
        audience: w.singularities[0].hits[0].audience,
        continued: !visible || current !== previous,
      };
    }, visible);
    expect(result.hidden && result.restored && result.snapshot && result.continued).toBe(true);
    expect(result.models).toBe(visible ? 1 : 0);
    if (!visible) expect(result.audience).toEqual(['red']);
    writeFileSync(
      `artifacts/lux-e-hit-fog-${visible ? 'seen' : 'unseen'}.json`,
      JSON.stringify(result, null, 2) + '\n'
    );
  });

test('an accepted target flash drains after victory without changing the frozen checkpoint', async ({
  page,
}) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__E_HIT__;
    const finisher = w.spawn('melee', 'blue', { x: -200, y: -200 }),
      nexus = w.spawn('nexus', 'red', { x: -150, y: -200 });
    nexus.hp = 1;
    w.setOrder(finisher, { type: 'attack', target: nexus.id });
    finisher.releaseTick = w.tick + 1;
    finisher.attackTarget = nexus.id;
    w.step();
    const saved = w.snapshot(),
      start = v.previousElapsed;
    v.render(w, 1, start);
    const first = s.capture(),
      root = v.luxSingularities.hitModels.get(s.key);
    let disposed = 0;
    root.children[0].geometry.addEventListener('dispose', () => disposed++);
    root.children[0].material.addEventListener('dispose', () => disposed++);
    v.render(w, 1, start + 0.1);
    const later = s.capture();
    v.render(w, 1, start + 0.1);
    const repeated = JSON.stringify(s.capture()) === JSON.stringify(later);
    v.render(w, 1, start + 0.5);
    const expired = v.luxSingularities.hitModels.size === 0;
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    w.step(100);
    copy.step(100);
    return {
      winner: w.winner,
      first,
      later,
      repeated,
      expired,
      disposed,
      frozen: w.snapshot() === saved && copy.snapshot() === saved,
    };
  });
  expect(result.winner).toBe('blue');
  expect(result.first).not.toBeNull();
  expect(result.later).not.toEqual(result.first);
  expect(result.repeated && result.expired && result.frozen).toBe(true);
  expect(result.disposed).toBe(2);
  writeFileSync('artifacts/lux-e-hit-terminal.json', JSON.stringify(result, null, 2) + '\n');
});
