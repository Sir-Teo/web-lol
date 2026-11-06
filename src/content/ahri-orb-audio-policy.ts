import { AHRI_ORB_AUDIO as SOURCE } from './ahri-orb-audio';

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
  [...SOURCE.containers, ...SOURCE.sounds, ...SOURCE.mixers].map((node) => [node.id, node])
);
const node = (id: number) => {
  const found = nodes.get(id);
  if (!found) throw new Error('Missing source Orb audio node');
  return found;
};
function variant(soundId: number) {
  const sound = node(soundId);
  if (!sound.clip) throw new Error('Orb profile must select a source sound');
  const ancestry: number[] = [];
  let current: Node | undefined = sound;
  let gainDb = 0,
    pitchCents = 0,
    minimum = 0,
    maximum = 0,
    modifiers = 0;
  while (current) {
    if (ancestry.includes(current.id)) throw new Error('Cyclic Orb audio ancestry');
    ancestry.push(current.id);
    gainDb += current.properties.MakeUpGain ?? 0;
    pitchCents += current.properties.Pitch ?? 0;
    const range = current.ranges.Pitch;
    if (range) {
      minimum += range[0];
      maximum += range[1];
      modifiers++;
    }
    current = current.parentId ? node(current.parentId) : undefined;
  }
  if (modifiers > 1) throw new Error('Multiple Orb pitch draws need separate local policy');
  return {
    ...sound.clip,
    soundId,
    ancestry,
    gainDb,
    pitchCents,
    pitchRangeCents: [minimum, maximum] as const,
  };
}
function profile(
  containerId: number,
  rootId: number,
  role: (typeof SOURCE.events)[number]['role']
) {
  const container = node(containerId),
    root = node(rootId);
  const event = SOURCE.events.find((e) => e.role === role)!;
  const action = event.actions.find((a) => a.type === 'CAkActionPlay');
  if (!container.playlist || !container.policy || !root.policy || action?.target !== rootId)
    throw new Error('Changed Orb play profile');
  if (container.policy.eMode !== 0 || container.playlist.some((item) => item.weight !== 50000))
    throw new Error('Orb leaf profile requires the retained equal-weight random playlist');
  const variants = container.playlist.map((item) => variant(item.id));
  const maximumSeconds = Math.max(
    ...variants.map((v) => v.durationSeconds / 2 ** ((v.pitchCents + v.pitchRangeCents[0]) / 1200))
  );
  return {
    containerId,
    rootId,
    eventId: event.id,
    actionId: action.id,
    variants,
    maxVoices: container.policy.u16MaxNumInstance,
    rootMaxVoices: root.policy.u16MaxNumInstance,
    maximumTicks: Math.ceil(maximumSeconds * 60),
  };
}
/** Local additive gain/pitch reading of retained actor ancestry. Global bus,
 * native inheritance, virtualization and cross-owner playlist state are not
 * certified. Per-cast hit order uses the source sequence, wrapping at seven. */
export const AHRI_ORB_AUDIO_PROFILES = {
  cast: profile(838875043, 838875043, 'cast'),
  outward: profile(1069572417, 1069572417, 'outward'),
  return: profile(190978732, 190978732, 'return'),
  hitOutwardFirst: profile(914991319, 910996742, 'hitOutward'),
  hitOutwardLater: profile(439670778, 910996742, 'hitOutward'),
  hitReturnFirst: profile(395437231, 1066170488, 'hitReturn'),
  hitReturnLater: profile(178405558, 1066170488, 'hitReturn'),
  deactivate: profile(755654114, 755654114, 'deactivate'),
} as const;
export type OrbAudioKind = keyof typeof AHRI_ORB_AUDIO_PROFILES;
export function orbHitAudioKind(leg: 'outward' | 'return', ordinal: number): OrbAudioKind {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0)
    throw new RangeError('Invalid Orb hit ordinal');
  const root = node(leg === 'outward' ? 910996742 : 1066170488);
  const child = root.playlist![ordinal % root.playlist!.length].id;
  if (leg === 'outward') return child === 914991319 ? 'hitOutwardFirst' : 'hitOutwardLater';
  return child === 395437231 ? 'hitReturnFirst' : 'hitReturnLater';
}
function stop(role: 'stopOutward' | 'stopReturn') {
  const action = SOURCE.events.find((e) => e.role === role)!.actions[0];
  const seconds = (action.properties as Properties).TransitionTime / 1000;
  if (![4, 6].includes(action.fadeCurve) || !(seconds > 0))
    throw new Error('Changed Orb source stop curve');
  return { seconds, curve: action.fadeCurve as 4 | 6, ticks: Math.ceil(seconds * 60) };
}
export const AHRI_ORB_AUDIO_STOPS = {
  outward: stop('stopOutward'),
  return: stop('stopReturn'),
} as const;
