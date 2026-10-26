import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WARD_POLICY } from '../src/content/warding-totem';
import { recordLuxEHit } from '../src/simulation/lux-e-hits';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { LUX_E_HIT_HISTORY_TICKS, LUX_E_HIT_SECONDS } from '../src/content/lux-e-hit';
import { luxEHitPoint } from '../src/render/lux-e-hit-point';
import { luxEParticles } from '../src/render/lux-e-particles';
import profiles from '../src/content/lux-e-particles.json';
import pin from '../docs/reference/lux-e-vfx.json';
import { SNAPSHOT_VERSION } from '../src/simulation/snapshot';
function fixture() {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
  const target = w.spawn('melee', 'red', { x: 300, y: 0 });
  target.hp = target.maxHp = 10000;
  target.ai = false;
  w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
  w.step(31);
  return { w, lux, target };
}
function detonate(f: ReturnType<typeof fixture>) {
  f.w.enqueue({ type: 'cast', unit: f.lux.id, ability: 'e', point: f.target });
  f.w.step();
  return f.w.singularities[0];
}
const restore = (w: World) => World.fromSnapshot(w.snapshot(), w.battlefield);

test('target flash preserves the source profile and all 32 previous static indices', () => {
  const p = profiles.at(-1)!,
    e = pin.definitions.Lux_E_tar_hit.complexEmitterDefinitionData[0];
  expect(p).toMatchObject({
    role: 'hit',
    record: 'Lux_E_tar_hit',
    index: 0,
    life: e.particleLifetime.constantValue,
    offset: [0, 40, 0],
    size: { value: [200, 200, 200] },
    uniform: true,
    primitive: 'camera',
  });
  expect(LUX_E_HIT_SECONDS).toBe(0.30000001192092896);
  expect(LUX_E_HIT_HISTORY_TICKS).toBe(20);
  expect(
    createHash('sha256')
      .update(JSON.stringify(profiles.slice(0, 32)))
      .digest('hex')
  ).toBe('9ce8740115500857e04500d638bf08bfbfb268dc3ed857a3697dfb21179a26ae');
  const random = vi.spyOn(Math, 'random');
  const a = luxEParticles('hit', 91, 0.1);
  expect(luxEParticles('hit', 91, 0.1)).toEqual(a);
  expect(luxEParticles('hit', 92, 0.1)).not.toEqual(a);
  expect(luxEParticles('hit', 91, 0.3)).toHaveLength(1);
  expect(luxEParticles('hit', 91, 19 / 60)).toEqual([]);
  expect(random).not.toHaveBeenCalled();
  random.mockRestore();
});

test('accepted enemy, shielded and lethal contacts are saved once; friends, structures, wards and out-of-range units are absent', () => {
  const f = fixture(),
    { w, target } = f;
  const friend = w.spawn('dummy', 'blue', { x: 300, y: 0 });
  const far = w.spawn('dummy', 'red', { x: 800, y: 0 });
  const lethal = w.spawn('melee', 'red', { x: 300, y: 20 });
  lethal.hp = 1;
  lethal.ai = false;
  lethal.corpseLifetimeTicks = 0;
  const shield = w.spawn('champion', 'red', { x: 280, y: 0 });
  shield.ai = false;
  shield.shields = [{ amount: 10000, endTick: w.tick + 100, sourceId: shield.id }];
  const turret = w.spawn('turret', 'red', { x: 300, y: 0 });
  w.enqueue({ type: 'ward', unit: shield.id, point: { x: 300, y: 0 } });
  w.step(WARD_POLICY.placementTicks + 1);
  const ward = w.units.find((u) => u.kind === 'ward')!;
  expect(ward).toBeDefined();
  const shieldHp = shield.hp;
  const zone = detonate(f);
  expect(shield.hp).toBe(shieldHp);
  expect(zone.hits.map((h) => h.targetId).sort((a, b) => a - b)).toEqual(
    [target.id, lethal.id, shield.id].sort((a, b) => a - b)
  );
  expect(zone.hits.some((h) => [friend.id, far.id, turret.id, ward.id].includes(h.targetId))).toBe(
    false
  );
  expect(zone.hits.find((h) => h.targetId === lethal.id)!.detachedTick).toBe(w.tick);
  const id = w.nextId,
    random = w.random.state;
  recordLuxEHit(w, { ...zone, hits: [] }, target);
  expect(w.nextId).toBe(id);
  expect(w.random.state).toBe(random);
  const copy = restore(w);
  w.step(3);
  copy.step(3);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(zone.hits).toHaveLength(3);
});

