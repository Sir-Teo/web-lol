import { z } from 'zod';
import { ITEMS, TICK_RATE } from '../content/rules';
import { ASHE_CASTS } from '../content/ashe-casting';
import { LUX_ILLUMINATION } from '../content/lux-illumination';
import { LUX_R } from '../content/lux-r';
import { LUX_BINDING } from '../content/lux-binding';
import { ASHE_E } from '../content/ashe-e';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../content/hawkshot-linger-timing';
import { MAX_LEVEL } from './progression';
import type { Command, Order, PlayerState, Projectile, Unit } from './types';

declare const __SIMULATION_HASH__: string;
export const SNAPSHOT_RULESET = __SIMULATION_HASH__;
export const SNAPSHOT_VERSION = 39;
const nonnegative = z.number().nonnegative();
const tick = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const deadline = z.union([tick, z.literal('Infinity').transform(() => Infinity)]);
const team = z.enum(['blue', 'red']);
const point = z.strictObject({ x: z.number(), y: z.number() });
const kind = z.enum([
  'champion',
  'melee',
  'caster',
  'siege',
  'super',
  'turret',
  'inhibitor',
  'nexus',
  'dummy',
]);
const ability = z.enum(['q', 'w', 'e', 'r', 'd', 'f']);
const order: z.ZodType<Order> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('idle') }),
  z.strictObject({ type: z.enum(['move', 'attackMove']), point }),
  z.strictObject({ type: z.literal('attack'), target: id }),
]);
const unit: z.ZodType<Unit> = z
  .strictObject({
    id,
    kind,
    champion: z.enum(['ashe', 'lux']).optional(),
    team,
    name: z.string().max(200),
    x: z.number(),
    y: z.number(),
    previous: point,
    facing: z.number(),
    radius: nonnegative,
    hp: nonnegative,
    maxHp: z.number().positive(),
    mana: nonnegative,
    maxMana: nonnegative,
    damage: nonnegative,
    armor: z.number(),
    magicResist: z.number(),
    range: nonnegative,
    speed: nonnegative,
    attackPeriod: tick,
    windupTicks: tick,
    missileSpeed: nonnegative,
    goldBounty: nonnegative.optional(),
    experienceBounty: nonnegative.optional(),
    corpseLifetimeTicks: tick.optional(),
    order,
    path: z.array(point).max(10000),
    pathTarget: point.nullable(),
    pathDestination: point.nullable(),
    nextPathTick: deadline,
    lane: tick.nullable(),
    laneWaypoint: tick,
    attackTarget: id.nullable(),
    attackCycle: z
      .strictObject({ startTick: tick, endTick: tick, empowered: z.boolean() })
      .refine((cycle) => cycle.endTick > cycle.startTick, 'Invalid attack cycle')
      .nullable(),
    releaseTick: deadline.nullable(),
    nextAttackTick: deadline,
    slowUntil: deadline,
    slowMultiplier: z.number().min(0).max(1),
    criticalSlow: z
      .strictObject({
        startTick: z.number().int().nonnegative(),
        endTick: z.number().int().nonnegative(),
        startMultiplier: z.number().min(0).max(1),
        endMultiplier: z.number().min(0).max(1),
      })
      .refine(
        (effect) =>
          effect.endTick > effect.startTick && effect.startMultiplier <= effect.endMultiplier
      )
      .nullable(),
    stunUntil: deadline,
    rootUntil: deadline,
    illumination: z.array(z.strictObject({ sourceId: id, endTick: tick })).max(10000),
    summonerHealReductionUntil: tick,
    summonerHealSpeedUntil: deadline,
    deadAt: tick.nullable(),
    ai: z.boolean(),
    aiRetreating: z.boolean(),
    nextThink: deadline,
    respawnTick: deadline.nullable(),
    structureTransform: z.array(z.number()).length(16).optional(),
    structureKnowledge: z.strictObject({ blue: z.boolean(), red: z.boolean() }).optional(),
    structure: z
      .strictObject({
        role: z.enum([
          'outer-turret',
          'inner-turret',
          'inhibitor-turret',
          'nexus-turret',
          'inhibitor',
          'nexus',
        ]),
        lane: z.enum(['top', 'mid', 'bot']).nullable(),
        healthBarHeight: nonnegative,
        regenPerSecond: nonnegative,
      })
      .optional(),
  })
  .refine(
    (u) => (u.kind === 'champion') === (u.champion !== undefined),
    'Invalid champion identity'
  )
  .refine((u) => u.hp <= u.maxHp && u.mana <= u.maxMana, 'Invalid unit resources')
  .refine((u) => !u.attackCycle?.empowered || u.champion === 'ashe', 'Invalid empowered attacker');
