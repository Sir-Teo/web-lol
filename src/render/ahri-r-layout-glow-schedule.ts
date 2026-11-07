import data from '../content/ahri-r-particles.json';

export const AHRI_R_LAYOUT_GLOW_BIRTH_POLICY = {
  hz: 60,
  firstUpdateTick: 1,
  intervalTicks: 8,
  maximumUpdateTick: 60_000_000_000,
  clockErrorBoundSeconds: 2 ** -20,
  maximumLife: Math.fround(2 * Math.fround(1.2)),
  identity: 'absolute local update tick and slot; not native pool/RNG identity',
  cessation: 'observed buff producer; numerical seek domain is not an emitter lifetime',
  nativeConstructorVerified: false,
} as const;
const p = data.profiles[53];
if (
  p.system !== 'Ahri_R_Ready_tar' ||
  p.name !== 'Glow_Add1' ||
  p.kind !== 'billboard' ||
  p.single ||
  p.emitterLife !== null ||
  p.period !== null ||
  p.timeActiveDuringPeriod !== null ||
  p.delay !== -0.5 ||
  p.rate.authoredKeyCount !== 0 ||
  p.rate.constant.length !== 1 ||
  p.rate.constant[0] !== 8 ||
  p.rate.probabilities.length !== 0 ||
  p.life.constant.length !== 1 ||
  p.life.constant[0] !== 2 ||
  p.life.authoredKeyCount !== 1 ||
  p.life.times.length !== 1 ||
  p.life.times[0] !== 0 ||
  p.life.values.length !== 1 ||
  p.life.values[0].length !== 1 ||
  p.life.values[0][0] !== 2 ||
  p.life.probabilities.length !== 1 ||
  p.life.probabilities[0].times.join(',') !== '0,1' ||
  p.life.probabilities[0].values.length !== 2 ||
  p.life.probabilities[0].values[0] !== Math.fround(0.7) ||
  p.life.probabilities[0].values[1] !== Math.fround(1.2) ||
  p.life.probabilities[0].single !== 1 ||
  [...p.bindingRequirements].sort().join(',') !== 'emitter-lifetime,soft-depth-input'
)
  throw Error('R continuous layout glow source closure differs');

export interface RLayoutGlowBirthEvent {
  ordinal: number;
  time: number;
  share: number;
  phase: number;
  updateTick: number;
}
/** In the selected 60 Hz kernel, the first update forces one birth. Afterwards
 * 7/60 * 8 < 1 and 8/60 * 8 > 1, with margins over 0.06. Within the explicit
 * one-billion-second numerical domain, rounded clock subtraction error is less
 * than 2^-20 seconds, so it cannot change either count decision. Thus induction
 * gives one birth every eight updates, without inventing periodic resets.
 * The infinite emission window has phase zero; the negative delay is already
 * active at the first local update. Stop ownership remains with the caller. */
export function rLayoutGlowBirthEvents(wholeTick: number): RLayoutGlowBirthEvent[] {
  const policy = AHRI_R_LAYOUT_GLOW_BIRTH_POLICY;
  if (!Number.isSafeInteger(wholeTick) || wholeTick < 0 || wholeTick > policy.maximumUpdateTick)
    throw RangeError('Invalid continuous layout glow update');
  const retained = Math.ceil(policy.maximumLife * policy.hz) + 1,
    earliest = Math.max(policy.firstUpdateTick, wholeTick - retained),
    first = 1 + Math.ceil((earliest - 1) / policy.intervalTicks) * policy.intervalTicks,
    events: RLayoutGlowBirthEvent[] = [];
  for (let tick = first; tick <= wholeTick; tick += policy.intervalTicks)
    events.push({ ordinal: tick * 2, time: tick / 60, share: 1, phase: 0, updateTick: tick });
  return events;
}
