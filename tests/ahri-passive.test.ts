import { expect, test } from 'vitest';
import type { Unit } from '../src/simulation/types';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { AHRI_PASSIVE_POLICY } from '../src/content/ahri-passive-policy';
import { essenceHeal, advanceEssences } from '../src/simulation/ahri-essences';
import { activeSpiritRush } from '../src/simulation/ahri-spirit-rush';

function setup() {
  const w = new World(false, {
    ...PRACTICE_FIXTURE,
    initialUnits: [],
    lineOfSight: () => true,
    inBrush: () => false,
    lineWalkable: () => true,
    reachable: (p) => ({ x: p.x, y: p.y }),
    findPath: (_a, b) => [{ x: b.x, y: b.y }],
  });
  w.nextWaveTick = Infinity;
  w.hero.ai = false;
  w.hero.x = w.hero.y = -3000;
  const ahri = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  ahri.ai = false;
  const state = w.championState(ahri.id)!;
  const minion = (x = 400) => {
    const u = w.spawn('melee', 'red', { x, y: 0 });
    u.ai = false;
    u.experienceBounty = 0;
    u.goldBounty = 0;
    return u;
  };
  const champion = (x = 400) => {
    const u = w.spawn('champion', 'red', { x, y: 0 }, 'lux');
    u.ai = false;
    u.magicResist = 0;
    return u;
  };
  const kill = (u: Unit) => w.damage(ahri, u, 1e6, 'true');
  const restore = () => {
    const saved = w.snapshot(),
      copy = World.fromSnapshot(saved, w.battlefield);
    expect(copy.snapshot()).toBe(saved);
    return copy;
  };
  const beginR = () => {
    w.gainExperience(1e6, ahri.id);
    w.learnSpell('r', ahri.id);
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: 900, y: 0 } });
    w.step();
  };
  return { w, ahri, state, minion, champion, kill, restore, beginR };
}

