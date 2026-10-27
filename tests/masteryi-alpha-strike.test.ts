import { expect, test } from 'vitest';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { MASTER_YI_Q } from '../src/content/masteryi-q';
import { experienceToNextLevel } from '../src/simulation/progression';
import { grantRedBuff } from '../src/simulation/red-buff';

function fixture(rank = 1) {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.x = w.hero.y = -5000;
  const yi = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'masteryi');
  yi.ai = false;
  const state = w.championState(yi.id)!;
  while (state.level < Math.max(1, 1 + 2 * (rank - 1)))
    w.gainExperience(experienceToNextLevel(state.level), yi.id);
  for (let i = 0; i < rank; i++) expect(w.learnSpell('q', yi.id)).toBeNull();
  const target = w.spawn('dummy', 'red', { x: 300, y: 0 });
  target.hp = target.maxHp = 1e6;
  target.armor = 0;
  const cast = (
    ability: 'q' | 'w' | 'e' | 'r' = 'q',
    targetId: number | undefined = ability === 'q' ? target.id : undefined
  ) => {
    w.enqueue({ type: 'cast', unit: yi.id, ability, point: target, targetId });
    w.step();
  };
  const resume = (ticks = 150) => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    w.step(ticks);
    copy.step(ticks);
    expect(copy.snapshot()).toBe(w.snapshot());
  };
  return { w, yi, state, target, cast, resume };
}

test('own Q accepts an explicit enemy, pays own resources and becomes untargetable without blanket damage immunity', () => {
  const f = fixture(),
    mana = f.yi.mana;
  expect(f.w.abilitySpec('q', f.yi.id)).toMatchObject({
    name: 'Alpha Strike',
    range: 600,
    cantCastWhileRooted: true,
  });
  f.cast();
  expect(f.state.alphaStrike).toMatchObject({
    rank: 1,
    startTick: f.w.tick,
    marks: [],
    reappearTick: null,
  });
  expect(f.state.cooldowns.q - f.w.tick).toBe(1200);
  expect(mana - f.yi.mana).toBeCloseTo(50 - 1.4500000476837158 / 60, 6);
  expect(f.w.targetable(f.yi)).toBe(false);
  expect(f.w.vulnerable(f.yi)).toBe(true);
  const hp = f.yi.hp;
  f.w.damage(f.target, f.yi, 10, 'true', 'proc');
  expect(f.yi.hp).toBe(hp - 10);
  f.resume();
});

test.each([1, 2, 3, 4, 5])(
  'Q rank %i uses frozen resource/damage ranks and independent delayed/repeated contacts',
  (rank) => {
    const f = fixture(rank),
      base = MASTER_YI_Q.baseDamageByRank[rank - 1] + f.yi.damage * MASTER_YI_Q.attackDamageRatio;
    f.cast();
    const start = f.w.tick;
    f.w.step(13);
    expect(f.state.alphaStrike!.marks).toEqual([]);
    expect(f.target.hp).toBe(1e6);
    f.w.step();
    expect(f.state.alphaStrike!.marks[0]).toMatchObject({
      tick: start + 14,
      result: 'pending',
      repeatIndex: 0,
    });
    expect(f.target.hp).toBe(1e6);
    f.w.step(14);
    expect(1e6 - f.target.hp).toBeCloseTo(base * 0.25, 6);
    f.w.step(14);
    expect(1e6 - f.target.hp).toBeCloseTo(base * 0.5, 6);
    f.w.step(14);
    expect(1e6 - f.target.hp).toBeCloseTo(base * 1.75, 6);
    expect(f.state.alphaStrike!.marks.map((m) => m.result)).toEqual(['hit', 'hit', 'hit', 'hit']);
    expect(f.state.alphaStrike!.reappearTick).toBe(start + 56);
    expect(f.w.targetable(f.yi)).toBe(true);
    expect(f.state.doubleStrike!.stacks).toBe(0);
    expect(f.state.cooldowns.q).toBe(
      start + Math.ceil(MASTER_YI_Q.cooldownSecondsByRank[rank - 1] * 60)
    );
    f.w.step(9);
    expect(f.state.alphaStrike).not.toBeNull();
    f.w.step();
    expect(f.state.alphaStrike).toBeNull();
    f.resume();
  }
);

