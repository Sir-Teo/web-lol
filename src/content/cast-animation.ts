import { ASHE_CASTS } from './ashe-casting';
import durations from './champion-clip-durations.json';
export function castAnimationName(
  champion: 'ashe' | 'lux' | undefined,
  ability: 'q' | 'w' | 'e' | 'r'
) {
  if (ability === 'q') return 'spell1';
  if (champion === 'lux' && (ability === 'w' || ability === 'e'))
    return ability === 'w' ? 'spell2' : 'spell3';
  return ASHE_CASTS[ability].animation;
}
export function castAnimationDuration(champion: 'ashe' | 'lux', ability: 'q' | 'w' | 'e' | 'r') {
  return durations[champion][castAnimationName(champion, ability)];
}
