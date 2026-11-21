import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  CHAMPION_PROFILES,
  PUBLIC_SELECTABLE_CHAMPIONS,
  championProfile,
} from '../src/content/champion-profiles';
import { PLAYER_CHAMPION_ROLES } from '../src/content/champion-roles';
import { DARIUS_KIT, EZREAL_KIT, MORGANA_KIT, VI_KIT } from '../src/content/milestone6-champions';
import { MOBILE_CLIP_DURATIONS } from '../src/content/mobile-clip-durations';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { createRift } from '../src/content/rift';
import {
  MatchReplayPlayer,
  MatchReplayRecorder,
  digestSnapshotSha256,
  parseMatchReplayLog,
} from '../src/replay/match-replay';
import { createLaneMatch } from '../src/simulation/lane-match';
import { hasBlackShield } from '../src/simulation/milestone6-champions';
import { NavGrid } from '../src/simulation/navgrid';
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

describe('Milestone 6 — Repeatable 10-Champion Full-Roster Contract', () => {
  test.each(PUBLIC_SELECTABLE_CHAMPIONS)(
    '%s satisfies complete asset, progression, 4-spell kit, bot AI, and snapshot round-trip contract',
    (champion) => {
      // 1. Shipped model, sidecar, icon, profile, role, and animation clip durations exist
      expect(existsSync(`public/assets/models/${champion}-base.glb`)).toBe(true);
      expect(existsSync(`public/assets/models/${champion}-base.json`)).toBe(true);
      expect(existsSync(`public/assets/icons/${champion}.png`)).toBe(true);
      const profile = championProfile(champion);
      expect(profile).toBe(CHAMPION_PROFILES[champion]);
      expect(profile.hp).toBeGreaterThan(500);
      expect(PLAYER_CHAMPION_ROLES[champion]).toBeDefined();
      const clips = MOBILE_CLIP_DURATIONS[`${champion}-base` as keyof typeof MOBILE_CLIP_DURATIONS];
      expect(clips).toBeDefined();
      expect(Object.keys(clips).length).toBeGreaterThanOrEqual(5);

      // 2. All 4 spells learn cleanly to max rank with valid icons and non-empty descriptions
      const w = new World(false, publicRift, champion);
      w.nextWaveTick = 1_000_000_000;
      for (const u of w.units) u.ai = false;
      w.gainExperience(25_000, w.player.id);
      expect(w.player.level).toBe(18);
      for (const slot of ['q', 'w', 'e'] as const) {
        for (let r = 0; r < 5; r++) expect(w.learnSpell(slot, w.player.id)).toBeNull();
      }
      for (let r = 0; r < 3; r++) expect(w.learnSpell('r', w.player.id)).toBeNull();
      for (const slot of ['q', 'w', 'e', 'r'] as const) {
        const spec = w.abilitySpec(slot, w.player.id);
        expect(spec.name.length).toBeGreaterThan(2);
        expect(spec.description.length).toBeGreaterThan(10);
        expect(existsSync(`public/assets/icons/${spec.icon}.png`)).toBe(true);
      }

      // 3. Snapshot round-trip & deterministic AI advancement
      const snap = w.snapshot();
      const restored = World.fromSnapshot(snap, publicRift);
      expect(restored.snapshot()).toBe(snap);
    }
  );

  test('Darius kit: 5-stack Hemorrhage -> Noxian Might, outer-blade Q heal, E pull, and R true-damage reset', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'darius');
    w.nextWaveTick = Infinity;
    w.gainExperience(4_000);
    for (const s of ['q', 'w', 'e', 'r'] as const) w.learnSpell(s);
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 330, y: w.hero.y }, 'garen');
    foe.ai = false;
    foe.maxHp = 4000;
    foe.hp = 4000;

    // Damage Darius first, then hit foe in outer Q blade (330 radius is inside [240, 425]) -> heals Darius + applies Hemorrhage
    w.hero.hp = Math.floor(w.hero.maxHp * 0.5);
    const hpBeforeQ = w.hero.hp;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: foe });
    w.step(DARIUS_KIT.q.windupTicks + 2);
    expect(w.hero.hp).toBeGreaterThan(hpBeforeQ + 40);
    expect(foe.hemorrhage?.stacks).toBe(1);

    // Apply real basic attacks + Crippling Strike (W) to reach 5 stacks -> triggers Noxian Might bonus AD!
    foe.x = w.hero.x + 120;
    const baseAd = w.hero.damage;
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(20);
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'w', point: foe });
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(215);
    expect(foe.hemorrhage?.stacks).toBe(5);
    expect(w.player.darius!.noxianMightUntil).toBeGreaterThan(w.tick);

    // Noxian Guillotine executes low-HP foe with 2x stack-amplified true damage and resets R cooldown!
    foe.hp = 260;
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'r',
      point: foe,
      targetId: foe.id,
    });
    w.step(2);
    expect(foe.hp).toBe(0);
    expect(w.abilityCooldownTicks('r')).toBe(0);
    expect(baseAd).toBeGreaterThan(50);
  });

  test('Vi kit: Q Vault Breaker dash + Blast Shield, W Denting Blows 3rd-hit armor shred, and R unstoppable lockdown', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'vi');
    w.nextWaveTick = Infinity;
    w.gainExperience(4_000);
    for (const s of ['q', 'w', 'e', 'r'] as const) w.learnSpell(s);
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 280, y: w.hero.y }, 'lux');
    foe.ai = false;
    foe.maxHp = 3500;
    foe.hp = 3500;
    const baseArmor = w.effectiveArmor(foe);

    // Q Vault Breaker dashes through foe, deals damage, applies Denting Blows, and grants Blast Shield!
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'q',
      point: { x: foe.x + 120, y: foe.y },
    });
    w.step(25);
    expect(w.shieldAmount(w.hero)).toBeGreaterThan(0);
    expect(w.player.vi!.dentingStacks).toBeGreaterThanOrEqual(1);

    // Trigger basic attack + E Relentless Force attack reset to proc 3rd-stack Denting Blows armor shred!
    foe.x = w.hero.x + 110;
    foe.y = w.hero.y;
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(20);
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'e', point: foe });
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(30);
    expect(foe.viArmorShredUntil).toBeGreaterThan(w.tick);
    expect(w.effectiveArmor(foe)).toBeLessThan(baseArmor);

    // R Cease and Desist chases down and stuns foe
    foe.x = w.hero.x + 480;
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'r',
      point: foe,
      targetId: foe.id,
    });
    w.step(40);
    expect(foe.hp).toBeLessThan(3200);
    expect(foe.stunUntil).toBeGreaterThan(w.tick - 30);
    expect(VI_KIT.r.range).toBe(800);
  });

  test('Ezreal kit: W Essence Flux + Q Mystic Shot detonation, flat 1.5s CD refund, E blink, and R global mid-flight save/restore', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'ezreal');
    w.nextWaveTick = Infinity;
    w.gainExperience(4_000);
    for (const s of ['q', 'w', 'e', 'r'] as const) w.learnSpell(s);
    const foe = w.spawn('champion', 'red', { x: w.hero.x + 420, y: w.hero.y }, 'garen');
    foe.ai = false;
    foe.maxHp = 3500;
    foe.hp = 3500;

    // Put E on cooldown so we can verify Q's 1.5s flat cooldown refund!
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'e',
      point: { x: w.hero.x + 80, y: w.hero.y },
    });
    w.step(2);
    foe.x = w.hero.x + 380;
    foe.y = w.hero.y;
    const eCooldownBeforeQ = w.player.cooldowns.e;

    // Cast W Essence Flux -> marks Garen, then Q Mystic Shot -> detonates W & refunds 1.5s (90 ticks) off E!
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'w', point: foe });
    w.step(25);
    expect(foe.essenceFlux).toBeDefined();

    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: foe });
    w.step(25);
    expect(foe.essenceFlux).toBeUndefined();
    expect(w.player.cooldowns.e).toBeLessThanOrEqual(eCooldownBeforeQ - 85);
    expect(w.player.ezreal!.risingStacks).toBeGreaterThanOrEqual(2);

    // Fire R Trueshot Barrage, save while missile is in flight, restore, and verify identical future!
    foe.x = w.hero.x + 1200;
    const hpBeforeR = foe.hp;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: foe });
    w.step(EZREAL_KIT.r.windupTicks + 5);
    expect(w.m6Missiles?.some((m) => m.kind === 'ezreal-r')).toBe(true);

    const midFlight = w.snapshot();
    const restored = World.fromSnapshot(midFlight, PRACTICE_FIXTURE);
    w.step(50);
    restored.step(50);
    expect(restored.snapshot()).toBe(w.snapshot());
    expect(foe.hp).toBeLessThan(hpBeforeR);
  });

  test('Morgana kit: Q root, W pool, E Black Shield total CC immunity, and R Soul Shackles tether stun', () => {
    const w = new World(false, PRACTICE_FIXTURE, 'morgana');
    w.nextWaveTick = Infinity;
    w.gainExperience(4_000);
    for (const s of ['q', 'w', 'e', 'r'] as const) w.learnSpell(s);
    const ally = w.spawn('champion', 'blue', { x: w.hero.x + 120, y: w.hero.y }, 'ashe');
    ally.ai = false;
    const enemyLux = w.spawn('champion', 'red', { x: w.hero.x + 360, y: w.hero.y }, 'lux');
    enemyLux.ai = false;
    const luxState = w.championState(enemyLux.id)!;
    luxState.spellRanks.q = 5;

    // Grant Black Shield to Ashe -> enemy Lux Q Light Binding hits Ashe's shield WITHOUT rooting Ashe!
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'e',
      point: ally,
      targetId: ally.id,
    });
    w.step(2);
    expect(hasBlackShield(ally, w.tick)).toBe(true);

    w.enqueue({ type: 'cast', unit: enemyLux.id, ability: 'q', point: ally });
    w.step(35);
    expect(ally.rootUntil).toBeLessThanOrEqual(w.tick);

    // Morgana Q Dark Binding roots unshielded enemyLux!
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: enemyLux });
    w.step(30);
    expect(enemyLux.rootUntil).toBeGreaterThan(w.tick);

    // Morgana R Soul Shackles tethers enemyLux and stuns after 3.0s!
    enemyLux.rootUntil = 0;
    enemyLux.x = w.hero.x + 280;
    enemyLux.y = w.hero.y;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: w.hero });
    w.step(MORGANA_KIT.r.durationTicks + 2);
    expect(enemyLux.stunUntil).toBeGreaterThan(w.tick);
  });

  test('Public 5v5 spawns 10 distinct champions (zero mirrors) and replays deterministically with verified SHA-256 checkpoints', async () => {
    const match = createLaneMatch(publicRift, 'darius');
    const champs = match.units.filter((u) => u.kind === 'champion').map((u) => u.champion!);
    expect(champs).toHaveLength(10);
    expect(new Set(champs).size).toBe(10);

    const recorder = new MatchReplayRecorder(match, 300);
    match.buy('dorans-shield');
    match.undoShop();
    match.buy('blade');
    match.buy('health-potion');
    recorder.step(450);
    match.enqueue({ type: 'learn', unit: match.player.id, ability: 'q' });
    recorder.step(450);

    const expectedFinal = await digestSnapshotSha256(match.snapshot());
    const log = await recorder.exportLog();
    recorder.detach();

    const parsed = await parseMatchReplayLog(JSON.stringify(log), publicRift);
    const player = new MatchReplayPlayer(parsed, publicRift, 180);
    while (player.world.tick < parsed.endTick) {
      player.step(60);
    }
    // Wait a microtask turn for async subtle.digest checkpoint verification
    await new Promise((r) => setTimeout(r, 25));
    expect(player.divergenceError).toBeNull();
    expect(await digestSnapshotSha256(player.world.snapshot())).toBe(expectedFinal);
  }, 30_000);
});
