import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('native distortion arithmetic, alpha, sampler edges and perspective coordinates match independent framebuffer reads', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const { createParticleDistortionMaterial } = await import('/src/render/particle-distortion.ts');
    const { ParticleDistortionPass } = await import('/src/render/particle-distortion-pass.ts');
    (window as any).__GAME__.setPaused(true);
    const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(96, 48);
    renderer.setPixelRatio(1);
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.z = 5;
    const background = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        depthWrite: true,
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:
          'void main(){gl_FragColor=vec4(gl_FragCoord.x/96.,gl_FragCoord.y/48.,.6,1.);}',
      })
    );
    scene.add(background);
    const texture = (values: number[]) => {
      const t = new T.DataTexture(new Float32Array(values), 1, 1, T.RGBAFormat, T.FloatType);
      t.needsUpdate = true;
      return t;
    };
    const read = () => {
      const gl = renderer.getContext(),
        p = new Uint8Array(96 * 48 * 4);
      gl.readPixels(0, 0, 96, 48, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return p;
    };
    const sample = (p: Uint8Array, u: number, v: number) => {
      const x = Math.max(0, Math.min(95, u * 96 - 0.5)),
        y = Math.max(0, Math.min(47, v * 48 - 0.5));
      const a = Math.floor(x),
        b = Math.floor(y),
        f = x - a,
        g = y - b;
      return [0, 1, 2].map((c) => {
        const at = (i: number, j: number) => p[(j * 96 + i) * 4 + c] / 255;
        return (
          (at(a, b) * (1 - f) + at(Math.min(95, a + 1), b) * f) * (1 - g) +
          (at(a, Math.min(47, b + 1)) * (1 - f) +
            at(Math.min(95, a + 1), Math.min(47, b + 1)) * f) *
            g
        );
      });
    };
    const cases = [];
    for (const config of [
      {
        normal: [0.8, 0.2, 1, 0.25],
        ramp: [0.6, 0.8, 0.4, 0.5],
        base: [0.8, 0.5, 1, 0],
        tint: [0.8, 0.7, 0.9, 0],
        power: 0.2,
        alphaTest: false,
        ref: 0,
        blend: true,
      },
      {
        normal: [0.8, 0.2, 1, 0.9],
        ramp: [0.6, 0.8, 0.4, 0.5],
        base: [0.8, 0.5, 1, 1],
        tint: [0.8, 0.7, 0.9, 1],
        power: 0.2,
        alphaTest: false,
        ref: 0,
        blend: false,
      },
      {
        normal: [0.8, 0.2, 1, 0.1],
        ramp: [0.6, 0.8, 0.4, 0.5],
        base: [0.8, 0.5, 1, 0],
        tint: [0.8, 0.7, 0.9, 0],
        power: 0.2,
        alphaTest: false,
        ref: 0,
        blend: false,
      },
      {
        normal: [1, 0, 1, 1],
        ramp: [1, 1, 1, 1],
        base: [1, 1, 1, 1],
        tint: [1, 1, 1, 1],
        power: 2,
        alphaTest: false,
        ref: 0,
        blend: true,
      },
      {
        normal: [0.8, 0.2, 1, 0.25],
        ramp: [1, 1, 1, 0.5],
        base: [1, 1, 1, 1],
        tint: [1, 1, 1, 1],
        power: 0.2,
        alphaTest: true,
        ref: 0.126,
        blend: true,
      },
      {
        normal: [0.8, 0.2, 1, 0.25],
        ramp: [1, 1, 1, 0.5],
        base: [1, 1, 1, 0],
        tint: [1, 1, 1, 0],
        power: 0.2,
        alphaTest: true,
        ref: 0.125,
        blend: true,
      },
    ])
      for (const coordinates of ['uniform', 'vertex'] as const) {
        renderer.render(scene, camera);
        const before = read();
        const pass = new ParticleDistortionPass();
        const base = texture(config.base),
          ramp = texture(config.ramp),
          normal = texture(config.normal);
        const material = createParticleDistortionMaterial({
          texture: base,
          lookup: ramp,
          normal,
          coordinates,
          alphaTest: config.alphaTest,
          vertexTint: coordinates === 'vertex',
        });
        material.uniforms.distortionPower.value = config.power;
        material.uniforms.alphaRef.value = config.ref;
        material.uniforms.particleColor.value.fromArray(config.tint);
        material.depthTest = false;
        if (!config.blend) material.blending = T.NoBlending;
        const geometry = new T.PlaneGeometry(2, 2);
        geometry.setAttribute(
          'particleLookupUv',
          new T.BufferAttribute(new Float32Array(8).fill(0.5), 2)
        );
        geometry.setAttribute(
          'particleTint',
          new T.BufferAttribute(
            new Float32Array(Array.from({ length: 4 }, () => config.tint).flat()),
            4
          )
        );
        const mesh = new T.Mesh(geometry, material);
        pass.scene.add(mesh);
        pass.render(renderer, camera);
        const actual = read();
        let maxDelta = 0;
        const alpha = config.normal[3] * config.ramp[3],
          discard = config.alphaTest && alpha < config.ref;
        for (const [x, y] of [
          [0, 0],
          [95, 47],
          [12, 9],
          [47, 23],
          [70, 31],
        ]) {
          const frame = sample(
            before,
            (x + 0.5) / 96 + (config.normal[0] - 0.5) * 2 * config.ramp[3] * config.power,
            (y + 0.5) / 48 - (config.normal[1] - 0.5) * 2 * config.ramp[3] * config.power
          );
          for (let c = 0; c < 4; c++) {
            let expected = before[(y * 96 + x) * 4 + c];
            if (!discard) {
              const source =
                c === 3 ? alpha : config.ramp[c] * config.tint[c] * frame[c] * config.base[c];
              expected =
                (config.blend
                  ? c === 3
                    ? alpha + (expected / 255) * (1 - alpha)
                    : source * alpha + (expected / 255) * (1 - alpha)
                  : source) * 255;
            }
            maxDelta = Math.max(
              maxDelta,
              Math.abs(actual[(y * 96 + x) * 4 + c] - Math.round(expected))
            );
          }
        }
        cases.push({
          coordinates,
          normalAlpha: config.normal[3],
          rampAlpha: config.ramp[3],
          blend: config.blend,
          alphaTest: config.alphaTest,
          vertexTint: coordinates === 'vertex',
          ref: config.ref,
          power: config.power,
          maxDelta,
          calls: renderer.info.render.calls,
        });
        pass.dispose();
        geometry.dispose();
        material.dispose();
        base.dispose();
        ramp.dispose();
        normal.dispose();
      }
    // Native VS divides by clip W before perspective interpolation. A sloped
    // quad therefore differs measurably from gl_FragCoord even at zero power.
    renderer.render(scene, camera);
    const before = read();
    const pass = new ParticleDistortionPass(),
      white = texture([1, 1, 1, 1]),
      normal = texture([0.5, 0.5, 1, 1]);
    const material = createParticleDistortionMaterial({ texture: white, lookup: white, normal });
    material.depthTest = false;
    material.blending = T.NoBlending;
    const geometry = new T.PlaneGeometry(2.7, 2.0),
      mesh = new T.Mesh(geometry, material);
    mesh.rotation.x = 0.85;
    const perspective = new T.PerspectiveCamera(45, 2, 0.1, 20);
    perspective.position.z = 4;
    perspective.updateMatrixWorld();
    pass.scene.add(mesh);
    mesh.updateMatrixWorld();
    const mvp = new T.Matrix4()
      .multiplyMatrices(perspective.projectionMatrix, perspective.matrixWorldInverse)
      .multiply(mesh.matrixWorld);
    const pos = geometry.getAttribute('position'),
      vs = Array.from({ length: pos.count }, (_, i) =>
        new T.Vector4(pos.getX(i), pos.getY(i), pos.getZ(i), 1).applyMatrix4(mvp)
      );
    pass.render(renderer, perspective);
    const actual = read();
    let perspectiveDelta = 0,
      naiveWitness = 0,
      samples = 0;
    const indices = Array.from(geometry.index!.array) as number[];
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 96; x++)
        for (let i = 0; i < indices.length; i += 3) {
          const v = indices.slice(i, i + 3).map((j) => vs[j]),
            s = v.map((q) => ({
              x: ((q.x / q.w) * 0.5 + 0.5) * 96,
              y: ((q.y / q.w) * 0.5 + 0.5) * 48,
            })),
            px = x + 0.5,
            py = y + 0.5;
          const denom =
            (s[1].y - s[2].y) * (s[0].x - s[2].x) + (s[2].x - s[1].x) * (s[0].y - s[2].y);
          const a = ((s[1].y - s[2].y) * (px - s[2].x) + (s[2].x - s[1].x) * (py - s[2].y)) / denom,
            b = ((s[2].y - s[0].y) * (px - s[2].x) + (s[0].x - s[2].x) * (py - s[2].y)) / denom,
            w = [a, b, 1 - a - b];
          if (Math.min(...w) < 0.03) continue;
          const z = w.reduce((n, k, j) => n + k / v[j].w, 0),
            u = w.reduce((n, k, j) => n + (k * ((v[j].x / v[j].w) * 0.5 + 0.5)) / v[j].w, 0) / z,
            t = w.reduce((n, k, j) => n + (k * ((v[j].y / v[j].w) * 0.5 + 0.5)) / v[j].w, 0) / z;
          const expected = sample(before, u, t),
            naive = sample(before, px / 96, py / 48);
          samples++;
          for (let c = 0; c < 3; c++) {
            perspectiveDelta = Math.max(
              perspectiveDelta,
              Math.abs(actual[(y * 96 + x) * 4 + c] - Math.round(expected[c] * 255))
            );
            naiveWitness = Math.max(naiveWitness, Math.abs(expected[c] - naive[c]) * 255);
          }
        }
    pass.dispose();
    geometry.dispose();
    material.dispose();
    white.dispose();
    normal.dispose();
    background.geometry.dispose();
    background.material.dispose();
    renderer.dispose();
    return { cases, perspective: { maxDelta: perspectiveDelta, naiveWitness, samples } };
  });
  expect(result.cases).toHaveLength(12);
  expect(result.cases.every((c) => c.maxDelta <= 2 && c.calls === 2)).toBe(true);
  expect(result.perspective.samples).toBeGreaterThan(100);
  expect(result.perspective.maxDelta).toBeLessThanOrEqual(2);
  expect(result.perspective.naiveWitness).toBeGreaterThan(5);
  writeFileSync('artifacts/particle-distortion-gpu.json', JSON.stringify(result, null, 2) + '\n');
});

