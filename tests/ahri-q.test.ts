import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_Q } from '../src/content/ahri-q';
import { AHRI } from '../src/content/ahri-progression';
import { readFileSync } from 'node:fs';
import { GROMP_SPAWN_LEADUP_TICKS } from '../src/content/gromp';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (point) => ({ x: point.x, y: point.y }),
    findPath: (_from, to) => [{ x: to.x, y: to.y }],
  });
  w.nextWaveTick = Infinity;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const state = w.championState(ahri.id)!;
  expect(w.learnSpell('q', ahri.id)).toBeNull();
  const cast = () => {
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 10, y: 0 } });
    w.step();
  };
  return { w, ahri, state, cast };
}

test('Q spends source mana/cooldown, commits a 15-tick windup and launches its own orb', () => {
  const { w, ahri, state, cast } = setup();
  cast();
  expect(ahri.mana).toBeCloseTo(418 - 55 + AHRI.manaRegen / 60, 9);
  expect(state.cooldowns.q).toBe(w.tick + 7 * 60);
  expect(state.pendingCast).toMatchObject({ ability: 'q', rank: 1, damage: 35, releaseTick: 16 });
  expect(w.ahriOrbs).toEqual([]);
  w.setOrder(ahri, { type: 'move', point: { x: -200, y: 100 } });
  w.step(14);
  expect(ahri.x).toBe(0);
  expect(w.ahriOrbs).toEqual([]);
  w.step();
  expect(w.ahriOrbs).toHaveLength(1);
  expect(w.ahriOrbs[0]).toMatchObject({ sourceId: ahri.id, launchTick: 16, rank: 1, damage: 35 });
  expect(w.projectiles).toEqual([]);
  expect(w.ahriOrbs[0].position.x).toBeGreaterThan(0);
});

test('a line of targets takes one magic outward hit and one true return hit, without blocking at the first', () => {
  const { w, cast } = setup();
  const targets = [150, 400, 700].map((x) => {
    const target = w.spawn('dummy', 'red', { x, y: 0 });
    target.hp = target.maxHp = 10000;
    target.magicResist = 100;
    return target;
  });
  cast();
  w.step(200);
  for (const target of targets) expect(target.maxHp - target.hp).toBeCloseTo(35 / 2 + 35, 6);
  expect(w.ahriOrbs).toEqual([]);
});

