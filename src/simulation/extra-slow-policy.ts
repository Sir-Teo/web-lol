import { DRAGON_SLAYER_BUFFS } from '../content/epic-objectives';
import { DARIUS_KIT, MORGANA_KIT } from '../content/milestone6-champions';

export const EXTRA_SLOW_POLICY = {
  'crippling-strike': {
    champion: 'darius',
    delay: 0,
    duration: DARIUS_KIT.w.slowTicks,
    multiplier: DARIUS_KIT.w.slowMultiplier,
  },
  apprehend: {
    champion: 'darius',
    delay: DARIUS_KIT.e.stunTicks,
    duration: DARIUS_KIT.e.slowTicks,
    multiplier: DARIUS_KIT.e.slowMultiplier,
  },
  'soul-shackles': {
    champion: 'morgana',
    delay: 0,
    duration: MORGANA_KIT.r.durationTicks,
    multiplier: MORGANA_KIT.r.slowMultiplier,
  },
  'hextech-soul': {
    champion: null,
    delay: 0,
    duration: DRAGON_SLAYER_BUFFS.hextechSoulSlowTicks,
    multiplier: DRAGON_SLAYER_BUFFS.hextechSoulSlowMultiplier,
  },
} as const;

export type ExtraSlowKind = keyof typeof EXTRA_SLOW_POLICY;

export function isExtraSlowKind(kind: string): kind is ExtraSlowKind {
  return Object.hasOwn(EXTRA_SLOW_POLICY, kind);
}
