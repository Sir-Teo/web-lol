import { expect, test } from '@playwright/test';

test('ground queue blends after terrain, before characters, retaining depth and source pass order', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { groundDisplayListSort, groundEffectMaterial, setGroundRenderStage } =
      await import('/src/render/ground-display-list.ts');
    (window as any).__GAME__.setPaused(true);
    const renderer = new T.WebGLRenderer(),
      scene = new T.Scene(),
      target = new T.WebGLRenderTarget(1, 1);
    renderer.setSize(1, 1);
    renderer.setOpaqueSort(groundDisplayListSort);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const geometry = new T.PlaneGeometry(2, 2);
    const shader = (color: number[], ground = false) => {
      const m = new T.ShaderMaterial({
        uniforms: { color: { value: new T.Vector4(...color) } },
        vertexShader:
          'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec4 color; void main(){gl_FragColor=color;}',
        depthWrite: !ground,
        depthTest: !ground,
        blending: ground ? T.CustomBlending : T.NoBlending,
        blendSrc: T.SrcAlphaFactor,
        blendDst: T.OneMinusSrcAlphaFactor,
        blendSrcAlpha: T.SrcAlphaFactor,
        blendDstAlpha: T.OneMinusSrcAlphaFactor,
      });
      if (ground) groundEffectMaterial(m);
      return m;
    };
    const terrain = new T.Group(),
      effects = new T.Group(),
      character = new T.Group();
    setGroundRenderStage(terrain, 'terrain');
    setGroundRenderStage(effects, 'ground');
    // Nested groups and deliberately conflicting ordinary orders cannot cross stages.
    terrain.renderOrder = 10000;
    effects.renderOrder = -10000;
    character.renderOrder = -20000;
    const nested = new T.Group();
    effects.add(nested);
    const floor = new T.Mesh(geometry, shader([0, 0, 1, 1]));
    terrain.add(floor);
    const red = new T.Mesh(geometry, shader([1, 0, 0, 0.5], true));
    nested.add(red);
    const green = new T.Mesh(geometry, shader([0, 1, 0, 0.5], true));
    nested.add(green);
    red.renderOrder = -5;
    green.renderOrder = 5;
    const actor = new T.Mesh(geometry, shader([1, 1, 1, 1]));
    actor.position.z = 1;
    character.add(actor);
    scene.add(character, effects, terrain);
    renderer.setRenderTarget(target);
    const read = () => {
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      return [...pixel];
    };
    character.visible = false;
    const blend = read();
    green.renderOrder = -10;
    const reversed = read();
    character.visible = true;
    const covered = read();
    actor.position.z = -1;
    const behind = read();
    const flags = {
      transparent: red.material.transparent,
      depthTest: red.material.depthTest,
      depthWrite: red.material.depthWrite,
    };
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    geometry.dispose();
    for (const m of [floor, red, green, actor]) m.material.dispose();
    return { blend, reversed, covered, behind, flags };
  });
  const close = (actual: number[], expected: number[]) =>
    actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1));
  close(result.blend, [64, 128, 64, 159]);
  close(result.reversed, [128, 64, 64, 159]);
  close(result.covered, [255, 255, 255, 255]);
  expect(result.behind).toEqual(result.reversed);
  expect(result.flags).toEqual({ transparent: false, depthTest: false, depthWrite: false });
});
