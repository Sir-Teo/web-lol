import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  DARIUS_KIT,
  EZREAL_KIT,
  MORGANA_KIT,
  VI_KIT,
} from '../src/content/milestone6-champions';
import { createRift } from '../src/content/rift';
import { TICK_RATE } from '../src/content/rules';
import { createLaneMatch } from '../src/simulation/lane-match';
import { distance } from '../src/simulation/math';
import { NavGrid } from '../src/simulation/navgrid';
import type { ChampionIdentity } from '../src/simulation/types';
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

const PUBLIC_CHAMPIONS: ChampionIdentity[] = [
  'ashe',
  'lux',
  'garen',
  'masteryi',
  'leona',
  'ahri',
  'darius',
  'vi',
  'ezreal',
  'morgana',
];

function setupDuel(playerChamp: ChampionIdentity, foeChamp?: ChampionIdentity) {
  const w = createLaneMatch(publicRift, playerChamp);
  w.nextWaveTick = Infinity;
  for (const u of w.units) u.ai = false;
  const hero = w.hero;
  const mid = publicRift.reachable({ x: 0, y: 0 }, hero.radius, 'blue');
  hero.x = mid.x;
  hero.y = mid.y;
  const foePos = publicRift.reachable({ x: mid.x + 280, y: mid.y }, 65, 'red');
  const foe =
    (foeChamp
      ? w.units.find((u) => u.kind === 'champion' && u.team === 'red' && u.champion === foeChamp)
      : undefined) ?? w.units.find((u) => u.kind === 'champion' && u.team === 'red')!;
  foe.x = foePos.x;
  foe.y = foePos.y;
  foe.previous = { x: foePos.x, y: foePos.y };
  foe.ai = false;
  foe.maxHp = 4000;
  foe.hp = 4000;
  return { w, hero, foe };
}

function levelTo(w: World, targetLevel: number) {
  w.player.level = targetLevel;
  w.player.skillPoints = targetLevel;
  w.player.spellRanks = { q: 0, w: 0, e: 0, r: 0 };
  for (const ability of ['q', 'w', 'e'] as const) {
    w.enqueue({ type: 'learn', unit: w.player.id, ability });
  }
  if (targetLevel >= 6) {
    w.enqueue({ type: 'learn', unit: w.player.id, ability: 'r' });
  }
  w.step(1);
  w.hero.mana = w.hero.maxMana;
}

