import { expect, test } from '@playwright/test';

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