const player: z.ZodType<PlayerState> = z
  .strictObject({
    id,
    gold: nonnegative,
    cs: tick,
    kills: tick,
    deaths: tick,
    xp: nonnegative,
    level: z.number().int().min(1).max(MAX_LEVEL),
    revealContributors: z.array(z.strictObject({ sourceId: id, lastRevealTick: tick })).max(10000),
    assists: tick,
    damageContributors: z.array(z.strictObject({ sourceId: id, lastDamageTick: tick })).max(10000),
    supportContributors: z
      .array(z.strictObject({ sourceId: id, lastSupportTick: tick }))
      .max(10000),
    skillPoints: z.number().int().min(0).max(18),
    spellRanks: z.strictObject({
      q: z.number().int().min(0).max(5),
      w: z.number().int().min(0).max(5),
      e: z.number().int().min(0).max(5),
      r: z.number().int().min(0).max(3),
    }),
    cooldowns: z.strictObject({
      q: deadline,
      w: deadline,
      e: deadline,
      r: deadline,
      d: deadline,
      f: deadline,
    }),
    qStacks: z.number().int().min(0).max(4),
    qUntil: deadline,
    qStackExpiry: deadline,
    eCharges: z.number().int().min(0).max(ASHE_E.maximumCharges),
    eRechargeTick: tick.nullable(),
    eRechargeDurationTicks: z
      .number()
      .refine((value) =>
        ASHE_E.rechargeSecondsByRank.some((seconds) => value === seconds * TICK_RATE)
      ),
    recallEnd: deadline.nullable(),
    castAnimation: z
      .strictObject({ ability: z.enum(['q', 'w', 'e', 'r']), startTick: tick })
      .nullable(),
    pendingCast: z
      .strictObject({
        ability: z.enum(['q', 'w', 'e', 'r']),
        origin: point.optional(),
        rank: z.number().int().min(1).max(5),
        startTick: tick,
        releaseTick: tick,
        point,
        damage: nonnegative,
      })
      .refine(
        (c) => (c.ability !== 'r' || c.rank <= 3) && c.releaseTick > c.startTick,
        'Invalid spell windup'
      )
      .nullable(),
    inventory: z
      .array(
        z
          .string()
          .refine((value) => ITEMS.some((item) => item.id === value))
          .nullable()
      )
      .max(6),
  })
  .refine(
    (p) =>
      p.spellRanks.e === 0
        ? p.eRechargeTick === null
        : (p.eCharges === ASHE_E.maximumCharges) === (p.eRechargeTick === null),
    'Invalid Hawkshot recharge state'
  )
  .refine(
    (p) => p.spellRanks.e > 0 || p.eRechargeTick === null,
    'Unlearned Hawkshot cannot recharge'
  )
  .refine(
    (p) => p.spellRanks.q > 0 || (p.qUntil === 0 && p.qStacks === 0),
    'Unlearned Focus cannot be active'
  );
const projectile: z.ZodType<Projectile> = z
  .strictObject({
    id,
    source: id,
    team,
    type: z.enum(['attack', 'volley', 'ultimate', 'hawkshot', 'binding']),
    bindingHits: z.array(id).max(1).optional(),
    x: z.number(),
    y: z.number(),
    previous: point,
    direction: point,
    target: id.nullable(),
    damage: nonnegative,
    speed: nonnegative,
    radius: nonnegative,
    remaining: nonnegative,
    volleyId: id.nullable(),
    empowered: z.boolean().optional(),
    flurryShot: z.number().int().min(0).max(4).optional(),
    launchTick: tick.optional(),
    origin: point.optional(),
  })
  .refine(
    (p) =>
      p.type === 'binding'
        ? p.bindingHits !== undefined && p.target === null && p.volleyId === null
        : p.bindingHits === undefined,
    'Invalid binding hit history'
  )
  .refine(
    (p) => p.type !== 'hawkshot' || (p.launchTick !== undefined && p.origin !== undefined),
    'Hawkshot lacks launch state'
  )
  .refine(
    (p) => p.empowered === undefined || p.type === 'attack',
    'Only attacks may carry empowerment'
  )
  .refine(
    (p) =>
      p.flurryShot === undefined ||
      (p.type === 'attack' && p.empowered === true && p.launchTick !== undefined),
    'Invalid flurry arrow'
  );
