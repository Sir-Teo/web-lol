import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_W } from '../src/content/ahri-w';
import { AHRI } from '../src/content/ahri-progression';
import { SUMMONER_HEAL } from '../src/content/summoner-heal';
import { readFileSync } from 'node:fs';
import { GROMP_SPAWN_LEADUP_TICKS } from '../src/content/gromp';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (point) => ({ x: point.x, y: point.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const state = w.championState(ahri.id)!;
  expect(w.learnSpell('w', ahri.id)).toBeNull();
  const cast = () => {
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'w', point: { x: 0, y: 0 } });
    w.step();
  };
  const victim = (x = 300) => {
    const unit = w.spawn('dummy', 'red', { x, y: 0 });
    unit.hp = unit.maxHp = 10000;
    unit.magicResist = 0;
    return unit;
  };
  return { w, ahri, state, cast, victim };
}

test('W spends its own resources, creates exactly three orbits and linearly decays its movement boost', () => {
  const { w, ahri, state, cast } = setup();
  cast();
  expect(w.abilitySpec('w', ahri.id).name).toBe('Fox-Fire');
  expect(ahri.mana).toBeCloseTo(418 - 30 + AHRI.manaRegen / 60, 9);
  expect(state.cooldowns.w).toBe(w.tick + 9 * 60);
  expect(state.pendingCast?.releaseTick).toBe(w.tick + 15);
  expect(w.ahriFoxFires).toHaveLength(1);
  expect(w.ahriFoxFires[0].fires.map((fire) => fire.phase)).toEqual(['orbit', 'orbit', 'orbit']);
  expect(w.movementSpeed(ahri)).toBeCloseTo(330 * (1 + AHRI_W.movementSpeedFraction), 8);
  w.step(60);
  expect(w.movementSpeed(ahri)).toBeCloseTo(330 * (1 + AHRI_W.movementSpeedFraction / 2), 8);
  w.step(60);
  expect(w.movementSpeed(ahri)).toBe(330);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.phase === 'orbit')).toBe(true);
  w.step(30);
  expect(w.ahriFoxFires).toEqual([]);
});

test('all three fires can hit one target with one full and two reduced magic payloads', () => {
  const { w, cast, victim } = setup(),
    target = victim();
  cast();
  w.step(80);
  const fires = w.ahriFoxFires[0].fires;
  expect(fires.every((fire) => fire.stopReason === 'hit' && fire.targetId === target.id)).toBe(
    true
  );
  expect(fires.filter((fire) => fire.hit?.repeat === false)).toHaveLength(1);
  expect(fires.filter((fire) => fire.hit?.repeat === true)).toHaveLength(2);
  expect(target.maxHp - target.hp).toBeCloseTo(40 * (1 + 2 * AHRI_W.repeatDamageMultiplier), 7);
});

test('ordinary acquisition waits 24 ticks while a visible ordered target can use the 15-tick priority window', () => {
  for (const priority of [false, true]) {
    const { w, ahri, cast, victim } = setup(),
      target = victim(300);
    ahri.damage = 0;
    if (priority) w.setOrder(ahri, { type: 'attack', target: target.id });
    cast();
    w.step(14);
    expect(w.ahriFoxFires[0].fires.every((fire) => fire.phase === 'orbit')).toBe(true);
    w.step();
    expect(w.ahriFoxFires[0].fires.some((fire) => fire.phase === 'flight')).toBe(priority);
    if (!priority) {
      w.step(8);
      expect(w.ahriFoxFires[0].fires.every((fire) => fire.phase === 'orbit')).toBe(true);
      w.step();
      expect(w.ahriFoxFires[0].fires.some((fire) => fire.phase === 'flight')).toBe(true);
    }
  }
});

test('hidden enemies are not acquired, and becoming visible during the orbit opens acquisition', () => {
  const { w, cast, victim } = setup(),
    target = victim();
  w.battlefield.lineOfSight = () => false;
  cast();
  w.step(35);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.targetId === null)).toBe(true);
  expect(target.hp).toBe(target.maxHp);
  w.battlefield.lineOfSight = () => true;
  w.step(80);
  expect(target.hp).toBeLessThan(target.maxHp);
});

test('low-health lane minion bonuses are evaluated per impact and do not apply to dummies', () => {
  for (const initial of [2000, 2001]) {
    const { w, cast } = setup();
    const target = w.spawn('caster', 'red', { x: 300, y: 0 });
    target.ai = false;
    target.maxHp = 10000;
    target.hp = initial;
    target.magicResist = 0;
    cast();
    w.step(80);
    expect(initial - target.hp).toBeCloseTo(initial === 2000 ? 144 : 104, 5);
    expect(w.ahriFoxFires[0].fires.filter((fire) => fire.hit?.minionBonus)).toHaveLength(
      initial === 2000 ? 3 : 2
    );
  }
});

