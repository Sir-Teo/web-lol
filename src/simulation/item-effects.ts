import { isMeleeChampion } from '../content/champion-profiles';
import {
  EXPANDED_ITEMS,
  ITEM_EFFECT_TIMING,
  type ExpandedItemEntry,
  type ItemUniqueGroup,
} from '../content/expanded-items';
import { ITEMS, TICK_RATE } from '../content/rules';
import { distance, type Vec2 } from './math';
import { statPrecision } from './progression';
import { runeItemHaste } from './runes';
import type { ChampionState, Unit } from './types';
import { requestControlWard } from './wards';
import type { World } from './world';

export interface ShopUndoEntry {
  kind: 'buy' | 'sell';
  goldBefore: number;
  inventoryBefore: (string | null)[];
  stackCountsBefore: Record<number, number>;
  armorBefore: number;
  magicResistBefore: number;
  damageBefore: number;
  maxHpBefore: number;
  hpBefore: number;
  maxManaBefore: number;
  manaBefore: number;
  speedBefore: number;
  companionAddedOwnerId: number | null;
}

export interface ChampionItemRuntimeState {
  /** Stack counts for stackable consumables indexed by inventory slot (default 1 when omitted). */
  slotStacks: Record<number, number>;
  /** Per-item-id active cooldown expiration ticks. */
  activeCooldowns: Record<string, number>;
  potionEndTick: number;
  spellbladeUntilTick: number;
  spellbladeReadyTick: number;
  spellbladeTier: 'sheen' | 'triforce' | null;
  krakenStacks: number;
  ludensReadyTick: number;
  lifelineReadyTick: number;
  youmuusUntilTick: number;
  stasisUntilTick: number;
  undoHistory: ShopUndoEntry[];
}

export function ensureItemState(state: ChampionState): ChampionItemRuntimeState {
  state.itemState ??= {
    slotStacks: {},
    activeCooldowns: {},
    potionEndTick: 0,
    spellbladeUntilTick: 0,
    spellbladeReadyTick: 0,
    spellbladeTier: null,
    krakenStacks: 0,
    ludensReadyTick: 0,
    lifelineReadyTick: 0,
    youmuusUntilTick: 0,
    stasisUntilTick: 0,
    undoHistory: [],
  };
  return state.itemState;
}

export function clearShopUndoOnCombatOrLeaveFountain(
  w: World,
  u: Unit,
  state: ChampionState
): void {
  if (!state.itemState?.undoHistory.length) return;
  if (u.team === 'neutral' || distance(u, w.battlefield.spawns[u.team]) > 420) {
    state.itemState.undoHistory = [];
  }
}

export function invalidateShopUndo(state: ChampionState | undefined): void {
  if (state?.itemState?.undoHistory.length) state.itemState.undoHistory = [];
}

const EXPANDED_BY_ID: ReadonlyMap<string, ExpandedItemEntry> = new Map(
  (EXPANDED_ITEMS as readonly ExpandedItemEntry[]).map((e) => [e.id, e])
);

export function getExpandedItem(itemId: string | null | undefined): ExpandedItemEntry | undefined {
  return itemId ? EXPANDED_BY_ID.get(itemId) : undefined;
}

export function itemUniqueGroup(itemId: string): ItemUniqueGroup | null {
  if (itemId === 'boots') return 'boots';
  if (itemId === 'blade') return 'dorans';
  const expanded = EXPANDED_BY_ID.get(itemId);
  return expanded?.uniqueGroup ?? null;
}

export function checkUniqueGroupConflict(
  inventory: readonly (string | null)[],
  consumedSlots: readonly number[],
  itemId: string
): string | null {
  const group = itemUniqueGroup(itemId);
  if (!group) return null;
  for (let i = 0; i < inventory.length; i++) {
    if (consumedSlots.includes(i)) continue;
    const owned = inventory[i];
    if (!owned) continue;
    if (itemUniqueGroup(owned) === group) {
      if (group === 'boots') return 'You already own boots';
      if (group === 'dorans') return 'You already own a Doran item';
      return `You already own a ${group} item`;
    }
  }
  return null;
}

