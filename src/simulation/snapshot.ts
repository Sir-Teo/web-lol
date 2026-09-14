import { LUX_IMPACT_HISTORY_TICKS } from '../content/lux-impact-presentation';
import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';
import { LUX_BASIC_TRAIL } from '../content/lux-basic-trail';
import {
  LUX_ATTACK_PATH_FRAMES,
  LUX_ATTACK_VISUAL_TAIL_TICKS,
} from '../content/lux-attack-presentation';
import { z } from 'zod';
import { ITEMS, TICK_RATE } from '../content/rules';
import { ASHE_CASTS } from '../content/ashe-casting';
import { LUX_ILLUMINATION } from '../content/lux-illumination';
import { LUX_E_SOURCE as LUX_E } from '../content/lux-e';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { LUX_W } from '../content/lux-w';
import { LUX_R } from '../content/lux-r';
import { LUX_BINDING } from '../content/lux-binding';
import { ASHE_E } from '../content/ashe-e';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../content/hawkshot-linger-timing';
import { MAX_LEVEL } from './progression';
import { LOST_CHAPTER } from '../content/mage-items';
import { hastedCooldownTicks } from './ability-haste';
import type { Command, Order, PlayerState, Projectile, Unit } from './types';

declare const __SIMULATION_HASH__: string;
export const SNAPSHOT_RULESET = __SIMULATION_HASH__;
export const SNAPSHOT_VERSION = 54;
const nonnegative = z.number().nonnegative();
const tick = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const deadline = z.union([tick, z.literal('Infinity').transform(() => Infinity)]);
// A captured recharge may outlive a sale or rank change. Accept every duration the
// catalog can produce in six slots, rather than comparing against current gear.
let reachableHaste = new Set([0]);
for (let slot = 0; slot < 6; slot++) {
  const next = new Set(reachableHaste);
  for (const haste of reachableHaste)
    for (const item of ITEMS) next.add(haste + ('abilityHaste' in item ? item.abilityHaste : 0));
  reachableHaste = next;
}
const rechargeDurations = new Set(
  ASHE_E.rechargeSecondsByRank.flatMap((seconds) =>
    [...reachableHaste].map((haste) => hastedCooldownTicks(seconds, haste))
  )
);
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
      .strictObject({
        startTick: tick,
        endTick: tick,
        empowered: z.boolean(),
        critical: z.literal(true).optional(),
      })
      .refine((cycle) => cycle.endTick > cycle.startTick, 'Invalid attack cycle')
      .nullable(),
    releaseTick: deadline.nullable(),
    nextAttackTick: deadline,
    slowUntil: deadline,
    slowMultiplier: z.number().min(0).max(1),
    slows: z
      .array(
        z
          .strictObject({
            sourceId: id,
            kind: z.enum(['frost', 'critical-frost', 'crystal-arrow', 'lucent']),
            startTick: tick,
            endTick: tick,
            startMultiplier: z.number().min(0).lt(1),
            endMultiplier: z.number().min(0).max(1),
          })
          .refine((s) => s.endTick > s.startTick && s.endMultiplier >= s.startMultiplier)
      )
      .max(10000),
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
    shields: z
      .array(
        z.strictObject({
          sourceId: id,
          amount: z.number().positive(),
          endTick: tick,
          prismaticCastTick: tick.optional(),
        })
      )
      .max(10000),
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
  .refine((u) => !u.attackCycle?.empowered || u.champion === 'ashe', 'Invalid empowered attacker')
  .refine((u) => !u.attackCycle?.critical || u.kind === 'champion', 'Invalid critical attacker');
const inventorySchema = z
  .array(
    z
      .string()
      .refine((value) => ITEMS.some((item) => item.id === value))
      .nullable()
  )
  .max(6)
  .refine(
    (items) => items.filter((item) => item === 'chapter').length <= 1,
    'Only one Lost Chapter is ownable'
  )
  .refine(
    (items) => items.filter((item) => item === 'deathcap').length <= 1,
    'Only one Deathcap is ownable'
  )
  .refine(
    (items) => items.filter((item) => item === 'infinity-edge').length <= 1,
    'Only one Infinity Edge is ownable'
  );