test('death cancels waiting orbits but already dispatched shots keep their payload and saved future', () => {
  for (const age of [5, 30]) {
    const { w, ahri, cast, victim } = setup(),
      target = victim(400);
    cast();
    w.step(age);
    w.damage(target, ahri, 1e6, 'true');
    expect(w.movementSpeed(ahri)).toBe(330);
    expect(w.ahriFoxFires.length).toBe(age < 15 ? 0 : 1);
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    w.step(240);
    copy.step(240);
    expect(copy.snapshot()).toBe(w.snapshot());
    expect(target.maxHp - target.hp).toBeCloseTo(age < 15 ? 0 : 72, 5);
  }
});

test('windup, orbit, flight, hit and expiry checkpoints retain exact 300-tick continuations', () => {
  for (const age of [1, 10, 16, 26, 40, 80, 119, 120, 150]) {
    const { w, cast, victim } = setup();
    victim();
    cast();
    w.step(age);
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('strict saved W state rejects count, index, timing, rank, orbit and hit-fact forgeries', () => {
  const { w, cast, victim } = setup();
  victim();
  cast();
  w.step(80);
  const saved = w.snapshot();
  for (const kind of ['count', 'index', 'clock', 'rank', 'repeat', 'reason']) {
    const raw = JSON.parse(saved),
      record = raw.ahriFoxFires[0];
    if (kind === 'count') record.fires.pop();
    if (kind === 'index') record.fires[0].index = 1;
    if (kind === 'clock') record.lastTick--;
    if (kind === 'rank') record.rank = 5;
    if (kind === 'repeat') record.fires.find((fire: any) => fire.hit?.repeat).hit.repeat = false;
    if (kind === 'reason') record.fires[0].stopReason = 'expired';
    expect(() => World.fromSnapshot(JSON.stringify(raw), w.battlefield), kind).toThrow();
  }
  const fresh = setup();
  fresh.cast();
  fresh.w.step(5);
  const raw = JSON.parse(fresh.w.snapshot());
  raw.ahriFoxFires[0].fires[0].position.x++;
  expect(() => World.fromSnapshot(JSON.stringify(raw), fresh.w.battlefield)).toThrow();
});

test('a later cast killing an earlier orbit owner preserves an exact death-frame checkpoint', () => {
  const { w, ahri, cast } = setup();
  w.battlefield.lineOfSight = (from) => from.x > 150;
  ahri.hp = 1;
  const enemy = w.spawn('champion', 'red', { x: 300, y: 0 }, 'ahri');
  enemy.ai = false;
  expect(w.learnSpell('w', enemy.id)).toBeNull();
  cast();
  w.enqueue({ type: 'cast', unit: enemy.id, ability: 'w', point: { x: 300, y: 0 } });
  for (let step = 0; step < 120 && ahri.deadAt === null; step++) w.step();
  expect(ahri.deadAt).toBe(w.tick);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  expect(copy.snapshot()).toBe(saved);
  w.step(240);
  copy.step(240);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('Q flight and Fox-Fire coexist after their windups without rewriting either payload', () => {
  const { w, ahri, cast, victim } = setup(),
    target = victim();
  w.gainExperience(280, ahri.id);
  expect(w.learnSpell('q', ahri.id)).toBeNull();
  cast();
  w.step(16);
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'q', point: { x: 10, y: 0 } });
  w.step(21);
  expect(w.ahriFoxFires).toHaveLength(1);
  expect(w.ahriOrbs).toHaveLength(1);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  w.step(300);
  copy.step(300);
  expect(copy.snapshot()).toBe(w.snapshot());
  expect(target.maxHp - target.hp).toBeCloseTo(72 + 70, 5);
});

test('losing a committed target spends those fires and does not retarget or refund them', () => {
  const { w, ahri, state, cast, victim } = setup(),
    target = victim();
  cast();
  w.step(25);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.phase === 'flight')).toBe(true);
  const cooldown = state.cooldowns.w;
  w.damage(w.hero, target, 1e6, 'true');
  const replacement = victim();
  w.step(40);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.stopReason === 'lost-target')).toBe(true);
  expect(replacement.hp).toBe(replacement.maxHp);
  expect(state.cooldowns.w).toBe(cooldown);
  expect(state.spellRanks.w).toBe(1);
  expect(ahri.mana).toBeLessThan(ahri.maxMana);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});

test('the decaying W bonus adds to ordinary Heal speed and preserves the active cast checkpoint', () => {
  const { w, ahri, cast } = setup();
  cast();
  w.enqueue({ type: 'cast', unit: ahri.id, ability: 'f', point: { x: 0, y: 0 } });
  w.step();
  expect(w.movementSpeed(ahri)).toBeCloseTo(
    330 * (1 + SUMMONER_HEAL.speedBonus + AHRI_W.movementSpeedFraction * (1 - 1 / 120)),
    8
  );
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  w.step(180);
  copy.step(180);
  expect(copy.snapshot()).toBe(w.snapshot());
});