export function findStackableSlot(
  state: ChampionState,
  itemId: string
): { slot: number; maxStack: number } | null {
  const expanded = EXPANDED_BY_ID.get(itemId);
  if (!expanded?.maxStack || expanded.maxStack <= 1) return null;
  const idx = state.inventory.findIndex((id) => id === itemId);
  if (idx < 0) return null;
  const current = state.itemState?.slotStacks[idx] ?? 1;
  if (current >= expanded.maxStack) return { slot: -1, maxStack: expanded.maxStack };
  return { slot: idx, maxStack: expanded.maxStack };
}

export function itemBonusAttackSpeed(state: ChampionState): number {
  let bonus = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.attackSpeed) bonus += item.attackSpeed;
  }
  return bonus;
}

export function itemLifesteal(state: ChampionState): number {
  let ls = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.lifesteal) ls += item.lifesteal;
  }
  return ls;
}

export function itemLethality(state: ChampionState): number {
  let leth = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.lethality) leth += item.lethality;
  }
  return leth;
}

export function itemArmorPenPercent(state: ChampionState): number {
  let maxPen = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.armorPenPercent) maxPen = Math.max(maxPen, item.armorPenPercent);
  }
  return maxPen;
}

export function itemMagicPen(state: ChampionState): { flat: number; percent: number } {
  let flat = 0,
    percent = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.magicPenFlat) flat += item.magicPenFlat;
    if (item?.magicPenPercent) percent = Math.max(percent, item.magicPenPercent);
  }
  return { flat, percent };
}

export function itemTenacity(state: ChampionState): number {
  let maxTen = 0;
  for (const id of state.inventory) {
    if (!id) continue;
    const item = EXPANDED_BY_ID.get(id);
    if (item?.tenacity) maxTen = Math.max(maxTen, item.tenacity);
  }
  return maxTen;
}

export function primeSpellbladeOnCast(w: World, state: ChampionState): void {
  const hasTri = state.inventory.includes('triforce');
  const hasSheen = state.inventory.includes('sheen');
  if (!hasTri && !hasSheen) return;
  const is = ensureItemState(state);
  if (w.tick < is.spellbladeReadyTick) return;
  is.spellbladeUntilTick = w.tick + ITEM_EFFECT_TIMING.spellbladeWindowTicks;
  is.spellbladeTier = hasTri ? 'triforce' : 'sheen';
}

export function consumeItemOnHitDamage(
  w: World,
  attacker: Unit,
  state: ChampionState,
  target: Unit,
  baseAd: number
): number {
  let bonusPhysical = 0;
  const isStructure =
    target.kind === 'turret' || target.kind === 'inhibitor' || target.kind === 'nexus';

  // Recurve Bow Sting (+15 on-hit vs non-structures)
  if (!isStructure && state.inventory.includes('recurve-bow')) {
    bonusPhysical += 15;
  }

  // Blade of the Ruined King Mist's Edge
  if (!isStructure && state.inventory.includes('bork')) {
    const frac = isMeleeChampion(attacker.champion) ? 0.09 : 0.06;
    const raw = target.hp * frac;
    bonusPhysical += target.kind === 'monster' ? Math.min(100, raw) : raw;
  }

  // Kraken Slayer Bring It Down (every 3rd attack)
  if (!isStructure && state.inventory.includes('kraken')) {
    const is = ensureItemState(state);
    is.krakenStacks = (is.krakenStacks + 1) % 3;
    if (is.krakenStacks === 0) {
      const levelFrac = Math.max(0, Math.min(1, (state.level - 1) / 17));
      bonusPhysical += 140 + levelFrac * 100;
    }
  }

  // Spellblade (works against champions, monsters, minions, AND turrets!)
  const is = state.itemState;
  if (is && is.spellbladeUntilTick > w.tick && is.spellbladeTier) {
    const mult = is.spellbladeTier === 'triforce' ? 2.0 : 1.0;
    bonusPhysical += baseAd * mult;
    is.spellbladeUntilTick = 0;
    is.spellbladeTier = null;
    is.spellbladeReadyTick = w.tick + ITEM_EFFECT_TIMING.spellbladeCooldownTicks;
  }

  return bonusPhysical;
}

