import test from 'node:test';
import assert from 'node:assert/strict';
import {
  float64Hex,
  float64FromHex,
  traceSamplerMath,
  replaySamplerTrig,
  samplerSnapshot,
} from './lib/lux-e-sampler-audit.ts';

test('captured float bits preserve signed zero and finite boundary values through JSON', () => {
  for (const value of [-0, 0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -1, 0.1]) {
    const encoded = JSON.parse(JSON.stringify({ result: value, bits: float64Hex(value) }));
    assert(Object.is(float64FromHex(encoded.bits), value));
  }
  assert.equal(float64Hex(-0), '8000000000000000');
  assert.throws(() => float64FromHex('not-a-float'), /Invalid float64/);
});

test('a failed sampler restores every intercepted native math function', () => {
  const names = ['sin', 'cos', 'hypot', 'sqrt', 'pow', 'exp', 'atan2', 'acos'],
    original = new Map(names.map((name) => [name, Math[name]]));
  assert.throws(
    () =>
      traceSamplerMath(() => {
        throw Error('fixture sampler failure');
      }),
    /fixture sampler failure/
  );
  for (const [name, value] of original) assert.equal(Math[name], value);
});

test('trig replay uses captured signed-zero bits and restores native functions on missing inputs', () => {
  const original = { sin: Math.sin, cos: Math.cos };
  const sampler = (_role, _seed, age) => [{ profileIndex: 0, value: Math.sin(-0) + Math.cos(age) }];
  const trace = traceSamplerMath(sampler),
    transported = JSON.parse(JSON.stringify(trace.calls));
  assert.equal(trace.samples, samplerSnapshot(sampler));
  assert.equal(replaySamplerTrig(sampler, transported).samples, trace.samples);
  assert.throws(() => replaySamplerTrig(sampler, []), /Missing recorded trig input/);
  assert.equal(Math.sin, original.sin);
  assert.equal(Math.cos, original.cos);
});
