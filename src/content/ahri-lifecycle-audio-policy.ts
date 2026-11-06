import { AHRI_LIFECYCLE_AUDIO as SOURCE } from './ahri-lifecycle-audio';

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
  if (!found) throw Error('Missing Lifecycle audio node');
  return found;
};
function variant(id: number) {
  const sound = node(id);
  if (!sound.clip) throw Error('Expected Lifecycle source sound');
  const ancestry: number[] = [];
  let current: Node | undefined = sound,
    gainDb = 0,
    pitchCents = 0,
    minimum = 0,
    maximum = 0,
    draws = 0;
  while (current) {
    if (ancestry.includes(current.id)) throw Error('Cyclic Lifecycle audio ancestry');
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
  if (draws > 1) throw Error('Multiple Lifecycle pitch draws need a separate policy');
  return {
    ...sound.clip,
    soundId: id,
    ancestry,
    gainDb,
    pitchCents,
    pitchRangeCents: [minimum, maximum] as const,
  };
}
/** Local ceiling exceeds a standard ten-player roster. It is not inferred from
 * the source's zero instance declarations or unresolved parent/bus behavior. */
export const AHRI_LIFECYCLE_LOCAL_VOICE_LIMIT = 16;
function profile(containerId: number, role: 'death' | 'respawn') {
  const container = node(containerId),
    event = SOURCE.events.find((e) => e.role === role)!;
  const action = event.actions.find((a) => a.type === 'CAkActionPlay');
  if (
    event.actions.length !== 1 ||
    action?.target !== containerId ||
    !container.policy ||
    !container.playlist ||
    container.playlist.length !== 1 ||
    container.policy.eMode !== 0 ||
    container.policy.bIsContinuous !== 0 ||
    container.policy.sLoopCount !== 1 ||
    container.policy.u16MaxNumInstance !== 0
  )
    throw Error('Changed lifecycle finite profile');
  const variants = container.playlist.map((p) => variant(p.id));
  return {
    containerId,
    eventId: event.id,
    actionId: action.id,
    variants,
    sourceMaximumInstances: container.policy.u16MaxNumInstance,
    maxVoices: AHRI_LIFECYCLE_LOCAL_VOICE_LIMIT,
    maximumTicks: Math.ceil(
      Math.max(
        ...variants.map(
          (v) => v.durationSeconds / 2 ** ((v.pitchCents + v.pitchRangeCents[0]) / 1200)
        )
      ) * 60
    ),
  };
}
/** Local additive ancestry only; native inheritance and dispatch are unverified. */
export const AHRI_LIFECYCLE_AUDIO_PROFILES = {
  death: profile(889858872, 'death'),
  respawn: profile(451024335, 'respawn'),
} as const;
export type LifecycleAudioKind = keyof typeof AHRI_LIFECYCLE_AUDIO_PROFILES;
const event = SOURCE.events.find((e) => e.role === 'stopDeath')!,
  action = event.actions.find((a) => a.type === 'CAkActionStop')!;
/** Preserved declaration. No local callback clock is assigned to this Stop. */
export const AHRI_LIFECYCLE_SOURCE_DEATH_STOP = {
  eventId: event.id,
  actionId: action.id,
  targetId: action.target,
  seconds: action.properties.TransitionTime / 1000,
  curve: action.fadeCurve,
} as const;
