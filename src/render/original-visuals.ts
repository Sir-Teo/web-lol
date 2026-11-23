import * as THREE from 'three';
import {
  isOriginalChampion,
  ORIGINAL_EFFECT_TICKS,
  ORIGINAL_LINEUP,
  type OriginalSpell,
} from '../content/original-lineup';
import { ORIGINAL_RING_INNER, type OriginalCast } from '../simulation/original-champions';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';

const SCALE = 0.01;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function circle(point: Vec2, radius: number) {
  return Array.from({ length: 33 }, (_, i) => ({
    x: point.x + Math.cos((i * Math.PI) / 16) * radius,
    y: point.y + Math.sin((i * Math.PI) / 16) * radius,
  }));
}

export function originalAimOutline(spell: OriginalSpell, origin: Vec2, point: Vec2) {
  if (spell.shape !== 'line')
    return {
      outline: circle(point, spell.radius),
      inner: spell.shape === 'ring' ? circle(point, spell.radius * ORIGINAL_RING_INNER) : [],
    };
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  const side = { x: -Math.sin(angle) * spell.radius, y: Math.cos(angle) * spell.radius };
  return {
    outline: [
      { x: origin.x + side.x, y: origin.y + side.y },
      { x: point.x + side.x, y: point.y + side.y },
      { x: point.x - side.x, y: point.y - side.y },
      { x: origin.x - side.x, y: origin.y - side.y },
      { x: origin.x + side.x, y: origin.y + side.y },
    ],
    inner: [],
  };
}

interface Effect {
  group: THREE.Group;
  outline: THREE.Line;
  inner: THREE.Line;
  fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  light: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export class OriginalVisuals {
  private effects = new Map<string, Effect>();
  private readonly disk = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private readonly band = new THREE.RingGeometry(ORIGINAL_RING_INNER, 1, 40).rotateX(-Math.PI / 2);
  private readonly strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly shard = new THREE.OctahedronGeometry(1);

  constructor(private readonly scene: THREE.Scene) {}

  private line(color: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(99), 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
      })
    );
    line.frustumCulled = false;
    line.renderOrder = 4;
    return line;
  }

  private create(spell: OriginalSpell, enemy: boolean, tint: number): Effect {
    const group = new THREE.Group();
    group.name = 'original-spell';
    const outline = this.line(enemy ? 0xff775a : tint);
    const inner = this.line(enemy ? 0xff775a : tint);
    const fill = new THREE.Mesh(
      spell.shape === 'line' ? this.strip : spell.shape === 'ring' ? this.band : this.disk,
      new THREE.MeshBasicMaterial({
        color: enemy ? 0xfe5630 : tint,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const light = new THREE.Mesh(
      this.shard,
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fill.renderOrder = 3;
    light.renderOrder = 5;
    group.add(fill, outline, inner, light);
    this.scene.add(group);
    return { group, outline, inner, fill, light };
  }

  private writeLine(line: THREE.Line, points: Vec2[], ground: (point: Vec2) => number) {
    const attribute = line.geometry.getAttribute('position');
    points.forEach((point, i) =>
      attribute.setXYZ(i, point.x * SCALE, ground(point) + 0.16, point.y * SCALE)
    );
    line.geometry.setDrawRange(0, points.length);
    attribute.needsUpdate = true;
  }

  private updateEffect(
    effect: Effect,
    spell: OriginalSpell,
    cast: OriginalCast,
    tick: number,
    ground: (point: Vec2) => number
  ) {
    const warning = cast.phase === 'windup';
    const progress = Math.min(
      1,
      warning
        ? (tick - cast.startTick) / (cast.releaseTick - cast.startTick)
        : (tick - cast.releaseTick) / ORIGINAL_EFFECT_TICKS
    );
    const fade = warning ? 1 : 1 - progress;
    const { outline, inner } = originalAimOutline(spell, cast.origin, cast.point);
    this.writeLine(effect.outline, outline, ground);
    this.writeLine(effect.inner, inner, ground);
    (effect.outline.material as THREE.LineBasicMaterial).opacity = fade * (warning ? 0.82 : 0.64);
    (effect.inner.material as THREE.LineBasicMaterial).opacity = fade * 0.58;
    effect.fill.material.opacity = fade * (warning ? 0.08 + 0.12 * progress : 0.3);
    const radius = spell.radius * SCALE;
    const center =
      spell.shape === 'line'
        ? { x: (cast.origin.x + cast.point.x) / 2, y: (cast.origin.y + cast.point.y) / 2 }
        : cast.point;
    effect.fill.position.set(center.x * SCALE, ground(center) + 0.12, center.y * SCALE);
    if (spell.shape === 'line') {
      const dx = cast.point.x - cast.origin.x;
      const dy = cast.point.y - cast.origin.y;
      effect.fill.scale.set(Math.hypot(dx, dy) * SCALE, 1, radius * 2);
      effect.fill.quaternion.setFromAxisAngle(Y_AXIS, -Math.atan2(dy, dx));
    } else effect.fill.scale.set(radius, 1, radius);
    effect.light.visible = !warning;
    effect.light.position.set(
      cast.point.x * SCALE,
      ground(cast.point) + 0.7 + progress * 2,
      cast.point.y * SCALE
    );
    effect.light.rotation.y = progress * Math.PI;
    effect.light.scale.set(
      radius * (0.25 + progress * 0.4),
      radius * fade * 1.5,
      radius * (0.25 + progress * 0.4)
    );
    effect.light.material.opacity = fade * 0.7;
  }

  update(world: World, alpha: number, ground: (point: Vec2) => number) {
    const seen = new Set<string>();
    for (const unit of world.units) {
      if (!isOriginalChampion(unit.champion)) continue;
      const definition = ORIGINAL_LINEUP[unit.champion];
      const owner = world.championState(unit.id);
      for (const cast of owner?.original?.casts ?? []) {
        if (cast.phase === 'cancelled' || (world.winner && cast.phase === 'windup')) continue;
        const spell = definition.spells[cast.slot];
        if (
          unit.team !== 'blue' &&
          !world.pointVisible(spell.shape === 'line' ? cast.origin : cast.point, 'blue')
        )
          continue;
        const id = unit.id + ':' + cast.startTick;
        seen.add(id);
        let effect = this.effects.get(id);
        if (!effect) {
          effect = this.create(spell, unit.team !== 'blue', definition.color);
          this.effects.set(id, effect);
        }
        this.updateEffect(effect, spell, cast, world.tick + alpha, ground);
      }
    }
    for (const [id, effect] of this.effects) {
      if (seen.has(id)) continue;
      this.remove(effect);
      this.effects.delete(id);
    }
  }

  private remove(effect: Effect) {
    this.scene.remove(effect.group);
    effect.outline.geometry.dispose();
    effect.inner.geometry.dispose();
    (effect.outline.material as THREE.Material).dispose();
    (effect.inner.material as THREE.Material).dispose();
    effect.fill.material.dispose();
    effect.light.material.dispose();
  }

  dispose() {
    this.effects.forEach((effect) => this.remove(effect));
    this.effects.clear();
    for (const geometry of [this.disk, this.band, this.strip, this.shard]) geometry.dispose();
  }
}
