import { z } from 'zod';
import { ITEMS } from '../content/rules';
import type { Command, Order, PlayerState, Projectile, Unit } from './types';

declare const __SIMULATION_HASH__: string;
export const SNAPSHOT_RULESET = __SIMULATION_HASH__;
export const SNAPSHOT_VERSION = 5;
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
    releaseTick: deadline.nullable(),
    nextAttackTick: deadline,
    slowUntil: deadline,
    stunUntil: deadline,
    deadAt: tick.nullable(),
    ai: z.boolean(),
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
  .refine((u) => u.hp <= u.maxHp && u.mana <= u.maxMana, 'Invalid unit resources');
const player: z.ZodType<PlayerState> = z.strictObject({
  id,
  gold: nonnegative,
  cs: tick,
  kills: tick,
  deaths: tick,
  xp: nonnegative,
  level: z.number().int().min(1).max(30),
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
  recallEnd: deadline.nullable(),
  inventory: z.array(z.string().refine((value) => ITEMS.some((item) => item.id === value))).max(6),
});
const projectile: z.ZodType<Projectile> = z.strictObject({
  id,
  source: id,
  team,
  type: z.enum(['attack', 'volley', 'ultimate']),
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
});
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
  projectiles: z.array(projectile).max(10000),
  randomState: z.number().int().min(0).max(0xffffffff),
  wave: tick,
  nextWaveTick: deadline,
  pendingSpawns: z.array(z.strictObject({ tick, kind, team, lane: tick, offset: tick })).max(10000),
  reveal: z.strictObject({ point, endTick: deadline }).nullable(),
  visionAreas: z
    .array(
      z.strictObject({
        x: z.number(),
        y: z.number(),
        radius: nonnegative,
        unobstructed: z.boolean().optional(),
        team,
        endTick: deadline,
      })
    )
    .max(10000),
  healSpeedEnd: deadline,
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
  const ids = [...state.units, ...state.projectiles].map((u) => u.id);
  if (new Set(ids).size !== ids.length || ids.some((value) => value >= state.nextId))
    throw new Error('Saved match contains invalid entity identities.');
  const hero = state.units.find((u) => u.id === state.player.id);
  if (!hero || hero.kind !== 'champion' || hero.team !== 'blue')
    throw new Error('Saved match is missing its player.');
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
