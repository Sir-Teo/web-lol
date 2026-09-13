import * as THREE from 'three';
import { MAP_HALF, SPAWN } from '../content/map';
import { clamp, lerp, type Vec2 } from '../simulation/math';
import type { Unit } from '../simulation/types';
import type { World } from '../simulation/world';
import { seenFrom } from '../simulation/vision';
import { buildTerrain, SCALE } from './terrain';
import { disposeModel, makeModel, type UnitModel } from './models';

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
  center: Vec2 = { x: -500, y: 375 };
  locked = false;
  zoom = 1;
  width = 1;
  height = 1;
  selected: number | null = null;
  hovered: number | null = null;
  rangeVisible = false;
  models = new Map<number, UnitModel>();
  healthBars = new Map<number, HTMLDivElement>();
  mapTexture: THREE.CanvasTexture;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private projector = new THREE.Vector3();
  private projectileModels = new Map<number, THREE.Group>();
  private selection: THREE.Mesh;
  private hover: THREE.Mesh;
  private range: THREE.LineLoop;
  private aim: THREE.Group;
  private aimLine: THREE.Line;
  private aimPoint: Vec2 | null = null;
  private aimMode: string | null = null;
  private moveMarker: THREE.Group;
  private lastMoveEvent = -1;
  private markerTick = -1000;
  readonly fogCanvas: HTMLCanvasElement;
  private fogMask = document.createElement('canvas');
  private fogPixels = new ImageData(128, 128);
  private fogTexture: THREE.CanvasTexture;
  private lastFogTick = -100;
  private bars: HTMLDivElement;
  private previousElapsed = 0;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'battlefield';
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D battlefield. Right-click to move or attack.'
    );
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.bars = document.createElement('div');
    this.bars.className = 'world-labels';
    host.append(this.bars);
    this.scene.background = new THREE.Color(0x173531);
    this.scene.fog = new THREE.Fog(0x19352e, 65, 110);
    this.scene.add(new THREE.HemisphereLight(0xc5e0e0, 0x374c31, 2.1));
    const sun = new THREE.DirectionalLight(0xffecd0, 2.4);
    sun.position.set(-20, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -45;
    sun.shadow.camera.right = sun.shadow.camera.top = 45;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.mapTexture = buildTerrain(this.scene).mapTexture;
    const ring = (color: number, radius: number) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.035, radius, 64),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.09;
      this.scene.add(mesh);
      return mesh;
    };
    this.selection = ring(0x80e1da, 0.62);
    this.hover = ring(0xf0d68b, 0.64);
    const points = Array.from(
      { length: 96 },
      (_, i) =>
        new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2), 0, Math.sin((i / 96) * Math.PI * 2))
    );
    this.range = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x89dcd8, transparent: true, opacity: 0.55 })
    );
    this.range.position.y = 0.095;
    this.scene.add(this.range);
    this.aim = new THREE.Group();
    this.scene.add(this.aim);
    const aimGeometry = new THREE.BufferGeometry();
    aimGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(35 * 3), 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.aimLine = new THREE.Line(
      aimGeometry,
      new THREE.LineBasicMaterial({ color: 0x93dfdf, transparent: true, opacity: 0.7 })
    );
    this.aimLine.frustumCulled = false;
    this.aim.add(this.aimLine);
    this.moveMarker = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(a - 0.2) * 0.2, 0.11, Math.sin(a - 0.2) * 0.2),
          new THREE.Vector3(Math.cos(a) * 0.38, 0.11, Math.sin(a) * 0.38),
          new THREE.Vector3(Math.cos(a + 0.2) * 0.2, 0.11, Math.sin(a + 0.2) * 0.2),
        ]),
        new THREE.LineBasicMaterial({ color: 0x7cf9b4 })
      );
      this.moveMarker.add(line);
    }
    this.scene.add(this.moveMarker);
    const fountain = ring(0x68cbe0, 2.2);
    fountain.position.set(SPAWN.x * SCALE, 0.08, SPAWN.y * SCALE);
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = this.fogCanvas.height = 256;
    this.fogMask.width = this.fogMask.height = 128;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF * SCALE * 2, MAP_HALF * SCALE * 2),
      new THREE.MeshBasicMaterial({ map: this.fogTexture, transparent: true, depthWrite: false })
    );
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.065;
    fog.renderOrder = 2;
    this.scene.add(fog);
    this.resize();
  }
  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.positionCamera();
  }
  private positionCamera(): void {
    this.center.x = clamp(this.center.x, -MAP_HALF + 500, MAP_HALF - 500);
    this.center.y = clamp(this.center.y, -MAP_HALF + 500, MAP_HALF - 500);
    const x = this.center.x * SCALE,
      z = this.center.y * SCALE;
    this.camera.position.set(x, 34 * this.zoom, z + 27 * this.zoom);
    this.camera.lookAt(x, 0, z);
    this.camera.updateMatrixWorld();
  }
  worldPoint(x: number, y: number): Vec2 | null {
    this.ray.setFromCamera(
      new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2),
      this.camera
    );
    const hit = this.ray.ray.intersectPlane(this.plane, this.projector);
    return hit ? { x: hit.x / SCALE, y: hit.z / SCALE } : null;
  }
  screenPoint(point: Vec2, elevation = 0): { x: number; y: number; visible: boolean } {
    this.projector.set(point.x * SCALE, elevation, point.y * SCALE).project(this.camera);
    return {
      x: (this.projector.x + 1) * 0.5 * this.width,
      y: (1 - this.projector.y) * 0.5 * this.height,
      visible: this.projector.z > -1 && this.projector.z < 1,
    };
  }
  pick(world: World, x: number, y: number): Unit | undefined {
    let target: Unit | undefined,
      best = Infinity;
    for (const u of world.units) {
      if (!world.alive(u) || !world.visible(u)) continue;
      const p = this.screenPoint(u, u.kind === 'turret' ? 1.8 : 0.65);
      const d = Math.hypot(p.x - x, p.y - y);
      const radius = u.kind === 'turret' ? 35 : u.kind === 'champion' ? 26 : 19;
      if (d < radius && d < best) {
        best = d;
        target = u;
      }
    }
    return target;
  }
  setAim(mode: string | null, point: Vec2 | null): void {
    this.aimMode = mode;
    this.aimPoint = point;
  }
  recenter(hero: Unit): void {
    this.center = { x: hero.x, y: hero.y };
    this.positionCamera();
  }
  pan(dx: number, dy: number, dt: number): void {
    if (this.locked) return;
    this.center.x += dx * dt * 1500 * this.zoom;
    this.center.y += dy * dt * 1500 * this.zoom;
  }
  render(world: World, alpha: number, elapsed: number): void {
    const animationDelta = Math.max(0, Math.min(0.1, elapsed - this.previousElapsed));
    this.previousElapsed = elapsed;
    if (this.locked)
      this.center = {
        x: lerp(world.hero.previous.x, world.hero.x, alpha),
        y: lerp(world.hero.previous.y, world.hero.y, alpha),
      };
    this.positionCamera();
    const present = new Set<number>();
    for (const u of world.units) {
      present.add(u.id);
      let model = this.models.get(u.id);
      if (!model) {
        model = makeModel(u);
        this.models.set(u.id, model);
        this.scene.add(model.root);
      }
      const deathDuration = model.actions?.death?.getClip().duration ?? 0.65;
      model.root.visible =
        world.visible(u) &&
        (u.deadAt === null || world.tick - u.deadAt < (deathDuration + 0.2) * 60);
      const x = lerp(u.previous.x, u.x, alpha),
        y = lerp(u.previous.y, u.y, alpha);
      model.root.position.set(x * SCALE, 0, y * SCALE);
      model.root.rotation.y = u.facing;
      model.root.rotation.z =
        u.deadAt === null || model.mixer ? 0 : -Math.min((world.tick - u.deadAt) / 20, Math.PI / 2);
      if (u.kind === 'dummy' || u.kind === 'turret')
        model.root.rotation.y = u.kind === 'dummy' ? 0.3 : 0;
      const moving = Math.hypot(u.x - u.previous.x, u.y - u.previous.y) > 0.01;
      if (model.mixer && model.actions) {
        let clip =
          u.deadAt !== null
            ? 'death'
            : moving
              ? 'run'
              : u.id === world.player.id && world.player.recallEnd !== null
                ? 'channel'
                : 'idle1';
        if (u.releaseTick !== null && u.nextAttackTick !== model.animationAttackTick) {
          model.animationAttackTick = u.nextAttackTick;
          const attack = model.actions.attack1;
          attack.reset();
          attack.setLoop(THREE.LoopOnce, 1);
          attack.clampWhenFinished = true;
          attack.timeScale = attack.getClip().duration / (u.attackPeriod / 60);
          clip = 'attack1';
        } else if (
          !moving &&
          u.deadAt === null &&
          model.animationAttackTick &&
          u.nextAttackTick === model.animationAttackTick &&
          world.tick < model.animationAttackTick
        )
          clip = 'attack1';
        if (model.actions[clip] && clip !== model.actionName) {
          const next = model.actions[clip],
            previous = model.actions[model.actionName ?? 'idle1'];
          next.reset();
          next.setEffectiveWeight(1);
          if (clip === 'death') {
            next.setLoop(THREE.LoopOnce, 1);
            next.clampWhenFinished = true;
          }
          previous?.fadeOut(0.08);
          next.fadeIn(0.08).play();
          model.actionName = clip;
        }
        model.mixer.update(animationDelta);
      }
      if (model.crystal) {
        model.crystal.rotation.y = elapsed * 0.3;
        model.crystal.position.y = 2.9 + Math.sin(elapsed * 2) * 0.07;
      }
      this.updateBar(u, world, { x, y });
    }
    for (const [id, model] of this.models)
      if (!present.has(id)) {
        this.scene.remove(model.root);
        disposeModel(model);
        this.models.delete(id);
        this.healthBars.get(id)?.remove();
        this.healthBars.delete(id);
      }
    this.syncProjectiles(world, alpha);
    const selected = world.unit(this.selected ?? world.player.id);
    this.selection.visible = !!selected && world.alive(selected) && world.visible(selected);
    if (selected) {
      this.selection.position.x = selected.x * SCALE;
      this.selection.position.z = selected.y * SCALE;
      this.selection.scale.setScalar(selected.kind === 'turret' ? 2 : 1);
    }
    const hovered = this.hovered === null ? undefined : world.unit(this.hovered);
    this.hover.visible = !!hovered && world.alive(hovered) && world.visible(hovered);
    if (hovered) {
      this.hover.position.x = hovered.x * SCALE;
      this.hover.position.z = hovered.y * SCALE;
    }
    this.range.visible = this.rangeVisible && world.alive(world.hero);
    this.range.position.set(world.hero.x * SCALE, 0.09, world.hero.y * SCALE);
    this.range.scale.setScalar(world.hero.range * SCALE);
    let move;
    for (let i = world.events.length - 1; i >= 0; i--)
      if (world.events[i].type === 'move' && world.eventVisible(world.events[i])) {
        move = world.events[i];
        break;
      }
    if (move && move.id !== this.lastMoveEvent) {
      this.lastMoveEvent = move.id;
      this.markerTick = move.tick;
      this.moveMarker.position.set(move.x * SCALE, 0, move.y * SCALE);
    }
    this.moveMarker.visible = world.tick - this.markerTick < 30;
    this.moveMarker.scale.setScalar(0.7 + ((world.tick - this.markerTick) / 30) * 0.6);
    this.updateAim(world);
    if (world.tick - this.lastFogTick >= 8) {
      this.updateFog(world);
      this.lastFogTick = world.tick;
    }
    this.renderer.render(this.scene, this.camera);
  }
  private updateBar(u: Unit, world: World, p: Vec2): void {
    let bar = this.healthBars.get(u.id);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = `unit-bar ${u.team} ${u.kind}`;
      bar.dataset.unit = String(u.id);
      bar.innerHTML =
        '<div class="unit-name"></div><div class="unit-hp"><i></i></div><div class="unit-mana"><i></i></div><div class="unit-status"></div>';
      bar.querySelector('.unit-name')!.textContent = u.name;
      this.bars.append(bar);
      this.healthBars.set(u.id, bar);
    }
    const screen = this.screenPoint(
      p,
      this.models.get(u.id)?.barHeight ?? (u.kind === 'turret' ? 4.3 : 1.55)
    );
    bar.hidden = !world.alive(u) || !world.visible(u) || !screen.visible;
    if (bar.hidden) return;
    bar.style.transform = `translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;
    (bar.querySelector('.unit-hp i') as HTMLElement).style.width = `${(u.hp / u.maxHp) * 100}%`;
    (bar.querySelector('.unit-mana i') as HTMLElement).style.width =
      `${(u.mana / (u.maxMana || 1)) * 100}%`;
    bar.querySelector('.unit-status')!.textContent =
      u.stunUntil > world.tick ? 'STUNNED' : u.slowUntil > world.tick ? 'SLOWED' : '';
  }
  private syncProjectiles(world: World, alpha: number): void {
    const active = new Set<number>();
    for (const p of world.projectiles) {
      active.add(p.id);
      let model = this.projectileModels.get(p.id);
      if (!model) {
        model = new THREE.Group();
        const color = p.team === 'blue' ? 0x9aefff : 0xff818d;
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(
            p.type === 'ultimate' ? 0.3 : 0.07,
            p.type === 'ultimate' ? 1.25 : 0.32,
            4
          ),
          material
        );
        tip.rotation.x = Math.PI / 2;
        model.add(tip);
        const trail = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.02,
            p.type === 'ultimate' ? 0.12 : 0.035,
            p.type === 'ultimate' ? 2.5 : 0.85,
            4
          ),
          material
        );
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.55;
        model.add(trail);
        this.scene.add(model);
        this.projectileModels.set(p.id, model);
      }
      model.visible = world.projectileVisible(p);
      model.position.set(
        lerp(p.previous.x, p.x, alpha) * SCALE,
        p.type === 'ultimate' ? 1.2 : 0.9,
        lerp(p.previous.y, p.y, alpha) * SCALE
      );
      model.rotation.y = Math.atan2(p.direction.x, p.direction.y);
    }
    for (const [id, model] of this.projectileModels)
      if (!active.has(id)) {
        this.scene.remove(model);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.projectileModels.delete(id);
      }
  }
  private updateAim(world: World): void {
    this.aim.visible = !!this.aimMode && !!this.aimPoint;
    if (!this.aimMode || !this.aimPoint) return;
    const hero = world.hero,
      dir = Math.atan2(this.aimPoint.y - hero.y, this.aimPoint.x - hero.x);
    const positions = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, 0, 0.1, 0);
    if (this.aimMode === 'w') {
      for (let i = 0; i <= 32; i++) {
        const a = dir - 0.4 + (i / 32) * 0.8;
        positions.setXYZ(i + 1, Math.cos(a) * 12, 0.1, Math.sin(a) * 12);
      }
      positions.setXYZ(34, 0, 0.1, 0);
      this.aimLine.geometry.setDrawRange(0, 35);
    } else {
      const length = this.aimMode === 'd' ? 4 : this.aimMode === 'r' ? 24 : 12;
      positions.setXYZ(1, Math.cos(dir) * length, 0.1, Math.sin(dir) * length);
      this.aimLine.geometry.setDrawRange(0, 2);
    }
    positions.needsUpdate = true;
    this.aim.position.set(hero.x * SCALE, 0, hero.y * SCALE);
  }
  private updateFog(world: World): void {
    // Presentation samples the authoritative query; it never supplies gameplay visibility.
    const sources = world.visionSources(),
      pixels = this.fogPixels.data,
      size = this.fogPixels.width,
      point = { x: 0, y: 0 };
    for (let y = 0; y < size; y++) {
      point.y = ((y + 0.5) / size - 0.5) * MAP_HALF * 2;
      for (let x = 0; x < size; x++) {
        point.x = ((x + 0.5) / size - 0.5) * MAP_HALF * 2;
        const i = (y * size + x) * 4;
        pixels[i] = 5;
        pixels[i + 1] = 17;
        pixels[i + 2] = 18;
        pixels[i + 3] = seenFrom(point, sources) ? 0 : 186;
      }
    }
    this.fogMask.getContext('2d')!.putImageData(this.fogPixels, 0, 0);
    const context = this.fogCanvas.getContext('2d')!;
    context.clearRect(0, 0, 256, 256);
    context.filter = 'blur(1px)';
    context.drawImage(this.fogMask, 0, 0, 256, 256);
    context.filter = 'none';
    this.fogTexture.needsUpdate = true;
  }
}
