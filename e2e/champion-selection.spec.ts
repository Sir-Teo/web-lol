import { expect, test } from '@playwright/test';

test('stationary cursor follows moving targets and clears after hidden state, death and pointer exit', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    Object.assign(w.hero, { x: -500, y: 0, previous: { x: -500, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
    v.locked = false;
    v.center = { x: 0, y: 0 };
    v.render(w, 1, 0);
    return { id: enemy.id, pointer: v.screenPoint({ x: 0, y: 0 }, 0.775) };
  });
  const canvas = page.locator('#battlefield');
  await page.mouse.move(setup.pointer.x, setup.pointer.y);
  await expect(canvas).not.toHaveClass(/enemy-hover/);
  await page.evaluate((id) => {
    const u = (window as any).__GAME__.world.unit(id);
    u.x = 0;
    u.previous = { x: 0, y: 0 };
  }, setup.id);
  await expect(canvas).toHaveClass(/enemy-hover/);
  await page.evaluate(() => {
    (window as any).__GAME__.world.battlefield.lineOfSight = () => false;
  });
  await expect(canvas).not.toHaveClass(/enemy-hover/);
  await page.evaluate(() => {
    (window as any).__GAME__.world.battlefield.lineOfSight = () => true;
  });
  await expect(canvas).toHaveClass(/enemy-hover/);
  await page.evaluate((id) => {
    (window as any).__GAME__.world.unit(id).hp = 0;
  }, setup.id);
  await expect(canvas).not.toHaveClass(/enemy-hover/);
  await page.evaluate((id) => {
    const u = (window as any).__GAME__.world.unit(id);
    u.hp = u.maxHp;
  }, setup.id);
  await expect(canvas).toHaveClass(/enemy-hover/);
  await page.locator('#shop-button').hover();
  await expect(canvas).not.toHaveClass(/enemy-hover/);
  expect(await page.evaluate(() => (window as any).__GAME__.view.hovered)).toBeNull();
});

test('overlapping champions are ranked by their rendered positions throughout movement', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: -500, y: 0, previous: { x: -500, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    const moving = w.spawn('champion', 'red', { x: 325 / 60, y: 0 });
    moving.previous = { x: 0, y: 0 };
    const stationary = w.spawn('champion', 'red', { x: 3, y: 0 });
    v.locked = false;
    v.center = { x: 0, y: 0 };
    const picks = [];
    for (const reversed of [false, true]) {
      if (reversed) w.units.reverse();
      for (const alpha of [0, 0.5, 1]) {
        v.render(w, alpha, performance.now() / 1000);
        const point = v.screenPoint({ x: moving.x * alpha, y: 0 }, 0.775);
        picks.push({ reversed, alpha, picked: v.pick(w, point.x, point.y)?.id });
      }
    }
    return { expected: moving.id, other: stationary.id, picks };
  });
  for (const pick of result.picks) expect(pick.picked, JSON.stringify(pick)).toBe(result.expected);
});

test('champion picking follows source dimensions across zoom and excludes hidden or dead units', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.setOrder(w.hero, { type: 'idle' });
    const mid = w.battlefield.lanes.find((lane: any) => lane.name === 'mid');
    Object.assign(w.hero, mid.points[6], { previous: { ...mid.points[6] } });
    const enemy = w.spawn('champion', 'red', mid.points[7]);
    w.battlefield.lineOfSight = () => true;
    v.locked = false;
    v.center = { x: enemy.x, y: enemy.y };
    const observations = [];
    let hover: any;
    for (const zoom of [1.35, 1, 0.7]) {
      v.zoom = zoom;
      v.render(w, 1, performance.now() / 1000);
      const point = (offset: number) => {
        const p = { x: enemy.x + offset, y: enemy.y };
        return v.screenPoint(p, v.ground(enemy) - v.ground(p) + 0.775);
      };
      const inside = point(100),
        outside = point(150);
      const oldCenter = v.screenPoint(enemy, 0.65);
      observations.push({
        zoom,
        inside: v.pick(w, inside.x, inside.y)?.id,
        outside: v.pick(w, outside.x, outside.y)?.id,
        oldPickerRejectsInside: Math.hypot(inside.x - oldCenter.x, inside.y - oldCenter.y) >= 26,
      });
      hover = inside;
    }
    enemy.hp = 0;
    const dead = v.pick(w, hover.x, hover.y)?.id;
    enemy.hp = enemy.maxHp;
    w.battlefield.lineOfSight = () => false;
    const hidden = v.pick(w, hover.x, hover.y)?.id;
    w.battlefield.lineOfSight = () => true;
    return { id: enemy.id, observations, dead, hidden, hover };
  });
  for (const observation of result.observations) {
    expect(observation.inside, `inside at zoom ${observation.zoom}`).toBe(result.id);
    expect(observation.outside, `outside at zoom ${observation.zoom}`).not.toBe(result.id);
  }
  expect(result.dead).not.toBe(result.id);
  expect(result.observations.some((entry) => entry.oldPickerRejectsInside)).toBe(true);
  expect(result.hidden).not.toBe(result.id);
  await page.mouse.move(result.hover.x, result.hover.y);
  await expect(page.locator('#battlefield')).toHaveClass(/enemy-hover/);
  await page.screenshot({ path: 'artifacts/champion-selection-hover.png' });
  expect(errors).toEqual([]);
});