const player: z.ZodType<PlayerState> = z
  .strictObject({
    id,
    gold: nonnegative,
    cs: tick,
    kills: tick,
    deaths: tick,
    xp: nonnegative,
    level: z.number().int().min(1).max(MAX_LEVEL),
    observedStats: z.strictObject({
      blue: z
        .strictObject({
          level: z.number().int().min(1).max(MAX_LEVEL),
          cs: tick,
          inventory: inventorySchema,
        })
        .nullable(),
      red: z
        .strictObject({
          level: z.number().int().min(1).max(MAX_LEVEL),
          cs: tick,
          inventory: inventorySchema,
        })
        .nullable(),
    }),
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
    eRechargeDurationTicks: tick.refine((value) => rechargeDurations.has(value)),
    recallEnd: deadline.nullable(),
    enlighten: z
      .strictObject({ startTick: tick, endTick: tick, totalMana: z.number().positive() })
      .nullable(),
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
        shield: z.number().positive().optional(),
        detonateRequested: z.boolean().optional(),
      })
      .refine(
        (c) => (c.ability !== 'r' || c.rank <= 3) && c.releaseTick > c.startTick,
        'Invalid spell windup'
      )
      .nullable(),
    inventory: inventorySchema,
  })
  .refine(
    (p) =>
      Object.values(p.observedStats).every(
        (stats) => stats === null || (stats.level <= p.level && stats.cs <= p.cs)
      ),
    'Observed stats cannot exceed current stats'
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
    type: z.enum(['attack', 'volley', 'ultimate', 'hawkshot', 'binding', 'prismatic']),
    prismatic: z
      .strictObject({
        phase: z.enum(['out', 'return']),
        castTick: tick,
        shield: z.number().positive(),
        hitsOut: z.array(id).max(10000),
        hitsReturn: z.array(id).max(10000),
        returnPoint: point.optional(),
      })
      .optional(),
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
    critical: z.literal(true).optional(),
    flurryShot: z.number().int().min(0).max(4).optional(),
    launchTick: tick.optional(),
    origin: point.optional(),
  })
  .refine((p) => !p.critical || p.type === 'attack', 'Invalid critical projectile')
  .refine(
    (p) =>
      p.type === 'binding'
        ? p.bindingHits !== undefined && p.target === null && p.volleyId === null
        : p.bindingHits === undefined,
    'Invalid binding hit history'
  )
  .refine(
    (p) =>
      p.type === 'prismatic'
        ? p.prismatic !== undefined &&
          p.target === null &&
          p.volleyId === null &&
          p.damage === 0 &&
          p.origin !== undefined &&
          p.launchTick !== undefined &&
          p.radius === LUX_W.radius
        : p.prismatic === undefined,
    'Invalid prismatic flight'
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
  matchMode: z.enum(['practice', 'lanes']),
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
  singularities: z
    .array(
      z.strictObject({
        id,
        sourceId: id,
        team,
        x: z.number(),
        y: z.number(),
        origin: point,
        previous: point,
        point,
        launchTick: tick,
        arrivalTick: tick.nullable(),
        endTick: tick.nullable(),
        detonatedTick: tick.nullable(),
        detonateRequested: z.boolean(),
        damage: nonnegative,
        slowMultiplier: z.number().min(0).max(1),
      })
    )
    .max(10000),
  luxImpactVisuals: z
    .array(
      z.strictObject({
        id,
        sourceId: id,
        targetId: id,
        team,
        startTick: tick,
        critical: z.boolean(),
        detachedTick: tick.nullable(),
        frames: z
          .array(z.strictObject({ tick, x: z.number(), y: z.number() }))
          .min(1)
          .max(LUX_IMPACT_HISTORY_TICKS),
      })
    )
    .max(10000),
  luxAttackVisuals: z
    .array(
      z.strictObject({
        origin: point,
        id,
        sourceId: id,
        team,
        launchTick: tick,
        stopTick: tick.nullable(),
        frames: z
          .array(
            z.strictObject({
              tick,
              x: z.number(),
              y: z.number(),
              facing: z.number(),
              trailDistance: nonnegative,
            })
          )
          .min(1)
          .max(LUX_ATTACK_PATH_FRAMES),
      })
    )
    .max(10000),
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
  const impactIds = new Set<number>();
  for (const visual of state.luxImpactVisuals) {
    const source = state.units.find((u) => u.id === visual.sourceId);
    const target = state.units.find((u) => u.id === visual.targetId);
    const flight = state.luxAttackVisuals.find((v) => v.id === visual.id);
    const last = visual.frames.at(-1)!;
    if (
      impactIds.has(visual.id) ||
      visual.id >= state.nextId ||
      source?.champion !== 'lux' ||
      source.team !== visual.team ||
      (target && target.team === visual.team) ||
      visual.targetId >= state.nextId ||
      !flight ||
      flight.sourceId !== visual.sourceId ||
      flight.stopTick !== visual.startTick ||
      visual.startTick > state.tick ||
      state.tick >= visual.startTick + LUX_IMPACT_HISTORY_TICKS ||
      visual.frames.length !== state.tick - visual.startTick + 1 ||
      (visual.detachedTick !== null &&
        (visual.detachedTick < visual.startTick || visual.detachedTick > state.tick)) ||
      (visual.detachedTick === null &&
        (!target || target.hp <= 0 || last.x !== target.x || last.y !== target.y)) ||
      visual.frames.some(
        (f, i) =>
          f.tick !== visual.startTick + i ||
          (i > 0 &&
            visual.detachedTick !== null &&
            f.tick > visual.detachedTick &&
            (f.x !== visual.frames[i - 1].x || f.y !== visual.frames[i - 1].y))
      )
    )
      throw new Error('Saved match contains an invalid Lux impact visual.');
    impactIds.add(visual.id);
  }
  const attackVisualIds = new Set<number>();
  for (const visual of state.luxAttackVisuals) {
    const source = state.units.find((u) => u.id === visual.sourceId);
    const p = state.projectiles.find((p) => p.id === visual.id);
    const lastTick = visual.stopTick ?? state.tick;
    const firstTick = Math.max(visual.launchTick, lastTick - LUX_ATTACK_PATH_FRAMES + 1);
    if (
      attackVisualIds.has(visual.id) ||
      visual.id >= state.nextId ||
      [
        ...state.units,
        ...state.pendingAttackProjectiles,
        ...state.luxBeams,
        ...state.singularities,
      ].some((e) => e.id === visual.id) ||
      state.scoutVisuals.some((v) => v.flight.id === visual.id) ||
      source?.champion !== 'lux' ||
      source.team !== visual.team ||
      visual.launchTick > lastTick ||
      lastTick > state.tick ||
      (visual.stopTick !== null && state.tick >= visual.stopTick + LUX_ATTACK_VISUAL_TAIL_TICKS) ||
      visual.frames.length !== lastTick - firstTick + 1 ||
      visual.frames.some((f, i) => {
        if (f.tick !== firstTick + i) return true;
        const previous = visual.frames[i - 1];
        const relativeTick = f.tick - visual.launchTick;
        const stop = visual.stopTick === null ? Infinity : visual.stopTick - visual.launchTick;
        const count = luxEmissionCount(
          LUX_BASIC_TRAIL.rate,
          relativeTick,
          LUX_BASIC_TRAIL.emitterLife,
          stop
        );
        const priorCount = luxEmissionCount(
          LUX_BASIC_TRAIL.rate,
          relativeTick - 1,
          LUX_BASIC_TRAIL.emitterLife,
          stop
        );
        if (count <= 1) return f.trailDistance !== 0;
        if (!previous) return false; // The retired prefix owns the absolute distance.
        let expected = previous.trailDistance;
        if (count > priorCount) {
          const priorBirth =
            visual.launchTick + luxEmissionBirthTick(LUX_BASIC_TRAIL.rate, priorCount);
          const anchor = visual.frames.find((p) => p.tick === priorBirth);
          if (!anchor) return f.trailDistance < previous.trailDistance;
          expected += Math.hypot(f.x - anchor.x, f.y - anchor.y);
        }
        return (
          !Number.isFinite(expected) ||
          Math.abs(f.trailDistance - expected) > 1e-8 * Math.max(1, expected, f.trailDistance)
        );
      }) ||
      (visual.stopTick === null
        ? !p ||
          p.type !== 'attack' ||
          p.source !== visual.sourceId ||
          p.team !== visual.team ||
          p.launchTick !== visual.launchTick ||
          p.origin?.x !== visual.origin.x ||
          p.origin?.y !== visual.origin.y ||
          p.x !== visual.frames.at(-1)!.x ||
          p.y !== visual.frames.at(-1)!.y
        : !!p)
    )
      throw new Error('Saved match contains an invalid Lux attack visual.');
    attackVisualIds.add(visual.id);
  }
  for (const p of state.projectiles) {
    if (
      p.type === 'attack' &&
      state.units.find((u) => u.id === p.source)?.champion === 'lux' &&
      !attackVisualIds.has(p.id)
    )
      throw new Error('Saved Lux attack lacks presentation history.');
  }
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
    ...state.singularities,
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
      projectile.critical &&
      !state.units.some(
        (u) => u.id === projectile.source && u.kind === 'champion' && u.team === projectile.team
      )
    )
      throw new Error('Saved match contains an invalid critical projectile source.');
    const flight = projectile.prismatic;
    if (flight) {
      const source = state.units.find((u) => u.id === projectile.source);
      const out = flight.phase === 'out';
      if (
        source?.champion !== 'lux' ||
        source.team !== projectile.team ||
        projectile.launchTick !== flight.castTick + LUX_W.castSeconds * TICK_RATE ||
        projectile.launchTick > state.tick ||
        projectile.remaining <= 0 ||
        projectile.remaining > (out ? LUX_W.range : LUX_W.returnRange) ||
        projectile.speed < (out ? LUX_W.outwardMinimumSpeed : LUX_W.returnSpeed) ||
        projectile.speed > (out ? LUX_W.outwardSpeed : LUX_W.returnMaximumSpeed) ||
        flight.hitsOut[0] !== source.id ||
        flight.hitsReturn.includes(source.id) ||
        (out && flight.hitsReturn.length !== 0) ||
        [flight.hitsOut, flight.hitsReturn].some(
          (hits) =>
            new Set(hits).size !== hits.length ||
            hits.some(
              (hit) =>
                !state.units.some(
                  (u) => u.id === hit && u.kind === 'champion' && u.team === source.team
                )
            )
        )
      )
        throw new Error('Saved prismatic flight contains invalid participants or trajectory.');
    }
    if (
      projectile.type === 'binding' &&
      (!state.units.some(
        (u) => u.id === projectile.source && u.kind === 'champion' && u.team === projectile.team
      ) ||
        projectile.bindingHits!.some(
          (hit) =>
            hit >= state.nextId ||
            [
              ...state.projectiles,
              ...state.pendingAttackProjectiles,
              ...state.luxBeams,
              ...state.singularities,
            ].some((p) => p.id === hit) ||
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
  const singularityOwners = new Set<number>();
  for (const zone of state.singularities) {
    const source = state.units.find((u) => u.id === zone.sourceId);
    const arrived = zone.arrivalTick !== null;
    if (!arrived) {
      const length = Math.hypot(zone.point.x - zone.origin.x, zone.point.y - zone.origin.y);
      const travelled = ((state.tick - zone.launchTick + 1) * LUX_E.movementSpeed) / TICK_RATE;
      const fraction = length ? Math.min(1, travelled / length) : 1;
      if (
        travelled >= length - 1e-8 ||
        Math.hypot(
          zone.x - (zone.origin.x + (zone.point.x - zone.origin.x) * fraction),
          zone.y - (zone.origin.y + (zone.point.y - zone.origin.y) * fraction)
        ) > 1e-6
      )
        throw new Error('Saved Lucent flight has an invalid position.');
    }
    if (
      source?.champion !== 'lux' ||
      source.team !== zone.team ||
      zone.launchTick > state.tick ||
      Math.hypot(zone.point.x - zone.origin.x, zone.point.y - zone.origin.y) >
        LUX_E.castRange + 1e-6 ||
      !LUX_E.slowPercent.some(
        (value) => Math.abs(zone.slowMultiplier - (1 - value / 100)) < 1e-8
      ) ||
      (arrived
        ? zone.arrivalTick! < zone.launchTick ||
          zone.arrivalTick! > state.tick ||
          zone.endTick !== zone.arrivalTick! + LUX_E.zoneSeconds * TICK_RATE ||
          zone.x !== zone.point.x ||
          zone.y !== zone.point.y
        : zone.endTick !== null || zone.detonatedTick !== null) ||
      (zone.detonatedTick !== null
        ? !arrived ||
          zone.detonatedTick < zone.arrivalTick! ||
          zone.detonatedTick > state.tick ||
          zone.detonatedTick > zone.endTick! ||
          state.tick >= zone.detonatedTick + LUX_E_POLICY.presentationSeconds * TICK_RATE
        : (arrived && zone.endTick! <= state.tick) || singularityOwners.has(zone.sourceId))
    )
      throw new Error('Saved match contains an invalid Lucent Singularity.');
    if (zone.detonatedTick === null) singularityOwners.add(zone.sourceId);
  }
  if (!hero || hero.kind !== 'champion' || hero.team !== 'blue')
    throw new Error('Saved match is missing its player.');
  for (const target of state.units) {
    const slows = new Set<string>();
    for (const slow of target.slows) {
      const source = state.units.find((u) => u.id === slow.sourceId);
      const key = `${slow.sourceId}:${slow.kind}`;
      if (
        !source ||
        source.team === target.team ||
        source.champion !== (slow.kind === 'lucent' ? 'lux' : 'ashe') ||
        target.deadAt !== null ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind) ||
        slow.startTick > state.tick ||
        slow.endTick <= state.tick ||
        slows.has(key)
      )
        throw new Error('Saved match contains invalid independent slows.');
      slows.add(key);
    }
    if (!Number.isFinite(target.shields.reduce((sum, shield) => sum + shield.amount, 0)))
      throw new Error('Saved match contains excessive shields.');
    const prismaticGrants = new Set<string>();
    for (const shield of target.shields) {
      const key = `${shield.sourceId}:${shield.prismaticCastTick}`;
      const source = state.units.find((u) => u.id === shield.sourceId);
      if (
        target.kind !== 'champion' ||
        target.deadAt !== null ||
        !source ||
        source.kind !== 'champion' ||
        source.team !== target.team ||
        shield.endTick <= state.tick ||
        (shield.prismaticCastTick !== undefined &&
          (source.champion !== 'lux' ||
            shield.prismaticCastTick > state.tick ||
            shield.endTick > state.tick + LUX_W.shieldSeconds * TICK_RATE ||
            prismaticGrants.has(key)))
      )
        throw new Error('Saved match contains an invalid shield.');
      if (shield.prismaticCastTick !== undefined) prismaticGrants.add(key);
    }
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
      (owner.qStacks !== 0 ||
        owner.qUntil !== 0 ||
        owner.qStackExpiry !== 0 ||
        owner.eCharges !== 0 ||
        owner.eRechargeTick !== null)
    )
      throw new Error('Saved match contains unavailable Lux spell state.');
    if (
      champion.champion === 'ashe' &&
      owner.spellRanks.e > 0 &&
      (owner.eCharges === ASHE_E.maximumCharges) !== (owner.eRechargeTick === null)
    )
      throw new Error('Saved Hawkshot has invalid recharge state.');
    const enlighten = owner.enlighten;
    if (
      enlighten &&
      (champion.deadAt !== null ||
        enlighten.startTick > state.tick ||
        enlighten.endTick <= state.tick ||
        enlighten.endTick !== enlighten.startTick + LOST_CHAPTER.durationSeconds * TICK_RATE)
    )
      throw new Error('Saved match contains invalid Enlighten restoration.');
    const compatibleCast = (ability: string) =>
      champion.champion === 'lux' ? ['q', 'w', 'e', 'r'].includes(ability) : ability !== 'q';
    const cast = owner.pendingCast;
    if (cast) {
      const luxR = champion.champion === 'lux' && cast.ability === 'r';
      const luxW = champion.champion === 'lux' && cast.ability === 'w';
      const luxE = champion.champion === 'lux' && cast.ability === 'e';
      const seconds = luxR
        ? LUX_R.castSeconds
        : luxW
          ? LUX_W.castSeconds
          : luxE
            ? LUX_E.castSeconds
            : cast.ability === 'q'
              ? LUX_BINDING.castSeconds
              : ASHE_CASTS[cast.ability].castSeconds;
      if (
        cast.releaseTick !== cast.startTick + seconds * TICK_RATE ||
        luxR !== (cast.origin !== undefined) ||
        luxW !== (cast.shield !== undefined) ||
        luxE !== (cast.detonateRequested !== undefined) ||
        (luxW && cast.damage !== 0) ||
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
