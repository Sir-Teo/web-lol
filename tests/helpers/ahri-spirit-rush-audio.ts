import type { AhriSpiritRushAudioRecord } from '../../src/simulation/ahri-spirit-rush-audio';
import {
  spiritRushAudioStates,
  type SpiritRushAudioScene,
} from '../../src/audio/ahri-spirit-rush-state';
export const ownSpiritRushScene: SpiritRushAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function spiritRushRecord(): AhriSpiritRushAudioRecord {
  return {
    id: 42,
    sourceId: 7,
    team: 'blue',
    startTick: 100,
    windowEndTick: 1000,
    origin: { x: 0, y: 0 },
    audience: ['blue', 'red'],
    end: null,
    bursts: [
      {
        index: 0,
        tick: 100,
        origin: { x: 0, y: 0 },
        audience: ['blue', 'red'],
        dashEndTick: 124,
        bolts: [],
      },
    ],
  };
}
export function firedSpiritRushRecord(): AhriSpiritRushAudioRecord {
  const r = spiritRushRecord();
  r.bursts[0].bolts = [0, 1, 2].map((index) => ({
    index,
    targetId: 99 + index,
    currentPoint: { x: 300 + index * 100, y: 0 },
    end: {
      tick: 125,
      point: { x: 300 + index * 100, y: 0 },
      reason: 'hit',
      audience: ['blue', 'red'],
    },
  }));
  return r;
}
export const spiritRushStates = (records: readonly AhriSpiritRushAudioRecord[], tick: number) =>
  spiritRushAudioStates(records, tick, ownSpiritRushScene);
