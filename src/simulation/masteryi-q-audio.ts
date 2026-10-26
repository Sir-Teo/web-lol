import {
  MASTER_YI_Q_CAST_AUDIO_TICKS,
  MASTER_YI_Q_HIT_AUDIO_TICKS,
} from '../content/masteryi-q-audio-timing';
import { ALPHA_CONTACT_HISTORY_TICKS } from '../content/masteryi-q-contact-timing';
import { ALPHA_MARK_TICKS, type AlphaStrikeMark } from './masteryi-alpha-strike';
import { isStructureKind, type ChampionState, type Faction, type Unit, type Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export interface AlphaAudioContact {
  tick: number;
  markTick: number;
  markIndex: number;
  repeatIndex: number;
  targetId: number;
  targetTeam: Faction;
  point: Vec2;
  audience: Team[];
}
export interface AlphaAudioRecord {
  startTick: number;
  rank: number;
  primaryTargetId: number;
  primaryTargetTeam: Faction;
  origin: Vec2;
  castAudience: Team[];
  contacts: AlphaAudioContact[];
}
export function alphaAudioExpiry(record: AlphaAudioRecord): number {
  return Math.max(
    record.startTick + MASTER_YI_Q_CAST_AUDIO_TICKS,
    ...record.contacts.map((c) => c.tick + MASTER_YI_Q_HIT_AUDIO_TICKS)
  );
}

/** Local accepted-cast creation of the declared Q_Cas sound, independently of
 * asset availability. Source script dispatch and native game-object motion are unobserved. */
export function beginAlphaAudio(world: World, unit: Unit, target: Unit): void {
  const owner = world.championState(unit.id)!,
    q = owner.alphaStrike!;
  owner.alphaAudio.push({
    startTick: q.startTick,
    rank: q.rank,
    primaryTargetId: target.id,
    primaryTargetTeam: target.team,
    origin: { ...q.origin },
    castAudience: (['blue', 'red'] as const).filter((team) => world.visible(unit, team)),
    contacts: [],
  });
}

/** Only ordinary Q_Tar declares an on-create sound. Preserve the critical
 * system's omission; do not infer another hit callback from its name. */
export function contactAlphaAudio(
  world: World,
  unit: Unit,
  target: Unit,
  mark: AlphaStrikeMark
): void {
  if (mark.critical) return;
  const owner = world.championState(unit.id),
    q = owner?.alphaStrike;
  if (!owner || !q) return;
  const r = owner.alphaAudio.find((r) => r.startTick === q.startTick),
    index = q.marks.indexOf(mark);
  if (!r || index < 0) return;
  r.contacts.push({
    tick: world.tick,
    markTick: mark.tick,
    markIndex: index,
    repeatIndex: mark.repeatIndex,
    targetId: target.id,
    targetTeam: target.team,
    point: { x: target.x, y: target.y },
    audience: (['blue', 'red'] as const).filter((team) => world.visible(target, team)),
  });
  r.contacts.sort((a, b) => a.tick - b.tick || a.markIndex - b.markIndex);
}

export function validateAlphaAudio(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number; nextId: number; units: Unit[] }
): void {
  let previous = -1;
  for (const r of owner.alphaAudio) {
    const primary = world.units.find((u) => u.id === r.primaryTargetId),
      q = owner.alphaStrike;
    if (
      unit.champion !== 'masteryi' ||
      r.startTick <= previous ||
      r.startTick > world.tick ||
      r.rank > owner.spellRanks.q ||
      r.primaryTargetId >= world.nextId ||
      r.primaryTargetId === unit.id ||
      r.primaryTargetTeam === unit.team ||
      !r.castAudience.includes(unit.team as Team) ||
      world.tick >= alphaAudioExpiry(r) ||
      (primary &&
        (primary.team !== r.primaryTargetTeam ||
          isStructureKind(primary.kind) ||
          primary.kind === 'ward')) ||
      (q?.startTick === r.startTick &&
        (q.rank !== r.rank ||
          q.primaryTargetId !== r.primaryTargetId ||
          q.origin.x !== r.origin.x ||
          q.origin.y !== r.origin.y))
    )
      throw Error('Saved match contains invalid Alpha Strike audio history.');
    const seen = new Set<number>();
    let before: AlphaAudioContact | undefined;
    for (const c of r.contacts) {
      const target = world.units.find((u) => u.id === c.targetId),
        mark = q?.startTick === r.startTick ? q.marks[c.markIndex] : undefined;
      const visual = owner.alphaContactVisuals.find(
        (v) => v.castTick === r.startTick && v.markIndex === c.markIndex
      );
      if (
        seen.has(c.markIndex) ||
        c.markTick !== r.startTick + (c.markIndex + 1) * ALPHA_MARK_TICKS ||
        c.repeatIndex > c.markIndex ||
        c.tick < c.markTick ||
        c.tick > r.startTick + 4 * ALPHA_MARK_TICKS ||
        (c.tick - r.startTick) % ALPHA_MARK_TICKS !== 0 ||
        c.tick > world.tick ||
        (c.repeatIndex > 0 && c.tick !== c.markTick) ||
        c.targetId >= world.nextId ||
        c.targetId === unit.id ||
        c.targetTeam === unit.team ||
        (target &&
          (target.team !== c.targetTeam ||
            isStructureKind(target.kind) ||
            target.kind === 'ward')) ||
        !c.audience.includes(unit.team as Team) ||
        (c.targetTeam !== 'neutral' && !c.audience.includes(c.targetTeam)) ||
        (before &&
          (c.tick < before.tick || (c.tick === before.tick && c.markIndex <= before.markIndex))) ||
        (q?.startTick === r.startTick &&
          (!mark ||
            mark.result !== 'hit' ||
            mark.critical ||
            mark.targetId !== c.targetId ||
            mark.tick !== c.markTick ||
            mark.repeatIndex !== c.repeatIndex ||
            c.tick !== (c.repeatIndex > 0 ? c.markTick : q.reappearTick))) ||
        (world.tick < c.tick + ALPHA_CONTACT_HISTORY_TICKS &&
          (!visual ||
            visual.critical ||
            visual.tick !== c.tick ||
            visual.targetId !== c.targetId ||
            visual.targetTeam !== c.targetTeam ||
            visual.point.x !== c.point.x ||
            visual.point.y !== c.point.y ||
            JSON.stringify(visual.audience) !== JSON.stringify(c.audience)))
      )
        throw Error('Saved match contains invalid Alpha Strike hit audio.');
      seen.add(c.markIndex);
      before = c;
    }
    if (q?.startTick === r.startTick)
      q.marks.forEach((mark, index) => {
        if (mark.result === 'hit' && !mark.critical && !seen.has(index))
          throw Error('Saved match lacks an ordinary Alpha Strike hit cue.');
      });
    previous = r.startTick;
  }
  const q = owner.alphaStrike;
  if (q && !owner.alphaAudio.some((r) => r.startTick === q.startTick))
    throw Error('Saved match lacks its Alpha Strike cast cue.');
  for (const visual of owner.alphaContactVisuals) {
    const r = owner.alphaAudio.find((r) => r.startTick === visual.castTick);
    const contact = r?.contacts.find((c) => c.markIndex === visual.markIndex);
    if (!r || (visual.critical ? !!contact : !contact))
      throw Error('Saved match contains inconsistent Alpha Strike sound binding.');
  }
}
