import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function openMatch(page: Page, role: 'mid' | 'support') {
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready(page);
  return page.evaluate((role) => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units)
      if (u.kind === 'champion') {
        u.ai = false;
        w.setOrder(u, { type: 'idle' });
      }
    const actor = w.units.find(
      (u: any) => u.kind === 'champion' && u.team === 'blue' && w.championState(u.id).role === role
    );
    actor.ai = true;
    actor.nextThink = w.tick + 1;
    w.gainExperience(700, actor.id);
    w.championState(actor.id).trinket.charges = 0;
    (window as any).__WAVE_ACTOR__ = actor.id;
    return actor.id as number;
  }, role);
}
test('the real mid bot casts and recasts E on a visible wave, saves the queued aim and earns normal rewards', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const actor = await openMatch(page, 'mid');
  const before = await page.evaluate((actor) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(actor),
      s = w.championState(actor);
    const p = w.battlefield.reachable({ x: 0, y: 0 }, u.radius, 'blue');
    Object.assign(u, p, { previous: { ...p } });
    w.setOrder(u, { type: 'idle' });
    const home = w.battlefield.spawns.red;
    const length = Math.hypot(home.x - p.x, home.y - p.y);
    const dx = (home.x - p.x) / length,
      dy = (home.y - p.y) / length;
    const wave = [700, 800, 900].map((d) => {
      const m = w.spawn(
        'caster',
        'red',
        w.battlefield.reachable({ x: p.x + dx * d, y: p.y + dy * d }, 35, 'red')
      );
      m.hp = 40;
      return m;
    });
    if (!wave.every((m) => w.visible(m, 'blue')))
      throw Error('The intended wave must be genuinely visible');
    const mana = u.mana,
      gold = s.gold;
    w.step();
    const queued = w.commands.find(
      (c: any) => c.type === 'cast' && c.unit === actor && c.ability === 'e'
    );
    return {
      actor,
      ids: wave.map((m) => m.id),
      queued,
      mana,
      gold,
      humanOrder: structuredClone(w.hero.order),
    };
  }, actor);
  expect(before.queued?.ability).toBe('e');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[data-action="resume"]')!.click();
    (window as any).__GAME__.setPaused(true);
  });
  const armed = await page.evaluate((actor) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(actor);
    for (
      let t = 0;
      t < 180 && !w.singularities.some((z: any) => z.sourceId === actor && z.arrivalTick !== null);
      t++
    )
      w.step();
    const zone = w.singularities.find((z: any) => z.sourceId === actor);
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      arrived: !!zone && zone.arrivalTick !== null,
      damage: zone?.damage,
      visible: zone ? g.view.luxSingularities.models.get(zone.id)?.visible : false,
    };
  }, actor);
  expect(armed.arrived).toBe(true);
  expect(armed.visible).toBe(true);
  expect(armed.damage).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/lux-wave-zone.png' });
  const after = await page.evaluate((before) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(before.actor),
      s = w.championState(before.actor);
    let recast = false;
    for (let t = 0; t < 180 && before.ids.some((id) => w.unit(id) && w.alive(w.unit(id))); t++) {
      w.step();
      if (
        w.singularities.some((z: any) => z.sourceId === u.id && z.arrivalTick !== null) &&
        w.commands.some((c: any) => c.type === 'cast' && c.unit === u.id && c.ability === 'e')
      )
        recast = true;
    }
    return {
      dead: before.ids.every((id) => !w.unit(id) || !w.alive(w.unit(id))),
      cs: s.cs,
      gold: s.gold,
      mana: u.mana,
      cooldown: w.abilityCooldownTicks('e', u.id),
      recast,
      humanOrder: w.hero.order,
      humanAi: w.hero.ai,
    };
  }, before);
  expect(after.dead).toBe(true);
  expect(after.cs).toBe(3);
  expect(after.gold).toBeGreaterThan(before.gold);
  expect(after.mana).toBeLessThan(before.mana);
  expect(after.cooldown).toBeGreaterThan(0);
  expect(after.recast).toBe(true);
  expect(after.humanOrder).toEqual(before.humanOrder);
  expect(after.humanAi).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/lux-wave-clear.json',
    JSON.stringify({ before, armed, after, restoredExactly: true }, null, 2) + '\n'
  );
});
test('the real support leaves ordinary nearby carry farm, then uses E against observed pressure at its own base', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const actor = await openMatch(page, 'support');
  const result = await page.evaluate((actor) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(actor);
    const move = (unit: any, point: any) => {
      const p = w.battlefield.reachable(point, unit.radius, unit.team);
      Object.assign(unit, p, { previous: { ...p } });
      w.setOrder(unit, { type: 'idle' });
    };
    move(u, { x: 0, y: 0 });
    move(w.hero, { x: 100, y: 0 });
    const red = w.battlefield.spawns.red,
      d = Math.hypot(red.x - u.x, red.y - u.y),
      dx = (red.x - u.x) / d,
      dy = (red.y - u.y) / d;
    const wave = [700, 800, 900].map((r) => {
      const m = w.spawn(
        'caster',
        'red',
        w.battlefield.reachable({ x: u.x + dx * r, y: u.y + dy * r }, 35, 'red')
      );
      m.hp = 40;
      return m;
    });
    if (!wave.every((m) => w.visible(m, 'blue'))) throw Error('Expected a visible ordinary wave');
    let ordinaryCast = false;
    for (let t = 0; t < 30; t++) {
      w.step();
      if (w.commands.some((c: any) => c.type === 'cast' && c.unit === actor && c.ability === 'e'))
        ordinaryCast = true;
    }
    const ordinaryCs = w.championState(actor).cs;
    const nexus = w.units.find((s: any) => s.team === 'blue' && s.kind === 'nexus');
    const away = w.battlefield.spawns.red,
      length = Math.hypot(away.x - nexus.x, away.y - nexus.y),
      vx = (away.x - nexus.x) / length,
      vy = (away.y - nexus.y) / length;
    move(u, { x: nexus.x + vx * 800, y: nexus.y + vy * 800 });
    move(w.hero, { x: u.x + 100, y: u.y });
    for (const [i, m] of wave.entries())
      move(m, { x: nexus.x + vx * (300 + i * 80), y: nexus.y + vy * (300 + i * 80) });
    for (const tower of w.units.filter((s: any) => s.team === 'blue' && s.kind === 'turret'))
      tower.stunUntil = w.tick + 100000;
    if (!wave.every((m) => w.visible(m, 'blue'))) throw Error('Expected visible base pressure');
    u.nextThink = w.tick + 1;
    w.step();
    const emergency = w.commands.find(
      (c: any) => c.type === 'cast' && c.unit === actor && c.ability === 'e'
    );
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      ordinaryCast,
      ordinaryCs,
      emergency,
      humanAi: w.hero.ai,
      carryDistance: Math.hypot(w.hero.x - u.x, w.hero.y - u.y),
    };
  }, actor);
  expect(result.ordinaryCast).toBe(false);
  expect(result.ordinaryCs).toBe(0);
  expect(result.emergency?.ability).toBe('e');
  expect(result.carryDistance).toBeLessThan(1400);
  expect(result.humanAi).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync('artifacts/lux-wave-support.json', JSON.stringify(result, null, 2) + '\n');
});
