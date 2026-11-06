import type { AhriRecallAudioRecord } from '../../src/simulation/ahri-recall-audio';
import { recallAudioStates, type RecallAudioScene } from '../../src/audio/ahri-recall-state';
export const ownRecallScene: RecallAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function recallRecord(): AhriRecallAudioRecord {
  return {
    id: 42,
    sourceId: 7,
    team: 'blue',
    startTick: 100,
    completeTick: 580,
    origin: { x: 400, y: 0 },
    audience: ['blue', 'red'],
    end: null,
  };
}
export const recallStates = (records: readonly AhriRecallAudioRecord[], tick: number) =>
  recallAudioStates(records, tick, ownRecallScene);