test('outward, turn and return checkpoints preserve contacts and 240 future ticks exactly', () => {
  for (const age of [5, 20, 61, 80]) {
    const { w, cast } = setup();
    const target = w.spawn('dummy', 'red', { x: 400, y: 0 });
    target.hp = target.maxHp = 10000;
    cast();
    w.step(age);
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(240);
    copy.step(240);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('an accepted Q completes through stun but new stunned or silenced Q casts fail', () => {
  const f = setup();
  f.w.applyStun(f.ahri, 60);
  f.cast();
  expect(f.state.pendingCast).toBeNull();
  expect(f.state.cooldowns.q).toBe(0);
  f.w.step(60);
  f.w.applySilence(f.ahri, 60);
  f.cast();
  expect(f.state.pendingCast).toBeNull();
  const committed = setup();
  committed.cast();
  committed.w.applyStun(committed.ahri, 60);
  committed.w.step(15);
  expect(committed.w.ahriOrbs).toHaveLength(1);
});

test('death cancels the windup, while a launched Q retains its captured damage and return', () => {
  for (const age of [5, 20]) {
    const { w, ahri, cast } = setup();
    const enemy = w.spawn('dummy', 'red', { x: 450, y: 0 });
    enemy.hp = enemy.maxHp = 10000;
    enemy.magicResist = 0;
    cast();
    w.step(age);
    w.damage(enemy, ahri, 1e6, 'true');
    const copy = World.fromSnapshot(w.snapshot(), w.battlefield);
    w.step(240);
    copy.step(240);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(enemy.maxHp - enemy.hp).toBe(age < 15 ? 0 : 70);
  }
});

test('strict decoding rejects duplicate/foreign contacts, changed clocks and a displaced outward path', () => {
  const { w, ahri, cast } = setup();
  const target = w.spawn('dummy', 'red', { x: 150, y: 0 });
  target.hp = target.maxHp = 10000;
  cast();
  w.step(20);
  const saved = w.snapshot();
  for (const kind of ['clock', 'duplicate', 'ally', 'position', 'direction', 'rank', 'damage']) {
    const raw = JSON.parse(saved),
      orb = raw.ahriOrbs[0];
    if (kind === 'clock') orb.lastTick--;
    if (kind === 'duplicate') orb.outwardHits.push(target.id);
    if (kind === 'ally') orb.outwardHits.push(ahri.id);
    if (kind === 'position') orb.position.x++;
    if (kind === 'direction') orb.direction.x = 0;
    if (kind === 'rank') orb.rank = 5;
    if (kind === 'damage') orb.damage = AHRI_Q.namedDamageByRank[0] - 1;
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield), kind).toThrow();
  }
});

test('every Q rank uses the root payload and mana table while later inventory changes leave flight damage captured', () => {
  for (let rank = 1; rank <= 5; rank++) {
    const { w, ahri, state, cast } = setup();
    w.gainExperience(1e6, ahri.id);
    for (let learned = 1; learned < rank; learned++) expect(w.learnSpell('q', ahri.id)).toBeNull();
    state.inventory = ['tome'];
    const power = w.abilityPower(ahri);
    const target = w.spawn('dummy', 'red', { x: 450, y: 0 });
    target.hp = target.maxHp = 10000;
    target.magicResist = 0;
    const mana = ahri.mana;
    cast();
    const regeneration = (AHRI.manaRegen + AHRI.manaRegenGrowth * 17) / 60;
    expect(ahri.mana).toBeCloseTo(mana - AHRI_Q.manaByRank[rank - 1] + regeneration, 6);
    w.step(16);
    state.inventory = [];
    w.step(220);
    expect(target.maxHp - target.hp).toBe(2 * (AHRI_Q.namedDamageByRank[rank - 1] + power * 0.5));
  }
});

test('terrain and structures do not consume the orb, and allied targets remain untouched', () => {
  const { w, cast } = setup();
  w.battlefield.lineWalkable = () => false;
  const turret = w.spawn('turret', 'red', { x: 250, y: 0 });
  turret.ai = false;
  const ally = w.spawn('dummy', 'blue', { x: 450, y: 0 });
  const enemy = w.spawn('dummy', 'red', { x: 650, y: 0 });
  enemy.hp = enemy.maxHp = 10000;
  enemy.magicResist = 0;
  cast();
  w.step(240);
  expect(turret.hp).toBe(turret.maxHp);
  expect(ally.hp).toBe(ally.maxHp);
  expect(enemy.maxHp - enemy.hp).toBe(70);
});

test('Ahri AI learns Orb with its own policy and leaves later points available to explicit allocation', () => {
  const w = new World(false, PRACTICE_FIXTURE);
  w.nextWaveTick = Infinity;
  const ahri = w.spawn('champion', 'blue', { x: -650, y: 350 }, 'ahri');
  ahri.ai = true;
  w.step(180);
  expect(w.championState(ahri.id)?.spellRanks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
  expect(w.championState(ahri.id)?.skillPoints).toBe(0);
  expect(w.championState(ahri.id)?.eCharges).toBe(0);
  w.gainExperience(280, ahri.id);
  expect(w.championState(ahri.id)?.skillPoints).toBe(1);
  expect(w.learnSpell('e', ahri.id)).toBeNull();
  expect(w.championState(ahri.id)?.spellRanks).toEqual({ q: 1, w: 0, e: 1, r: 0 });
});

test('an enemy entering only the return path can be hit without an outward contact', () => {
  const { w, cast } = setup();
  const target = w.spawn('dummy', 'red', { x: 400, y: 350 });
  target.hp = target.maxHp = 10000;
  target.magicResist = 0;
  cast();
  w.step(64);
  expect(w.ahriOrbs[0].outwardHits).toEqual([]);
  Object.assign(target, { x: 400, y: 0, previous: { x: 400, y: 0 } });
  w.step(180);
  expect(target.maxHp - target.hp).toBe(35);
});

test('a released return tracks a real Flash endpoint and preserves the resulting future', () => {
  const { w, ahri, cast } = setup();
  cast();
  w.step(64);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'd', point: { x: 0, y: 350 } });
  w.step();
  expect(ahri.y).toBe(350);
  expect(w.ahriOrbs[0].position.y).toBeGreaterThan(0);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  w.step(240);
  copy.step(240);
  expect(w.ahriOrbs).toEqual([]);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('mana and cooldown rejection preserve the accepted cast without spending another payload', () => {
  const { w, ahri, state, cast } = setup();
  ahri.mana = 0;
  cast();
  expect(state.pendingCast).toBeNull();
  expect(state.cooldowns.q).toBe(0);
  ahri.mana = ahri.maxMana;
  cast();
  const accepted = structuredClone(state.pendingCast),
    cooldown = state.cooldowns.q;
  cast();
  expect(state.pendingCast).toEqual(accepted);
  expect(state.cooldowns.q).toBe(cooldown);
  w.step(16);
  expect(w.ahriOrbs).toHaveLength(1);
});

test('runtime Q declarations match both complete child missile records and the root rank calculation', () => {
  const source = JSON.parse(readFileSync('docs/reference/ahri/character.json', 'utf8')).records;
  const root = source['Characters/Ahri/Spells/AhriQAbility/AhriQ'].mSpell;
  expect(AHRI_Q.namedDamageByRank).toEqual(root.DataValues[0].values.slice(1, 6));
  expect(AHRI_Q.namedStatCoefficient).toBe(
    root.mSpellCalculations.TotalDamage.mFormulaParts[1].mCoefficient
  );
  expect(AHRI_Q.castSeconds).toBe(root.mCastTime);
  expect(AHRI_Q.cooldownSecondsByRank).toEqual(root.cooldownTime.slice(1, 6));
  expect(AHRI_Q.manaByRank).toEqual(root.mana.slice(0, 5));
  for (const [id, values] of [
    ['AhriQMissile', AHRI_Q.outward],
    ['AhriQReturnMissile', AHRI_Q.returning],
  ] as const) {
    const spell = source[`Characters/Ahri/Spells/AhriQAbility/${id}`].mSpell;
    const movement = spell.mMissileSpec.movementComponent;
    expect(values.rawCastRange).toEqual(spell.castRange);
    expect(values.authoredWidth).toBe(spell.mMissileSpec.mMissileWidth);
    expect([
      values.initialSpeed,
      values.minimumSpeed,
      values.maximumSpeed,
      values.acceleration,
    ]).toEqual([
      movement.mInitialSpeed,
      movement.mMinSpeed,
      movement.mMaxSpeed,
      movement.mAcceleration,
    ]);
  }
});

test('Q does not record a hit on a protected emerging jungle monster', () => {
  const { w, cast } = setup();
  const monster = w.spawnMonster(
    { x: 400, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  cast();
  w.step(70);
  expect(w.vulnerable(monster)).toBe(false);
  expect(w.ahriOrbs[0].outwardHits).toEqual([]);
  expect(w.ahriOrbs[0].returnHits).toEqual([]);
  expect(monster.hp).toBe(monster.maxHp);
});

test('Q can still apply its return-only hit after that emergence protection ends', () => {
  const { w, cast } = setup();
  const monster = w.spawnMonster(
    { x: 400, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  w.step(150);
  cast();
  w.step(40);
  expect(w.vulnerable(monster)).toBe(false);
  expect(w.ahriOrbs[0].outwardHits).toEqual([]);
  w.step(100);
  expect(w.vulnerable(monster)).toBe(true);
  expect(monster.maxHp - monster.hp).toBe(35);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