const command: z.ZodType<Command> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('order'), unit: id, order }),
  z.strictObject({ type: z.literal('cast'), unit: id, ability, point }),
  z.strictObject({ type: z.literal('recall'), unit: id }),
  z.strictObject({ type: z.literal('learn'), unit: id, ability: z.enum(['q', 'w', 'e', 'r']) }),
]);
const snapshot = z.strictObject({
  version: z.literal(SNAPSHOT_VERSION),
  ruleset: z.literal(SNAPSHOT_RULESET),
  battlefield: z.enum(['rift', 'practice-fixture']),
  winner: team.nullable(),
  firstBloodClaimed: z.boolean(),
  tick,
  nextId: id,
  units: z.array(unit).min(1).max(10000),
  player,
  otherChampions: z.array(player).max(10000),
  projectiles: z.array(projectile).max(10000),
  luxBeams: z
    .array(z.strictObject({ id, sourceId: id, team, origin: point, point, startTick: tick }))
    .max(10000),
  pendingAttackProjectiles: z.array(projectile).max(10000),
  randomState: z.number().int().min(0).max(0xffffffff),
  wave: tick,
  nextWaveTick: deadline,
  pendingSpawns: z.array(z.strictObject({ tick, kind, team, lane: tick, offset: tick })).max(10000),
  reveal: z.strictObject({ point, endTick: deadline }).nullable(),
  visionAreas: z
    .array(
      z.strictObject({
        kind: z.enum(['attack', 'scout']),
        sourceId: id.optional(),
        flight: z
          .strictObject({
            id,
            origin: point,
            direction: point,
            speed: z.number().positive(),
            launchTick: tick,
            arrivalTick: tick,
            distance: nonnegative,
          })
          .refine((f) => f.arrivalTick >= f.launchTick, 'Scout arrival precedes launch')
          .optional(),
        x: z.number(),
        y: z.number(),
        radius: nonnegative,
        unobstructed: z.boolean().optional(),
        team,
        endTick: deadline,
      })
    )
    .max(10000),
  scoutVisuals: z
    .array(
      z.strictObject({
        x: z.number(),
        y: z.number(),
        team,
        flight: z.strictObject({
          id,
          origin: point,
          direction: point,
          speed: z.number().positive(),
          launchTick: tick,
          arrivalTick: tick,
          distance: nonnegative,
        }),
        stopTick: tick,
        endTick: tick,
      })
    )
    .max(10000),
  volleyHits: z.record(z.string().regex(/^\d+$/), z.array(id).max(10000)),
  commands: z.array(command).max(10000),
});
export function decodeSnapshot(text: string) {
  if (text.length > 16 * 1024 * 1024) throw new Error('Saved match is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Saved match could not be read.');
  }
  const result = snapshot.safeParse(parsed);
  if (!result.success)
    throw new Error('Saved match is invalid or belongs to a different game version.', {
      cause: result.error,
    });
  const state = result.data;
  const visualIds = new Set<number>();
  for (const effect of state.scoutVisuals) {
    const f = effect.flight;
    if (
      visualIds.has(f.id) ||
      f.id >= state.nextId ||
      f.launchTick > f.arrivalTick ||
      f.arrivalTick > state.tick ||
      effect.endTick <= state.tick ||
      effect.stopTick !== f.arrivalTick + ASHE_E.visionSeconds * TICK_RATE ||
      effect.endTick !== effect.stopTick + Math.ceil(HAWKSHOT_PRESENTATION_TAIL_SECONDS * TICK_RATE)
    )
      throw new Error('Saved match contains an invalid scout visual lifetime.');
    visualIds.add(f.id);
  }
  const ids = [
    ...state.units,
    ...state.projectiles,
    ...state.pendingAttackProjectiles,
    ...state.luxBeams,
  ].map((u) => u.id);
  for (const p of state.pendingAttackProjectiles) {
    if (
      p.type !== 'attack' ||
      !p.empowered ||
      p.flurryShot === undefined ||
      p.flurryShot < 1 ||
      p.target === null ||
      !state.units.some((unit) => unit.id === p.target && unit.team !== p.team) ||
      p.launchTick === undefined ||
      p.launchTick <= state.tick
    )
      throw new Error('Saved match contains an invalid pending flurry.');
  }
  for (const projectile of [...state.projectiles, ...state.pendingAttackProjectiles]) {
    if (
      projectile.type === 'binding' &&
      (!state.units.some(
        (u) => u.id === projectile.source && u.kind === 'champion' && u.team === projectile.team
      ) ||
        projectile.bindingHits!.some(
          (hit) =>
            hit >= state.nextId ||
            [...state.projectiles, ...state.pendingAttackProjectiles, ...state.luxBeams].some(
              (p) => p.id === hit
            ) ||
            hit === projectile.source ||
            state.units.some(
              (u) =>
                u.id === hit &&
                (u.team === projectile.team || ['turret', 'nexus', 'inhibitor'].includes(u.kind))
            )
        ))
    )
      throw new Error('Saved binding contains invalid participants.');
    if (
      projectile.empowered &&
      state.units.find((unit) => unit.id === projectile.source)?.champion !== 'ashe'
    )
      throw new Error('Saved empowered attack lacks an Ashe champion source.');
  }
  if (new Set(ids).size !== ids.length || ids.some((value) => value >= state.nextId))
    throw new Error('Saved match contains invalid entity identities.');
  for (const beam of state.luxBeams) {
    if (
      !state.units.some(
        (u) => u.id === beam.sourceId && u.champion === 'lux' && u.team === beam.team
      ) ||
      beam.startTick > state.tick ||
      state.tick >= beam.startTick + LUX_R.presentationSeconds * TICK_RATE ||
      Math.abs(
        Math.hypot(beam.point.x - beam.origin.x, beam.point.y - beam.origin.y) - LUX_R.range
      ) > 1e-6
    )
      throw new Error('Saved match contains an invalid Lux beam.');
  }
  const hero = state.units.find((u) => u.id === state.player.id);
  if (!hero || hero.kind !== 'champion' || hero.team !== 'blue')
    throw new Error('Saved match is missing its player.');
  for (const target of state.units) {
    const sources = new Set<number>();
    for (const mark of target.illumination) {
      const source = state.units.find((unit) => unit.id === mark.sourceId);
      if (
        !source ||
        source.champion !== 'lux' ||
        source.team === target.team ||
        target.deadAt !== null ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind) ||
        sources.has(mark.sourceId) ||
        mark.endTick <= state.tick ||
        mark.endTick > state.tick + LUX_ILLUMINATION.durationSeconds * TICK_RATE
      )
        throw new Error('Saved match contains invalid Illumination marks.');
      sources.add(mark.sourceId);
    }
  }
  const owners = [state.player, ...state.otherChampions];
  const ownerIds = new Set(owners.map((p) => p.id));
  if (state.battlefield === 'rift') {
    for (const owner of owners) {
      if (
        owner.skillPoints + Object.values(owner.spellRanks).reduce((sum, rank) => sum + rank, 0) !==
        owner.level
      )
        throw new Error('Saved match contains an invalid skill-point budget.');
      for (const ability of ['q', 'w', 'e', 'r'] as const) {
        const rank = owner.spellRanks[ability];
        const minimum = ability === 'r' ? 6 + (rank - 1) * 5 : 1 + (rank - 1) * 2;
        if (rank > 0 && owner.level < minimum)
          throw new Error('Saved match contains a rank unavailable at its champion level.');
      }
      if (owner.spellRanks.e === 0 && owner.eCharges !== 0)
        throw new Error('Saved match grants charges to unlearned Hawkshot.');
    }
  }
  const champions = state.units.filter((u) => u.kind === 'champion');
  if (
    ownerIds.size !== owners.length ||
    owners.length !== champions.length ||
    champions.some((u) => !ownerIds.has(u.id))
  )
    throw new Error('Saved match contains invalid champion ownership.');
  for (const owner of owners) {
    const champion = champions.find((u) => u.id === owner.id)!;
    const contributors = new Set<number>();
    let previousDamageTick = -1;
    for (const contribution of owner.damageContributors) {
      const source = champions.find((u) => u.id === contribution.sourceId);
      if (
        !source ||
        source.team === champion.team ||
        contributors.has(source.id) ||
        contribution.lastDamageTick < previousDamageTick ||
        contribution.lastDamageTick > state.tick ||
        (champion.deadAt !== null && contribution.lastDamageTick > champion.deadAt)
      )
        throw new Error('Saved match contains invalid damage contributions.');
      contributors.add(source.id);
      previousDamageTick = contribution.lastDamageTick;
    }
    const revealers = new Set<number>();
    const supporters = new Set<number>();
    for (const entry of owner.supportContributors) {
      const source = champions.find((u) => u.id === entry.sourceId);
      if (
        !source ||
        source.id === champion.id ||
        source.team !== champion.team ||
        supporters.has(source.id) ||
        entry.lastSupportTick > state.tick ||
        (champion.deadAt !== null && entry.lastSupportTick > champion.deadAt)
      )
        throw new Error('Saved match contains invalid support contributions.');
      supporters.add(source.id);
    }
    for (const entry of owner.revealContributors) {
      const source = champions.find((u) => u.id === entry.sourceId);
      if (
        !source ||
        source.team === champion.team ||
        revealers.has(source.id) ||
        entry.lastRevealTick > state.tick ||
        (champion.deadAt !== null && entry.lastRevealTick > champion.deadAt)
      )
        throw new Error('Saved match contains invalid reveal contributions.');
      revealers.add(source.id);
    }
    if (
      champion.champion === 'lux' &&
      (owner.spellRanks.w !== 0 ||
        owner.spellRanks.e !== 0 ||
        owner.qStacks !== 0 ||
        owner.qUntil !== 0 ||
        owner.qStackExpiry !== 0 ||
        owner.eCharges !== 0)
    )
      throw new Error('Saved match contains unavailable Lux spell state.');
    const compatibleCast = (ability: string) =>
      champion.champion === 'lux' ? ability === 'q' || ability === 'r' : ability !== 'q';
    const cast = owner.pendingCast;
    if (cast) {
      const luxR = champion.champion === 'lux' && cast.ability === 'r';
      const seconds = luxR
        ? LUX_R.castSeconds
        : cast.ability === 'q'
          ? LUX_BINDING.castSeconds
          : ASHE_CASTS[cast.ability].castSeconds;
      if (
        cast.releaseTick !== cast.startTick + seconds * TICK_RATE ||
        luxR !== (cast.origin !== undefined) ||
        (cast.origin &&
          Math.abs(
            Math.hypot(cast.point.x - cast.origin.x, cast.point.y - cast.origin.y) - LUX_R.range
          ) > 1e-6)
      )
        throw new Error('Saved match contains invalid champion cast geometry or timing.');
    }
    if (
      cast &&
      (!compatibleCast(cast.ability) ||
        cast.rank > owner.spellRanks[cast.ability] ||
        cast.startTick > state.tick ||
        cast.releaseTick <= state.tick ||
        champion.deadAt !== null ||
        state.winner !== null ||
        owner.recallEnd !== null)
    )
      throw new Error('Saved match contains an invalid pending cast.');
    const animation = owner.castAnimation;
    if (
      (animation &&
        (!compatibleCast(animation.ability) ||
          animation.startTick > state.tick ||
          champion.deadAt !== null ||
          state.winner !== null ||
          owner.recallEnd !== null)) ||
      (cast &&
        (!animation ||
          animation.ability !== cast.ability ||
          animation.startTick !== cast.startTick))
    )
      throw new Error('Saved match contains an invalid cast animation.');
  }
  for (const area of state.visionAreas) {
    if (area.sourceId === undefined) continue;
    const source = champions.find((u) => u.id === area.sourceId);
    if (area.kind !== 'scout' || !source || source.team !== area.team)
      throw new Error('Saved match contains invalid scout ownership.');
  }
  return state;
}

/** Infinity is an explicit disabled deadline, never JSON's ambiguous null. */
export function encodeSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) {
      if (item === Infinity) return 'Infinity';
      throw new Error('Cannot save invalid numeric state.');
    }
    if (item && typeof item === 'object' && !Array.isArray(item))
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      );
    return item;
  });
}
