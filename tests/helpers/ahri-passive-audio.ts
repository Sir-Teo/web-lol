import type { AhriPassiveAudioRecord } from '../../src/simulation/ahri-passive-audio';
import { passiveAudioStates, type PassiveAudioScene } from '../../src/audio/ahri-passive-state';
export const ownPassiveScene: PassiveAudioScene = { team: 'blue', visible: () => true };
export function passiveRecord(): AhriPassiveAudioRecord {
  return {
    id: 42,
    sourceId: 7,
    team: 'blue',
    victimId: 9,
    kind: 'champion',
    startTick: 100,
    origin: { x: 400, y: 0 },
    currentPoint: { x: 20, y: 0 },
    audience: ['blue', 'red'],
    end: null,
  };
}
export function consumedPassiveRecord(): AhriPassiveAudioRecord {
  const r = passiveRecord();
  r.end = { tick: 125, point: { x: 20, y: 0 }, reason: 'consumed', audience: ['blue', 'red'] };
  return r;
}
export const passiveStates = (records: readonly AhriPassiveAudioRecord[], tick: number) =>
  passiveAudioStates(records, tick, ownPassiveScene);
