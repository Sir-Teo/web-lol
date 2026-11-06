import { charmAudioStates } from '../../src/audio/ahri-charm-state';
import type { AhriCharmAudioRecord } from '../../src/simulation/ahri-charm-audio';
export function charmRecord(sourceId = 10): AhriCharmAudioRecord {
  return {
    sourceId,
    team: 'blue',
    castTick: 100,
    origin: { x: 0, y: 0 },
    castAudience: ['blue', 'red'],
    cancelTick: null,
    launch: {
      tick: 115,
      id: sourceId + 100,
      point: { x: 0, y: 0 },
      currentPoint: { x: 400, y: 0 },
      audience: ['blue', 'red'],
    },
    stop: { tick: 130, point: { x: 400, y: 0 }, reason: 'hit' },
    hit: { tick: 130, point: { x: 400, y: 0 }, targetId: 99, audience: ['blue', 'red'] },
  };
}
export function states(records: AhriCharmAudioRecord[], tick: number) {
  return charmAudioStates(
    records,
    tick,
    'blue',
    () => true,
    () => ({ x: 20, y: 0 })
  );
}
