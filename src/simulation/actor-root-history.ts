import type { Team } from './types';
export interface ActorRootFrame {
  tick: number;
  x: number;
  y: number;
  facing: number;
  audience: Team[];
}
export interface ActorRootRun extends ActorRootFrame {
  endTick: number;
}
const same = (a: ActorRootFrame, b: ActorRootFrame) =>
  a.x === b.x &&
  a.y === b.y &&
  a.facing === b.facing &&
  a.audience.length === b.audience.length &&
  a.audience.every((team, index) => team === b.audience[index]);
/** Lossless runs of identical fixed-step endpoints. No pose/time quantization. */
export function appendActorRoot(runs: ActorRootRun[], frame: ActorRootFrame): void {
  const previous = runs.at(-1);
  if (!previous) {
    runs.push({ ...frame, audience: [...frame.audience], endTick: frame.tick });
    return;
  }
  if (frame.tick !== previous.endTick && frame.tick !== previous.endTick + 1)
    throw Error('Non-contiguous actor root capture');
  if (frame.tick === previous.endTick) {
    if (same(previous, frame)) return;
    if (previous.tick === previous.endTick) runs.pop();
    else previous.endTick--;
  }
  const last = runs.at(-1);
  if (last && same(last, frame)) last.endTick = frame.tick;
  else runs.push({ ...frame, audience: [...frame.audience], endTick: frame.tick });
}
export function actorRootAt(runs: readonly ActorRootRun[], tick: number): ActorRootRun {
  if (!runs.length) throw Error('Missing actor root frames');
  if (tick <= runs[0].tick) return runs[0];
  let low = 0,
    high = runs.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (runs[middle].tick <= tick) low = middle;
    else high = middle - 1;
  }
  return runs[low];
}
export function actorRootPose(runs: readonly ActorRootRun[], tick: number) {
  const a = actorRootAt(runs, Math.floor(tick)),
    b = actorRootAt(runs, Math.ceil(tick)),
    fraction = tick - Math.floor(tick),
    turn = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    facing: a.facing + turn * fraction,
  };
}
export function actorRootKnown(runs: readonly ActorRootRun[], tick: number, team: Team): boolean {
  return [Math.floor(tick), Math.ceil(tick)].every((at) =>
    actorRootAt(runs, at).audience.includes(team)
  );
}
export function validateActorRoots(
  runs: readonly ActorRootRun[],
  start: number,
  end: number
): void {
  if (!runs.length || runs[0].tick !== start || runs.at(-1)!.endTick !== end)
    throw Error('Saved actor root coverage differs');
  runs.forEach((run, index) => {
    const previous = runs[index - 1];
    if (
      run.endTick < run.tick ||
      (previous && (run.tick !== previous.endTick + 1 || same(previous, run)))
    )
      throw Error('Saved actor root runs are not canonical');
  });
}
