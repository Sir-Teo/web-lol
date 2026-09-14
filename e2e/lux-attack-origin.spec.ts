import { expect, test } from '@playwright/test';

for (const clipName of ['attack1', 'attack2']) {
  test(`extracted Lux ${clipName} hand origin matches the browser GLTF animation hierarchy`, async ({
    page,
  }) => {
    await page.goto('/tools/qa/lux-basic-attack-preview.html');
    await page.waitForFunction(() => (window as any).__ASSET__?.ready);
    const result = await page.evaluate(async (clipName) => {
      const resources = performance.getEntriesByType('resource').map((e) => e.name);
      const threeUrl = resources.find((url) => /\/three\.js(?:\?|$)/.test(url));
      const loaderUrl = resources.find((url) => /GLTFLoader/.test(url));
      if (!threeUrl || !loaderUrl) throw new Error('Missing browser animation modules');
      const T = await import(threeUrl);
      const { GLTFLoader } = await import(loaderUrl);
      const helperUrl = '/src/content/lux-attack-origin.ts';
      const { luxAttackOrigin } = await import(helperUrl);
      const gltf = await new GLTFLoader().loadAsync('/assets/models/lux-base.glb');
      const clip = gltf.animations.find((a: any) => a.name === clipName);
      const hand = gltf.scene.getObjectByName('R_Hand');
      if (!clip || !hand) throw new Error('Missing pinned attack or hand');
      const worldRoot = new T.Group();
      worldRoot.add(gltf.scene);
      worldRoot.position.set(31, 2.7, -19);
      worldRoot.rotation.y = 1.234;
      const mixer = new T.AnimationMixer(gltf.scene);
      const action = mixer.clipAction(clip);
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      let maxError = 0;
      const actual = new T.Vector3(),
        expected = new T.Vector3();
      // Reverse order exercises seeking rather than merely advancing a shared sampler.
      for (let i = 2048; i >= 0; i--) {
        const time = (clip.duration * i) / 2048;
        action.time = time;
        mixer.update(0);
        worldRoot.updateMatrixWorld(true);
        hand.getWorldPosition(actual);
        expected.fromArray(luxAttackOrigin(time, clipName));
        worldRoot.localToWorld(expected);
        maxError = Math.max(maxError, actual.distanceTo(expected));
      }
      const start = luxAttackOrigin(0, clipName),
        end = luxAttackOrigin(clip.duration, clipName);
      const clamped =
        JSON.stringify(start) === JSON.stringify(luxAttackOrigin(-1, clipName)) &&
        JSON.stringify(end) === JSON.stringify(luxAttackOrigin(100, clipName));
      let rejectsNonfinite = true;
      for (const bad of [NaN, Infinity, -Infinity]) {
        try {
          luxAttackOrigin(bad, clipName);
          rejectsNonfinite = false;
        } catch {
          /* expected */
        }
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(gltf.scene);
      return { maxError, clamped, rejectsNonfinite, samples: 2049 };
    }, clipName);
    expect(result.samples).toBe(2049);
    expect(result.maxError).toBeLessThanOrEqual(0.00001);
    expect(result.clamped).toBe(true);
    expect(result.rejectsNonfinite).toBe(true);
  });
}