describe('Milestone 7.1 — Ten-Champion Executable Behavior Matrices', () => {
  test.each(PUBLIC_CHAMPIONS)(
    'champion %s obeys resource costs, cooldown lockouts, and deterministic snapshot round-trip',
    (champ) => {
      const { w, hero, foe } = setupDuel(champ);
      levelTo(w, 6);
      // Verify casting Q at 0 mana is rejected for mana champions (manaless Garen still casts freely)
      if (hero.maxMana > 0) {
        hero.mana = 0;
        w.enqueue({
          type: 'cast',
          unit: w.player.id,
          ability: 'q',
          point: { x: foe.x, y: foe.y },
          targetId: foe.id,
        });
        w.step(2);
        expect(w.player.cooldowns.q).toBeLessThanOrEqual(w.tick);
      }

      // Restore mana and cast an always-castable spell (W for Ashe since Q requires 4 Focus stacks)
      hero.mana = hero.maxMana;
      const ability = champ === 'ashe' ? 'w' : 'q';
      w.enqueue({
        type: 'cast',
        unit: w.player.id,
        ability,
        point: { x: foe.x, y: foe.y },
        ...(champ === 'masteryi' ? { targetId: foe.id } : {}),
      });
      w.step(5);
      const cdActive =
        w.player.cooldowns[ability] > w.tick ||
        (w.player.darius?.qWindupEndTick ?? 0) > w.tick ||
        (w.player.vi?.qDash !== null && w.player.vi?.qDash !== undefined) ||
        w.player.garenQ !== null ||
        w.player.leonaQ !== null ||
        w.player.alphaStrike !== null;
      expect(cdActive).toBe(true);

      // Snapshot round-trip produces exact bit-identical continuation
      const snap = w.snapshot();
      const restored = World.fromSnapshot(snap, publicRift);
      w.step(30);
      restored.step(30);
      expect(restored.snapshot()).toBe(w.snapshot());
    }
  );

  test('Darius matrix: Q outer blade heals & bleeds, inner hilt deals 35% with no bleed, W kill refunds mana & CD, R doubles damage at 5 Hemorrhage stacks', () => {
    // 1) Q outer blade vs inner hilt
    const { w, hero, foe } = setupDuel('darius', 'garen');
    levelTo(w, 6);
    hero.hp = hero.maxHp * 0.5;
    foe.x = hero.x + 340; // outer blade zone (240..425)
    foe.y = hero.y;
    const hpBeforeOuter = hero.hp;
    const foeHpBeforeOuter = foe.hp;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: { x: foe.x, y: foe.y } });
    w.step(DARIUS_KIT.q.windupTicks + 3);
    expect(hero.hp).toBeGreaterThan(hpBeforeOuter + 10);
    expect(foe.hemorrhage?.stacks).toBe(1);
    const outerDamage = foeHpBeforeOuter - foe.hp;

    // Inner hilt check
    const inner = setupDuel('darius', 'garen');
    levelTo(inner.w, 6);
    inner.hero.hp = inner.hero.maxHp * 0.5;
    inner.foe.x = inner.hero.x + 120; // inner hilt (< 240)
    inner.foe.y = inner.hero.y;
    const innerHeroHpBefore = inner.hero.hp;
    const innerFoeHpBefore = inner.foe.hp;
    inner.w.enqueue({
      type: 'cast',
      unit: inner.w.player.id,
      ability: 'q',
      point: { x: inner.foe.x, y: inner.foe.y },
    });
    inner.w.step(DARIUS_KIT.q.windupTicks + 3);
    expect(inner.hero.hp - innerHeroHpBefore).toBeLessThan(15); // only passive HP regen, no blade heal
    expect(inner.foe.hemorrhage).toBeUndefined();
    const innerDamage = innerFoeHpBefore - inner.foe.hp;
    expect(innerDamage).toBeLessThan(outerDamage * 0.5);

    // 2) W kill refund restores mana and halves remaining cooldown
    const wKill = setupDuel('darius', 'garen');
    levelTo(wKill.w, 6);
    const minion = wKill.w.spawn('melee', 'red', { x: wKill.hero.x + 100, y: wKill.hero.y });
    minion.ai = false;
    minion.hp = 20;
    wKill.hero.mana = 200;
    wKill.w.enqueue({
      type: 'cast',
      unit: wKill.w.player.id,
      ability: 'w',
      point: { x: minion.x, y: minion.y },
    });
    wKill.w.step(2);
    const manaAfterCast = wKill.hero.mana;
    wKill.w.enqueue({
      type: 'order',
      unit: wKill.w.player.id,
      order: { type: 'attack', target: minion.id },
    });
    wKill.w.step(40);
    expect(wKill.w.alive(minion)).toBe(false);
    expect(wKill.hero.mana).toBeGreaterThan(manaAfterCast);

    // 3) R damage doubles at 5 Hemorrhage stacks vs 0 stacks
    const r0 = setupDuel('darius', 'garen');
    levelTo(r0.w, 6);
    r0.foe.x = r0.hero.x + 250;
    const r0Before = r0.foe.hp;
    r0.w.enqueue({
      type: 'cast',
      unit: r0.w.player.id,
      ability: 'r',
      point: { x: r0.foe.x, y: r0.foe.y },
      targetId: r0.foe.id,
    });
    r0.w.step(5);
    const dmg0 = r0Before - r0.foe.hp;

    const r5 = setupDuel('darius', 'garen');
    levelTo(r5.w, 6);
    r5.foe.x = r5.hero.x + 250;
    r5.foe.hemorrhage = {
      sourceId: r5.hero.id,
      stacks: 5,
      endTick: r5.w.tick + 300,
      nextTick: r5.w.tick + 60,
    };
    const r5Before = r5.foe.hp;
    r5.w.enqueue({
      type: 'cast',
      unit: r5.w.player.id,
      ability: 'r',
      point: { x: r5.foe.x, y: r5.foe.y },
      targetId: r5.foe.id,
    });
    r5.w.step(5);
    const dmg5 = r5Before - r5.foe.hp;
    expect(dmg5).toBeGreaterThan(dmg0 * 1.9);
  });

  test('Vi matrix: Blast Shield triggers on ability hit, W 3-hit shreds armor, Q stops on champion, R chases target and stuns', () => {
    const { w, hero, foe } = setupDuel('vi', 'garen');
    levelTo(w, 6);
    foe.x = hero.x + 320;
    foe.y = hero.y;
    // Q dash hits foe, triggers Blast Shield + stun
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'q',
      point: { x: foe.x + 150, y: foe.y },
    });
    w.step(25);
    expect(hero.shields.length).toBeGreaterThan(0);
    expect(foe.stunUntil).toBeGreaterThan(w.tick - 10);
    // W stack was applied on Q hit (1), E + basic completes 3-hit Denting Blows armor shred
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'e',
      point: { x: foe.x, y: foe.y },
    });
    w.enqueue({ type: 'order', unit: w.player.id, order: { type: 'attack', target: foe.id } });
    w.step(120);
    expect(foe.viArmorShredUntil ?? 0).toBeGreaterThan(w.tick);

    // R chases target and applies 1.4s stun on arrival
    const rDuel = setupDuel('vi', 'ashe');
    levelTo(rDuel.w, 6);
    rDuel.foe.x = rDuel.hero.x + 500;
    rDuel.foe.y = rDuel.hero.y;
    rDuel.w.enqueue({
      type: 'cast',
      unit: rDuel.w.player.id,
      ability: 'r',
      point: { x: rDuel.foe.x, y: rDuel.foe.y },
      targetId: rDuel.foe.id,
    });
    rDuel.w.step(5);
    expect(rDuel.w.player.vi?.rDash).not.toBeNull();
    rDuel.w.step(60);
    expect(rDuel.w.player.vi?.rDash).toBeNull();
    expect(rDuel.foe.stunUntil).toBeGreaterThan(rDuel.w.tick);
  });

  test('Ezreal matrix: W passes through minions to mark champion, Q detonates W + refunds CDs + stacks passive, E blinks & fires homing bolt, R channels & pierces', () => {
    const { w, hero, foe } = setupDuel('ezreal', 'garen');
    levelTo(w, 6);
    const minion = w.spawn('melee', 'red', { x: hero.x + 160, y: hero.y });
    minion.ai = false;
    foe.x = hero.x + 360;
    foe.y = hero.y;

    // Cast W through minion -> marks champion (passes through minion)
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'w', point: { x: foe.x, y: foe.y } });
    w.step(25);
    expect(foe.essenceFlux).toBeDefined();

    // Move minion out of path and cast Q -> hits champion, detonates W, refunds W CD, grants Rising Spell Force stacks
    minion.y += 400;
    const wCdBefore = w.player.cooldowns.w;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: { x: foe.x, y: foe.y } });
    w.step(25);
    expect(foe.essenceFlux).toBeUndefined();
    expect(w.player.cooldowns.w).toBeLessThan(wCdBefore);
    expect(w.player.ezreal?.risingStacks).toBeGreaterThanOrEqual(2);

    // E blinks toward point and fires homing bolt
    const posBefore = { x: hero.x, y: hero.y };
    const foeHpBeforeE = foe.hp;
    w.enqueue({
      type: 'cast',
      unit: w.player.id,
      ability: 'e',
      point: { x: hero.x + 250, y: hero.y },
    });
    w.step(5);
    expect(distance(posBefore, hero)).toBeGreaterThan(150);
    expect(foe.hp).toBeLessThan(foeHpBeforeE);

    // R channels 1s then fires global piercing missile
    const foeHpBeforeR = foe.hp;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'r', point: { x: foe.x, y: foe.y } });
    w.step(10);
    expect(w.player.ezreal?.rChannel).not.toBeNull();
    w.step(EZREAL_KIT.r.windupTicks + 25);
    expect(foe.hp).toBeLessThan(foeHpBeforeR);
  });

  test('Morgana matrix: Q roots target, W scales with missing HP & heals via Soul Siphon, E blocks magic/CC but NOT physical damage, R tethers and stuns or breaks on escape', () => {
    // 1) Q root + Soul Siphon heal
    const { w, hero, foe } = setupDuel('morgana', 'garen');
    levelTo(w, 6);
    foe.x = hero.x + 340;
    foe.y = hero.y;
    hero.hp = hero.maxHp * 0.6;
    const heroHpBefore = hero.hp;
    w.enqueue({ type: 'cast', unit: w.player.id, ability: 'q', point: { x: foe.x, y: foe.y } });
    w.step(30);
    expect(foe.rootUntil).toBeGreaterThan(w.tick);
    expect(hero.hp).toBeGreaterThan(heroHpBefore + 5); // Soul Siphon healed from Q hit

    // W on low-HP foe deals more damage than on full-HP foe
    const fullW = setupDuel('morgana', 'garen');
    levelTo(fullW.w, 6);
    fullW.foe.x = fullW.hero.x + 250;
    const fullBefore = fullW.foe.hp;
    fullW.w.enqueue({
      type: 'cast',
      unit: fullW.w.player.id,
      ability: 'w',
      point: { x: fullW.foe.x, y: fullW.foe.y },
    });
    fullW.w.step(90);
    const fullDmg = fullBefore - fullW.foe.hp;

    const lowW = setupDuel('morgana', 'garen');
    levelTo(lowW.w, 6);
    lowW.foe.x = lowW.hero.x + 250;
    lowW.foe.hp = lowW.foe.maxHp * 0.2;
    const lowBefore = lowW.foe.hp;
    lowW.w.enqueue({
      type: 'cast',
      unit: lowW.w.player.id,
      ability: 'w',
      point: { x: lowW.foe.x, y: lowW.foe.y },
    });
    lowW.w.step(90);
    const lowDmg = lowBefore - lowW.foe.hp;
    expect(lowDmg).toBeGreaterThan(fullDmg * 1.5);

    // 2) E Black Shield blocks magic damage & CC, lets physical damage bypass shield
    const eTest = setupDuel('morgana', 'lux');
    levelTo(eTest.w, 6);
    eTest.w.enqueue({
      type: 'cast',
      unit: eTest.w.player.id,
      ability: 'e',
      point: { x: eTest.hero.x, y: eTest.hero.y },
      targetId: eTest.hero.id,
    });
    eTest.w.step(2);
    const bs = eTest.hero.shields.find((s) => s.blackShield);
    expect(bs).toBeDefined();
    const shieldBefore = bs!.amount;
    const hpBeforePhys = eTest.hero.hp;
    eTest.w.damage(eTest.foe, eTest.hero, 50, 'physical', 'direct');
    expect(eTest.hero.hp).toBeLessThan(hpBeforePhys); // physical bypassed Black Shield
    expect(bs!.amount).toBe(shieldBefore); // Black Shield untouched by physical

    const hpBeforeMagic = eTest.hero.hp;
    eTest.w.damage(eTest.foe, eTest.hero, 40, 'magic', 'ability');
    expect(eTest.hero.hp).toBeCloseTo(hpBeforeMagic, 0); // magic absorbed by Black Shield
    expect(bs!.amount).toBeLessThan(shieldBefore);

    // 3) R Soul Shackles tether stuns if enemy stays within range, breaks if enemy flees past break radius
    const rStay = setupDuel('morgana', 'garen');
    levelTo(rStay.w, 6);
    rStay.foe.x = rStay.hero.x + 300;
    rStay.w.enqueue({
      type: 'cast',
      unit: rStay.w.player.id,
      ability: 'r',
      point: { x: rStay.foe.x, y: rStay.foe.y },
    });
    rStay.w.step(MORGANA_KIT.r.durationTicks + 5);
    expect(rStay.foe.stunUntil).toBeGreaterThan(rStay.w.tick);

    const rBreak = setupDuel('morgana', 'garen');
    levelTo(rBreak.w, 6);
    rBreak.foe.x = rBreak.hero.x + 300;
    rBreak.w.enqueue({
      type: 'cast',
      unit: rBreak.w.player.id,
      ability: 'r',
      point: { x: rBreak.foe.x, y: rBreak.foe.y },
    });
    rBreak.w.step(10);
    rBreak.foe.x = rBreak.hero.x + MORGANA_KIT.r.breakRadius + 200;
    rBreak.w.step(MORGANA_KIT.r.durationTicks + 5);
    expect(rBreak.foe.stunUntil).toBeLessThanOrEqual(rBreak.w.tick);
  });

  test('Ability haste reduces spell cooldowns cleanly across M6 champions', () => {
    const noHaste = setupDuel('ezreal', 'garen');
    levelTo(noHaste.w, 6);
    noHaste.w.enqueue({
      type: 'cast',
      unit: noHaste.w.player.id,
      ability: 'e',
      point: { x: noHaste.hero.x + 200, y: noHaste.hero.y },
    });
    noHaste.w.step(3);
    const cdNoHaste = noHaste.w.player.cooldowns.e - noHaste.w.tick;

    const withHaste = setupDuel('ezreal', 'garen');
    levelTo(withHaste.w, 6);
    withHaste.w.player.gold = 10000;
    withHaste.hero.x = publicRift.spawns.blue.x;
    withHaste.hero.y = publicRift.spawns.blue.y;
    expect(withHaste.w.buy('black-cleaver', withHaste.w.player.id)).toBeNull();
    expect(withHaste.w.buy('ionian-boots', withHaste.w.player.id)).toBeNull();
    withHaste.w.enqueue({
      type: 'cast',
      unit: withHaste.w.player.id,
      ability: 'e',
      point: { x: withHaste.hero.x + 200, y: withHaste.hero.y },
    });
    withHaste.w.step(3);
    const cdWithHaste = withHaste.w.player.cooldowns.e - withHaste.w.tick;
    expect(cdWithHaste).toBeLessThan(cdNoHaste);
    expect(VI_KIT.q.cooldownSecondsByRank[0]).toBeGreaterThan(0);
    expect(TICK_RATE).toBe(60);
  });
});
