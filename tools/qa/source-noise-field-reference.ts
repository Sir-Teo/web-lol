import { readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Archive-only alias supplied by the reference controller.
import { noiseClock, impulsesOwed, noiseInto, prepareFields } from 'frozen-source-noise-fields';
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
const fieldModel = (profile: number) => ({
  acceleration: [],
  attraction: [],
  drag: [],
  orbital: [],
  noise: data.profiles[profile].fieldCollection.fieldNoiseDefinitions.map((field: any) => ({
    position: curve(null, [0, 0, 0]),
    radius: curve(field.radius, [0]),
    frequency: curve(field.frequency, [0]),
    velocityDelta: curve(field.velocityDelta, [0]),
    axisFraction: field.axisFraction,
  })),
});
const clocks = [];
for (const rate of [0, 5, 6, 1000000000]) {
  const clock = noiseClock();
  const samples = [];
  for (const now of [1 / 60, 2 / 60, 0.1, 1 / 6, 0.2, 0.5, 1.05, 100]) {
    const kicks = impulsesOwed(clock, rate, now);
    samples.push({ now, kicks, last: clock.last, fired: clock.fired });
  }
  clocks.push({ rate, samples });
}
const preparations = [],
  impulses = [];
for (const profile of [10, 27]) {
  const model = fieldModel(profile);
  const owned: { last: number | null; fired: number }[] = [];
  for (const tick of [1, 2, 9, 10, 11, 12, 30, 60, 90, 150, 301, 420]) {
    const now = tick / 60,
      phase = Math.min(now / data.profiles[profile].emitterLife, 1);
    const sampled = prepareFields(
      model,
      phase,
      now,
      { origin: [0, 0, 0], orientation: null },
      owned
    );
    preparations.push({ profile, tick, phase, noise: sampled.noise[0] });
  }
  for (const phase of [0, 0.5, 1])
    for (const serial of [0, 927, 65535])
      for (const place of ['inside', 'boundary', 'outside'])
        for (const kicks of [0, 1, 3]) {
          const sampled = prepareFields(
            model,
            phase,
            0,
            { origin: [0, 0, 0], orientation: null },
            []
          ).noise[0];
          const noise = {
            ...sampled,
            kicks,
            first: serial === 65535 ? 9 : 0,
            slot: serial === 927 ? 1 : 0,
          };
          const at = [
            place === 'inside' ? 0 : sampled.radius + (place === 'outside' ? 0.01 : 0),
            0,
            0,
          ];
          const before = [3, -4, 5],
            velocity = Float32Array.from(before);
          noiseInto(velocity, at, noise, serial);
          impulses.push({
            profile,
            phase,
            serial,
            place,
            at,
            noise,
            before,
            after: Array.from(velocity),
            afterBits: Array.from(new Uint32Array(velocity.buffer)),
          });
        }
}
writeFileSync(process.argv[2], JSON.stringify({ clocks, preparations, impulses }, null, 2) + '\n', {
  flag: 'wx',
});
