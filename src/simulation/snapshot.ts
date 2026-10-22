import { SCUTTLER_POLICY, RIVER_SIDES } from '../content/scuttler-policy';
import { SUMMONER_SMITE } from '../content/summoner-smite';
import { isSummonerSlot } from '../content/summoners';
import {
  COMPANION_SOURCE,
  COMPANION_POLICY,
  companionStage,
  COMPANION_PASSIVES,
  COMPANION_PASSIVE_POLICY,
  mosstomperShield,
} from '../content/companion-policy';
import { riverContains, riverHome } from './scuttler';
import { LUX_BINDING_STOP_HISTORY_TICKS } from '../content/lux-binding-presentation';
import { MONSTERS, monsterSpawnClipTicks } from '../content/monsters';
import {
  RIFT_CAMPS,
  campLeadupTicks,
  campMemberHome,
  splitMemberHomes,
} from '../content/rift-camps';
import type { Battlefield } from './battlefield';
import {
  GROMP_ATTACK_PATH_FRAMES,
  GROMP_ATTACK_VISUAL_TAIL_TICKS,
} from '../content/gromp-attack-presentation';
import { isStructureKind } from './types';
import { LUX_ILLUMINATION_HISTORY_TICKS } from '../content/lux-illumination-presentation';
import { impactTargetRig, type ImpactRig } from '../content/impact-target';
import {
  STRUCTURE_ANIMATION_PROFILES,
  structureAnimationProfile,
  type StructureRig,
} from '../content/structure-animation';
import { structurePose } from '../render/structure-pose';
import { mobileClipDurations, MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import type { AnimationTimeline } from './animation-timeline';
import { ANIMATION_FADE_TICKS } from './animation-timeline';
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
import { GAREN_W } from '../content/garen-w';
import { GAREN_W_AUDIO_TAIL_TICKS } from '../content/garen-w-audio-timing';
import { GAREN_W_DEFLECT_TAIL_TICKS } from '../content/garen-w-particle-timing';
import { GAREN_E } from '../content/garen-e';
import {
  GAREN_E_DURATION_TICKS,
  GAREN_E_PRESENTATION_TAIL_TICKS,
  garenEStrikes,
  garenEStrikeTick,
} from './garen-e';
import { GAREN_Q } from '../content/garen-q';
import { garenQLandingTick } from '../content/garen-q-presentation';
import { GAREN_Q_AUDIO_TAIL_TICKS } from '../content/garen-q-audio-timing';
import { GAREN_R_REVEAL_TICKS, GAREN_R_WINDUP_TICKS } from '../content/garen-r-policy';
import { GAREN_R_PRESENTATION_TAIL_TICKS } from './garen-r';
import { GAREN_PASSIVE } from '../content/garen-passive';
import { garenQAttackTimingAtLevel } from './garen-attack-timing';
import { HAWKSHOT_PRESENTATION_TAIL_SECONDS } from '../content/hawkshot-linger-timing';
import { MAX_LEVEL, statPrecision } from './progression';
import { LOST_CHAPTER } from '../content/mage-items';
import { hastedCooldownTicks } from './ability-haste';
import { CREST_OF_INSIGHT } from '../content/crest-of-insight';
import { CREST_OF_CINDERS } from '../content/crest-of-cinders';
import { BLUE_BUFF_DURATION_TICKS, BLUE_BUFF_REGEN_TICKS } from './blue-buff';
import {
  RED_BUFF_DURATION_TICKS,
  RED_BUFF_REGEN_TICKS,
  RED_HEAL_LOCKOUT_TICKS,
  CINDER_BURN_TICKS,
  CINDER_BURN_INTERVAL,
  cinderDamagePerTick,
} from './red-buff';
import type { Command, Order, PlayerState, Projectile, Unit } from './types';

declare const __SIMULATION_HASH__: string;
export const SNAPSHOT_RULESET = __SIMULATION_HASH__;
export const SNAPSHOT_VERSION = 100;
const nonnegative = z.number().nonnegative();
const tick = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const score = nonnegative.max(Number.MAX_SAFE_INTEGER).refine((v) => statPrecision(v) === v);
const maxCampMembers = Math.max(...RIFT_CAMPS.map((c) => c.members.length));
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const poseLayer = z.strictObject({
  clip: z.string().max(100),
  time: nonnegative,
  rate: nonnegative,
  loop: z.boolean(),
  unclampedTime: nonnegative,
  weight: z.number().min(0).max(1),
});
const animationTimeline = z.strictObject({
  tick,
  primary: z.strictObject({
    kind: z.enum(['spawn', 'cast', 'recall', 'attack', 'run', 'idle', 'death']),
    clip: z.string().max(100),
    time: nonnegative,
    rate: nonnegative,
    loop: z.boolean(),
    unclampedTime: nonnegative,
    cut: z.boolean(),
    settled: z.boolean(),
  }),
  transition: z.strictObject({ startTick: tick, outgoing: z.array(poseLayer).max(64) }).nullable(),
});
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
    [...reachableHaste].flatMap((haste) =>
      [0, ...CREST_OF_INSIGHT.hasteTiers.map((tier) => tier.haste)].map((buffHaste) =>
        hastedCooldownTicks(seconds, haste + buffHaste)
      )
    )
  )
);
const team = z.enum(['blue', 'red']);
const faction = z.enum(['blue', 'red', 'neutral']);
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
  'monster',
]);
const ability = z.enum(['q', 'w', 'e', 'r', 'd', 'f']);
const order: z.ZodType<Order> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('idle') }),
  z.strictObject({ type: z.enum(['move', 'attackMove']), point }),
  z.strictObject({ type: z.literal('attack'), target: id }),
]);
const unit = z
  .strictObject({
    id,
    kind,
    champion: z.enum(['ashe', 'lux', 'garen']).optional(),
    team: faction,
    monster: z
      .strictObject({
        species: z.enum([
          'gromp',
          'blue',
          'red',
          'wolf',
          'wolf-mini',
          'raptor',
          'raptor-mini',
          'krug',
          'krug-medium',
          'krug-mini',
          'scuttler',
        ]),
        scuttle: z
          .strictObject({
            river: z.enum(['dragon', 'baron']),
            destination: z.number().int().min(0).max(4),
            direction: z.union([z.literal(-1), z.literal(1)]),
            nextThinkTick: tick,
            grazeUntil: tick.nullable(),
            fleeUntil: tick.nullable(),
            lastDamageTick: tick.nullable(),
          })
          .optional(),
        home: point,
        phase: z.enum(['spawning', 'idle', 'engaged', 'returning']),
        targetId: id.nullable(),
        spawn: z
          .strictObject({
            startTick: tick,
            readyTick: tick,
            clip: z.enum([
              'spawn',
              'spawn_mini1',
              'spawn_mini2',
              'north_spawn',
              'spawn2',
              'spawn3',
              'spawn4',
              'north_spawn2',
              'north_spawn3',
              'north_spawn4',
              'spawn_nj',
              'spawn_north_jung',
            ]),
          })
          .nullable(),
      })
      .optional(),
    name: z.string().max(200),
    x: z.number(),
    y: z.number(),
    previous: point,
    facing: z.number(),
    animationTimeline: animationTimeline.nullable(),
    idleClock: z
      .strictObject({ startTick: tick, previous: nonnegative, current: nonnegative })
      .nullable(),
    runClock: z
      .strictObject({ startTick: tick, previous: nonnegative, current: nonnegative })
      .nullable(),
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
        garenQRank: z.number().int().min(1).max(5).optional(),
        garenQReleaseTick: tick.optional(),
      })
      .refine((cycle) => cycle.endTick > cycle.startTick, 'Invalid attack cycle')
      .refine(
        (cycle) => (cycle.garenQRank !== undefined) === (cycle.garenQReleaseTick !== undefined),
        'Missing Decisive Strike release'
      )
      .refine(
        (cycle) =>
          cycle.garenQReleaseTick === undefined ||
          (cycle.garenQReleaseTick > cycle.startTick && cycle.garenQReleaseTick < cycle.endTick),
        'Invalid Decisive Strike release'
      )
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
            kind: z.enum([
              'frost',
              'critical-frost',
              'crystal-arrow',
              'lucent',
              'cinders',
              'smite',
              'scorchclaw',
            ]),
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
    silenceUntil: deadline,
    shields: z
      .array(
        z.strictObject({
          sourceId: id,
          amount: z.number().positive(),
          endTick: tick,
          prismaticCastTick: tick.optional(),
          companionGrantTick: tick.optional(),
        })
      )
      .max(10000),
    illumination: z.array(z.strictObject({ sourceId: id, endTick: tick })).max(10000),
    scorchclawBurns: z
      .array(
        z.strictObject({
          sourceId: id,
          startTick: tick,
          endTick: tick,
          nextTick: tick,
          capturedMaxHp: z.number().finite().positive(),
          damagePerTick: z.number().finite().positive(),
        })
      )
      .max(10),
    cinderBurn: z
      .strictObject({
        sourceId: id,
        phaseTick: tick,
        appliedTick: tick,
        endTick: tick,
        nextTick: tick,
        damagePerTick: z
          .number()
          .refine((v) =>
            Array.from({ length: 18 }, (_, i) => cinderDamagePerTick(i + 1)).includes(v)
          ),
      })
      .nullable(),
    garenEShreds: z
      .array(z.strictObject({ sourceId: id, startTick: tick, endTick: tick }))
      .max(10000),
    summonerHealReductionUntil: tick,
    summonerHealSpeedUntil: deadline,
    deadAt: tick.nullable(),
    ai: z.boolean(),
    aiRetreating: z.boolean(),
    nextThink: deadline,
    respawnTick: deadline.nullable(),
    structureTransform: z.array(z.number()).length(16).optional(),
    structureKnowledge: z.strictObject({ blue: tick.nullable(), red: tick.nullable() }).optional(),
    structureIdle: z
      .strictObject({
        startTick: tick,
        observedStartTicks: z.strictObject({ blue: tick, red: tick }),
      })
      .optional(),
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
  .refine(
    (u) => u.attackCycle?.garenQRank === undefined || u.champion === 'garen',
    'Invalid Decisive Strike attacker'
  )
  .refine((u) => !u.attackCycle?.critical || u.kind === 'champion', 'Invalid critical attacker')
  .refine(
    (u) =>
      (u.kind === 'monster') === (u.team === 'neutral') && (u.kind === 'monster') === !!u.monster,
    'Invalid neutral faction'
  )
  .refine(
    (u) =>
      !u.monster ||
      (!u.ai &&
        u.lane === null &&
        u.respawnTick === null &&
        !u.structure &&
        !u.structureTransform &&
        !u.structureKnowledge &&
        !u.structureIdle &&
        (u.monster.phase === 'engaged') === (u.monster.targetId !== null)),
    'Invalid neutral lifecycle'
  )
  .refine((u) => {
    if (!u.monster) return true;
    if (u.monster.species === 'scuttler') return u.order.type === 'idle' || u.order.type === 'move';
    if (u.monster.phase === 'engaged') return u.order.type === 'idle' || u.order.type === 'attack';
    if (u.releaseTick !== null || u.attackCycle !== null) return false;
    return u.monster.phase === 'idle' || u.monster.phase === 'spawning'
      ? u.order.type === 'idle'
      : u.order.type === 'move' &&
          u.order.point.x === u.monster.home.x &&
          u.order.point.y === u.monster.home.y;
  }, 'Invalid neutral order') as z.ZodType<Unit>;
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
    summoners: z.strictObject({
      d: z.enum(['flash', 'heal', 'smite']),
      f: z.enum(['flash', 'heal', 'smite']),
    }),
    smite: z
      .strictObject({ charges: z.number().int().min(0).max(2), rechargeTick: tick.nullable() })
      .nullable(),
    id,
    gold: nonnegative,
    cs: score,
    kills: tick,
    deaths: tick,
    xp: nonnegative,
    level: z.number().int().min(1).max(MAX_LEVEL),
    observedStats: z.strictObject({
      blue: z
        .strictObject({
          level: z.number().int().min(1).max(MAX_LEVEL),
          cs: score,
          inventory: inventorySchema,
        })
        .nullable(),
      red: z
        .strictObject({
          level: z.number().int().min(1).max(MAX_LEVEL),
          cs: score,
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
    garenRReveal: z.strictObject({ targetId: id, startTick: tick, endTick: tick }).nullable(),
    garenRVisual: z
      .strictObject({
        startTick: tick,
        targetId: id,
        facing: z.number().finite(),
        point,
        releaseTick: tick.nullable(),
        stopTick: tick.nullable(),
        killed: z.boolean(),
      })
      .nullable(),
    garenEVisual: z
      .strictObject({ startTick: tick, stopTick: tick.nullable(), facing: z.number().finite() })
      .nullable(),
    garenE: z
      .strictObject({
        startTick: tick,
        endTick: tick,
        rank: z.number().int().min(1).max(5),
        strikes: z.number().int().min(7).max(9),
        completedStrikes: z.number().int().min(0).max(8),
        cooldownTicks: tick,
        hits: z
          .array(z.strictObject({ targetId: id, count: z.number().int().min(1).max(9) }))
          .max(10000),
      })
      .nullable(),
    garenPassiveReadyTick: tick,
    garenCourageStacks: z
      .number()
      .int()
      .min(0)
      .max(Math.ceil(GAREN_W.maxResistGain / GAREN_W.resistGainPerStack)),
    garenWVisual: z
      .strictObject({
        startTick: tick,
        stopTick: tick.nullable(),
        endReason: z.enum(['expired', 'death', 'match-end']).nullable(),
      })
      .nullable(),
    garenWDeflects: z
      .array(z.strictObject({ tick, castTick: tick }))
      .max(GAREN_W_DEFLECT_TAIL_TICKS),
    garenW: z
      .strictObject({
        startTick: tick,
        rank: z.number().int().min(1).max(5),
        upfrontUntil: tick,
        defenseUntil: tick,
      })
      .nullable(),
    garenQ: z
      .strictObject({
        startTick: tick,
        rank: z.number().int().min(1).max(5),
        attackUntil: tick,
        speedUntil: tick,
        consumed: z.boolean(),
      })
      .nullable(),
    garenQVisuals: z
      .array(
        z.strictObject({
          startTick: tick,
          rank: z.number().int().min(1).max(5),
          stopTick: tick.nullable(),
          endReason: z.enum(['consumed', 'expired', 'death', 'match-end', 'recast']).nullable(),
          attacks: z
            .array(
              z.strictObject({
                startTick: tick,
                releaseTick: tick,
                endTick: tick,
                targetId: id,
                origin: point,
                facing: z.number(),
                stopTick: tick.nullable(),
                endReason: z
                  .enum([
                    'complete',
                    'target-lost',
                    'death',
                    'match-end',
                    'recast',
                    'order',
                    'action',
                  ])
                  .nullable(),
                impact: z.strictObject({ tick, point, facing: z.number() }).nullable(),
                landing: z.strictObject({ tick, point, facing: z.number() }).nullable(),
                silenceEndTick: tick.nullable(),
              })
            )
            .max(Math.round(GAREN_Q.attackWindowSeconds * TICK_RATE)),
        })
      )
      .max(Math.round(GAREN_Q.attackWindowSeconds * TICK_RATE) + GAREN_Q_AUDIO_TAIL_TICKS),
    eCharges: z.number().int().min(0).max(ASHE_E.maximumCharges),
    eRechargeTick: tick.nullable(),
    eRechargeDurationTicks: tick.refine((value) => rechargeDurations.has(value)),
    recallEnd: deadline.nullable(),
    enlighten: z
      .strictObject({ startTick: tick, endTick: tick, totalMana: z.number().positive() })
      .nullable(),
    blueBuff: z.strictObject({ startTick: tick, endTick: tick, nextRegenTick: tick }).nullable(),
    redBuff: z.strictObject({ startTick: tick, endTick: tick, nextRegenTick: tick }).nullable(),
    redBuffHealReadyTick: tick,
    castAnimation: z
      .strictObject({ ability: z.enum(['q', 'w', 'e', 'r']), startTick: tick })
      .nullable(),
    pendingCast: z
      .strictObject({
        targetId: id.optional(),
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
    team: faction,
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
    bindingAudioVariant: z.union([z.literal(0), z.literal(1)]).optional(),
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
        ? p.bindingHits !== undefined &&
          p.bindingAudioVariant !== undefined &&
          p.target === null &&
          p.volleyId === null
        : p.bindingHits === undefined && p.bindingAudioVariant === undefined,
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
  z.strictObject({ type: z.literal('cast'), unit: id, ability, point, targetId: id.optional() }),
  z.strictObject({ type: z.literal('recall'), unit: id }),
  z.strictObject({ type: z.literal('learn'), unit: id, ability: z.enum(['q', 'w', 'e', 'r']) }),
]);
const luxTargetVisual = (historyTicks: number) =>
  z.strictObject({
    id,
    sourceId: id,
    targetId: id,
    team,
    startTick: tick,
    critical: z.boolean(),
    detachedTick: tick.nullable(),
    targetRig: z
      .enum([
        ...Object.keys(MOBILE_CLIP_DURATIONS),
        ...Object.keys(STRUCTURE_ANIMATION_PROFILES),
      ] as [ImpactRig, ...ImpactRig[]])
      .nullable(),
    targetTransform: z.array(z.number()).length(16).nullable(),
    frames: z
      .array(
        z.strictObject({
          tick,
          x: z.number(),
          y: z.number(),
          facing: z.number(),
          structurePose: z
            .strictObject({
              kind: z.enum(['idle', 'destroyed', 'dead-idle']),
              clip: z.string().max(100),
              time: nonnegative,
              loop: z.boolean(),
            })
            .nullable(),
          animationTimeline: animationTimeline.nullable(),
        })
      )
      .min(1)
      .max(historyTicks),
  });
const snapshot = z.strictObject({
  companions: z
    .array(
      z.strictObject({
        passive: z
          .discriminatedUnion('kind', [
            z.strictObject({
              kind: z.literal('gustwalker'),
              lastBrushTick: tick.nullable(),
              killTick: tick.nullable(),
            }),
            z.strictObject({ kind: z.literal('mosstomper'), rechargeTick: tick.nullable() }),
            z.strictObject({
              kind: z.literal('scorchclaw'),
              stacks: z.number().int().min(0).max(100),
              nextStackTick: tick,
            }),
          ])
          .nullable(),
        ownerId: id,
        kind: z.enum(['gustwalker', 'scorchclaw', 'mosstomper']),
        createdTick: tick,
        x: z.number().finite(),
        y: z.number().finite(),
        previous: point,
        facing: z.number().finite(),
        fed: z.number().int().min(0).max(35),
        bonusTreats: z.number().int().min(0).max(5),
        nextTreatTick: tick.nullable(),
        firstMonsterDone: z.boolean(),
        firstEvolvedTick: tick.nullable(),
        fullGrownTick: tick.nullable(),
        targetId: id.nullable(),
        activeUntil: deadline,
        nextStrikeTick: deadline,
        releaseTick: tick.nullable(),
        pose: z.strictObject({
          action: z.enum(['spawn', 'idle', 'run', 'attack', 'heal', 'smite', 'transform']),
          startTick: tick,
        }),
        path: z.array(point).max(10000),
        nextPathTick: deadline,
      })
    )
    .max(10),
  version: z.literal(SNAPSHOT_VERSION),
  encounter: z.literal('gromp').nullable(),
  jungleCamps: z
    .array(
      z.strictObject({
        id: z.enum([
          'order-gromp',
          'chaos-gromp',
          'order-blue',
          'chaos-blue',
          'order-red',
          'chaos-red',
          'order-wolves',
          'chaos-wolves',
          'order-raptors',
          'chaos-raptors',
          'order-krugs',
          'chaos-krugs',
        ]),
        unitIds: z.array(id.nullable()).min(1).max(maxCampMembers),
        cleanupTicks: z.array(tick.nullable()).min(1).max(maxCampMembers),
        nextSpawnTick: tick.nullable(),
        splitWaves: z
          .array(
            z.strictObject({
              parentSlot: z.number().int().min(0).max(1),
              parentId: id,
              deathTick: tick,
              readyTick: tick,
              point,
              facing: z.number().min(-Math.PI).max(Math.PI),
              targetId: id.nullable(),
              status: z.enum(['pending', 'spawned', 'cancelled']),
            })
          )
          .max(2),
      })
    )
    .max(RIFT_CAMPS.length),
  scuttlers: z
    .strictObject({
      initialDeaths: z.number().int().min(0).max(2),
      unitIds: z.strictObject({ dragon: id.nullable(), baron: id.nullable() }),
      pending: z
        .strictObject({
          side: z.enum(['dragon', 'baron', 'both']),
          readyTick: tick,
          deathTick: tick.nullable(),
        })
        .nullable(),
      streakSide: z.enum(['dragon', 'baron']).nullable(),
      streakCount: tick,
      shrines: z
        .array(
          z.strictObject({
            river: z.enum(['dragon', 'baron']),
            team,
            startTick: tick,
            endTick: tick,
          })
        )
        .max(2),
      speedBuffs: z.array(z.strictObject({ unitId: id, team, endTick: tick })).max(100),
    })
    .nullable(),
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
  nextBindingAudioVariant: z.union([z.literal(0), z.literal(1)]),
  bindingStops: z
    .array(
      z.strictObject({
        id,
        sourceId: id,
        team,
        origin: point,
        point,
        launchTick: tick,
        stopTick: tick,
        reason: z.enum(['hit-limit', 'range']),
        variant: z.union([z.literal(0), z.literal(1)]),
      })
    )
    .max(10000),
  luxImpactVisuals: z.array(luxTargetVisual(LUX_IMPACT_HISTORY_TICKS)).max(10000),
  luxIlluminationVisuals: z
    .array(
      luxTargetVisual(LUX_ILLUMINATION_HISTORY_TICKS).extend({
        audience: z
          .array(team)
          .min(1)
          .max(2)
          .refine((v) => new Set(v).size === v.length),
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
  grompAttackVisuals: z
    .array(
      z.strictObject({
        origin: point,
        id,
        sourceId: id,
        team: z.literal('neutral'),
        launchTick: tick,
        stopTick: tick.nullable(),
        frames: z
          .array(z.strictObject({ tick, x: z.number(), y: z.number(), facing: z.number() }))
          .min(1)
          .max(GROMP_ATTACK_PATH_FRAMES),
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
  pendingSpawns: z
    .array(
      z.strictObject({ tick, kind: kind.exclude(['monster']), team, lane: tick, offset: tick })
    )
    .max(10000),
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
        team: faction,
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
function validAnimationTimeline(
  timeline: AnimationTimeline | null,
  durations: Readonly<Record<string, number>> | undefined,
  at: number
): boolean {
  if (!!durations !== !!timeline) return false;
  if (!timeline || !durations) return true;
  const layers = [timeline.primary, ...(timeline.transition?.outgoing ?? [])];
  const outgoing = timeline.transition?.outgoing ?? [];
  return !(
    timeline.tick > at ||
    layers.some((layer) => {
      if (!Object.hasOwn(durations, layer.clip) || layer.time > durations[layer.clip] + 1e-7)
        return true;
      const duration = durations[layer.clip];
      const mappedTime =
        layer.loop && duration > 0
          ? layer.unclampedTime % duration
          : Math.min(layer.unclampedTime, duration);
      return Math.abs(layer.time - mappedTime) > 1e-7;
    }) ||
    new Set(outgoing.map((layer) => layer.clip)).size !== outgoing.length ||
    outgoing.some((layer) => layer.clip === timeline.primary.clip) ||
    outgoing.reduce((sum, layer) => sum + layer.weight, 0) > 1 + 1e-7 ||
    (timeline.transition &&
      (timeline.primary.cut ||
        timeline.transition.startTick > timeline.tick ||
        timeline.tick - 1 >= timeline.transition.startTick + ANIMATION_FADE_TICKS))
  );
}
export function decodeSnapshot(text: string, battlefield: Battlefield) {
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
  if (
    state.companions.length &&
    (state.battlefield !== 'practice-fixture' ||
      state.encounter !== 'gromp' ||
      state.matchMode !== 'practice')
  )
    throw new Error('Saved companions require the controlled Gromp encounter.');
  if (new Set(state.companions.map((p) => p.ownerId)).size !== state.companions.length)
    throw new Error('Saved companions have duplicate owners.');
  for (const p of state.companions) {
    const u = state.units.find((u) => u.id === p.ownerId),
      owner = [state.player, ...state.otherChampions].find((s) => s.id === p.ownerId),
      clips = COMPANION_SOURCE.profiles[p.kind].clips,
      interval =
        (companionStage(p.fed) > 0
          ? COMPANION_SOURCE.controllerValues.LongTreatTimer!
          : COMPANION_SOURCE.controllerValues.TreatTimer!) * TICK_RATE;
    if (
      !u ||
      u.kind !== 'champion' ||
      !owner ||
      !Object.values(owner.summoners).includes('smite') ||
      p.createdTick > state.tick ||
      Math.abs(p.x) > battlefield.half ||
      Math.abs(p.y) > battlefield.half ||
      p.pose.startTick < p.createdTick ||
      p.pose.startTick > state.tick ||
      (p.fed === 35) !== (p.passive !== null) ||
      (p.passive !== null && p.passive.kind !== p.kind) ||
      p.fed > 0 !== p.firstMonsterDone ||
      p.fed >= 15 !== (p.firstEvolvedTick !== null) ||
      (p.fed === 35) !== (p.fullGrownTick !== null) ||
      (p.firstEvolvedTick !== null &&
        (p.firstEvolvedTick < p.createdTick || p.firstEvolvedTick > state.tick)) ||
      (p.fullGrownTick !== null &&
        (p.fullGrownTick < p.firstEvolvedTick! || p.fullGrownTick > state.tick)) ||
      Math.abs(p.previous.x) > battlefield.half ||
      Math.abs(p.previous.y) > battlefield.half ||
      p.path.some((v) => Math.abs(v.x) > battlefield.half || Math.abs(v.y) > battlefield.half) ||
      (p.pose.action === 'spawn' && p.pose.startTick !== p.createdTick) ||
      (p.pose.action === 'transform' &&
        p.pose.startTick !== p.firstEvolvedTick &&
        p.pose.startTick !== p.fullGrownTick) ||
      (p.nextTreatTick !== null &&
        (p.nextTreatTick <
          (p.fed < 15
            ? p.createdTick + COMPANION_POLICY.initialTreatTick
            : p.firstEvolvedTick! + 5400) ||
          (p.nextTreatTick -
            (p.fed < 15
              ? p.createdTick + COMPANION_POLICY.initialTreatTick
              : p.firstEvolvedTick! + 5400)) %
            interval !==
            0)) ||
      (p.fed === 35
        ? p.nextTreatTick !== null
        : p.nextTreatTick === null ||
          p.nextTreatTick <= state.tick ||
          p.nextTreatTick >
            Math.max(p.createdTick + COMPANION_POLICY.initialTreatTick, state.tick + interval)) ||
      p.nextStrikeTick > state.tick + COMPANION_POLICY.strikeTicks ||
      p.nextPathTick > state.tick + COMPANION_POLICY.pathTicks ||
      p.activeUntil > state.tick + COMPANION_POLICY.activeTicks ||
      (p.releaseTick !== null &&
        (p.releaseTick <= state.tick ||
          p.releaseTick > state.tick + COMPANION_POLICY.windupTicks ||
          p.targetId === null)) ||
      (!['idle', 'run'].includes(p.pose.action) &&
        u.hp > 0 &&
        state.tick >=
          p.pose.startTick + Math.ceil(clips[p.pose.action].durationSeconds * TICK_RATE)) ||
      (p.targetId !== null && !state.units.some((u) => u.id === p.targetId && u.kind === 'monster'))
    )
      throw new Error('Saved companion contains invalid ownership, feeding or combat clocks.');
    const passive = p.passive;
    if (passive?.kind === 'gustwalker') {
      for (const t of [passive.lastBrushTick, passive.killTick])
        if (
          t !== null &&
          (t < p.fullGrownTick! ||
            t > state.tick ||
            t + COMPANION_PASSIVES.gustwalker.decayTicks <= state.tick)
        )
          throw new Error('Saved Gustwalker contains invalid speed clocks.');
    } else if (passive?.kind === 'scorchclaw') {
      if (
        passive.nextStackTick <= state.tick ||
        passive.nextStackTick > state.tick + COMPANION_PASSIVE_POLICY.emberIntervalTicks ||
        (passive.nextStackTick - p.fullGrownTick!) % COMPANION_PASSIVE_POLICY.emberIntervalTicks !==
          0
      )
        throw new Error('Saved Scorchclaw contains invalid Ember phase.');
    } else if (passive?.kind === 'mosstomper') {
      if (
        (passive.rechargeTick !== null &&
          (passive.rechargeTick < p.fullGrownTick! ||
            passive.rechargeTick > state.tick + COMPANION_PASSIVES.mosstomper.rechargeTicks ||
            (u.hp > 0 && passive.rechargeTick <= state.tick))) ||
        (passive.rechargeTick === null &&
          u.hp > 0 &&
          !u.shields.some((s) => s.companionGrantTick !== undefined))
      )
        throw new Error('Saved Mosstomper contains invalid shield recharge.');
    }
  }
  if (state.matchMode === 'lanes' && state.battlefield !== 'rift')
    throw new Error('Lane matches require Summoner’s Rift.');
  if (
    state.jungleCamps.length !== (state.matchMode === 'lanes' ? RIFT_CAMPS.length : 0) ||
    (state.jungleCamps.length > 0 && state.battlefield !== 'rift') ||
    new Set(state.jungleCamps.map((c) => c.id)).size !== state.jungleCamps.length
  )
    throw new Error('Saved match has invalid jungle camps.');
  const river = state.scuttlers;
  if ((state.matchMode === 'lanes') !== (river !== null))
    throw new Error('Saved match has invalid river controller.');
  const riverIds = new Set<number>();
  if (river) {
    const live = RIVER_SIDES.filter((side) => river.unitIds[side] !== null),
      pending = river.pending;
    if (
      new Set(Object.values(river.unitIds).filter((id) => id !== null)).size !== live.length ||
      (pending &&
        (live.length !== 0 ||
          pending.readyTick - SCUTTLER_POLICY.leadupTicks <= state.tick ||
          (pending.side === 'both'
            ? river.initialDeaths !== 0 ||
              pending.readyTick !== SCUTTLER_POLICY.firstReadyTick ||
              pending.deathTick !== null
            : river.initialDeaths !== 2 ||
              pending.deathTick === null ||
              pending.deathTick < SCUTTLER_POLICY.firstReadyTick ||
              pending.deathTick > state.tick ||
              pending.readyTick !== pending.deathTick + SCUTTLER_POLICY.respawnTicks ||
              pending.readyTick > state.tick + SCUTTLER_POLICY.respawnTicks ||
              river.streakSide !== pending.side))) ||
      (!pending &&
        (river.initialDeaths < 2 ? live.length !== 2 - river.initialDeaths : live.length !== 1)) ||
      (river.initialDeaths === 0
        ? river.streakSide !== null || river.streakCount !== 0
        : river.streakSide === null || river.streakCount < 1)
    )
      throw new Error('Saved river lifecycle is inconsistent.');
    for (const side of live) {
      const id = river.unitIds[side]!,
        u = state.units.find((u) => u.id === id),
        home = riverHome(side, battlefield);
      if (
        !u ||
        u.kind !== 'monster' ||
        u.monster.species !== 'scuttler' ||
        u.hp <= 0 ||
        u.monster.scuttle?.river !== side ||
        u.monster.home.x !== home.x ||
        u.monster.home.y !== home.y ||
        !riverContains(side, u) ||
        (river.initialDeaths < 2 &&
          u.monster.spawn &&
          u.monster.spawn.readyTick !== SCUTTLER_POLICY.firstReadyTick) ||
        (river.initialDeaths === 2 &&
          (river.streakSide !== side ||
            (u.monster.spawn &&
              u.monster.spawn.readyTick <
                SCUTTLER_POLICY.firstReadyTick + SCUTTLER_POLICY.respawnTicks)))
      )
        throw new Error('Saved river has an invalid live Scuttler.');
      riverIds.add(id);
    }
    if (
      new Set(river.shrines.map((s) => s.river)).size !== river.shrines.length ||
      river.shrines.some(
        (s) =>
          s.startTick < SCUTTLER_POLICY.firstReadyTick ||
          s.startTick > state.tick ||
          s.endTick !== s.startTick + SCUTTLER_POLICY.shrineTicks ||
          s.endTick <= state.tick
      )
    )
      throw new Error('Saved river has invalid shrines.');
    if (
      new Set(river.speedBuffs.map((s) => s.unitId)).size !== river.speedBuffs.length ||
      river.speedBuffs.some((s) => {
        const u = state.units.find((u) => u.id === s.unitId);
        return (
          !u ||
          u.kind !== 'champion' ||
          u.hp <= 0 ||
          u.team !== s.team ||
          s.endTick <= state.tick ||
          s.endTick > state.tick + SCUTTLER_POLICY.shrineLingerTicks
        );
      })
    )
      throw new Error('Saved river has invalid speed buffs.');
  }
  for (const u of state.units) {
    if (u.kind !== 'monster') continue;
    const motion = u.monster.scuttle;
    if ((u.monster.species === 'scuttler') !== !!motion)
      throw new Error('Saved monster has invalid peaceful movement state.');
    if (!motion) continue;
    if (
      (u.hp > 0 && !riverIds.has(u.id)) ||
      u.releaseTick !== null ||
      u.attackCycle !== null ||
      u.attackTarget !== null ||
      u.order.type === 'attack' ||
      u.monster.phase === 'returning' ||
      motion.nextThinkTick >
        Math.max(state.tick + SCUTTLER_POLICY.thinkTicks, u.monster.spawn?.readyTick ?? 0) ||
      (motion.grazeUntil !== null &&
        (motion.grazeUntil <= state.tick ||
          motion.grazeUntil > state.tick + SCUTTLER_POLICY.grazeTicks)) ||
      (motion.lastDamageTick !== null && motion.lastDamageTick > state.tick) ||
      (motion.fleeUntil !== null &&
        (motion.fleeUntil <= state.tick ||
          motion.fleeUntil > state.tick + SCUTTLER_POLICY.fleeTicks ||
          motion.lastDamageTick === null)) ||
      (u.monster.phase === 'engaged') !== (motion.fleeUntil !== null)
    )
      throw new Error('Saved Scuttler has an invalid peaceful timeline.');
  }
  const ownedMonsters = new Set<number>();
  const splitParents = new Set<number>();
  for (const camp of state.jungleCamps) {
    const definition = RIFT_CAMPS.find((c) => c.id === camp.id)!;
    const leadup = campLeadupTicks(definition);
    if (
      camp.unitIds.length !== definition.members.length ||
      camp.cleanupTicks.length !== definition.members.length
    )
      throw new Error('Saved camp has invalid member slots.');
    if (
      camp.splitWaves.length > definition.splits.length ||
      new Set(camp.splitWaves.map((s) => s.parentSlot)).size !== camp.splitWaves.length
    )
      throw new Error('Saved camp has invalid split waves.');
    for (const wave of camp.splitWaves) {
      const split = definition.splits.find((s) => s.parentSlot === wave.parentSlot);
      const parent = state.units.find((u) => u.id === wave.parentId);
      if (
        !split ||
        camp.unitIds[wave.parentSlot] !== null ||
        splitParents.has(wave.parentId) ||
        wave.parentId >= state.nextId ||
        wave.deathTick < definition.firstReadyTick ||
        wave.deathTick > state.tick ||
        wave.readyTick !== wave.deathTick + definition.splitDelayTicks ||
        Math.abs(wave.point.x) > battlefield.half ||
        Math.abs(wave.point.y) > battlefield.half ||
        (wave.status === 'pending' && wave.readyTick <= state.tick) ||
        (wave.status === 'spawned' && wave.readyTick > state.tick) ||
        (wave.targetId !== null &&
          !state.units.some((u) => u.id === wave.targetId && u.kind === 'champion')) ||
        (wave.status !== 'spawned' &&
          split.childSlots.some((slot) => camp.unitIds[slot] !== null)) ||
        (parent &&
          (parent.kind !== 'monster' ||
            parent.monster.species !== definition.members[wave.parentSlot].species ||
            parent.deadAt !== wave.deathTick ||
            parent.x !== wave.point.x ||
            parent.y !== wave.point.y ||
            parent.facing !== wave.facing))
      )
        throw new Error('Saved camp has an invalid split wave.');
      splitParents.add(wave.parentId);
    }
    const pending = camp.splitWaves.some((s) => s.status === 'pending');
    if (camp.unitIds.every((id) => id === null) && !pending) {
      if (
        camp.splitWaves.length !== 0 ||
        camp.cleanupTicks.some((t) => t !== null) ||
        camp.nextSpawnTick === null ||
        camp.nextSpawnTick - leadup <= state.tick ||
        (state.tick < definition.firstReadyTick
          ? camp.nextSpawnTick !== definition.firstReadyTick
          : camp.nextSpawnTick > state.tick + definition.respawnTicks)
      )
        throw new Error('Saved jungle camp has an invalid spawn deadline.');
      continue;
    }
    if (camp.nextSpawnTick !== null || state.tick < definition.firstReadyTick - leadup)
      throw new Error('Saved jungle camp has invalid active members.');
    for (const split of definition.splits) {
      const wave = camp.splitWaves.find((s) => s.parentSlot === split.parentSlot);
      if ((camp.unitIds[split.parentSlot] === null) !== !!wave)
        throw new Error('Saved camp lost a parent split wave.');
    }
    for (const [slot, id] of camp.unitIds.entries()) {
      const cleanup = camp.cleanupTicks[slot];
      const marked =
        id !== null && camp.unitIds[0] === null && definition.cleanupDelayTicks !== null;
      if (
        marked
          ? cleanup === null ||
            cleanup <= state.tick ||
            cleanup > state.tick + definition.cleanupDelayTicks!
          : cleanup !== null
      )
        throw new Error('Saved jungle camp has invalid marked cleanup.');
      if (id === null) continue;
      const unit = state.units.find((u) => u.id === id),
        member = definition.members[slot];
      const split = definition.splits.find((s) => s.childSlots.includes(slot));
      const wave = split
        ? camp.splitWaves.find((s) => s.parentSlot === split.parentSlot)
        : undefined;
      if (split && (!wave || wave.status !== 'spawned' || unit?.monster?.spawn !== null))
        throw new Error('Saved camp has invalid split children.');
      const home = split
        ? splitMemberHomes(definition, wave!, battlefield)[split.childSlots.indexOf(slot)]
        : campMemberHome(definition, slot, battlefield);
      if (
        !unit ||
        unit.kind !== 'monster' ||
        unit.hp <= 0 ||
        ownedMonsters.has(id) ||
        unit.monster.species !== member.species ||
        unit.monster.home.x !== home.x ||
        unit.monster.home.y !== home.y ||
        (unit.monster.spawn && unit.monster.spawn.clip !== member.spawnClip) ||
        (state.tick < definition.firstReadyTick &&
          unit.monster.spawn?.readyTick !== definition.firstReadyTick)
      )
        throw new Error('Saved jungle camp has an invalid active monster.');
      ownedMonsters.add(id);
    }
  }
  if (
    state.encounter &&
    (state.battlefield !== 'practice-fixture' || state.matchMode !== 'practice')
  )
    throw new Error('Controlled neutral encounters require the development practice fixture.');
  if (
    state.units.find((u) => u.id === state.player.id)?.champion === 'garen' &&
    state.battlefield !== 'practice-fixture'
  )
    throw new Error('Garen player kit is available only in the development practice fixture.');
  for (const unit of state.units) {
    if (unit.kind === 'monster') {
      const spawn = unit.monster.spawn;
      const profile = MONSTERS[unit.monster.species];
      const owner = state.jungleCamps.find((c) => c.unitIds.includes(unit.id));
      const leadup = owner
        ? campLeadupTicks(RIFT_CAMPS.find((c) => c.id === owner.id)!)
        : profile.spawnLeadupTicks;
      if (
        (unit.monster.phase === 'spawning' && !spawn) ||
        (spawn &&
          (spawn.startTick > state.tick ||
            spawn.readyTick - spawn.startTick !== leadup ||
            state.tick >=
              spawn.startTick +
                monsterSpawnClipTicks(unit.monster.species, spawn.clip) +
                (unit.monster.species === 'scuttler' ? SCUTTLER_POLICY.hiddenTicks : 0) ||
            (unit.monster.phase === 'spawning') !== state.tick < spawn.readyTick ||
            unit.monster.phase === 'engaged' ||
            unit.monster.phase === 'returning' ||
            unit.hp !== unit.maxHp ||
            unit.deadAt !== null ||
            unit.x !== unit.monster.home.x ||
            unit.y !== unit.monster.home.y ||
            unit.releaseTick !== null ||
            unit.attackCycle !== null ||
            unit.runClock !== null ||
            unit.idleClock !== null))
      )
        throw new Error('Saved monster contains an invalid spawn sequence.');
    }
    if (unit.kind === 'monster' && unit.monster.targetId !== null) {
      const target = state.units.find((other) => other.id === unit.monster.targetId);
      if (
        !target ||
        target.team === 'neutral' ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind)
      )
        throw new Error('Saved monster contains an invalid aggressor.');
    }
    const fixed = ['turret', 'inhibitor', 'nexus'].includes(unit.kind);
    const idle = unit.structureIdle;
    const knowledge = unit.structureKnowledge;
    if (
      !!knowledge !== fixed ||
      (knowledge &&
        idle &&
        (['blue', 'red'] as const).some((team) => {
          const knownDeath = knowledge[team];
          if (knownDeath !== null && knownDeath > state.tick) return true;
          if (unit.deadAt !== null) return knownDeath !== unit.deadAt;
          return (
            knownDeath !== null &&
            (knownDeath < idle.observedStartTicks[team] || knownDeath >= idle.startTick)
          );
        }))
    )
      throw new Error('Saved match contains invalid structure destruction knowledge.');
    if (
      !!idle !== fixed ||
      (idle &&
        (idle.startTick > state.tick ||
          Object.values(idle.observedStartTicks).some((start) => start > idle.startTick) ||
          (unit.deadAt !== null && idle.startTick > unit.deadAt)))
    )
      throw new Error('Saved match contains an invalid structure idle clock.');
    const timeline = unit.animationTimeline,
      durations = mobileClipDurations(unit);
    if (!validAnimationTimeline(timeline, durations, state.tick))
      throw new Error('Saved match contains an invalid animation timeline.');
    for (const clock of [unit.runClock, unit.idleClock])
      if (clock && (clock.startTick > state.tick || clock.previous > clock.current))
        throw new Error('Saved match contains an invalid animation clock.');
  }
  const impactIds = new Set<number>();
  for (const [visual, trigger] of [
    ...state.luxImpactVisuals.map((v) => [v, false] as const),
    ...state.luxIlluminationVisuals.map((v) => [v, true] as const),
  ]) {
    const source = state.units.find((u) => u.id === visual.sourceId);
    const target = state.units.find((u) => u.id === visual.targetId);
    const flight = state.luxAttackVisuals.find((v) => v.id === visual.id);
    const last = visual.frames.at(-1)!;
    const structureProfile =
      visual.targetRig && Object.hasOwn(STRUCTURE_ANIMATION_PROFILES, visual.targetRig)
        ? STRUCTURE_ANIMATION_PROFILES[visual.targetRig as StructureRig]
        : undefined;
    const mobileDurations =
      visual.targetRig && Object.hasOwn(MOBILE_CLIP_DURATIONS, visual.targetRig)
        ? MOBILE_CLIP_DURATIONS[visual.targetRig as keyof typeof MOBILE_CLIP_DURATIONS]
        : undefined;
    if (
      (!structureProfile && visual.targetTransform !== null) ||
      (target &&
        JSON.stringify(visual.targetTransform) !==
          JSON.stringify(target.structureTransform ?? null)) ||
      impactIds.has(visual.id) ||
      visual.id >= state.nextId ||
      source?.champion !== 'lux' ||
      source.team !== visual.team ||
      (target && (target.team === visual.team || impactTargetRig(target) !== visual.targetRig)) ||
      visual.targetId >= state.nextId ||
      (!trigger &&
        (!flight || flight.sourceId !== visual.sourceId || flight.stopTick !== visual.startTick)) ||
      (trigger &&
        (visual.critical ||
          visual.targetTransform !== null ||
          !!structureProfile ||
          (target && isStructureKind(target.kind)))) ||
      visual.startTick > state.tick ||
      state.tick >=
        visual.startTick + (trigger ? LUX_ILLUMINATION_HISTORY_TICKS : LUX_IMPACT_HISTORY_TICKS) ||
      visual.frames.length !== state.tick - visual.startTick + 1 ||
      (visual.detachedTick !== null &&
        (visual.detachedTick < visual.startTick || visual.detachedTick > state.tick)) ||
      (visual.detachedTick === null &&
        (!target ||
          target.hp <= 0 ||
          last.x !== target.x ||
          last.y !== target.y ||
          last.facing !== target.facing ||
          JSON.stringify(last.animationTimeline) !== JSON.stringify(target.animationTimeline) ||
          (structureProfile &&
            JSON.stringify(last.structurePose) !==
              JSON.stringify(
                structurePose(
                  {
                    destroyed: false,
                    deathTick: null,
                    idleStartTick: target.structureIdle!.startTick,
                  },
                  structureAnimationProfile(target),
                  state.tick,
                  1
                )
              )))) ||
      visual.frames.some(
        (f, i) =>
          f.tick !== visual.startTick + i ||
          !!f.structurePose !== !!structureProfile ||
          (f.structurePose !== null &&
            structureProfile !== undefined &&
            (() => {
              const p = f.structurePose,
                duration =
                  structureProfile.durations[p.clip as keyof typeof structureProfile.durations];
              if (!Object.hasOwn(structureProfile.durations, p.clip) || p.time > duration)
                return true;
              if (
                (visual.detachedTick === null || f.tick < visual.detachedTick) &&
                p.kind !== 'idle'
              )
                return true;
              if (p.kind === 'idle') return p.clip !== 'idle1' || !p.loop;
              if (p.kind === 'dead-idle')
                return (
                  p.clip !== structureProfile.deadIdleClip ||
                  !p.loop ||
                  !structureProfile.animateDestruction
                );
              return (
                p.clip !== structureProfile.destroyedClip ||
                p.loop ||
                (!structureProfile.animateDestruction && p.time !== 0)
              );
            })()) ||
          !validAnimationTimeline(f.animationTimeline, mobileDurations, f.tick) ||
          (f.animationTimeline !== null &&
            (visual.detachedTick === null || f.tick < visual.detachedTick) &&
            f.animationTimeline.tick !== f.tick) ||
          (i > 0 &&
            visual.detachedTick !== null &&
            f.tick > visual.detachedTick &&
            (f.x !== visual.frames[i - 1].x ||
              f.y !== visual.frames[i - 1].y ||
              f.facing !== visual.frames[i - 1].facing ||
              JSON.stringify(f.animationTimeline) !==
                JSON.stringify(visual.frames[i - 1].animationTimeline) ||
              JSON.stringify(f.structurePose) !==
                JSON.stringify(visual.frames[i - 1].structurePose)))
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
  const grompAttackIds = new Set<number>();
  for (const visual of state.grompAttackVisuals) {
    const source = state.units.find((u) => u.id === visual.sourceId),
      p = state.projectiles.find((p) => p.id === visual.id),
      lastTick = visual.stopTick ?? state.tick,
      firstTick = Math.max(visual.launchTick, lastTick - GROMP_ATTACK_PATH_FRAMES + 1);
    if (
      grompAttackIds.has(visual.id) ||
      attackVisualIds.has(visual.id) ||
      visual.id >= state.nextId ||
      [
        ...state.units,
        ...state.pendingAttackProjectiles,
        ...state.luxBeams,
        ...state.singularities,
      ].some((e) => e.id === visual.id) ||
      state.scoutVisuals.some((v) => v.flight.id === visual.id) ||
      state.luxImpactVisuals.some((v) => v.id === visual.id) ||
      state.luxIlluminationVisuals.some((v) => v.id === visual.id) ||
      source?.kind !== 'monster' ||
      source.monster.species !== 'gromp' ||
      visual.launchTick > lastTick ||
      lastTick > state.tick ||
      (visual.stopTick !== null &&
        state.tick >= visual.stopTick + GROMP_ATTACK_VISUAL_TAIL_TICKS) ||
      visual.frames.length !== lastTick - firstTick + 1 ||
      visual.frames.some((f, i) => f.tick !== firstTick + i) ||
      (visual.stopTick === null
        ? !p ||
          p.type !== 'attack' ||
          p.team !== 'neutral' ||
          p.source !== visual.sourceId ||
          p.launchTick !== visual.launchTick ||
          p.origin?.x !== visual.origin.x ||
          p.origin?.y !== visual.origin.y ||
          p.x !== visual.frames.at(-1)!.x ||
          p.y !== visual.frames.at(-1)!.y ||
          Math.abs(visual.frames.at(-1)!.facing - Math.atan2(p.direction.x, p.direction.y)) > 1e-8
        : !!p)
    )
      throw new Error('Saved match contains an invalid Gromp attack visual.');
    grompAttackIds.add(visual.id);
  }
  for (const p of state.projectiles)
    if (
      p.type === 'attack' &&
      state.units.find((u) => u.id === p.source)?.kind === 'monster' &&
      !grompAttackIds.has(p.id)
    )
      throw new Error('Saved Gromp attack lacks presentation history.');
  const bindingStopIds = new Set<number>();
  for (const flight of state.bindingStops) {
    const source = state.units.find((u) => u.id === flight.sourceId);
    const length = Math.hypot(flight.point.x - flight.origin.x, flight.point.y - flight.origin.y);
    const maxFlightTicks = Math.ceil((LUX_BINDING.range / LUX_BINDING.speed) * TICK_RATE);
    if (
      bindingStopIds.has(flight.id) ||
      flight.id >= state.nextId ||
      source?.kind !== 'champion' ||
      source.team !== flight.team ||
      flight.launchTick > flight.stopTick ||
      flight.stopTick > state.tick ||
      flight.stopTick - flight.launchTick > maxFlightTicks ||
      state.tick >= flight.stopTick + LUX_BINDING_STOP_HISTORY_TICKS ||
      length > LUX_BINDING.range + 1e-6 ||
      length > ((flight.stopTick - flight.launchTick + 1) * LUX_BINDING.speed) / TICK_RATE + 1e-6 ||
      (flight.reason === 'range' && Math.abs(length - LUX_BINDING.range) > 1e-6) ||
      state.luxAttackVisuals.some((v) => v.id === flight.id) ||
      state.grompAttackVisuals.some((v) => v.id === flight.id) ||
      state.luxImpactVisuals.some((v) => v.id === flight.id) ||
      state.scoutVisuals.some((v) => v.flight.id === flight.id)
    )
      throw new Error('Saved match contains an invalid Light Binding stop.');
    bindingStopIds.add(flight.id);
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
    ...state.luxIlluminationVisuals,
    ...state.bindingStops,
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
    const burn = target.cinderBurn;
    const burner = burn && state.units.find((u) => u.id === burn.sourceId);
    if (
      burn &&
      (!burner ||
        burner.kind !== 'champion' ||
        burner.team === target.team ||
        target.deadAt !== null ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind) ||
        burn.phaseTick > burn.appliedTick ||
        burn.appliedTick > state.tick ||
        burn.endTick <= state.tick ||
        burn.endTick !== burn.appliedTick + CINDER_BURN_TICKS ||
        burn.nextTick !==
          burn.phaseTick +
            (Math.floor((state.tick - burn.phaseTick) / CINDER_BURN_INTERVAL) + 1) *
              CINDER_BURN_INTERVAL)
    )
      throw new Error('Saved match contains invalid Cinders burn clocks or ownership.');
    const slows = new Set<string>();
    for (const slow of target.slows) {
      const source = state.units.find((u) => u.id === slow.sourceId);
      const key = `${slow.sourceId}:${slow.kind}`;
      if (
        !source ||
        source.team === target.team ||
        source.kind !== 'champion' ||
        (slow.kind !== 'cinders' &&
          slow.kind !== 'smite' &&
          slow.kind !== 'scorchclaw' &&
          source.champion !== (slow.kind === 'lucent' ? 'lux' : 'ashe')) ||
        target.deadAt !== null ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind) ||
        slow.startTick > state.tick ||
        slow.endTick <= state.tick ||
        (slow.kind === 'scorchclaw' &&
          (!state.companions.some(
            (p) =>
              p.ownerId === source.id &&
              p.passive?.kind === 'scorchclaw' &&
              p.fullGrownTick !== null &&
              p.fullGrownTick <= slow.startTick
          ) ||
            slow.startMultiplier !== 1 - COMPANION_PASSIVES.scorchclaw.slowFraction ||
            slow.endMultiplier !== 1 ||
            slow.endTick - slow.startTick > COMPANION_PASSIVES.scorchclaw.slowTicks)) ||
        (slow.kind === 'smite' &&
          (!state.companions.some((p) => p.ownerId === source.id && companionStage(p.fed) > 0) ||
            slow.startMultiplier !== 0.8 ||
            slow.endMultiplier !== 0.8 ||
            slow.endTick - slow.startTick > 120)) ||
        (slow.kind === 'cinders' &&
          (slow.endTick - slow.startTick > CREST_OF_CINDERS.slowDurationSeconds * TICK_RATE ||
            slow.endMultiplier !== slow.startMultiplier ||
            !CREST_OF_CINDERS.slowTiers.some(
              (t) => slow.startMultiplier === 1 - (source.champion === 'garen' ? t.melee : t.ranged)
            ))) ||
        slows.has(key)
      )
        throw new Error('Saved match contains invalid independent slows.');
      slows.add(key);
    }
    if (!Number.isFinite(target.shields.reduce((sum, shield) => sum + shield.amount, 0)))
      throw new Error('Saved match contains excessive shields.');
    const prismaticGrants = new Set<string>();
    let mossGrants = 0;
    for (const shield of target.shields) {
      const key = `${shield.sourceId}:${shield.prismaticCastTick}`;
      const source = state.units.find((u) => u.id === shield.sourceId);
      if (
        target.kind !== 'champion' ||
        target.deadAt !== null ||
        !source ||
        source.kind !== 'champion' ||
        source.team !== target.team ||
        (shield.companionGrantTick !== undefined &&
          (++mossGrants > 1 ||
            shield.prismaticCastTick !== undefined ||
            source.id !== target.id ||
            shield.endTick !== Number.MAX_SAFE_INTEGER ||
            shield.companionGrantTick > state.tick ||
            !state.companions.some(
              (p) =>
                p.ownerId === target.id &&
                p.passive?.kind === 'mosstomper' &&
                p.fullGrownTick !== null &&
                p.fullGrownTick <= shield.companionGrantTick!
            ) ||
            shield.amount >
              mosstomperShield(
                [state.player, ...state.otherChampions].find((p) => p.id === target.id)!.level
              ))) ||
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
    const scorchedBy = new Set<number>();
    for (const burn of target.scorchclawBurns) {
      const source = state.units.find((u) => u.id === burn.sourceId),
        companion = state.companions.find((p) => p.ownerId === burn.sourceId),
        interval = COMPANION_PASSIVE_POLICY.burnIntervalTicks;
      if (
        !source ||
        source.kind !== 'champion' ||
        source.team === target.team ||
        !companion ||
        companion.passive?.kind !== 'scorchclaw' ||
        burn.startTick < companion.fullGrownTick! ||
        scorchedBy.has(source.id) ||
        target.deadAt !== null ||
        ['turret', 'inhibitor', 'nexus'].includes(target.kind) ||
        (target.kind === 'monster' && target.monster.phase === 'returning') ||
        burn.startTick > state.tick ||
        burn.endTick <= state.tick ||
        burn.endTick !== burn.startTick + COMPANION_PASSIVES.scorchclaw.burnTicks ||
        burn.nextTick > burn.endTick ||
        burn.nextTick !==
          burn.startTick + (Math.floor((state.tick - burn.startTick) / interval) + 1) * interval ||
        burn.damagePerTick !==
          (burn.capturedMaxHp * COMPANION_PASSIVES.scorchclaw.healthFraction) /
            (COMPANION_PASSIVES.scorchclaw.burnTicks / interval)
      )
        throw new Error('Saved Scorchclaw contains invalid burn ownership, damage or clocks.');
      scorchedBy.add(source.id);
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
    const shredSources = new Set<number>();
    for (const shred of target.garenEShreds) {
      const source = state.units.find((u) => u.id === shred.sourceId);
      if (
        target.kind !== 'champion' ||
        target.deadAt !== null ||
        source?.champion !== 'garen' ||
        source.team === target.team ||
        ![state.player, ...state.otherChampions].some(
          (owner) => owner.id === source.id && owner.spellRanks.e > 0
        ) ||
        shredSources.has(shred.sourceId) ||
        shred.startTick > state.tick ||
        shred.endTick <= state.tick ||
        shred.endTick !== shred.startTick + Math.round(GAREN_E.shredSeconds * TICK_RATE)
      )
        throw new Error('Saved match contains invalid Judgment armor reduction.');
      shredSources.add(shred.sourceId);
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
    const equippedSmite = Object.values(owner.summoners).includes('smite');
    if (
      owner.summoners.d === owner.summoners.f ||
      equippedSmite !== (owner.smite !== null) ||
      (owner.smite &&
        (owner.smite.charges === SUMMONER_SMITE.maxCharges
          ? owner.smite.rechargeTick !== null
          : owner.smite.rechargeTick === null ||
            owner.smite.rechargeTick <= state.tick ||
            owner.smite.rechargeTick > state.tick + SUMMONER_SMITE.rechargeSeconds * TICK_RATE))
    )
      throw new Error('Saved match contains invalid summoner loadout or Smite charges.');
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
      champion.champion !== 'ashe' &&
      (owner.qStacks !== 0 ||
        owner.qUntil !== 0 ||
        owner.qStackExpiry !== 0 ||
        owner.eCharges !== 0 ||
        owner.eRechargeTick !== null)
    )
      throw new Error('Saved match contains champion-incompatible spell state.');
    if (
      champion.champion === 'ashe' &&
      owner.spellRanks.e > 0 &&
      (owner.eCharges === ASHE_E.maximumCharges) !== (owner.eRechargeTick === null)
    )
      throw new Error('Saved Hawkshot has invalid recharge state.');
    const enlighten = owner.enlighten;
    const blue = owner.blueBuff;
    const red = owner.redBuff;
    if (
      owner.redBuffHealReadyTick > state.tick + RED_HEAL_LOCKOUT_TICKS ||
      (red &&
        (red.startTick > state.tick ||
          red.endTick <= state.tick ||
          red.endTick !== red.startTick + RED_BUFF_DURATION_TICKS ||
          red.nextRegenTick !==
            red.startTick +
              (Math.floor((state.tick - red.startTick) / RED_BUFF_REGEN_TICKS) + 1) *
                RED_BUFF_REGEN_TICKS))
    )
      throw new Error('Saved match contains invalid Crest of Cinders clocks.');
    if (
      blue &&
      (blue.startTick > state.tick ||
        blue.endTick <= state.tick ||
        blue.endTick !== blue.startTick + BLUE_BUFF_DURATION_TICKS ||
        blue.nextRegenTick !==
          blue.startTick +
            (Math.floor((state.tick - blue.startTick) / BLUE_BUFF_REGEN_TICKS) + 1) *
              BLUE_BUFF_REGEN_TICKS)
    )
      throw new Error('Saved match contains invalid Crest of Insight clocks.');
    if (
      enlighten &&
      (champion.deadAt !== null ||
        enlighten.startTick > state.tick ||
        enlighten.endTick <= state.tick ||
        enlighten.endTick !== enlighten.startTick + LOST_CHAPTER.durationSeconds * TICK_RATE)
    )
      throw new Error('Saved match contains invalid Enlighten restoration.');
    const compatibleCast = (ability: string) =>
      champion.champion === 'lux'
        ? ['q', 'w', 'e', 'r'].includes(ability)
        : champion.champion === 'garen'
          ? ability === 'r'
          : champion.champion === 'ashe' && ability !== 'q';
    const spin = owner.garenE;
    const visual = owner.garenEVisual;
    if (visual) {
      if (
        champion.champion !== 'garen' ||
        !owner.spellRanks.e ||
        visual.startTick > state.tick ||
        (visual.stopTick === null
          ? !spin || spin.startTick !== visual.startTick
          : !!spin ||
            visual.stopTick < visual.startTick ||
            visual.stopTick > state.tick ||
            visual.stopTick > visual.startTick + GAREN_E_DURATION_TICKS ||
            state.tick >= visual.stopTick + GAREN_E_PRESENTATION_TAIL_TICKS)
      )
        throw new Error('Saved match contains invalid Judgment visual state.');
    } else if (spin) throw new Error('Saved Judgment spin is missing its visual state.');
    if (spin) {
      const expectedCompleted = Array.from({ length: spin.strikes }, (_, i) => i + 1).filter(
        (i) => garenEStrikeTick(spin.startTick, spin.strikes, i) <= state.tick
      ).length;
      if (
        champion.champion !== 'garen' ||
        champion.deadAt !== null ||
        state.winner !== null ||
        spin.startTick > state.tick ||
        spin.endTick <= state.tick ||
        spin.endTick !== spin.startTick + GAREN_E_DURATION_TICKS ||
        spin.rank > owner.spellRanks.e ||
        spin.completedStrikes !== expectedCompleted ||
        owner.pendingCast ||
        owner.castAnimation ||
        owner.recallEnd !== null ||
        champion.releaseTick !== null ||
        champion.attackCycle !== null ||
        owner.cooldowns.e > spin.startTick ||
        !Array.from({ length: owner.level }, (_, i) => garenEStrikes(i + 1)).includes(
          spin.strikes
        ) ||
        ![...reachableHaste].some(
          (haste) =>
            spin.cooldownTicks ===
            hastedCooldownTicks(GAREN_E.cooldownSecondsByRank[spin.rank - 1], haste)
        )
      )
        throw new Error('Saved match contains invalid Judgment spin state.');
      const hitIds = new Set<number>();
      for (const hit of spin.hits) {
        const target = champions.find((u) => u.id === hit.targetId);
        if (
          !target ||
          target.team === champion.team ||
          hitIds.has(hit.targetId) ||
          hit.count > spin.completedStrikes ||
          (target.deadAt !== null && target.deadAt < spin.startTick)
        )
          throw new Error('Saved match contains invalid Judgment hit counts.');
        hitIds.add(hit.targetId);
      }
    }
    const justiceVisual = owner.garenRVisual;
    const justicePending =
      champion.champion === 'garen' && owner.pendingCast?.ability === 'r'
        ? owner.pendingCast
        : null;
    if (justiceVisual) {
      const target = state.units.find((u) => u.id === justiceVisual.targetId);
      const ended = justiceVisual.releaseTick ?? justiceVisual.stopTick;
      if (
        champion.champion !== 'garen' ||
        !owner.spellRanks.r ||
        justiceVisual.startTick > state.tick ||
        (justiceVisual.killed && justiceVisual.releaseTick === null) ||
        (target && (target.kind !== 'champion' || target.team === champion.team)) ||
        (justiceVisual.releaseTick !== null &&
          (justiceVisual.stopTick !== null ||
            justiceVisual.releaseTick !== justiceVisual.startTick + GAREN_R_WINDUP_TICKS ||
            justiceVisual.releaseTick > state.tick)) ||
        (justiceVisual.stopTick !== null &&
          (justiceVisual.stopTick < justiceVisual.startTick ||
            justiceVisual.stopTick > state.tick ||
            justiceVisual.stopTick > justiceVisual.startTick + GAREN_R_WINDUP_TICKS)) ||
        (ended === null
          ? !justicePending ||
            justicePending.startTick !== justiceVisual.startTick ||
            justicePending.targetId !== justiceVisual.targetId ||
            justicePending.point.x !== justiceVisual.point.x ||
            justicePending.point.y !== justiceVisual.point.y ||
            champion.facing !== justiceVisual.facing
          : !!justicePending || state.tick >= ended + GAREN_R_PRESENTATION_TAIL_TICKS)
      )
        throw new Error('Saved match contains invalid Demacian Justice presentation.');
    } else if (justicePending)
      throw new Error('Saved Demacian Justice cast is missing its presentation.');
    const justiceReveal = owner.garenRReveal;
    if (justiceReveal) {
      const target = champions.find((u) => u.id === justiceReveal.targetId);
      if (
        champion.champion !== 'garen' ||
        !owner.spellRanks.r ||
        !target ||
        target.team === champion.team ||
        !justiceVisual ||
        justiceVisual.startTick !== justiceReveal.startTick ||
        justiceVisual.targetId !== justiceReveal.targetId ||
        justiceReveal.startTick > state.tick ||
        justiceReveal.endTick <= state.tick ||
        justiceReveal.endTick !== justiceReveal.startTick + GAREN_R_REVEAL_TICKS ||
        (target.deadAt !== null && target.deadAt < justiceReveal.startTick)
      )
        throw new Error('Saved match contains invalid Demacian Justice reveal.');
    }
    if (
      (champion.champion !== 'garen' || owner.spellRanks.w === 0) &&
      owner.garenCourageStacks !== 0
    )
      throw new Error('Saved match contains foreign Courage stacks.');
    const courage = owner.garenW;
    if (
      courage &&
      (champion.champion !== 'garen' ||
        champion.deadAt !== null ||
        courage.rank > owner.spellRanks.w ||
        courage.startTick > state.tick ||
        courage.defenseUntil <= state.tick ||
        courage.upfrontUntil !==
          courage.startTick + Math.round(GAREN_W.upfrontSeconds * TICK_RATE) ||
        courage.defenseUntil !==
          courage.startTick + Math.round(GAREN_W.damageReductionSeconds * TICK_RATE))
    )
      throw new Error('Saved match contains invalid Courage state.');
    const courageVisual = owner.garenWVisual;
    if (
      courage &&
      (!courageVisual ||
        courageVisual.startTick !== courage.startTick ||
        courageVisual.stopTick !== null)
    )
      throw new Error('Saved match lacks active Courage presentation.');
    if (courageVisual) {
      const { startTick, stopTick, endReason } = courageVisual;
      const expiry = startTick + Math.round(GAREN_W.damageReductionSeconds * TICK_RATE);
      if (
        champion.champion !== 'garen' ||
        owner.spellRanks.w === 0 ||
        startTick > state.tick ||
        (stopTick === null
          ? endReason !== null ||
            !courage ||
            champion.deadAt !== null ||
            state.winner !== null ||
            state.tick >= expiry
          : endReason === null ||
            stopTick < startTick ||
            stopTick > state.tick ||
            stopTick > expiry ||
            state.tick >= stopTick + GAREN_W_AUDIO_TAIL_TICKS ||
            courage !== null ||
            (champion.deadAt !== null && champion.deadAt < stopTick) ||
            (endReason === 'expired' && stopTick !== expiry) ||
            (endReason === 'death' && (stopTick >= expiry || champion.deadAt !== stopTick)) ||
            (endReason === 'match-end' && (state.winner === null || stopTick !== state.tick)))
      )
        throw new Error('Saved match contains invalid Courage presentation.');
    }
    const garenQ = owner.garenQ;
    let previousDeflectTick = -1;
    for (const reaction of owner.garenWDeflects) {
      if (
        champion.champion !== 'garen' ||
        owner.spellRanks.w === 0 ||
        !courageVisual ||
        reaction.tick <= previousDeflectTick ||
        reaction.tick > state.tick ||
        state.tick >= reaction.tick + GAREN_W_DEFLECT_TAIL_TICKS ||
        reaction.castTick > reaction.tick ||
        reaction.tick >=
          reaction.castTick + Math.round(GAREN_W.damageReductionSeconds * TICK_RATE) ||
        (champion.deadAt !== null && reaction.tick > champion.deadAt) ||
        reaction.castTick > courageVisual.startTick ||
        (reaction.castTick < courageVisual.startTick && reaction.tick > courageVisual.startTick) ||
        (reaction.castTick === courageVisual.startTick &&
          courageVisual.stopTick !== null &&
          (courageVisual.endReason === 'expired'
            ? reaction.tick >= courageVisual.stopTick
            : reaction.tick > courageVisual.stopTick))
      )
        throw new Error('Saved match contains invalid Courage deflection history.');
      previousDeflectTick = reaction.tick;
    }
    if (
      ((champion.champion !== 'garen' || champion.deadAt !== null) &&
        owner.garenPassiveReadyTick !== 0) ||
      owner.garenPassiveReadyTick >
        state.tick + Math.round(GAREN_PASSIVE.interruptionSeconds * TICK_RATE)
    )
      throw new Error('Saved match contains invalid Perseverance timing.');
    const qCycle = champion.attackCycle;
    if (
      qCycle?.garenQReleaseTick !== undefined &&
      (qCycle.endTick !== champion.nextAttackTick ||
        (champion.releaseTick === null && qCycle.garenQReleaseTick > state.tick))
    )
      throw new Error('Saved Decisive Strike has inconsistent attack deadlines.');
    if (
      qCycle?.garenQReleaseTick !== undefined &&
      !Array.from({ length: owner.level }, (_, index) => garenQAttackTimingAtLevel(index + 1)).some(
        (timing) =>
          qCycle.garenQReleaseTick === qCycle.startTick + timing.windupTicks &&
          qCycle.endTick === qCycle.startTick + timing.periodTicks
      )
    )
      throw new Error('Saved Decisive Strike has invalid captured timing.');
    if (
      champion.attackCycle?.garenQReleaseTick !== undefined &&
      champion.releaseTick !== null &&
      champion.releaseTick !== champion.attackCycle.garenQReleaseTick
    )
      throw new Error('Saved Decisive Strike release disagrees with its animation cycle.');
    if (
      garenQ &&
      (champion.champion !== 'garen' ||
        champion.deadAt !== null ||
        garenQ.rank > owner.spellRanks.q ||
        garenQ.startTick > state.tick ||
        garenQ.attackUntil !==
          garenQ.startTick + Math.round(GAREN_Q.attackWindowSeconds * TICK_RATE) ||
        garenQ.speedUntil !==
          garenQ.startTick +
            Math.round(GAREN_Q.movementSecondsByRank[garenQ.rank - 1] * TICK_RATE) ||
        (garenQ.speedUntil <= state.tick && (garenQ.consumed || garenQ.attackUntil <= state.tick)))
    )
      throw new Error('Saved match contains invalid Decisive Strike state.');
    const qHistory = owner.garenQVisuals,
      latestQ = qHistory.at(-1);
    if (
      garenQ &&
      (!latestQ ||
        latestQ.startTick !== garenQ.startTick ||
        latestQ.rank !== garenQ.rank ||
        (garenQ.consumed
          ? latestQ.endReason !== 'consumed'
          : latestQ.stopTick !== null &&
            !(state.winner !== null && latestQ.endReason === 'match-end')))
    )
      throw new Error('Saved match lacks matching Decisive Strike presentation.');
    let previousQStart = -1;
    for (const [index, r] of qHistory.entries()) {
      const expiry = r.startTick + Math.round(GAREN_Q.attackWindowSeconds * TICK_RATE),
        next = qHistory[index + 1];
      if (
        r.attacks.filter((a) => a.impact !== null).length > 1 ||
        r.attacks.some((a, i) => a.impact !== null && i !== r.attacks.length - 1) ||
        champion.champion !== 'garen' ||
        r.rank > owner.spellRanks.q ||
        r.startTick <= previousQStart ||
        r.startTick > state.tick ||
        (champion.deadAt !== null && r.startTick > champion.deadAt) ||
        (r.stopTick === null
          ? r.endReason !== null ||
            next !== undefined ||
            !garenQ ||
            garenQ.consumed ||
            champion.deadAt !== null ||
            state.winner !== null ||
            state.tick >= expiry
          : r.endReason === null ||
            r.stopTick < r.startTick ||
            r.stopTick > state.tick ||
            r.stopTick > expiry ||
            state.tick >= r.stopTick + GAREN_Q_AUDIO_TAIL_TICKS ||
            (next !== undefined && r.stopTick > next.startTick) ||
            (champion.deadAt !== null && r.stopTick > champion.deadAt) ||
            (r.endReason === 'expired' && r.stopTick !== expiry) ||
            (r.endReason === 'death' && (r.stopTick >= expiry || champion.deadAt !== r.stopTick)) ||
            (r.endReason === 'match-end' && (state.winner === null || r.stopTick !== state.tick)) ||
            (r.endReason === 'recast' && (!next || r.stopTick !== next.startTick)) ||
            (r.endReason === 'consumed' &&
              (r.stopTick >= expiry || r.attacks.at(-1)?.impact?.tick !== r.stopTick)))
      )
        throw new Error('Saved match contains invalid Decisive Strike presentation.');
      let previousAttack = -1;
      for (const a of r.attacks) {
        const landingTick = garenQLandingTick(a),
          landed = state.tick >= landingTick && (a.stopTick === null || a.stopTick > landingTick),
          canLand = state.tick >= landingTick && (a.stopTick === null || a.stopTick >= landingTick),
          recipient = state.units.find((u) => u.id === a.targetId),
          silenceTicks = Math.round(GAREN_Q.silenceSeconds * TICK_RATE),
          silenceDurations = [
            silenceTicks,
            Math.max(
              Math.round(0.3 * TICK_RATE),
              Math.round(silenceTicks * (1 - GAREN_W.upfrontTenacity))
            ),
          ];
        if (
          (a.silenceEndTick === null
            ? a.impact &&
              recipient &&
              !isStructureKind(recipient.kind) &&
              ((recipient.deadAt === null && state.tick < a.impact.tick + silenceTicks) ||
                (recipient.deadAt !== null && recipient.deadAt > a.impact.tick))
            : !a.impact ||
              !silenceDurations.includes(a.silenceEndTick - a.impact.tick) ||
              (recipient && isStructureKind(recipient.kind)) ||
              (recipient?.deadAt === null &&
                a.silenceEndTick > state.tick &&
                recipient.silenceUntil < a.silenceEndTick)) ||
          (a.landing === null ? landed : !canLand || a.landing.tick !== landingTick) ||
          a.startTick <= previousAttack ||
          a.startTick < r.startTick ||
          a.startTick >= expiry ||
          a.startTick > state.tick ||
          (r.stopTick !== null && a.startTick > r.stopTick) ||
          a.targetId >= state.nextId ||
          a.targetId === champion.id ||
          a.endTick <= a.releaseTick ||
          (a.stopTick === null
            ? a.endReason !== null ||
              a.endTick <= state.tick ||
              champion.deadAt !== null ||
              state.winner !== null ||
              champion.attackCycle?.startTick !== a.startTick
            : a.endReason === null ||
              a.stopTick < a.startTick ||
              a.stopTick > state.tick ||
              a.stopTick > a.endTick ||
              (a.endReason === 'complete' && a.stopTick !== a.endTick) ||
              (a.endReason === 'target-lost' &&
                (a.impact !== null || a.stopTick > a.releaseTick)) ||
              (a.endReason === 'death' && a.stopTick !== champion.deadAt) ||
              (a.endReason === 'match-end' &&
                (state.winner === null || a.stopTick !== state.tick)) ||
              (a.endReason === 'recast' &&
                !qHistory.some((q) => q.startTick === a.stopTick && q.startTick > r.startTick))) ||
          (a.impact === null
            ? state.tick >= a.releaseTick && (a.stopTick === null || a.stopTick > a.releaseTick)
            : a.impact.tick !== a.releaseTick ||
              a.impact.tick > state.tick ||
              (a.stopTick !== null && a.impact.tick > a.stopTick)) ||
          !Array.from({ length: owner.level }, (_, i) => garenQAttackTimingAtLevel(i + 1)).some(
            (timing) =>
              a.releaseTick === a.startTick + timing.windupTicks &&
              a.endTick === a.startTick + timing.periodTicks
          )
        )
          throw new Error('Saved match contains invalid Decisive Strike attack presentation.');
        previousAttack = a.startTick;
      }
      previousQStart = r.startTick;
    }
    if (
      qCycle?.garenQRank !== undefined &&
      state.tick < qCycle.endTick &&
      !qHistory.some(
        (r) =>
          r.rank === qCycle.garenQRank &&
          r.attacks.some(
            (a) =>
              a.startTick === qCycle.startTick &&
              a.releaseTick === qCycle.garenQReleaseTick &&
              a.endTick === qCycle.endTick &&
              (a.stopTick === null || (a.endReason === 'action' && a.impact !== null)) &&
              (champion.releaseTick === null || a.targetId === champion.attackTarget)
          )
      )
    )
      throw new Error('Saved match lacks captured Decisive Strike attack presentation.');
    if (
      champion.attackCycle?.garenQRank !== undefined &&
      champion.attackCycle.garenQRank > owner.spellRanks.q
    )
      throw new Error('Saved Decisive Strike has an unavailable rank.');
    const cast = owner.pendingCast;
    if (cast) {
      const garenR = champion.champion === 'garen' && cast.ability === 'r';
      const luxR = champion.champion === 'lux' && cast.ability === 'r';
      const luxW = champion.champion === 'lux' && cast.ability === 'w';
      const luxE = champion.champion === 'lux' && cast.ability === 'e';
      const seconds = garenR
        ? GAREN_R_WINDUP_TICKS / TICK_RATE
        : luxR
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
        garenR !== (cast.targetId !== undefined) ||
        (garenR &&
          (cast.damage !== 0 ||
            !justiceReveal ||
            justiceReveal.targetId !== cast.targetId ||
            justiceReveal.startTick !== cast.startTick ||
            champion.releaseTick !== null ||
            champion.attackCycle !== null)) ||
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
  for (const command of state.commands) {
    if (command.type !== 'cast' || command.targetId === undefined) continue;
    const source = champions.find((u) => u.id === command.unit);
    const owner = owners.find((s) => s.id === command.unit);
    if (
      !(source?.champion === 'garen' && command.ability === 'r') &&
      !(owner && isSummonerSlot(command.ability) && owner.summoners[command.ability] === 'smite')
    )
      throw new Error('Saved match contains incompatible targeted cast data.');
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