test('every Ahri owns an innate zero counter without requiring a learned spell', () => {
  const { w, ahri, state, restore } = setup();
  expect(w.ahriCounters).toEqual([{ sourceId: ahri.id, stacks: 0, lastKillTick: null }]);
  expect(state.spellRanks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  restore();
});

test('the ninth credited minion/monster kill resets stacks and sends one captured healing Essence', () => {
  const { w, ahri, minion, kill, restore } = setup();
  ahri.hp = 200;
  for (let n = 1; n <= 8; n++) {
    kill(minion());
    expect(w.ahriCounters[0].stacks).toBe(n);
    expect(w.ahriEssences).toEqual([]);
  }
  const monster = w.spawnMonster({ x: 400, y: 0 });
  monster.experienceBounty = 0;
  monster.goldBounty = 0;
  kill(monster);
  expect(w.ahriCounters[0].stacks).toBe(0);
  expect(w.ahriEssences).toHaveLength(1);
  expect(w.ahriEssences[0]).toMatchObject({
    kind: 'minion',
    victimId: monster.id,
    heal: 35,
    healed: null,
  });
  restore();
  w.step(30);
  expect(w.ahriEssences[0]).toMatchObject({ stopReason: 'consumed', healed: 35 });
  expect(ahri.hp).toBeGreaterThan(235);
  restore();
});

test('heal endpoints and coefficient policy cover all eighteen levels and captured AP', () => {
  for (const [level, minionValue, championValue] of [
    [1, 35, 75],
    [6, 52.64705882352941, 101.47058823529412],
    [11, 70.29411764705883, 127.94117647058823],
    [18, 95, 165],
  ]) {
    expect(essenceHeal('minion', level, 0)).toBeCloseTo(minionValue, 10);
    expect(essenceHeal('champion', level, 0)).toBeCloseTo(championValue, 10);
  }
  for (let level = 1; level <= 18; level++) {
    expect(essenceHeal('minion', level, 80) - essenceHeal('minion', level, 0)).toBeCloseTo(16, 6);
    expect(essenceHeal('champion', level, 80) - essenceHeal('champion', level, 0)).toBeCloseTo(
      24,
      5
    );
  }
  const { w, ahri, state, minion, kill, restore } = setup();
  ahri.hp = 100;
  state.inventory = ['tome'];
  for (let n = 0; n < 9; n++) kill(minion());
  const e = w.ahriEssences[0];
  expect(e.power).toBe(20);
  state.inventory = [];
  w.gainExperience(1e6, ahri.id);
  w.step(30);
  expect(e.healed).toBeCloseTo(39, 6);
  restore();
});

test('full health still consumes Essence and healing clamps to missing health', () => {
  const f = setup();
  f.ahri.hp = f.ahri.maxHp - 2;
  for (let n = 0; n < 9; n++) f.kill(f.minion(0));
  f.w.step();
  expect(f.w.ahriEssences[0].healed).toBe(2);
  expect(f.ahri.hp).toBe(f.ahri.maxHp);
  f.restore();
  const full = setup();
  for (let n = 0; n < 9; n++) full.kill(full.minion(0));
  full.w.step();
  expect(full.w.ahriEssences[0]).toMatchObject({ stopReason: 'consumed', healed: 0 });
  full.restore();
});

test('dummy, structure and friendly kills do not feed the counter', () => {
  const { w, minion, kill, restore } = setup();
  kill(w.spawn('dummy', 'red', { x: 300, y: 0 }));
  kill(w.spawn('turret', 'red', { x: 400, y: 0 }));
  const ally = minion();
  ally.team = 'blue';
  kill(ally);
  expect(w.ahriCounters[0].stacks).toBe(0);
  expect(w.ahriEssences).toEqual([]);
  restore();
});

test('champion takedowns use the inclusive three-second recent damage window for every living Ahri owner', () => {
  for (const age of [180, 181]) {
    const { w, ahri, champion, restore } = setup(),
      other = w.spawn('champion', 'blue', { x: 200, y: 0 }, 'ahri');
    other.ai = false;
    const victim = champion(350);
    victim.hp = victim.maxHp = 10000;
    w.damage(ahri, victim, 1, 'true');
    w.damage(other, victim, 1, 'true');
    w.step(age);
    w.damage(w.hero, victim, 1e6, 'true');
    expect(w.ahriEssences.length).toBe(age === 180 ? 2 : 0);
    if (age === 180) expect(w.ahriEssences.map((e) => e.sourceId)).toEqual([ahri.id, other.id]);
    restore();
  }
});

test('a champion Essence has the greater heal without changing the nine-kill counter', () => {
  const { w, ahri, minion, champion, kill, restore } = setup();
  ahri.hp = 100;
  for (let n = 0; n < 4; n++) kill(minion());
  kill(champion(0));
  expect(w.ahriCounters[0].stacks).toBe(4);
  expect(w.ahriEssences[0].kind).toBe('champion');
  const e = w.ahriEssences[0];
  w.step();
  expect(e.healed).toBe(e.heal);
  expect(e.heal).toBe(essenceHeal('champion', e.level, e.power));
  restore();
});

test('champion consumption restores one R cast, caps stored casts at three and permits more than three total casts', () => {
  const { w, ahri, champion, kill, restore, beginR } = setup();
  beginR();
  w.step(24);
  for (let i = 0; i < 3; i++) kill(champion(ahri.x));
  w.step();
  expect(w.ahriRushes[0].remainingCasts).toBe(3);
  expect(w.ahriRushes[0].resets.map((r) => r.remaining)).toEqual([3, 3, 3]);
  restore();
  for (const at of [61, 121, 181]) {
    w.step(at - w.tick - 1);
    w.enqueue({ type: 'cast', unit: ahri.id, ability: 'r', point: { x: ahri.x + 500, y: 0 } });
    w.step();
    restore();
  }
  expect(w.ahriRushes[0].bursts).toHaveLength(4);
  expect(w.ahriRushes[0].remainingCasts).toBe(0);
  restore();
});

test('late champion consumption guarantees ten seconds remaining and preserves the cast lockout', () => {
  const { w, ahri, champion, kill, restore, beginR } = setup();
  beginR();
  w.step(699);
  const before = w.ahriRushes[0].endTick,
    lockout = w.ahriRushes[0].nextCastTick;
  kill(champion(ahri.x));
  w.step();
  const rush = w.ahriRushes[0];
  expect(rush.endTick).toBe(w.tick + 600);
  expect(rush.endTick - before).toBeLessThanOrEqual(600);
  expect(rush.nextCastTick).toBe(lockout);
  restore();
});

test('minion Essence cannot restore R; champion Essence arriving after expiry heals without reactivating R', () => {
  const f = setup();
  f.beginR();
  f.w.step(24);
  for (let n = 0; n < 9; n++) f.kill(f.minion(f.ahri.x));
  f.w.step();
  expect(f.w.ahriRushes[0].remainingCasts).toBe(2);
  expect(f.w.ahriRushes[0].resets).toEqual([]);
  f.restore();
  const late = setup();
  late.beginR();
  late.w.step(899);
  late.ahri.hp = 1000;
  late.kill(late.champion(late.ahri.x + 1000));
  late.w.step(50);
  expect(activeSpiritRush(late.w, late.ahri.id)).toBeUndefined();
  expect(late.w.ahriRushes).toEqual([]);
  expect(late.w.ahriEssences.some((e) => e.stopReason === 'consumed')).toBe(true);
  late.restore();
});

test('source death cancels in-flight healing, preserves earned stacks and ignores posthumous kills', () => {
  const { w, ahri, minion, champion, kill, restore } = setup();
  for (let n = 0; n < 8; n++) kill(minion());
  kill(champion(1000));
  w.damage(w.hero, ahri, 1e6, 'true');
  expect(w.ahriCounters[0].stacks).toBe(8);
  expect(w.ahriEssences[0]).toMatchObject({ stopReason: 'death', healed: 0 });
  kill(minion());
  expect(w.ahriCounters[0].stacks).toBe(8);
  restore();
  w.step(30);
  expect(w.ahriEssences).toEqual([]);
  restore();
});

test('Essence follows the caster through Flash and heals while controlled', () => {
  const { w, ahri, minion, kill, restore } = setup();
  ahri.hp = 100;
  for (let n = 0; n < 9; n++) kill(minion(800));
  const slot = w.summonerSlot('flash', ahri.id)!;
  w.enqueue({ type: 'cast', unit: ahri.id, ability: slot, point: { x: 0, y: 400 } });
  w.step();
  w.applyRoot(ahri, 60);
  w.applyStun(ahri, 60);
  w.applySilence(ahri, 60);
  const e = w.ahriEssences[0];
  w.step(35);
  expect(e.stopReason).toBe('consumed');
  expect(e.healed).toBe(35);
  expect(ahri.rootUntil).toBeGreaterThan(w.tick);
  restore();
});

test('birth, flight, consumption and R reset saves have identical 300-tick futures', () => {
  for (const age of [0, 5, 20, 30]) {
    const { w, ahri, champion, kill, restore, beginR } = setup();
    beginR();
    w.step(24);
    ahri.hp = 1000;
    kill(champion(ahri.x + 600));
    w.step(age);
    const copy = restore();
    w.step(300);
    copy.step(300);
    expect(copy.snapshot()).toBe(w.snapshot());
  }
});

test('pursuit expiry and terminal settlement cannot leave immortal Essence state', () => {
  const f = setup();
  for (let n = 0; n < 9; n++) f.kill(f.minion(1000));
  f.w.tick = AHRI_PASSIVE_POLICY.maximumPursuitTicks;
  advanceEssences(f.w);
  expect(f.w.ahriEssences[0]).toMatchObject({ stopReason: 'expired', healed: 0 });
  const g = setup();
  for (let n = 0; n < 9; n++) g.kill(g.minion());
  const nexus = g.w.spawn('nexus', 'red', { x: 1500, y: 1500 });
  g.w.damage(g.w.hero, nexus, 1e6, 'true');
  expect(g.w.ahriEssences).toEqual([]);
  const copy = g.restore();
  g.w.step(100);
  copy.step(100);
  expect(copy.snapshot()).toBe(g.w.snapshot());
});

test('edited counters, Essence trajectories and captured heals reject saved files', () => {
  const f = setup();
  for (let n = 0; n < 9; n++) f.kill(f.minion());
  f.w.step(3);
  const raw = JSON.parse(f.w.snapshot());
  for (const mutate of [
    (r: any) => (r.ahriCounters = []),
    (r: any) => r.ahriCounters.push({ ...r.ahriCounters[0] }),
    (r: any) => (r.ahriCounters[0].stacks = 9),
    (r: any) => (r.ahriCounters[0].lastKillTick = r.tick + 1),
    (r: any) => (r.ahriEssences[0].sourceId = r.player.id),
    (r: any) => r.ahriEssences[0].heal++,
    (r: any) => (r.ahriEssences[0].level = 19),
    (r: any) => (r.ahriEssences[0].power = -1),
    (r: any) => (r.ahriEssences[0].kind = 'champion'),
    (r: any) => (r.ahriEssences[0].position.y += 500),
    (r: any) => (r.ahriEssences[0].previous.x += 500),
    (r: any) => r.ahriEssences[0].lastTick++,
    (r: any) => (r.ahriEssences[0].stopTick = r.tick + 1),
    (r: any) => (r.ahriEssences[0].healed = 5),
    (r: any) => (r.ahriEssences[0].victimId = r.ahriEssences[0].id),
  ]) {
    const bad = structuredClone(raw);
    mutate(bad);
    expect(() => World.fromSnapshot(JSON.stringify(bad), f.w.battlefield)).toThrow();
  }
});

test('edited Essence reset histories cannot forge charges, ownership or window extension', () => {
  const f = setup();
  f.beginR();
  f.w.step(24);
  f.kill(f.champion(f.ahri.x));
  f.w.step();
  const raw = JSON.parse(f.w.snapshot());
  for (const mutate of [
    (r: any) => r.remainingCasts++,
    (r: any) => (r.resets[0].remaining = 1),
    (r: any) => (r.resets[0].previousRemaining = 0),
    (r: any) => r.resets[0].previousEndTick++,
    (r: any) => r.resets[0].endTick++,
    (r: any) => r.resets[0].consumeTick++,
    (r: any) => r.resets[0].spawnTick++,
    (r: any) => (r.resets[0].essenceId = raw.player.id),
    (r: any) => (r.resets[0].victimId = f.ahri.id),
    (r: any) => r.resets.push({ ...r.resets[0] }),
    (r: any) => (r.resets = []),
    (r: any) => (r.endTick += 600),
  ]) {
    const bad = structuredClone(raw);
    mutate(bad.ahriRushes[0]);
    expect(() => World.fromSnapshot(JSON.stringify(bad), f.w.battlefield)).toThrow();
  }
});

test('a later Essence record cannot retroactively legalize an expired R window', () => {
  const f = setup();
  f.beginR();
  f.w.step(699);
  f.kill(f.champion(f.ahri.x));
  f.w.step(300);
  f.restore();
  const raw = JSON.parse(f.w.snapshot()),
    r = raw.ahriRushes[0];
  expect(r.endTick).toBe(1301);
  r.resets[0].consumeTick = 902;
  r.resets[0].endTick = 1502;
  r.endTick = 1502;
  expect(() => World.fromSnapshot(JSON.stringify(raw), f.w.battlefield)).toThrow(/Essence history/);
});

test('earned stacks survive an ordinary respawn without reviving cancelled Essence', () => {
  const f = setup();
  for (let n = 0; n < 8; n++) f.kill(f.minion());
  f.kill(f.champion(1000));
  f.w.damage(f.w.hero, f.ahri, 1e6, 'true');
  f.w.step(f.ahri.respawnTick! - f.w.tick);
  expect(f.ahri.hp).toBeGreaterThan(0);
  expect(f.w.ahriCounters[0].stacks).toBe(8);
  expect(f.w.ahriEssences).toEqual([]);
  f.restore();
});

test('an exhausted active R window cannot restart when its initial cooldown has already elapsed', () => {
  const f = setup();
  f.beginR();
  for (const tick of [61, 121]) {
    f.w.step(tick - f.w.tick - 1);
    f.w.enqueue({
      type: 'cast',
      unit: f.ahri.id,
      ability: 'r',
      point: { x: f.ahri.x + 500, y: 0 },
    });
    f.w.step();
  }
  f.state.cooldowns.r = 0;
  expect(f.w.abilityCooldownTicks('r', f.ahri.id)).toBe(f.w.ahriRushes[0].endTick - f.w.tick);
  f.w.enqueue({ type: 'cast', unit: f.ahri.id, ability: 'r', point: { x: 0, y: 0 } });
  f.w.step();
  expect(f.w.ahriRushes[0].bursts).toHaveLength(3);
  f.restore();
});