export function onItemPostDamageEffects(
  w: World,
  source: Unit,
  target: Unit,
  dealt: number,
  damageType: 'physical' | 'magic' | 'true',
  isBasicAttack: boolean,
  isAbility: boolean
): void {
  if (dealt <= 0) return;
  const sourceState = w.championState(source.id);
  const targetState = w.championState(target.id);
  const isStructure =
    target.kind === 'turret' || target.kind === 'inhibitor' || target.kind === 'nexus';

  if (sourceState && source.team !== target.team && !isStructure) {
    // Black Cleaver Carve (up to 5 stacks = 30% armor reduction)
    if (damageType === 'physical' && sourceState.inventory.includes('black-cleaver')) {
      const stacks = Math.min(5, (target.cleaverStacks ?? 0) + 1);
      target.cleaverStacks = stacks;
      target.cleaverUntilTick = w.tick + ITEM_EFFECT_TIMING.cleaverDurationTicks;
    }

    // Luden's Companion Fire
    if (isAbility && sourceState.inventory.includes('ludens')) {
      const is = ensureItemState(sourceState);
      if (w.tick >= is.ludensReadyTick) {
        is.ludensReadyTick = w.tick + ITEM_EFFECT_TIMING.ludensCooldownTicks;
        const burst = 75 + 0.08 * w.abilityPower(source);
        w.damage(source, target, burst, 'magic', 'item');
      }
    }

    // Liandry's Torment burn (2% max HP/s for 3s)
    if (isAbility && sourceState.inventory.includes('liandrys')) {
      target.liandryBurn = {
        sourceId: source.id,
        endTick: w.tick + ITEM_EFFECT_TIMING.liandrysBurnTicks,
        nextTick: w.tick + TICK_RATE,
      };
    }

    // Lifesteal on basic attacks
    if (isBasicAttack && w.alive(source)) {
      const ls = itemLifesteal(sourceState);
      if (ls > 0) {
        const healAmt = dealt * ls;
        const missing = Math.max(0, source.maxHp - source.hp);
        w.healUnit(source, healAmt);
        const excess = healAmt - missing;
        if (excess > 0 && sourceState.inventory.includes('bloodthirster')) {
          const cap = 165 + ((sourceState.level - 1) / 17) * 150;
          source.shields.push({
            sourceId: source.id,
            amount: Math.min(cap, excess),
            endTick: w.tick + 12 * TICK_RATE,
          });
        }
      }
    }
  }

  // Thornmail reflection + Grievous Wounds
  if (
    isBasicAttack &&
    targetState?.inventory.includes('thornmail') &&
    source.kind === 'champion' &&
    source.team !== target.team
  ) {
    source.grievousWoundsUntil = w.tick + ITEM_EFFECT_TIMING.grievousWoundsTicks;
    const reflect = 20 + Math.max(0, target.armor - 30) * 0.1;
    w.damage(target, source, reflect, 'magic', 'item');
  }

  // Sterak's Gage Lifeline
  if (
    targetState?.inventory.includes('steraks') &&
    w.alive(target) &&
    target.hp / target.maxHp <= 0.3
  ) {
    const is = ensureItemState(targetState);
    if (w.tick >= is.lifelineReadyTick) {
      is.lifelineReadyTick = w.tick + ITEM_EFFECT_TIMING.lifelineCooldownTicks;
      const bonusHp = Math.max(250, target.maxHp - 700);
      target.shields.push({
        sourceId: target.id,
        amount: Math.round(bonusHp * 0.75),
        endTick: w.tick + ITEM_EFFECT_TIMING.lifelineShieldTicks,
      });
      w.emit('message', target, { text: 'Lifeline shield!', unit: target.id, team: target.team });
    }
  }
}