test('canvas copy preserves raw color and physical viewport coordinates across pixel ratio and resize', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'),
      { ParticleDistortionPass } = await import('/src/render/particle-distortion-pass.ts'),
      { createParticleDistortionMaterial } = await import('/src/render/particle-distortion.ts');
    (window as any).__GAME__.setPaused(true);
    const r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }),
      s = new T.Scene(),
      c = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    c.position.z = 5;
    const bg = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:
          'void main(){gl_FragColor=vec4(fract(gl_FragCoord.x/23.),fract(gl_FragCoord.y/17.),.4,1.);}',
      })
    );
    s.add(bg);
    const tex = (v: number[]) => {
        const t = new T.DataTexture(new Float32Array(v), 1, 1, T.RGBAFormat, T.FloatType);
        t.needsUpdate = true;
        return t;
      },
      white = tex([1, 1, 1, 1]),
      normal = tex([0.5, 0.5, 1, 1]);
    const pass = new ParticleDistortionPass(),
      m = createParticleDistortionMaterial({ texture: white, lookup: white, normal });
    m.depthTest = false;
    const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), m);
    pass.scene.add(mesh);
    const cases = [];
    let disposed = 0;
    for (const [ratio, width, height] of [
      [1, 80, 40],
      [2, 80, 40],
      [2, 60, 30],
    ]) {
      r.setPixelRatio(ratio);
      r.setSize(width, height);
      r.render(s, c);
      const gl = r.getContext(),
        before = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        before
      );
      r.setViewport(10, 5, width - 20, height - 10);
      pass.render(r, c);
      pass.frame!.addEventListener('dispose', () => disposed++);
      const after = new Uint8Array(before.length);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        after
      );
      let delta = 0;
      for (let i = 0; i < after.length; i++)
        delta = Math.max(delta, Math.abs(after[i] - before[i]));
      cases.push({
        ratio,
        width: pass.frame!.image.width,
        height: pass.frame!.image.height,
        delta,
        rect: m.uniforms.screenRect.value.toArray(),
      });
    }
    pass.dispose();
    mesh.geometry.dispose();
    m.dispose();
    white.dispose();
    normal.dispose();
    bg.geometry.dispose();
    bg.material.dispose();
    r.dispose();
    return { cases, disposed };
  });
  expect(result.cases.every((c) => c.delta <= 1)).toBe(true);
  expect(result.cases.map((c) => [c.width, c.height])).toEqual([
    [80, 40],
    [160, 80],
    [120, 60],
  ]);
  expect(result.disposed).toBe(3);
  writeFileSync('artifacts/particle-distortion-copy.json', JSON.stringify(result, null, 2) + '\n');
});