test('four distinct nearby enemies wait for reappearance and receive one full mark each', () => {
  const f = fixture();
  const others = [400, 500, 600].map((x) => {
    const t = f.w.spawn('dummy', 'red', { x, y: 0 });
    t.hp = t.maxHp = 1e6;
    t.armor = 0;
    return t;
  });
  f.cast();
  f.w.step(55);
  expect([f.target, ...others].every((t) => t.hp === 1e6)).toBe(true);
  expect(f.state.alphaStrike!.marks.map((m) => m.targetId)).toEqual([
    f.target.id,
    others[0].id,
    others[1].id,
  ]);
  f.w.step();
  const damages = [f.target, ...others].map((t) => 1e6 - t.hp);
  expect(damages.every((d) => Math.abs(d - damages[0]) < 1e-8)).toBe(true);
  expect(damages[0]).toBeGreaterThan(60);
  f.resume();
});

test('two enemies repeat in balanced first-mark order, without global selection RNG', () => {
  const f = fixture(),
    other = f.w.spawn('dummy', 'red', { x: 400, y: 0 });
  other.hp = other.maxHp = 1e6;
  const rng = f.w.random.state;
  f.cast();
  f.w.step(56);
  expect(f.state.alphaStrike!.marks.map((m) => [m.targetId, m.repeatIndex])).toEqual([
    [f.target.id, 0],
    [other.id, 0],
    [f.target.id, 1],
    [other.id, 1],
  ]);
  expect(f.w.random.state).toBe(rng);
  f.resume();
});

test.each([
  'unlearned',
  'mana',
  'stun',
  'silence',
  'root',
  'cooldown',
  'missing',
  'ally',
  'far',
  'dead-target',
  'structure',
  'ward',
] as const)('%s rejects Q without starting its phases', (reason) => {
  const f = fixture(reason === 'unlearned' ? 0 : 1);
  let id: number | undefined = f.target.id;
  if (reason === 'mana') f.yi.mana = 0;
  if (reason === 'stun') f.w.applyStun(f.yi, 60);
  if (reason === 'silence') f.w.applySilence(f.yi, 60);
  if (reason === 'root') f.yi.rootUntil = 60;
  if (reason === 'cooldown') f.state.cooldowns.q = 60;
  if (reason === 'missing') id = undefined;
  if (reason === 'ally') id = f.w.spawn('dummy', 'blue', { x: 300, y: 0 }).id;
  if (reason === 'far') f.target.x = 601;
  if (reason === 'dead-target') f.w.damage(f.yi, f.target, 1e9, 'true');
  if (reason === 'structure') id = f.w.spawn('turret', 'red', { x: 300, y: 0 }).id;
  if (reason === 'ward')
    id = f.w.spawnWard({
      ownerId: f.w.spawn('champion', 'red', { x: 0, y: 0 }).id,
      team: 'red',
      point: { x: 300, y: 0 },
      startTick: 0,
      readyTick: 0,
      origin: { x: 0, y: 0 },
      lifeTicks: 600,
    }).id;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: 'q', point: f.target, targetId: id });
  f.w.step();
  expect(f.state.alphaStrike).toBeNull();
});

test('visible/targetable gates cover new controls and area collision while an attached Cinders burn continues', () => {
  const f = fixture(),
    ashe = f.w.spawn('champion', 'red', { x: -150, y: 0 }, 'ashe');
  ashe.ai = false;
  grantRedBuff(f.w.championState(ashe.id)!, f.w.tick);
  f.w.setOrder(ashe, { type: 'attack', target: f.yi.id });
  f.w.step(60);
  f.w.setOrder(ashe, { type: 'idle' });
  expect(f.yi.cinderBurn).not.toBeNull();
  const hp = f.yi.hp;
  f.cast();
  expect(f.w.applyStun(f.yi, 60)).toBe(false);
  expect(f.w.applyRoot(f.yi, 60)).toBe(false);
  expect(f.w.applySilence(f.yi, 60)).toBe(false);
  expect(f.w.applySlow(ashe, f.yi, 'frost', 120, 0.7)).toBe(false);
  f.w.enqueue({ type: 'cast', unit: ashe.id, ability: 'w', point: f.yi });
  f.w.step(30);
  expect(f.yi.hp).toBeLessThan(hp);
  expect(f.yi.stunUntil).toBeLessThanOrEqual(f.w.tick);
  f.resume();
});

