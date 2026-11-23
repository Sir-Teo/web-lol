import { AHRI_E_POLICY } from './ahri-e-policy';
import { ASHE_CASTS } from './ashe-casting';
import durations from './champion-clip-durations.json';
import { GAREN_R } from './garen-r';
import { GAREN_R_ANIMATION_CONTACT, GAREN_R_WINDUP_TICKS } from './garen-r-policy';
import { MILESTONE6_CHAMPION_CLIP_DURATIONS } from './milestone6-champions';
import { TICK_RATE } from './rules';
import { isOriginalChampion, ORIGINAL_CHAMPION_DURATIONS } from './original-lineup';
import type { ChampionIdentity } from '../simulation/types';

const allClipDurations: Readonly<Record<ChampionIdentity, Readonly<Record<string, number>>>> = {
  ...durations,
  ...MILESTONE6_CHAMPION_CLIP_DURATIONS,
  ...ORIGINAL_CHAMPION_DURATIONS,
};

export function castAnimationName(
  champion: ChampionIdentity | undefined,
  ability: 'q' | 'w' | 'e' | 'r'
) {
  if (champion === 'garen' && ability === 'r') return GAREN_R.animationClip;
  if (champion === 'ahri' && ability === 'r') return 'spell4';
  if (champion === 'ahri' && ability === 'e') return AHRI_E_POLICY.bodyClip;
  if (champion === 'ahri' && (ability === 'q' || ability === 'w'))
    return ability === 'q' ? 'spell1' : 'spell2';
  if (
    isOriginalChampion(champion) ||
    champion === 'leona' ||
    champion === 'darius' ||
    champion === 'vi' ||
    champion === 'ezreal' ||
    champion === 'morgana'
  )
    return ({ q: 'spell1', w: 'spell2', e: 'spell3', r: 'spell4' } as const)[ability];
  if (ability === 'q') return 'spell1';
  if (champion === 'lux' && (ability === 'w' || ability === 'e'))
    return ability === 'w' ? 'spell2' : 'spell3';
  return ASHE_CASTS[ability].animation;
}
export function castAnimationDuration(champion: ChampionIdentity, ability: 'q' | 'w' | 'e' | 'r') {
  const value = allClipDurations[champion]?.[castAnimationName(champion, ability)];
  if (!Number.isFinite(value)) throw new Error(`Missing ${champion} cast animation: ${ability}`);
  if (champion === 'garen' && ability === 'r')
    return value - GAREN_R_ANIMATION_CONTACT + GAREN_R_WINDUP_TICKS / TICK_RATE;
  return value;
}
