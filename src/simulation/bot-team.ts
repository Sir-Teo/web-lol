import { BOT_TEAM_POLICY as P } from '../content/bot-team-policy';
import type { MatchRole } from '../content/bot-roles';
import { direction, distance, type Vec2 } from './math';
import { botCombatStrength, type Combatant } from './bot-disengage';
import type { StructureState } from './types';
export type TeamGoalKind = 'defend' | 'push' | 'gank' | 'river' | 'advance';
export interface TeamGoal {
  unitId: number;
  kind: TeamGoalKind;
  targetId: number;
  point: Vec2;
  issuedTick: number;
  observedTick: number;
  expiresTick: number;
  score: number;
}
export interface TeamPlan {
  nextThinkTick: number;
  assignments: TeamGoal[];
}
export const newTeamPlans = () => ({
  blue: { nextThinkTick: 1, assignments: [] as TeamGoal[] },
  red: { nextThinkTick: 31, assignments: [] as TeamGoal[] },
});
export interface TeamActor extends Combatant {
  id: number;
  role: MatchRole | null;
  controlled: boolean;
  available: boolean;
  clearing: boolean;
  companionComplete: boolean;
  level: number;
}
export interface SeenChampion extends Combatant {
  id: number;
}
export interface SeenStructure extends Vec2 {
  id: number;
  kind: 'turret' | 'inhibitor' | 'nexus';
  hp: number;
  maxHp: number;
  range: number;
  attackable: boolean;
}
export interface KnownStructure extends Vec2 {
  id: number;
  kind: SeenStructure['kind'];
  role: StructureState['role'];
  lane: StructureState['lane'];
  /** Public destruction knowledge, conservatively expired on the known calendar. */
  knownDestroyed: boolean;
}
export interface TeamMinion extends Vec2 {
  lane: StructureState['lane'];
}
export interface TeamObservation {
  tick: number;
  home: Vec2;
  actors: readonly TeamActor[];
  minions: readonly TeamMinion[];
  enemies: readonly SeenChampion[];
  enemyMinions: readonly Vec2[];
  ownStructures: readonly SeenStructure[];
  enemyStructures: readonly SeenStructure[];
  /** Public map placements and remembered destruction; no hidden health or gates. */
  knownStructures: readonly KnownStructure[];
  scuttlers: readonly (Vec2 & { id: number; hp: number; maxHp: number; attackable: boolean })[];
  /** Remembered intact tower placements, including towers currently under fog. */
  towers: readonly (Vec2 & { range: number })[];
  gone: ReadonlySet<number>;
}
const structureOrder: Record<StructureState['role'], number> = {
  'outer-turret': 0,
  'inner-turret': 1,
  'inhibitor-turret': 2,
  inhibitor: 3,
  'nexus-turret': 4,
  nexus: 5,
};
/** Inputs contain team knowledge only. No World, opponent orders/cooldowns,
 * hidden populations or actual neutral respawn schedules enter this policy. */
