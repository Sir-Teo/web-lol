import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DARIUS_KIT, MORGANA_KIT, VI_KIT } from '../src/content/milestone6-champions';
import { DRAGON_SLAYER_BUFFS, EPIC_OBJECTIVE_TIMING } from '../src/content/epic-objectives';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import { TICK_RATE } from '../src/content/rules';
import { ensureItemState } from '../src/simulation/item-effects';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { championBaseAttackDamage } from '../src/simulation/progression';
import { createChampionRuneState } from '../src/simulation/runes';
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

describe('Milestone 7.1/7.2 — 10-Champion Behavior Matrix & Gameplay Discrepancy Regressions', () => {
  test('Darius R Rank 1/2 20s reset window expires back onto cooldown while Rank 3 stays permanently reset', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'darius');
    w.nextWaveTick = Infinity;
    w.gainExperience(3_500); // Level 6 -> Rank 1 R
    w.learnSpell('r');
    expect(w.player.spellRanks.r).toBe(1);

    const foe = w.spawn('champion', 'red', { x: w.hero.x + 220, y: w.hero.y }, 'ashe');
    foe.ai = false;
    foe.hp = 100;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: foe, targetId: foe.id });
    w.step(2);
    expect(foe.hp).toBe(0);
    expect(w.abilityCooldownTicks('r')).toBe(0);
    expect(w.player.darius!.rResetUntil).toBeGreaterThan(w.tick);

    // Let the 20s temporary reset window expire without recasting -> R enters full Rank 1 cooldown!
    w.step(DARIUS_KIT.r.resetWindowTicks + 5);
    expect(w.player.darius!.rResetUntil).toBe(0);
    expect(w.abilityCooldownTicks('r')).toBeGreaterThan(100 * TICK_RATE);

    // Rank 3 R kill stays permanently reset even after 20s!
    w.gainExperience(30_000);
    w.learnSpell('r');
    w.learnSpell('r');
    expect(w.player.spellRanks.r).toBe(3);
    w.player.cooldowns.r = w.tick;
    const foe2 = w.spawn('champion', 'red', { x: w.hero.x + 220, y: w.hero.y }, 'lux');
    foe2.ai = false;
    foe2.hp = 200;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: foe2, targetId: foe2.id });
    w.step(2);
    expect(foe2.hp).toBe(0);
    w.step(DARIUS_KIT.r.resetWindowTicks + 5);
    expect(w.abilityCooldownTicks('r')).toBe(0);
  });

  test('Level-18 Darius, Vi, and Ezreal bonus-AD ratios exclude level-up base AD growth', () => {
    // At Lv 18 with zero AD items, championBaseAttackDamage equals u.damage so bonus AD is 0!
    for (const champ of ['darius', 'vi', 'ezreal'] as const) {
      const w = new World(false, PRACTICE_FIXTURE, champ);
      w.nextWaveTick = Infinity;
      w.gainExperience(30_000);
      expect(w.player.level).toBe(18);
      expect(Math.abs(w.hero.damage - championBaseAttackDamage(champ, 18))).toBeLessThan(0.01);
    }

    // Verify Darius R at Lv 18 with 0 bonus AD items and 0 stacks deals exact Rank 3 base true damage (375)
    const w = new World(false, PRACTICE_FIXTURE, 'darius');
    w.nextWaveTick = Infinity;
    w.gainExperience(30_000);
    w.learnSpell('r');
    w.learnSpell('r');
    w.learnSpell('r');
    const dummy = w.spawn('champion', 'red', { x: w.hero.x + 220, y: w.hero.y }, 'garen');
    dummy.ai = false;
    dummy.maxHp = 4000;
    dummy.hp = 4000;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: dummy, targetId: dummy.id });
    w.step(2);
    // Exact 375 true damage (with ~0.05 HP5 regen on 1 tick; pre-fix leaked +63.75 bonus AD)
    expect(Math.abs(4000 - dummy.hp - DARIUS_KIT.r.baseTrueDamageByRank[2])).toBeLessThan(0.2);
  });

  test('Morgana Q root and R stun respect Tenacity, Vi Unstoppable, Zhonya Stasis, and Epic Monster CC immunity', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'morgana');
    w.nextWaveTick = Infinity;
    w.gainExperience(25_000);
    for (let i = 0; i < 5; i++) w.learnSpell('q');
    w.learnSpell('r');

    // 1. Target with Mercury's Treads (30% Tenacity) receives shortened Morgana Q root (3.0s -> ~2.1s)
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 300, y: w.hero.y }, 'garen');
    foe.ai = false;
    foe.maxHp = 4000;
    foe.hp = 4000;
    const foeState = w.championState(foe.id)!;
    foeState.inventory.push('mercs');
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: foe });
    w.step(25);
    const remainingRoot = foe.rootUntil - w.tick;
    const fullRootTicks = Math.round(MORGANA_KIT.q.rootSecondsByRank[4] * TICK_RATE);
    expect(remainingRoot).toBeGreaterThan(0);
    expect(remainingRoot).toBeLessThan(fullRootTicks - 30);

    // 2. Vi during R unstoppable charge cannot be rooted by Morgana Q
    const viUnit = w.spawn('champion', 'red', { x: w.hero.x + 280, y: w.hero.y + 80 }, 'vi');
    viUnit.ai = false;
    const viState = w.championState(viUnit.id)!;
    viState.vi!.rDash = { targetId: w.hero.id, rank: 1, speed: VI_KIT.r.dashSpeed };
    w.player.cooldowns.q = w.tick;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: viUnit });
    w.step(15);
    expect(viUnit.rootUntil).toBeLessThanOrEqual(w.tick);

    // 3. Target in Zhonya's Stasis during Morgana R tether end avoids both stun and damage
    w.hero.stunUntil = 0;
    w.hero.mana = w.hero.maxMana;
    const target = w.spawn('champion', 'red', { x: w.hero.x + 180, y: w.hero.y }, 'lux');
    target.ai = false;
    target.maxHp = 3000;
    target.hp = 3000;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: target });
    w.step(10);
    expect(w.player.morgana!.shackles?.targetIds).toContain(target.id);
    const hpAfterInitial = target.hp;
    const targetState = w.championState(target.id)!;
    ensureItemState(targetState).stasisUntilTick = w.tick + MORGANA_KIT.r.durationTicks + 10;
    w.step(MORGANA_KIT.r.durationTicks);
    expect(target.stunUntil).toBeLessThanOrEqual(w.tick);
    expect(target.hp).toBeGreaterThanOrEqual(hpAfterInitial);
  });

  test('Vi Q dash is interrupted by hard CC, Vi R respects Stasis untargetability, and Epic Monsters ignore Morgana Q / Darius E CC', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'vi');
    w.nextWaveTick = Infinity;
    w.gainExperience(10_000);
    w.learnSpell('q');
    w.learnSpell('r');

    // Start Vi Q dash, then stun Vi mid-dash -> dash terminates immediately!
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'q',
      point: { x: w.hero.x + 650, y: w.hero.y },
    });
    w.step(2);
    expect(w.player.vi!.qDash).not.toBeNull();
    w.hero.stunUntil = w.tick + 30;
    w.step(1);
    expect(w.player.vi!.qDash).toBeNull();

    // Vi R landing on a target in Zhonya's Stasis neither stuns nor damages them
    w.hero.stunUntil = 0;
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 350, y: w.hero.y }, 'ahri');
    foe.ai = false;
    foe.maxHp = 2500;
    foe.hp = 2500;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: foe, targetId: foe.id });
    w.step(2);
    const foeState = w.championState(foe.id)!;
    ensureItemState(foeState).stasisUntilTick = w.tick + 120;
    w.step(40);
    expect(foe.stunUntil).toBeLessThanOrEqual(w.tick);
    expect(foe.hp).toBe(2500);

    // Elemental Drake is immune to Morgana Q root
    const rift = createLaneMatch(publicRift, 'morgana');
    for (const u of rift.units) u.ai = false;
    rift.nextWaveTick = 1_000_000_000;
    rift.learnSpell('q', rift.player.id);
    rift.tick = EPIC_OBJECTIVE_TIMING.dragonFirstReadyTick - 1;
    rift.step();
    const drake = rift.unit(rift.riftObjectives!.dragon.unitId!)!;
    drake.monster!.phase = 'idle';
    drake.monster!.spawn = null;
    rift.hero.x = drake.x - 240;
    rift.hero.y = drake.y;
    rift.enqueue({ type: 'cast', unit: rift.player.id, ability: 'q', point: drake });
    rift.step(25);
    expect(drake.rootUntil).toBeLessThanOrEqual(rift.tick);
  });

  test('Rejected Milestone 6 casts preserve Recall and emit silence feedback', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'morgana');
    w.nextWaveTick = Infinity;
    w.learnSpell('q');
    w.enqueue({ type: 'recall', unit: w.player.id });
    w.step(2);
    expect(w.player.recallEnd).not.toBeNull();

    // Attempting Morgana Q while silenced emits feedback and does NOT cancel Recall
    w.hero.silenceUntil = w.tick + 60;
    const eventsBefore = w.events.length;
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'q',
      point: { x: w.hero.x + 200, y: w.hero.y },
    });
    w.step(1);
    expect(w.player.recallEnd).not.toBeNull();
    const silenceMsg = w.events
      .slice(eventsBefore)
      .find((e) => e.type === 'message' && e.text === 'Cannot cast while silenced');
    expect(silenceMsg).toBeDefined();
  });

  test('Mountain Drake +8% armor/MR persists across level-ups and shop purchases, and Mountain Soul shield requires 5s out of combat', () => {
    const match = createLaneMatch(publicRift, 'darius');
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;

    // Force Earth Drake stacks & Earth Soul
    const obj = match.riftObjectives!;
    const baseArmor = match.effectiveArmor(match.hero);
    const baseMr = match.effectiveMagicResist(match.hero);
    obj.dragon.stacks.blue.push('earth');
    expect(match.effectiveArmor(match.hero)).toBeCloseTo(
      baseArmor * (1 + DRAGON_SLAYER_BUFFS.earthBonusDefenseFractionPerStack),
      2
    );
    expect(match.effectiveMagicResist(match.hero)).toBeCloseTo(
      baseMr * (1 + DRAGON_SLAYER_BUFFS.earthBonusDefenseFractionPerStack),
      2
    );

    // Buy Cloth Armor (+15 armor) -> Mountain Drake +8% applies to the new total too!
    match.player.gold = 2000;
    expect(match.buy('cloth')).toBeNull();
    expect(match.effectiveArmor(match.hero)).toBeCloseTo(
      (baseArmor + 15) * (1 + DRAGON_SLAYER_BUFFS.earthBonusDefenseFractionPerStack),
      2
    );

    // Mountain Soul shield MUST NOT trigger while actively taking damage within 5s
    obj.dragon.soulTeam = 'blue';
    obj.dragon.soulElement = 'earth';
    const foe = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    match.hero.shields = [];
    match.tick = 5 * TICK_RATE - 10;
    match.damage(foe, match.hero, 15, 'physical', 'direct');
    expect(match.player.lastDamagedTick).toBe(match.tick);
    match.step(12); // Crosses 5*TICK_RATE while still in combat!
    expect(match.hero.shields.some((s) => s.mountainSoul)).toBe(false);

    // After 5 full seconds out of combat, the next 5s cadence grants Mountain Soul shield!
    match.step(5 * TICK_RATE + 5);
    expect(match.hero.shields.some((s) => s.mountainSoul)).toBe(true);
  });

  test('Event-boundary save/restore preserves exact deterministic identity across mid-cast, mid-dash, mid-missile, and combat clocks', () => {
    const match = createLaneMatch(publicRift, 'ezreal', { d: 'flash', f: 'heal' }, 'standard', {
      keystone: 'electrocute',
      secondary: 'alacrity',
      shards: { offense: 'adaptive', flex: 'adaptive', defense: 'flat-hp' },
    });
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;
    match.gainExperience(12_000, match.player.id);
    for (const s of ['q', 'w', 'e', 'r'] as const) match.learnSpell(s, match.player.id);

    const foe = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    foe.x = match.hero.x + 500;
    foe.y = match.hero.y;
    match.damage(foe, match.hero, 20, 'physical', 'direct');
    match.enqueue({ type: 'cast', unit: match.player.id, ability: 'w', point: foe });
    match.step(2);
    match.enqueue({ type: 'cast', unit: match.player.id, ability: 'r', point: foe });
    match.step(5);

    const midBoundarySnap = match.snapshot();
    const restored = World.fromSnapshot(midBoundarySnap, publicRift);
    expect(restored.snapshot()).toBe(midBoundarySnap);

    // Advance both worlds 120 ticks through Ezreal W travel + Ezreal R channel release + impact
    match.step(120);
    restored.step(120);
    expect(restored.snapshot()).toBe(match.snapshot());

    // Also verify Electrocute bonus AD excludes base AD growth at Level 18
    const elecWorld = new World(false, PRACTICE_FIXTURE, 'ashe');
    elecWorld.nextWaveTick = Infinity;
    elecWorld.gainExperience(30_000);
    elecWorld.player.runeState = createChampionRuneState({
      keystone: 'electrocute',
      secondary: 'alacrity',
      shards: { offense: 'attack-speed', flex: 'scaling-hp', defense: 'flat-hp' },
    });
    const dummy = elecWorld.spawn(
      'champion',
      'red',
      { x: elecWorld.hero.x + 250, y: elecWorld.hero.y },
      'garen'
    );
    dummy.ai = false;
    dummy.maxHp = 5000;
    dummy.hp = 5000;
    dummy.armor = 0;
    dummy.magicResist = 0;
    for (let i = 0; i < 3; i++) elecWorld.damage(elecWorld.hero, dummy, 10, 'physical', 'direct');
    // 3 * 10 direct + Electrocute Lv.18 base (190) with 0 bonus AD = 220 total damage
    expect(5000 - dummy.hp).toBeCloseTo(220, 1);
  });
});
