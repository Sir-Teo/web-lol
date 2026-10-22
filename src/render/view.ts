import { LazyGarenDecisiveStrike } from './lazy-garen-decisive-strike';
import { LuxIlluminationTriggers } from './lux-illumination-triggers';
import { LuxIllumination } from './lux-illumination';
import type { MapTexturePrefetch } from './map-texture-prefetch';
import type { MapTextureResidency } from './map-texture-residency';
import { LuxGroundWarnings } from './lux-ground-warnings';
import { LuxGroundCharge } from './lux-ground-charge';
import { LuxScorches } from './lux-scorches';
import { groundDisplayListSort, setGroundRenderStage } from './ground-display-list';
import { LuxBokeh } from './lux-bokeh';
import { structureModelMatrix } from './structure-transform';
import { structurePose } from './structure-pose';
import { structureAnimationProfile } from '../content/structure-animation';
import { advanceAnimationTimeline, animationLayers } from '../simulation/animation-timeline';
import { mobilePose } from './mobile-pose';
import { LuxImpacts } from './lux-impacts';
import { LuxAttackCrescents } from './lux-attack-crescents';
import { LuxAttackTrails } from './lux-attack-trails';
import { LuxAttackHoops } from './lux-attack-hoops';
import { LUX_BINDING } from '../content/lux-binding';
import { LUX_W } from '../content/lux-w';
import { LUX_R } from '../content/lux-r';
import { LUX_E_SOURCE } from '../content/lux-e';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import * as THREE from 'three';
import { TICK_RATE } from '../content/rules';
import { LuxSingularities } from './lux-singularities';
import { LuxChargeRays } from './lux-charge-rays';
import { LuxRStreaks } from './lux-r-streaks';
import { LuxBeams } from './lux-beams';
import { LUX } from '../content/lux-progression';
import { GAREN } from '../content/garen-progression';
import { GAREN_R } from '../content/garen-r';
import { LazyGarenJustice } from './lazy-garen-justice';
import { LazyGarenCourage } from './lazy-garen-courage';
import { LazyGrompDeath } from './lazy-gromp-death';
import { GarenSpin } from './garen-spin';
import { ASHE_SELECTION } from '../content/ashe-selection';
import { intersectsSelectionCylinder } from './selection-cylinder';
import { flurryFlight } from './flurry-flight';
import { PRACTICE_FIXTURE } from '../content/practice-fixture';
import type { Battlefield } from '../simulation/battlefield';
import { loadRift } from './rift-assets';
import { clamp, lerp, type Vec2 } from '../simulation/math';
import { isStructureKind, type Unit } from '../simulation/types';
import type { World } from '../simulation/world';
import { FogSampler } from './fog-sampler';
import { animateHawkshot, createHawkshot, disposeHawkshot } from './hawkshot';
import {
  createAsheAttackArrow,
  animateAsheAttackArrow,
  disposeAsheAttackArrow,
} from './ashe-attack-arrow';
import { HawkshotWind } from './hawkshot-wind';
import { HawkshotDust } from './hawkshot-dust';
import { HawkshotSmoke } from './hawkshot-smoke';
import { HawkshotArrivals } from './hawkshot-arrival';
import { HawkshotArrivalGlows } from './hawkshot-arrival-glows';
import { HawkshotDarkness } from './hawkshot-darkness';
import { HawkshotRadial } from './hawkshot-radial';
import { HawkshotSparkle } from './hawkshot-sparkle';
import { HawkshotSnow } from './hawkshot-snow';
import { HawkshotLingerAurora } from './hawkshot-linger-aurora';
import { HawkshotEchoes } from './hawkshot-echo';
import { buildTerrain, SCALE } from './terrain';
import { disposeModel, makeModel, type UnitModel } from './models';
import { unitBarHeight } from './unit-bar-height';

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  luxSingularities = new LuxSingularities(this.scene, (p) => this.ground(p));
  luxAttackCrescents = new LuxAttackCrescents(this.scene, (p) => this.ground(p));
  luxAttackTrails = new LuxAttackTrails(this.scene, (p) => this.ground(p));
  luxAttackHoops = new LuxAttackHoops(this.scene, (p) => this.ground(p));
  luxIllumination = new LuxIllumination(this.scene);
  luxIlluminationTriggers = new LuxIlluminationTriggers(this.scene, (p) => this.ground(p));
  luxImpacts = new LuxImpacts(this.scene, (p) => this.ground(p));
  luxChargeRays = new LuxChargeRays(this.scene, (p) => this.ground(p));
  luxGroundWarnings = new LuxGroundWarnings(this.scene);
  luxGroundCharge = new LuxGroundCharge(this.scene);
  luxScorches = new LuxScorches(this.scene);
  luxBokeh = new LuxBokeh(this.scene, (p) => this.ground(p));
  luxStreaks = new LuxRStreaks(this.scene, (p) => this.ground(p));
  luxBeams = new LuxBeams(this.scene, (p) => this.ground(p));
  wind = new HawkshotWind(this.scene, (p) => this.ground(p));
  garenJustice = new LazyGarenJustice(this.scene, (p) => this.ground(p));
  garenDecisiveStrike = new LazyGarenDecisiveStrike(
    this.scene,
    (p) => this.ground(p),
    (id) => this.overheadLabelBounds(id)
  );
  garenCourage = new LazyGarenCourage(this.scene, (p) => this.ground(p));
  grompDeath = new LazyGrompDeath(this.scene);
  garenSpin = new GarenSpin(this.scene, (p) => this.ground(p));
  dust = new HawkshotDust(this.scene, (p) => this.ground(p));
  smoke = new HawkshotSmoke(this.scene, (p) => this.ground(p));
  arrivals = new HawkshotArrivals(this.scene, (p) => this.ground(p));
  arrivalGlows = new HawkshotArrivalGlows(this.scene, (p) => this.ground(p));
  darkness = new HawkshotDarkness(this.scene, (p) => this.ground(p));
  radial = new HawkshotRadial(this.scene, (p) => this.ground(p));
  sparkle = new HawkshotSparkle(this.scene, (p) => this.ground(p));
  snow = [0, 1].map((layer) => new HawkshotSnow(layer, this.scene, (p) => this.ground(p)));
  lingerAurora = new HawkshotLingerAurora(this.scene, (p) => this.ground(p));
  echoes = new HawkshotEchoes(this.scene, (p) => this.ground(p));
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
  private barParts = new WeakMap<
    HTMLDivElement,
    {
      health: HTMLElement;
      shield: HTMLElement;
      mana: HTMLElement;
      status: HTMLElement;
    }
  >();
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
  private fogSampler?: FogSampler;
  private bars: HTMLDivElement;
  /** Last presentation timestamp, available to development pose inspectors. */
  previousElapsed = 0;
  private terminalWorld?: World;
  private terminalAnimationStart = 0;

  constructor(
    host: HTMLElement,
    readonly battlefield: Battlefield = PRACTICE_FIXTURE
  ) {
    // In Three r186, renderer.alpha controls the clear value while its default
    // context always has alpha. Subtractive particles can then expose the page
    // matte. Keep their RGBA blend intact and make the canvas itself opaque.
    const canvas = document.createElement('canvas'),
      context = canvas.getContext('webgl2', {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
      });
    if (!context) throw new Error('WebGL 2 is unavailable.');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setOpaqueSort(groundDisplayListSort);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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
    if (battlefield.id === 'practice-fixture') this.scene.fog = new THREE.Fog(0x19352e, 65, 110);
    else this.camera.far = 600;
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
    const fixtureTerrain = new THREE.Group();
    setGroundRenderStage(fixtureTerrain, 'terrain');
    this.scene.add(fixtureTerrain);
    this.mapTexture =
      battlefield.id === 'practice-fixture'
        ? buildTerrain(fixtureTerrain).mapTexture
        : new THREE.CanvasTexture(document.createElement('canvas'));
    if (battlefield.id === 'rift') this.center = { ...battlefield.spawns.blue };
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
    fountain.position.set(
      battlefield.spawns.blue.x * SCALE,
      this.ground(battlefield.spawns.blue) + 0.08,
      battlefield.spawns.blue.y * SCALE
    );
    fountain.visible = battlefield.id === 'practice-fixture';
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = this.fogCanvas.height = 256;
    if (battlefield.id === 'rift') this.fogPixels = new ImageData(256, 256);
    this.fogMask.width = this.fogMask.height = this.fogPixels.width;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(this.battlefield.half * SCALE * 2, this.battlefield.half * SCALE * 2),
      new THREE.MeshBasicMaterial({ map: this.fogTexture, transparent: true, depthWrite: false })
    );
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.065;
    fog.renderOrder = 2;
    if (battlefield.id === 'practice-fixture') this.scene.add(fog);
    this.resize();
  }
  ground(point: Vec2): number {
    return this.battlefield.heightAt(point) * SCALE;
  }
  private mapTextureResidency?: MapTextureResidency;
  private mapTexturePrefetch?: MapTexturePrefetch;
  async loadEnvironment(): Promise<void> {
    if (this.battlefield.id !== 'rift') return;
    const [terrain, image] = await Promise.all([
      loadRift(this.renderer),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Minimap image could not be loaded'));
        image.src = 'assets/maps/rift-minimap.webp';
      }),
    ]);
    const root = new THREE.Group();
    root.scale.set(SCALE, SCALE, -SCALE);
    root.position.set(-74.25, 0, 74.25);
    root.add(terrain);
    this.mapTextureResidency = terrain.userData.textureResidency;
    this.mapTexturePrefetch = terrain.userData.texturePrefetch;
    this.scene.add(root);
    // Terrain has no animated transforms. Bake its final world placement once;
    // fog uniforms and materials remain live, as do all separate unit models.
    root.name = 'rift-terrain';
    setGroundRenderStage(root, 'terrain');
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      object.matrixAutoUpdate = false;
      object.matrixWorldAutoUpdate = false;
    });
    const canvas = this.mapTexture.image;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    this.mapTexture.needsUpdate = true;
    this.applyRiftFog(terrain);
  }
  private applyRiftFog(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of (Array.isArray(object.material)
        ? object.material
        : [object.material]) as THREE.Material[]) {
        if (material.userData.riftFog) continue;
        material.userData.riftFog = true;
        const previous = material.onBeforeCompile.bind(material),
          key = material.customProgramCacheKey.bind(material);
        material.onBeforeCompile = (shader, renderer) => {
          previous(shader, renderer);
          shader.uniforms.riftFog = { value: this.fogTexture };
          shader.vertexShader = 'varying vec2 vRiftFogUV;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            'vec3 fogWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\nvRiftFogUV=vec2(fogWorld.x/148.5+0.5,0.5-fogWorld.z/148.5);\n#include <project_vertex>'
          );
          shader.fragmentShader =
            'uniform sampler2D riftFog;\nvarying vec2 vRiftFogUV;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            '#include <opaque_fragment>\nfloat obscured=clamp(texture2D(riftFog,vRiftFogUV).a/0.73,0.0,1.0);\ngl_FragColor.rgb*=mix(1.0,0.2,obscured);'
          );
        };
        material.customProgramCacheKey = () => key() + '-rift-fog-v2';
        material.needsUpdate = true;
      }
    });
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
    const padding = this.battlefield.id === 'rift' ? 100 : 500;
    this.center.x = clamp(
      this.center.x,
      -this.battlefield.half + padding,
      this.battlefield.half - padding
    );
    this.center.y = clamp(
      this.center.y,
      -this.battlefield.half + padding,
      this.battlefield.half - padding
    );
    const x = this.center.x * SCALE,
      z = this.center.y * SCALE;
    const elevation = this.ground(this.center);
    this.camera.position.set(x, elevation + 34 * this.zoom, z + 27 * this.zoom);
    this.camera.lookAt(x, elevation, z);
    this.camera.updateMatrixWorld();
  }
  worldPoint(x: number, y: number): Vec2 | null {
    this.ray.setFromCamera(
      new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2),
      this.camera
    );
    if (this.battlefield.id === 'practice-fixture') {
      const hit = this.ray.ray.intersectPlane(this.plane, this.projector);
      return hit ? { x: hit.x / SCALE, y: hit.z / SCALE } : null;
    }
    const ray = this.ray.ray;
    if (ray.direction.y >= -0.0001) return null;
    const [minimum, maximum] = this.battlefield.heightRange;
    const near = Math.max(0, ((maximum + 1) * SCALE - ray.origin.y) / ray.direction.y);
    const far = ((minimum - 1) * SCALE - ray.origin.y) / ray.direction.y;
    const difference = (t: number) => {
      ray.at(t, this.projector);
      return (
        this.projector.y - this.ground({ x: this.projector.x / SCALE, y: this.projector.z / SCALE })
      );
    };
    let lo = near;
    for (let step = 1; step <= 32; step++) {
      let hi = near + ((far - near) * step) / 32;
      if (difference(hi) <= 0) {
        for (let i = 0; i < 18; i++) {
          const mid = (lo + hi) / 2;
          if (difference(mid) > 0) lo = mid;
          else hi = mid;
        }
        ray.at((lo + hi) / 2, this.projector);
        return { x: this.projector.x / SCALE, y: this.projector.z / SCALE };
      }
      lo = hi;
    }
    return null;
  }
  screenPoint(
    point: Vec2 & { structureTransform?: readonly number[] },
    elevation = 0
  ): { x: number; y: number; visible: boolean } {
    this.projector
      .set(
        point.x * SCALE,
        (point.structureTransform ? point.structureTransform[13] * SCALE : this.ground(point)) +
          elevation,
        point.y * SCALE
      )
      .project(this.camera);
    return {
      x: (this.projector.x + 1) * 0.5 * this.width,
      y: (1 - this.projector.y) * 0.5 * this.height,
      visible: this.projector.z > -1 && this.projector.z < 1,
    };
  }
  pick(world: World, x: number, y: number): Unit | undefined {
    this.ray.setFromCamera(
      new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2),
      this.camera
    );
    let target: Unit | undefined,
      best = Infinity;
    for (const u of world.units) {
      if (!world.alive(u) || !world.visible(u)) continue;
      const champion = u.kind === 'champion';
      const selection =
        u.champion === 'garen'
          ? { radius: GAREN.selectionRadius, height: GAREN.selectionHeight }
          : u.champion === 'lux'
            ? { radius: LUX.selectionRadius, height: LUX.selectionHeight }
            : ASHE_SELECTION;
      const base = champion
        ? (this.models.get(u.id)?.root.position ?? {
            x: u.x * SCALE,
            y: this.ground(u),
            z: u.y * SCALE,
          })
        : null;
      let p: { x: number; y: number };
      if (base) {
        this.projector
          .set(base.x, base.y + (selection.height * SCALE) / 2, base.z)
          .project(this.camera);
        p = {
          x: (this.projector.x + 1) * 0.5 * this.width,
          y: (1 - this.projector.y) * 0.5 * this.height,
        };
      } else p = this.screenPoint(u, isStructureKind(u.kind) ? 1.8 : 0.65);
      const d = Math.hypot(p.x - x, p.y - y);
      const inside = base
        ? intersectsSelectionCylinder(
            this.ray.ray,
            base,
            selection.radius * SCALE,
            selection.height * SCALE
          )
        : d < (isStructureKind(u.kind) ? 35 : 19);
      if (inside && d < best) {
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
    // No new simulation interval follows victory. A cycling accumulator alpha
    // would repeatedly rewind the last movement/pose beneath terminal playback.
    if (world.winner) alpha = 1;
    if (!world.winner) this.terminalWorld = undefined;
    else if (this.terminalWorld !== world) {
      this.terminalWorld = world;
      this.terminalAnimationStart = elapsed;
    }
    const terminalAge = world.winner ? Math.max(0, elapsed - this.terminalAnimationStart) : 0;
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
        if (u.structureTransform) {
          // Geometry already has centimeters baked in; preserve source rotation
          // and scale while converting the authored translation and Z direction.
          model.root.matrix.copy(structureModelMatrix(u.structureTransform));
          model.root.matrix.decompose(model.root.position, model.root.quaternion, model.root.scale);
          model.root.matrixAutoUpdate = false;
        }
        if (isStructureKind(u.kind) && this.battlefield.id === 'rift')
          this.applyRiftFog(model.root);
        this.models.set(u.id, model);
        this.scene.add(model.root);
      }
      const deathDuration = model.actions?.death?.getClip().duration ?? 0.65;
      const deathAge =
        u.deadAt === null ? 0 : Math.max(0, (world.tick - u.deadAt + alpha - 1) / 60) + terminalAge;
      const knownDestroyed = world.knownStructureDestroyed(u);
      model.root.visible =
        knownDestroyed !== null ||
        (world.visible(u) &&
          (isStructureKind(u.kind) || u.deadAt === null || deathAge < deathDuration + 0.2));
      const x = lerp(u.previous.x, u.x, alpha),
        y = lerp(u.previous.y, u.y, alpha);
      if (!u.structureTransform) {
        model.root.position.set(x * SCALE, this.ground({ x, y }), y * SCALE);
        model.root.rotation.y = u.kind === 'dummy' ? 0.3 : isStructureKind(u.kind) ? 0 : u.facing;
        model.root.rotation.z =
          u.deadAt === null || model.mixer
            ? 0
            : -Math.min((world.tick - u.deadAt) / 20, Math.PI / 2);
        if (isStructureKind(u.kind)) model.root.scale.z = -1;
      }
      if (isStructureKind(u.kind) && model.mixer && model.actions) {
        const destroyed = knownDestroyed ?? u.deadAt !== null;
        const deathTick = world.knownStructureDeathTick(u);
        const pose = structurePose(
          { destroyed, deathTick, idleStartTick: world.knownStructureIdleStartTick(u)! },
          structureAnimationProfile(u),
          world.tick,
          alpha,
          terminalAge
        );
        model.destructionTick = destroyed ? deathTick! : undefined;
        const changed = model.destroyed !== destroyed;
        if (changed) {
          for (const part of model.submeshes ?? [])
            part.visible = destroyed
              ? part.userData.destroyedVisible
              : !part.userData.initiallyHidden;
          model.destroyed = destroyed;
        }
        const action = model.actions[pose.clip];
        if (changed || model.actionName !== pose.clip) {
          model.mixer.stopAllAction();
          action.reset().play();
          model.actionName = pose.clip;
        }
        action.setLoop(pose.loop ? THREE.LoopRepeat : THREE.LoopOnce, pose.loop ? Infinity : 1);
        action.clampWhenFinished = !pose.loop;
        action.setEffectiveWeight(1);
        action.time = pose.time;
        action.paused = true;
        model.mixer.update(0);
      }
      if (!isStructureKind(u.kind) && model.mixer && model.actions && model.clipDurations) {
        const pose = mobilePose(
          u,
          world.championState(u.id),
          world.tick,
          alpha,
          model.clipDurations,
          terminalAge
        );
        const endpoint = mobilePose(
          u,
          world.championState(u.id),
          world.tick,
          1,
          model.clipDurations
        );
        const timeline = advanceAnimationTimeline(
          u.animationTimeline,
          endpoint,
          world.tick,
          model.clipDurations
        );
        const at = world.tick - 1 + alpha + (pose.kind === 'death' ? terminalAge * 60 : 0);
        const layers = animationLayers(timeline, at, model.clipDurations);
        model.mixer.stopAllAction();
        const primary = model.actions[pose.clip];
        primary
          .reset()
          .setLoop(pose.loop ? THREE.LoopRepeat : THREE.LoopOnce, pose.loop ? Infinity : 1)
          .setEffectiveWeight(0)
          .play();
        primary.time = pose.time;
        primary.paused = true;
        primary.clampWhenFinished = !pose.loop;
        primary.timeScale = pose.kind === 'attack' ? pose.rate : 1;
        for (const layer of layers) {
          const action = model.actions[layer.clip];
          action
            .reset()
            .setLoop(layer.loop ? THREE.LoopRepeat : THREE.LoopOnce, layer.loop ? Infinity : 1)
            .setEffectiveWeight(layer.weight)
            .play();
          action.time = layer.time;
          action.paused = true;
          action.clampWhenFinished = !layer.loop;
          action.timeScale = layer.rate;
        }
        model.actionName = pose.clip;
        if (pose.kind === 'attack') model.animationAttackTick = u.attackCycle!.startTick;
        model.mixer.update(0);
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
    this.luxBeams.update(world, alpha, this.camera, terminalAge);
    this.luxStreaks.update(world, alpha, terminalAge);
    this.luxScorches.update(world, alpha, terminalAge);
    this.luxGroundCharge.update(world, alpha);
    this.luxGroundWarnings.update(world, alpha);
    this.luxBokeh.update(world, alpha, this.camera, terminalAge);
    this.luxChargeRays.update(world, alpha, this.camera);
    this.luxAttackHoops.update(world, alpha, this.camera, terminalAge);
    this.luxAttackTrails.update(world, alpha, terminalAge);
    this.luxAttackCrescents.update(world, alpha, terminalAge);
    this.luxImpacts.update(world, alpha, this.camera, terminalAge);
    this.luxIllumination.update(world, alpha, this.camera, this.models);
    this.luxIlluminationTriggers.update(world, alpha, this.camera, terminalAge);
    this.luxSingularities.update(world, alpha);
    this.wind.update(world);
    this.garenSpin.update(world, alpha, terminalAge);
    this.garenJustice.update(world, alpha, this.camera, this.models, terminalAge);
    this.garenCourage.update(world, alpha, this.camera, this.models, terminalAge);
    this.grompDeath.update(world, alpha, this.camera, this.models, terminalAge);
    this.garenDecisiveStrike.update(world, alpha, this.camera, this.models, terminalAge);
    this.dust.update(world, this.camera);
    this.smoke.update(world, this.camera);
    this.echoes.update(world);
    this.arrivals.update(world);
    this.arrivalGlows.update(world, this.camera);
    this.darkness.update(world, this.camera);
    this.radial.update(world, this.camera);
    this.sparkle.update(world, this.camera);
    this.snow.forEach((layer) => layer.update(world, this.camera));
    this.lingerAurora.update(world);
    const selected = world.unit(this.selected ?? world.player.id);
    this.selection.visible = !!selected && world.alive(selected) && world.visible(selected);
    if (selected) {
      this.selection.position.x = selected.x * SCALE;
      this.selection.position.z = selected.y * SCALE;
      this.selection.position.y = this.ground(selected) + 0.09;
      this.selection.scale.setScalar(isStructureKind(selected.kind) ? selected.radius / 47.5 : 1);
    }
    const hovered = this.hovered === null ? undefined : world.unit(this.hovered);
    this.hover.visible = !!hovered && world.alive(hovered) && world.visible(hovered);
    if (hovered) {
      this.hover.position.x = hovered.x * SCALE;
      this.hover.position.z = hovered.y * SCALE;
      this.hover.position.y = this.ground(hovered) + 0.1;
    }
    this.range.visible = this.rangeVisible && world.alive(world.hero);
    this.range.position.set(world.hero.x * SCALE, 0, world.hero.y * SCALE);
    if (this.range.visible) {
      const positions = this.range.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const angle = (i / positions.count) * Math.PI * 2;
        const x = Math.cos(angle) * world.hero.range,
          y = Math.sin(angle) * world.hero.range;
        positions.setXYZ(
          i,
          x * SCALE,
          this.ground({ x: world.hero.x + x, y: world.hero.y + y }) + 0.09,
          y * SCALE
        );
      }
      positions.needsUpdate = true;
      this.range.geometry.computeBoundingSphere();
    }
    let move;
    for (let i = world.events.length - 1; i >= 0; i--)
      if (world.events[i].type === 'move' && world.eventVisible(world.events[i])) {
        move = world.events[i];
        break;
      }
    if (move && move.id !== this.lastMoveEvent) {
      this.lastMoveEvent = move.id;
      this.markerTick = move.tick;
      this.moveMarker.position.set(move.x * SCALE, this.ground(move), move.y * SCALE);
    }
    this.moveMarker.visible = world.tick - this.markerTick < 30;
    this.moveMarker.scale.setScalar(0.7 + ((world.tick - this.markerTick) / 30) * 0.6);
    this.updateAim(world);
    if (world.tick - this.lastFogTick >= 8) {
      this.updateFog(world);
      this.lastFogTick = world.tick;
    }
    this.mapTextureResidency?.beginFrame();
    this.smoke.prepareDepth(this.renderer, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.mapTextureResidency?.endFrame();
    this.mapTexturePrefetch?.update(this.renderer, this.camera);
  }
  private overheadLabelBounds(id: number) {
    const bar = this.healthBars.get(id);
    if (!bar || bar.hidden) return undefined;
    const label = bar.getBoundingClientRect();
    if (label.width <= 0 || label.height <= 0) return undefined;
    return { label, viewport: this.renderer.domElement.getBoundingClientRect() };
  }
  private updateBar(u: Unit, world: World, p: Vec2): void {
    let bar = this.healthBars.get(u.id);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = `unit-bar ${u.team} ${u.kind}`;
      bar.dataset.unit = String(u.id);
      bar.innerHTML =
        '<div class="unit-name"></div><div class="unit-hp"><i></i><span class="unit-shield"></span></div><div class="unit-mana"><i></i></div><div class="unit-status"></div>';
      bar.querySelector('.unit-name')!.textContent = u.name;
      this.bars.append(bar);
      this.healthBars.set(u.id, bar);
      this.barParts.set(bar, {
        health: bar.querySelector<HTMLElement>('.unit-hp i')!,
        shield: bar.querySelector<HTMLElement>('.unit-shield')!,
        mana: bar.querySelector<HTMLElement>('.unit-mana i')!,
        status: bar.querySelector<HTMLElement>('.unit-status')!,
      });
    }
    const screen = this.screenPoint(
      u.structureTransform ? u : p,
      unitBarHeight(u, this.models.get(u.id))
    );
    const hidden = !world.alive(u) || !world.visible(u) || !screen.visible;
    if (bar.hidden !== hidden) bar.hidden = hidden;
    if (bar.hidden) return;
    const shield = world.shieldAmount(u);
    const capacity = Math.max(u.maxHp, u.hp + shield);
    if (u.kind === 'champion' && bar.dataset.maxHealth !== String(capacity)) {
      // Health-based divisions; their pixel styling remains pending reference calibration.
      bar.style.setProperty('--health-hundred', `${10000 / Math.max(1, capacity)}%`);
      bar.style.setProperty('--health-thousand', `${100000 / Math.max(1, capacity)}%`);
      bar.dataset.maxHealth = String(capacity);
    }
    bar.style.transform = `translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;
    const parts = this.barParts.get(bar)!;
    parts.health.style.width = `${(u.hp / capacity) * 100}%`;
    parts.shield.style.left = `${(u.hp / capacity) * 100}%`;
    parts.shield.style.width = `${(shield / capacity) * 100}%`;
    const shieldHidden = shield === 0;
    if (parts.shield.hidden !== shieldHidden) parts.shield.hidden = shieldHidden;
    const shieldTitle = `${Math.ceil(shield)} shield`;
    if (parts.shield.title !== shieldTitle) parts.shield.title = shieldTitle;
    parts.mana.style.width = `${(u.mana / (u.maxMana || 1)) * 100}%`;
    const protectedUnit = !world.vulnerable(u);
    if (bar.classList.contains('invulnerable') !== protectedUnit)
      bar.classList.toggle('invulnerable', protectedUnit);
    const status =
      protectedUnit && (this.hovered === u.id || this.selected === u.id)
        ? 'PROTECTED'
        : u.stunUntil > world.tick
          ? 'STUNNED'
          : u.rootUntil > world.tick
            ? 'ROOTED'
            : u.silenceUntil > world.tick
              ? 'SILENCED'
              : world.slowFactor(u) < 1
                ? 'SLOWED'
                : u.illumination.some((mark) => mark.endTick > world.tick)
                  ? 'ILLUMINATED'
                  : '';
    if (parts.status.textContent !== status) parts.status.textContent = status;
  }
  private syncProjectiles(world: World, alpha: number): void {
    const active = new Set<number>();
    for (const p of world.projectiles) {
      if (p.type === 'attack' && world.unit(p.source)?.champion === 'lux') continue;
      active.add(p.id);
      let model = this.projectileModels.get(p.id);
      if (!model) {
        if (p.type === 'hawkshot') model = createHawkshot();
        else if (p.type === 'attack' && world.unit(p.source)?.champion === 'ashe')
          model = createAsheAttackArrow(p.empowered ?? false);
        else {
          model = new THREE.Group();
          const color = p.type === 'prismatic' ? 0xffedb3 : p.team === 'blue' ? 0x9aefff : 0xff818d;
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
        }
        this.scene.add(model);
        this.projectileModels.set(p.id, model);
      }
      model.visible = world.projectileVisible(p);
      if (p.type === 'attack')
        animateAsheAttackArrow(
          model,
          Math.max(0, (world.tick - 1 + alpha - (p.launchTick ?? world.tick)) / TICK_RATE)
        );
      if (p.type === 'hawkshot') animateHawkshot(model, world.time - p.launchTick! / 60);
      const flight = flurryFlight(p, p.target === null ? undefined : world.unit(p.target), alpha);
      model.position.set(
        flight.x * SCALE,
        this.ground(flight) + (p.type === 'hawkshot' ? 1.8 : p.type === 'ultimate' ? 1.2 : 0.9),
        flight.y * SCALE
      );
      model.rotation.y = flight.facing;
    }
    for (const [id, model] of this.projectileModels)
      if (!active.has(id)) {
        this.scene.remove(model);
        if (disposeAsheAttackArrow(model) || disposeHawkshot(model)) {
          this.projectileModels.delete(id);
          continue;
        }
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
    if (hero.champion === 'garen' && this.aimMode === 'r') {
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        positions.setXYZ(
          i,
          Math.cos(angle) * GAREN_R.castRange * SCALE,
          0.1,
          Math.sin(angle) * GAREN_R.castRange * SCALE
        );
      }
      this.aimLine.geometry.setDrawRange(0, 33);
    } else if (hero.champion === 'lux' && ['q', 'w', 'e', 'r'].includes(this.aimMode)) {
      if (this.aimMode === 'e') {
        const length = Math.min(
          LUX_E_SOURCE.castRange,
          Math.hypot(this.aimPoint.x - hero.x, this.aimPoint.y - hero.y)
        );
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * Math.PI * 2;
          positions.setXYZ(
            i,
            (Math.cos(dir) * length + Math.cos(angle) * LUX_E_POLICY.radius) * SCALE,
            0.1,
            (Math.sin(dir) * length + Math.sin(angle) * LUX_E_POLICY.radius) * SCALE
          );
        }
        this.aimLine.geometry.setDrawRange(0, 33);
      } else {
        const spell = this.aimMode === 'q' ? LUX_BINDING : this.aimMode === 'w' ? LUX_W : LUX_R;
        const width = 'radius' in spell ? spell.radius : spell.halfWidth;
        for (const [index, [along, across]] of [
          [0, -width],
          [spell.range, -width],
          [spell.range, width],
          [0, width],
          [0, -width],
        ].entries()) {
          positions.setXYZ(
            index,
            (Math.cos(dir) * along - Math.sin(dir) * across) * SCALE,
            0.1,
            (Math.sin(dir) * along + Math.cos(dir) * across) * SCALE
          );
        }
        this.aimLine.geometry.setDrawRange(0, 5);
      }
    } else if (this.aimMode === 'w') {
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
    for (let i = 0; i < this.aimLine.geometry.drawRange.count; i++) {
      positions.setY(
        i,
        this.ground({
          x: hero.x + positions.getX(i) / SCALE,
          y: hero.y + positions.getZ(i) / SCALE,
        }) + 0.1
      );
    }
    positions.needsUpdate = true;
    this.aim.position.set(hero.x * SCALE, 0, hero.y * SCALE);
  }
  private updateFog(world: World): void {
    // Presentation samples the authoritative query; it never supplies gameplay visibility.
    const pixels = this.fogPixels.data,
      size = this.fogPixels.width;
    this.fogSampler ??= new FogSampler(size, this.battlefield.half * 2);
    const mask = this.fogSampler.sample(
      world.visionSources(),
      this.battlefield.lineOfSight,
      this.battlefield.visibilityRevision
    );
    for (let i = 0; i < mask.length; i++) {
      const offset = i * 4;
      pixels[offset] = 5;
      pixels[offset + 1] = 17;
      pixels[offset + 2] = 18;
      pixels[offset + 3] = mask[i] ? 0 : 186;
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
