import { ASHE_CASTS } from './ashe-casting';
import durations from './champion-clip-durations.json';
export function castAnimationName(
  champion: 'ashe' | 'lux' | 'garen' | undefined,
  ability: 'q' | 'w' | 'e' | 'r'
) {
  if (ability === 'q') return 'spell1';
  if (champion === 'lux' && (ability === 'w' || ability === 'e'))
    return ability === 'w' ? 'spell2' : 'spell3';
  return ASHE_CASTS[ability].animation;
}
export function castAnimationDuration(
  champion: 'ashe' | 'lux' | 'garen',
  ability: 'q' | 'w' | 'e' | 'r'
) {
  const value = (durations[champion] as Readonly<Record<string, number>>)[
    castAnimationName(champion, ability)
  ];
  if (!Number.isFinite(value)) throw new Error(`Missing ${champion} cast animation: ${ability}`);
  return value;
}