test('moving roots record contiguous endpoints, restore and interpolate without current-unit dependence', () => {
  const f = fixture(),
    zone = detonate(f),
    { w, target } = f;
  w.setOrder(target, { type: 'move', point: { x: 600, y: 200 } });
  w.step(5);
  const hit = zone.hits[0],
    saved = w.snapshot();
  expect(hit.frames).toHaveLength(6);
  expect(hit.frames.at(-1)!.x).not.toBe(hit.frames[0].x);
  const t = hit.frames[3].tick + 0.25,
    a = hit.frames[3],
    b = hit.frames[4];
  expect(luxEHitPoint(hit, t)).toEqual({
    x: a.x + (b.x - a.x) * 0.25,
    y: a.y + (b.y - a.y) * 0.25,
  });
  const point = luxEHitPoint(hit, t);
  luxEHitPoint(hit, t + 1);
  expect(luxEHitPoint(hit, t)).toEqual(point);
  const copy = restore(w);
  expect(copy.snapshot()).toBe(saved);
  w.step(10);
  copy.step(10);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(zone.hits[0].frames.at(-1)!.tick).toBe(w.tick);
});

test('death and removal freeze an owned endpoint; expiry clears all hit history without extending zone lifetime', () => {
  const f = fixture(),
    zone = detonate(f),
    { w, target } = f;
  w.setOrder(target, { type: 'move', point: { x: 600, y: 0 } });
  w.step(3);
  w.damage(f.lux, target, 999999, 'true');
  w.step();
  const hit = zone.hits[0],
    death = hit.frames.at(-1)!;
  expect(hit.detachedTick).toBe(death.tick);
  w.units = w.units.filter((u) => u.id !== target.id);
  w.step(4);
  expect(luxEHitPoint(hit, w.tick)).toEqual({ x: death.x, y: death.y });
  expect(restore(w).snapshot()).toBe(w.snapshot());
  w.step(LUX_E_HIT_HISTORY_TICKS);
  expect(zone.hits).toEqual([]);
  expect(w.singularities).toContain(zone);
});

test('strict schema rejects duplicate contacts, forged clocks, frames, attachment ownership and post-detachment movement', () => {
  const f = fixture();
  detonate(f);
  f.w.step(3);
  const valid = JSON.parse(f.w.snapshot());
  expect(valid.version).toBe(SNAPSHOT_VERSION);
  expect(SNAPSHOT_VERSION).toBe(147);
  const reject = (change: (s: any, h: any) => void) => {
    const s = structuredClone(valid),
      h = s.singularities[0].hits[0];
    change(s, h);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  reject((s) => s.singularities[0].hits.push(structuredClone(s.singularities[0].hits[0])));
  reject((_s, h) => h.frames.pop());
  reject((_s, h) => h.frames[0].tick++);
  reject((_s, h) => h.frames[0].x++);
  reject((_s, h) => (h.targetId = 99999));
  reject((_s, h) => (h.targetTeam = 'blue'));
  reject((_s, h) => h.targetRadius++);
  reject((_s, h) => (h.contact.x = 99999));
  reject((_s, h) => (h.audience = ['blue']));
  reject((_s, h) => (h.detachedTick = valid.tick + 1));
  reject((_s, h) => {
    h.detachedTick = h.frames[0].tick;
    h.frames[1].x++;
  });
  reject((s) => (s.version = 109));
});

test('hit creation audience is captured before lethal damage and does not expand when sight returns', () => {
  const f = fixture();
  f.target.hp = 1;
  f.w.pointVisible = () => false;
  const zone = detonate(f),
    hit = zone.hits[0];
  expect(hit.audience).toEqual(['red']);
  f.w.pointVisible = () => true;
  f.w.step();
  expect(hit.audience).toEqual(['red']);
  expect(restore(f.w).snapshot()).toBe(f.w.snapshot());
});
