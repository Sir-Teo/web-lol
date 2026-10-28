import type { World } from '../simulation/world';
import type { Unit } from '../simulation/types';

/** F1 is the human; F2–F5 follow the allied order used by the scoreboard. */
export function cameraKeyTarget(world: World, key: string): Unit | null {
  if (!/^f[1-5]$/.test(key)) return null;
  const slot = Number(key[1]) - 1;
  if (slot === 0) return world.hero;
  if (world.matchMode !== 'lanes') return null;
  const allies = world.units
    .filter(
      (unit) =>
        unit.kind === 'champion' && unit.team === world.hero.team && unit.id !== world.player.id
    )
    .sort((a, b) => a.id - b.id);
  return allies[slot - 1] ?? null;
}
