import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
const unboundIndices = JSON.parse(readFileSync('src/content/ahri-r-particles.json', 'utf8'))
  .profiles.map((p: any, index: number) => ({ p, index }))
  .filter(
    ({ p }: any) =>
      p.system === 'Ahri_R_mis_02' &&
      p.bind.constant[0] === 0 &&
      p.bind.values.every((v: number[]) => v[0] === 0)
  )
  .map(({ index }: any) => index);

test('a genuine brush-hidden R flight reveals its bound spell core without replaying unseen births', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriRParticles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate((unbound: number[]) => {
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
    w.gainExperience(1e6, enemy.id);
    w.learnSpell('r', enemy.id);
    w.enqueue({ type: 'cast', unit: enemy.id, ability: 'r', point: { x: -350, y: -50 } });
    w.step(3);
    v.zoom = 0.65;
    v.recenter({ x: -580, y: -50 });
    v.render(w, 1, v.previousElapsed);
    const record = w.ahriRVisuals[0],
      bolt = record.bursts[0].bolts[0];
    if (!bolt) throw Error('Brush-hidden R did not acquire the visible target');
    const hidden = {
      insideBrush: w.battlefield.inBrush(enemy),
      heroOutside: !w.battlefield.inBrush(w.hero),
      birthKnown: record.birthPose.audience.includes('blue'),
      surfaces: v.ahriRParticles.surfaces.models.size,
      ribbons: v.ahriRParticles.models.size,
    };
    let entered = false;
    while (w.tick < record.startTick + 60 && !bolt.end) {
      w.step();
      const frame = bolt.frames.at(-1);
      if (frame && w.pointVisible(frame.point, 'blue')) {
        entered = true;
        break;
      }
    }
    w.step(2);
    v.render(w, 1, v.previousElapsed);
    const cutoff = bolt.frames.find((frame: any) => frame.audience.includes('blue'))?.tick;
    const olderUnbound = [...v.ahriRParticles.surfaces.models.values()].filter(
      (m: any) => unbound.includes(m.userData.profileIndex) && m.userData.bornTick < cutoff
    );
    return {
      hidden,
      visible: {
        entered,
        surfaces: v.ahriRParticles.surfaces.models.size,
        ribbons: v.ahriRParticles.models.size,
        unseen: bolt.frames.filter((f: any) => !f.audience.includes('blue')).length,
        seen: bolt.frames.filter((f: any) => f.audience.includes('blue')).length,
        visiblePoints: [...v.ahriRParticles.models.values()].map(
          (m: any) => m.userData.visiblePoints
        ),
        cutoff,
        olderSurfaceCount: olderUnbound.length,
      },
    };
  }, unboundIndices);
  expect(result.hidden).toEqual({
    insideBrush: true,
    heroOutside: true,
    birthKnown: false,
    surfaces: 0,
    ribbons: 0,
  });
  expect(result.visible.entered).toBe(true);
  expect(result.visible.olderSurfaceCount).toBe(0);
  expect(result.visible.surfaces).toBeGreaterThan(0);
  expect(result.visible.ribbons).toBeGreaterThan(0);
  expect(result.visible.unseen).toBeGreaterThan(0);
  expect(result.visible.seen).toBeGreaterThan(0);
  expect(result.visible.visiblePoints.every((n: number) => n >= 2)).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('ahri-r-hidden-entry.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});

test('committed R survives actual Flash and caster death and retires at victory without World steps', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&champion=ahri');
  await page.waitForFunction(() => (window as any).__GAME__?.view.ahriRParticles.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.projectiles = [];
    w.pendingSpawns = [];
    w.nextWaveTick = 1e9;
    w.setOrder(w.hero, { type: 'idle' });
    w.hero.ai = false;
    const origin = [
      { x: 0, y: 1000 },
      { x: 300, y: -225 },
      { x: 0, y: 0 },
      { x: -300, y: -500 },
    ].find((p) => w.battlefield.lineWalkable(p, { x: p.x + 550, y: p.y }, w.hero.radius));
    if (!origin) throw Error('No walkable native practice corridor for R and Flash');
    Object.assign(w.hero, { ...origin, previous: { ...origin } });
    const target = w.spawn('champion', 'red', { x: origin.x + 550, y: origin.y }, 'lux');
    Object.assign(target, { ai: false, hp: 10000, maxHp: 10000 });
    w.gainExperience(1e6);
    w.learnSpell('r');
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'r',
      point: { x: origin.x + 900, y: origin.y },
    });
    w.step(6);
    v.render(w, 1, v.previousElapsed);
    const record = w.ahriRVisuals[0],
      saved = w.snapshot();
    const before = {
      active: record.bursts[0].bolts.some((b: any) => !b.end),
      draws: v.ahriRParticles.surfaces.models.size + v.ahriRParticles.models.size,
    };
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: w.summonerSlot('flash'),
      point: { x: origin.x - 300, y: origin.y },
    });
    w.step();
    const flashed = w.hero.x - origin.x,
      dashEnd = record.bursts[0].dashEnd.reason;
    w.damage(target, w.hero, 1e6, 'true');
    while (!record.bursts[0].bolts[0].end && w.tick < record.startTick + 100) w.step();
    v.render(w, 1, v.previousElapsed);
    const dead = {
      hp: w.hero.hp,
      windowEnd: record.end.reason,
      boltEnd: record.bursts[0].bolts[0].end.reason,
    };
    w.step(400);
    v.render(w, 1, v.previousElapsed);
    const drained = {
      surfaces: v.ahriRParticles.surfaces.models.size,
      ribbons: v.ahriRParticles.models.size,
    };
    const terminal = w.constructor.fromSnapshot(saved, w.battlefield),
      nexus = terminal.spawn('nexus', 'red', { x: 1500, y: 1500 });
    terminal.damage(terminal.hero, nexus, 1e6, 'true');
    const snapshot = terminal.snapshot();
    v.render(terminal, 1, v.previousElapsed);
    v.ahriRParticles.update(terminal, 1, v.camera, 13);
    return {
      before,
      flashed,
      dashEnd,
      dead,
      drained,
      terminal: {
        winner: terminal.winner,
        unchanged: terminal.snapshot() === snapshot,
        surfaces: v.ahriRParticles.surfaces.models.size,
        ribbons: v.ahriRParticles.models.size,
      },
    };
  });
  expect(result.before.active).toBe(true);
  expect(result.before.draws).toBeGreaterThan(0);
  expect(result.flashed).toBeCloseTo(-280, 8);
  expect(result.dashEnd).toBe('flash');
  expect(result.dead).toEqual({ hp: 0, windowEnd: 'death', boltEnd: 'hit' });
  expect(result.drained).toEqual({ surfaces: 0, ribbons: 0 });
  expect(result.terminal).toEqual({ winner: 'blue', unchanged: true, surfaces: 0, ribbons: 0 });
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('ahri-r-flash-death-terminal.json'),
    JSON.stringify({ result, errors }, null, 2)
  );
});
