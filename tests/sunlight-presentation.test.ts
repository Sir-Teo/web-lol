import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import profiles from '../src/content/leona-sunlight-particles.json';
import { SUNLIGHT_VISUAL_HISTORY_TICKS } from '../src/content/leona-sunlight-presentation';
import { sunlightParticles } from '../src/render/sunlight-particles';

function fixture() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    lineWalkable: () => true,
    findPath: (_a, b) => [{ ...b }],
    reachable: (p) => ({ x: p.x, y: p.y }),
  });
  w.nextWaveTick = Infinity;
  const leona = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'leona');
  const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
  const mark = () => w.applySunlight(leona, target);
  const trigger = () => w.damage(w.hero, target, 1, 'physical');
  const restore = () => World.fromSnapshot(w.snapshot(), w.battlefield);
  return { w, leona, target, mark, trigger, restore };
}

test('all nine profiles rebuild from frozen definitions and every decoded image retains its pin', () => {
  execFileSync('python3', ['tools/assets/export-leona-sunlight-particles.py', '--check']);
  expect(profiles.map((p) => p.role)).toEqual([
    'mark',
    'champion',
    'champion',
    ...Array(6).fill('hit'),
  ]);
  const pin = JSON.parse(
    readFileSync('docs/reference/leona-sunlight-particles-decoded.json', 'utf8')
  );
  expect(pin.textures).toHaveLength(12);
  for (const t of pin.textures)
    expect(createHash('sha256').update(readFileSync(t.path)).digest('hex')).toBe(t.sha256);
  expect(SUNLIGHT_VISUAL_HISTORY_TICKS).toBe(65);
});

test('first-update births cover all six burst emitters, preserve correlated source draws and settle inside the retained horizon', () => {
  expect(sunlightParticles('hit', 1, 0, 35)).toEqual([]);
  const first = sunlightParticles('hit', 1, 1 / 60, 35);
  expect(first).toHaveLength(47);
  expect([...new Set(first.map((p) => p.profileIndex))]).toEqual([3, 4, 5, 6, 7, 8]);
  expect(first.every((p) => p.age === 0 && p.bornTick === 1)).toBe(true);
  expect(sunlightParticles('hit', 1, 1 / 60, 35)).toEqual(first);
  const flares = first.filter((p) => p.profileIndex === 4);
  expect(new Set(flares.map((p) => p.life)).size).toBeGreaterThan(1);
  expect(sunlightParticles('hit', 1, SUNLIGHT_VISUAL_HISTORY_TICKS / 60, 35)).toEqual([]);
  expect(sunlightParticles('mark', 1, 1 / 60, 35)).toHaveLength(1);
  expect(sunlightParticles('champion', 1, 1 / 60, 35)).toHaveLength(2);
});

test('source mark tint, scale interpolation and lookup ranges remain independent for champion layers', () => {
  const p = sunlightParticles('champion', 1, 1 / 60 + 1.25, 35);
  expect(p).toHaveLength(2);
  expect(p[0].color[3]).toBe(0.6000000238418579);
  expect(p[0].size[0]).toBeCloseTo(135, 5);
  expect(p[1].size[0]).toBeCloseTo(31.5, 5);
  expect(p[0].lookup[0]).toBeCloseTo(0.65, 6);
  expect(p[0].lookup[1]).toBe(1);
});

test('bursts use a separate serial, remain seekable after reload and consume no gameplay identity or RNG', () => {
  const f = fixture(),
    before = f.w.nextId,
    random = f.w.random.state;
  f.mark();
  f.trigger();
  expect(f.w.nextId - before).toBe(2); // Actual ally and proc damage events only.
  expect(f.w.random.state).toBe(random);
  expect(f.w.nextSunlightVisual).toBe(2);
  expect(f.w.sunlightVisuals[0]).toMatchObject({
    id: 1,
    sourceId: f.leona.id,
    targetId: f.target.id,
    radius: 35,
  });
  const copy = f.restore();
  f.w.setOrder(f.target, { type: 'move', point: { x: 800, y: 0 } });
  copy.setOrder(copy.unit(f.target.id)!, { type: 'move', point: { x: 800, y: 0 } });
  f.w.step(20);
  copy.step(20);
  expect(copy.snapshot()).toBe(f.w.snapshot());
  expect(f.w.sunlightVisuals[0].frames).toHaveLength(21);
  expect(f.w.sunlightVisuals[0].frames.at(-1)!.x).toBeGreaterThan(150);
  f.w.step(45);
  copy.step(45);
  expect(f.w.sunlightVisuals).toEqual([]);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('lethal consumption freezes the last posed endpoint and audience through target removal', () => {
  const f = fixture();
  f.target.hp = 10;
  f.mark();
  f.trigger();
  expect(f.target.deadAt).toBe(0);
  expect(f.w.sunlightVisuals[0].detachedTick).toBe(0);
  expect(() => f.restore()).not.toThrow();
  f.w.step();
  const last = structuredClone(f.w.sunlightVisuals[0].frames.at(-1)!);
  f.w.units = f.w.units.filter((u) => u.id !== f.target.id);
  f.w.step(4);
  const end = f.w.sunlightVisuals[0].frames.at(-1)!;
  expect({ ...end, tick: last.tick }).toEqual(last);
  const copy = f.restore();
  f.w.step(10);
  copy.step(10);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test('refresh/self damage do not invent bursts and repeated same-tick consumptions retain distinct cosmetic serials', () => {
  const f = fixture();
  f.mark();
  f.w.damage(f.leona, f.target, 1, 'physical');
  f.mark();
  expect(f.w.sunlightVisuals).toEqual([]);
  f.trigger();
  f.mark();
  f.trigger();
  expect(f.w.sunlightVisuals.map((v) => v.id)).toEqual([1, 2]);
  expect(() => f.restore()).not.toThrow();
});

test('strict decoding rejects forged identity, placement, clips, clocks and detached audience changes', () => {
  const f = fixture();
  f.mark();
  f.trigger();
  f.w.step(2);
  const forge = (mutate: (s: any, v: any) => void) => {
    const s = JSON.parse(f.w.snapshot());
    mutate(s, s.sunlightVisuals[0]);
    expect(() => World.fromSnapshot(JSON.stringify(s), f.w.battlefield)).toThrow();
  };
  forge((s, v) => (v.sourceId = s.player.id));
  forge((s, v) => (v.id = s.nextSunlightVisual));
  forge((_s, v) => (v.radius = 36));
  forge((_s, v) => v.startTick++);
  forge((_s, v) => v.frames.pop());
  forge((_s, v) => (v.frames[0].animationTimeline.primary.clip = 'idle5'));
  forge((_s, v) => (v.frames[0].audience = ['blue', 'blue']));
  f.w.damage(f.w.hero, f.target, 1e6, 'true');
  f.w.step(3);
  forge((_s, v) => (v.frames.at(-1).audience = []));
});