test('the integrated display list recovers actual graphics loss and retires its copy when empty', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'),
      { createParticleDistortionMaterial } = await import('/src/render/particle-distortion.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    v.render(w, 1, v.previousElapsed);
    const pass = v.particleDistortion,
      empty = pass.frame === undefined;
    const tex = (a: number[]) => {
        const t = new T.DataTexture(new Float32Array(a), 1, 1, T.RGBAFormat, T.FloatType);
        t.needsUpdate = true;
        return t;
      },
      white = tex([1, 1, 1, 1]),
      normal = tex([0.5, 0.5, 1, 1]);
    const material = createParticleDistortionMaterial({ texture: white, lookup: white, normal });
    material.uniforms.distortionPower.value = 0;
    material.depthTest = false;
    const mesh = new T.Mesh(new T.PlaneGeometry(3, 3), material);
    mesh.quaternion.copy(v.camera.quaternion);
    mesh.position.set(w.hero.x * 0.01, v.ground(w.hero) + 1.5, w.hero.y * 0.01);
    const gl0 = v.renderer.getContext(),
      baseline = new Uint8Array(gl0.drawingBufferWidth * gl0.drawingBufferHeight * 4);
    gl0.readPixels(
      0,
      0,
      gl0.drawingBufferWidth,
      gl0.drawingBufferHeight,
      gl0.RGBA,
      gl0.UNSIGNED_BYTE,
      baseline
    );
    pass.scene.add(mesh);
    v.render(w, 1, v.previousElapsed);
    const identity = new Uint8Array(baseline.length);
    gl0.readPixels(
      0,
      0,
      gl0.drawingBufferWidth,
      gl0.drawingBufferHeight,
      gl0.RGBA,
      gl0.UNSIGNED_BYTE,
      identity
    );
    let identityMaxDelta = 0;
    for (let i = 0; i < identity.length; i++)
      identityMaxDelta = Math.max(identityMaxDelta, Math.abs(identity[i] - baseline[i]));
    normal.image.data.set([0.8, 0.3, 1, 0.8]);
    normal.needsUpdate = true;
    material.uniforms.distortionPower.value = 0.08;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    (window as any).__DISTORTION__ = {
      pixels,
      mesh,
      white,
      normal,
      saved: w.snapshot(),
      frame: pass.frame,
    };
    return {
      empty,
      allocated: !!pass.frame,
      error: gl.getError(),
      identityMaxDelta,
      format: pass.frame.internalFormat,
      contribution: pixels.reduce(
        (n: number, x: number, i: number) => n + Number(x !== baseline[i]),
        0
      ),
    };
  });
  expect(before.error).toBe(0);
  expect(before.identityMaxDelta).toBeLessThanOrEqual(1);
  expect(before.contribution).toBeGreaterThan(100);
  expect(before.format).toBe('RGB8');
  expect(before).toMatchObject({ empty: true, allocated: true });
  await page.screenshot({
    path: 'artifacts/particle-distortion-integrated.png',
    style: '.modal-backdrop {visibility:hidden!important;}',
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      s = (window as any).__DISTORTION__;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      pixels = new Uint8Array(s.pixels.length);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const different = pixels.reduce(
        (n: number, x: number, i: number) => n + Number(x !== s.pixels[i]),
        0
      ),
      recreated = v.particleDistortion.frame !== s.frame;
    s.mesh.removeFromParent();
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
    s.white.dispose();
    s.normal.dispose();
    v.render(w, 1, v.previousElapsed);
    return {
      different,
      recreated,
      empty: v.particleDistortion.frame === undefined,
      unchanged: w.snapshot() === s.saved,
    };
  });
  expect(after).toEqual({ different: 0, recreated: true, empty: true, unchanged: true });
  expect(errors).toEqual([]);
  writeFileSync(
    'artifacts/particle-distortion-recovery.json',
    JSON.stringify({ before, after }, null, 2) + '\n'
  );
});

