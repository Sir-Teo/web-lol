import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page) {
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const leona = w.units.find((u: any) => u.champion === 'leona');
    w.units = [w.hero, leona];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    Object.assign(w.hero, { x: leona.x - 300, y: leona.y });
    w.hero.previous = { x: w.hero.x, y: w.hero.y };
    g.view.zoom = 0.6;
    g.view.recenter(leona);
    g.view.render(w, 1, g.view.previousElapsed);
  });
}

test('Leona source actions, blends and skeletons round trip through actual rendering', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const result = await page.evaluate(async () => {
    const modelPath = '/src/render/models.ts';
    const { disposeModel } = await import(modelPath);
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const leona = w.units.find((u: any) => u.champion === 'leona'),
      s = w.championState(leona.id);
    const target = w.spawn('dummy', 'red', { x: leona.x + 150, y: leona.y });
    target.hp = target.maxHp = 1e6;
    const pose = (world: any) => {
      v.render(world, 1, v.previousElapsed);
      const m = v.models.get(leona.id);
      m.root.updateMatrixWorld(true);
      const bones: number[] = [];
      m.root.traverse((o: any) => {
        if (o.isBone) bones.push(...o.matrixWorld.toArray());
      });
      return {
        rig: m.referenceAsset,
        clip: m.actionName,
        bones,
        actions: Object.entries(m.actions)
          .filter(([, a]: any) => a.getEffectiveWeight() > 0 && a.isScheduled())
          .map(([clip, a]: any) => ({ clip, time: a.time, weight: a.getEffectiveWeight() })),
      };
    };
    const stages: any[] = [];
    const check = (name: string) => {
      const before = pose(w),
        saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      const m = v.models.get(leona.id);
      v.scene.remove(m.root);
      disposeModel(m);
      v.models.delete(leona.id);
      const after = pose(copy);
      stages.push({
        name,
        before,
        samePose: JSON.stringify(before) === JSON.stringify(after),
        exactSave: copy.snapshot() === saved,
      });
      pose(w);
    };
    const cast = (ability: string) => {
      w.enqueue({ type: 'cast', unit: leona.id, ability, point: { x: leona.x + 800, y: leona.y } });
      w.step();
    };
    check('idle');
    w.setOrder(leona, { type: 'move', point: { x: leona.x, y: leona.y + 500 } });
    w.step(6);
    check('run');
    w.setOrder(leona, { type: 'idle' });
    w.step(3);
    check('blend');
    target.x = leona.x + 150;
    target.y = leona.y;
    const swings = new Set<string>();
    for (let i = 0; i < 64 && swings.size < 2; i++) {
      w.setOrder(leona, { type: 'attack', target: target.id });
      w.step();
      const clip = pose(w).clip;
      if (!swings.has(clip)) {
        check(clip);
        swings.add(clip);
      }
      w.setOrder(leona, { type: 'idle' });
      w.step();
    }
    s.inventory = Array(6).fill('agility');
    w.random.state = 1;
    w.setOrder(leona, { type: 'attack', target: target.id });
    w.step();
    check('crit');
    w.setOrder(leona, { type: 'idle' });
    w.step();
    s.inventory = [];
    cast('q');
    w.setOrder(leona, { type: 'attack', target: target.id });
    w.step();
    check('q');
    w.setOrder(leona, { type: 'idle' });
    w.step(60);
    cast('w');
    check('w-cast');
    w.step(60);
    check('w-idle');
    w.setOrder(leona, { type: 'move', point: { x: leona.x, y: leona.y + 500 } });
    w.step(6);
    check('w-run');
    w.setOrder(leona, { type: 'idle' });
    w.step();
    target.x = leona.x + 150;
    target.y = leona.y;
    w.setOrder(leona, { type: 'attack', target: target.id });
    w.step();
    check('w-attack');
    w.setOrder(leona, { type: 'idle' });
    w.step(60);
    cast('e');
    check('e');
    w.step(90);
    cast('r');
    check('r');
    w.step(70);
    w.enqueue({ type: 'recall', unit: leona.id });
    w.step(31);
    check('recall-first');
    w.step(390);
    check('recall-second');
    w.damage(target, leona, 1e6, 'true');
    w.step(10);
    check('death');
    return { stages, swings: [...swings] };
  });
  const expected: Record<string, string> = {
    idle: 'idle1',
    run: 'run',
    blend: 'idle1',
    attack1: 'attack1',
    attack2: 'attack2',
    crit: 'crit',
    q: 'spell1',
    'w-cast': 'spell2',
    'w-idle': 'spell2_idle',
    'w-run': 'spell2_run',
    'w-attack': 'spell2_attack',
    e: 'spell3',
    r: 'spell4',
    'recall-first': 'entry_b4dcde19',
    'recall-second': 'idle3',
    death: 'death',
  };
  writeFileSync(info.outputPath('actions.json'), JSON.stringify({ result, errors }, null, 2));
  expect(result.swings.sort()).toEqual(['attack1', 'attack2']);
  for (const stage of result.stages) {
    expect(stage.before.clip, stage.name).toBe(expected[stage.name]);
    expect(stage.before.rig).toBe('leona-base');
    expect(stage.before.bones).toHaveLength(81 * 16);
    expect(stage.before.bones.every(Number.isFinite)).toBe(true);
    expect(stage.samePose, stage.name).toBe(true);
    expect(stage.exactSave, stage.name).toBe(true);
  }
  expect(result.stages.find((s) => s.name === 'blend').before.actions.length).toBeGreaterThan(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('death.png') });
});

