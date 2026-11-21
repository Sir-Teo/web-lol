import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PUBLIC_SELECTABLE_CHAMPIONS } from '../src/content/champion-profiles';
import {
  DRAGON_PIT_POINT,
  EPIC_OBJECTIVE_TIMING,
  TOP_PIT_POINT,
} from '../src/content/epic-objectives';
import { FAELIGHT_NODES, FARSIGHT_POLICY } from '../src/content/faelights';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import {
  REFERENCE_COVERAGE_LEDGER,
  summarizeReferenceCoverage,
} from '../src/content/reference-coverage';
import { createRift } from '../src/content/rift';
import {
  CARRY_QUEST_COMPLETION_GOLD,
  MID_EMPOWERED_RECALL_TICKS,
  ROLE_QUESTS,
  maxChampionLevelForQuest,
  maxInventorySlotsForQuest,
} from '../src/content/role-quests';
import { ITEMS } from '../src/content/rules';
import { KEYSTONE_IDS, SECONDARY_RUNE_IDS } from '../src/content/runes';
import { TRINKETS } from '../src/content/trinkets';
import { createLaneMatch } from '../src/simulation/lane-match';
import { NavGrid } from '../src/simulation/navgrid';
import { createChampionRuneState, applyInitialRuneShards } from '../src/simulation/runes';
import { swapTrinket } from '../src/simulation/trinkets';
import { wardDisabled } from '../src/simulation/oracle-lens';
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

describe('Milestone 6 — Patch 26.18 Role Quests & Capacity Policies', () => {
  test('Top Titan’s Resolve unlocks Level 20 cap while non-Top champions stay capped at Level 18', () => {
    const match = createLaneMatch(publicRift, 'darius');
    expect(match.player.role).toBe('top');
    expect(match.player.roleQuest?.role).toBe('top');
    expect(maxChampionLevelForQuest(match.player.roleQuest)).toBe(18);

    // Reach Level 18 before quest completion -> capped at 18
    match.gainExperience(50_000, match.player.id);
    expect(match.player.level).toBe(18);

    // Complete Top quest -> cap expands to 20 and further XP levels Darius to 20
    match.player.roleQuest!.progress = match.player.roleQuest!.target - 10;
    const enemy = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    enemy.x = match.hero.x + 120;
    enemy.y = match.hero.y;
    match.damage(match.hero, enemy, 99_999, 'true', 'ability');
    match.step();

    expect(match.player.roleQuest?.completedTick).not.toBeNull();
    expect(maxChampionLevelForQuest(match.player.roleQuest)).toBe(20);
    match.gainExperience(15_000, match.player.id);
    expect(match.player.level).toBe(20);

    // Round-trip Level 20 Top champion through strict snapshot validation
    const snap = match.snapshot();
    const restored = World.fromSnapshot(snap, publicRift);
    expect(restored.player.level).toBe(20);
    expect(restored.snapshot()).toBe(snap);
  });

  test('Carry Marksman’s Arsenal grants +300g, unlocks 7th item slot, and enforces strict snapshot capacity', () => {
    const match = createLaneMatch(publicRift, 'ezreal');
    expect(match.player.role).toBe('carry');
    expect(maxInventorySlotsForQuest(match.player.roleQuest)).toBe(6);

    match.player.gold = 25_000;
    for (const id of ['sword', 'dagger', 'ruby', 'sapphire', 'cloth', 'mantle']) {
      expect(match.buy(id)).toBeNull();
    }
    expect(match.buy('tome')).toBe('Inventory is full');

    const goldBeforeQuest = match.player.gold;
    match.player.roleQuest!.progress = match.player.roleQuest!.target - 10;
    const enemy = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    enemy.x = match.hero.x + 120;
    enemy.y = match.hero.y;
    match.damage(match.hero, enemy, 99_999, 'true', 'ability');
    match.step();

    expect(match.player.roleQuest?.completedTick).not.toBeNull();
    expect(maxInventorySlotsForQuest(match.player.roleQuest)).toBe(7);
    expect(match.player.gold).toBeGreaterThanOrEqual(goldBeforeQuest + CARRY_QUEST_COMPLETION_GOLD);
    expect(match.buy('tome')).toBeNull();
    expect(match.player.inventory).toHaveLength(7);

    const snap = match.snapshot();
    const restored = World.fromSnapshot(snap, publicRift);
    expect(restored.player.inventory).toHaveLength(7);
    expect(restored.snapshot()).toBe(snap);
  });

  test('Mid Arcane Tempo empowers Recall to 4.0s and grants +15 Move Speed and +10 Ability Haste', () => {
    const match = createLaneMatch(publicRift, 'ahri');
    expect(match.player.role).toBe('mid');
    for (const u of match.units) u.ai = false;

    const baseSpeed = match.movementSpeed(match.hero);
    const baseHaste = match.abilityHaste(match.player.id);

    match.player.roleQuest!.progress = match.player.roleQuest!.target - 5;
    const enemy = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    enemy.x = match.hero.x + 200;
    enemy.y = match.hero.y;
    match.damage(match.hero, enemy, 99_999, 'true', 'ability');
    match.step();

    expect(match.player.roleQuest?.completedTick).not.toBeNull();
    expect(match.movementSpeed(match.hero)).toBeGreaterThan(baseSpeed + 14);
    expect(match.abilityHaste(match.player.id)).toBe(baseHaste + 10);

    match.hero.x = 0;
    match.hero.y = 0;
    const recallQueuedTick = match.tick;
    match.enqueue({ type: 'recall', unit: match.player.id });
    match.step();
    expect(match.player.recallEnd).toBeGreaterThanOrEqual(
      recallQueuedTick + MID_EMPOWERED_RECALL_TICKS
    );
    expect(match.player.recallEnd).toBeLessThanOrEqual(match.tick + MID_EMPOWERED_RECALL_TICKS);
  });

  test('Support World Atlas completes tribute quest and expands simultaneous Stealth Ward cap to 4', () => {
    const match = createLaneMatch(publicRift, 'morgana');
    expect(match.player.role).toBe('support');
    for (const u of match.units) u.ai = false;

    match.player.roleQuest!.progress = match.player.roleQuest!.target - 5;
    const ally = match.units.find(
      (u) => u.kind === 'champion' && u.team === 'blue' && u.id !== match.player.id
    )!;
    ally.x = match.hero.x + 150;
    ally.y = match.hero.y;
    const enemy = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    enemy.x = match.hero.x + 200;
    enemy.y = match.hero.y;
    match.damage(match.hero, enemy, 80, 'magic', 'ability');
    match.step();

    expect(match.player.roleQuest?.completedTick).not.toBeNull();

    // Move out of fountain into mid river and place 4 Stealth Wards without expiring the oldest 3
    for (let i = 0; i < 4; i++) {
      match.player.trinket.charges = 2;
      match.player.trinket.cooldownTick = 0;
      const pt = match.battlefield.reachable({ x: -200 + i * 110, y: 0 }, 30, 'blue');
      match.hero.x = pt.x;
      match.hero.y = pt.y;
      match.enqueue({ type: 'ward', unit: match.player.id, point: pt });
      match.step(35);
    }
    const activeStealthWards = match.units.filter(
      (u) => u.kind === 'ward' && u.ward?.ownerId === match.player.id && match.alive(u)
    );
    expect(activeStealthWards).toHaveLength(4);
  });
});

