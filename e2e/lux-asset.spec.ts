import { expect, test } from '@playwright/test';

test('Lux source rig loads and every atomic clip produces finite skinned geometry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tools/qa/champion-preview.html');
  await page.waitForFunction(() => (window as any).__CHAMPION_PREVIEW__);
  const result = await page.evaluate(async () => {
    const p = (window as any).__CHAMPION_PREVIEW__;
    const manifest = await (await fetch('/assets/models/lux-base.json')).json();
    const meshes: any[] = [];
    p.model.scene.traverse((o: any) => {
      if (o.isSkinnedMesh) meshes.push(o);
    });
    const bad: string[] = [];
    let samples = 0;
    for (const clip of p.model.animations) {
      p.setClip(clip.name);
      for (const fraction of [0, 0.5, 0.95]) {
        p.setTime(clip.duration * fraction);
        p.model.scene.updateMatrixWorld(true);
        for (const mesh of meshes) {
          mesh.skeleton.update();
          const point = mesh.position.clone();
          for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
            mesh.getVertexPosition(index, point);
            samples++;
            if (![point.x, point.y, point.z].every(Number.isFinite))
              bad.push(`${clip.name}:${fraction}:${index}`);
          }
        }
      }
    }
    p.setClip('idle1');
    p.setTime(0.4);
    return {
      clips: p.model.animations.map((c: any) => c.name).sort(),
      expected: manifest.clips.map((c: any) => c.name).sort(),
      bones: meshes[0].skeleton.bones.length,
      bad,
      samples,
    };
  });
  expect(result.clips).toEqual(result.expected);
  expect(result.clips).toHaveLength(22);
  expect(result.bones).toBe(79);
  expect(result.samples).toBeGreaterThan(100000);
  expect(result.bad).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/lux-idle-preview.png' });
  await page.getByLabel('Animation', { exact: true }).selectOption('spell4');
  await page.evaluate(() => (window as any).__CHAMPION_PREVIEW__.setTime(1));
  await page.screenshot({ path: 'artifacts/lux-ultimate-preview.png' });
});
