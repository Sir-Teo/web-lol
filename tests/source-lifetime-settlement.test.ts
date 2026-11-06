import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-lifetime-samples.json';
import {
  sourceLifetimeSettlement,
  type SourceLifetimePolicy,
} from '../src/render/source-lifetime-settlement';
const decode = (hex: string) => {
  const b = Buffer.from(hex, 'hex');
  return Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
};
const hex = (values: number[]) => Buffer.from(new Float32Array(values).buffer).toString('hex');
function particles(index: number) {
  const input = samples.samples[index].input,
    birth = decode(input.birthTime),
    life = decode(input.lifetime),
    linger = decode(input.lingerFrom);
  return birth.map((birthTime, i) => ({
    birthTime,
    lifetime: life[i],
    lingerFrom: linger[i] === -1 ? null : linger[i],
  }));
}
for (const [index, sample] of samples.samples.entries())
  test(`external lifetime settlement ${index}`, () => {
    const policy = samples.policies[sample.policy].policy as SourceLifetimePolicy;
    const out = sourceLifetimeSettlement(policy, sample.input.state, particles(index), {
      now: sample.input.now,
      stopped: sample.input.stopped,
    });
    expect({
      finishedAt: out.state.finishedAt,
      lifetime: hex(out.particles.map((p) => p.lifetime)),
      lingerFrom: hex(out.particles.map((p) => p.lingerFrom ?? -1)),
    }).toEqual(sample.expected);
  });
test('external lifetime fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-lifetime-samples.mjs', '--check']);
});
test('birth end and settlement end retain distinct boundaries and fixed modes grant remaining time', () => {
  const policy = samples.policies.find((p) => p.name === '2-default')!
    .policy as SourceLifetimePolicy;
  const state = { age: 1, lastSpawn: 0.1, emitted: true, finishedAt: null },
    pool = [{ birthTime: 0.05, lifetime: 0.75, lingerFrom: null }];
  expect(
    sourceLifetimeSettlement(policy, state, pool, { now: 1, stopped: false }).state.finishedAt
  ).toBeNull();
  const fixed = sourceLifetimeSettlement(policy, { ...state, age: 1.1 }, pool, {
    now: 1.1,
    stopped: false,
  });
  expect(fixed.state.finishedAt).toBe(1.1);
  expect(fixed.particles[0].lifetime - (1.1 - fixed.particles[0].birthTime)).toBeCloseTo(0.2, 6);
  const capped = sourceLifetimeSettlement({ ...policy, kind: 0 }, { ...state, age: 1.1 }, pool, {
    now: 1.1,
    stopped: true,
  });
  expect(capped.particles[0].lifetime).toBe(Math.fround(0.2));
});
test('settlement preserves input ownership and retains existing linger stamps', () => {
  const sample = samples.samples[1],
    state = structuredClone(sample.input.state),
    pool = particles(1);
  const before = structuredClone({ state, pool });
  const out = sourceLifetimeSettlement(
    samples.policies[sample.policy].policy as SourceLifetimePolicy,
    state,
    pool,
    { now: sample.input.now, stopped: sample.input.stopped }
  );
  expect({ state, pool }).toEqual(before);
  expect(out.particles[2].lingerFrom).toBe(pool[2].lingerFrom);
  out.state.finishedAt = 999;
  out.particles[0].lifetime = 999;
  expect({ state, pool }).toEqual(before);
});
test('invalid settlement numbers, particles and policy reject', () => {
  const policy = samples.policies[0].policy as SourceLifetimePolicy,
    state = samples.samples[0].input.state,
    pool = particles(0);
  expect(() =>
    sourceLifetimeSettlement({ ...policy, kind: 9 as 0 }, state, pool, { now: 0.1, stopped: true })
  ).toThrow();
  expect(() =>
    sourceLifetimeSettlement(policy, { ...state, lastSpawn: 2 }, pool, { now: 0.1, stopped: true })
  ).toThrow();
  expect(() =>
    sourceLifetimeSettlement(policy, state, [{ ...pool[0], lifetime: -1 }], {
      now: 0.1,
      stopped: true,
    })
  ).toThrow();
  expect(() =>
    sourceLifetimeSettlement(policy, state, pool, { now: NaN, stopped: true })
  ).toThrow();
});
