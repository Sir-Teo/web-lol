import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('all source rigs preserve sampled poses and pixels after constant-channel removal', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { clone } = await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
    const { removeConstantBoneTracks } = await import('/src/render/constant-bone-tracks.ts');
    const g = (window as any).__GAME__,
      v = g.view;
    g.setPaused(true);
    v.locked = false;
    v.center = { x: 0, y: 0 };
    v.render(g.world, 1, 10);
    for (const model of v.models.values()) model.root.visible = false;
    const Mixer = v.models.get(1).mixer.constructor;
    const names = [
      'ashe-base',
      'lux-base',
      ...['blue', 'red'].flatMap((team) =>
        ['melee', 'caster', 'siege', 'super', 'turret', 'nexus', 'inhibitor'].map(
          (kind) => `${team}-${kind}`
        )
      ),
    ];
    const records = [];
    let worstMatrixError = 0,
      pixelComparisons = 0;
    const failures: string[] = [];
    for (const name of names) {
      const gltf = await new GLTFLoader().loadAsync(`assets/models/${name}.glb`);
      const clips = removeConstantBoneTracks(gltf.scene, gltf.animations);
      const a = clone(gltf.scene),
        b = clone(gltf.scene),
        ma = new Mixer(a),
        mb = new Mixer(b);
      const an: any[] = [],
        bn: any[] = [];
      a.traverse((node: any) => {
        an.push(node);
        if (node.isMesh) node.castShadow = true;
      });
      b.traverse((node: any) => {
        bn.push(node);
        if (node.isMesh) node.castShadow = true;
      });
      let samples = 0;
      for (let index = 0; index < clips.length; index++) {
        const aa = ma.clipAction(gltf.animations[index]),
          bb = mb.clipAction(clips[index]);
        aa.reset().play();
        bb.reset().play();
        for (let step = 0; step <= 16; step++) {
          aa.time = bb.time = (clips[index].duration * step) / 16;
          ma.update(0);
          mb.update(0);
          a.updateMatrixWorld(true);
          b.updateMatrixWorld(true);
          for (let n = 0; n < an.length; n++)
            for (let k = 0; k < 16; k++)
              worstMatrixError = Math.max(
                worstMatrixError,
                Math.abs(an[n].matrixWorld.elements[k] - bn[n].matrixWorld.elements[k])
              );
          samples++;
          if (step === 8) {
            v.scene.add(a);
            v.renderer.render(v.scene, v.camera);
            const before = v.renderer.domElement.toDataURL();
            v.scene.remove(a);
            v.scene.add(b);
            v.renderer.render(v.scene, v.camera);
            const after = v.renderer.domElement.toDataURL();
            v.scene.remove(b);
            pixelComparisons++;
            if (before !== after) failures.push(`${name}/${clips[index].name}`);
          }
        }
        aa.stop();
        bb.stop();
      }
      // Advance real cross-fades rather than only isolated poses.
      for (let i = 0; i < clips.length; i++) {
        const aa = ma.clipAction(gltf.animations[i]).reset().play(),
          bb = mb.clipAction(clips[i]).reset().play();
        aa.fadeIn(0.08);
        bb.fadeIn(0.08);
        for (let step = 0; step < 8; step++) {
          ma.update(0.02);
          mb.update(0.02);
          a.updateMatrixWorld(true);
          b.updateMatrixWorld(true);
          for (let n = 0; n < an.length; n++)
            for (let k = 0; k < 16; k++)
              worstMatrixError = Math.max(
                worstMatrixError,
                Math.abs(an[n].matrixWorld.elements[k] - bn[n].matrixWorld.elements[k])
              );
        }
        aa.fadeOut(0.08);
        bb.fadeOut(0.08);
      }
      records.push({
        name,
        clips: clips.length,
        samples,
        before: gltf.animations.reduce((n: number, c: any) => n + c.tracks.length, 0),
        after: clips.reduce((n: number, c: any) => n + c.tracks.length, 0),
        bindingsBefore: ma.stats.bindings.total,
        bindingsAfter: mb.stats.bindings.total,
      });
      ma.stopAllAction();
      mb.stopAllAction();
    }
    return { records, worstMatrixError, pixelComparisons, failures };
  });
  await writeFile('artifacts/constant-bone-tracks.json', JSON.stringify(result, null, 2) + '\n');
  expect(result.worstMatrixError).toBeLessThan(1e-6);
  expect(result.pixelComparisons).toBe(result.records.reduce((n, record) => n + record.clips, 0));
  expect(result.failures).toEqual([]);
  expect(result.records.reduce((n, r) => n + r.before - r.after, 0)).toBeGreaterThan(0);
  expect(
    result.records.reduce((n, r) => n + r.bindingsBefore - r.bindingsAfter, 0)
  ).toBeGreaterThan(0);
});
