import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('docs/reference/lux-binding-target-meshes.json', 'utf8'));
test('Chrome loads every source corner and UV exactly and renders all three target meshes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-binding-target-meshes.html');
  await page.waitForFunction(() => (window as any).__BINDING_MESHES__?.ready);
  const results = await page.evaluate(async () => {
    const g = (window as any).__BINDING_MESHES__;
    const hash = async (attribute: any) => {
      // GLTFLoader may interleave POSITION and UV in a shared buffer.
      const values: number[] = [];
      for (let i = 0; i < attribute.count; i++) {
        values.push(attribute.getX(i), attribute.getY(i));
        if (attribute.itemSize === 3) values.push(attribute.getZ(i));
      }
      const bytes = new Float32Array(values);
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.buffer))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
    };
    return Promise.all(
      g.meshes.map(async (m: any) => ({
        position: await hash(m.geometry.attributes.position),
        uv: await hash(m.geometry.attributes.uv),
        corners: m.geometry.attributes.position.count,
        index: m.geometry.index,
      }))
    );
  });
  results.forEach((r, i) => {
    expect(r.position).toBe(manifest.outputs[i].positionFloat32Sha256);
    expect(r.uv).toBe(manifest.outputs[i].uvFloat32Sha256);
    expect(r.corners).toBe(manifest.outputs[i].exportedCorners);
    expect(r.index).toBeNull();
  });
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/browser-lux-binding-target-meshes.png' });
});
