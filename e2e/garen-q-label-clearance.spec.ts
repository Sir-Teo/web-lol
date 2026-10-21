import { expect, test } from '@playwright/test';

for (const density of [1, 2])
  test.describe(`Q icon at device scale ${density}`, () => {
    test.use({ deviceScaleFactor: density });
    test('recipient readouts stay clear through source pop, zoom, resize and multiline names without changing simulation or appearance', async ({
      page,
    }) => {
      await page.goto('/?scene=fixture&champion=garen');
      await page.waitForFunction(() => (window as any).__GAME__?.ready);
      await page.locator('#loading').waitFor({ state: 'detached' });
      await page.evaluate(() => {
        const g = (window as any).__GAME__,
          w = g.world;
        g.setPaused(true);
        w.units = [w.hero];
        w.pendingSpawns = [];
        w.nextWaveTick = Infinity;
        w.battlefield.lineOfSight = () => true;
        Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
        w.learnSpell('q');
        g.hud.root.querySelector('.welcome')?.remove();
      });
      for (const kind of ['dummy', 'champion', 'melee']) {
        await page.evaluate((kind) => {
          const g = (window as any).__GAME__,
            w = g.world;
          w.units = [w.hero];
          w.setOrder(w.hero, { type: 'idle' });
          const target = w.spawn(
            kind,
            'red',
            { x: 100, y: 0 },
            kind === 'champion' ? 'garen' : undefined
          );
          target.ai = false;
          target.maxHp = target.hp = 10000;
          target.name = 'A longer recipient name for layout';
          w.player.cooldowns.q = 0;
          w.setOrder(w.hero, { type: 'attack', target: target.id });
          w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
          w.step();
          w.step(w.hero.releaseTick - w.tick + 7);
          w.setOrder(w.hero, { type: 'idle' });
          g.view.recenter(w.hero);
          (window as any).__LABEL_TARGET__ = target.id;
        }, kind);
        for (const size of [
          { width: 960, height: 720 },
          { width: 1440, height: 900 },
          { width: 1920, height: 1080 },
        ]) {
          await page.setViewportSize(size);
          await page.waitForFunction(({ width, height }) => {
            const g = (window as any).__GAME__;
            return g.view.width === width && g.view.height === height;
          }, size);
          const result = await page.evaluate(() => {
            const g = (window as any).__GAME__,
              w = g.world,
              id = (window as any).__LABEL_TARGET__,
              samples: any[] = [];
            const snapshot = w.snapshot();
            // Read actual world-transformed mesh corners, independently of the layout helper.
            for (const zoom of [0.75, 1, 2.5]) {
              g.view.camera.zoom = zoom;
              g.view.camera.updateProjectionMatrix();
              g.view.render(w, 1, g.view.previousElapsed);
              const mesh = [...g.view.garenDecisiveStrike.models.values()].find(
                (m: any) => m.userData.silence && m.userData.targetId === id
              ) as any;
              const label = g.view.healthBars.get(id).getBoundingClientRect(),
                canvas = g.view.renderer.domElement.getBoundingClientRect(),
                position = mesh.geometry.getAttribute('position'),
                xs: number[] = [],
                ys: number[] = [];
              for (let i = 0; i < position.count; i++) {
                const p = mesh.position
                  .clone()
                  .fromBufferAttribute(position, i)
                  .applyMatrix4(mesh.matrixWorld)
                  .project(g.view.camera);
                xs.push(canvas.left + ((p.x + 1) * canvas.width) / 2);
                ys.push(canvas.top + ((1 - p.y) * canvas.height) / 2);
              }
              const original = mesh.position
                  .clone()
                  .fromArray(mesh.userData.preferredPosition)
                  .project(g.view.camera),
                placed = mesh.position.clone().project(g.view.camera);
              samples.push({
                gap: label.top - Math.max(...ys),
                xError: Math.abs(original.x - placed.x),
                depthError: Math.abs(original.z - placed.z),
                scale: mesh.scale.toArray(),
                lookup: mesh.material.uniforms.lookupUv.value.toArray(),
                material: mesh.material.uuid,
                geometry: mesh.geometry.uuid,
                lift: mesh.userData.layoutLiftPixels,
                nameVisible:
                  getComputedStyle(g.view.healthBars.get(id).querySelector('.unit-name'))
                    .display !== 'none',
              });
            }
            return {
              samples,
              unchanged: w.snapshot() === snapshot,
              error: g.view.renderer.getContext().getError(),
            };
          });
          expect(result.unchanged).toBe(true);
          expect(result.error).toBe(0);
          for (const sample of result.samples) {
            expect(sample.gap).toBeGreaterThanOrEqual(3.99);
            expect(sample.xError).toBeLessThan(1e-9);
            expect(sample.depthError).toBeLessThan(1e-9);
            expect(sample.scale).toEqual(result.samples[0].scale);
            expect(sample.scale[1]).toBeGreaterThan(0.59);
            expect(sample.lookup).toEqual(result.samples[0].lookup);
            expect(sample.material).toBe(result.samples[0].material);
            expect(sample.geometry).toBe(result.samples[0].geometry);
            expect(sample.nameVisible).toBe(kind !== 'melee');
          }
        }
        // Advance only the simulation between samples so birth/pop phases are covered too.
        await page.evaluate(() => {
          const g = (window as any).__GAME__;
          g.world.step(12);
          g.view.render(g.world, 1, g.view.previousElapsed);
        });
        const pop = await page.evaluate(() => {
          const g = (window as any).__GAME__,
            id = (window as any).__LABEL_TARGET__,
            mesh = [...g.view.garenDecisiveStrike.models.values()].find(
              (m: any) => m.userData.silence && m.userData.targetId === id
            ) as any,
            label = g.view.healthBars.get(id).getBoundingClientRect(),
            canvas = g.view.renderer.domElement.getBoundingClientRect(),
            ps = mesh.geometry.getAttribute('position');
          let bottom = -Infinity;
          for (let i = 0; i < ps.count; i++) {
            const p = mesh.position
              .clone()
              .fromBufferAttribute(ps, i)
              .applyMatrix4(mesh.matrixWorld)
              .project(g.view.camera);
            bottom = Math.max(bottom, canvas.top + ((1 - p.y) * canvas.height) / 2);
          }
          return {
            gap: label.top - bottom,
            size: mesh.scale.y,
            lift: mesh.userData.layoutLiftPixels,
          };
        });
        expect(pop.gap).toBeGreaterThanOrEqual(3.99);
        expect(pop.size).toBeCloseTo(0.5);
        expect(pop.lift).toBeGreaterThan(0);
      }
    });
  });