export function planTeam(previous: readonly TeamGoal[], o: TeamObservation): TeamGoal[] {
  const proposals = new Map<number, TeamGoal[]>();
  const eligible = o.actors.filter((a) => a.controlled && a.available && a.role !== null);
  const offer = (
    a: TeamActor,
    kind: TeamGoalKind,
    targetId: number,
    point: Vec2,
    score: number
  ) => {
    const goal: TeamGoal = {
      unitId: a.id,
      kind,
      targetId,
      point: { x: point.x, y: point.y },
      issuedTick: o.tick,
      observedTick: o.tick,
      expiresTick: o.tick + P.memoryTicks,
      score,
    };
    const list = proposals.get(a.id) ?? [];
    list.push(goal);
    proposals.set(a.id, list);
  };
  for (const s of o.ownStructures) {
    const enemies = o.enemies.filter((e) => distance(e, s) < 1200),
      wave = o.enemyMinions.filter((m) => distance(m, s) < 1000);
    const friends = o.actors.filter((a) => distance(a, s) < 1200 && a.hp / a.maxHp > 0.35);
    const base = s.kind !== 'turret';
    if (
      !(enemies.length || wave.length >= 4) ||
      (!base && s.hp / s.maxHp > 0.7 && enemies.length <= friends.length && wave.length < 6)
    )
      continue;
    const responders = eligible
      .filter((a) => a.hp / a.maxHp > 0.3 && distance(a, s) <= P.defendRadius)
      .sort(
        (a, b) =>
          distance(a, s) +
            (a.clearing && !base ? 2000 : 0) -
            distance(b, s) -
            (b.clearing && !base ? 2000 : 0) || a.id - b.id
      )
      .slice(0, base ? 4 : 2);
    for (const a of responders)
      offer(
        a,
        'defend',
        s.id,
        s,
        220 +
          (base ? 100 : 0) +
          (1 - s.hp / s.maxHp) * 30 +
          enemies.length * 10 +
          wave.length -
          distance(a, s) / 300
      );
  }
  for (const s of o.enemyStructures) {
    if (!s.attackable) continue;
    const cover = o.minions.filter((m) => distance(m, s) < Math.max(900, s.range + 100));
    const allies = o.actors.filter((a) => distance(a, s) < 1800 && a.hp / a.maxHp > 0.4);
    if ((s.kind === 'turret' && !cover.length) || !allies.length) continue;
    const hostile = o.enemies
      .filter((e) => distance(e, s) < 1400)
      .reduce((v, e) => v + botCombatStrength(e), 0);
    const friendly = allies.reduce((v, a) => v + botCombatStrength(a), 0);
    if (hostile > friendly * 1.1) continue;
    const away = direction(s, o.home),
      point = { x: s.x + away.x * 900, y: s.y + away.y * 900 };
    for (const a of eligible) {
      if (
        a.clearing ||
        a.level < 3 ||
        a.hp / a.maxHp < 0.45 ||
        distance(a, s) > (a.role === 'jungle' ? P.pushRadius : 1800)
      )
        continue;
      offer(
        a,
        'push',
        s.id,
        point,
        110 +
          (s.kind === 'nexus' ? 60 : s.kind === 'inhibitor' ? 30 : 0) +
          (1 - s.hp / s.maxHp) * 20 +
          cover.length -
          distance(a, s) / 250
      );
    }
  }
  // Own wave positions and public map geometry can guide a rotation before the
  // next structure is visible. Actual structure targeting still requires sight.
  const lanes = [...new Set(o.minions.flatMap((m) => (m.lane === null ? [] : [m.lane])))].sort();
  for (const lane of lanes) {
    const objective = o.knownStructures
      .filter((s) => !s.knownDestroyed && (s.lane === lane || s.lane === null))
      .sort(
        (a, b) =>
          structureOrder[a.role] - structureOrder[b.role] ||
          distance(a, o.home) - distance(b, o.home) ||
          a.id - b.id
      )[0];
    if (!objective) continue;
    const wave = o.minions.filter((m) => m.lane === lane);
    const fronts = wave
      .filter((m) => distance(m, objective) <= P.advance.structureRadius)
      .sort((a, b) => distance(a, objective) - distance(b, objective) || a.x - b.x || a.y - b.y);
    const front = fronts.find(
      (m) =>
        wave.filter((other) => distance(other, m) <= P.advance.waveClusterRadius).length >=
        P.advance.minimumWaveUnits
    );
    if (!front) continue;
    const cover = wave.filter((m) => distance(m, front) <= P.advance.waveClusterRadius);
    const away = direction(front, o.home);
    const point = {
      x: front.x + away.x * P.advance.stagingDistance,
      y: front.y + away.y * P.advance.stagingDistance,
    };
    if (
      o.towers.some(
        (t) =>
          distance(t, point) < t.range + P.towerMargin &&
          !o.minions.some((m) => distance(m, t) <= t.range + 100)
      )
    )
      continue;
    const hostile = o.enemies
      .filter((e) => distance(e, front) < 1400)
      .reduce((sum, e) => sum + botCombatStrength(e), 0);
    for (const a of eligible) {
      const radius =
        objective.lane === null || objective.kind === 'inhibitor'
          ? P.advance.baseJoinRadius
          : P.advance.joinRadius;
      if (
        a.clearing ||
        // Keep an unfinished jungler on its economy loop for ordinary towers.
        // A public base-ending wave remains an opportunity for every role.
        (a.role === 'jungle' &&
          !a.companionComplete &&
          objective.lane !== null &&
          objective.kind !== 'inhibitor') ||
        a.level < P.advance.minLevel ||
        a.hp / a.maxHp < P.advance.minimumHpFraction ||
        distance(a, point) > radius
      )
        continue;
      const friendly =
        botCombatStrength(a) +
        o.actors
          .filter(
            (f) => f.id !== a.id && f.available && f.hp / f.maxHp > 0.4 && distance(f, front) < 1400
          )
          .reduce((sum, f) => sum + botCombatStrength(f), 0);
      if (hostile > friendly * 0.85) continue;
      offer(
        a,
        'advance',
        objective.id,
        point,
        70 +
          (objective.kind === 'nexus' ? 40 : objective.kind === 'inhibitor' ? 20 : 0) +
          Math.min(cover.length, 6) * 2 -
          distance(a, point) / 600
      );
    }
  }
  for (const a of eligible.filter(
    (a) => a.role === 'jungle' && !a.clearing && a.hp / a.maxHp >= 0.45
  )) {
    if (a.level >= 3)
      for (const enemy of o.enemies) {
        if (
          distance(a, enemy) > P.gankRadius ||
          o.towers.some((t) => distance(t, enemy) < t.range + P.towerMargin + 100)
        )
          continue;
        const allies = o.actors.filter(
          (f) =>
            f.id !== a.id &&
            f.role !== 'jungle' &&
            distance(f, enemy) < 1000 &&
            f.hp / f.maxHp > 0.35
        );
        if (!allies.length) continue;
        const hostile = o.enemies
          .filter((e) => distance(e, enemy) < 1200)
          .reduce((v, e) => v + botCombatStrength(e), 0);
        const friendly =
          botCombatStrength(a) + allies.reduce((v, f) => v + botCombatStrength(f), 0);
        if (friendly < hostile * 1.15) continue;
        offer(
          a,
          'gank',
          enemy.id,
          enemy,
          80 + (1 - enemy.hp / enemy.maxHp) * 35 + allies.length * 5 - distance(a, enemy) / 180
        );
      }
    if (a.level >= 2)
      for (const crab of o.scuttlers) {
        if (!crab.attackable || distance(a, crab) > P.riverRadius) continue;
        const hostile = o.enemies
          .filter((e) => distance(e, crab) < 1200)
          .reduce((v, e) => v + botCombatStrength(e), 0);
        const friendly = o.actors
          .filter((f) => f.id === a.id || distance(f, crab) < 1000)
          .reduce((v, f) => v + botCombatStrength(f), 0);
        if (hostile > friendly * 0.85) continue;
        offer(
          a,
          'river',
          crab.id,
          crab,
          60 + (1 - crab.hp / crab.maxHp) * 10 - distance(a, crab) / 200
        );
      }
  }
  const seen = new Set(
    [...o.enemies, ...o.ownStructures, ...o.enemyStructures, ...o.scuttlers].map((t) => t.id)
  );
  const result: TeamGoal[] = [];
  for (const a of eligible) {
    const options = (proposals.get(a.id) ?? []).sort(
      (a, b) => b.score - a.score || a.targetId - b.targetId || a.kind.localeCompare(b.kind)
    );
    let chosen = options[0];
    const old = previous.find(
      (g) => g.unitId === a.id && g.expiresTick > o.tick && !o.gone.has(g.targetId)
    );
    const renewed = old && options.find((g) => g.kind === old.kind && g.targetId === old.targetId);
    const retained =
      renewed ??
      (old && old.kind !== 'advance' && !seen.has(old.targetId) && a.hp / a.maxHp >= 0.45
        ? old
        : undefined);
    if (
      retained &&
      (!chosen || (chosen.kind !== 'defend' && chosen.score < retained.score * P.retargetRatio))
    )
      chosen = retained;
    if (chosen)
      result.push({
        ...chosen,
        point: { ...chosen.point },
        issuedTick:
          old && old.kind === chosen.kind && old.targetId === chosen.targetId
            ? old.issuedTick
            : chosen.issuedTick,
      });
  }
  return result;
}
