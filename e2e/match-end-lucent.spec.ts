import { expect, test } from '@playwright/test';

for (const armed of [false, true]) {
  test(`a melee victory cancels ${armed ? 'armed' : 'flying'} Lux E, disposes its view and exports a frozen restorable match`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const before = await page.evaluate((armed) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
      w.setOrder(w.hero, { type: 'idle' });
      const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
      const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
      target.hp = target.maxHp = 5000;
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
      w.step(armed ? 45 : 23);
      g.view.center = { x: 300, y: 0 };
      g.view.zoom = 0.55;
      g.view.render(w, 1, g.view.previousElapsed);
      const zone = w.singularities[0];
      const model = g.view.luxSingularities.models.get(zone.id);
      if (!model) throw Error('Expected an E model before victory');
      let disposed = 0;
      for (const child of model.children) {
        child.geometry.addEventListener('dispose', () => disposed++);
        child.material.addEventListener('dispose', () => disposed++);
      }
      (window as any).__LUCENT_TERMINAL__ = {
        id: zone.id,
        lux: lux.id,
        target: target.id,
        getDisposed: () => disposed,
      };
      return {
        arrived: zone.arrivalTick !== null,
        visible: model.visible,
        models: g.view.luxSingularities.models.size,
      };
    }, armed);
    expect(before).toEqual({ arrived: armed, visible: true, models: 1 });
    const result = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world,
        p = (window as any).__LUCENT_TERMINAL__;
      const target = w.unit(p.target);
      const finisher = w.spawn('melee', 'blue', { x: -200, y: -200 });
      const nexus = w.spawn('nexus', 'red', { x: -150, y: -200 });
      nexus.hp = 1;
      w.setOrder(finisher, { type: 'attack', target: nexus.id });
      finisher.releaseTick = w.tick + 1;
      finisher.attackTarget = nexus.id;
      w.enqueue({ type: 'cast', unit: p.lux, ability: 'e', point: target });
      const hp = target.hp;
      w.step();
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      const saved = w.snapshot();
      const restored = w.constructor.fromSnapshot(saved, w.battlefield);
      restored.step(600);
      return {
        saved,
        winner: w.winner,
        zones: w.singularities.length,
        models: g.view.luxSingularities.models.size,
        disposed: p.getDisposed(),
        unharmed: target.hp === hp,
        marks: target.illumination.length,
        exact: restored.snapshot() === saved,
      };
    });
    expect(result).toMatchObject({
      winner: 'blue',
      zones: 0,
      models: 0,
      disposed: 4,
      unharmed: true,
      marks: 0,
      exact: true,
    });
    await page.getByRole('heading', { name: 'Victory', exact: true }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download current match', exact: true }).click(),
    ]);
    const path = await download.path();
    expect(path).not.toBeNull();
    const { readFileSync } = await import('node:fs');
    const downloaded = readFileSync(path!, 'utf8');
    expect(downloaded).toBe(result.saved);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(result.saved);
    await page.screenshot({ path: `artifacts/match-end-lucent-${armed ? 'armed' : 'flight'}.png` });
    expect(errors).toEqual([]);
  });
}

test('an already-detonated E burst finishes and disposes after victory while the saved match stays frozen', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('dummy', 'red', { x: 600, y: 0 });
    target.hp = target.maxHp = 5000;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step(45);
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step();
    const zone = w.singularities[0];
    if (zone.detonatedTick === null) throw Error('Expected an actual E detonation');
    const finisher = w.spawn('melee', 'blue', { x: -200, y: -200 });
    const nexus = w.spawn('nexus', 'red', { x: -150, y: -200 });
    nexus.hp = 1;
    w.setOrder(finisher, { type: 'attack', target: nexus.id });
    finisher.releaseTick = w.tick + 1;
    finisher.attackTarget = nexus.id;
    w.step();
    if (!w.winner) throw Error('Expected a melee victory');
    const saved = w.snapshot();
    const hp = target.hp;
    v.center = { x: 300, y: 0 };
    v.zoom = 0.55;
    const start = v.previousElapsed;
    const sample = (world: any, age: number) => {
      v.render(world, 1, start + age);
      const model = v.luxSingularities.models.get(zone.id);
      if (!model) return null;
      const orb = model.children[0],
        ring = model.children[1];
      return {
        scale: orb.scale.x,
        opacity: orb.material.opacity,
        ring: ring.visible,
        matrix: [...orb.matrix.elements],
      };
    };
    const before = sample(w, 0);
    const model = v.luxSingularities.models.get(zone.id);
    let disposed = 0;
    for (const child of model.children) {
      child.geometry.addEventListener('dispose', () => disposed++);
      child.material.addEventListener('dispose', () => disposed++);
    }
    const later = sample(w, 0.1);
    const repeated = sample(w, 0.1);
    const expired = sample(w, 0.6);
    const models = v.luxSingularities.models.size;
    const copy = w.constructor.fromSnapshot(saved, w.battlefield);
    const replayed = sample(copy, 1);
    w.step(600);
    copy.step(600);
    return {
      before,
      later,
      repeated,
      expired,
      models,
      disposed,
      replayed,
      unchanged: w.snapshot() === saved && copy.snapshot() === saved,
      hpUnchanged: target.hp === hp,
    };
  });
  expect(result.before).not.toBeNull();
  expect(result.before!.ring).toBe(true);
  expect(result.later!.scale).toBeGreaterThan(result.before!.scale);
  expect(result.later!.opacity).toBeLessThan(result.before!.opacity);
  expect(result.repeated).toEqual(result.later);
  expect(result.expired).toBeNull();
  expect(result.models).toBe(0);
  expect(result.disposed).toBe(4);
  expect(result.replayed).toEqual(result.before);
  expect(result.unchanged).toBe(true);
  expect(result.hpUnchanged).toBe(true);
  expect(errors).toEqual([]);
});
