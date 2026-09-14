import * as THREE from 'three';
import profile from '../content/lux-bokeh.json';
import { LUX_R } from '../content/lux-r';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { luxBokehParticles } from './lux-bokeh-particles';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxBokehTextures() {
  await Promise.all(
    [profile.render.texture, profile.render.mult, profile.render.erosion].map(async (path) => {
      const texture = await new THREE.TextureLoader().loadAsync(path);
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textures.set(path, texture);
    })
  );
}

export class LuxBokeh {
  readonly models = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}
  private create() {
    const geometry = new THREE.BufferGeometry();
    for (const [name, size] of [
      ['position', 3],
      ['uv', 2],
      ['particleColor', 4],
      ['particleOffset', 2],
      ['particleCell', 2],
    ] as const)
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(new Float32Array(profile.count * 6 * size), size).setUsage(
          THREE.DynamicDrawUsage
        )
      );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: (profile.render.miscRenderFlags & 1) === 0,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendEquationAlpha: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.SrcAlphaFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: {
        base: { value: textures.get(profile.render.texture) },
        mult: { value: textures.get(profile.render.mult) },
        erosion: { value: textures.get(profile.render.erosion) },
        baseCell: {
          value: new THREE.Vector2(1 / profile.atlas.divisions[0], 1 / profile.atlas.divisions[1]),
        },
        multScale: { value: new THREE.Vector2().fromArray(profile.render.multScale) },
        mixer: { value: new THREE.Vector4().fromArray(profile.render.erosionMixer) },
        drive: { value: profile.render.erosionDrive },
        rates: {
          value: new THREE.Vector2(1 / profile.render.featherIn, 1 / profile.render.featherOut),
        },
        slice: { value: profile.render.sliceWidth },
      },
      vertexShader: `attribute vec4 particleColor; attribute vec2 particleOffset; attribute vec2 particleCell; varying vec4 tint; varying vec2 at; varying vec2 offset; varying vec2 cellOffset;
        void main(){tint=particleColor;at=uv;offset=particleOffset;cellOffset=particleCell;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D base; uniform sampler2D mult; uniform sampler2D erosion; uniform vec2 multScale; uniform vec2 baseCell; uniform vec4 mixer; uniform float drive; uniform vec2 rates; uniform float slice; varying vec4 tint; varying vec2 at; varying vec2 offset; varying vec2 cellOffset;
        void main(){vec2 m=fract((at-0.5)*multScale+0.5+offset);vec4 color=texture2D(base,cellOffset+fract(at)*baseCell)*texture2D(mult,m)*tint;
          vec2 e=1.0-abs(mod(cellOffset+at*baseCell,2.0)-1.0);float value=clamp(dot(texture2D(erosion,e),mixer),0.0,1.0);
          color.a*=clamp((drive-value+slice)*rates.x,0.0,1.0)-clamp((drive-value)*rates.y,0.0,1.0);gl_FragColor=color;}`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = profile.name;
    mesh.renderOrder = profile.render.pass;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const active = new Set<number>();
    for (const beam of world.luxBeams) {
      const age = (world.tick - beam.startTick + alpha - 1) / 60 + (world.winner ? terminalAge : 0);
      const castStart = beam.startTick - LUX_R.castSeconds * 60;
      const seed =
        beam.sourceId ^
        Math.imul(castStart, 0x9e3779b9) ^
        Math.imul(profile.emitterIndex, 0x85ebca6b);
      const particles = luxBokehParticles(seed, age);
      if (!particles.length) continue;
      const dx = beam.point.x - beam.origin.x,
        dy = beam.point.y - beam.origin.y,
        length = Math.hypot(dx, dy);
      if (!length) continue;
      const forward = { x: dx / length, y: dy / length },
        across = { x: -dy / length, y: dx / length };
      let mesh = this.models.get(beam.id);
      if (!mesh) {
        mesh = this.create();
        this.models.set(beam.id, mesh);
      }
      const geometry = mesh.geometry,
        position = geometry.getAttribute('position'),
        uv = geometry.getAttribute('uv'),
        color = geometry.getAttribute('particleColor'),
        offset = geometry.getAttribute('particleOffset'),
        cell = geometry.getAttribute('particleCell');
      let vertex = 0;
      for (const p of particles) {
        const center = {
          x: beam.origin.x + across.x * p.position[0] + forward.x * p.position[2],
          y: beam.origin.y + across.y * p.position[0] + forward.y * p.position[2],
        };
        if (beam.team !== 'blue' && !world.pointVisible(center)) continue;
        // Complex camera quads use negative source X spin, then per-axis size.
        const angle = (-p.rotation * Math.PI) / 180,
          cos = Math.cos(angle),
          sin = Math.sin(angle);
        for (const [x, y] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          const a = (x * cos - y * sin) * p.halfSize[0] * 0.01,
            b = (x * sin + y * cos) * p.halfSize[1] * 0.01;
          position.setXYZ(
            vertex,
            center.x * 0.01 + right.x * a + up.x * b,
            this.ground(beam.origin) + 0.18 + p.position[1] * 0.01 + right.y * a + up.y * b,
            center.y * 0.01 + right.z * a + up.z * b
          );
          uv.setXY(vertex, (x + 1) / 2, (1 - y) / 2);
          cell.setXY(vertex, ...(p.cellOffset as [number, number]));
          color.setXYZW(vertex, ...(p.color as [number, number, number, number]));
          offset.setXY(vertex, ...(p.multOffset as [number, number]));
          vertex++;
        }
      }
      if (!vertex) continue;
      for (const attr of [position, uv, color, offset, cell]) attr.needsUpdate = true;
      geometry.setDrawRange(0, vertex);
      active.add(beam.id);
    }
    for (const [id, mesh] of this.models)
      if (!active.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(id);
      }
  }
}
