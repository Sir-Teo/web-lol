import type { AhriLifecycleAudioRecord } from '../../src/simulation/ahri-lifecycle-audio';
import {
  lifecycleAudioStates,
  type LifecycleAudioScene,
} from '../../src/audio/ahri-lifecycle-state';
export const ownLifecycleScene: LifecycleAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function lifecycleRecord(): AhriLifecycleAudioRecord {
  return {
    id: 42,
    sourceId: 7,
    team: 'blue',
    startTick: 100,
    levelAtDeath: 1,
    respawnTick: 700,
    origin: { x: 400, y: 0 },
    audience: ['blue', 'red'],
    respawn: null,
    terminalTick: null,
  };
}
export function respawnedLifecycleRecord(): AhriLifecycleAudioRecord {
  const r = lifecycleRecord();
  r.respawn = { tick: 700, point: { x: 0, y: 0 }, audience: ['blue', 'red'] };
  return r;
}
export const lifecycleStates = (records: readonly AhriLifecycleAudioRecord[], tick: number) =>
  lifecycleAudioStates(records, tick, ownLifecycleScene);
