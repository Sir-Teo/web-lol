import type { AhriFoxFireAudioRecord } from '../../src/simulation/ahri-fox-fire-audio';
import { foxFireAudioStates, type FoxFireAudioScene } from '../../src/audio/ahri-fox-fire-state';
export const ownFoxFireScene: FoxFireAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function foxFireRecord(): AhriFoxFireAudioRecord {
  return {
    id: 42,
    sourceId: 7,
    team: 'blue',
    startTick: 100,
    facing: 0,
    origin: { x: 0, y: 0 },
    audience: ['blue', 'red'],
    activationStop: null,
    fires: [0, 1, 2].map((index) => ({ index, launch: null, end: null })),
  };
}
export function firedFoxFireRecord(): AhriFoxFireAudioRecord {
  const r = foxFireRecord();
  r.activationStop = {
    tick: 130,
    point: { x: 20, y: 0 },
    reason: 'released',
    audience: ['blue', 'red'],
  };
  for (const f of r.fires) {
    f.launch = {
      tick: 130,
      targetId: 99,
      sourcePoint: { x: 20, y: 0 },
      origin: { x: 150, y: 0 },
      currentPoint: { x: 500, y: 0 },
      audience: ['blue', 'red'],
    };
    f.end = { tick: 145, point: { x: 500, y: 0 }, reason: 'hit', audience: ['blue', 'red'] };
  }
  return r;
}
export const foxFireStates = (records: readonly AhriFoxFireAudioRecord[], tick: number) =>
  foxFireAudioStates(records, tick, ownFoxFireScene);
