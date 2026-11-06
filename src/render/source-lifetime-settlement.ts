import { sourceEmissionWindow, type SourceEmissionWindow } from './source-emission-window';
export interface SourceLifetimeParticle {
  birthTime: number;
  lifetime: number;
  lingerFrom: number | null;
}
export interface SourceLifetimeEmitterState {
  age: number;
  lastSpawn: number;
  emitted: boolean;
  finishedAt: number | null;
}
export interface SourceLifetimePolicy {
  window: SourceEmissionWindow;
  particleLinger: number;
  kind: 0 | 1 | 2 | 3;
}
/** Settle only one emitter's particles. Copies state and float32 pool fields.
 * Birth/death selection and linger replacement curves remain caller-owned. */
export function sourceLifetimeSettlement(
  policy: SourceLifetimePolicy,
  state: SourceLifetimeEmitterState,
  particles: readonly SourceLifetimeParticle[],
  step: { now: number; stopped: boolean }
) {
  // Pool timestamps share float32 precision; the system clock stays double.
  const clock = sourceEmissionWindow(policy.window, state.age);
  if (
    !Number.isFinite(policy.particleLinger) ||
    ![0, 1, 2, 3].includes(policy.kind) ||
    !Number.isFinite(step.now) ||
    step.now < 0 ||
    typeof step.stopped !== 'boolean' ||
    !Number.isFinite(state.lastSpawn) ||
    state.lastSpawn < 0 ||
    state.lastSpawn > state.age ||
    typeof state.emitted !== 'boolean' ||
    (state.finishedAt !== null &&
      (!Number.isFinite(state.finishedAt) ||
        state.finishedAt < 0 ||
        state.finishedAt > step.now)) ||
    particles.some(
      (p) =>
        !Number.isFinite(p.birthTime) ||
        p.birthTime < 0 ||
        Math.fround(p.birthTime) > Math.fround(step.now) ||
        !(Number.isFinite(p.lifetime) || p.lifetime === Infinity) ||
        p.lifetime < 0 ||
        (p.lingerFrom !== null &&
          (!Number.isFinite(p.lingerFrom) ||
            p.lingerFrom < 0 ||
            Math.fround(p.lingerFrom) > Math.fround(step.now)))
    )
  )
    throw RangeError('Invalid source lifetime settlement');
  const next = { ...state },
    pool = particles.map((p) => ({
      birthTime: Math.fround(p.birthTime),
      lifetime: Math.fround(p.lifetime),
      lingerFrom: p.lingerFrom === null ? null : Math.fround(p.lingerFrom),
    }));
  const kind = policy.window.simple ? 0 : policy.kind;
  if (kind === 3 || (!step.stopped && kind !== 2)) return { state: next, particles: pool };
  const singleFinished =
    !policy.window.simple &&
    policy.window.singleParticle &&
    !policy.window.overridesMaterials &&
    state.emitted &&
    state.lastSpawn < state.age;
  const finished =
    singleFinished ||
    (step.stopped ? state.age > clock.stopWait : clock.end !== null && state.age > clock.end);
  if (!finished) return { state: next, particles: pool };
  const capped = kind === 0;
  if (!capped && next.finishedAt !== null) return { state: next, particles: pool };
  next.finishedAt ??= step.now;
  const seconds = Math.min(
    (policy.window.simple ? 0 : policy.window.particleLifetimeMaximum) + 10,
    Math.max(policy.particleLinger, 0)
  );
  for (const particle of pool) {
    particle.lingerFrom ??= Math.fround(next.finishedAt);
    particle.lifetime = Math.fround(
      capped ? Math.min(particle.lifetime, seconds) : step.now - particle.birthTime + seconds
    );
  }
  return { state: next, particles: pool };
}
