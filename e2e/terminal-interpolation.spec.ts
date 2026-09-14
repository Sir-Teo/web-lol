import { expect, test } from '@playwright/test';

test('victory presentation ignores the cycling simulation interpolation fraction', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const lux = w.spawn('champion', 'blue', w.hero, 'lux');
    const target = w.spawn('nexus', 'red', { x: lux.x + 500, y: lux.y });
    const gate = w.spawn('inhibitor', 'red', { x: lux.x + 650, y: lux.y });
    w.damage(lux, gate, 1e6, 'true');
    target.hp = 1;
    w.setOrder(lux, { type: 'attack', target: target.id });
    w.setOrder(w.hero, { type: 'move', point: { x: w.hero.x, y: w.hero.y + 500 } });
    for (let i = 0; i < 120 && !w.winner; i++) w.step();
    if (!w.winner) throw new Error('No lethal contact');
    const saved = w.snapshot(),
      start = v.previousElapsed;
    v.render(w, 1, start);
    const sample = (alpha: number) => {
      v.render(w, alpha, start + 0.1);
      const bones: number[] = [];
      v.models.get(target.id).root.traverse((node: any) => {
        if (node.isBone) bones.push(...node.matrixWorld.elements);
      });
      const instances = (mesh: any) =>
        mesh ? [mesh.count, ...mesh.instanceMatrix.array.slice(0, mesh.count * 16)] : [];
      const impact = v.luxImpacts.clouds.get(w.luxImpactVisuals[0].id);
      const flight = w.luxAttackVisuals[0].id;
      return {
        bones,
        hero: [...v.models.get(w.hero.id).root.matrixWorld.elements],
        camera: [...v.camera.matrixWorld.elements],
        rings: impact.rings
          .filter((r: any) => r.mesh.visible)
          .map((r: any) => [...r.mesh.matrix.elements]),
        sparks: instances(impact.sparks.mesh),
        hoops: instances(v.luxAttackHoops.clouds.get(flight)?.mesh),
        crescents: instances(v.luxAttackCrescents.clouds.get(flight)?.mesh),
      };
    };
    const expected = sample(1),
      samples = [0, 0.25, 0.5, 0.75, 0.99].map(sample);
    return {
      expected,
      samples,
      unchanged: w.snapshot() === saved,
      moved: Math.hypot(w.hero.x - w.hero.previous.x, w.hero.y - w.hero.previous.y),
    };
  });
  expect(result.moved).toBeGreaterThan(0);
  expect(result.expected.bones.length).toBeGreaterThan(16);
  expect(result.expected.rings.length).toBeGreaterThan(0);
  for (const sample of result.samples) expect(sample).toEqual(result.expected);
  expect(result.unchanged).toBe(true);
});
