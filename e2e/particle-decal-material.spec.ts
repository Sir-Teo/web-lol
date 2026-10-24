import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('native decal matrix, vertex-height fade, palette and fog arithmetic survive exact graphics recovery', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/particle-color-preview.html');
  const result = await page.evaluate(async () => {
    const threePath = '/node_modules/three/build/three.module.js',
      materialPath = '/src/render/particle-decal-material.ts';
    const T = await import(threePath),
      { createParticleDecalMaterial } = await import(materialPath);
    const renderer = new T.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(8, 8, false);
    renderer.setClearColor(0, 0);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.set(0, 6, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const scene = new T.Scene(),
      mesh = new T.Mesh();
    mesh.frustumCulled = false;
    scene.add(mesh);
    const made: any[] = [],
      reports: any[] = [];
    const texture = (values: number[], width = 1, height = 1) => {
      const t = new T.DataTexture(new Uint8Array(values), width, height);
      t.flipY = false;
      t.minFilter = t.magFilter = T.NearestFilter;
      t.needsUpdate = true;
      made.push(t);
      return t;
    };
    const b = [128, 192, 64, 128],
      l = [64, 128, 192, 200],
      tint = [0.5, 0.25, 1, 0.75],
      base = texture(b),
      lookup = texture(l),
      white = texture([255, 255, 255, 255]);
    const norm = (v: number[]) => v.map((x) => x / 255),
      product = (...v: number[][]) => v.reduce((a, b) => a.map((x, i) => x * b[i]), [1, 1, 1, 1]),
      lit = product(norm(b), norm(l), tint);
    const worldToUv = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    const geometry = (height: (x: number) => number = () => 0, segments = 1) => {
      const g = new T.PlaneGeometry(2, 2, segments, 1),
        p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = -p.getY(i);
        p.setXYZ(i, x, height(x), z);
      }
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      return g;
    };
    const bindings = (extra: any = {}) => ({
      diffuse: base,
      lookup,
      world: new T.Matrix4(),
      worldToUv,
      heightRange: [0, 1, 2],
      color: tint,
      lookupUv: [0.5, 0.5],
      ...extra,
    });
    const read = () => {
      const gl = renderer.getContext(),
        p = new Uint8Array(256);
      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return p;
    };
    function probe(
      name: string,
      height: (x: number) => number,
      segments: number,
      extra: any,
      expected: (x: number, y: number) => number[]
    ) {
      const g = geometry(height, segments),
        m = createParticleDecalMaterial(g, bindings(extra));
      mesh.geometry = g;
      mesh.material = m;
      // Explicit DECAL_WORLD drives the observed native transform; Object3D's matrix is not an extra input.
      mesh.position.x = 50;
      renderer.render(scene, camera);
      const pixels = read();
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const actual = [...pixels.slice((y * 8 + x) * 4, (y * 8 + x + 1) * 4)],
            want = expected(x, y).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
          reports.push({
            name,
            x,
            y,
            actual,
            expected: want,
            error: Math.max(...want.map((v, i) => Math.abs(v - actual[i]))),
          });
        }
      g.dispose();
      m.dispose();
    }
    probe(
      'diffuse lookup modulation',
      () => 0,
      1,
      {},
      () => lit
    );
    probe(
      'height fades alpha only',
      () => 2,
      1,
      {},
      () => [...lit.slice(0, 3), lit[3] * 0.5]
    );
    probe(
      'negative fade clamps after interpolation',
      () => 4,
      1,
      {},
      () => [...lit.slice(0, 3), 0]
    );
    probe(
      'absolute height is computed at vertices',
      (x) => 2 * x,
      1,
      {},
      () => [...lit.slice(0, 3), lit[3] * 0.5]
    );
    probe(
      'unclamped vertex fade interpolates before fragment maximum',
      (x) => 4 * Math.abs(x),
      2,
      {},
      (x) => [...lit.slice(0, 3), lit[3] * Math.max(1 - 1.5 * Math.abs((x + 0.5) / 4 - 1), 0)]
    );
    const grid: number[] = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) grid.push(10 + x * 28, 20 + y * 28, 100, 255);
    const uvShift = worldToUv.clone();
    uvShift.elements[12] = 0.65;
    probe(
      'world matrices position and map receiving triangles',
      () => 0,
      1,
      {
        diffuse: texture(grid, 8, 8),
        lookup: white,
        color: [1, 1, 1, 1],
        world: new T.Matrix4().makeTranslation(0.25, 0, 0),
        worldToUv: uvShift,
      },
      (x, y) => {
        if (x === 0) return [0, 0, 0, 0];
        const col = Math.min(7, Math.floor(((x + 0.5) / 8 + 0.15) * 8));
        return norm(grid.slice((y * 8 + col) * 4, (y * 8 + col + 1) * 4));
      }
    );
    const fogAlpha = [0, 64, 128, 255],
      fog = texture(
        fogAlpha.flatMap((a) => [200, 50, 120, a]),
        2,
        2
      );
    probe(
      'fog modulates RGB only in world XZ',
      () => 0,
      1,
      { fog: { texture: fog, transform: [0.5, 0.5, 0.5, 0.5] } },
      (x, y) => {
        const factor = fogAlpha[(y < 4 ? 1 : 0) * 2 + (x < 4 ? 0 : 1)] / 255;
        return [...lit.slice(0, 3).map((v) => v * factor), lit[3]];
      }
    );
    const paletteBytes: number[] = [];
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 4; col++)
        paletteBytes.push(20 + col * 50, 10 + row * 13, 220 - col * 40, 0);
    const palette = {
      texture: texture(paletteBytes, 4, 16),
      sourceMix: [0.299, 0.587, 0.114, 0],
      row: 9.5 / 16,
    };
    const col = Math.min(3, Math.floor(((0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) / 255) * 4)),
      pal = norm(paletteBytes.slice((9 * 4 + col) * 4, (9 * 4 + col + 1) * 4));
    pal[3] = b[3] / 255;
    probe(
      'palette replaces untinted RGB and preserves diffuse alpha',
      () => 0,
      1,
      { palette },
      () => product(pal, norm(l), tint)
    );
    probe(
      'palette and fog preserve alpha while height fades it',
      () => 2,
      1,
      { palette, fog: { texture: fog, transform: [0.5, 0.5, 0.5, 0.5] } },
      (x, y) => {
        const color = product(pal, norm(l), tint),
          factor = fogAlpha[(y < 4 ? 1 : 0) * 2 + (x < 4 ? 0 : 1)] / 255;
        return [...color.slice(0, 3).map((v) => v * factor), color[3] * 0.5];
      }
    );
    const shiftedPalette = norm(
      paletteBytes.slice(
        (10 * 4 + Math.min(3, col + 1)) * 4,
        (10 * 4 + Math.min(3, col + 1) + 1) * 4
      )
    );
    shiftedPalette[3] = b[3] / 255;
    probe(
      'palette scroll offsets both lookup coordinates',
      () => 0,
      1,
      { palette: { ...palette, scroll: [0.25, 1 / 16] } },
      () => product(shiftedPalette, norm(l), tint)
    );
    const floatSupported = renderer.extensions.has('EXT_color_buffer_float');
    const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType, format: T.RGBAFormat }),
      hdrGeometry = geometry(),
      hdrMaterial = createParticleDecalMaterial(
        hdrGeometry,
        bindings({
          diffuse: texture([255, 128, 64, 128]),
          lookup: texture([192, 255, 255, 255]),
          color: [3, 2, 0.5, 1],
        })
      );
    mesh.geometry = hdrGeometry;
    mesh.material = hdrMaterial;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const hdr = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, hdr);
    const hdrExpected = [(3 * 192) / 255, (2 * 128) / 255, (0.5 * 64) / 255, 128 / 255];
    renderer.setRenderTarget(null);
    target.dispose();
    hdrMaterial.dispose();
    hdrGeometry.dispose();
    const recoveryGeometry = geometry(),
      recoveryMaterial = createParticleDecalMaterial(
        recoveryGeometry,
        bindings({ fog: { texture: fog, transform: [0.5, 0.5, 0.5, 0.5] } })
      );
    mesh.geometry = recoveryGeometry;
    mesh.material = recoveryMaterial;
    renderer.render(scene, camera);
    const before = [...read()];
    await new Promise<void>((resolve) => {
      renderer.domElement.addEventListener('webglcontextrestored', () => setTimeout(resolve, 100), {
        once: true,
      });
      renderer.forceContextLoss();
      setTimeout(() => renderer.forceContextRestore(), 100);
    });
    renderer.render(scene, camera);
    const after = [...read()],
      error = renderer.getContext().getError();
    recoveryGeometry.dispose();
    recoveryMaterial.dispose();
    for (const t of made) t.dispose();
    renderer.dispose();
    return { reports, floatSupported, hdr: [...hdr], hdrExpected, before, after, error };
  });
  writeFileSync(
    info.outputPath('decal-arithmetic.json'),
    JSON.stringify({ ...result, errors }, null, 2)
  );
  expect(result.reports.every((p) => p.error <= 1)).toBe(true);
  expect(result.floatSupported).toBe(true);
  for (let i = 0; i < 4; i++) expect(result.hdr[i]).toBeCloseTo(result.hdrExpected[i], 5);
  expect(result.hdr[0]).toBeGreaterThan(1);
  expect(result.before).toEqual(result.after);
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
});
