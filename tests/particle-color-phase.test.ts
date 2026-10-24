import { expect, test } from 'vitest';
import * as THREE from 'three';
import {
  particleColorMaterial,
  renderParticleColorPhase,
} from '../src/render/particle-color-phase';
import { ParticleDistortionPass } from '../src/render/particle-distortion-pass';

function fixture(active = true, fail = '') {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(),
    ordinary = new THREE.MeshBasicMaterial(),
    color = particleColorMaterial(new THREE.MeshBasicMaterial()),
    hidden = particleColorMaterial(new THREE.MeshBasicMaterial({ visible: false })),
    geometry = new THREE.PlaneGeometry(),
    actor = new THREE.Mesh(geometry, ordinary),
    particle = new THREE.Mesh(geometry, color),
    background = new THREE.Color('#123456'),
    calls: any[] = [];
  actor.castShadow = true;
  scene.background = background;
  scene.add(actor, particle, new THREE.Mesh(geometry, hidden));
  const renderer = {
    autoClear: true,
    shadowMap: { autoUpdate: true },
    info: { autoReset: true },
    getRenderTarget: () => null,
    render() {
      const phase = color.visible ? (ordinary.visible ? 'all' : 'color') : 'base';
      calls.push({
        phase,
        ordinary: ordinary.visible,
        color: color.visible,
        hidden: hidden.visible,
        clear: renderer.autoClear,
        shadow: renderer.shadowMap.autoUpdate,
        reset: renderer.info.autoReset,
        background: scene.background,
      });
      if (phase === fail) throw Error('injected ' + phase);
    },
  } as unknown as THREE.WebGLRenderer;
  const early = {
    hasDraws: () => active,
    render() {
      calls.push({
        phase: active ? 'early' : 'retire',
        ordinary: ordinary.visible,
        color: color.visible,
        shadow: renderer.shadowMap.autoUpdate,
      });
      if (fail === 'early') throw Error('injected early');
      return active;
    },
  } as unknown as ParticleDistortionPass;
  return {
    scene,
    camera,
    ordinary,
    color,
    hidden,
    geometry,
    actor,
    particle,
    background,
    calls,
    renderer,
    early,
    restore() {
      expect([ordinary.visible, color.visible, hidden.visible]).toEqual([true, true, false]);
      expect(scene.background).toBe(background);
      expect(scene.matrixWorldAutoUpdate).toBe(true);
      expect(renderer.autoClear).toBe(true);
      expect(renderer.shadowMap.autoUpdate).toBe(true);
      expect(renderer.info.autoReset).toBe(true);
      geometry.dispose();
      ordinary.dispose();
      color.dispose();
      hidden.dispose();
    },
  };
}

test('an absent early list preserves a single full scene render and retires its prior copy', () => {
  const f = fixture(false);
  expect(renderParticleColorPhase(f.renderer, f.scene, f.camera, f.early)).toBe(false);
  expect(f.calls.map((c) => c.phase)).toEqual(['all', 'retire']);
  f.restore();
});

test('base capture includes ordinary actor geometry and full shadows, then color preserves its framebuffer/depth', () => {
  const f = fixture();
  expect(renderParticleColorPhase(f.renderer, f.scene, f.camera, f.early)).toBe(true);
  expect(f.calls.map((c) => c.phase)).toEqual(['base', 'early', 'color']);
  expect(f.calls[0]).toMatchObject({
    ordinary: true,
    color: false,
    hidden: false,
    clear: true,
    shadow: true,
    reset: true,
    background: f.background,
  });
  expect(f.calls[1]).toMatchObject({ ordinary: true, color: false, shadow: false });
  expect(f.calls[2]).toMatchObject({
    ordinary: false,
    color: true,
    hidden: false,
    clear: false,
    shadow: false,
    reset: false,
    background: null,
  });
  f.restore();
});

for (const phase of ['base', 'early', 'color'])
  test(`a ${phase} render failure restores borrowed visibility, background and renderer state`, () => {
    const f = fixture(true, phase);
    expect(() => renderParticleColorPhase(f.renderer, f.scene, f.camera, f.early)).toThrow(
      'injected ' + phase
    );
    f.restore();
  });

test('unsupported shadow-casting particle membership fails before suppressing ordinary casters', () => {
  const f = fixture();
  f.particle.castShadow = true;
  expect(() => renderParticleColorPhase(f.renderer, f.scene, f.camera, f.early)).toThrow(
    'non-shadow-casting'
  );
  expect(f.calls).toEqual([]);
  f.restore();
});

test('distortion activity respects layers, hidden materials and empty geometry without allocating a copy', () => {
  const pass = new ParticleDistortionPass(),
    camera = new THREE.Camera(),
    geometry = new THREE.PlaneGeometry(),
    material = new THREE.ShaderMaterial({
      uniforms: { backBuffer: { value: null }, screenRect: { value: new THREE.Vector4() } },
    }),
    mesh = new THREE.Mesh(geometry, material);
  pass.scene.add(mesh);
  expect(pass.hasDraws(camera)).toBe(true);
  mesh.layers.set(2);
  expect(pass.hasDraws(camera)).toBe(false);
  camera.layers.enable(2);
  material.visible = false;
  expect(pass.hasDraws(camera)).toBe(false);
  material.visible = true;
  geometry.setDrawRange(0, 0);
  expect(pass.hasDraws(camera)).toBe(false);
  expect(pass.frame).toBeUndefined();
  geometry.dispose();
  material.dispose();
  pass.dispose();
});
