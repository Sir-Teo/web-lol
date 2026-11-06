import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
function setup(hidden = false) {
  let revealed = !hidden;
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => revealed,
    inBrush: () => false,
  });
  w.nextWaveTick = 1e9;
  w.hero.ai = false;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const enemy = w.spawn('champion', 'red', { x: 450, y: 0 }, 'lux');
  Object.assign(enemy, { ai: false, hp: 10000, maxHp: 10000 });
  w.learnSpell('q', ahri.id);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 900, y: 0 } });
  w.step();
  return {
    w,
    ahri,
    enemy,
    reveal: () => {
      revealed = true;
    },
  };
}
function restore(w: World) {
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  return copy;
}
test('every frame restores delayed dispatch and the independent four-second finite life exactly', () => {
  const { w } = setup();
  const r = w.ahriQCastVisuals[0];
  for (let i = 1; i <= 251; i++) {
    const copy = restore(w);
    if (w.tick <= 10) expect(r.birth).toBeNull();
    if (w.tick === 11) expect(r.birth).toEqual({ tick: 11, audience: ['blue', 'red'] });
    if (w.tick === 200) {
      expect(w.ahriOrbAudio).toHaveLength(0);
      expect(w.ahriQCastVisuals).toHaveLength(1);
    }
    if (w.tick === 250) expect(w.ahriQCastVisuals).toHaveLength(1);
    if (w.tick === 251) expect(w.ahriQCastVisuals).toHaveLength(0);
    w.step();
    copy.step();
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});
test('death cancels an unborn event immediately while born particles finish their finite life', () => {
  for (const born of [false, true]) {
    const { w, ahri, enemy } = setup();
    w.step(born ? 19 : 4);
    w.damage(enemy, ahri, 1e6, 'true');
    expect(w.ahriQCastVisuals).toHaveLength(born ? 1 : 0);
    restore(w);
    if (born) {
      w.step(230);
      expect(w.ahriQCastVisuals).toHaveLength(1);
      w.step();
      expect(w.ahriQCastVisuals).toHaveLength(0);
      restore(w);
    }
  }
});
test('birth visibility is captured at the delayed event independently of cast audio', () => {
  const a = setup(true);
  expect(a.w.ahriOrbAudio[0].castAudience).toEqual(['blue']);
  a.w.step(4);
  a.reveal();
  a.w.step(6);
  expect(a.w.ahriQCastVisuals[0].birth?.audience).toEqual(['blue', 'red']);
  restore(a.w);
  const b = setup(true);
  b.w.step(10);
  expect(b.w.ahriQCastVisuals[0].birth?.audience).toEqual(['blue']);
  b.reveal();
  b.w.step();
  expect(b.w.ahriQCastVisuals[0].birth?.audience).toEqual(['blue']);
  restore(b.w);
});
test('two real casters retain independent event clocks without allocating visual identities', () => {
  const { w } = setup();
  const other = w.spawn('champion', 'blue', { x: 0, y: 100 }, 'ahri');
  other.ai = false;
  w.learnSpell('q', other.id);
  w.enqueue({ type: 'cast', unit: other.id, ability: 'q', point: { x: 900, y: 100 } });
  w.step();
  w.step(10);
  expect(w.ahriQCastVisuals.map((r) => r.birth?.tick)).toEqual([11, 12]);
  expect(w.ahriQCastVisuals.every((r) => !('id' in r))).toBe(true);
  restore(w);
});
test('victory cancels pending dispatch but leaves a born finite record without future World mutation', () => {
  for (const born of [false, true]) {
    const { w } = setup();
    w.step(born ? 19 : 4);
    const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
    w.damage(w.hero, nexus, 1e6, 'true');
    expect(w.winner).toBe('blue');
    expect(w.ahriQCastVisuals).toHaveLength(born ? 1 : 0);
    restore(w);
    const saved = w.snapshot();
    w.step(1000);
    expect(w.snapshot()).toBe(saved);
  }
});
test('strict restore rejects forged owners, missing pending events, geometry and birth clocks/audiences', () => {
  const { w } = setup();
  const changes = [
    (s: any) => delete s.ahriQCastVisuals,
    (s: any) => (s.ahriQCastVisuals[0].sourceId = w.hero.id),
    (s: any) => s.ahriQCastVisuals[0].origin.x++,
    (s: any) => s.ahriQCastVisuals.push(s.ahriQCastVisuals[0]),
    (s: any) => (s.ahriQCastVisuals[0].birth = { tick: 11, audience: ['blue'] }),
  ];
  for (const change of changes) {
    const s = JSON.parse(w.snapshot());
    change(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
  w.step(10);
  for (const change of [
    (s: any) => s.ahriQCastVisuals[0].birth.tick++,
    (s: any) => (s.ahriQCastVisuals[0].birth.audience = ['red']),
    (s: any) => (s.ahriQCastVisuals[0].birth.audience = ['blue', 'blue']),
    (s: any) => s.ahriQCastVisuals[0].aim.x++,
  ]) {
    const s = JSON.parse(w.snapshot());
    change(s);
    expect(() => World.fromSnapshot(JSON.stringify(s), w.battlefield)).toThrow();
  }
});
