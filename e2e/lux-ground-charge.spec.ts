import { expect, test } from '@playwright/test';
for (const reason of ['victory', 'death'])
  test(`ground charge layers retire on ${reason}`, async ({ page }) => {
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    const result = await page.evaluate((reason) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.units = [w.hero];
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux'),
        target = w.spawn('nexus', 'red', { x: 1000, y: 500 }),
        gate = w.spawn('inhibitor', 'red', { x: 1500, y: 500 });
      w.damage(w.hero, gate, 1e6, 'true');
      w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
      w.step(30);
      v.render(w, 1, v.previousElapsed);
      const before = v.luxGroundCharge.models.size;
      if (reason === 'victory') w.damage(w.hero, target, 1e6, 'true');
      else w.damage(target, lux, 1e6, 'true');
      v.render(w, 1, v.previousElapsed);
      const after = v.luxGroundCharge.models.size;
      v.render(w, 1, v.previousElapsed + 1);
      return { before, after, later: v.luxGroundCharge.models.size, released: w.luxBeams.length };
    }, reason);
    expect(result).toEqual({ before: 14, after: 0, later: 0, released: 0 });
  });

test('ground charge follows slope and source transforms, reconstructs phases and reuses grids', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js'),
      { luxGroundChargeParticles } = await import('/src/render/lux-ground-charge-particles.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const originalHeight = w.battlefield.heightAt;
    w.battlefield.heightAt = (p: any) => p.x * 0.03 + p.y * 0.02;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 2300, y: -1725 } });
    w.step(30);
    v.center = { x: 1200, y: -900 };
    const sample = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      return [...v.luxGroundCharge.models.values()].map((m: any) => ({
        name: m.name,
        position: Array.from(m.geometry.getAttribute('position').array),
        indices: Array.from(m.geometry.index.array).slice(0, m.geometry.drawRange.count),
        uv: Array.from(m.geometry.getAttribute('uv').array),
        tint: m.material.uniforms.tint.value.toArray(),
        offset: m.material.uniforms.offset.value.toArray(),
        pass: m.renderOrder,
        transparent: m.material.transparent,
        depth: m.material.depthTest,
      }));
    };
    const first = sample(w),
      repeat = sample(w),
      saved = sample(w.constructor.fromSnapshot(w.snapshot(), w.battlefield));
    const cast = w.championState(lux.id).pendingCast,
      particles = luxGroundChargeParticles(
        lux.id ^ Math.imul(cast.startTick, 0x9e3779b9),
        (w.tick - cast.startTick) / 60
      );
    const errors = particles.map((p: any, i: number) => {
      const a = new T.Vector3(-p.halfSize[0], -p.halfSize[1], 0).applyEuler(
        new T.Euler(...p.rotation.map((v: number) => (v * Math.PI) / 180), 'YXZ')
      );
      const x = 0.6 * (p.offset[0] + a.x) + 0.8 * (p.offset[2] + a.z),
        y = 0.8 * (p.offset[0] + a.x) - 0.6 * (p.offset[2] + a.z);
      return [
        Math.abs(first[i].position[0] - x * 0.01),
        Math.abs(first[i].position[2] - y * 0.01),
        ...first[i].tint.map((v: number, j: number) => Math.abs(v - p.color[j])),
        ...first[i].offset.map((v: number, j: number) => Math.abs(v - p.multOffset[j])),
      ];
    });
    const heightError = Math.max(
      ...first.flatMap((m) =>
        m.position
          .filter((_: any, i: number) => i % 3 === 1)
          .map((y: any, i: number) =>
            Math.abs(y - (m.position[i * 3] * 3 + m.position[i * 3 + 2] * 2 + 2) * 0.01)
          )
      )
    );
    const buffers = [...v.luxGroundCharge.models.values()].map((m: any) => [
      m.geometry.getAttribute('position'),
      m.geometry.index,
    ]);
    w.step(12);
    const later = sample(w);
    const reused = [...v.luxGroundCharge.models.values()].every(
      (m: any, i: number) =>
        m.geometry.getAttribute('position') === buffers[i][0] && m.geometry.index === buffers[i][1]
    );
    const visible = w.pointVisible;
    lux.team = 'red';
    w.pointVisible = (p: any) => p.x > 1000;
    sample(w);
    const partial = [...v.luxGroundCharge.models.values()].reduce(
      (s: number, m: any) => s + m.geometry.drawRange.count,
      0
    );
    w.pointVisible = () => false;
    v.luxGroundCharge.update(w, 1);
    const hidden = v.luxGroundCharge.models.size;
    lux.team = 'blue';
    w.pointVisible = visible;
    const restored = sample(w);
    w.battlefield.heightAt = originalHeight;
    v.render(w, 1, v.previousElapsed);
    return { first, repeat, saved, errors, heightError, reused, later, restored, hidden, partial };
  });
  expect(result.first).toHaveLength(14);
  expect(new Set(result.first.map((p) => p.name)).size).toBe(13);
  expect(result.repeat).toEqual(result.first);
  expect(result.saved).toEqual(result.first);
  expect(result.restored).toEqual(result.later);
  expect(result.errors.flat().every((v) => v < 1e-5)).toBe(true);
  expect(result.heightError).toBeLessThan(1e-5);
  expect(result.reused).toBe(true);
  expect(result.hidden).toBe(0);
  expect(result.partial).toBeGreaterThan(0);
  expect(result.partial).toBeLessThan(result.later.reduce((s, m) => s + m.indices.length, 0));
  for (const m of result.first) {
    expect(m.transparent).toBe(false);
    expect(m.depth).toBe(false);
    expect(m.uv.slice(0, 2)).toEqual([0, 1]);
  }
  expect(result.later.map((m) => m.position)).not.toEqual(result.first.map((m) => m.position));
  const double = result.first.filter((m) => m.name === 'CHARGE_GROUND_LIGHT1');
  expect(double[0].offset).not.toEqual(double[1].offset);
  await page.screenshot({ path: 'artifacts/lux-ground-charge.png' });
  const expired = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(17);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return g.view.luxGroundCharge.models.size;
  });
  expect(expired).toBe(0);
});
