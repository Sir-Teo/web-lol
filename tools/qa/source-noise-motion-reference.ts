import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { stepEmitters, createEmitterStates, NO_TRANSFORM } from 'frozen-noise-motion-integrate';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { createPool, NOT_LINGERING } from 'frozen-noise-motion-pool';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { emitterOf } from 'frozen-noise-motion-fixture';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { Rng } from 'frozen-noise-motion-rng';
const data = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const curve = (value: any, fallback: number[]) => ({
  constant: value ? [value.constantValue] : fallback,
  keys: value?.dynamics
    ? value.dynamics.times.map((time: number, i: number) => ({
        time,
        values: [value.dynamics.values[i]],
      }))
    : [],
  tables: [],
});
const bits = (array: Float32Array) =>
  Array.from(new Uint32Array(array.buffer, array.byteOffset, array.length));
const identity = Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1);
const trajectories = [];
for (const profile of [10, 27]) {
  const p = data.profiles[profile];
  for (const birthTick of profile === 10 ? [1, 10, 30, 120] : [1, 12, 30, 270])
    for (const scenario of ['inside-moving', 'outside-moving', 'inside-still']) {
      const fields = {
        acceleration: [],
        attraction: [],
        drag: [],
        orbital: [],
        noise: p.fieldCollection.fieldNoiseDefinitions.map((field: any) => ({
          position: curve(null, [0, 0, 0]),
          axisFraction: field.axisFraction,
          radius: curve(field.radius, [0]),
          frequency: curve(field.frequency, [0]),
          velocityDelta: curve(field.velocityDelta, [0]),
        })),
      };
      const emitter = emitterOf(0, { lifetime: p.emitterLife, fields, disabled: true });
      const rng = new Rng(1);
      const system = { emitters: [emitter], dragMotion: 0 };
      const states = createEmitterStates([emitter]);
      const pool = createPool(1);
      const radius = p.fieldCollection.fieldNoiseDefinitions[0].radius.constantValue;
      const input = {
        profile,
        birthTick,
        scenario,
        serial: scenario === 'inside-still' ? 65535 : 927,
        position: scenario === 'outside-moving' ? [radius + 10, 0, 0] : [0, 0, 0],
        velocity:
          scenario === 'inside-still'
            ? [0, 0, 0]
            : scenario === 'outside-moving'
              ? [50, 0, 0]
              : [300, -120, 80],
        drag: p.drag.constant,
        maximumSteps: 119,
      };
      const rows = [];
      for (let tick = 1; tick <= birthTick + input.maximumSteps; tick++) {
        if (tick === birthTick) {
          pool.count = 1;
          pool.born = 1;
          pool.emitter[0] = 0;
          pool.serial[0] = input.serial;
          pool.fresh[0] = 1;
          pool.birthTime[0] = tick / 60;
          pool.lifetime[0] = 100;
          pool.position.set(input.position);
          pool.placed.set(input.position);
          pool.velocity.set(input.velocity);
          pool.birthDrag.set(input.drag);
          pool.frame.set(identity);
          pool.lingerFrom[0] = NOT_LINGERING;
        }
        stepEmitters(
          pool,
          system,
          {
            now: tick / 60,
            dt: 1 / 60,
            origin: [0, 0, 0],
            moved: [0, 0, 0],
            yaw: identity,
            world: NO_TRANSFORM,
            stopped: false,
          },
          rng,
          states
        );
        assert.equal(pool.count, tick < birthTick ? 0 : 1);
        assert.equal(pool.born, tick < birthTick ? 0 : 1);
        if (tick >= birthTick)
          rows.push({
            steps: tick - birthTick,
            position: Array.from(pool.position),
            velocity: Array.from(pool.velocity),
            positionBits: bits(pool.position),
            velocityBits: bits(pool.velocity),
          });
      }
      trajectories.push({ input, rows });
    }
}
writeFileSync(process.argv[2], JSON.stringify(trajectories, null, 2) + '\n', { flag: 'wx' });