describe('Milestone 6 — Epic Objectives (Voidgrubs, Herald, Elemental Drakes, Soul & Elder)', () => {
  test('Voidgrubs spawn at 06:00, grant Touch of the Void structure true-damage burn, and despawn at 14:45 before Rift Herald at 15:00', () => {
    const match = createLaneMatch(publicRift, 'vi', { d: 'smite', f: 'flash' });
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;

    match.tick = EPIC_OBJECTIVE_TIMING.voidgrubFirstReadyTick - 1;
    match.step();
    expect(match.riftObjectives?.voidgrubs.unitIds).toHaveLength(3);

    // Slay one Voidgrub -> grants Touch of the Void stack to Blue team
    const grub = match.unit(match.riftObjectives!.voidgrubs.unitIds[0])!;
    grub.monster!.phase = 'idle';
    grub.monster!.spawn = null;
    match.damage(match.hero, grub, 99_999, 'true', 'ability');
    expect(match.riftObjectives?.voidgrubs.stacks.blue).toBe(1);

    // Attack enemy outer turret -> applies Touch of the Void true-damage structure burn
    const redTurret = match.units.find(
      (u) => u.kind === 'turret' && u.team === 'red' && u.structure?.role === 'outer-turret'
    )!;
    const turretHpAfterHit = redTurret.hp - 50;
    redTurret.hp = turretHpAfterHit;
    match.damage(match.hero, redTurret, 25, 'physical', 'direct');
    const hpImmediatelyAfterStrike = redTurret.hp;
    match.step(65);
    expect(redTurret.hp).toBeLessThan(hpImmediatelyAfterStrike);

    // Advance past 14:45 despawn and into 15:00 Rift Herald spawn
    match.tick = EPIC_OBJECTIVE_TIMING.voidgrubDespawnTick;
    match.step();
    expect(match.riftObjectives?.voidgrubs.unitIds).toHaveLength(0);

    match.tick = EPIC_OBJECTIVE_TIMING.heraldFirstReadyTick - 1;
    match.step();
    const heraldId = match.riftObjectives?.herald.unitId;
    expect(heraldId).not.toBeNull();
    const herald = match.unit(heraldId!)!;
    herald.monster!.phase = 'idle';
    herald.monster!.spawn = null;
    match.damage(match.hero, herald, 99_999, 'true', 'ability');
    expect(match.riftObjectives?.herald.chargeHolder?.unitId).toBe(match.player.id);

    // Next basic hit on turret consumes Herald Siege Charge for massive true damage!
    const hpBeforeSiege = redTurret.hp;
    match.damage(match.hero, redTurret, 40, 'physical', 'direct');
    expect(hpBeforeSiege - redTurret.hp).toBeGreaterThanOrEqual(
      EPIC_OBJECTIVE_TIMING.heraldTurretBaseTrueDamage
    );
    expect(match.riftObjectives?.herald.chargeHolder).toBeNull();
  });

  test('Elemental Drakes transform Elemental Rift after 2nd drake, grant Dragon Soul at 4 stacks, and spawn Elder Dragon with 20% execute', () => {
    const match = createLaneMatch(publicRift, 'darius');
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;

    // Slay 4 Elemental Drakes for Blue team
    let nextTick = EPIC_OBJECTIVE_TIMING.dragonFirstReadyTick;
    for (let i = 0; i < 4; i++) {
      match.tick = nextTick - 1;
      match.step();
      const drakeId = match.riftObjectives!.dragon.unitId!;
      expect(drakeId).not.toBeNull();
      const drake = match.unit(drakeId)!;
      drake.monster!.phase = 'idle';
      drake.monster!.spawn = null;
      match.damage(match.hero, drake, 99_999, 'true', 'ability');
      if (i === 1) {
        expect(match.riftObjectives!.dragon.lockedRiftElement).not.toBeNull();
      }
      nextTick = match.riftObjectives!.dragon.nextReadyTick;
    }

    expect(match.riftObjectives!.dragon.soulTeam).toBe('blue');
    expect(match.riftObjectives!.dragon.soulElement).not.toBeNull();

    // Spawn and slay Elder Dragon
    match.tick = match.riftObjectives!.dragon.nextReadyTick - 1;
    match.step();
    const elder = match.unit(match.riftObjectives!.dragon.unitId!)!;
    expect(elder.monster?.species).toBe('elder-dragon');
    elder.monster!.phase = 'idle';
    elder.monster!.spawn = null;
    match.damage(match.hero, elder, 99_999, 'true', 'ability');
    expect(match.riftObjectives!.dragon.elderBuff?.team).toBe('blue');

    // Aspect of the Dragon executes an enemy champion below 20% HP!
    const victim = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    victim.maxHp = 2000;
    victim.hp = 360; // 18% HP (< 20%)
    match.damage(match.hero, victim, 10, 'physical', 'direct');
    expect(victim.hp).toBe(0);

    // Snapshot round-trip preserves Dragon Soul & Elder state
    const snap = match.snapshot();
    expect(World.fromSnapshot(snap, publicRift).snapshot()).toBe(snap);
  });
});

