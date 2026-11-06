import type { AhriAttackAudioRecord } from '../../src/simulation/ahri-attack-audio';
import { attackAudioStates, type AttackAudioScene } from '../../src/audio/ahri-attack-state';
export const ownAttackScene: AttackAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function attackRecord(): AhriAttackAudioRecord {
  return {
    sourceId: 7,
    targetId: 9,
    team: 'blue',
    startTick: 100,
    releaseTick: 118,
    critical: false,
    origin: { x: 0, y: 0 },
    audience: ['blue', 'red'],
    cancel: null,
    launch: null,
  };
}
export function firedAttackRecord(): AhriAttackAudioRecord {
  const r = attackRecord();
  r.launch = {
    id: 42,
    tick: 118,
    origin: { x: 0, y: 0 },
    currentPoint: { x: 350, y: 0 },
    audience: ['blue', 'red'],
    end: { tick: 130, point: { x: 350, y: 0 }, reason: 'hit', audience: ['blue', 'red'] },
  };
  return r;
}
export const attackStates = (records: readonly AhriAttackAudioRecord[], tick: number) =>
  attackAudioStates(records, tick, ownAttackScene);
