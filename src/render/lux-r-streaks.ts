import * as THREE from 'three';
import profile from '../content/lux-r-streaks.json';
import { LUX_R } from '../content/lux-r';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { luxRStreakParticles } from './lux-r-streak-particles';

const textures = new Map<string, THREE.Texture>();
export async function loadLuxRStreakTextures() {
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

export class LuxRStreaks {
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
      depthTest: (profile.miscRenderFlags & 1) === 0,
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
        multScale: { value: new THREE.Vector2().fromArray(profile.render.multScale) },
        mixer: { value: new THREE.Vector4().fromArray(profile.render.erosionMixer) },
        drive: { value: profile.render.erosionDrive },
        rates: {
          value: new THREE.Vector2(1 / profile.render.featherIn, 1 / profile.render.featherOut),
        },
        slice: { value: profile.render.sliceWidth },
      },
      vertexShader: `attribute vec4 particleColor; attribute vec2 particleOffset; varying vec4 tint; varying vec2 at; varying vec2 offset;
        void main(){tint=particleColor;at=uv;offset=particleOffset;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D base; uniform sampler2D mult; uniform sampler2D erosion; uniform vec2 multScale; uniform vec4 mixer; uniform float drive; uniform vec2 rates; uniform float slice; varying vec4 tint; varying vec2 at; varying vec2 offset;
        void main(){vec2 m=fract((at-0.5)*multScale+0.5+offset);vec4 color=texture2D(base,fract(at))*texture2D(mult,m)*tint;
          vec2 e=1.0-abs(mod(at,2.0)-1.0);float value=clamp(dot(texture2D(erosion,e),mixer),0.0,1.0);
          color.a*=clamp((drive-value+slice)*rates.x,0.0,1.0)-clamp((drive-value)*rates.y,0.0,1.0);gl_FragColor=color;}`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = profile.name;
    mesh.renderOrder = profile.pass;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }
  update(world: World, alpha: number, terminalAge = 0) {
    const active = new Set<number>();
    for (const beam of world.luxBeams) {
      const age = (world.tick - beam.startTick + alpha - 1) / 60 + (world.winner ? terminalAge : 0);
      const castStart = beam.startTick - LUX_R.castSeconds * 60;
      const seed =
        beam.sourceId ^
        Math.imul(castStart, 0x9e3779b9) ^
        Math.imul(profile.emitterIndex, 0x85ebca6b);
      const particles = luxRStreakParticles(seed, age);
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
        offset = geometry.getAttribute('particleOffset');
      let vertex = 0;
      for (const p of particles) {
        const center = {
          x: beam.origin.x + across.x * p.position[0] + forward.x * p.position[2],
          y: beam.origin.y + across.y * p.position[0] + forward.y * p.position[2],
        };
        if (beam.team !== 'blue' && !world.pointVisible(center)) continue;
        // Ry(90) Rx(90): the source quad's X points along -Z, Y along +X.
        for (const [x, y] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          const lateral = y * p.halfSize[1],
            along = -x * p.halfSize[0];
          position.setXYZ(
            vertex,
            (center.x + across.x * lateral + forward.x * along) * 0.01,
            this.ground(beam.origin) + 0.18 + p.position[1] * 0.01,
            (center.y + across.y * lateral + forward.y * along) * 0.01
          );
          uv.setXY(vertex, (y + 1) / 2, (1 - x) / 2);
          color.setXYZW(vertex, ...(p.color as [number, number, number, number]));
          offset.setXY(vertex, ...(p.multOffset as [number, number]));
          vertex++;
        }
      }
      if (!vertex) continue;
      for (const attr of [position, uv, color, offset]) attr.needsUpdate = true;
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