test('E/R durations pause while vanished; W interrupts before Q, and W/Flash cannot replace Q', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  for (const a of ['w', 'e', 'r'] as const) expect(f.w.learnSpell(a, f.yi.id)).toBeNull();
  f.cast('e');
  f.cast('r');
  f.cast('w');
  f.w.step(20);
  f.cast();
  expect(f.state.meditate!.stopReason).toBe('order');
  const e = structuredClone(f.state.wujuStyle!),
    r = structuredClone(f.state.highlander!);
  f.state.cooldowns.w = f.w.tick;
  f.cast('w');
  expect(f.state.meditate!.stopReason).toBe('order');
  const flash = f.w.summonerSlot('flash', f.yi.id)!;
  f.w.enqueue({ type: 'cast', unit: f.yi.id, ability: flash, point: { x: 1000, y: 0 } });
  f.w.step();
  expect(f.yi.x).toBe(0);
  expect(f.state.cooldowns[flash]).toBe(0);
  f.w.step(54);
  expect(f.state.alphaStrike!.reappearTick).toBe(f.w.tick);
  expect(f.state.wujuStyle!.pausedTicks - e.pausedTicks).toBe(56);
  expect(f.state.highlander!.pausedTicks - r.pausedTicks).toBe(56);
  f.resume();
});

test('scaled E on-hits total 75% + three 18.75% procs and never count as basic attacks', () => {
  const f = fixture();
  f.w.gainExperience(280, f.yi.id);
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  f.cast('e');
  f.cast();
  const physical = MASTER_YI_Q.baseDamageByRank[0] + f.yi.damage * MASTER_YI_Q.attackDamageRatio;
  f.w.step(56);
  expect(1e6 - f.target.hp).toBeCloseTo(physical * 1.75 + 20 * (0.75 + 3 * 0.1875), 6);
  expect(f.state.doubleStrike!.stacks).toBe(0);
  expect(f.state.cooldowns.q - f.state.alphaStrike!.startTick).toBe(1200);
  f.resume();
});

test.each([0, 13, 14, 27, 28, 42, 55, 56, 60, 65, 66])(
  'Q age %i saves exact phase bytes and a deterministic future',
  (age) => {
    const f = fixture();
    f.cast();
    f.w.step(age);
    f.resume();
  }
);

test('an already flying fixed-target attack fizzles when Q vanishes, while area attacks can continue to other enemies', () => {
  const f = fixture(),
    ashe = f.w.spawn('champion', 'red', { x: -500, y: 0 }, 'ashe');
  ashe.ai = false;
  f.w.setOrder(ashe, { type: 'attack', target: f.yi.id });
  f.w.step();
  f.w.step(ashe.releaseTick! - f.w.tick);
  f.w.setOrder(ashe, { type: 'idle' });
  expect(f.w.projectiles.some((p) => p.target === f.yi.id)).toBe(true);
  const hp = f.yi.hp;
  f.cast();
  expect(f.w.projectiles.some((p) => p.target === f.yi.id)).toBe(false);
  f.w.step(5);
  expect(f.yi.hp).toBe(hp);
  f.resume();
});

test('attached burn continues identically whether a new Volley crosses the vanished owner or not', () => {
  const f = fixture(),
    ashe = f.w.spawn('champion', 'red', { x: -150, y: 0 }, 'ashe');
  ashe.ai = false;
  grantRedBuff(f.w.championState(ashe.id)!, f.w.tick);
  f.w.setOrder(ashe, { type: 'attack', target: f.yi.id });
  f.w.step(60);
  f.w.setOrder(ashe, { type: 'idle' });
  f.cast();
  const copy = World.fromSnapshot(f.w.snapshot(), f.w.battlefield);
  f.w.enqueue({ type: 'cast', unit: ashe.id, ability: 'w', point: f.yi });
  f.w.step(30);
  copy.step(30);
  expect(f.yi.hp).toBe(copy.unit(f.yi.id)!.hp);
  expect(f.yi.cinderBurn).toEqual(copy.unit(f.yi.id)!.cinderBurn);
  f.resume();
});

