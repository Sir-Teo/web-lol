import { expect, test } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const decoded = JSON.parse(readFileSync('docs/reference/leona-e-particles-decoded.json', 'utf8'));

test('all four Zenith SCBs load with exact source attributes and draw visible source wireframes', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/particle-color-preview.html');
  const result = await page.evaluate(async (meshes) => {
    const threePath = '/node_modules/three/build/three.module.js',
      loaderPath = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
    const T = await import(threePath),
      { GLTFLoader } = await import(loaderPath);
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:#10161c;color:#eee;font:16px sans-serif';
    const title = document.createElement('h2');
    title.textContent = 'Zenith source geometry — wireframe inspection';
    const note = document.createElement('p');
    note.textContent =
      'Retained source positions and topology. This is an asset inspection, not native effect rendering.';
    document.body.append(title, note);
    const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(1440, 600);
    document.body.append(renderer.domElement);
    renderer.setScissorTest(true);
    const results = [];
    for (const [i, m] of meshes.entries()) {
      const gltf = await new GLTFLoader().loadAsync(m.output.path),
        nodes: any[] = [];
      gltf.scene.traverse((n: any) => {
        if (n.isMesh) nodes.push(n);
      });
      if (nodes.length !== 1) throw Error('Expected one source mesh');
      const node = nodes[0],
        g = node.geometry,
        hashes: Record<string, string> = {};
      for (const [name, a] of Object.entries(g.attributes) as [string, any][]) {
        const data = a.isInterleavedBufferAttribute
          ? (() => {
              const values = new a.data.array.constructor(a.count * a.itemSize);
              for (let j = 0; j < a.count; j++)
                for (let k = 0; k < a.itemSize; k++)
                  values[j * a.itemSize + k] = a.data.array[j * a.data.stride + a.offset + k];
              return values;
            })()
          : a.array;
        hashes[
          ({ position: 'POSITION', uv: 'TEXCOORD_0' } as Record<string, string>)[name] ??
            name.toUpperCase()
        ] = [
          ...new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            )
          ),
        ]
          .map((x) => x.toString(16).padStart(2, '0'))
          .join('');
      }
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        material.dispose();
      const material = new T.MeshBasicMaterial({
        color: 0xf5cf82,
        wireframe: false,
        side: T.DoubleSide,
      });
      node.material = material;
      const scene = new T.Scene();
      scene.background = new T.Color(0x10161c);
      scene.add(node);
      const box = new T.Box3().setFromObject(node),
        center = box.getCenter(new T.Vector3()),
        size = box.getSize(new T.Vector3());
      const extent = Math.max(size.x, size.y, size.z),
        camera = new T.PerspectiveCamera(40, 360 / 600, 0.001, Math.max(1000, extent * 100));
      camera.position.copy(center).add(new T.Vector3(extent * 1.5, extent * 0.8, extent * 2.5));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      renderer.setViewport(i * 360, 0, 360, 600);
      renderer.setScissor(i * 360, 0, 360, 600);
      renderer.render(scene, camera);
      const gl = renderer.getContext(),
        pixels = new Uint8Array(360 * 600 * 4);
      gl.readPixels(i * 360, 0, 360, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let visible = 0;
      for (let j = 0; j < pixels.length; j += 4)
        if (pixels[j] > 150 && pixels[j + 1] > 100) visible++;
      const triangleError = gl.getError();
      // Three's non-indexed wireframe helper uses position.array.length/3;
      // for interleaved GLBs that includes other attributes. Draw an exact
      // position copy for inspection, after proving the original triangle draw.
      const position = g.getAttribute('position'),
        positions = new Float32Array(position.count * 3);
      for (let j = 0; j < position.count; j++)
        positions.set([position.getX(j), position.getY(j), position.getZ(j)], j * 3);
      const drawGeometry = g.clone();
      drawGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      const drawnPositionSha256 = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', positions.buffer)),
      ]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      node.geometry = drawGeometry;
      material.wireframe = true;
      renderer.render(scene, camera);
      gl.readPixels(i * 360, 0, 360, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let wireframeVisible = 0;
      for (let j = 0; j < pixels.length; j += 4)
        if (pixels[j] > 150 && pixels[j + 1] > 100) wireframeVisible++;
      results.push({
        path: m.output.path,
        hashes,
        indexed: g.index !== null,
        vertices: g.getAttribute('position').count,
        visible,
        triangleError,
        wireframeVisible,
        drawnPositionSha256,
        error: gl.getError(),
        bounds: { min: box.min.toArray(), max: box.max.toArray() },
      });
      material.dispose();
      drawGeometry.dispose();
      g.dispose();
    }
    return results;
  }, decoded.meshes);
  writeFileSync(info.outputPath('source-meshes.json'), JSON.stringify({ result, errors }, null, 2));
  await page.screenshot({ path: info.outputPath('source-wireframes.png') });
  expect(errors).toEqual([]);
  expect(result).toHaveLength(4);
  for (const [i, r] of result.entries()) {
    expect(r.hashes).toEqual(decoded.meshes[i].attributeSha256);
    expect(r.indexed).toBe(false);
    expect(r.vertices).toBe(decoded.meshes[i].exportedCorners);
    expect(r.visible).toBeGreaterThan(0);
    expect(r.triangleError).toBe(0);
    expect(r.wireframeVisible).toBeGreaterThan(0);
    expect(r.drawnPositionSha256).toBe(decoded.meshes[i].attributeSha256.POSITION);
    expect(r.error).toBe(0);
  }
});
