import * as THREE from 'three';
import { LuxImpactSparkCloud } from '../../src/render/lux-impact-spark-cloud';
import profiles from '../../src/content/lux-impact-rings.json';
import { luxImpactRings } from '../../src/render/lux-impact-rings';
import { particleAtlasUv } from '../../src/render/particle-atlas';
import { createParticleColorProductMaterial } from '../../src/render/particle-color-product';
const textures = new Map<string, THREE.Texture>();
await Promise.all(
  [...new Set(profiles.flatMap((p) => [p.source, ...(p.lookup ? [p.lookup] : [])]))].map(
    async (path) => {
      const t = await new THREE.TextureLoader().loadAsync('/' + path);
      t.flipY = false;
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      textures.set(path, t);
    }
  )
);
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setSize(1000, 500, false);
const camera = new THREE.OrthographicCamera(-5, 5, 2.5, -2.5, 0.1, 50);
camera.position.z = 10;
const scene = new THREE.Scene();
const sparkTextures = await Promise.all(
  ['lux_base_r_spark', 'flame_trail_gradient'].map(async (name) => {
    const t = await new THREE.TextureLoader().loadAsync(`/assets/effects/lux-hit-${name}.png`);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    return t;
  })
);
const sparks = [-2.5, 2.5].map((x) => {
  const cloud = new LuxImpactSparkCloud(sparkTextures[0], sparkTextures[1], white);
  cloud.mesh.position.x = x;
  scene.add(cloud.mesh);
  return cloud;
});
const variants = [false, true].map((critical) =>
  profiles
    .filter((p) => critical || !p.criticalOnly)
    .map((p) => {
      const g = new THREE.PlaneGeometry(2, 2),
        uv = g.getAttribute('uv');
      for (let i = 0; i < 4; i++)
        uv.setXY(
          i,
          ...particleAtlasUv(p.atlas[0], p.atlas[1], p.atlas[2], i % 2, Math.floor(i / 2))
        );
      const m = createParticleColorProductMaterial(
        textures.get(p.source)!,
        p.lookup ? textures.get(p.lookup)! : white
      );
      m.transparent = true;
      m.blending = THREE.CustomBlending;
      m.blendEquation = THREE.AddEquation;
      m.blendSrc = p.blend === 4 ? THREE.SrcAlphaFactor : THREE.OneFactor;
      m.blendDst = THREE.OneFactor;
      const mesh = new THREE.Mesh(g, m);
      mesh.position.x = critical ? 2.5 : -2.5;
      scene.add(mesh);
      return { p, mesh };
    })
);
const age = document.querySelector<HTMLInputElement>('#age')!,
  chance = document.querySelector<HTMLInputElement>('#chance')!,
  play = document.querySelector<HTMLButtonElement>('#play')!;
let playing = false;
function draw() {
  const states = [false, true].map((c) =>
    luxImpactRings(Number(age.value), c, Number(chance.value))
  );
  variants.forEach((list, i) =>
    list.forEach(({ p, mesh }) => {
      const state = states[i].find((s) => s.name === p.name);
      mesh.visible = !!state;
      if (!state) return;
      mesh.scale.setScalar(state.size * 0.01);
      mesh.rotation.z = (-state.rotation * Math.PI) / 180;
      const [r, g, b, a] = state.color;
      mesh.material.uniforms.particleColor.value.set(
        ...((p.blend === 0 ? [r * a, g * a, b * a, 1] : [r, g, b, a]) as [
          number,
          number,
          number,
          number,
        ])
      );
      mesh.material.uniforms.lookupUv.value.fromArray(state.lookup);
    })
  );
  const seed = Number(document.querySelector<HTMLInputElement>('#seed')!.value);
  const sparkStates = sparks.map((cloud) => cloud.draw(seed, Number(age.value), camera));
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent =
    `${Number(age.value).toFixed(3)} s · normal ${states[0].length} layers · critical ${states[1].length} layers · ${sparkStates[0].length} sparks per hit`;
  return { rings: states, sparks: sparkStates };
}
age.addEventListener('input', () => {
  playing = false;
  play.textContent = 'Play at 0.25×';
  draw();
});
chance.addEventListener('input', draw);
document.querySelector('#seed')!.addEventListener('input', draw);
play.addEventListener('click', () => {
  playing = !playing;
  if (playing && Number(age.value) >= 0.55) age.value = '0';
  play.textContent = playing ? 'Pause' : 'Play at 0.25×';
});
let previous = performance.now();
function frame(now: number) {
  const dt = (now - previous) / 1000;
  previous = now;
  if (playing) {
    age.value = String(Math.min(0.55, Number(age.value) + dt * 0.25));
    if (Number(age.value) >= 0.55) {
      playing = false;
      play.textContent = 'Play at 0.25×';
    }
    draw();
  }
  requestAnimationFrame(frame);
}
draw();
requestAnimationFrame(frame);
(window as any).__LUX_IMPACT_RINGS__ = { ready: true, state: draw };
