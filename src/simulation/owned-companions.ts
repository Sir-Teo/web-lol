import {
  COMPANION_SOURCE as S,
  COMPANION_POLICY as P,
  companionStage,
  type CompanionKind,
  type CompanionAction,
} from '../content/companion-policy';
import { championProfile } from '../content/champion-profiles';
import { growthAtLevel, statPrecision } from './progression';
import { SUMMONER_SMITE } from '../content/summoner-smite';
import { isDoranStarter } from '../content/companion-items-policy';
import { advanceCompanionPassive, companionPassiveMonsterKill } from './companion-passives';
import { distance, type Vec2 } from './math';
import type { World } from './world';
import type { OwnedCompanion, Unit } from './types';
export const ownedCompanion = (w: World, id: number) => w.companions.find((p) => p.ownerId === id);
export function grantCompanion(
  w: World,
  kind: CompanionKind,
  ownerId = w.player.id,
  acquisition: OwnedCompanion['acquisition'] = { kind: 'fixture' }
): OwnedCompanion {
  const owner = w.unit(ownerId);
  if (
    (acquisition.kind === 'fixture' &&
      (w.battlefield.id !== 'practice-fixture' ||
        w.matchMode !== 'practice' ||
        w.encounter !== 'gromp')) ||
    (acquisition.kind === 'purchase' &&
      (acquisition.consumedTick !== null || !w.championState(ownerId)?.inventory.includes(kind))) ||
    w.championState(ownerId)?.inventory.some(isDoranStarter) ||
    !owner ||
    owner.kind !== 'champion' ||
    !w.summonerSlot('smite', ownerId) ||
    ownedCompanion(w, ownerId)
  )
    throw new Error('Owned companion requires a valid Smite-equipped owner and acquisition.');
  const p: OwnedCompanion = {
    acquisition: { ...acquisition },
    passive: null,
    ownerId,
    kind,
    createdTick: w.tick,
    x: owner.x,
    y: owner.y,
    previous: { x: owner.x, y: owner.y },
    facing: owner.facing,
    fed: 0,
    bonusTreats: 0,
    nextTreatTick: w.tick + P.initialTreatTick,
    firstMonsterDone: false,
    firstEvolvedTick: null,
    fullGrownTick: null,
    targetId: null,
    activeUntil: 0,
    nextStrikeTick: w.tick,
    releaseTick: null,
    pose: { action: 'spawn', startTick: w.tick },
    path: [],
    nextPathTick: w.tick,
  };
  w.companions.push(p);
  return p;
}
export function companionDps(w: World, u: Unit): number {
  const s = w.championState(u.id)!,
    b = championProfile(u.champion!),
    g = growthAtLevel(s.level);
  return (
    20 +
    (130 * (s.level - 1)) / 17 +
    0.1 * Math.max(0, u.damage - b.damage - b.damageGrowth * g) +
    0.16 * w.abilityPower(u) +
    0.04 * Math.max(0, u.maxHp - b.hp - b.hpGrowth * g) +
    0.25 * Math.max(0, w.armorWithBuffs(u) - b.armor - b.armorGrowth * g) +
    0.25 * Math.max(0, w.effectiveMagicResist(u) - b.magicResist - b.magicResistGrowth * g)
  );
}
export const companionHps = (level: number) => 6 + Math.max(0, level - 3) * 2;
function pose(p: OwnedCompanion, action: CompanionAction, tick: number) {
  if (
    p.pose.action === 'transform' &&
    action !== 'transform' &&
    tick < p.pose.startTick + Math.ceil(S.profiles[p.kind].clips.transform.durationSeconds * 60)
  )
    return;
  p.pose = { action, startTick: tick };
}
export function noteCompanionCombat(w: World, source: Unit, target: Unit): void {
  const p = ownedCompanion(w, source.id);
  if (!p || target.kind !== 'monster' || !w.alive(target)) return;
  if (p.targetId !== target.id) {
    p.nextStrikeTick = w.tick;
    p.releaseTick = null;
  }
  p.targetId = target.id;
  p.activeUntil = w.tick + P.activeTicks;
}
export function companionDamageMultiplier(
  w: World,
  source: Unit,
  target: Unit,
  category: string,
  kind: 'physical' | 'magic' | 'true'
): number {
  const outgoing =
    target.kind === 'monster' &&
    kind !== 'true' &&
    !(SUMMONER_SMITE.monsterTags[target.monster.species] as readonly string[]).includes(
      'Monster_Epic'
    ) &&
    ownedCompanion(w, source.id) &&
    !['summoner', 'companion', 'cleanup'].includes(category)
      ? S.controllerValues.DamageAmp!
      : 1;
  const tags =
    source.kind === 'monster'
      ? (SUMMONER_SMITE.monsterTags[source.monster.species] as readonly string[])
      : [];
  const incoming =
    source.kind === 'monster' && ownedCompanion(w, target.id) && !tags.includes('Monster_Epic')
      ? S.controllerValues.MonsterDamageTaken!
      : 1;
  return outgoing * incoming;
}
export function companionKilledMonster(w: World, source: Unit, target: Unit): void {
  const p = ownedCompanion(w, source.id);
  if (!p || target.kind !== 'monster') return;
  const tags: readonly string[] = SUMMONER_SMITE.monsterTags[target.monster.species];
  if (!tags.includes('Monster_Large') && !tags.includes('Monster_Epic')) return;
  const owner = w.championState(source.id)!,
    wasStage = companionStage(p.fed),
    bonus = p.bonusTreats > 0;
  if (p.fed < S.fullGrowthFeeds) {
    p.fed = Math.min(S.fullGrowthFeeds, p.fed + 1 + (bonus ? 1 : 0));
    if (bonus) {
      p.bonusTreats--;
      owner.gold = statPrecision(owner.gold + S.controllerValues.TreatGold!);
    }
  }
  w.gainExperience(
    S.controllerValues.TreatXP! +
      (p.firstMonsterDone ? 0 : S.controllerValues.FirstMonsterBonusXP!),
    source.id
  );
  p.firstMonsterDone = true;
  const maxHeal = Math.min(
      S.killRecovery.BaseHealCap!,
      S.killRecovery.HealBase! + S.killRecovery.HealPerLevel! * owner.level
    ),
    heal = w.alive(source)
      ? Math.min(source.maxHp - source.hp, maxHeal * (1 - source.hp / source.maxHp))
      : 0;
  source.hp += heal;
  if (w.alive(source))
    source.mana = Math.min(
      source.maxMana,
      source.mana +
        (S.killRecovery.ManaBase! + S.killRecovery.ManaPerLevel! * owner.level) *
          (1 - source.mana / Math.max(1, source.maxMana)) *
          S.killRecovery.ManaMaxMult!
    );
  if (heal > 0)
    w.emit('heal', source, { value: Math.round(heal), unit: source.id, team: source.team });
  if (companionStage(p.fed) !== wasStage) {
    if (companionStage(p.fed) === 1) p.firstEvolvedTick = w.tick;
    if (companionStage(p.fed) === 2) p.fullGrownTick = w.tick;
    pose(p, 'transform', w.tick);
    p.nextTreatTick =
      w.tick +
      (companionStage(p.fed) > 0
        ? S.controllerValues.LongTreatTimer!
        : S.controllerValues.TreatTimer!) *
        60;
  } else pose(p, 'heal', w.tick);
  if (p.fed === S.fullGrowthFeeds) p.nextTreatTick = null;
  if (
    p.fed === S.fullGrowthFeeds &&
    p.acquisition.kind === 'purchase' &&
    p.acquisition.consumedTick === null
  ) {
    const slot = owner.inventory.indexOf(p.kind);
    if (slot < 0) throw new Error('Missing companion item at full growth.');
    owner.inventory[slot] = null;
    while (owner.inventory.length && owner.inventory.at(-1) === null) owner.inventory.pop();
    p.acquisition.consumedTick = w.tick;
  }
  companionPassiveMonsterKill(w, p, source);
}
export function companionSmitePose(w: World, u: Unit): void {
  const p = ownedCompanion(w, u.id);
  if (p && p.pose.action !== 'transform') pose(p, 'smite', w.tick);
}
export function advanceOwnedCompanions(w: World): void {
  for (const p of w.companions) {
    const owner = w.unit(p.ownerId);
    if (!owner || owner.kind !== 'champion') throw new Error('Missing companion owner');
    advanceCompanionPassive(w, p, owner);
    p.previous = { x: p.x, y: p.y };
    if (p.nextTreatTick !== null && w.tick >= p.nextTreatTick) {
      const interval =
        (companionStage(p.fed) > 0
          ? S.controllerValues.LongTreatTimer!
          : S.controllerValues.TreatTimer!) * 60;
      const earned = Math.floor((w.tick - p.nextTreatTick) / interval) + 1;
      p.bonusTreats = Math.min(P.maxBonusTreats, p.bonusTreats + earned);
      p.nextTreatTick += earned * interval;
    }
    if (!w.alive(owner)) {
      p.targetId = null;
      p.releaseTick = null;
      p.path = [];
      continue;
    }
    const clip = S.profiles[p.kind].clips[p.pose.action];
    if (
      !['idle', 'run'].includes(p.pose.action) &&
      w.tick >= p.pose.startTick + Math.ceil(clip.durationSeconds * 60)
    )
      pose(p, 'idle', w.tick);
    const target = p.targetId === null ? undefined : w.unit(p.targetId);
    const valid =
      target &&
      target.kind === 'monster' &&
      w.alive(target) &&
      w.vulnerable(target) &&
      target.monster.phase !== 'returning' &&
      w.visible(target, owner.team) &&
      distance(owner, target) <= P.targetRange &&
      p.activeUntil > w.tick;
    if (!valid) {
      p.targetId = null;
      p.releaseTick = null;
    } else if (p.releaseTick === null && p.nextStrikeTick <= w.tick && p.pose.action !== 'spawn') {
      p.releaseTick = w.tick + P.windupTicks;
      p.nextStrikeTick = w.tick + P.strikeTicks;
      if (['idle', 'run', 'attack'].includes(p.pose.action)) pose(p, 'attack', w.tick);
    }
    if (valid && p.releaseTick !== null && p.releaseTick <= w.tick) {
      p.releaseTick = null;
      const amount = (companionDps(w, owner) * P.strikeTicks) / 60,
        center = { x: target.x, y: target.y };
      const victims = w.units.filter(
        (u) =>
          u.kind === 'monster' &&
          w.alive(u) &&
          w.vulnerable(u) &&
          distance(u, center) <= P.cleaveRadius
      );
      for (const u of victims) w.damage(owner, u, amount, 'true', 'companion');
      const health = Math.min(
        owner.maxHp - owner.hp,
        (companionHps(w.championState(owner.id)!.level) * P.strikeTicks) / 60
      );
      owner.hp += health;
      if (health > 0)
        w.emit('heal', owner, { value: Math.round(health), unit: owner.id, team: owner.team });
    }
    const desired: Vec2 = valid
      ? { x: target.x - 70 * Math.sin(owner.facing), y: target.y - 70 * Math.cos(owner.facing) }
      : {
          x: owner.x - P.followDistance * Math.sin(owner.facing),
          y: owner.y - P.followDistance * Math.cos(owner.facing),
        };
    if (distance(p, owner) > P.snapDistance) {
      const point = w.battlefield.reachable(desired, P.navigationRadius, owner.team);
      Object.assign(p, point, { previous: { ...point } });
      p.path = [];
      p.nextPathTick = w.tick;
    }
    if (w.tick >= p.nextPathTick) {
      p.nextPathTick = w.tick + P.pathTicks;
      const goal = w.battlefield.reachable(desired, P.navigationRadius, owner.team);
      p.path = w.battlefield.findPath(p, goal, P.navigationRadius, owner.team);
    }
    const destination = p.path[0];
    if (destination) {
      const d = distance(p, destination),
        step = Math.min(d, P.followSpeed / 60);
      if (d > 0) {
        p.x += ((destination.x - p.x) * step) / d;
        p.y += ((destination.y - p.y) * step) / d;
        p.facing = Math.atan2(destination.x - p.previous.x, destination.y - p.previous.y);
      }
      if (d <= step + 0.001) p.path.shift();
    }
    if (['idle', 'run'].includes(p.pose.action)) {
      const moving = distance(p, p.previous) > 0.001,
        action = moving ? 'run' : 'idle';
      if (p.pose.action !== action) pose(p, action, w.tick);
    }
  }
}