test('return follows a moving primary and an exit-direction selection; recovery buffers the eventual move', () => {
  const f = fixture();
  f.cast();
  f.w.step(20);
  f.target.x = 450;
  f.target.y = 100;
  f.w.setOrder(f.yi, { type: 'move', point: { x: 550, y: 100 } });
  expect(f.yi.order).toEqual({ type: 'idle' });
  expect(f.state.alphaStrike!.exitDirection).toEqual({ x: 1, y: 0 });
  f.w.step(36);
  expect({ x: f.yi.x, y: f.yi.y }).toEqual({ x: 525, y: 100 });
  expect(f.yi.previous).toEqual({ x: 525, y: 100 });
  f.w.setOrder(f.yi, { type: 'move', point: { x: 1000, y: 100 } });
  expect(f.yi.order).toEqual({ type: 'idle' });
  const saved = f.w.snapshot(),
    copy = World.fromSnapshot(saved, f.w.battlefield);
  f.w.step(10);
  copy.step(10);
  expect(f.yi.order.type).toBe('move');
  expect(f.yi.x).toBeGreaterThan(525);
  expect(copy.snapshot()).toBe(f.w.snapshot());
});

test.each(['dead', 'teleported', 'hidden'] as const)(
  'a %s sole target ends Q at the next mark boundary and returns to origin',
  (loss) => {
    let hidden = false;
    const f = fixture();
    if (loss === 'hidden') f.w.battlefield.lineOfSight = () => !hidden;
    f.cast();
    f.w.step(14);
    if (loss === 'dead') f.w.damage(f.yi, f.target, 1e9, 'true');
    if (loss === 'teleported') f.target.x = 3000;
    if (loss === 'hidden') hidden = true;
    f.w.step(14);
    expect(f.state.alphaStrike).toMatchObject({
      stopReason: 'lost',
      reappearTick: f.w.tick,
      marks: [{ result: 'lost' }],
    });
    expect({ x: f.yi.x, y: f.yi.y }).toEqual({ x: 0, y: 0 });
    f.resume();
  }
);

test('primary death allows other eligible marks, but the captured return still falls back to origin', () => {
  const f = fixture(),
    other = f.w.spawn('dummy', 'red', { x: 400, y: 0 });
  other.hp = other.maxHp = 1e6;
  other.armor = 0;
  f.cast();
  f.w.step(14);
  f.w.damage(f.yi, f.target, 1e9, 'true');
  f.w.step(42);
  expect(f.state.alphaStrike!.stopReason).toBe('complete');
  expect(f.state.alphaStrike!.marks[0].result).toBe('lost');
  expect(f.state.alphaStrike!.marks.slice(1).every((m) => m.targetId === other.id)).toBe(true);
  expect({ x: f.yi.x, y: f.yi.y }).toEqual({ x: 0, y: 0 });
  f.resume();
});

test('each mark captures live AD independently and guaranteed crits use saved own critical payloads', () => {
  const f = fixture();
  f.state.inventory = Array(6).fill('agility');
  f.cast();
  f.w.step(14);
  const first = structuredClone(f.state.alphaStrike!.marks[0]);
  expect(first.critical).toBe(true);
  f.yi.damage += 100;
  f.w.step(14);
  const next = f.state.alphaStrike!.marks[1];
  expect(next.critical).toBe(true);
  expect(next.damage * 4 - first.damage).toBeCloseTo(100 * MASTER_YI_Q.attackDamageRatio * 2, 6);
  f.resume();
});

test('a monster mark adds its own rank bonus and preserves normal armor mitigation', () => {
  const f = fixture(),
    monster = f.w.spawnMonster({ x: 300, y: 0 }, null, 'gromp');
  monster.hp = monster.maxHp = 1e6;
  monster.armor = 0;
  f.target.x = 5000;
  f.cast('q', monster.id);
  f.w.step(56);
  const expected =
    (MASTER_YI_Q.baseDamageByRank[0] +
      f.yi.damage * MASTER_YI_Q.attackDamageRatio +
      MASTER_YI_Q.bonusMonsterDamageByRank[0]) *
    1.75;
  expect(1e6 - monster.hp).toBeCloseTo(expected, 6);
  expect(monster.monster.phase).toBe('engaged');
  f.resume();
});

