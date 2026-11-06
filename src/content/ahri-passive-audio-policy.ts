import { AHRI_PASSIVE_AUDIO as SOURCE } from './ahri-passive-audio';

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
  if (!found) throw Error('Missing Passive audio node');
  return found;
};
function variant(id: number) {
  const sound = node(id);
  if (!sound.clip) throw Error('Expected Passive source sound');
  const ancestry: number[] = [];
  let current: Node | undefined = sound,
    gainDb = 0,
    pitchCents = 0,
    minimum = 0,
    maximum = 0,
    draws = 0;
  while (current) {
    if (ancestry.includes(current.id)) throw Error('Cyclic Passive audio ancestry');
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
  if (draws > 1) throw Error('Multiple Passive pitch draws need a separate policy');
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
    throw Error('Changed Passive play profile');
  const variants = container.playlist.map((p) => variant(p.id));
  const continuous = container.policy.bIsContinuous === 1;
  if (continuous || container.policy.sLoopCount !== 1)
    throw Error('Unsupported passive looping profile');
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
/** Explicit local additive ancestry and per-Essence cosmetic playlist policy.
 * Native global playlist state, event dispatch, bus and listener remain unverified. */
export const AHRI_PASSIVE_AUDIO_PROFILES = {
  launch: profile(447547134, 'launch'),
  hit: profile(761154906, 'hit'),
  orbBuffActivate: profile(549126052, 'orbBuffActivate'),
  minionHeal: profile(650258815, 'minionHeal'),
} as const;
export type PassiveAudioKind = keyof typeof AHRI_PASSIVE_AUDIO_PROFILES;
