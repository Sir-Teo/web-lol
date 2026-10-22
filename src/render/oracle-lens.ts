import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { TrinketState } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import {
  oracleChildTick,
  oracleVisualEndTick,
  ORACLE_PRESENTATION,
} from '../content/oracle-presentation';
import { SCALE } from './terrain';
import { makeModel, disposeModel, type UnitModel } from './models';
import type { OracleParticles, OracleEffectInput, OracleAnchor } from './oracle-particles';

let prepared: typeof import('./oracle-particles') | null = null;
let pending: Promise<void> | null = null;
/** Full profiles, renderer and assets load only after selection or saved presence. */
export function loadOracleLens(): Promise<void> {
  if (prepared) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const module = await import('./oracle-particles');
    await module.loadOracleParticles();
    prepared = module;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
interface ScanGuide {
  startTick: number;
  guide: THREE.LineLoop;
}
/** Full source Buff/child Death declarations with explicit local presentation
 * adapters. The radius guide and sampled silhouettes remain local UI policies.
 * Alert dispatch is unresolved and is not inferred from a detected target.
 */
export class OracleLens {
  readonly scans = new Map<number, ScanGuide>();
  readonly echoes = new Map<number, UnitModel>();
  particles: OracleParticles | null = null;
  constructor(private scene: THREE.Scene) {}
  private removeScan(id: number, entry: ScanGuide): void {
    this.scene.remove(entry.guide);
    entry.guide.geometry.dispose();
    (entry.guide.material as THREE.Material).dispose();
    this.scans.delete(id);
  }
  update(
    w: World,
    alpha: number,
    ground: (p: Vec2) => number,
    camera: THREE.Camera,
    terminalAge = 0
  ): void {
    const tick = w.tick - 1 + alpha + terminalAge * 60;
    const active = new Set<number>(),
      inputs: OracleEffectInput[] = [];
    const echoes = new Map<number, NonNullable<TrinketState['scan']>['echoes'][number]>();
    for (const owner of w.units) {
      const state = w.championState(owner.id)?.trinket;
      if (!state) continue;
      const point = w.winner
        ? { x: owner.x, y: owner.y }
        : {
            x: owner.previous.x + (owner.x - owner.previous.x) * alpha,
            y: owner.previous.y + (owner.y - owner.previous.y) * alpha,
          };
      const anchor: OracleAnchor = {
        position: [point.x, ground(point) / SCALE, point.y],
        facing: owner.facing,
      };
      for (const visual of state.visuals) {
        if (
          visual.stopTick !== null &&
          tick >= oracleVisualEndTick(visual.startTick, visual.stopTick)
        )
          continue;
        if (w.visible(owner, w.hero.team))
          inputs.push({
            id: `${owner.id}:${visual.startTick}:buff`,
            ownerId: owner.id,
            window: { role: 'buff', startTick: visual.startTick, stopTick: visual.stopTick },
            anchorAt: () => anchor,
            birthAnchor: () => ({
              position: [visual.origin.x, ground(visual.origin) / SCALE, visual.origin.y],
              facing: visual.facing,
            }),
          });
        if (visual.stopTick === null) continue;
        const child = oracleChildTick(visual.startTick, visual.stopTick);
        if (child === null || tick < child) continue;
        // Simulation captures normal child roots after movement. A frozen result
        // clock derives future child roots from the frozen owner without mutation.
        const captured =
          visual.childAnchor ??
          (w.winner ? { point: { x: owner.x, y: owner.y }, facing: owner.facing } : null);
        if (!captured) throw new Error('Oracle child anchor was not captured');
        if (owner.team !== w.hero.team && !w.pointVisible(captured.point, w.hero.team)) continue;
        const offset = ORACLE_PRESENTATION.parentOffset;
        const childAnchor: OracleAnchor = {
          position: [
            captured.point.x + offset[0],
            ground(captured.point) / SCALE + offset[1],
            captured.point.y + offset[2],
          ],
          facing: captured.facing,
        };
        inputs.push({
          id: `${owner.id}:${visual.startTick}:death`,
          ownerId: owner.id,
          window: { role: 'death', startTick: child, stopTick: null },
          anchorAt: () => childAnchor,
        });
      }
      const scan = state.scan;
      if (!scan || scan.endTick <= w.tick || w.winner) continue;
      if (owner.team === w.hero.team)
        for (const echo of scan.echoes) {
          const previous = echoes.get(echo.targetId);
          if (echo.endTick > w.tick && (!previous || previous.createdTick < echo.createdTick))
            echoes.set(echo.targetId, echo);
        }
      active.add(owner.id);
      let entry = this.scans.get(owner.id);
      if (!entry) {
        const guide = new THREE.LineLoop(
          new THREE.BufferGeometry().setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(64 * 3), 3)
          ),
          new THREE.LineBasicMaterial({
            color: 0xe27b70,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          })
        );
        guide.frustumCulled = false;
        this.scene.add(guide);
        entry = { startTick: scan.startTick, guide };
        this.scans.set(owner.id, entry);
      }
      entry.startTick = scan.startTick;
      entry.guide.visible = owner.team === w.hero.team;
      const positions = entry.guide.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const theta = (i / positions.count) * Math.PI * 2,
          p = {
            x: point.x + Math.cos(theta) * scan.radius,
            y: point.y + Math.sin(theta) * scan.radius,
          };
        positions.setXYZ(i, p.x * SCALE, ground(p) + 0.04, p.y * SCALE);
      }
      positions.needsUpdate = true;
    }
    if (!this.particles && prepared) this.particles = new prepared.OracleParticles(this.scene);
    if (inputs.length && !this.particles) throw new Error('Oracle Lens assets were not prepared');
    this.particles?.update(inputs, tick, camera, (x, z) => ground({ x, y: z }));
    for (const [id, entry] of this.scans) if (!active.has(id)) this.removeScan(id, entry);
    const visibleEchoes = new Set<number>();
    for (const [id, echo] of echoes) {
      const target = w.unit(id);
      if (!target || w.visible(target, w.hero.team)) continue;
      visibleEchoes.add(id);
      let model = this.echoes.get(id);
      if (!model) {
        model = makeModel(target);
        model.root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material = new THREE.MeshBasicMaterial({
              color: 0xe95642,
              transparent: true,
              opacity: 0.6,
              depthTest: false,
              depthWrite: false,
            });
            o.renderOrder = 1000;
            o.frustumCulled = false;
          }
        });
        this.echoes.set(id, model);
        this.scene.add(model.root);
      }
      model.root.position.set(echo.point.x * SCALE, ground(echo.point), echo.point.y * SCALE);
      model.root.rotation.y = echo.facing;
    }
    for (const [id, model] of this.echoes)
      if (!visibleEchoes.has(id)) {
        this.scene.remove(model.root);
        disposeModel(model);
        model.root.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
        });
        this.echoes.delete(id);
      }
  }
}
