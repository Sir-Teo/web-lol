import { SWORD_GLOW_TAIL_TICKS } from '../content/masteryi-sword-timing';
import { alphaVanished } from './masteryi-alpha-strike';
import { appendActorRoot, validateActorRoots, type ActorRootRun } from './actor-root-history';
import type { ChampionState, Unit, Team } from './types';
import type { World } from './world';
export type SwordCondition = 0 | 1;
export interface SwordGlowVisual {
  condition: SwordCondition;
  castTick: number;
  frames: ActorRootRun[];
}
/** Skin condition zero tests the active E child; condition one tests Highlander. */
export function swordGlowAudio(owner: ChampionState, condition: SwordCondition) {
  return condition === 0 ? owner.wujuStyleAudio : owner.highlanderAudio;
}
export function swordGlowExpiry(owner: ChampionState, record: SwordGlowVisual): number {
  const audio = swordGlowAudio(owner, record.condition).find(
    (a) => a.startTick === record.castTick
  );
  if (!audio) throw Error('Sword glow lacks its accepted buff history');
  return audio.stop === null ? Infinity : audio.stop.tick + SWORD_GLOW_TAIL_TICKS;
}
function frame(world: World, unit: Unit) {
  return {
    tick: world.tick,
    x: unit.x,
    y: unit.y,
    facing: unit.facing,
    audience: (['blue', 'red'] as const).filter(
      (t) => !alphaVanished(world.championState(unit.id)) && world.visible(unit, t)
    ),
  };
}
export function captureSwordGlow(world: World, unit: Unit, condition: SwordCondition): void {
  const owner = world.championState(unit.id)!;
  if (unit.champion !== 'masteryi') return;
  const frames: ActorRootRun[] = [];
  appendActorRoot(frames, frame(world, unit));
  owner.swordGlowVisuals.push({ condition, castTick: world.tick, frames });
  owner.swordGlowVisuals.sort((a, b) => a.castTick - b.castTick || a.condition - b.condition);
}
/** All source particles are fully bound/local. Keep only the finite live-birth
 * visibility window; current animation supplies the complete posed joint frame. */
export function advanceSwordGlows(world: World): void {
  for (const unit of world.units) {
    if (unit.champion !== 'masteryi') continue;
    const owner = world.championState(unit.id)!;
    for (const r of owner.swordGlowVisuals) {
      if (world.tick >= swordGlowExpiry(owner, r)) continue;
      appendActorRoot(r.frames, frame(world, unit));
      const first = Math.max(r.castTick, world.tick - SWORD_GLOW_TAIL_TICKS + 1);
      while (r.frames[0].endTick < first) r.frames.shift();
      r.frames[0].tick = Math.max(first, r.frames[0].tick);
    }
  }
}
export function validateSwordGlows(
  owner: ChampionState,
  unit: Unit,
  world: { tick: number }
): void {
  let previous: SwordGlowVisual | undefined;
  for (const r of owner.swordGlowVisuals) {
    const audio = swordGlowAudio(owner, r.condition).find((a) => a.startTick === r.castTick),
      last = r.frames.at(-1)!;
    if (
      unit.champion !== 'masteryi' ||
      !audio ||
      r.castTick > world.tick ||
      world.tick >= swordGlowExpiry(owner, r) ||
      (previous &&
        (r.castTick < previous.castTick ||
          (r.castTick === previous.castTick && r.condition <= previous.condition))) ||
      last.x !== unit.x ||
      last.y !== unit.y ||
      last.facing !== unit.facing ||
      (alphaVanished(owner)
        ? last.audience.length !== 0
        : !last.audience.includes(unit.team as Team))
    )
      throw Error('Saved match contains invalid sword glow history');
    validateActorRoots(
      r.frames,
      Math.max(r.castTick, world.tick - SWORD_GLOW_TAIL_TICKS + 1),
      world.tick
    );
    previous = r;
  }
  for (const condition of [0, 1] as const)
    for (const audio of swordGlowAudio(owner, condition))
      if (
        (audio.stop === null || world.tick < audio.stop.tick + SWORD_GLOW_TAIL_TICKS) &&
        !owner.swordGlowVisuals.some(
          (r) => r.condition === condition && r.castTick === audio.startTick
        )
      )
        throw Error('Saved match lacks its accepted sword glow');
}
