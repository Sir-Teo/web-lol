import { AHRI_SPIRIT_RUSH_AUDIO as SOURCE } from './ahri-spirit-rush-audio';

type Properties = Readonly<Record<string, number>>;
interface Node {
  id: number;
  parentId: number;
  properties: Properties;
  ranges: Readonly<Record<string, readonly number[]>>;
  policy?: Properties;
  playlist?: readonly { id: number; weight: number }[];
  clip?: (typeof SOURCE.sounds)[number]['clip'];
}
const nodes = new Map<number, Node>(
  [...SOURCE.containers, ...SOURCE.sounds, ...SOURCE.mixers].map((n) => [n.id, n])
);
const node = (id: number) => {
  const found = nodes.get(id);
  if (!found) throw Error('Missing Spirit Rush audio node');
  return found;
};
function variant(id: number) {
  const sound = node(id);
  if (!sound.clip) throw Error('Expected Spirit Rush source sound');
  const ancestry: number[] = [];
  let current: Node | undefined = sound,
    gainDb = 0,
    pitchCents = 0,
    minimum = 0,
    maximum = 0,
    draws = 0;
  while (current) {
    if (ancestry.includes(current.id)) throw Error('Cyclic Spirit Rush audio ancestry');
    ancestry.push(current.id);
    gainDb += current.properties.MakeUpGain ?? 0;
    pitchCents += current.properties.Pitch ?? 0;
    if (current.ranges.Pitch) {
      minimum += current.ranges.Pitch[0];
      maximum += current.ranges.Pitch[1];
      draws++;
    }
    current = current.parentId ? node(current.parentId) : undefined;
  }
  if (draws > 1) throw Error('Multiple Spirit Rush pitch draws need a separate policy');
  return {
    ...sound.clip,
    soundId: id,
    ancestry,
    gainDb,
    pitchCents,
    pitchRangeCents: [minimum, maximum] as const,
  };
}
function profile(containerId: number, role: (typeof SOURCE.events)[number]['role']) {
  const container = node(containerId),
    event = SOURCE.events.find((e) => e.role === role)!;
  const action = event.actions.find((a) => a.type === 'CAkActionPlay');
  if (
    action?.target !== containerId ||
    !container.policy ||
    !container.playlist ||
    container.policy.eMode !== 0 ||
    container.playlist.some((p) => p.weight !== 50000)
  )
    throw Error('Changed Spirit Rush play profile');
  const variants = container.playlist.map((p) => variant(p.id));
  const continuous = container.policy.bIsContinuous === 1;
  if (
    continuous &&
    (containerId !== 294973194 ||
      variants.length !== 1 ||
      container.policy.sLoopCount !== 0 ||
      container.policy.eTransitionMode !== 4)
  )
    throw Error('Unsupported Spirit Rush continuous profile');
  return {
    containerId,
    eventId: event.id,
    actionId: action.id,
    variants,
    continuous,
    maxVoices: container.policy.u16MaxNumInstance,
    maximumTicks: continuous
      ? null
      : Math.ceil(
          Math.max(
            ...variants.map(
              (v) => v.durationSeconds / 2 ** ((v.pitchCents + v.pitchRangeCents[0]) / 1200)
            )
          ) * 60
        ),
  };
}
/** Explicit local additive ancestry and full-master activation-cycle policy.
 * Native SampleAccurate transitions, global shuffle, bus and dispatch are unverified. */
export const AHRI_SPIRIT_RUSH_AUDIO_PROFILES = {
  cast: profile(220652520, 'cast'),
  activation: profile(294973194, 'activate'),
  launch: profile(525682343, 'launch'),
  hit: profile(806649894, 'hit'),
  deactivate: profile(598713583, 'deactivate'),
} as const;
export type SpiritRushAudioKind = keyof typeof AHRI_SPIRIT_RUSH_AUDIO_PROFILES;
const event = SOURCE.events.find((e) => e.role === 'stopLaunch')!;
const action = event.actions.find((a) => a.type === 'CAkActionStop')!;
export const AHRI_SPIRIT_RUSH_AUDIO_LAUNCH_STOP = {
  eventId: event.id,
  actionId: action.id,
  targetId: action.target,
  seconds: (action.properties as Record<string, number>).TransitionTime / 1000,
  curve: action.fadeCurve,
} as const;
/** Local release when the saved recast window closes. No native activation Stop
 * event/action or fade is claimed; the separate source deactivation cue still plays. */
export const AHRI_SPIRIT_RUSH_AUDIO_LOCAL_ACTIVATION_STOP = { seconds: 0.02, curve: 4 } as const;
