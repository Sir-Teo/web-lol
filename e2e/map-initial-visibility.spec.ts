import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('source default-hidden terrain variants stay out of draws and speculative uploads', async ({
  page,
}) => {
  const source = JSON.parse(await readFile('docs/reference/map-initial-visibility.json', 'utf8'));
  const names = source.hidden.map((record: { node: string }) => record.node.replaceAll('.', ''));
  await page.goto('/map.html');
  await page.waitForFunction(() => (window as any).__MAP__?.ready);
  const result = await page.evaluate(async (names) => {
    const map = (window as any).__MAP__;
    map.renderer.setAnimationLoop(null);
    map.viewpoint('overview');
    const root = map.map.children[0],
      hidden: string[] = [],
      drawn: string[] = [];
    root.traverse((object: any) => {
      if (!object.isMesh) return;
      if (!object.visible) hidden.push(object.name);
      const previous = object.onBeforeRender;
      object.onBeforeRender = function (...args: any[]) {
        drawn.push(object.name);
        previous.apply(this, args);
      };
    });
    const prepared: string[] = [];
    const original = map.renderer.initTexture.bind(map.renderer);
    map.renderer.initTexture = (texture: any) => {
      prepared.push(texture.name);
      original(texture);
    };
    const exclusiveTextures = new Map<string, { hidden: boolean; visible: boolean }>();
    root.traverse((object: any) => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.map) continue;
        const name = material.map.name,
          state = exclusiveTextures.get(name) ?? { hidden: false, visible: false };
        state[object.visible ? 'visible' : 'hidden'] = true;
        exclusiveTextures.set(name, state);
      }
    });
    try {
      for (let i = 0; i < 5; i++) {
        root.userData.textureResidency.beginFrame();
        map.renderer.render(map.scene, map.camera);
        root.userData.textureResidency.endFrame();
        root.userData.texturePrefetch.update(map.renderer, map.camera);
      }
      return {
        hidden,
        hiddenDraws: drawn.filter((name) => names.includes(name)),
        wronglyPrepared: prepared.filter((name) => {
          const state = exclusiveTextures.get(name);
          return state?.hidden && !state.visible;
        }),
      };
    } finally {
      map.renderer.initTexture = original;
    }
  }, names);
  expect(result.hidden.sort()).toEqual(names.sort());
  expect(result.hiddenDraws).toEqual([]);
  expect(result.wronglyPrepared).toEqual([]);
  await page.screenshot({ path: 'artifacts/browser-map-default-visibility.png' });
});
