import { seenFrom, type VisionSource } from '../simulation/vision';
import type { Vec2 } from '../simulation/math';

interface ObserverSamples {
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** 0 = unknown, 1 = visible, 2 = blocked. Includes radial rejection. */
  samples: Uint8Array;
}

/** Exact presentation sampling. Gameplay never reads this cache. */
export class FogSampler {
  private observers = new Map<string, ObserverSamples>();
  private revision: number | undefined;
  private sight?: (from: Vec2, to: Vec2) => boolean;
  private mask: Uint8Array;
  private coordinates: Float64Array;

  constructor(
    readonly size: number,
    readonly span: number
  ) {
    this.mask = new Uint8Array(size * size);
    this.coordinates = Float64Array.from(
      { length: size },
      (_, i) => ((i + 0.5) / size - 0.5) * span
    );
  }

  /** A revision is an explicit promise that terrain sight is unchanged until it advances.
   * Omitting it disables cross-update reuse, including for mutable custom battlefields.
   * Only current source keys survive an update; dead/expired/moved observers are evicted.
   */
  sample(
    sources: readonly VisionSource[],
    sight: (from: Vec2, to: Vec2) => boolean,
    revision?: number
  ): Uint8Array {
    if (revision === undefined || revision !== this.revision || sight !== this.sight)
      this.observers.clear();
    this.revision = revision;
    this.sight = sight;
    this.mask.fill(0);
    const current = new Map<string, ObserverSamples>();
    const point = { x: 0, y: 0 };
    for (const source of sources) {
      // No quantization: sub-cell movement can change a terrain ray.
      const key = `${source.x},${source.y},${source.radius},${!!source.unobstructed}`;
      let entry = current.get(key) ?? this.observers.get(key);
      if (!entry) {
        const x0 = Math.max(
          0,
          Math.floor(((source.x - source.radius) / this.span + 0.5) * this.size)
        );
        const y0 = Math.max(
          0,
          Math.floor(((source.y - source.radius) / this.span + 0.5) * this.size)
        );
        const x1 = Math.min(
          this.size - 1,
          Math.ceil(((source.x + source.radius) / this.span + 0.5) * this.size)
        );
        const y1 = Math.min(
          this.size - 1,
          Math.ceil(((source.y + source.radius) / this.span + 0.5) * this.size)
        );
        const width = Math.max(0, x1 - x0 + 1),
          height = Math.max(0, y1 - y0 + 1);
        entry = { x0, y0, width, height, samples: new Uint8Array(width * height) };
      }
      current.set(key, entry);
      const single = [source];
      for (let y = 0; y < entry.height; y++) {
        point.y = this.coordinates[entry.y0 + y];
        for (let x = 0; x < entry.width; x++) {
          const output = (entry.y0 + y) * this.size + entry.x0 + x;
          if (this.mask[output]) continue;
          const index = y * entry.width + x;
          let value = entry.samples[index];
          if (!value) {
            point.x = this.coordinates[entry.x0 + x];
            value = seenFrom(point, single, sight) ? 1 : 2;
            entry.samples[index] = value;
          }
          if (value === 1) this.mask[output] = 1;
        }
      }
    }
    this.observers = current;
    return this.mask;
  }
}
