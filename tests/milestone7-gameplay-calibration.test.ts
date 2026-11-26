import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRift } from '../src/content/rift';
import { DARIUS_KIT } from '../src/content/milestone6-champions';
import { DRAGON_SLAYER_BUFFS } from '../src/content/epic-objectives';
import { RUNE_TIMING } from '../src/content/runes';
import { TICK_RATE } from '../src/content/rules';
import { championBaseAd, championItemAp, championItemBonusAd } from '../src/simulation/champion-stats';
import { dragonDefenseMultiplier, dragonSlowResist, summonRiftHerald } from '../src/simulation/epic-objectives';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { runeAdaptiveStats } from '../src/simulation/runes';
import { World } from '../src/simulation/world';

const navBytes = readFileSync('public/assets/maps/rift-nav.bin');
const navGrid = new NavGrid(
  JSON.parse(readFileSync('public/assets/maps/rift-nav.json', 'utf8')),
  navBytes.buffer.slice(navBytes.byteOffset, navBytes.byteOffset + navBytes.byteLength)
);
const baseRift = createRift(
  navGrid,
  JSON.parse(readFileSync('public/assets/maps/rift-layout.json', 'utf8'))
);
const publicRift = { ...baseRift, publicRift: true as const };

function makeWorld(player: 'darius' | 'vi' | 'garen' | 'lux' = 'darius') {
  const w = createLaneMatch(publicRift, player);
  w.nextWaveTick = Infinity;
  for (const u of w.units) u.ai = false;
  return w;
}

function advance(w: World, ticks: number) {
  for (let i = 0; i < ticks; i++) w.step();
}

function championById(w: World, id: string, team?: 'blue' | 'red') {
  const u = w.units.find(
    (unit) => unit.kind === 'champion' && unit.champion === id && (!team || unit.team === team)
  );
  if (!u) throw new Error(`Missing champion ${id}`);
  return u;
}

function enemyChampions(w: World, team: 'blue' | 'red') {
  return w.units.filter((unit) => unit.kind === 'champion' && unit.team !== team);
}