test('E and R accepted during Q preserve the sequence and pause only following vanished intervals', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  expect(f.w.learnSpell('r', f.yi.id)).toBeNull();
  f.cast();
  const start = f.w.tick;
  f.w.step(10);
  f.cast('e');
  const eStart = f.w.tick;
  f.cast('r');
  const rStart = f.w.tick;
  expect(f.state.alphaStrike!.startTick).toBe(start);
  f.w.step(start + 56 - f.w.tick);
  expect(f.state.wujuStyle!.pausedTicks).toBe(start + 56 - eStart);
  expect(f.state.highlander!.pausedTicks).toBe(start + 56 - rStart);
  f.resume();
});

test('accepted Q cancels an ordinary windup but retains its recovery deadline and a committed child', () => {
  const f = fixture();
  f.target.x = 150;
  for (let i = 0; i < 4; i++) {
    f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
    f.w.step(Math.max(1, f.yi.nextAttackTick - f.w.tick + 1));
    f.w.step(f.yi.releaseTick! - f.w.tick);
    f.w.setOrder(f.yi, { type: 'idle' });
  }
  const child = structuredClone(f.state.doubleStrike!.strike!),
    next = f.yi.nextAttackTick;
  f.cast();
  expect(f.yi.nextAttackTick).toBe(next);
  expect(f.yi.releaseTick).toBeNull();
  expect(f.state.doubleStrike!.strike!.releaseTick).toBe(child.releaseTick);
  expect(f.state.doubleStrike!.strike!.poseStopTick).toBe(f.w.tick);
  f.w.step(child.releaseTick - f.w.tick);
  expect(f.state.doubleStrike!.strike!.result).toBe('hit');
  expect(f.state.doubleStrike!.stacks).toBe(1);
  expect(f.state.cooldowns.q - f.state.alphaStrike!.startTick).toBe(1140);
  f.resume();
});

test('real basic contacts reduce Q current cooldown, including lethal and structure contacts, with own haste multiplier', () => {
  const f = fixture();
  f.target.x = 150;
  f.state.inventory = ['codex'];
  const reduction = Math.ceil((60 * 100) / (100 + f.w.abilityHaste(f.yi.id)));
  f.state.cooldowns.q = f.w.tick + 1000;
  f.w.setOrder(f.yi, { type: 'attack', target: f.target.id });
  f.w.step();
  f.w.step(f.yi.releaseTick! - f.w.tick);
  expect(f.state.cooldowns.q).toBe(1000 - reduction);
  f.w.setOrder(f.yi, { type: 'idle' });
  const turret = f.w.spawn('turret', 'red', { x: 150, y: 0 });
  turret.ai = false;
  f.state.cooldowns.q = f.w.tick + 1;
  f.w.setOrder(f.yi, { type: 'attack', target: turret.id });
  f.w.step(Math.max(1, f.yi.nextAttackTick - f.w.tick + 1));
  f.state.cooldowns.q = f.w.tick + 1000;
  const deadline = f.state.cooldowns.q;
  f.w.step(f.yi.releaseTick! - f.w.tick);
  expect(f.state.cooldowns.q).toBe(deadline - reduction);
  f.resume();
});

test('learned R refunds Q on an awarded takedown as well as W/E, without Q-hit basic refund recursion', () => {
  const f = fixture();
  f.w.gainExperience(1e6, f.yi.id);
  expect(f.w.learnSpell('r', f.yi.id)).toBeNull();
  const victim = f.w.spawn('champion', 'red', { x: 300, y: 0 }, 'lux');
  victim.ai = false;
  victim.armor = 0;
  victim.hp = 1;
  f.target.x = 5000;
  f.cast('q', victim.id);
  f.w.step(56);
  expect(f.state.kills).toBe(1);
  expect(victim.deadAt).toBe(f.w.tick - 28);
  expect(f.state.cooldowns.q - f.w.tick).toBe(
    Math.ceil((1200 - 28) * (1 - 0.699999988079071)) - 28
  );
  expect(f.state.doubleStrike!.stacks).toBe(0);
  f.resume();
});

test.each(['death', 'victory'] as const)(
  '%s clears Q and never resolves pending first marks later',
  (reason) => {
    const f = fixture();
    f.cast();
    f.w.step(14);
    const hp = f.target.hp;
    if (reason === 'death') f.w.damage(f.target, f.yi, 1e9, 'true', 'proc');
    else f.w.damage(f.yi, f.w.spawn('nexus', 'red', { x: 2000, y: 0 }), 1e9, 'true');
    expect(f.state.alphaStrike).toBeNull();
    f.w.step(70);
    expect(f.target.hp).toBe(hp);
    f.resume();
  }
);

