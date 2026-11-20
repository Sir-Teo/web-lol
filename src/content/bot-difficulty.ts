/** Configurable bot reaction cadence and skillshot aim limits (DESIGN.md §11). */
export const BOT_DIFFICULTIES = {
  intro: {
    id: 'intro',
    name: 'Intro',
    description: '450 ms reaction cadence and wider skillshot aim dispersion.',
    thinkTicks: 27,
    aimSpreadUnits: 110,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: '300 ms reaction cadence and direct observed-target aim.',
    thinkTicks: 18,
    aimSpreadUnits: 0,
  },
} as const;

export type BotDifficulty = keyof typeof BOT_DIFFICULTIES;
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'standard';

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && Object.hasOwn(BOT_DIFFICULTIES, value);
}
