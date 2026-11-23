export const ORIGINAL_ROSTER =
  'original allied lineup; ten distinct champions; five roles per team' as const;

export const PUBLIC_ROSTER =
  'ten distinct public champions; five roles per team; live Rift objectives' as const;

/** QA composition metadata. No match clock, reward, damage or victory overrides. */
export function cohortProfile(
  developmentLeona: unknown = false,
  developmentRoster: unknown = false,
  originalLineup: unknown = false
) {
  if (
    typeof developmentLeona !== 'boolean' ||
    typeof developmentRoster !== 'boolean' ||
    typeof originalLineup !== 'boolean'
  )
    throw new TypeError('Development cohort flags must be booleans.');
  if (developmentLeona && developmentRoster)
    throw new Error('Choose either --development-leona or --development-roster.');
  if (originalLineup && (developmentLeona || developmentRoster))
    throw new Error('Choose either the original lineup or a development profile.');
  if (originalLineup)
    return {
      playerChampion: 'vess' as const,
      humanRole: 'carry' as const,
      humanLane: 'bot',
      roster: ORIGINAL_ROSTER,
      permissions: { publicRift: true as const },
    };
  if (developmentRoster)
    return {
      playerChampion: 'lux' as const,
      humanRole: 'mid' as const,
      humanLane: 'mid',
      roster: 'two Garen/two Master Yi/two Ashe/two Leona/one Ahri/one Lux; five roles per team',
      permissions: {
        developmentRosterBots: true as const,
        developmentGaren: true as const,
        developmentLeona: true as const,
        developmentMasterYiRift: true as const,
        developmentMasterYiBots: true as const,
        developmentAhriRift: true as const,
        developmentAhriBots: true as const,
      },
    };
  if (developmentLeona)
    return {
      playerChampion: 'leona' as const,
      humanRole: 'support' as const,
      humanLane: 'bot',
      roster: 'six Ashe/three Lux/one Leona; five roles per team',
      permissions: { developmentLeona: true as const },
    };
  return {
    playerChampion: 'ashe' as const,
    humanRole: 'carry' as const,
    humanLane: 'bot',
    roster: PUBLIC_ROSTER,
    permissions: { publicRift: true as const },
  };
}
