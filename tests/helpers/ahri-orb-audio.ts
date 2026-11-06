import type { AhriOrbAudioRecord } from '../../src/simulation/ahri-orb-audio';
import { orbAudioStates, type OrbAudioScene } from '../../src/audio/ahri-orb-state';
export const ownOrbScene: OrbAudioScene = {
  team: 'blue',
  visible: () => true,
  casterPoint: () => ({ x: 20, y: 0 }),
};
export function orbRecord(sourceId = 10): AhriOrbAudioRecord {
  return {
    sourceId,
    team: 'blue',
    castTick: 100,
    origin: { x: 0, y: 0 },
    aim: { x: 900, y: 0 },
    castAudience: ['blue', 'red'],
    cancelTick: null,
    launch: {
      id: sourceId + 100,
      tick: 115,
      origin: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      currentPoint: { x: 400, y: 0 },
      audience: ['blue', 'red'],
    },
    turn: null,
    end: null,
    hits: [
      {
        tick: 130,
        point: { x: 350, y: 0 },
        targetId: 99,
        leg: 'outward',
        audience: ['blue', 'red'],
      },
    ],
  };
}
export function turnedOrbRecord(sourceId = 10) {
  const r = orbRecord(sourceId);
  r.launch!.currentPoint = { x: 1000, y: 0 };
  r.turn = {
    tick: 150,
    point: { x: 1000, y: 0 },
    currentPoint: { x: 800, y: 0 },
    audience: ['blue', 'red'],
  };
  return r;
}
export function caughtOrbRecord(sourceId = 10) {
  const r = turnedOrbRecord(sourceId);
  r.turn!.currentPoint = { x: 20, y: 0 };
  r.end = { tick: 180, point: { x: 20, y: 0 }, reason: 'caught', audience: ['blue', 'red'] };
  r.hits.push({
    tick: 170,
    point: { x: 500, y: 0 },
    targetId: 99,
    leg: 'return',
    audience: ['blue', 'red'],
  });
  return r;
}
export const orbStates = (records: AhriOrbAudioRecord[], tick: number) =>
  orbAudioStates(records, tick, ownOrbScene);
