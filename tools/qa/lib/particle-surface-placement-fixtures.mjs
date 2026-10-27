/** Captured-source placement fixtures shared by Node and browser QA. */
import * as THREE from 'three';
export function placementFixtures(before, after, options = {}) {
  const textures = new Map(),
    textureNames = new Map();
  for (const path of ['', ...before.data.textures.map((t) => t.url)]) {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    textures.set(path, t);
    textureNames.set(t, path);
  }
  const fallbackAssets = {
    texture: (path) => {
      if (!textures.has(path)) throw Error('Missing placement texture');
      return textures.get(path);
    },
    mesh: () => {
      throw Error('Unexpected mesh');
    },
  };
  function freeze(x) {
    if (x && typeof x === 'object') {
      Object.freeze(x);
      for (const v of Object.values(x)) freeze(v);
    }
    return x;
  }
  const assets = options.assets ?? fallbackAssets;
  const fixtures = [];
  let count = 0;
  for (const kind of ['attack1', 'attack2', 'crit'])
    for (const time of [0.05, 0.15, 0.4, 0.8])
      for (const view of [0, 1, 2])
        for (const customTint of [false, true]) {
          const particles = before.primaryHitParticles(91, time, kind, 30),
            camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
          camera.position.set(
            ...[
              [10, 20, 30],
              [-30, 4, 8],
              [0, 35, -15],
            ][view]
          );
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          const group = { key: 'fixture', startTick: 0, stopTick: 100, radius: 30, seed: 91 },
            world = {
              tick: time * 60 + 1,
              winner: null,
              pointVisible: () => true,
              battlefield: { lineWalkable: () => true },
            },
            program = {
              name: 'placement',
              attachment: 'fixture',
              profiles: before.data.profiles,
              assets: () => assets,
              accepts: () => true,
              records: () => [{ sourceId: 1, castTick: 0, group }],
              particles: () => particles,
              birthVisible: () => true,
              pose: (_g, tick) => ({ x: 100 + tick * 3, y: 200 - tick, facing: 0.2 + tick * 0.01 }),
              ...(customTint ? { tint: (_index, color) => color } : {}),
            };
          const a = new before.SourceParticleSurfaces(
              new THREE.Scene(),
              new THREE.Scene(),
              () => 0.5,
              program,
              assets
            ),
            b = new after.SourceParticleSurfaces(
              new THREE.Scene(),
              new THREE.Scene(),
              () => 0.5,
              program,
              assets
            );
          if (options.freezeInputs) freeze(particles);
          fixtures.push({ a, b, world, camera, particles });
          count += particles.length;
        }
  function uniform(x) {
    if (x?.isTexture) return { texture: textureNames.get(x) ?? x.uuid };
    if (x?.toArray) return x.toArray();
    if (Array.isArray(x)) return x.map(uniform);
    return x;
  }
  function snapshot(surface) {
    return [...surface.models].map(([key, m]) => {
      m.updateWorldMatrix(true, false);
      return {
        key,
        position: m.position.toArray(),
        quaternion: m.quaternion.toArray(),
        scale: m.scale.toArray(),
        matrix: m.matrixWorld.toArray(),
        visible: m.visible,
        renderOrder: m.renderOrder,
        uniforms: Object.fromEntries(
          Object.entries(m.material.uniforms).map(([k, u]) => [k, uniform(u.value)])
        ),
        positionData: Array.from(m.geometry.getAttribute('position').array),
        uvData: Array.from(m.geometry.getAttribute('uv').array),
        userData: m.userData,
      };
    });
  }
  const particleInputs = structuredClone(fixtures.map((f) => f.particles));

  function same(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key, index) => key === Object.keys(b)[index] && same(a[key], b[key]))
    );
  }
  return {
    fixtures,
    particleCount: count,
    snapshot,
    inputsUnchanged: () =>
      same(
        fixtures.map((f) => f.particles),
        particleInputs
      ),
    dispose() {
      for (const f of fixtures) {
        f.a.dispose();
        f.b.dispose();
      }
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
