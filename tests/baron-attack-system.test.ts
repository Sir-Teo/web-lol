import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BaronAttackSystem, type BaronSystemStep } from '../src/render/baron-attack-system';
import type { BaronAttackProgram } from '../src/render/baron-attack-program';
const raw = readFileSync('.cache/baron-attack-program-v2/program.json');
expect(createHash('sha256').update(raw).digest('hex')).toBe(
  '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d'
);
const program = JSON.parse(raw.toString()) as BaronAttackProgram;
const options = { capacity: 512, birthFactors: () => ({ birthScale: 1, emitOffset: 1 }) };
const step = (tick: number, stopped = false): BaronSystemStep => ({
  dt: 1 / 30,
  origin: [tick * 10, 20, 0],
  moved: [10, 0, 0],
  orientation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  stopped,
});
for (const role of ['missile', 'hit'] as const)
  for (const stoppedAt of [null, 15])
    test(`all ${role} emitters replay and retire with stop ${stoppedAt}`, () => {
      const system = new BaronAttackSystem(program, role, 12345, options),
        seen = new Set<number>();
      for (let tick = 1; tick <= 120; tick++) {
        system.step(step(tick, stoppedAt !== null && tick >= stoppedAt));
        for (const packet of system.packets()) {
          seen.add(packet.emitter);
          for (const value of [
            ...packet.position,
            ...packet.scale,
            ...packet.color,
            ...packet.rotation,
            ...packet.travel,
          ])
            expect(Number.isFinite(value)).toBe(true);
        }
      }
      expect(seen.size).toBe(role === 'missile' ? 9 : 12);
      expect(system.count).toBe(0);
    });
for (const role of ['missile', 'hit'] as const)
  test(`${role} checkpoints restore exact packets and futures`, () => {
    const system = new BaronAttackSystem(program, role, 777, options);
    for (let tick = 1; tick <= 15; tick++) system.step(step(tick));
    const checkpoint = system.checkpoint(),
      copy = new BaronAttackSystem(program, role, 0, options);
    copy.restore(checkpoint);
    expect(copy.checkpoint()).toEqual(checkpoint);
    expect(copy.packets()).toEqual(system.packets());
    if (checkpoint.particles.length) checkpoint.particles[0].position.fill(999);
    expect(copy.packets()).toEqual(system.packets());
    for (let tick = 16; tick <= 75; tick++) {
      const next = step(tick, tick >= 45);
      system.step(next);
      copy.step(next);
      expect(copy.checkpoint()).toEqual(system.checkpoint());
      expect(copy.packets()).toEqual(system.packets());
    }
  });
test('program metadata, input steps and packet buffers remain independently owned', () => {
  const source = structuredClone(program),
    system = new BaronAttackSystem(source, 'missile', 1, options),
    input = step(1),
    before = structuredClone(input);
  source.profiles[0].curves.rate!.constant = [0];
  system.step(input);
  expect(input).toEqual(before);
  expect(Object.isFrozen(system.profile(0))).toBe(true);
  const expected = system.packets(),
    packets = system.packets();
  expect(packets.length).toBeGreaterThan(0);
  packets[0].position.fill(999);
  packets[0].color.fill(999);
  expect(system.packets()).toEqual(expected);
});
test('explicit bound policy and complete emission surface are required', () => {
  expect(() => new BaronAttackSystem(program, 'hit', 1, { capacity: 512 })).toThrow('bound-size');
  expect(() => new BaronAttackSystem(program, 'missile', 1, { capacity: 512 })).not.toThrow();
  const source = structuredClone(program);
  source.emissionSurfaces = {};
  expect(() => new BaronAttackSystem(source, 'hit', 1, options)).toThrow('surface');
});
test('bounded pools never exceed capacity and checkpoint corruption rejects', () => {
  const system = new BaronAttackSystem(program, 'hit', 1, { ...options, capacity: 1 });
  for (let tick = 1; tick <= 15; tick++) {
    system.step(step(tick));
    expect(system.count).toBeLessThanOrEqual(1);
  }
  const checkpoint = system.checkpoint();
  for (const edit of ['role', 'clock', 'rng', 'capacity', 'uv']) {
    const changed = structuredClone(checkpoint);
    if (edit === 'role') changed.role = 'missile';
    if (edit === 'clock') changed.now = -1;
    if (edit === 'rng') changed.rng = 0;
    if (edit === 'capacity') changed.particles.push(...structuredClone(changed.particles));
    if (edit === 'uv' && changed.particles.length)
      (changed.particles[0] as unknown as { uv: null }).uv = null;
    if (edit === 'uv' && !changed.particles.length) continue;
    if (edit === 'capacity' && !checkpoint.particles.length) continue;
    expect(() => system.restore(changed)).toThrow();
    expect(system.checkpoint()).toEqual(checkpoint);
  }
});
test('invalid steps reject before changing effect state', () => {
  const system = new BaronAttackSystem(program, 'missile', 1, options),
    before = system.checkpoint();
  for (const edit of [
    { dt: 0 },
    { dt: NaN },
    { orientation: [1, 2] },
    { orientation: [1e300, 0, 0, 0, 1, 0, 0, 0, 1] },
    { origin: [NaN, 0, 0] },
  ]) {
    expect(() => system.step({ ...step(1), ...edit })).toThrow();
    expect(system.checkpoint()).toEqual(before);
  }
});