describe('Milestone 7.2 — Gameplay Calibration & Discrepancy Fixes', () => {
  it('M7-D002: exact League growthAtLevel base AD and item bonus AD/AP calculation across levels', () => {
    const w = makeWorld('darius');
    const darius = championById(w, 'darius', 'blue');
    const state = w.championState(darius.id)!;

    // Level 1 baseline: zero item bonus AD, exact base AD equals 64
    expect(championItemBonusAd(darius, state)).toBe(0);
    expect(championItemAp(state)).toBe(0);
    const lv1Base = championBaseAd(darius, state);
    expect(lv1Base).toBeCloseTo(64, 2);

    // Level up naturally to 18 via XP so unit.damage uses the real growth pipeline
    w.gainExperience(30000, darius.id);
    expect(state.level).toBe(18);
    const lv18Base = championBaseAd(darius, state);
    const naiveLinear = 64 + 5 * 17 * 0.85;
    expect(lv18Base).toBeCloseTo(149, 2);
    expect(darius.damage).toBeCloseTo(lv18Base, 2);
    expect(Math.abs(lv18Base - naiveLinear)).toBeGreaterThan(12);

    // Purchase a B.F. Sword (+40 AD) and verify item bonus AD tracks it cleanly
    state.gold = 2000;
    const err = w.buy('bf-sword', darius.id);
    expect(err).toBeNull();
    expect(championItemBonusAd(darius, state)).toBeCloseTo(40, 2);
  });

  it('M7-D003: Darius R rank 1-2 kill reset expires back onto cooldown after 20s if unused', () => {
    const w = makeWorld('darius');
    const darius = championById(w, 'darius', 'blue');
    const foe = enemyChampions(w, 'blue')[0]!;
    const dState = w.championState(darius.id)!;

    // Give Darius rank 1 R (level 6) and position next to low-HP foe
    dState.level = 6;
    dState.skillPoints = 6;
    w.enqueue({ type: 'learn', unit: darius.id, ability: 'r' });
    w.step();
    darius.x = 0;
    darius.y = 0;
    foe.x = 200;
    foe.y = 0;
    foe.hp = 50;

    // Cast R for an execute kill -> R resets immediately (ready tick <= w.tick) with a 20s reset window
    w.enqueue({ type: 'cast', unit: darius.id, ability: 'r', point: { x: foe.x, y: foe.y }, targetId: foe.id });
    advance(w, 2);
    expect(foe.hp).toBe(0);
    expect(dState.cooldowns.r).toBeLessThanOrEqual(w.tick);
    expect(dState.darius?.rResetUntil).toBeGreaterThan(w.tick);

    // Let the 20s reset window expire without recasting R -> R transitions onto hasted cooldown
    advance(w, DARIUS_KIT.r.resetWindowTicks + 5);
    expect(dState.darius?.rResetUntil).toBe(0);
    expect(dState.cooldowns.r).toBeGreaterThan(w.tick + TICK_RATE * 60);
  });

  it('M7-D004: Vi Q dash is interrupted by crowd control while Vi R stays unstoppable and knocks aside secondary champions', () => {
    // Part A: Vi Q dash cancelled by stun mid-flight
    const wA = makeWorld('vi');
    const vi = championById(wA, 'vi', 'blue');
    const foesA = enemyChampions(wA, 'blue');
    const viState = wA.championState(vi.id)!;
    viState.skillPoints = 3;
    wA.enqueue({ type: 'learn', unit: vi.id, ability: 'q' });
    wA.step();
    vi.x = -200;
    vi.y = 0;
    foesA[0]!.x = 600;
    foesA[0]!.y = 0;

    // Charge Q and release towards east
    wA.enqueue({ type: 'cast', unit: vi.id, ability: 'q', point: { x: 400, y: 0 } });
    advance(wA, 15);
    wA.enqueue({ type: 'cast', unit: vi.id, ability: 'q', point: { x: 400, y: 0 } });
    advance(wA, 2);
    expect(viState.vi?.qDash).not.toBeNull();
    const xBeforeStun = vi.x;

    // Apply stun mid-dash -> qDash immediately cancels
    vi.stunUntil = wA.tick + 60;
    advance(wA, 2);
    expect(viState.vi?.qDash).toBeNull();
    expect(vi.x - xBeforeStun).toBeLessThan(120);

    // Part B: Vi R stays unstoppable through stun and knocks aside a secondary champion in the path
    const wB = makeWorld('vi');
    const viB = championById(wB, 'vi', 'blue');
    const [secondary, primary] = enemyChampions(wB, 'blue');
    const viBState = wB.championState(viB.id)!;
    viBState.level = 6;
    viBState.skillPoints = 6;
    wB.enqueue({ type: 'learn', unit: viB.id, ability: 'r' });
    wB.step();

    viB.x = -300;
    viB.y = 0;
    secondary!.x = -60;
    secondary!.y = 10;
    primary!.x = 240;
    primary!.y = 0;
    const secondaryHpBefore = secondary!.hp;
    const secondaryYBefore = secondary!.y;

    wB.enqueue({
      type: 'cast',
      unit: viB.id,
      ability: 'r',
      point: { x: primary!.x, y: primary!.y },
      targetId: primary!.id,
    });
    advance(wB, 2);
    expect(viBState.vi?.rDash).not.toBeNull();

    // Attempt to stun Vi during R dash — must remain unstoppable and finish impact
    viB.stunUntil = wB.tick + 60;
    advance(wB, 50);
    expect(viBState.vi?.rDash).toBeNull();
    expect(primary!.hp).toBeLessThan(primary!.maxHp);
    expect(secondary!.hp).toBeLessThan(secondaryHpBefore);
    expect(Math.abs(secondary!.y - secondaryYBefore)).toBeGreaterThan(20);
  });

  it('M7-D005 & M7-D008: Mountain Drake gives dynamic +8% armor/MR per stack, Cloud Drake gives 5% slow resist per stack, and Mountain Soul refreshes only out of combat', () => {
    const w = makeWorld('garen');
    const garen = championById(w, 'garen', 'blue');
    const foe = enemyChampions(w, 'blue')[0]!;

    // Baseline effective armor/MR before Mountain stacks
    const baseArmor = w.armorWithBuffs(garen);
    const baseMr = w.effectiveMagicResist(garen);
    expect(dragonDefenseMultiplier(w, 'blue')).toBe(1);
    expect(dragonSlowResist(w, 'blue')).toBe(0);

    // Grant 2 Mountain ('earth') stacks -> +16% dynamic armor/MR without mutating stored unit.armor
    const rawArmorBefore = garen.armor;
    w.riftObjectives!.dragon.stacks.blue.push('earth', 'earth');
    expect(garen.armor).toBe(rawArmorBefore);
    expect(dragonDefenseMultiplier(w, 'blue')).toBeCloseTo(
      1 + 2 * DRAGON_SLAYER_BUFFS.earthBonusDefenseFractionPerStack,
      4
    );
    expect(w.armorWithBuffs(garen)).toBeCloseTo(baseArmor * 1.16, 1);
    expect(w.effectiveMagicResist(garen)).toBeCloseTo(baseMr * 1.16, 1);

    // Grant 2 Cloud ('air') stacks -> 10% slow resist reduces a 40% slow (0.6 multiplier -> 0.64 multiplier)
    w.riftObjectives!.dragon.stacks.blue.push('air', 'air');
    expect(dragonSlowResist(w, 'blue')).toBeCloseTo(0.1, 4);
    garen.slows.push({
      sourceId: foe.id,
      kind: 'frost',
      startTick: w.tick,
      endTick: w.tick + 120,
      startMultiplier: 0.6,
      endMultiplier: 0.6,
    });
    expect(w.slowFactor(garen)).toBeCloseTo(0.64, 4);

    // Mountain Soul shield refreshes only after 5s out of combat
    w.riftObjectives!.dragon.soulTeam = 'blue';
    w.riftObjectives!.dragon.soulElement = 'earth';
    garen.shields = [];
    garen.lastCombatTick = w.tick;

    // Stay in combat (keep taking damage every 2s) -> shield must NOT refresh
    for (let i = 0; i < 3; i++) {
      advance(w, TICK_RATE * 2);
      w.damage(foe, garen, 5, 'magic', 'ability');
    }
    expect(garen.shields.some((s) => s.mountainSoul)).toBe(false);

    // Leave combat for >5s -> Mountain Soul shield refreshes
    advance(w, DRAGON_SLAYER_BUFFS.mountainSoulOutOfCombatTicks + 10);
    expect(garen.shields.some((s) => s.mountainSoul)).toBe(true);
  });

  it('M7-D006: Voidgrubs spawn Voidmites at 4+ stacks on turret attacks and Rift Herald can be summoned as a lane siege unit', () => {
    const w = makeWorld('garen');
    const garen = championById(w, 'garen', 'blue');
    const redTurret = w.units.find(
      (u) => u.kind === 'turret' && u.team === 'red' && u.structure?.role === 'outer-turret' && w.alive(u)
    )!;

    // 4 Voidgrub stacks -> hitting an enemy turret spawns 1 Voidmite
    garen.maxHp = 20000;
    garen.hp = 20000;
    w.riftObjectives!.voidgrubs.stacks.blue = 4;
    garen.x = redTurret.x - 160;
    garen.y = redTurret.y;
    const mitesBefore = w.units.filter((u) => u.summonedObjective === 'voidmite').length;
    w.damage(garen, redTurret, 80, 'physical', 'direct');
    const mitesAfter4 = w.units.filter((u) => u.summonedObjective === 'voidmite').length;
    expect(mitesAfter4).toBe(mitesBefore + 1);

    // Advance past 12s cooldown with 6 stacks -> spawns 2 Voidmites
    w.riftObjectives!.voidgrubs.stacks.blue = 6;
    advance(w, 12 * TICK_RATE + 5);
    const mitesBefore6 = w.units.filter((u) => u.summonedObjective === 'voidmite').length;
    w.damage(garen, redTurret, 80, 'physical', 'direct');
    const mitesAfter6 = w.units.filter((u) => u.summonedObjective === 'voidmite').length;
    expect(mitesAfter6).toBe(mitesBefore6 + 2);

    // Rift Herald Eye summoning spawns a lane-marching Rift Herald siege unit that charges enemy turrets
    w.riftObjectives!.herald.chargeHolder = {
      unitId: garen.id,
      team: 'blue',
      endTick: w.tick + 240 * TICK_RATE,
    };
    const err = summonRiftHerald(w, garen, { x: redTurret.x, y: redTurret.y });
    expect(err).toBeNull();
    expect(w.riftObjectives!.herald.chargeHolder).toBeNull();
    const heraldUnit = w.units.find((u) => u.summonedObjective === 'rift-herald');
    expect(heraldUnit).toBeDefined();
    expect(heraldUnit!.team).toBe('blue');

    // Place summoned Rift Herald right next to red turret -> triggers turret charge damage
    const turretHpBefore = redTurret.hp;
    heraldUnit!.x = redTurret.x - 120;
    heraldUnit!.y = redTurret.y;
    advance(w, 3);
    expect(redTurret.hp).toBeLessThan(turretHpBefore - 1000);
  });

  it('M7-D007: First Strike expires onto cooldown if champion takes damage first and misses 0.25s grace; Adaptive Force inspects item AD vs AP', () => {
    const w = makeWorld('lux');
    const lux = championById(w, 'lux', 'blue');
    const foe = enemyChampions(w, 'blue')[0]!;
    const foeState = w.championState(foe.id)!;
    const luxState = w.championState(lux.id)!;
    foeState.runeState!.loadout.keystone = 'first-strike';
    foeState.runeState!.firstStrikeReadyTick = 0;

    // Lux hits foe first -> First Strike enters 0.25s combat-lock grace
    w.damage(lux, foe, 40, 'magic', 'ability');
    expect(foeState.runeState!.firstStrikeCombatLockTick).toBeGreaterThan(0);

    // Wait >0.25s without striking back -> First Strike automatically goes on cooldown
    advance(w, RUNE_TIMING.firstStrikeGraceTicks + 5);
    expect(foeState.runeState!.firstStrikeCombatLockTick).toBe(0);
    expect(foeState.runeState!.firstStrikeReadyTick).toBeGreaterThan(w.tick);

    // Adaptive force switches dynamically based on item bonus AD vs AP
    luxState.gold = 2000;
    luxState.runeState!.loadout.shards.offense = 'adaptive';
    luxState.runeState!.loadout.shards.flex = 'adaptive';
    expect(runeAdaptiveStats(w, lux, luxState).bonusAp).toBeGreaterThan(0);
    w.buy('bf-sword', lux.id); // +40 bonus AD > 0 item AP -> switches to AD adaptive
    const adAdaptive = runeAdaptiveStats(w, lux, luxState);
    expect(adAdaptive.bonusAd).toBeCloseTo(10.8, 2);
    expect(adAdaptive.bonusAp).toBe(0);
  });

  it('Increment 7.2 event-boundary snapshot parity: mid-dash Vi R and summoned Rift Herald replay identically across save/restore', () => {
    const w1 = makeWorld('vi');
    const vi = championById(w1, 'vi', 'blue');
    const foe = enemyChampions(w1, 'blue')[0]!;
    const ally = w1.units.find((u) => u.kind === 'champion' && u.team === 'blue' && u.id !== vi.id)!;
    const viState = w1.championState(vi.id)!;
    viState.level = 6;
    viState.skillPoints = 6;
    w1.enqueue({ type: 'learn', unit: vi.id, ability: 'r' });
    w1.step();

    vi.x = -250;
    vi.y = 0;
    foe.x = 250;
    foe.y = 0;

    // Summon Rift Herald AND launch Vi R simultaneously, then snapshot mid-flight!
    w1.riftObjectives!.herald.chargeHolder = {
      unitId: ally.id,
      team: 'blue',
      endTick: w1.tick + 1000,
    };
    w1.enqueue({ type: 'summon-herald', unit: ally.id, point: { x: 0, y: 0 } });
    w1.enqueue({
      type: 'cast',
      unit: vi.id,
      ability: 'r',
      point: { x: foe.x, y: foe.y },
      targetId: foe.id,
    });
    advance(w1, 4);

    // Confirm we are mid-flight on Vi R and Rift Herald is active
    expect(viState.vi?.rDash).not.toBeNull();
    expect(w1.units.some((u) => u.summonedObjective === 'rift-herald')).toBe(true);

    // Save/restore mid-flight and advance both worlds 90 ticks
    const restored = World.fromSnapshot(w1.snapshot(), publicRift);
    advance(w1, 90);
    advance(restored, 90);

    expect(restored.snapshot()).toEqual(w1.snapshot());
  });
});
