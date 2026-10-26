import { ALPHA_CONTACT_HISTORY_TICKS } from '../content/masteryi-q-contact-timing';
import { ALPHA_MARK_TICKS, alphaVanished, type AlphaStrikeMark } from './masteryi-alpha-strike';
import {
  isStructureKind,
  type ChampionState,
  type Unit,
  type Team,
  type Faction,
  type UnitKind,
} from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export interface AlphaContactFrame {
  tick: number;
  point: Vec2;
  audience: Team[];
}
export interface AlphaContactVisual {
  castTick: number;
  rank: number;
  markIndex: number;
  markTick: number;
  repeatIndex: number;
  critical: boolean;
  tick: number;
  targetId: number;
  targetTeam: Faction;
  targetKind: UnitKind;
  point: Vec2;
  audience: Team[];
  radius: number;
  facing: number;
  detachedTick: number | null;
  frames: AlphaContactFrame[];
}

function frame(world: World, target: Unit): AlphaContactFrame {
  const vanished = alphaVanished(world.championState(target.id));
  return {
    tick: world.tick,
    point: { x: target.x, y: target.y },
    audience: (['blue', 'red'] as const).filter((team) => !vanished && world.visible(target, team)),
  };
}

/** Called after contact acceptance, before damage or lethal cleanup. Dispatch,
 * root attachment, collision diameter and facing are explicit local policies. */
export function captureAlphaContact(
  world: World,
  source: Unit,
  target: Unit,
  mark: AlphaStrikeMark
): void {
  const owner = world.championState(source.id),
    q = owner?.alphaStrike;
  if (!owner || !q || source.champion !== 'masteryi') return;
  const markIndex = q.marks.indexOf(mark);
  if (markIndex < 0) return;
  const first = frame(world, target);
  owner.alphaContactVisuals.push({
    castTick: q.startTick,
    rank: q.rank,
    markIndex,
    markTick: mark.tick,
    repeatIndex: mark.repeatIndex,
    critical: mark.critical,
    tick: world.tick,
    targetId: target.id,
    targetTeam: target.team,
    targetKind: target.kind,
    point: { ...first.point },
    audience: [...first.audience],
    radius: target.radius,
    facing: Math.atan2(target.x - source.x, target.y - source.y),
    detachedTick: null,
    frames: [first],
  });
  // The fourth repeated hit resolves before earlier pending marks at reappearance.
  owner.alphaContactVisuals.sort(
    (a, b) => a.tick - b.tick || a.castTick - b.castTick || a.markIndex - b.markIndex
  );
}

export function advanceAlphaContacts(world: World): void {
  for (const unit of world.units) {
    const records = world.championState(unit.id)?.alphaContactVisuals;
    if (!records?.length) continue;
    for (const r of records) {
      if (world.tick >= r.tick + ALPHA_CONTACT_HISTORY_TICKS) continue;
      const target = world.unit(r.targetId),
        previous = r.frames.at(-1)!;
      const current =
        r.detachedTick === null && target
          ? frame(world, target)
          : { ...structuredClone(previous), tick: world.tick };
      if (
        target &&
        !world.alive(target) &&
        world.tick === r.tick &&
        current.point.x === r.point.x &&
        current.point.y === r.point.y
      )
        current.audience = [...r.audience];
      if (r.detachedTick === null && (!target || !world.alive(target))) r.detachedTick = world.tick;
      if (previous.tick === world.tick) r.frames[r.frames.length - 1] = current;
      else r.frames.push(current);
    }
  }
}

export function validateAlphaContacts(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; nextId: number; units: Unit[] }
): void {
  let previous: AlphaContactVisual | undefined;
  const keys = new Set<string>();
  for (const r of owner.alphaContactVisuals) {
    const target = world.units.find((u) => u.id === r.targetId),
      q = owner.alphaStrike;
    const mark = q?.startTick === r.castTick ? q.marks[r.markIndex] : undefined;
    const key = `${r.castTick}:${r.markIndex}`;
    if (
      unit.champion !== 'masteryi' ||
      r.rank > owner.spellRanks.q ||
      r.castTick > r.markTick ||
      r.markTick !== r.castTick + (r.markIndex + 1) * ALPHA_MARK_TICKS ||
      r.repeatIndex > r.markIndex ||
      r.tick < r.markTick ||
      r.tick > r.castTick + 4 * ALPHA_MARK_TICKS ||
      (r.tick - r.castTick) % ALPHA_MARK_TICKS !== 0 ||
      (r.repeatIndex > 0 && r.tick !== r.markTick) ||
      r.tick > world.tick ||
      world.tick >= r.tick + ALPHA_CONTACT_HISTORY_TICKS ||
      r.targetId === unit.id ||
      r.targetId >= world.nextId ||
      r.targetTeam === unit.team ||
      isStructureKind(r.targetKind) ||
      r.targetKind === 'ward' ||
      (target &&
        (target.team !== r.targetTeam ||
          target.kind !== r.targetKind ||
          target.radius !== r.radius)) ||
      !r.audience.includes(unit.team as Team) ||
      (r.targetTeam !== 'neutral' && !r.audience.includes(r.targetTeam)) ||
      (r.detachedTick !== null &&
        (r.detachedTick < r.tick ||
          r.detachedTick > world.tick ||
          (target && target.deadAt === null))) ||
      (r.detachedTick === null &&
        (!target ||
          target.hp <= 0 ||
          r.frames.at(-1)!.point.x !== target.x ||
          r.frames.at(-1)!.point.y !== target.y)) ||
      r.frames.length !== world.tick - r.tick + 1 ||
      keys.has(key) ||
      (previous &&
        (r.tick < previous.tick ||
          (r.tick === previous.tick &&
            (r.castTick < previous.castTick ||
              (r.castTick === previous.castTick && r.markIndex <= previous.markIndex))))) ||
      (q?.startTick === r.castTick &&
        (!mark ||
          mark.result !== 'hit' ||
          q.rank !== r.rank ||
          mark.tick !== r.markTick ||
          mark.targetId !== r.targetId ||
          mark.critical !== r.critical ||
          mark.repeatIndex !== r.repeatIndex ||
          r.tick !== (mark.repeatIndex > 0 ? mark.tick : q.reappearTick)))
    )
      throw Error('Saved match contains invalid Alpha Strike contact history.');
    for (let index = 0; index < r.frames.length; index++) {
      const f = r.frames[index],
        before = r.frames[index - 1];
      if (
        f.tick !== r.tick + index ||
        (before &&
          r.detachedTick !== null &&
          f.tick > r.detachedTick &&
          (f.point.x !== before.point.x ||
            f.point.y !== before.point.y ||
            JSON.stringify(f.audience) !== JSON.stringify(before.audience)))
      )
        throw Error('Saved match contains invalid Alpha Strike contact frames.');
    }
    keys.add(key);
    previous = r;
  }
  const q = owner.alphaStrike;
  if (q)
    q.marks.forEach((mark, index) => {
      const tick = mark.repeatIndex > 0 ? mark.tick : q.reappearTick;
      if (
        mark.result === 'hit' &&
        tick !== null &&
        world.tick < tick + ALPHA_CONTACT_HISTORY_TICKS &&
        !keys.has(`${q.startTick}:${index}`)
      )
        throw Error('Saved match lacks an accepted Alpha Strike contact.');
    });
}
