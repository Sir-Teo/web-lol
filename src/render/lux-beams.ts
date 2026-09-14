import { luxBeamWidth } from './lux-beam-width';
import * as THREE from 'three';
import { LUX_BEAM_LAYERS } from '../content/lux-beam-layers';
import { LUX_R } from '../content/lux-r';
import { TICK_RATE } from '../content/rules';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { LuxBeam } from '../simulation/types';

interface Curve {
  readonly times: readonly number[];
  readonly values: readonly (readonly number[])[];
}
interface Layer {
  readonly texDiv: readonly number[];
  readonly texDivMult: readonly number[];
  readonly miscRenderFlags: number;
  readonly name: string;
  readonly delay: number;
  readonly life: number;
  readonly blend: number;
  readonly pass: number;
  readonly width: number;
  readonly sourceOffset: readonly number[];
  readonly targetOffset: readonly number[];
  readonly scale: Curve;
  readonly color: { readonly constantValue?: readonly number[]; readonly dynamics?: Curve };
  readonly birthColor: readonly number[];
  readonly texture: string;
  readonly mult: string;
  readonly scroll: readonly number[];
  readonly scrollCurve: { readonly constantValue?: readonly number[]; readonly dynamics?: Curve };
  readonly multScroll: readonly number[];
  readonly multOffset: readonly number[];
  readonly multAddress: number;
}
const layers: readonly Layer[] = LUX_BEAM_LAYERS;
const textures = new Map<string, THREE.Texture>();
export async function loadLuxBeamTextures(): Promise<void> {
  await Promise.all(
    [...new Set(layers.flatMap((layer) => [layer.texture, layer.mult]))].map(async (path) => {
      const texture = await new THREE.TextureLoader().loadAsync(path);
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      textures.set(path, texture);
    })
  );
}
export function sampleBeamCurve(curve: Curve, time: number): number[] {
  if (time <= curve.times[0]) return [...curve.values[0]];
  for (let i = 1; i < curve.times.length; i++)
    if (time <= curve.times[i]) {
      const mix = (time - curve.times[i - 1]) / (curve.times[i] - curve.times[i - 1]);
      return curve.values[i].map(
        (v, j) => curve.values[i - 1][j] + (v - curve.values[i - 1][j]) * mix
      );
    }
  return [...curve.values.at(-1)!];
}
function integratedCurve(curve: Curve, normalized: number, life: number): number[] {
  const knots = [0, ...curve.times.filter((t) => t > 0 && t < normalized), normalized];
  const result = [0, 0];
  for (let i = 1; i < knots.length; i++) {
    const a = sampleBeamCurve(curve, knots[i - 1]),
      b = sampleBeamCurve(curve, knots[i]);
    for (let axis = 0; axis < 2; axis++)
      result[axis] += (a[axis] + b[axis]) * 0.5 * (knots[i] - knots[i - 1]) * life;
  }
  return result;
}
const SEGMENTS = 64;
const SCALE = 0.01;
export class LuxBeams {
  readonly models = new Map<number, THREE.Group>();
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}
  private create(): THREE.Group {
    const group = new THREE.Group();
    for (const layer of layers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(SEGMENTS * 18), 3).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(SEGMENTS * 12), 2).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: (layer.miscRenderFlags & 1) === 0,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: layer.blend === 4 ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.SrcAlphaFactor,
        blendDstAlpha: layer.blend === 4 ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
        uniforms: {
          base: { value: textures.get(layer.texture) },
          mult: { value: textures.get(layer.mult) },
          tint: { value: new THREE.Vector4(1, 1, 1, 1) },
          offset: { value: new THREE.Vector2() },
          multOffset: { value: new THREE.Vector2() },
          baseCell: {
            value: new THREE.Vector2(
              ...(layer.texDiv.map((v) => 1 / Math.max(1, Math.round(v))) as [number, number])
            ),
          },
          multCell: {
            value: new THREE.Vector2(
              ...(layer.texDivMult.map((v) => 1 / Math.max(1, Math.round(v))) as [number, number])
            ),
          },
          clampMult: { value: layer.multAddress === 2 },
        },
        vertexShader:
          'varying vec2 beamUv; void main(){ beamUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        // Source beam transforms act on (along, across), then transpose to (u, v).
        fragmentShader: `uniform sampler2D base; uniform sampler2D mult; uniform vec4 tint; uniform vec2 offset; uniform vec2 multOffset; uniform bool clampMult; uniform vec2 baseCell; uniform vec2 multCell; varying vec2 beamUv;
          void main(){ vec2 m=beamUv+multOffset.yx; m=clampMult ? clamp(m,vec2(0.001),vec2(0.999)) : fract(m); gl_FragColor=texture2D(base,fract(beamUv+offset.yx)*baseCell)*texture2D(mult,m*multCell)*tint;
          }`,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = layer.name;
      mesh.renderOrder = layer.pass;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    this.scene.add(group);
    return group;
  }
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0): void {
    if (textures.size === 0) return;
    const beams: (LuxBeam & { charging?: boolean })[] = [...world.luxBeams];
    for (const source of world.units) {
      const cast = world.championState(source.id)?.pendingCast;
      if (source.champion === 'lux' && cast?.ability === 'r' && cast.origin)
        beams.push({
          id: -source.id,
          sourceId: source.id,
          team: source.team,
          origin: cast.origin,
          point: cast.point,
          startTick: cast.startTick,
          charging: true,
        });
    }
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const active = new Set<number>();
    for (const beam of beams) {
      const sinceStart =
        Math.max(0, world.tick - beam.startTick + alpha - 1) / TICK_RATE +
        (world.winner ? terminalAge : 0) +
        (beam.charging ? 0 : LUX_R.castSeconds);
      if (sinceStart >= Math.max(...layers.map((layer) => layer.delay + layer.life))) continue;
      active.add(beam.id);
      let group = this.models.get(beam.id);
      if (!group) {
        group = this.create();
        this.models.set(beam.id, group);
      }
      const dx = beam.point.x - beam.origin.x,
        dy = beam.point.y - beam.origin.y,
        length = Math.hypot(dx, dy);
      group.visible = false;
      for (let index = 0; index < layers.length; index++) {
        const layer = layers[index],
          age = sinceStart - layer.delay;
        const mesh = group.children[index] as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.ShaderMaterial
        >;
        mesh.visible = age >= 0 && age < layer.life;
        if (!mesh.visible) continue;
        const normalized = age / layer.life;
        const color = layer.color.dynamics
          ? sampleBeamCurve(layer.color.dynamics, normalized)
          : [...(layer.color.constantValue ?? [1, 1, 1, 1])];
        mesh.material.uniforms.tint.value.set(...color.map((v, i) => v * layer.birthColor[i]));
        const scroll = layer.scrollCurve.dynamics
          ? integratedCurve(layer.scrollCurve.dynamics, normalized, layer.life)
          : [0, 0];
        mesh.material.uniforms.offset.value.set(
          layer.scroll[0] * age + scroll[0],
          layer.scroll[1] * age + scroll[1]
        );
        mesh.material.uniforms.multOffset.value.set(
          layer.multOffset[0] + layer.multScroll[0] * age,
          layer.multOffset[1] + layer.multScroll[1] * age
        );
        const width = (layer.width * sampleBeamCurve(layer.scale, normalized)[0]) / 2;
        const start = {
          x: beam.origin.x + (dx / length) * layer.sourceOffset[2],
          y: beam.origin.y + (dy / length) * layer.sourceOffset[2],
        };
        const span = length + layer.targetOffset[2] - layer.sourceOffset[2];
        const spanX = (dx / length) * span,
          spanY = (dy / length) * span;
        const end = { x: start.x + spanX, y: start.y + spanY };
        const sideDirection = luxBeamWidth(
          new THREE.Vector3(start.x * SCALE, this.ground(start) + 0.18, start.y * SCALE),
          new THREE.Vector3(end.x * SCALE, this.ground(end) + 0.18, end.y * SCALE),
          eye
        );
        const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        let vertex = 0;
        for (let i = 0; i < SEGMENTS; i++) {
          const a = {
            x: start.x + (spanX * i) / SEGMENTS,
            y: start.y + (spanY * i) / SEGMENTS,
          };
          const b = {
            x: start.x + (spanX * (i + 1)) / SEGMENTS,
            y: start.y + (spanY * (i + 1)) / SEGMENTS,
          };
          if (beam.team !== 'blue' && (!world.pointVisible(a) || !world.pointVisible(b))) continue;
          for (const [point, side, along] of [
            [a, -1, i],
            [a, 1, i],
            [b, 1, i + 1],
            [a, -1, i],
            [b, 1, i + 1],
            [b, -1, i + 1],
          ] as const) {
            positions.setXYZ(
              vertex,
              point.x * SCALE + sideDirection.x * width * side * SCALE,
              this.ground(point) + 0.18 + sideDirection.y * width * side * SCALE,
              point.y * SCALE + sideDirection.z * width * side * SCALE
            );
            uv.setXY(vertex++, side < 0 ? 0 : 1, along / SEGMENTS);
          }
        }
        positions.needsUpdate = uv.needsUpdate = true;
        mesh.geometry.setDrawRange(0, vertex);
        mesh.visible = vertex > 0 && width > 0;
        group.visible ||= mesh.visible;
      }
    }
    for (const [id, group] of this.models)
      if (!active.has(id)) {
        this.scene.remove(group);
        for (const object of group.children) {
          const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
        this.models.delete(id);
      }
  }
}
