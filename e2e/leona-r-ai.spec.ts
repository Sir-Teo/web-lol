import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Leona follows an observed held group through paid saved Solar Flare and source impact', async ({
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
  const result = await page.evaluate(async () => {
    const modulePath = '/src/render/particle-color-phase.ts';
    const { renderParticleColorPhase } = await import(modulePath);
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
    Object.assign(leona, { x: 0, y: 0, previous: { x: 0, y: 0 }, speed: 335, ai: false });
    // This encounter isolates decisions and source draws from map navigation.
    w.battlefield.inBrush = () => false;
    w.battlefield.lineOfSight = () => true;
    w.battlefield.lineWalkable = () => true;
    w.battlefield.reachable = (p: any) => ({ ...p });
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const center = w.spawn('champion', 'red', { x: 600, y: 0 }, 'lux'),
      outer = w.spawn('champion', 'red', { x: 600, y: 250 }, 'lux');
    for (const target of [center, outer]) {
      target.ai = false;
      target.damage = target.magicResist = 0;
      w.applyRoot(target, 120);
    }
    const casts = () =>
      w.commands.filter((c: any) => c.type === 'cast' && c.unit === leona.id && c.ability === 'r');
    w.battlefield.lineOfSight = () => false;
    leona.ai = true;
    leona.nextThink = w.tick + 1;
    w.step();
    const hiddenQueued = casts().length;
    Object.assign(leona, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(leona, { type: 'move', point: { x: 0, y: 1000 } });
    w.battlefield.lineOfSight = () => true;
    leona.nextThink = w.tick + 1;
    w.step();
    const queued = casts().map((c: any) => ({ ...c })),
      launchPosition = { x: leona.x, y: leona.y },
      snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield),
      control = w.constructor.fromSnapshot(snapshot, w.battlefield),
      manaBefore = leona.mana;
    control.commands = [];
    control.unit(leona.id).ai = false;
    v.locked = false;
    v.zoom = 0.6;
    v.recenter({ x: 400, y: 100 });
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
      renderParticleColorPhase(v.renderer, v.scene, v.camera, v.particleEarlyDistortion);
      v.particleDistortion.render(v.renderer, v.camera);
      return read();
    };
    let paidMana = manaBefore,
      origin: any = null;
    for (let i = 0; i < 50; i++) {
      w.step();
      copy.step();
      control.step();
      if (i === 0) {
        paidMana = leona.mana;
        origin = state.leonaR?.origin;
      }
      v.render(w, 1, 25.5);
      if ([8, 20, 39, 46].includes(i)) {
        const models = [...v.leonaSolarSurfaces.models.values()] as any[],
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
    const visual = state.leonaRVisuals.at(-1);
    return {
      hiddenQueued,
      queued,
      launchPosition,
      origin,
      snapshot,
      identicalFuture: copy.snapshot() === w.snapshot(),
      manaBefore,
      paidMana,
      hp: [center.hp, outer.hp],
      controlHp: [control.unit(center.id).hp, control.unit(outer.id).hp],
      targets: [center.id, outer.id],
      centerStun: center.stunUntil,
      outerStun: outer.stunUntil,
      outerSlows: outer.slows,
      sunlight: [center.sunlight, outer.sunlight],
      tick: w.tick,
      contacts: visual?.impact?.contacts.map((c: any) => ({
        targetId: c.targetId,
        center: c.center,
      })),
      phases,
      glError: gl.getError(),
    };
  });
  expect(result.hiddenQueued).toBe(0);
  expect(result.queued).toHaveLength(1);
  expect(result.queued[0].point).toEqual({ x: 600, y: 0 });
  expect(result.launchPosition).toEqual({ x: 0, y: 0 });
  expect(result.origin).toEqual(result.launchPosition);
  expect(result.identicalFuture).toBe(true);
  expect(result.manaBefore - result.paidMana).toBeGreaterThan(99);
  for (let i = 0; i < 2; i++) expect(result.controlHp[i] - result.hp[i]).toBeGreaterThan(149);
  expect(result.centerStun).toBeGreaterThan(result.tick);
  expect(result.outerStun).toBe(0);
  expect(result.outerSlows.some((s: any) => s.kind === 'solar-flare')).toBe(true);
  expect(result.sunlight.every((s: any) => s?.sourceId === result.queued[0].unit)).toBe(true);
  expect(result.contacts).toEqual(
    result.targets.map((targetId: number, i: number) => ({ targetId, center: i === 0 }))
  );
  expect(result.phases.some((p) => p.changedPixels > 10)).toBe(true);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('solar-followup.png') });
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify({ result, errors }, null, 2) + '\n'
  );
});