test('the copy pass preserves existing scene depth while the material can explicitly disable depth testing', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js'),
      { ParticleDistortionPass } = await import('/src/render/particle-distortion-pass.ts'),
      { createParticleDistortionMaterial } = await import('/src/render/particle-distortion.ts');
    (window as any).__GAME__.setPaused(true);
    const r = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    r.setSize(64, 32);
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.z = 5;
    const bg = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        vertexShader: 'void main(){gl_Position=vec4(position.xy,.5,1.);}',
        fragmentShader:
          'void main(){gl_FragColor=vec4(gl_FragCoord.x/64.,gl_FragCoord.y/32.,.4,1.);}',
      })
    );
    scene.add(bg);
    const occluder = new T.Mesh(
      new T.PlaneGeometry(0.5, 2),
      new T.MeshBasicMaterial({ color: 0xff0000, toneMapped: false })
    );
    occluder.position.z = 1;
    scene.add(occluder);
    const tex = (a: number[]) => {
        const t = new T.DataTexture(new Float32Array(a), 1, 1, T.RGBAFormat, T.FloatType);
        t.needsUpdate = true;
        return t;
      },
      white = tex([1, 1, 1, 1]),
      normal = tex([1, 0.5, 1, 1]);
    const pass = new ParticleDistortionPass(),
      material = createParticleDistortionMaterial({ texture: white, lookup: white, normal });
    material.uniforms.distortionPower.value = 0.35;
    const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
    pass.scene.add(mesh);
    const sample = () => {
      const gl = r.getContext(),
        p = new Uint8Array(4);
      gl.readPixels(32, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return Array.from(p);
    };
    r.render(scene, camera);
    const before = sample();
    pass.render(r, camera);
    const kept = sample();
    r.render(scene, camera);
    material.depthTest = false;
    pass.render(r, camera);
    const through = sample();
    pass.dispose();
    for (const m of [mesh, bg, occluder]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    white.dispose();
    normal.dispose();
    r.dispose();
    return { before, kept, through };
  });
  expect(result.before).toEqual([255, 0, 0, 255]);
  expect(result.kept).toEqual(result.before);
  expect(result.through[1]).toBeGreaterThan(40);
  expect(result.through[2]).toBeGreaterThan(40);
  writeFileSync('artifacts/particle-distortion-depth.json', JSON.stringify(result, null, 2) + '\n');
});
