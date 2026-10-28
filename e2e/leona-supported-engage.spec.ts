import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Leona supports an allied attack on an unheld moving target through a real midflight save and source landing', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120000 });
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture&npc=leona', { waitUntil: 'domcontentloaded' });
  await ready();
  const cast = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const { assignRole } = await import('/src/simulation/bot-jungle.ts');
    g.hud.closeModal();
    g.setPaused(true);
    const leona = w.units.find((u: any) => u.champion === 'leona'),
      state = w.championState(leona.id);
    w.units = [w.hero, leona];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    assignRole(state, 'support');
    assignRole(w.player, 'carry');
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    const place = (u: any, x: number, y: number) => Object.assign(u, { x, y, previous: { x, y } });
    place(leona, 0, 0);
    place(w.hero, 300, 0);
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const target = w.spawn('champion', 'red', { x: 650, y: 0 }, 'ashe');
    target.ai = false;
    const other = w.spawn('champion', 'red', { x: 650, y: 350 }, 'lux');
    other.ai = false;
    const queued = () =>
      w.commands.filter((c: any) => c.type === 'cast' && c.unit === leona.id && c.ability === 'e');
    const think = () => {
      leona.ai = true;
      leona.nextThink = w.tick + 1;
      w.step();
    };
    think();
    const idleQueued = queued().length;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    const sight = w.battlefield.lineOfSight;
    w.battlefield.lineOfSight = () => false;
    think();
    const hiddenQueued = queued().length;
    w.battlefield.lineOfSight = sight;
    place(leona, 0, 0);
    place(w.hero, 300, 0);
    place(target, 650, 0);
    w.setOrder(leona, { type: 'idle' });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.setOrder(target, { type: 'move', point: { x: 550, y: 0 } });
    think();
    const commands = structuredClone(queued()),
      unheld = target.rootUntil <= w.tick && target.stunUntil <= w.tick;
    const manaBefore = leona.mana;
    w.step();
    const paidMana = leona.mana;
    w.step(19);
    v.locked = false;
    v.zoom = 0.6;
    v.recenter({ x: 300, y: 0 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      idleQueued,
      hiddenQueued,
      commands,
      unheld,
      manaBefore,
      paidMana,
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      leonaId: leona.id,
      targetId: target.id,
      targetHp: target.hp,
      missile: w.projectiles.some((p: any) => p.type === 'zenith' && p.source === leona.id),
      surfaces: v.leonaZenithSurfaces.models.size,
      humanManual: !w.hero.ai,
      glError: v.renderer.getContext().getError(),
    };
  });
  expect(cast.idleQueued).toBe(0);
  expect(cast.hiddenQueued).toBe(0);
  expect(cast.commands).toEqual([
    { type: 'cast', unit: cast.leonaId, ability: 'e', point: { x: 650, y: 0 } },
  ]);
  expect(cast.unheld).toBe(true);
  expect(cast.manaBefore - cast.paidMana).toBeGreaterThan(39);
  expect(cast.missile).toBe(true);
  expect(cast.surfaces).toBeGreaterThan(0);
  expect(cast.humanManual).toBe(true);
  expect(cast.glError).toBe(0);
  await page.screenshot({ path: info.outputPath('supported-zenith-flight.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  const landing = await page.evaluate(({ leonaId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      saved = w.snapshot();
    g.hud.closeModal();
    g.setPaused(true);
    let root = false,
      sunlight = false;
    for (let i = 0; i < 40; i++) {
      w.step();
      root ||= w.unit(targetId).rootUntil > w.tick;
      sunlight ||= w.unit(targetId).sunlight?.sourceId === leonaId;
    }
    const leona = w.unit(leonaId),
      state = w.championState(leonaId);
    v.locked = false;
    v.zoom = 0.6;
    v.recenter({ x: 300, y: 0 });
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    return {
      saved,
      paused: g.hud.paused,
      root,
      sunlight,
      visual: structuredClone(state.leonaEVisuals.at(-1)),
      surfaces: v.leonaZenithSurfaces.models.size,
      glError: v.renderer.getContext().getError(),
      humanManual: !w.hero.ai,
    };
  }, cast);
  expect(landing.saved).toBe(cast.saved);
  expect(landing.paused).toBe(true);
  expect(landing.root).toBe(true);
  expect(landing.sunlight).toBe(true);
  expect(landing.surfaces).toBeGreaterThan(0);
  expect(landing.glError).toBe(0);
  expect(landing.humanManual).toBe(true);
  await page.screenshot({ path: info.outputPath('supported-zenith-landing.png') });
  const final = await page.evaluate(({ leonaId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(140);
    const state = w.championState(leonaId);
    return {
      future: w.snapshot(),
      hp: w.unit(targetId).hp,
      arrived: state.leonaEVisuals.some((v: any) => v.dash?.endReason === 'arrived'),
      q: w.events.some((e: any) => e.type === 'cast' && e.unit === leonaId && e.text === 'q'),
    };
  }, cast);
  writeFileSync(
    info.outputPath('supported-engage.json'),
    JSON.stringify({ cast, landing, final, errors }, null, 2)
  );
  expect(final.future).toBe(cast.future);
  expect(final.hp).toBeLessThan(cast.targetHp);
  expect(final.arrived).toBe(true);
  expect(final.q).toBe(true);
  expect(errors).toEqual([]);
});
