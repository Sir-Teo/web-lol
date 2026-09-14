import { expect, test } from '@playwright/test';

test('terrain stage retains built-in alpha output and back-to-front blending', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const {
      groundDisplayListSort,
      setGroundRenderStage,
      terrainBlendMaterial,
      groundEffectMaterial,
    } = await import('/src/render/ground-display-list.ts');
    (window as any).__GAME__.setPaused(true);
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene();
    renderer.setSize(1, 1);
    renderer.setRenderTarget(target);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const geometry = new T.PlaneGeometry(2, 2);
    const floor = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0x0000ff }));
    setGroundRenderStage(floor, 'terrain');
    const near = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    near.position.z = 2;
    const far = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    far.position.z = 1;
    scene.add(near, far, floor);
    const read = () => {
      renderer.render(scene, camera);
      const p = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, p);
      return [...p];
    };
    const baseline = read();
    terrainBlendMaterial(near.material);
    terrainBlendMaterial(far.material);
    setGroundRenderStage(near, 'terrainBlend');
    setGroundRenderStage(far, 'terrainBlend');
    renderer.setOpaqueSort(groundDisplayListSort);
    const staged = read();
    far.position.z = 3;
    const reversed = read();
    const ground = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.5,
        depthWrite: false,
        depthTest: false,
        blending: T.CustomBlending,
        blendSrc: T.SrcAlphaFactor,
        blendDst: T.OneMinusSrcAlphaFactor,
        blendSrcAlpha: T.OneFactor,
        blendDstAlpha: T.OneMinusSrcAlphaFactor,
      })
    );
    groundEffectMaterial(ground.material);
    setGroundRenderStage(ground, 'ground');
    scene.add(ground);
    const groundOverWater = read();
    ground.visible = false;
    // Premultiplied normal blending must retain its ONE source factor.
    for (const m of [near, far]) {
      m.material.transparent = true;
      m.material.blending = T.NormalBlending;
      m.material.premultipliedAlpha = true;
      m.material.needsUpdate = true;
    }
    const premultBaseline = read();
    for (const m of [near, far]) terrainBlendMaterial(m.material);
    const premultStaged = read();
    const flags = {
      depthWrite: near.material.depthWrite,
      depthTest: near.material.depthTest,
      opacity: near.material.opacity,
      transparent: near.material.transparent,
    };
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    geometry.dispose();
    for (const m of [near, far, floor, ground]) m.material.dispose();
    return { baseline, staged, reversed, groundOverWater, premultBaseline, premultStaged, flags };
  });
  expect(result.staged).toEqual(result.baseline);
  expect(result.premultStaged).toEqual(result.premultBaseline);
  const close = (a: number[], b: number[]) =>
    a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(1));
  close(result.staged, [64, 128, 64, 255]);
  close(result.reversed, [128, 64, 64, 255]);
  close(result.groundOverWater, [192, 160, 160, 255]);
  expect(result.flags).toEqual({
    depthWrite: false,
    depthTest: true,
    opacity: 0.5,
    transparent: false,
  });
});
