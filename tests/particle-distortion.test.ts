import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import pin from '../docs/reference/particle-distortion-shaders.json';
import { createParticleDistortionMaterial } from '../src/render/particle-distortion';
import { ParticleDistortionPass } from '../src/render/particle-distortion-pass';
const hash = (x: Buffer) => createHash('sha256').update(x).digest('hex');

test('all fifteen native variants retain exact original libraries, wrapper bitcode and static disassembly identities', () => {
  expect(pin.programs).toHaveLength(15);
  expect(new Set(pin.programs.map((p) => p.table)).size).toBe(4);
  for (const p of pin.programs) {
    const original = readFileSync(p.metallib.path),
      bc = readFileSync(p.bitcode.path);
    expect(hash(original)).toBe(p.metallib.sha256);
    expect(hash(bc)).toBe(p.bitcode.sha256);
    expect(original.subarray(p.bitcode.offset, p.bitcode.offset + p.bitcode.bytes)).toEqual(bc);
    expect(hash(readFileSync(p.disassembly.path))).toBe(p.disassembly.sha256);
  }
  const quad = pin.programs.filter((p) => p.table.endsWith('/distortion_ps.ps-metal'));
  expect(quad.map((p) => p.defines)).toEqual([
    [{}],
    [{ ALPHA_TEST: '1' }],
    [{ COLORPALETTE_COLORBLIND: '1' }],
    [{ ALPHA_TEST: '1', COLORPALETTE_COLORBLIND: '1' }],
  ]);
  const ir = readFileSync(quad[0].disassembly.path, 'utf8');
  for (const symbol of [
    'SAMPLER_BACK_BUFFER_COPY_SharedTexture',
    'DistortionPower',
    'PARTICLE_COLOR_TEXTURE_TX',
    'NORMAL_MAP_TX',
  ])
    expect(ir).toContain(symbol);
  expect(pin.limits.join(' ')).toContain('No native Metal shader or game client was executed');
});

test('source material keeps normal alpha independent of tint/base and borrows its images', () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  texture.addEventListener('dispose', () => disposed++);
  const material = createParticleDistortionMaterial({
    texture,
    normal: texture,
    lookup: texture,
    coordinates: 'vertex',
    alphaTest: true,
    vertexTint: true,
  });
  expect(material.defines).toEqual({ VERTEX_LOOKUP: 1, SOURCE_ALPHA_TEST: 1, VERTEX_TINT: 1 });
  expect(material.depthWrite).toBe(false);
  expect(material.blending).toBe(THREE.NormalBlending);
  expect(material.toneMapped).toBe(false);
  expect(material.forceSinglePass).toBe(true);
  material.dispose();
  expect(disposed).toBe(0);
  texture.dispose();
});

test('copy pass allocates only for visible effects, preserves renderer state on failure and releases resized copies', () => {
  const pass = new ParticleDistortionPass(),
    camera = new THREE.PerspectiveCamera();
  let width = 100,
    copies = 0,
    draws = 0,
    fail = false,
    disposed = 0;
  const renderer: any = {
    autoClear: true,
    shadowMap: { autoUpdate: true },
    info: { autoReset: true },
    getContext: () => ({
      isContextLost: () => false,
      getContextAttributes: () => ({ alpha: true }),
    }),
    getRenderTarget: () => null,
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(width, 50),
    getCurrentViewport: (v: THREE.Vector4) => v.set(10, 5, 80, 40),
    copyFramebufferToTexture: () => copies++,
    render: () => {
      draws++;
      expect(renderer.autoClear).toBe(false);
      expect(renderer.info.autoReset).toBe(false);
      if (fail) throw Error('draw failed');
    },
  };
  expect(pass.render(renderer, camera)).toBe(false);
  expect(pass.frame).toBeUndefined();
  const t = new THREE.Texture(),
    material = createParticleDistortionMaterial({ texture: t, lookup: t, normal: t });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  pass.scene.add(mesh);
  mesh.visible = false;
  expect(pass.render(renderer, camera)).toBe(false);
  mesh.visible = true;
  expect(pass.render(renderer, camera)).toBe(true);
  expect(copies).toBe(1);
  expect(draws).toBe(1);
  expect(material.uniforms.screenRect.value.toArray()).toEqual([0.1, 0.1, 0.8, 0.8]);
  expect(pass.frame!.minFilter).toBe(THREE.LinearFilter);
  expect(pass.frame!.colorSpace).toBe(THREE.NoColorSpace);
  pass.frame!.addEventListener('dispose', () => disposed++);
  width = 200;
  pass.render(renderer, camera);
  expect(disposed).toBe(1);
  pass.frame!.addEventListener('dispose', () => disposed++);
  fail = true;
  expect(() => pass.render(renderer, camera)).toThrow('draw failed');
  expect(renderer.autoClear && renderer.shadowMap.autoUpdate && renderer.info.autoReset).toBe(true);
  mesh.removeFromParent();
  expect(pass.render(renderer, camera)).toBe(false);
  expect(disposed).toBe(2);
  pass.dispose();
  expect(pass.frame).toBeUndefined();
  pass.scene.add(mesh);
  renderer.getRenderTarget = () => ({});
  expect(() => pass.render(renderer, camera)).toThrow(/canvas/);
  expect(pass.frame).toBeUndefined();
  mesh.geometry.dispose();
  material.dispose();
  t.dispose();
});