test('all 23 raw clips and blends retain their vertices after runtime pruning and fit the imported bounds', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await open(page);
  const result = await page.evaluate(async () => {
    const path6406 = '/node_modules/three/build/three.module.js';
    const THREE = await import(path6406);
    const path6514 = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
    const { GLTFLoader } = await import(path6514);
    const path6644 = '/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
    const { clone } = await import(path6644);
    const path6770 = '/src/render/constant-bone-tracks.ts';
    const { removeConstantBoneTracks } = await import(path6770);
    const path6895 = '/src/render/animation-bounds.ts';
    const { prepareAnimationBounds } = await import(path6895);
    const gltf = await new GLTFLoader().loadAsync('/assets/models/leona-base.glb');
    prepareAnimationBounds(gltf.scene, gltf.animations);
    const optimized = removeConstantBoneTracks(gltf.scene, gltf.animations);
    const roots = [clone(gltf.scene), clone(gltf.scene)],
      mixers = roots.map((r) => new THREE.AnimationMixer(r));
    const meshes = roots.map((r) => {
      const a: any[] = [];
      r.traverse((o: any) => {
        if (o.isSkinnedMesh) a.push(o);
      });
      return a;
    });
    const clips = [gltf.animations, optimized];
    let vertices = 0,
      maxError = 0,
      outside = 0;
    const samples: any[] = [];
    const sample = (layers: { name: string; fraction: number; weight: number }[]) => {
      for (let i = 0; i < 2; i++) {
        mixers[i].stopAllAction();
        for (const l of layers) {
          const clip = clips[i].find((c: any) => c.name === l.name)!;
          const a = mixers[i]
            .clipAction(clip)
            .reset()
            .setLoop(THREE.LoopOnce, 1)
            .setEffectiveWeight(l.weight)
            .play();
          a.paused = true;
          a.clampWhenFinished = true;
          a.time = clip.duration * l.fraction;
        }
        mixers[i].update(0);
        roots[i].updateMatrixWorld(true);
      }
      const a = new THREE.Vector3(),
        b = new THREE.Vector3();
      for (let m = 0; m < meshes[0].length; m++) {
        const raw = meshes[0][m],
          pruned = meshes[1][m];
        for (let j = 0; j < raw.geometry.attributes.position.count; j++) {
          raw.getVertexPosition(j, a);
          pruned.getVertexPosition(j, b);
          maxError = Math.max(maxError, a.distanceTo(b));
          vertices++;
          if (
            !pruned.userData.animationBounds ||
            !pruned.boundingSphere ||
            b.distanceTo(pruned.boundingSphere.center) > pruned.boundingSphere.radius + 1e-6
          )
            outside++;
        }
      }
      samples.push(layers);
    };
    for (const c of gltf.animations)
      for (let i = 0; i <= 8; i++) sample([{ name: c.name, fraction: i / 8, weight: 1 }]);
    for (const [a, b] of [
      ['idle1', 'run'],
      ['run', 'attack1'],
      ['attack1', 'spell1'],
      ['spell2_idle', 'spell2_run'],
      ['spell2_run', 'spell2_attack'],
      ['spell3', 'death'],
    ])
      for (const t of [0.1, 0.5, 0.9])
        sample([
          { name: a, fraction: 0.3, weight: 1 - t },
          { name: b, fraction: 0.6, weight: t },
        ]);
    return {
      clips: gltf.animations.length,
      samples: samples.length,
      vertices,
      maxError,
      outside,
      tracks: clips.map((cs) => cs.reduce((n: number, c: any) => n + c.tracks.length, 0)),
      bounds: meshes[1].map((m) => ({
        radius: m.boundingSphere?.radius,
        enabled: m.userData.animationBounds,
        culling: m.frustumCulled,
      })),
    };
  });
  writeFileSync(info.outputPath('vertices.json'), JSON.stringify(result, null, 2));
  expect(result.clips).toBe(23);
  expect(result.samples).toBe(225);
  expect(result.vertices).toBeGreaterThan(1000000);
  expect(result.maxError).toBeLessThan(1e-7);
  expect(result.outside).toBe(0);
  expect(result.bounds.every((b) => b.enabled && b.culling && b.radius! > 0)).toBe(true);
});

