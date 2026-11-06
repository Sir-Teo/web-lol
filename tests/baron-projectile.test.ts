import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { BARON } from '../src/content/baron';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createBaronEncounter } from '../src/simulation/baron-encounter';
import { World } from '../src/simulation/world';

const field = { ...PRACTICE_FIXTURE, developmentBaron: true as const, lineOfSight: () => true };
function setup() {
  const w = createBaronEncounter(field),
    b = w.units.find((u) => u.monster?.species === 'baron')!;
  w.damage(w.hero, b, 1, 'true');
  w.step();
  expect(b.releaseTick).toBeGreaterThan(w.tick);
  return { w, b, release: b.releaseTick! };
}

test('Baron default ranged attack speed follows the selected source attack and fixed-speed missile', () => {
  const data = JSON.parse(readFileSync('docs/reference/epic-character-source.json', 'utf8'))
    .records['data/characters/sru_baron/sru_baron.bin'];
  const root = data['Characters/SRU_Baron/CharacterRecords/Root'];
  const name = root.extraAttacks[0].mAttackName;
  const attack: any = Object.values(data).find((r: any) => r.ObjectName === name);
  expect(name).toBe('BaronBasicAttack');
  expect(attack.mSpell.mMissileSpec.movementComponent.__type).toBe('FixedSpeedMovement');
  expect(BARON.missileSpeed).toBe(attack.mSpell.mMissileSpec.movementComponent.mSpeed);
  expect(BARON.missileSpeed).toBe(1300);
});

test('Baron releases a travelling attack before damage and restores the exact in-flight future', () => {
  const { w, b, release } = setup(),
    hp = w.hero.hp;
  w.step(release - w.tick);
  expect(w.hero.hp).toBe(hp);
  const p = w.projectiles.find((p) => p.source === b.id)!;
  expect(p).toMatchObject({
    type: 'attack',
    team: 'neutral',
    target: w.hero.id,
    speed: 1300,
    launchTick: release,
    damage: b.damage,
  });
  expect(p.x).toBeCloseTo(b.x - 1300 / 60);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, field);
  expect(copy.snapshot()).toBe(saved);
  for (let i = 0; i < 90 && w.hero.hp === hp; i++) {
    w.step();
    copy.step();
  }
  expect(w.hero.hp).toBeLessThan(hp);
  expect(w.tick).toBe(release + 18);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('a released Baron attack survives source death and keeps its captured damage', () => {
  const { w, b, release } = setup(),
    hp = w.hero.hp;
  w.step(release - w.tick);
  expect(w.hero.hp).toBe(hp);
  const p = w.projectiles.find((p) => p.source === b.id)!;
  const damage = p.damage;
  w.damage(w.hero, b, 1e6, 'true');
  expect(b.hp).toBe(0);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, field);
  w.step(30);
  copy.step(30);
  expect(w.hero.hp).toBeLessThan(hp);
  expect(
    w.events.some(
      (e) =>
        e.type === 'damage' &&
        e.team === 'neutral' &&
        e.unit === w.hero.id &&
        e.value === Math.round(damage / (1 + w.hero.armor / 100))
    )
  ).toBe(true);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('a target Flash extends the homing flight without changing speed or damaging before contact', () => {
  const { w, b, release } = setup(),
    hp = w.hero.hp;
  w.step(release - w.tick);
  w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: -400, y: 0 } });
  w.step();
  expect(w.hero.x).toBeLessThan(-300);
  w.step(18);
  expect(w.hero.hp).toBe(hp);
  expect(w.projectiles.find((p) => p.source === b.id)?.speed).toBe(1300);
  const copy = World.fromSnapshot(w.snapshot(), field);
  for (let i = 0; i < 90 && w.hero.hp === hp; i++) {
    w.step();
    copy.step();
  }
  expect(w.hero.hp).toBeLessThan(hp);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('target death retires a released Baron missile without a second damage event', () => {
  const { w, b, release } = setup();
  w.step(release - w.tick);
  w.damage(b, w.hero, 1e6, 'true');
  const events = w.events.filter((e) => e.type === 'damage' && e.unit === w.hero.id).length;
  const copy = World.fromSnapshot(w.snapshot(), field);
  w.step();
  copy.step();
  expect(w.projectiles.filter((p) => p.source === b.id)).toEqual([]);
  expect(w.events.filter((e) => e.type === 'damage' && e.unit === w.hero.id)).toHaveLength(events);
  expect(copy.snapshot()).toBe(w.snapshot());
});

for (const change of [
  { speed: 1301 },
  { team: 'blue' },
  { radius: 9 },
  { target: null },
  { remaining: 4001 },
  { launchTick: 100000 },
  { origin: undefined },
])
  test(`saved Baron missile rejects edited ${Object.keys(change)[0]}`, () => {
    const { w, b, release } = setup();
    w.step(release - w.tick);
    const raw = JSON.parse(w.snapshot());
    Object.assign(
      raw.projectiles.find((p: any) => p.source === b.id),
      change
    );
    expect(() => World.fromSnapshot(JSON.stringify(raw), field)).toThrow();
  });
