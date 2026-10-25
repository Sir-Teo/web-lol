import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Leona queues visible Eclipse defense and renders its saved source surfaces', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.hud.closeModal();
    g.setPaused(true);
    const leona = w.units.find((u: any) => u.champion === 'leona'),
      state = w.championState(leona.id);
    w.units = [w.hero, leona];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -400, y: -300, previous: { x: -400, y: -300 } });
    Object.assign(leona, { x: 0, y: 0, previous: { x: 0, y: 0 }, speed: 0, ai: false });
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const enemy = w.spawn('champion', 'red', { x: 400, y: 0 });
    enemy.ai = false;
    w.setOrder(enemy, { type: 'attack', target: leona.id });
    w.step();
    w.battlefield.lineOfSight = () => false;
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
    const casts = () =>
      w.commands.filter((c: any) => c.type === 'cast' && c.unit === leona.id && c.ability === 'w');
    const hiddenQueued = casts().length;
    leona.ai = false;
    w.battlefield.lineOfSight = () => true;
    w.setOrder(enemy, { type: 'attack', target: leona.id });
    enemy.nextAttackTick = w.tick;
    w.step();
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
    const queued = casts().map((c: any) => ({ ...c })),
      snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
    v.locked = false;
    v.zoom = 0.55;
    v.recenter(leona);
    for (let i = 0; i < 35; i++) {
      w.step();
      copy.step();
      v.render(w, 1, 22.5);
    }
    const gl = v.renderer.getContext(),
      models = [...v.leonaEclipseSurfaces.models.values()] as any[];
    const read = () => {
      const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p
      );
      return p;
    };
    const draw = () => {
      v.renderer.render(v.scene, v.camera);
      v.particleDistortion.render(v.renderer, v.camera);
      return read();
    };
    const all = draw(),
      visibility = models.map((m) => m.visible);
    for (const m of models) m.visible = false;
    const hidden = draw();
    let changedPixels = 0;
    for (let i = 0; i < all.length; i += 4)
      if (all[i] !== hidden[i] || all[i + 1] !== hidden[i + 1] || all[i + 2] !== hidden[i + 2])
        changedPixels++;
    models.forEach((m, i) => (m.visible = visibility[i]));
    v.render(w, 1, 22.5);
    g.hud.update(60);
    return {
      hiddenQueued,
      queued,
      snapshot,
      identicalFuture: copy.snapshot() === w.snapshot(),
      active: state.leonaW,
      visuals: state.leonaWVisuals.length,
      surfaces: models.length,
      changedPixels,
      mana: leona.mana,
      maxMana: leona.maxMana,
      hp: leona.hp,
      maxHp: leona.maxHp,
      glError: gl.getError(),
    };
  });
  expect(result.hiddenQueued).toBe(0);
  expect(result.queued).toHaveLength(1);
  expect(result.identicalFuture).toBe(true);
  expect(result.active).not.toBeNull();
  expect(result.visuals).toBe(1);
  expect(result.surfaces).toBeGreaterThan(0);
  expect(result.changedPixels).toBeGreaterThan(10);
  expect(result.mana).toBeLessThan(result.maxMana - 50);
  expect(result.hp).toBeLessThan(result.maxHp);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('eclipse-defense.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ result, errors }, null, 2) + '\n'
  );
});