test('decoder rejects foreign Q, forged phases/marks, repeat scales and old schema', () => {
  const f = fixture();
  f.cast();
  f.w.step(28);
  const saved = JSON.parse(f.w.snapshot());
  const changes: ((s: any, o: any) => void)[] = [
    (s, o) => {
      s.player.alphaStrike = o.alphaStrike;
    },
    (_s, o) => {
      o.alphaStrike.nextMarkTick++;
    },
    (_s, o) => {
      o.alphaStrike.lastTick--;
    },
    (_s, o) => {
      o.alphaStrike.marks[0].result = 'hit';
    },
    (_s, o) => {
      o.alphaStrike.marks[1].repeatIndex = 0;
    },
    (_s, o) => {
      o.alphaStrike.marks[1].onHitScale = 0.75;
    },
    (_s, o) => {
      o.alphaStrike.marks[0].tick++;
    },
    (_s, o) => {
      o.alphaStrike.rank = 2;
    },
    (_s, o) => {
      o.alphaStrike.reappearTick = o.alphaStrike.startTick;
    },
    (_s, o) => {
      o.alphaStrike.origin.x++;
    },
    (_s, o) => {
      o.alphaStrike.exitDirection = { x: 2, y: 0 };
    },
    (s) => {
      s.version = 142;
    },
  ];
  for (const change of changes) {
    const raw = structuredClone(saved),
      o = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    change(raw, o);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});

test('an engaged neutral waits through vanished Q without healing and saves that retained aggro phase', () => {
  const f = fixture(),
    monster = f.w.spawnMonster({ x: 300, y: 0 }, null, 'gromp');
  monster.hp = monster.maxHp = 1e6;
  monster.armor = 0;
  f.target.x = 5000;
  f.cast('q', monster.id);
  f.w.step(28);
  expect(monster.monster.phase).toBe('engaged');
  expect(monster.monster.targetId).toBe(f.yi.id);
  expect(monster.order.type).toBe('idle');
  const hp = monster.hp;
  f.w.step(5);
  expect(monster.hp).toBe(hp);
  expect(f.w.targetable(f.yi)).toBe(false);
  f.resume();
});

test('armor and a shared shield mitigate physical marks while scaled E remains true damage', () => {
  const f = fixture();
  f.w.gainExperience(280, f.yi.id);
  expect(f.w.learnSpell('e', f.yi.id)).toBeNull();
  const shieldSource = f.w.spawn('champion', 'red', { x: 5000, y: 0 }, 'lux');
  shieldSource.ai = false;
  f.target.armor = 100;
  f.target.shields = [{ sourceId: shieldSource.id, amount: 50, endTick: 600 }];
  f.cast('e');
  f.cast();
  f.w.step(56);
  const physical = ((20 + f.yi.damage * MASTER_YI_Q.attackDamageRatio) * 1.75) / 2;
  const trueDamage = 20 * (0.75 + 3 * 0.1875);
  expect(1e6 - f.target.hp).toBeCloseTo(physical + trueDamage - 50, 6);
  expect(f.target.shields).toEqual([]);
  f.resume();
});

test('Q recovery saves its return deadline and rejects forged return coordinates, clocks and future target IDs', () => {
  const f = fixture();
  f.cast();
  f.w.step(60);
  const saved = JSON.parse(f.w.snapshot());
  const changes: ((s: any, o: any) => void)[] = [
    (_s, o) => {
      o.alphaStrike.endTick++;
    },
    (_s, o) => {
      o.alphaStrike.reappearTick--;
    },
    (_s, o) => {
      o.alphaStrike.returnPoint.x++;
    },
    (_s, o) => {
      o.alphaStrike.stopReason = 'lost';
    },
    (_s, o) => {
      o.alphaStrike.marks[0].result = 'pending';
    },
    (s, o) => {
      o.alphaStrike.primaryTargetId = s.nextId;
    },
    (s, o) => {
      o.alphaStrike.marks[0].targetId = s.nextId;
    },
    (_s, o) => {
      o.alphaStrike.primaryPoint.x = 1000;
    },
  ];
  for (const change of changes) {
    const raw = structuredClone(saved),
      owner = raw.otherChampions.find((o: any) => o.id === f.yi.id);
    change(raw, owner);
    expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow();
  }
});
