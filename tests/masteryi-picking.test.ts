import { expect, test } from 'vitest';
import * as THREE from 'three';
import { GameView } from '../src/render/view';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import type { Unit } from '../src/simulation/types';
import { unitVisible } from '../src/render/unit-visibility';
function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
  });
  w.nextWaveTick = Infinity;
  Object.assign(w.hero, { x: -500, y: 0 });
  const yi = w.spawn('champion', 'red', { x: 0, y: 0 }, 'masteryi');
  const target = w.spawn('dummy', 'blue', { x: 300, y: 0 });
  target.hp = target.maxHp = 10000;
  w.learnSpell('q', yi.id);
  const camera = new THREE.PerspectiveCamera(40, 1440 / 900, 0.1, 1000);
  const view = {
    camera,
    width: 1440,
    height: 900,
    ray: new THREE.Raycaster(),
    projector: new THREE.Vector3(),
    models: new Map([[yi.id, { root: new THREE.Object3D() }]]),
    ground: () => 0,
    screenPoint: GameView.prototype.screenPoint,
  };
  const pick = (unit: Unit = yi, height = 0.775) => {
    const x = unit.x * 0.01,
      z = unit.y * 0.01;
    view.models.get(yi.id)!.root.position.set(yi.x * 0.01, 0, yi.y * 0.01);
    camera.position.set(x, 10, z + 10);
    camera.lookAt(x, height, z);
    camera.updateMatrixWorld(true);
    return GameView.prototype.pick.call(view as unknown as GameView, w, 720, 450);
  };
  return { w, yi, target, pick };
}
test('picking follows Alpha Strike disappearance and real reappearance even while fog sight is retained', () => {
  const { w, yi, target, pick } = fixture();
  expect(pick()?.id).toBe(yi.id);
  w.enqueue({ type: 'cast', unit: yi.id, ability: 'q', point: target, targetId: target.id });
  w.step();
  expect(w.visible(yi)).toBe(true);
  expect(w.targetable(yi)).toBe(false);
  expect(pick()).toBeUndefined();
  w.step(56);
  expect(w.targetable(yi)).toBe(true);
  expect(pick()?.id).toBe(yi.id);
});

test('a protected inner turret remains visible and selectable while its outer defender lives', () => {
  const { w, pick } = fixture();
  w.hero.x = 500;
  const outer = w.spawn('turret', 'red', { x: 1400, y: 0 });
  outer.structure = { role: 'outer-turret', lane: 'mid', healthBarHeight: 180, regenPerSecond: 0 };
  const inner = w.spawn('turret', 'red', { x: 1000, y: 0 });
  inner.structure = { role: 'inner-turret', lane: 'mid', healthBarHeight: 180, regenPerSecond: 0 };
  expect(w.vulnerable(inner)).toBe(false);
  expect(w.targetable(inner)).toBe(false);
  expect(unitVisible(w, inner)).toBe(true);
  expect(pick(inner, 1.8)?.id).toBe(inner.id);
});

test('ordinary fog and death still remove actors from picking', () => {
  const { w, yi, pick } = fixture();
  w.battlefield.lineOfSight = () => false;
  expect(pick()).toBeUndefined();
  w.battlefield.lineOfSight = () => true;
  expect(pick()?.id).toBe(yi.id);
  w.damage(w.hero, yi, 1e6, 'true');
  expect(pick()).toBeUndefined();
});
