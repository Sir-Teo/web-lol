import { z } from 'zod';
import { ITEMS, TICK_RATE } from '../content/rules';
import { ASHE_CASTS } from '../content/ashe-casting';
import { ASHE_E } from '../content/ashe-e';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../content/hawkshot-linger-timing';
import { MAX_LEVEL } from './progression';
import type { Command, Order, PlayerState, Projectile, Unit } from './types';

declare const __SIMULATION_HASH__: string;
export const SNAPSHOT_RULESET = __SIMULATION_HASH__;
export const SNAPSHOT_VERSION = 23;
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
  .refine((u) => u.hp <= u.maxHp && u.mana <= u.maxMana, 'Invalid unit resources')
  .refine((u) => !u.attackCycle?.empowered || u.kind === 'champion', 'Invalid empowered attacker');
const player: z.ZodType<PlayerState> = z
  .strictObject({
    id,
    gold: nonnegative,
    cs: tick,
    kills: tick,
    deaths: tick,
    xp: nonnegative,
    level: z.number().int().min(1).max(MAX_LEVEL),
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
    recallEnd: deadline.nullable(),
    castAnimation: z.strictObject({ ability: z.enum(['w', 'e', 'r']), startTick: tick }).nullable(),
    pendingCast: z
      .strictObject({
        ability: z.enum(['w', 'e', 'r']),
        startTick: tick,
        releaseTick: tick,
        point,
        damage: nonnegative,
      })
      .refine(
        (c) => c.releaseTick === c.startTick + ASHE_CASTS[c.ability].castSeconds * TICK_RATE,
        'Invalid spell windup'
      )
      .nullable(),
    inventory: z
      .array(z.string().refine((value) => ITEMS.some((item) => item.id === value)))
      .max(6),
  })
  .refine(
    (p) => (p.eCharges === ASHE_E.maximumCharges) === (p.eRechargeTick === null),
    'Invalid Hawkshot recharge state'
  );
const projectile: z.ZodType<Projectile> = z
  .strictObject({
    id,
    source: id,
    team,
    type: z.enum(['attack', 'volley', 'ultimate', 'hawkshot']),
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
    launchTick: tick.optional(),
    origin: point.optional(),
  })
  .refine(
    (p) => p.type !== 'hawkshot' || (p.launchTick !== undefined && p.origin !== undefined),
    'Hawkshot lacks launch state'
  );
const command: z.ZodType<Command> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('order'), unit: id, order }),
  z.strictObject({ type: z.literal('cast'), unit: id, ability, point }),
  z.strictObject({ type: z.literal('recall'), unit: id }),
]);
const snapshot = z.strictObject({
  version: z.literal(SNAPSHOT_VERSION),
  ruleset: z.literal(SNAPSHOT_RULESET),
  battlefield: z.enum(['rift', 'practice-fixture']),
  winner: team.nullable(),
  tick,
  nextId: id,
  units: z.array(unit).min(1).max(10000),
  player,
  otherChampions: z.array(player).max(10000),
  projectiles: z.array(projectile).max(10000),
  randomState: z.number().int().min(0).max(0xffffffff),
  wave: tick,
  nextWaveTick: deadline,
  pendingSpawns: z.array(z.strictObject({ tick, kind, team, lane: tick, offset: tick })).max(10000),
  reveal: z.strictObject({ point, endTick: deadline }).nullable(),
  visionAreas: z
    .array(
      z.strictObject({
        kind: z.enum(['attack', 'scout']),
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
  const ids = [...state.units, ...state.projectiles].map((u) => u.id);
  if (new Set(ids).size !== ids.length || ids.some((value) => value >= state.nextId))
    throw new Error('Saved match contains invalid entity identities.');
  const hero = state.units.find((u) => u.id === state.player.id);
  if (!hero || hero.kind !== 'champion' || hero.team !== 'blue')
    throw new Error('Saved match is missing its player.');
  const owners = [state.player, ...state.otherChampions];
  const ownerIds = new Set(owners.map((p) => p.id));
  const champions = state.units.filter((u) => u.kind === 'champion');
  if (
    ownerIds.size !== owners.length ||
    owners.length !== champions.length ||
    champions.some((u) => !ownerIds.has(u.id))
  )
    throw new Error('Saved match contains invalid champion ownership.');
  for (const owner of owners) {
    const champion = champions.find((u) => u.id === owner.id)!;
    const cast = owner.pendingCast;
    if (
      cast &&
      (cast.startTick > state.tick ||
        cast.releaseTick <= state.tick ||
        champion.deadAt !== null ||
        state.winner !== null ||
        owner.recallEnd !== null)
    )
      throw new Error('Saved match contains an invalid pending cast.');
    const animation = owner.castAnimation;
    if (
      (animation &&
        (animation.startTick > state.tick ||
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