export function advanceItemRuntime(w: World): void {
  for (const u of w.units) {
    if (u.cleaverUntilTick && u.cleaverUntilTick <= w.tick) {
      u.cleaverStacks = 0;
      u.cleaverUntilTick = 0;
    }
    if (u.liandryBurn) {
      if (!w.alive(u) || w.winner || u.liandryBurn.endTick < w.tick) {
        u.liandryBurn = undefined;
      } else if (w.tick >= u.liandryBurn.nextTick) {
        u.liandryBurn.nextTick += TICK_RATE;
        const owner = w.unit(u.liandryBurn.sourceId);
        if (owner) {
          const cap = u.kind === 'monster' ? 75 : Infinity;
          w.damage(owner, u, Math.min(cap, u.maxHp * 0.02), 'magic', 'item');
        }
      }
    }

    if (u.kind !== 'champion') continue;
    const state = w.championState(u.id);
    if (!state) continue;
    clearShopUndoOnCombatOrLeaveFountain(w, u, state);

    // Doran's Ring passive mana regen (every second)
    if (w.alive(u) && w.tick % TICK_RATE === 0 && state.inventory.includes('dorans-ring')) {
      u.mana = Math.min(u.maxMana, statPrecision(u.mana + 1.25));
    }

    // Health Potion active regen (8 HP/s for 15s = 120 HP)
    if (
      w.alive(u) &&
      state.itemState &&
      state.itemState.potionEndTick > w.tick &&
      w.tick % 15 === 0
    ) {
      w.healUnit(u, 2);
    }

    // Immolate (Bami's Cinder / Sunfire Aegis) every second
    if (
      w.alive(u) &&
      w.tick > 0 &&
      w.tick % TICK_RATE === 0 &&
      (state.inventory.includes('sunfire') || state.inventory.includes('bamis'))
    ) {
      const sunfire = state.inventory.includes('sunfire');
      const bonusHp = Math.max(0, u.maxHp - 650);
      const dps = sunfire ? 20 + bonusHp * 0.0175 : 13 + bonusHp * 0.01;
      for (const foe of w.units) {
        if (
          foe.team !== u.team &&
          foe.kind !== 'ward' &&
          w.targetable(foe) &&
          !(foe.kind === 'turret' || foe.kind === 'inhibitor' || foe.kind === 'nexus') &&
          (foe.kind !== 'monster' || foe.monster.phase === 'engaged') &&
          distance(u, foe) <= 325 + foe.radius
        ) {
          w.damage(u, foe, dps, 'magic', 'item');
        }
      }
    }
  }
}

export function useItemSlot(
  w: World,
  slot: number,
  point?: Vec2,
  championId = w.player.id
): string | null {
  if (w.winner) return 'The game has ended';
  const state = w.championState(championId);
  const u = w.unit(championId);
  if (!state || !u || u.kind !== 'champion') return 'Unknown champion';
  if (!w.alive(u)) return 'Cannot use items while dead';
  if ((state.itemState?.stasisUntilTick ?? 0) > w.tick) return 'Cannot act during Stasis';
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.inventory.length)
    return 'Empty item slot';
  const itemId = state.inventory[slot];
  if (!itemId) return 'Empty item slot';
  const item = EXPANDED_BY_ID.get(itemId);
  if (!item?.active)
    return `${ITEMS.find((e) => e.id === itemId)?.name ?? 'Item'} has no active effect`;

  const is = ensureItemState(state);
  const readyTick = is.activeCooldowns[itemId] ?? 0;
  if (w.tick < readyTick) return `${item.name} is cooling down`;

  const itemHaste = runeItemHaste(state);
  const cdTicks = Math.ceil((item.active.cooldownSeconds * TICK_RATE * 100) / (100 + itemHaste));

  if (item.active.kind === 'potion') {
    if (u.hp >= u.maxHp) return 'Already at full health';
    consumeInventoryCharge(state, slot);
    is.potionEndTick = Math.max(w.tick, is.potionEndTick) + ITEM_EFFECT_TIMING.potionDurationTicks;
    is.activeCooldowns[itemId] = w.tick + cdTicks;
    invalidateShopUndo(state);
    return null;
  }

  if (item.active.kind === 'control-ward') {
    const targetPoint = point ?? { x: u.x, y: u.y };
    const err = requestControlWard(w, u, targetPoint);
    if (err) return err;
    consumeInventoryCharge(state, slot);
    is.activeCooldowns[itemId] = w.tick + cdTicks;
    invalidateShopUndo(state);
    return null;
  }

  if (item.active.kind === 'zhonyas') {
    w.setOrder(u, { type: 'idle' });
    is.stasisUntilTick = w.tick + ITEM_EFFECT_TIMING.zhonyasStasisTicks;
    is.activeCooldowns[itemId] = w.tick + cdTicks;
    invalidateShopUndo(state);
    w.emit('message', u, { text: 'Stasis!', unit: u.id, team: u.team });
    return null;
  }

  if (item.active.kind === 'youmuus') {
    is.youmuusUntilTick = w.tick + ITEM_EFFECT_TIMING.youmuusActiveTicks;
    is.activeCooldowns[itemId] = w.tick + cdTicks;
    invalidateShopUndo(state);
    w.emit('message', u, { text: 'Wraith Step!', unit: u.id, team: u.team });
    return null;
  }

  if (item.active.kind === 'locket') {
    const levelFrac = Math.max(0, Math.min(1, (state.level - 1) / 17));
    const shieldAmt = Math.round(200 + levelFrac * 160);
    for (const ally of w.units) {
      if (
        ally.kind === 'champion' &&
        ally.team === u.team &&
        w.alive(ally) &&
        distance(u, ally) <= ITEM_EFFECT_TIMING.locketShieldRadius
      ) {
        ally.shields.push({
          sourceId: u.id,
          amount: shieldAmt,
          endTick: w.tick + ITEM_EFFECT_TIMING.locketShieldDurationTicks,
        });
      }
    }
    is.activeCooldowns[itemId] = w.tick + cdTicks;
    invalidateShopUndo(state);
    w.emit('message', u, { text: 'Devotion Shield!', unit: u.id, team: u.team });
    return null;
  }

  return null;
}

