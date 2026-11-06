import { AHRI_ATTACK_AUDIO as SOURCE } from './ahri-attack-audio';

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
  if (!found) throw Error('Missing Attack audio node');
  return found;
};
function variant(id: number) {
  const sound = node(id);
  if (!sound.clip) throw Error('Expected Attack source sound');
  const ancestry: number[] = [];
  let current: Node | undefined = sound,
    gainDb = 0,
    pitchCents = 0,
    minimum = 0,
    maximum = 0,
    draws = 0;
  while (current) {
    if (ancestry.includes(current.id)) throw Error('Cyclic Attack audio ancestry');
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
  if (draws > 1) throw Error('Multiple Attack pitch draws need a separate policy');
  return {
    ...sound.clip,
    soundId: id,
    ancestry,
    gainDb,
    pitchCents,
    pitchRangeCents: [minimum, maximum] as const,
  };
}
function profile(containerId: number, phase: 'Cast' | 'Launch' | 'Hit') {
  const container = node(containerId);
  const aliases = (['basic', 'alternate', 'critical'] as const).map((kind) => {
    const event = SOURCE.events.find((e) => e.role === `${kind}${phase}`)!;
    const action = event.actions.find((a) => a.type === 'CAkActionPlay');
    if (action?.target !== containerId || event.actions.length !== 1)
      throw Error('Changed attack event alias');
    return { eventId: event.id, actionId: action.id };
  });
  if (
    !container.policy ||
    !container.playlist ||
    container.policy.eMode !== 0 ||
    container.policy.bIsContinuous !== 0 ||
    container.policy.sLoopCount !== 1 ||
    container.playlist.some((p) => p.weight !== 50000)
  )
    throw Error('Changed finite attack profile');
  const variants = container.playlist.map((p) => variant(p.id));
  return {
    containerId,
    aliases,
    variants,
    maxVoices: container.policy.u16MaxNumInstance,
    maximumTicks: Math.ceil(
      Math.max(
        ...variants.map(
          (v) => v.durationSeconds / 2 ** ((v.pitchCents + v.pitchRangeCents[0]) / 1200)
        )
      ) * 60
    ),
  };
}
/** Local additive ancestry and per-swing cosmetic selection; native shared global
 * shuffle, exact event callback clocks, listener and bus remain unverified. */
export const AHRI_ATTACK_AUDIO_PROFILES = {
  cast: profile(367977750, 'Cast'),
  launch: profile(276401545, 'Launch'),
  hit: profile(768158277, 'Hit'),
} as const;
export type AttackAudioKind = keyof typeof AHRI_ATTACK_AUDIO_PROFILES;
const stops = SOURCE.events
  .filter((e) => e.role.endsWith('StopLaunch'))
  .map((e) => {
    const action = e.actions.find((a) => a.type === 'CAkActionStop')!;
    if (
      e.actions.length !== 1 ||
      action.target !== 276401545 ||
      action.properties.TransitionTime !== 100 ||
      action.fadeCurve !== 4
    )
      throw Error('Changed source attack missile Stop');
    return { eventId: e.id, actionId: action.id };
  });
if (stops.length !== 3) throw Error('Missing attack Stop aliases');
export const AHRI_ATTACK_AUDIO_LAUNCH_STOP = {
  aliases: stops,
  targetId: 276401545,
  seconds: 0.1,
  curve: 4,
} as const;
