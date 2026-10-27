import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { grompRayReference } from '../tools/qa/lib/prepare-gromp-ray-reference.mjs';

test('historical prepared Gromp curve views preserve source samples and reduce sampler work', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const reference = await grompRayReference(info.outputPath('reference')),
    optimizedReference = await grompRayReference(
      info.outputPath('optimized-reference'),
      'baaaa8f302ba192b7d2b696d0688b9f93c5919e9'
    ),
    optimizedUrl = '/' + relative(process.cwd(), optimizedReference.module).split(sep).join('/'),
    referenceUrl = '/' + relative(process.cwd(), reference.module).split(sep).join('/'),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/gromp-curve-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Gromp sampler curve calibration</title>',
    })
  );
  await page.goto('/gromp-curve-probe');
  const reading = await page.evaluate(
    async ({ referenceUrl, optimizedUrl }) => {
      const before = await import(referenceUrl),
        after = await import(optimizedUrl),
        samplers = { before: before.grompDeathParticles, after: after.grompDeathParticles },
        fixtures = [],
        census = [];
      const same = (a, b) => {
        if (Object.is(a, b)) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        const keys = Object.keys(a);
        return (
          keys.length === Object.keys(b).length &&
          keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
        );
      };
      for (const id of [0, 47, 91, 65535])
        for (const age of [0, 0.013, 0.073, 0.137, 0.213, 0.357, 0.519, 0.719, 1.1, 2.1])
          fixtures.push({ death: 100, tick: 101 + age * 60, id });
      const countMaps = (sampler, f) => {
        const original = Array.prototype.map;
        let calls = 0,
          result;
        try {
          Array.prototype.map = function (...args) {
            calls++;
            return Reflect.apply(original, this, args);
          };
          result = sampler(f.death, f.tick, f.id);
        } finally {
          Array.prototype.map = original;
        }
        return { mapResults: calls, particles: result.length };
      };
      for (const f of fixtures) {
        if (!same(samplers.before(f.death, f.tick, f.id), samplers.after(f.death, f.tick, f.id)))
          throw Error('Retained browser sampler state differs');
        const a = countMaps(samplers.before, f),
          b = countMaps(samplers.after, f);
        if (a.particles !== b.particles || b.mapResults > a.mapResults)
          throw Error('Curve views increased map work');
        census.push({ ...f, before: a, after: b });
      }
      const measured = fixtures.filter((f) => samplers.before(f.death, f.tick, f.id).length > 0),
        iterations = 2000,
        measure = (name) => {
          let checksum = 0;
          const start = performance.now();
          for (let i = 0; i < iterations; i++) {
            const f = measured[i % measured.length],
              rows = samplers[name](f.death, f.tick, f.id);
            checksum += rows.length;
            for (const row of rows) checksum += row.color[0] + row.scale[1] + row.offset[2];
          }
          return { ms: performance.now() - start, checksum };
        };
      measure('before');
      measure('after');
      const trials = [];
      for (let trial = 0; trial < 7; trial++) {
        let a, b;
        if (trial % 2) {
          b = measure('after');
          a = measure('before');
        } else {
          a = measure('before');
          b = measure('after');
        }
        if (a.checksum !== b.checksum) throw Error('Timed sampler checksum differs');
        trials.push({ beforeMs: a.ms, afterMs: b.ms, checksum: a.checksum });
      }
      const median = (rows) => [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)],
        beforeMedianMs = median(trials.map((r) => r.beforeMs)),
        afterMedianMs = median(trials.map((r) => r.afterMs));
      return {
        browser: navigator.userAgent,
        fixtures: fixtures.length,
        measuredFixtures: measured.length,
        iterationsPerTrial: iterations,
        trials,
        beforeMedianMs,
        afterMedianMs,
        ratio: beforeMedianMs / afterMedianMs,
        census,
        allRetainedFixtureStatesExact: true,
      };
    },
    { referenceUrl, optimizedUrl }
  );
  writeFileSync(
    info.outputPath('gromp-curve-sampler.json'),
    JSON.stringify(
      {
        ...reading,
        reference,
        optimizedReference,
        errors,
        limits: [
          'Isolated browser sampler CPU times and counted Array.map results; no GPU, full-world throughput or game-FPS measurement.',
          'Historical accepted endpoints are frozen; later color arithmetic changes are validated separately.',
          'One-time static curve preparation is outside steady-state measurements.',
        ],
      },
      null,
      2
    )
  );
  expect(errors).toEqual([]);
  expect(reading.fixtures).toBe(40);
  expect(reading.trials).toHaveLength(7);
  expect(reading.allRetainedFixtureStatesExact).toBe(true);
  expect(reading.afterMedianMs).toBeLessThan(reading.beforeMedianMs);
  expect(reading.census.some((r) => r.before.mapResults > r.after.mapResults)).toBe(true);
});