export function consumeInventoryCharge(state: ChampionState, slot: number): void {
  const is = state.itemState;
  const current = is?.slotStacks[slot] ?? 1;
  if (current > 1 && is) {
    is.slotStacks[slot] = current - 1;
    return;
  }
  if (is) delete is.slotStacks[slot];
  state.inventory[slot] = null;
  while (state.inventory.length && state.inventory.at(-1) === null) state.inventory.pop();
}

export function recordShopUndo(
  _w: World,
  state: ChampionState,
  u: Unit,
  kind: 'buy' | 'sell',
  companionAddedOwnerId: number | null = null
): void {
  const is = ensureItemState(state);
  is.undoHistory.push({
    kind,
    goldBefore: state.gold,
    inventoryBefore: [...state.inventory],
    stackCountsBefore: { ...is.slotStacks },
    armorBefore: u.armor,
    magicResistBefore: u.magicResist,
    damageBefore: u.damage,
    maxHpBefore: u.maxHp,
    hpBefore: u.hp,
    maxManaBefore: u.maxMana,
    manaBefore: u.mana,
    speedBefore: u.speed,
    companionAddedOwnerId,
  });
  if (is.undoHistory.length > 8) is.undoHistory.shift();
}

export function undoShopAction(w: World, championId = w.player.id): string | null {
  if (w.winner) return 'The game has ended';
  const state = w.championState(championId);
  const u = w.unit(championId);
  if (!state || !u || u.kind !== 'champion') return 'Unknown champion';
  if (distance(u, w.battlefield.spawns[u.team]) > 420 && w.alive(u))
    return 'Return to your fountain to undo shop actions';
  const is = state.itemState;
  const entry = is?.undoHistory.pop();
  if (!entry || !is) return 'Nothing to undo';

  state.gold = entry.goldBefore;
  state.inventory = [...entry.inventoryBefore];
  is.slotStacks = { ...entry.stackCountsBefore };
  u.armor = entry.armorBefore;
  u.magicResist = entry.magicResistBefore;
  u.damage = entry.damageBefore;
  u.maxHp = entry.maxHpBefore;
  if (w.alive(u)) u.hp = Math.min(u.maxHp, entry.hpBefore);
  u.maxMana = entry.maxManaBefore;
  if (w.alive(u)) u.mana = Math.min(u.maxMana, entry.manaBefore);
  u.speed = entry.speedBefore;
  if (entry.companionAddedOwnerId !== null) {
    w.companions = w.companions.filter((c) => c.ownerId !== entry.companionAddedOwnerId);
  }
  return null;
}
