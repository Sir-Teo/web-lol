import * as THREE from 'three';
import { MAP_HALF, SPAWN } from '../content/map';
import { clamp, lerp, type Vec2 } from '../simulation/math';
import type { Unit } from '../simulation/types';
import type { World } from '../simulation/world';
import { buildTerrain, SCALE } from './terrain';
import { makeModel, type UnitModel } from './models';

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 180);
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
  private aimPoint: Vec2 | null = null;
  private aimMode: string | null = null;
  private moveMarker: THREE.Group;
  private lastMoveEvent = -1;
  private markerTick = -1000;
  private fogCanvas: HTMLCanvasElement;
  private fogTexture: THREE.CanvasTexture;
  private lastFogTick = -100;
  private bars: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'battlefield';
    this.renderer.domElement.setAttribute('aria-label', '3D battlefield. Right-click to move or attack.');
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.bars = document.createElement('div'); this.bars.className = 'world-labels'; host.append(this.bars);
    this.scene.background = new THREE.Color(0x173531);
    this.scene.fog = new THREE.Fog(0x19352e, 65, 110);
    this.scene.add(new THREE.HemisphereLight(0xc5e0e0, 0x374c31, 2.1));
    const sun = new THREE.DirectionalLight(0xffecd0, 2.4);
    sun.position.set(-20, 40, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -45;
    sun.shadow.camera.right = sun.shadow.camera.top = 45;
    sun.shadow.camera.near = .5; sun.shadow.camera.far = 100;
    sun.shadow.bias = -.001; sun.shadow.normalBias = .04;
    this.scene.add(sun);
    this.mapTexture = buildTerrain(this.scene).mapTexture;
    const ring = (color: number, radius: number) => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - .035, radius, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = .09; this.scene.add(mesh); return mesh;
    };
    this.selection = ring(0x80e1da, .62); this.hover = ring(0xf0d68b, .64);
    const points = Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos(i / 96 * Math.PI * 2), 0, Math.sin(i / 96 * Math.PI * 2)));
    this.range = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x89dcd8, transparent: true, opacity: .55 }));
    this.range.position.y = .095; this.scene.add(this.range);
    this.aim = new THREE.Group(); this.scene.add(this.aim);
    this.moveMarker = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a - .2) * .2, .11, Math.sin(a - .2) * .2),
        new THREE.Vector3(Math.cos(a) * .38, .11, Math.sin(a) * .38),
        new THREE.Vector3(Math.cos(a + .2) * .2, .11, Math.sin(a + .2) * .2),
      ]), new THREE.LineBasicMaterial({ color: 0x7cf9b4 }));
      this.moveMarker.add(line);
    }
    this.scene.add(this.moveMarker);
    const fountain = ring(0x68cbe0, 2.2); fountain.position.set(SPAWN.x * SCALE, .08, SPAWN.y * SCALE);
    this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = this.fogCanvas.height = 256;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * SCALE * 2, MAP_HALF * SCALE * 2), new THREE.MeshBasicMaterial({ map: this.fogTexture, transparent: true, depthWrite: false }));
    fog.rotation.x = -Math.PI / 2; fog.position.y = .065; fog.renderOrder = 2; this.scene.add(fog);
    this.resize();
  }
  resize(): void {
    this.width = window.innerWidth; this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height); this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
    this.positionCamera();
  }
  private positionCamera(): void {
    this.center.x = clamp(this.center.x, -MAP_HALF + 500, MAP_HALF - 500);
    this.center.y = clamp(this.center.y, -MAP_HALF + 500, MAP_HALF - 500);
    const x = this.center.x * SCALE, z = this.center.y * SCALE;
    this.camera.position.set(x, 34 * this.zoom, z + 27 * this.zoom);
    this.camera.lookAt(x, 0, z); this.camera.updateMatrixWorld();
  }
  worldPoint(x: number, y: number): Vec2 | null {
    this.ray.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.projector);
    return hit ? { x: hit.x / SCALE, y: hit.z / SCALE } : null;
  }
  screenPoint(point: Vec2, elevation = 0): { x: number; y: number; visible: boolean } {
    this.projector.set(point.x * SCALE, elevation, point.y * SCALE).project(this.camera);
    return { x: (this.projector.x + 1) * .5 * this.width, y: (1 - this.projector.y) * .5 * this.height, visible: this.projector.z > -1 && this.projector.z < 1 };
  }
  pick(world: World, x: number, y: number): Unit | undefined {
    let target: Unit | undefined, best = Infinity;
    for (const u of world.units) {
      if (!world.alive(u) || !world.visible(u)) continue;
      const p = this.screenPoint(u, u.kind === 'turret' ? 1.8 : .65);
      const d = Math.hypot(p.x - x, p.y - y);
      const radius = u.kind === 'turret' ? 35 : u.kind === 'champion' ? 26 : 19;
      if (d < radius && d < best) { best = d; target = u; }
    }
    return target;
  }
  setAim(mode: string | null, point: Vec2 | null): void { this.aimMode = mode; this.aimPoint = point; }
  recenter(hero: Unit): void { this.center = { x: hero.x, y: hero.y }; this.positionCamera(); }
  pan(dx: number, dy: number, dt: number): void {
    if (this.locked) return;
    this.center.x += dx * dt * 1500 * this.zoom; this.center.y += dy * dt * 1500 * this.zoom;
  }
  render(world: World, alpha: number, elapsed: number): void {
    if (this.locked) this.center = { x: lerp(world.hero.previous.x, world.hero.x, alpha), y: lerp(world.hero.previous.y, world.hero.y, alpha) };
    this.positionCamera();
    const present = new Set<number>();
    for (const u of world.units) {
      present.add(u.id);
      let model = this.models.get(u.id);
      if (!model) { model = makeModel(u); this.models.set(u.id, model); this.scene.add(model.root); }
      model.root.visible = world.visible(u) && (u.deadAt === null || world.tick - u.deadAt < 50);
      const x = lerp(u.previous.x, u.x, alpha), y = lerp(u.previous.y, u.y, alpha);
      model.root.position.set(x * SCALE, 0, y * SCALE);
      model.root.rotation.y = u.facing;
      model.root.rotation.z = u.deadAt === null ? 0 : -Math.min((world.tick - u.deadAt) / 20, Math.PI / 2);
      if (u.kind === 'dummy' || u.kind === 'turret') model.root.rotation.y = u.kind === 'dummy' ? .3 : 0;
      const moving = Math.hypot(u.x - u.previous.x, u.y - u.previous.y) > .01;
      model.limbs.slice(0, 2).forEach((limb, i) => limb.rotation.x = moving ? Math.sin(elapsed * 9 + i * Math.PI) * .45 : 0);
      if (model.weapon) model.weapon.rotation.y = u.releaseTick === null ? 0 : -.6 * (1 - Math.max(0, u.releaseTick - world.tick) / u.windupTicks);
      if (model.cape) model.cape.rotation.x = -.23 + Math.sin(elapsed * (moving ? 8 : 2)) * (moving ? .13 : .035);
      if (model.crystal) { model.crystal.rotation.y = elapsed * .3; model.crystal.position.y = 2.9 + Math.sin(elapsed * 2) * .07; }
      this.updateBar(u, world, { x, y });
    }
    for (const [id, model] of this.models) if (!present.has(id)) {
      this.scene.remove(model.root); model.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      this.models.delete(id); this.healthBars.get(id)?.remove(); this.healthBars.delete(id);
    }
    this.syncProjectiles(world, alpha);
    const selected = world.unit(this.selected ?? world.player.id);
    this.selection.visible = !!selected && world.alive(selected) && world.visible(selected);
    if (selected) { this.selection.position.x = selected.x * SCALE; this.selection.position.z = selected.y * SCALE; this.selection.scale.setScalar(selected.kind === 'turret' ? 2 : 1); }
    const hovered = this.hovered === null ? undefined : world.unit(this.hovered);
    this.hover.visible = !!hovered && world.alive(hovered) && world.visible(hovered);
    if (hovered) { this.hover.position.x = hovered.x * SCALE; this.hover.position.z = hovered.y * SCALE; }
    this.range.visible = this.rangeVisible && world.alive(world.hero);
    this.range.position.set(world.hero.x * SCALE, .09, world.hero.y * SCALE); this.range.scale.setScalar(world.hero.range * SCALE);
    let move;
    for (let i = world.events.length - 1; i >= 0; i--) if (world.events[i].type === 'move') { move = world.events[i]; break; }
    if (move && move.id !== this.lastMoveEvent) {
      this.lastMoveEvent = move.id; this.markerTick = move.tick; this.moveMarker.position.set(move.x * SCALE, 0, move.y * SCALE);
    }
    this.moveMarker.visible = world.tick - this.markerTick < 30;
    this.moveMarker.scale.setScalar(.7 + (world.tick - this.markerTick) / 30 * .6);
    this.updateAim(world);
    if (world.tick - this.lastFogTick >= 8) { this.updateFog(world); this.lastFogTick = world.tick; }
    this.renderer.render(this.scene, this.camera);
  }
  private updateBar(u: Unit, world: World, p: Vec2): void {
    let bar = this.healthBars.get(u.id);
    if (!bar) {
      bar = document.createElement('div'); bar.className = `unit-bar ${u.team} ${u.kind}`;
      bar.dataset.unit = String(u.id);
      bar.innerHTML = '<div class="unit-name"></div><div class="unit-hp"><i></i></div><div class="unit-mana"><i></i></div><div class="unit-status"></div>';
      bar.querySelector('.unit-name')!.textContent = u.name;
      this.bars.append(bar); this.healthBars.set(u.id, bar);
    }
    const screen = this.screenPoint(p, u.kind === 'turret' ? 4.3 : u.kind === 'champion' ? 2.3 : 1.55);
    bar.hidden = !world.alive(u) || !world.visible(u) || !screen.visible;
    bar.style.transform = `translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;
    (bar.querySelector('.unit-hp i') as HTMLElement).style.width = `${u.hp / u.maxHp * 100}%`;
    (bar.querySelector('.unit-mana i') as HTMLElement).style.width = `${u.mana / (u.maxMana || 1) * 100}%`;
    bar.querySelector('.unit-status')!.textContent = u.stunUntil > world.tick ? 'STUNNED' : u.slowUntil > world.tick ? 'SLOWED' : '';
  }
  private syncProjectiles(world: World, alpha: number): void {
    const active = new Set<number>();
    for (const p of world.projectiles) {
      active.add(p.id);
      let model = this.projectileModels.get(p.id);
      if (!model) {
        model = new THREE.Group();
        const color = p.team === 'blue' ? 0x9aefff : 0xff818d;
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95 });
        const tip = new THREE.Mesh(new THREE.ConeGeometry(p.type === 'ultimate' ? .3 : .07, p.type === 'ultimate' ? 1.25 : .32, 4), material);
        tip.rotation.x = Math.PI / 2; model.add(tip);
        const trail = new THREE.Mesh(new THREE.CylinderGeometry(.02, p.type === 'ultimate' ? .12 : .035, p.type === 'ultimate' ? 2.5 : .85, 4), material);
        trail.rotation.x = Math.PI / 2; trail.position.z = -.55; model.add(trail);
        this.scene.add(model); this.projectileModels.set(p.id, model);
      }
      model.position.set(lerp(p.previous.x, p.x, alpha) * SCALE, p.type === 'ultimate' ? 1.2 : .9, lerp(p.previous.y, p.y, alpha) * SCALE);
      model.rotation.y = Math.atan2(p.direction.x, p.direction.y);
    }
    for (const [id, model] of this.projectileModels) if (!active.has(id)) {
      this.scene.remove(model); model.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
      this.projectileModels.delete(id);
    }
  }
  private updateAim(world: World): void {
    this.aim.visible = !!this.aimMode && !!this.aimPoint;
    if (!this.aimMode || !this.aimPoint) return;
    while (this.aim.children.length) {
      const child = this.aim.children[0] as THREE.Line; child.geometry.dispose(); (child.material as THREE.Material).dispose(); this.aim.remove(child);
    }
    const hero = world.hero, dir = Math.atan2(this.aimPoint.y - hero.y, this.aimPoint.x - hero.x);
    const add = (points: THREE.Vector3[]) => this.aim.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x93dfdf, transparent: true, opacity: .7 })));
    if (this.aimMode === 'w') {
      const points = [new THREE.Vector3(0, .1, 0)];
      for (let i = 0; i <= 32; i++) { const a = dir - .4 + i / 32 * .8; points.push(new THREE.Vector3(Math.cos(a) * 12, .1, Math.sin(a) * 12)); }
      points.push(new THREE.Vector3(0, .1, 0)); add(points);
    } else {
      const length = this.aimMode === 'd' ? 4 : this.aimMode === 'r' ? 24 : 12;
      add([new THREE.Vector3(0, .1, 0), new THREE.Vector3(Math.cos(dir) * length, .1, Math.sin(dir) * length)]);
    }
    this.aim.position.set(hero.x * SCALE, 0, hero.y * SCALE);
  }
  private updateFog(world: World): void {
    const c = this.fogCanvas.getContext('2d')!, n = 256;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(5,17,18,.73)'; c.clearRect(0, 0, n, n); c.fillRect(0, 0, n, n);
    c.globalCompositeOperation = 'destination-out';
    const reveal = (p: Vec2, r: number) => {
      const x = (p.x / (MAP_HALF * 2) + .5) * n, y = (p.y / (MAP_HALF * 2) + .5) * n, radius = r / (MAP_HALF * 2) * n;
      const gradient = c.createRadialGradient(x, y, radius * .78, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gradient;
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
    };
    for (const u of world.units) if (u.team === 'blue' && world.alive(u)) reveal(u, u.kind === 'champion' ? 1500 : 1200);
    if (world.reveal && world.reveal.endTick > world.tick) reveal(world.reveal.point, 800);
    this.fogTexture.needsUpdate = true;
  }
}
