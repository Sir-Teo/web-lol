/** Investigation helpers, outside the game import graph. */
export type Sampler = (
  role: 'ally' | 'enemy',
  seed: number,
  age: number
) => { profileIndex: number }[];
export interface MathCall {
  key: string;
  name: string;
  args: number[];
  result: number;
  bits: string;
  count: number;
}
const scratch = new DataView(new ArrayBuffer(8));
export function float64Hex(value: number): string {
  scratch.setFloat64(0, value);
  return scratch.getBigUint64(0).toString(16).padStart(16, '0');
}
export function float64FromHex(hex: string): number {
  if (!/^[0-9a-f]{16}$/.test(hex)) throw Error('Invalid float64 bit pattern');
  scratch.setBigUint64(0, BigInt('0x' + hex));
  return scratch.getFloat64(0);
}
export function samplerSnapshot(sampler: Sampler): string {
  return JSON.stringify(
    (['ally', 'enemy'] as const).flatMap((role) =>
      [91, 927].flatMap((seed) =>
        [0, 0.1, 0.5, 1, 2.5, 4.8].map((age) => ({
          role,
          seed,
          age,
          particles: sampler(role, seed, age).filter((q) => q.profileIndex < 15),
        }))
      )
    )
  );
}
export function traceSamplerMath(sampler: Sampler) {
  const names = ['sin', 'cos', 'hypot', 'sqrt', 'pow', 'exp', 'atan2', 'acos'] as const;
  const calls = new Map<string, MathCall>(),
    saved = new Map<string, (...args: number[]) => number>();
  for (const name of names) {
    const original = Math[name] as (...args: number[]) => number;
    saved.set(name, original);
    (Math as unknown as Record<string, (...args: number[]) => number>)[name] = (...args) => {
      const result = original(...args),
        key = name + ':' + args.map(float64Hex).join(','),
        prior = calls.get(key);
      if (prior) {
        prior.count++;
        if (prior.bits !== float64Hex(result)) throw Error('Unstable repeated math result');
      } else calls.set(key, { key, name, args, result, bits: float64Hex(result), count: 1 });
      return result;
    };
  }
  try {
    return { samples: samplerSnapshot(sampler), calls: [...calls.values()] };
  } finally {
    for (const [name, original] of saved)
      (Math as unknown as Record<string, (...args: number[]) => number>)[name] = original;
  }
}
export function replaySamplerTrig(sampler: Sampler, calls: MathCall[]) {
  const table = new Map(
      calls.filter((r) => r.name === 'sin' || r.name === 'cos').map((r) => [r.key, r])
    ),
    saved = { sin: Math.sin, cos: Math.cos };
  let replayedCalls = 0;
  for (const name of ['sin', 'cos'] as const)
    Math[name] = (argument) => {
      const key = name + ':' + float64Hex(argument),
        row = table.get(key);
      if (!row) throw Error('Missing recorded trig input: ' + key);
      // Decimal JSON loses signed zero. The captured bits are canonical.
      const exact = float64FromHex(row.bits);
      if (exact !== row.result) throw Error('Trace numeric transport changed');
      replayedCalls++;
      return exact;
    };
  try {
    return { samples: samplerSnapshot(sampler), replayedCalls };
  } finally {
    Math.sin = saved.sin;
    Math.cos = saved.cos;
  }
}
