import * as THREE from 'three';
import { FAELIGHT_NODES } from '../content/faelights';
import { DARIUS_KIT, MORGANA_KIT } from '../content/milestone6-champions';
import { RUNE_TIMING } from '../content/runes';
import { isElementalRiftTransformed } from '../simulation/epic-objectives';
import { hasBlackShield } from '../simulation/milestone6-champions';
import type { Vec2 } from '../simulation/math';
import type { World } from '../simulation/world';

const SCALE = 0.01;

function makeCircleLine(
  radiusWorld: number,
  color: number,
  opacity = 0.78,
  segments = 40
): THREE.Line {
  const geo = new THREE.BufferGeometry();
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(a) * radiusWorld * SCALE;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(a) * radiusWorld * SCALE;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

export class Milestone6Visuals {
  private readonly root = new THREE.Group();
  private readonly faelightMeshes = new Map<string, THREE.Group>();
  private readonly missileMeshes = new Map<number, THREE.Group>();
  private readonly poolMeshes = new Map<number, THREE.Group>();
  private readonly cometMeshes = new Map<number, THREE.Group>();
  private readonly unitEffectMeshes = new Map<string, THREE.Object3D>();
  private faelightsInitialized = false;

  constructor(parent: THREE.Scene) {
    this.root.name = 'Milestone6Visuals';
    parent.add(this.root);
  }

  update(world: World, alpha: number, ground: (p: Vec2) => number): void {
    this.syncFaelights(world, ground);
    this.syncMissiles(world, alpha, ground);
    this.syncMorganaPools(world, ground);
    this.syncComets(world, alpha, ground);
    this.syncUnitEffects(world, alpha, ground);
  }

  private syncFaelights(world: World, ground: (p: Vec2) => number): void {
    const enabled = world.battlefield.publicRift === true && world.matchMode === 'lanes';
    if (!enabled) {
      for (const [, g] of this.faelightMeshes) g.visible = false;
      return;
    }
    if (!this.faelightsInitialized) {
      this.faelightsInitialized = true;
      for (const ring of FAELIGHT_NODES) {
        const g = new THREE.Group();
        g.name = `Faelight:${ring.id}`;
        const outer = makeCircleLine(ring.radius, 0x6ef3ff, 0.55, 36);
        const inner = new THREE.Mesh(
          new THREE.RingGeometry((ring.radius - 28) * SCALE, ring.radius * SCALE, 32),
          new THREE.MeshBasicMaterial({
            color: 0x5be8ff,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        inner.rotation.x = -Math.PI / 2;
        g.add(outer, inner);
        const y = ground(ring) + 0.08;
        g.position.set(ring.x * SCALE, y, ring.y * SCALE);
        this.root.add(g);
        this.faelightMeshes.set(ring.id, g);
      }
    }
    const transformed = isElementalRiftTransformed(world);
    for (const ring of FAELIGHT_NODES) {
      const g = this.faelightMeshes.get(ring.id);
      if (!g) continue;
      const available = !ring.elementalOnly || transformed;
      g.visible = available && world.pointVisible(ring, world.hero.team);
      if (!g.visible) continue;
      const occupied = world.units.some(
        (u) => u.kind === 'ward' && world.alive(u) && u.ward?.faelightId === ring.id
      );
      const pulse = occupied ? 1 + Math.sin(world.tick * 0.12) * 0.06 : 1;
      g.scale.setScalar(pulse);
    }
  }

  private syncMissiles(world: World, alpha: number, ground: (p: Vec2) => number): void {
    const active = new Set<number>();
    for (const m of world.m6Missiles ?? []) {
      active.add(m.id);
      let g = this.missileMeshes.get(m.id);
      if (!g) {
        g = new THREE.Group();
        g.name = `M6Missile:${m.kind}`;
        if (m.kind === 'ezreal-q') {
          const spear = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.95, 6),
            new THREE.MeshBasicMaterial({ color: 0x7ef3ff })
          );
          spear.rotation.x = Math.PI / 2;
          g.add(spear);
        } else if (m.kind === 'ezreal-w') {
          const torus = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.055, 8, 20),
            new THREE.MeshBasicMaterial({ color: 0xffd569 })
          );
          torus.rotation.x = Math.PI / 2;
          g.add(torus);
        } else if (m.kind === 'ezreal-r') {
          const arc = new THREE.Mesh(
            new THREE.TorusGeometry(1.15, 0.14, 8, 24, Math.PI),
            new THREE.MeshBasicMaterial({ color: 0xffe07d })
          );
          arc.rotation.x = -Math.PI / 2;
          arc.rotation.z = -Math.PI / 2;
          g.add(arc);
        } else {
          const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 12, 10),
            new THREE.MeshBasicMaterial({ color: 0x8f49eb })
          );
          g.add(orb);
        }
        this.root.add(g);
        this.missileMeshes.set(m.id, g);
      }
      const p = {
        x: m.previous.x + (m.x - m.previous.x) * alpha,
        y: m.previous.y + (m.y - m.previous.y) * alpha,
      };
      g.position.set(p.x * SCALE, ground(p) + 0.95, p.y * SCALE);
      g.rotation.y = Math.atan2(m.direction.x, m.direction.y);
      g.visible = m.team === world.hero.team || world.pointVisible(p, world.hero.team);
    }
    for (const [id, g] of this.missileMeshes) {
      if (!active.has(id)) {
        this.disposeObject(g);
        this.missileMeshes.delete(id);
      }
    }
  }

  private syncMorganaPools(world: World, ground: (p: Vec2) => number): void {
    const active = new Set<number>();
    for (const pool of world.morganaPools ?? []) {
      active.add(pool.id);
      let g = this.poolMeshes.get(pool.id);
      if (!g) {
        g = new THREE.Group();
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(pool.radius * SCALE, 36),
          new THREE.MeshBasicMaterial({
            color: 0x4b1d82,
            transparent: true,
            opacity: 0.36,
            depthWrite: false,
          })
        );
        disc.rotation.x = -Math.PI / 2;
        const rim = makeCircleLine(pool.radius, 0xa864ff, 0.82, 40);
        g.add(disc, rim);
        const p = { x: pool.x, y: pool.y };
        g.position.set(pool.x * SCALE, ground(p) + 0.07, pool.y * SCALE);
        this.root.add(g);
        this.poolMeshes.set(pool.id, g);
      }
      const p = { x: pool.x, y: pool.y };
      g.visible = pool.team === world.hero.team || world.pointVisible(p, world.hero.team);
    }
    for (const [id, g] of this.poolMeshes) {
      if (!active.has(id)) {
        this.disposeObject(g);
        this.poolMeshes.delete(id);
      }
    }
  }

  private syncComets(world: World, alpha: number, ground: (p: Vec2) => number): void {
    const active = new Set<number>();
    for (const c of world.activeComets ?? []) {
      active.add(c.id);
      let g = this.cometMeshes.get(c.id);
      if (!g) {
        g = new THREE.Group();
        const ring = makeCircleLine(RUNE_TIMING.cometRadius, 0x6da6ff, 0.75, 32);
        const meteor = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0x95c5ff })
        );
        meteor.name = 'meteor';
        g.add(ring, meteor);
        this.root.add(g);
        this.cometMeshes.set(c.id, g);
      }
      const span = Math.max(1, c.impactTick - c.launchTick);
      const t = Math.min(1, Math.max(0, (world.tick - 1 + alpha - c.launchTick) / span));
      const p = c.target;
      g.position.set(p.x * SCALE, ground(p) + 0.08, p.y * SCALE);
      const meteor = g.getObjectByName('meteor');
      if (meteor) {
        const ox = (c.origin.x - p.x) * (1 - t) * SCALE;
        const oz = (c.origin.y - p.y) * (1 - t) * SCALE;
        const arc = Math.sin(t * Math.PI) * 3.2 + (1 - t) * 1.4;
        meteor.position.set(ox, arc, oz);
      }
      g.visible = c.team === world.hero.team || world.pointVisible(p, world.hero.team);
    }
    for (const [id, g] of this.cometMeshes) {
      if (!active.has(id)) {
        this.disposeObject(g);
        this.cometMeshes.delete(id);
      }
    }
  }

  private syncUnitEffects(world: World, alpha: number, ground: (p: Vec2) => number): void {
    const active = new Set<string>();
    for (const u of world.units) {
      if (u.kind !== 'champion' || !world.alive(u)) continue;
      const visible = u.team === world.hero.team || world.visible(u, world.hero.team);
      if (!visible) continue;
      const p = {
        x: u.previous.x + (u.x - u.previous.x) * alpha,
        y: u.previous.y + (u.y - u.previous.y) * alpha,
      };
      const st = world.championState(u.id);

      // Darius Q Decimate blade telegraph
      if (
        st?.darius?.qWindupEndTick !== null &&
        st?.darius !== undefined &&
        st.darius.qWindupEndTick > world.tick
      ) {
        const key = `darius-q:${u.id}`;
        active.add(key);
        let g = this.unitEffectMeshes.get(key);
        if (!g) {
          const group = new THREE.Group();
          const outer = makeCircleLine(DARIUS_KIT.q.outerRadius, 0xe84848, 0.88, 40);
          const inner = makeCircleLine(DARIUS_KIT.q.innerRadius, 0xffb39e, 0.55, 32);
          group.add(outer, inner);
          this.root.add(group);
          this.unitEffectMeshes.set(key, group);
          g = group;
        }
        g.position.set(p.x * SCALE, ground(p) + 0.1, p.y * SCALE);
      }

      // Black Shield
      if (hasBlackShield(u, world.tick)) {
        const key = `black-shield:${u.id}`;
        active.add(key);
        let mesh = this.unitEffectMeshes.get(key);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.95, 16, 12),
            new THREE.MeshBasicMaterial({
              color: 0x8b46ff,
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
            })
          );
          this.root.add(mesh);
          this.unitEffectMeshes.set(key, mesh);
        }
        mesh.position.set(p.x * SCALE, ground(p) + 1.05, p.y * SCALE);
      }

      // Zhonya's Stasis
      if ((st?.itemState?.stasisUntilTick ?? 0) > world.tick) {
        const key = `stasis:${u.id}`;
        active.add(key);
        let mesh = this.unitEffectMeshes.get(key);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.65, 0.8, 2.1, 14),
            new THREE.MeshBasicMaterial({
              color: 0xffd45c,
              transparent: true,
              opacity: 0.48,
              depthWrite: false,
            })
          );
          this.root.add(mesh);
          this.unitEffectMeshes.set(key, mesh);
        }
        mesh.position.set(p.x * SCALE, ground(p) + 1.05, p.y * SCALE);
      }

      // Morgana R Soul Shackles tethers
      if (st?.morgana?.shackles) {
        const ringKey = `morgana-r-ring:${u.id}`;
        active.add(ringKey);
        let ring = this.unitEffectMeshes.get(ringKey);
        if (!ring) {
          ring = makeCircleLine(MORGANA_KIT.r.breakRadius, 0xb16bff, 0.5, 40);
          this.root.add(ring);
          this.unitEffectMeshes.set(ringKey, ring);
        }
        ring.position.set(p.x * SCALE, ground(p) + 0.1, p.y * SCALE);
        for (const tid of st.morgana.shackles.targetIds) {
          const foe = world.unit(tid);
          if (!foe || !world.alive(foe)) continue;
          const lineKey = `morgana-r-chain:${u.id}:${tid}`;
          active.add(lineKey);
          let line = this.unitEffectMeshes.get(lineKey) as THREE.Line | undefined;
          if (!line) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            line = new THREE.Line(
              geo,
              new THREE.LineBasicMaterial({ color: 0xc57aff, transparent: true, opacity: 0.9 })
            );
            line.frustumCulled = false;
            this.root.add(line);
            this.unitEffectMeshes.set(lineKey, line);
          }
          const fp = {
            x: foe.previous.x + (foe.x - foe.previous.x) * alpha,
            y: foe.previous.y + (foe.y - foe.previous.y) * alpha,
          };
          const pos = line.geometry.attributes.position as THREE.BufferAttribute;
          pos.setXYZ(0, p.x * SCALE, ground(p) + 1.0, p.y * SCALE);
          pos.setXYZ(1, fp.x * SCALE, ground(fp) + 1.0, fp.y * SCALE);
          pos.needsUpdate = true;
        }
      }
    }

    for (const [key, obj] of this.unitEffectMeshes) {
      if (!active.has(key)) {
        this.disposeObject(obj);
        this.unitEffectMeshes.delete(key);
      }
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    this.root.remove(obj);
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  dispose(): void {
    for (const [, g] of this.faelightMeshes) this.disposeObject(g);
    for (const [, g] of this.missileMeshes) this.disposeObject(g);
    for (const [, g] of this.poolMeshes) this.disposeObject(g);
    for (const [, g] of this.cometMeshes) this.disposeObject(g);
    for (const [, g] of this.unitEffectMeshes) this.disposeObject(g);
    this.faelightMeshes.clear();
    this.missileMeshes.clear();
    this.poolMeshes.clear();
    this.cometMeshes.clear();
    this.unitEffectMeshes.clear();
    this.root.removeFromParent();
  }
}
