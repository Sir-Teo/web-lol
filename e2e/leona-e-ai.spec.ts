import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Leona follows a visible isolated catch through a paid saved Zenith and source landing', async ({
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
    // Controlled catch fixture; terrain rejection is separately exercised by unit tests.
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    w.battlefield.lineWalkable = () => true;
    w.battlefield.reachable = (p: any) => ({ x: p.x, y: p.y });
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const enemy = w.spawn('champion', 'red', { x: 600, y: 0 }, 'lux');
    enemy.ai = false;
    enemy.magicResist = 0;
    w.applyRoot(enemy, 120);
    const casts = () =>
      w.commands.filter((c: any) => c.type === 'cast' && c.unit === leona.id && c.ability === 'e');
    w.battlefield.lineOfSight = () => false;
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
    const hiddenQueued = casts().length;
    w.battlefield.lineOfSight = () => true;
    leona.nextThink = w.tick + 1;
    w.step();
    const queued = casts().map((c: any) => ({ ...c })),
      snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield),
      control = w.constructor.fromSnapshot(snapshot, w.battlefield),
      manaBefore = leona.mana;
    control.commands = [];
    control.unit(leona.id).ai = false;
    v.locked = false;
    v.zoom = 0.6;
    v.recenter({ x: 300, y: 0 });
    const gl = v.renderer.getContext(),
      phases: any[] = [];
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
    let paidMana = manaBefore;
    for (let i = 0; i < 70; i++) {
      w.step();
      copy.step();
      control.step();
      if (i === 0) paidMana = leona.mana;
      v.render(w, 1, 25.5);
      if ([8, 30, 50, 65].includes(i)) {
        const models = [...v.leonaZenithSurfaces.models.values()] as any[],
          all = draw(),
          visibility = models.map((m) => m.visible);
        for (const m of models) m.visible = false;
        const hidden = draw();
        let changedPixels = 0;
        for (let j = 0; j < all.length; j += 4)
          if (all[j] !== hidden[j] || all[j + 1] !== hidden[j + 1] || all[j + 2] !== hidden[j + 2])
            changedPixels++;
        models.forEach((m, j) => {
          m.visible = visibility[j];
        });
        phases.push({ step: i + 1, models: models.length, changedPixels });
      }
    }
    v.render(w, 1, 25.5);
    g.hud.update(60);
    const visual = state.leonaEVisuals.at(-1);
    return {
      hiddenQueued,
      queued,
      snapshot,
      identicalFuture: copy.snapshot() === w.snapshot(),
      manaBefore,
      paidMana,
      mana: leona.mana,
      hp: enemy.hp,
      controlHp: control.unit(enemy.id).hp,
      distance: Math.hypot(leona.x - enemy.x, leona.y - enemy.y),
      contactRadius: leona.radius + enemy.radius,
      contacts: visual?.flight?.contacts.map((c: any) => c.targetId),
      dashTarget: visual?.dash?.targetId,
      dashEnd: visual?.dash?.endReason,
      arrival: visual?.arrival?.tick,
      target: enemy.id,
      sunlight: enemy.sunlight,
      phases,
      glError: gl.getError(),
    };
  });
  expect(result.hiddenQueued).toBe(0);
  expect(result.queued).toHaveLength(1);
  expect(result.queued[0].point).toEqual({ x: 600, y: 0 });
  expect(result.identicalFuture).toBe(true);
  expect(result.manaBefore - result.paidMana).toBeGreaterThan(39);
  expect(result.controlHp - result.hp).toBeGreaterThan(49);
  expect(result.distance).toBeCloseTo(result.contactRadius, 6);
  expect(result.contacts).toContain(result.target);
  expect(result.dashTarget).toBe(result.target);
  expect(result.dashEnd).toBe('arrived');
  expect(result.arrival).toBeGreaterThan(0);
  expect(result.sunlight).not.toBeNull();
  expect(result.phases.some((p) => p.changedPixels > 10)).toBe(true);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('zenith-followup.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ result, errors }, null, 2) + '\n'
  );
});
