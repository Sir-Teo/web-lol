import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(120000);
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
}
for (const seed of [26018, 719])
  test(`Rift support seed ${seed} stages safely and preserves observed, saved and restored futures`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=leona-rift');
    await ready(page);
    await page.evaluate(async (seed) => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
      const { writeMatch } = await import('/src/storage/match-store.ts');
      const w = createLaneMatch(g.world.battlefield, 'leona');
      w.random.state = seed;
      w.hero.ai = true;
      w.hero.lane = w.battlefield.lanes.findIndex((l: any) => l.name === 'bot');
      await writeMatch('development-leona-rift', w.snapshot());
    }, seed);
    await page.reload();
    await ready(page);
    const prepared = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.hud.closeModal();
      g.setPaused(true);
      const { World } = await import('/src/simulation/world.ts');
      const pure = World.fromSnapshot(w.snapshot(), w.battlefield),
        adoptions: any[] = [],
        staging: any[] = [];
      const d = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
      const original = w.setOrder.bind(w);
      w.setOrder = (u: any, order: any) => {
        if (u.id === w.hero.id && order.type === 'attack') {
          const target = w.unit(order.target);
          if (target?.kind === 'champion') {
            const inReach = d(u, target) <= w.attackRange(u) + target.radius;
            const held = Math.max(target.rootUntil, target.stunUntil) > w.tick;
            const allies = w.units
              .filter(
                (a: any) =>
                  a.id !== u.id &&
                  a.kind === 'champion' &&
                  a.team === u.team &&
                  w.alive(a) &&
                  d(a, target) <= w.attackRange(a) + target.radius &&
                  ((a.order.type === 'attack' && a.order.target === target.id) ||
                    (a.releaseTick !== null && a.attackTarget === target.id))
              )
              .map((a: any) => a.id);
            adoptions.push({ tick: w.tick, target: target.id, inReach, held, allies });
          }
        }
        if (u.id === w.hero.id && order.type === 'move')
          staging.push({ tick: w.tick, point: { ...order.point } });
        original(u, order);
      };
      for (let i = 0; i < 3600; i++) {
        w.step();
        pure.step();
      }
      const snapshot = w.snapshot(),
        sameObserver = pure.snapshot() === snapshot;
      const copy = World.fromSnapshot(snapshot, w.battlefield);
      copy.step(400);
      g.view.recenter(w.hero);
      g.view.render(w, 1, 60);
      g.hud.update(60);
      g.hud.toggleModal('pause');
      return {
        snapshot,
        future: copy.snapshot(),
        sameObserver,
        adoptions,
        staging,
        role: w.player.role,
        champion: w.hero.champion,
        battlefield: w.battlefield.id,
        hp: w.hero.hp,
        maxHp: w.hero.maxHp,
        deaths: w.player.deaths,
      };
    });
    expect(prepared.sameObserver).toBe(true);
    expect(prepared).toMatchObject({ role: 'support', champion: 'leona', battlefield: 'rift' });
    expect(prepared.staging.length).toBeGreaterThan(0);
    expect(prepared.adoptions.filter((a) => !a.inReach && !a.held && !a.allies.length)).toEqual([]);
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await page.reload();
    await ready(page);
    const restored = await page.evaluate(() => {
      const w = (window as any).__GAME__.world,
        snapshot = w.snapshot();
      w.step(400);
      return { snapshot, future: w.snapshot() };
    });
    expect(restored.snapshot).toBe(prepared.snapshot);
    expect(restored.future).toBe(prepared.future);
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.hud.closeModal();
      g.setPaused(true);
      g.view.recenter(g.world.hero);
      g.view.render(g.world, 1, 67);
      g.hud.update(60);
    });
    await page.screenshot({ path: info.outputPath('support-on-rift.png') });
    writeFileSync(
      info.outputPath('support-ai.json'),
      JSON.stringify({ seed, prepared, restored, errors }, null, 2)
    );
    expect(errors).toEqual([]);
  });

test('a real Rift moving minion contact preserves its birth pose through Save/reload', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=leona-rift');
  await ready(page);
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    for (const u of w.units.filter((u: any) => u.kind === 'champion')) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    w.step(Math.max(0, w.nextWaveTick - w.tick));
    const target = w.units.find((u: any) => u.kind === 'melee' && u.team === 'red');
    if (!target) throw Error('No authored red wave minion');
    target.ai = false;
    const origin = w.battlefield.reachable({ x: 0, y: 0 }, w.hero.radius, 'blue');
    let route: any = null;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8,
        dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const start = { x: origin.x + 100 * dir.x, y: origin.y + 100 * dir.y },
        end = { x: origin.x - 500 * dir.x, y: origin.y - 500 * dir.y };
      if (
        w.battlefield.lineWalkable(start, end, target.radius, 'red') &&
        w.battlefield.lineOfSight(origin, start)
      ) {
        route = { start, end };
        break;
      }
    }
    if (!route) throw Error('No real terrain contact route');
    Object.assign(w.hero, origin, { previous: { ...origin } });
    Object.assign(target, route.start, { previous: { ...route.start } });
    w.setOrder(target, { type: 'move', point: route.end });
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    const release = w.hero.releaseTick;
    if (release === null) throw Error('No committed melee attack');
    w.step(release - w.tick);
    const record = w.player.leonaAAVisuals.find((r: any) => r.releaseTick === release);
    if (!record?.impact) throw Error('No confirmed moving-minion contact');
    const { World } = await import('/src/simulation/world.ts');
    const snapshot = w.snapshot(),
      copy = World.fromSnapshot(snapshot, w.battlefield);
    copy.step(180);
    g.view.recenter(w.hero);
    g.view.render(w, 1, w.time);
    g.hud.update(60);
    g.hud.toggleModal('pause');
    return {
      snapshot,
      future: copy.snapshot(),
      impact: structuredClone(record.impact),
      targetId: target.id,
      terrain: w.battlefield.id,
      route,
    };
  });
  const hit = prepared.impact;
  expect(prepared.terrain).toBe('rift');
  expect(JSON.parse(prepared.snapshot).version).toBe(130);
  expect({ x: hit.contactFrame.x, y: hit.contactFrame.y }).toEqual(hit.point);
  expect({ x: hit.frames[0].x, y: hit.frames[0].y }).not.toEqual(hit.point);
  expect(hit.contactFrame.tick).toBe(hit.tick);
  expect(hit.contactFrame.animationTimeline.tick).toBeGreaterThanOrEqual(hit.tick - 1);
  expect(hit.contactFrame.animationTimeline.tick).toBeLessThanOrEqual(hit.tick);
  expect(hit.frames[0].animationTimeline.tick).toBe(hit.tick);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await page.reload();
  await ready(page);
  const restored = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      snapshot = w.snapshot();
    w.step(180);
    return { snapshot, future: w.snapshot() };
  });
  expect(restored.snapshot).toBe(prepared.snapshot);
  expect(restored.future).toBe(prepared.future);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.recenter(g.world.hero);
    g.view.render(g.world, 1, g.world.time);
    g.hud.update(60);
  });
  await page.screenshot({ path: info.outputPath('moving-contact.png') });
  writeFileSync(
    info.outputPath('moving-contact.json'),
    JSON.stringify({ prepared, restored, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});
