import { CHAMPION_KILL_XP } from '../content/champion-kill-xp';
import { experienceToNextLevel, MAX_LEVEL } from './progression';

export interface ExperiencePosition {
  level: number;
  xp: number;
}
const decimalLevel = (state: ExperiencePosition) =>
  state.level + (state.level < MAX_LEVEL ? state.xp / experienceToNextLevel(state.level) : 0);

/** Pure payout from pre-award levels. Sharing and fractional-level policies are documented. */
export function championKillExperience(
  victim: ExperiencePosition,
  recipient: ExperiencePosition,
  recipientCount: number
): number {
  if (!Number.isInteger(recipientCount) || recipientCount < 1) return 0;
  const base = CHAMPION_KILL_XP.baseByVictimLevel[victim.level - 1];
  const shared =
    recipientCount > 1
      ? CHAMPION_KILL_XP.sharedMultiplierByLevel[
          Math.min(victim.level, CHAMPION_KILL_XP.sharedMultiplierByLevel.length) - 1
        ]
      : 1;
  const difference = decimalLevel(victim) - decimalLevel(recipient);
  const modifier =
    difference >= 0
      ? 1 + Math.max(0, difference - 1) * CHAMPION_KILL_XP.levelDifferenceMultiplier
      : Math.max(
          0.4,
          1 - Math.max(0, -difference - 1) * CHAMPION_KILL_XP.levelDifferenceMultiplier
        );
  return (base * shared * modifier) / recipientCount;
}
