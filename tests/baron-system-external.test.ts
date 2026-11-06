import { expect, test } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/baron-system-samples.json';
import { BaronAttackSystem } from '../src/render/baron-attack-system';
import { ParticlePreviewRng } from '../src/render/particle-preview-rng';
import type { BaronAttackProgram, BaronAttackRole } from '../src/render/baron-attack-program';
const raw = readFileSync('.cache/baron-attack-program-v2/program.json');
expect(createHash('sha256').update(raw).digest('hex')).toBe(samples.programSha256);
const program = JSON.parse(raw.toString()) as BaronAttackProgram;
function canonical(value: unknown): unknown {
  if (ArrayBuffer.isView(value))
    return {
      typed: value.constructor.name,
      hex: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex'),
    };
  if (typeof value === 'number') {
    const bytes = Buffer.alloc(8);
    bytes.writeDoubleLE(value);
    return { number: bytes.toString('hex') };
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  return value;
}
for (const trace of samples.traces)
  test(`full external Baron system ${trace.name}`, () => {
    const system = new BaronAttackSystem(program, trace.role as BaronAttackRole, trace.seed, {
      capacity: trace.capacity,
      birthFactors: () => ({ birthScale: 1, emitOffset: 1 }),
    });
    for (const [index, row] of trace.rows.entries()) {
      system.step(row.input);
      const checkpoint = system.checkpoint(),
        rng = ParticlePreviewRng.fromState(checkpoint.rng);
      const { rng: ignored, ...state } = checkpoint;
      void ignored;
      const reading = {
        ...state,
        packets: system.packets(),
        rngPeek: new Float32Array(Array.from({ length: 8 }, () => rng.unitFloat())),
      };
      const encoded = JSON.stringify(canonical(reading)),
        actual = createHash('sha256').update(encoded).digest('hex');
      if (actual !== row.expectedSha256) {
        const file = `artifacts/baron-system-owned-${trace.name}-${index + 1}-${actual.slice(0, 12)}.json`;
        if (!existsSync(file))
          writeFileSync(file, JSON.stringify(canonical(reading), null, 2) + '\n', { flag: 'wx' });
      }
      expect(actual, `${trace.name} step ${index + 1}`).toBe(row.expectedSha256);
      expect(system.count).toBe(row.count);
    }
  });
test('full external system fixtures reproduce without importing application kernels', () => {
  execFileSync(process.execPath, ['tools/assets/export-baron-system-samples.mjs', '--check'], {
    stdio: 'pipe',
  });
}, 15000);