test('all five W ranks retain their source costs, damage/repeat formulas, curves and distinct orbit lifetime', () => {
  const records = JSON.parse(readFileSync('docs/reference/ahri/character.json', 'utf8')).records;
  const root = records['Characters/Ahri/Spells/AhriWAbility/AhriW'].mSpell;
  const named = Object.fromEntries(root.DataValues.map((value: any) => [value.name, value.values]));
  expect(AHRI_W.cooldownSecondsByRank).toEqual(root.cooldownTime.slice(1, 6));
  expect(AHRI_W.manaByRank).toEqual(root.mana.slice(0, 5));
  expect(AHRI_W.damageByRank).toEqual(named.BaseDamage.slice(1, 6));
  expect(AHRI_W.abilityPowerRatio).toBe(named.APRatio[0]);
  expect(AHRI_W.repeatDamageMultiplier).toBe(named.RepeatDamageMod[0]);
  expect(AHRI_W.namedFlameDurationSeconds).toBe(2.5);
  expect(AHRI_W.orbit.lifetimeSeconds).toBe(5);
  for (let rank = 1; rank <= 5; rank++) {
    const { w, ahri, state, cast, victim } = setup(),
      target = victim();
    w.gainExperience(1e6, ahri.id);
    for (let learned = 1; learned < rank; learned++) expect(w.learnSpell('w', ahri.id)).toBeNull();
    state.inventory = ['tome'];
    const power = w.abilityPower(ahri),
      mana = ahri.mana;
    cast();
    expect(ahri.mana).toBeCloseTo(mana - 30 + (AHRI.manaRegen + AHRI.manaRegenGrowth * 17) / 60, 6);
    expect(state.cooldowns.w).toBe(w.tick + AHRI_W.cooldownSecondsByRank[rank - 1] * 60);
    w.step(20);
    state.inventory = [];
    w.step(60);
    expect(target.maxHp - target.hp).toBeCloseTo(
      (AHRI_W.damageByRank[rank - 1] + power * AHRI_W.abilityPowerRatio) *
        (1 + 2 * AHRI_W.repeatDamageMultiplier),
      6
    );
  }
});

test('only the current visible ordered target can use the extended acquisition range', () => {
  for (const priority of [false, true]) {
    const { w, ahri, cast, victim } = setup(),
      target = victim(825);
    w.applyRoot(ahri, 60);
    if (priority) w.setOrder(ahri, { type: 'attack', target: target.id });
    cast();
    w.step(50);
    expect(target.hp < target.maxHp).toBe(priority);
    expect(w.ahriFoxFires[0].fires.some((fire) => fire.targetId === target.id)).toBe(priority);
  }
});

test('ordinary visible champion candidates take precedence over nearer lane minions', () => {
  const { w, cast } = setup();
  const enemy = w.spawn('champion', 'red', { x: 350, y: 0 }, 'lux');
  enemy.ai = false;
  enemy.hp = enemy.maxHp = 10000;
  const minion = w.spawn('caster', 'red', { x: 100, y: 0 });
  minion.ai = false;
  cast();
  w.step(80);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.targetId === enemy.id)).toBe(true);
  expect(minion.hp).toBe(minion.maxHp);
});

test('terminal settlement clears active fires and freezes their exact restored match', () => {
  const { w, cast } = setup();
  cast();
  const nexus = w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  w.damage(w.hero, nexus, 1e6, 'true');
  expect(w.winner).toBe('blue');
  expect(w.ahriFoxFires).toEqual([]);
  const saved = w.snapshot(),
    copy = World.fromSnapshot(saved, w.battlefield);
  w.step(300);
  copy.step(300);
  expect(w.snapshot()).toBe(saved);
  expect(copy.snapshot()).toBe(saved);
});

test('Fox-Fire does not acquire a protected emerging jungle monster', () => {
  const { w, cast } = setup();
  const monster = w.spawnMonster(
    { x: 300, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  cast();
  w.step(80);
  expect(w.vulnerable(monster)).toBe(false);
  expect(
    w.ahriFoxFires[0].fires.every((fire) => fire.phase === 'orbit' && fire.targetId === null)
  ).toBe(true);
  expect(monster.hp).toBe(monster.maxHp);
});

test('orbiting fires can acquire that monster once its real emergence protection ends', () => {
  const { w, cast } = setup();
  const monster = w.spawnMonster(
    { x: 300, y: 0 },
    { startTick: 0, readyTick: GROMP_SPAWN_LEADUP_TICKS }
  );
  w.step(150);
  cast();
  w.step(30);
  expect(w.vulnerable(monster)).toBe(false);
  expect(w.ahriFoxFires[0].fires.every((fire) => fire.targetId === null)).toBe(true);
  w.step(50);
  expect(w.vulnerable(monster)).toBe(true);
  expect(
    w.ahriFoxFires[0].fires.every(
      (fire) => fire.targetId === monster.id && fire.stopReason === 'hit'
    )
  ).toBe(true);
  expect(monster.hp).toBeLessThan(monster.maxHp);
  expect(World.fromSnapshot(w.snapshot(), w.battlefield).snapshot()).toBe(w.snapshot());
});
