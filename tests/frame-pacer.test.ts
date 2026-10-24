import { describe, expect, test } from 'vitest';
import { FramePacer } from '../src/render/frame-pacer';

describe('presentation frame budget', () => {
  for (const hz of [30, 59.94, 60, 120, 144, 240])
    test(`bounds work at ${hz} Hz without slowing low-refresh displays`, () => {
      const pacer = new FramePacer();
      let rendered = 0;
      for (let i = 0; i < hz * 10; i++) if (pacer.ready((i * 1000) / hz)) rendered++;
      expect(rendered).toBeGreaterThanOrEqual(Math.min(hz * 10, 599));
      expect(rendered).toBeLessThanOrEqual(Math.min(Math.ceil(hz * 10), 601));
    });
  test('recovers from long stalls and wakes immediately after an interruption', () => {
    const pacer = new FramePacer();
    expect(pacer.ready(0)).toBe(true);
    expect(pacer.ready(5)).toBe(false);
    expect(pacer.ready(30000)).toBe(true);
    expect(pacer.ready(30005)).toBe(false);
    pacer.reset();
    expect(pacer.ready(30006)).toBe(true);
  });
});