test('NPC rig pixels survive graphics recovery and private skeleton disposal preserves shared assets', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const u = w.units.find((u: any) => u.champion === 'leona');
    w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
    w.step(70);
  });
  const capture = () =>
    page.evaluate(async () => {
      const g = (window as any).__GAME__,
        v = g.view;
      v.render(g.world, 1, v.previousElapsed);
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
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].join(',');
      const u = g.world.units.find((u: any) => u.champion === 'leona'),
        m = v.models.get(u.id);
      m.root.visible = false;
      v.renderer.render(v.scene, v.camera);
      const hidden = new Uint8Array(pixels.length);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        hidden
      );
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] !== hidden[i] ||
          pixels[i + 1] !== hidden[i + 1] ||
          pixels[i + 2] !== hidden[i + 2]
        )
          changed++;
      m.root.visible = true;
      v.render(g.world, 1, v.previousElapsed);
      return {
        hash,
        changed,
        snapshot: g.world.snapshot(),
        clip: m.actionName,
        error: gl.getError(),
      };
    });
  const before = await capture();
  expect(before.changed).toBeGreaterThan(100);
  expect(before.clip).toBe('spell2_idle');
  expect(before.error).toBe(0);
  await page.screenshot({ path: info.outputPath('eclipse-idle.png') });
  await page.evaluate(async () => {
    const r = (window as any).__GAME__.view.renderer;
    const lost = new Promise((resolve) =>
      r.domElement.addEventListener('webglcontextlost', resolve, { once: true })
    );
    r.forceContextLoss();
    await lost;
  });
  await page.waitForFunction(() => (window as any).__GAME__.hud.graphicsState === 'lost');
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await page.waitForFunction(() => (window as any).__GAME__.hud.graphicsState === null);
  const after = await capture();
  expect(after).toEqual(before);
  const disposal = await page.evaluate(async () => {
    const modelPath = '/src/render/models.ts';
    const { makeModel, disposeModel } = await import(modelPath);
    const g = (window as any).__GAME__,
      u = g.world.units.find((u: any) => u.champion === 'leona');
    const a = makeModel(u),
      b = makeModel(u),
      c = makeModel(u);
    const mesh = (m: any) => {
      let result: any;
      m.root.traverse((o: any) => {
        if (o.isSkinnedMesh) result = o;
      });
      return result;
    };
    const ma = mesh(a),
      mb = mesh(b);
    let skeletons = 0,
      geometries = 0,
      materials = 0;
    ma.skeleton.computeBoneTexture();
    ma.skeleton.boneTexture.addEventListener('dispose', () => skeletons++);
    ma.geometry.addEventListener('dispose', () => geometries++);
    ma.material.addEventListener('dispose', () => materials++);
    const shared = ma.geometry === mb.geometry && ma.material === mb.material;
    const privateBones =
      ma.skeleton !== mb.skeleton &&
      ma.skeleton.bones.every((bone: any, i: number) => bone !== mb.skeleton.bones[i]);
    disposeModel(a);
    const remaining = { skeletons, geometries, materials };
    disposeModel(b);
    disposeModel(c);
    return { shared, privateBones, ...remaining };
  });
  expect(disposal).toEqual({
    shared: true,
    privateBones: true,
    skeletons: 1,
    geometries: 0,
    materials: 0,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('recovery.json'),
    JSON.stringify({ before, after, disposal, errors }, null, 2)
  );
});
