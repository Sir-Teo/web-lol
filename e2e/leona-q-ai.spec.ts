import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Leona queues a visible recovery Q and draws its paid saved Daybreak contact', async ({
  page,
}, info) => {
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
    Object.assign(w.hero, { x: -400, y: -300, previous: { x: -400, y: -300 }, ai: false });
    Object.assign(leona, { x: 0, y: 0, previous: { x: 0, y: 0 }, speed: 0, ai: false });
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const enemy = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    enemy.ai = false;
    w.setOrder(leona, { type: 'attack', target: enemy.id });
    w.step();
    w.step(leona.releaseTick - w.tick);
    const originalNext = leona.nextAttackTick,
      hpBefore = enemy.hp;
    const casts = () =>
      w.commands.filter((c: any) => c.type === 'cast' && c.unit === leona.id && c.ability === 'q');
    w.battlefield.lineOfSight = () => false;
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
    const hiddenQueued = casts().length;
    w.battlefield.lineOfSight = () => true;
    w.setOrder(leona, { type: 'attack', target: enemy.id });
    leona.nextThink = w.tick + 1;
    w.step();
    const queued = casts().map((c: any) => ({ ...c })),
      snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield),
      control = w.constructor.fromSnapshot(snapshot, w.battlefield);
    control.commands = [];
    control.unit(leona.id).ai = false;
    for (const world of [w, copy, control]) world.step();
    const release = leona.releaseTick;
    for (const world of [w, copy, control]) world.step(release - world.tick + 3);
    v.locked = false;
    v.zoom = 0.6;
    v.recenter(leona);
    v.render(w, 1, 25.5);
    const gl = v.renderer.getContext(),
      models = [...v.leonaDaybreak.models.values()] as any[];
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
    models.forEach((m, i) => {
      m.visible = visibility[i];
    });
    v.render(w, 1, 25.5);
    g.hud.update(60);
    return {
      hiddenQueued,
      queued,
      snapshot,
      identicalFuture: copy.snapshot() === w.snapshot(),
      originalNext,
      release,
      tick: w.tick,
      hpBefore,
      hp: enemy.hp,
      controlHp: control.unit(enemy.id).hp,
      stunUntil: enemy.stunUntil,
      sunlight: enemy.sunlight,
      mana: leona.mana,
      maxMana: leona.maxMana,
      visuals: state.leonaQVisuals.length,
      impact: state.leonaQVisuals.at(-1)?.impact?.targetId,
      target: enemy.id,
      models: models.length,
      changedPixels,
      glError: gl.getError(),
    };
  });
  expect(result.hiddenQueued).toBe(0);
  expect(result.queued).toHaveLength(1);
  expect(result.identicalFuture).toBe(true);
  expect(result.release).toBeLessThan(result.originalNext);
  expect(result.hp).toBeLessThan(result.hpBefore - 40);
  expect(result.controlHp - result.hp).toBeGreaterThan(40);
  expect(result.stunUntil).toBeGreaterThan(result.tick);
  expect(result.sunlight).not.toBeNull();
  expect(result.mana).toBeLessThan(result.maxMana - 29);
  expect(result.impact).toBe(result.target);
  expect(result.models).toBeGreaterThan(0);
  expect(result.changedPixels).toBeGreaterThan(10);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('daybreak-reset.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ result, errors }, null, 2) + '\n'
  );
});
