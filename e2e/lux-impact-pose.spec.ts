import { expect, test } from '@playwright/test';

for (const rig of [
  'ashe-base',
  'lux-base',
  ...['blue', 'red'].flatMap((team) =>
    ['melee', 'caster', 'siege', 'super'].map((kind) => `${team}-${kind}`)
  ),
])
  test(`${rig} impact poses reproduce historical bones after motion, death and browser reload`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ready = async () => {
      await page.waitForFunction(() => (window as any).__GAME__?.ready);
      await page.locator('#loading').waitFor({ state: 'detached' });
    };
    await page.goto('/?scene=fixture');
    await ready();
    const expected = await page.evaluate(async (rig) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { luxHitBone } = await import('/src/render/lux-hit-bone.ts');
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.units = [w.hero];
      const [teamOrChampion, kind] = rig.split('-');
      const target =
        rig === 'ashe-base'
          ? w.hero
          : kind === 'base'
            ? w.spawn('champion', 'blue', { x: w.hero.x, y: w.hero.y }, teamOrChampion)
            : w.spawn(kind, teamOrChampion, { x: w.hero.x, y: w.hero.y });
      target.ai = false;
      if (target !== w.hero) w.hero.x -= 1000;
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      target.hp = target.maxHp = 5000;
      const lux = w.spawn(
        'champion',
        target.team === 'blue' ? 'red' : 'blue',
        { x: target.x + 300, y: target.y },
        'lux'
      );
      w.setOrder(lux, { type: 'attack', target: target.id });
      for (let i = 0; i < 60 && !w.projectiles.length; i++) w.step();
      w.setOrder(lux, { type: 'idle' });
      while (w.projectiles.length) w.step();
      const history: number[][][] = [];
      const record = () => {
        g.view.render(w, 1, 0);
        const model = g.view.models.get(target.id);
        model.root.updateMatrixWorld(true);
        history.push(
          [false, true].map((critical) => {
            const bone = luxHitBone(model.root, critical)!,
              p = new THREE.Vector3();
            bone.getWorldPosition(p);
            return p.toArray();
          })
        );
      };
      record();
      w.setOrder(target, { type: 'move', point: { x: target.x + 1000, y: target.y } });
      for (let i = 0; i < 3; i++) {
        w.step();
        record();
      }
      w.setOrder(target, { type: 'idle' });
      w.step();
      record();
      w.setOrder(target, { type: 'move', point: { x: target.x, y: target.y + 1000 } });
      for (let i = 0; i < 2; i++) {
        w.step();
        record();
      }
      w.damage(lux, target, 100000, 'physical');
      w.step();
      record();
      target.x += 100;
      target.facing += 1;
      w.step(2);
      history.push(structuredClone(history.at(-1)!), structuredClone(history.at(-1)!));
      return { history, snapshot: w.snapshot(), rig: w.luxImpactVisuals[0].targetRig };
    }, rig);
    expect(expected.rig).toBe(rig);
    const sample = () =>
      page.evaluate(async () => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { GLTFLoader } =
          await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
        const { TargetPoseSampler } = await import('/src/render/target-pose-sampler.ts');
        const { animationLayers } = await import('/src/simulation/animation-timeline.ts');
        const { MOBILE_CLIP_DURATIONS } = await import('/src/content/mobile-clip-durations.ts');
        const g = (window as any).__GAME__,
          effect = g.world.luxImpactVisuals[0];
        const asset = await new GLTFLoader().loadAsync(`/assets/models/${effect.targetRig}.glb`);
        const sampler = new TargetPoseSampler(asset.scene, asset.animations);
        const history = effect.frames.map((f: any) => {
          sampler.sample(
            animationLayers(
              f.animationTimeline,
              f.animationTimeline.tick,
              MOBILE_CLIP_DURATIONS[effect.targetRig]
            )
          );
          return [false, true].map((critical) => {
            const p = new THREE.Vector3();
            sampler.hitPosition(critical, p);
            p.applyAxisAngle(new THREE.Vector3(0, 1, 0), f.facing);
            p.add(new THREE.Vector3(f.x * 0.01, g.view.ground(f), f.y * 0.01));
            return p.toArray();
          });
        });
        sampler.dispose();
        return { history, snapshot: g.world.snapshot() };
      });
    const before = await sample();
    expect(before.history).toHaveLength(expected.history.length);
    for (let i = 0; i < expected.history.length; i++)
      for (let bone = 0; bone < 2; bone++)
        for (let axis = 0; axis < 3; axis++)
          expect(before.history[i][bone][axis]).toBeCloseTo(expected.history[i][bone][axis], 7);
    expect(before.snapshot).toBe(expected.snapshot);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready();
    expect(await sample()).toEqual(before);
    expect(errors).toEqual([]);
  });