describe('Milestone 6 — Vision Variants, Faelights, Expanded Items, Undo & Runes', () => {
  test('Farsight Alteration (Lv. 9+), Control Ward jamming, and Faelight +25% sight radius work deterministically', () => {
    const match = createLaneMatch(publicRift, 'ashe');
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;

    // Cannot swap to Farsight before Level 9
    expect(swapTrinket(match, 'farsight')).toContain('level 9');
    match.gainExperience(10_000, match.player.id);
    expect(match.player.level).toBeGreaterThanOrEqual(9);
    expect(swapTrinket(match, 'farsight')).toBeNull();

    // Cast Farsight 3,000 units away (beyond normal 600 Stealth Ward range!)
    const farsightTarget = match.battlefield.reachable(
      { x: DRAGON_PIT_POINT.x, y: DRAGON_PIT_POINT.y },
      30,
      'blue'
    );
    match.hero.x = farsightTarget.x - 2600;
    match.hero.y = farsightTarget.y;
    match.enqueue({ type: 'farsight', unit: match.player.id, point: farsightTarget });
    match.step(20);
    const blueFarsight = match.units.find(
      (u) => u.kind === 'ward' && u.ward?.variant === 'farsight'
    );
    expect(blueFarsight).toBeDefined();
    expect(blueFarsight!.maxHp).toBe(1);
    expect(blueFarsight!.ward?.expireTick).toBe(Infinity);

    // Place an enemy Stealth Ward inside a Faelight ring, then jam it with a Control Ward!
    const faelight = FAELIGHT_NODES.find((node) => {
      const snapped = match.battlefield.reachable(node, 20, 'red');
      return Math.hypot(snapped.x - node.x, snapped.y - node.y) <= node.radius - 10;
    })!;
    expect(faelight).toBeDefined();
    const redWardSpot = match.battlefield.reachable(faelight, 20, 'red');
    const redChamp = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    redChamp.x = redWardSpot.x;
    redChamp.y = redWardSpot.y;
    match.enqueue({ type: 'ward', unit: redChamp.id, point: redWardSpot });
    match.step(35);
    const redStealth = match.units.find(
      (u) => u.kind === 'ward' && u.team === 'red' && match.alive(u)
    )!;
    expect(redStealth.ward?.faelightId).toBe(faelight.id);
    // Move redChamp away so only redStealth grants sight at faelight + 980 (> 900 normal ward sight, <= 1125 Faelight ward sight)
    redChamp.x = match.battlefield.spawns.red.x;
    redChamp.y = match.battlefield.spawns.red.y;
    const probePoint = match.battlefield.reachable(
      { x: redStealth.x + 980, y: redStealth.y },
      10,
      'red'
    );
    if (
      Math.hypot(probePoint.x - redStealth.x, probePoint.y - redStealth.y) > 905 &&
      match.battlefield.lineOfSight(redStealth, probePoint)
    ) {
      expect(match.pointVisible(probePoint, 'red')).toBe(true);
    }

    // Ashe buys Control Ward at fountain and places it next to redStealth -> disables redStealth!
    const spawn = match.battlefield.spawns.blue;
    match.hero.x = spawn.x;
    match.hero.y = spawn.y;
    match.player.gold = 500;
    expect(match.buy('control-ward')).toBeNull();
    const cwSlot = match.player.inventory.indexOf('control-ward');
    expect(cwSlot).toBeGreaterThanOrEqual(0);
    match.hero.x = redStealth.x - 60;
    match.hero.y = redStealth.y;
    match.enqueue({
      type: 'use-item',
      unit: match.player.id,
      slot: cwSlot,
      point: { x: redStealth.x + 15, y: redStealth.y },
    });
    match.step(35);
    expect(wardDisabled(match, redStealth)).toBe(true);
  });

  test('Expanded item uniqueness, full-inventory recipe atomicity, Zhonya’s Stasis active, and Fountain Undo', () => {
    const w = new World(false, publicRift, 'lux');
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.player.gold = 15_000;

    // Uniqueness groups reject duplicate boots while permitting tier-1 -> tier-2 upgrade
    expect(w.buy('boots')).toBeNull();
    expect(w.buy('boots')).toContain('boots');
    expect(w.buy('sorc-shoes')).toBeNull();
    expect(w.player.inventory.filter((i) => i === 'boots')).toHaveLength(0);
    expect(w.player.inventory).toContain('sorc-shoes');

    // Fountain Undo reverses upgrade and restores tier-1 boots + exact gold!
    const goldAfterSorc = w.player.gold;
    expect(w.undoShop()).toBeNull();
    expect(w.player.inventory).toContain('boots');
    expect(w.player.inventory).not.toContain('sorc-shoes');
    expect(w.player.gold).toBe(goldAfterSorc + 800);

    // Full-inventory recipe atomicity: fill 6 slots including rod & vest, then buy Zhonya's Hourglass
    expect(w.buy('rod')).toBeNull();
    expect(w.buy('vest')).toBeNull();
    expect(w.buy('ruby')).toBeNull();
    expect(w.buy('sapphire')).toBeNull();
    expect(w.buy('tome')).toBeNull();
    expect(w.player.inventory.filter(Boolean)).toHaveLength(6);
    expect(w.buy('zhonyas')).toBeNull();
    expect(w.player.inventory).toContain('zhonyas');

    // Activate Zhonya's Hourglass -> 2.5s Stasis makes Lux invulnerable & untargetable
    const zSlot = w.player.inventory.indexOf('zhonyas');
    w.enqueue({ type: 'use-item', unit: w.player.id, slot: zSlot });
    w.step();
    expect(w.vulnerable(w.hero)).toBe(false);
    const hpBefore = w.hero.hp;
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 120, y: w.hero.y }, 'garen');
    foe.ai = false;
    w.damage(foe, w.hero, 900, 'true', 'ability');
    expect(w.hero.hp).toBe(hpBefore);
  });

  test('Runes (Press the Attack, Arcane Comet mid-flight snapshot restore, and Stat Shards) behave deterministically', () => {
    const match = createLaneMatch(publicRift, 'lux', { d: 'flash', f: 'heal' }, 'standard', {
      keystone: 'comet',
      secondary: 'transcendence',
      shards: { offense: 'haste', flex: 'adaptive', defense: 'flat-hp' },
    });
    for (const u of match.units) u.ai = false;
    match.nextWaveTick = 1_000_000_000;

    const foe = match.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
    foe.x = match.hero.x + 350;
    foe.y = match.hero.y;
    const hpBefore = foe.hp;
    match.damage(match.hero, foe, 60, 'magic', 'ability');
    expect(match.activeComets?.length).toBe(1);

    // Save during Arcane Comet travel, restore, and verify identical impact state!
    match.step(5);
    const midFlightSnap = match.snapshot();
    const restored = World.fromSnapshot(midFlightSnap, publicRift);
    match.step(40);
    restored.step(40);
    expect(restored.snapshot()).toBe(match.snapshot());
    expect(foe.hp).toBeLessThan(hpBefore - 60);

    // Press the Attack 3-hit expose
    const ptaWorld = new World(false, PRACTICE_FIXTURE, 'ashe');
    ptaWorld.nextWaveTick = Infinity;
    ptaWorld.player.runeState = createChampionRuneState({
      keystone: 'pta',
      secondary: 'alacrity',
      shards: { offense: 'attack-speed', flex: 'adaptive', defense: 'flat-hp' },
    });
    applyInitialRuneShards(ptaWorld, ptaWorld.hero, ptaWorld.player);
    const target = ptaWorld.spawn(
      'champion',
      'red',
      { x: ptaWorld.hero.x + 200, y: ptaWorld.hero.y },
      'garen'
    );
    target.ai = false;
    target.maxHp = 3000;
    target.hp = 3000;
    for (let i = 0; i < 3; i++) {
      ptaWorld.damage(ptaWorld.hero, target, 50, 'physical', 'direct');
      ptaWorld.step(10);
    }
    expect(target.ptaExposedUntil).toBeGreaterThan(ptaWorld.tick);
  });

  test('Patch 26.18 Reference Coverage Ledger covers every advertised champion, ability, quest, trinket, item, and rune', () => {
    const summary = summarizeReferenceCoverage();
    expect(summary.byCategory.champion).toBe(PUBLIC_SELECTABLE_CHAMPIONS.length);
    expect(summary.byCategory.ability).toBe(PUBLIC_SELECTABLE_CHAMPIONS.length * 5);
    expect(summary.byCategory['role-quest']).toBe(Object.keys(ROLE_QUESTS).length);
    expect(summary.byCategory.item).toBe(ITEMS.length);

    const ids = new Set(REFERENCE_COVERAGE_LEDGER.map((e) => e.id));
    expect(ids.size).toBe(REFERENCE_COVERAGE_LEDGER.length);
    for (const champ of PUBLIC_SELECTABLE_CHAMPIONS) {
      expect(ids.has(`champion:${champ}`)).toBe(true);
      for (const slot of ['p', 'q', 'w', 'e', 'r'] as const) {
        expect(ids.has(`ability:${champ}:${slot}`)).toBe(true);
      }
    }
    for (const item of ITEMS) expect(ids.has(`item:${item.id}`)).toBe(true);
    for (const trinket of Object.keys(TRINKETS))
      expect(ids.has(`vision:trinket:${trinket}`)).toBe(true);
    for (const k of KEYSTONE_IDS) expect(ids.has(`rune:keystone:${k}`)).toBe(true);
    for (const s of SECONDARY_RUNE_IDS) expect(ids.has(`rune:secondary:${s}`)).toBe(true);
    expect(TOP_PIT_POINT.x).toBeLessThan(0);
    expect(FARSIGHT_POLICY.range).toBe(4000);
  });
});
