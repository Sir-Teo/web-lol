import { luxAttackAnimation } from './lux-attack-animation';

/** Frozen graph slots; dispatch/timing and the shared 80ms blend remain local
 * policies until native capture. Attack3 has zero authored probability. */
export const LEONA_RECALL_CLIPS = ['entry_b4dcde19', 'idle3', 'idle1'] as const;
export const LEONA_REQUIRED_CLIPS = [
  'idle1',
  'run',
  'attack1',
  'attack2',
  'crit',
  'death',
  'spell1',
  'spell2',
  'spell2_idle',
  'spell2_run',
  'spell2_attack',
  'spell3',
  'spell4',
  ...LEONA_RECALL_CLIPS,
] as const;
export function leonaAttackAnimation(id: number, tick: number, critical = false, eclipse = false) {
  if (critical) return 'crit';
  if (eclipse) return 'spell2_attack';
  return luxAttackAnimation(id ^ 0x1e0a, tick);
}
