import type * as THREE from 'three';

/** GPU-only LRU eviction. Original CPU texture data stays available for an exact
 * re-upload. Textures drawn this frame are never evicted to satisfy a budget. */
export class MapTextureResidency {
  private frame = 0;
  private entries = new Map<
    THREE.Texture,
    { bytes: number; lastFrame: number; resident: boolean }
  >();
  evictions = 0;
  constructor(readonly budgetBytes = 256 * 1024 * 1024) {}
  beginFrame() {
    this.frame++;
  }
  touch(texture: THREE.Texture, bytes: number) {
    const existing = this.entries.get(texture);
    if (existing) {
      existing.lastFrame = this.frame;
      existing.resident = true;
    } else this.entries.set(texture, { bytes, lastFrame: this.frame, resident: true });
  }
  endFrame() {
    let bytes = this.residentBytes;
    if (bytes <= this.budgetBytes) return;
    const candidates = [...this.entries]
      .filter(([, e]) => e.resident && e.lastFrame !== this.frame)
      .sort((a, b) => a[1].lastFrame - b[1].lastFrame);
    for (const [texture, entry] of candidates) {
      if (bytes <= this.budgetBytes) break;
      texture.dispose();
      entry.resident = false;
      bytes -= entry.bytes;
      this.evictions++;
    }
  }
  get residentBytes() {
    return [...this.entries.values()].reduce((sum, e) => sum + (e.resident ? e.bytes : 0), 0);
  }
  get currentFrameBytes() {
    return [...this.entries.values()].reduce(
      (sum, e) => sum + (e.resident && e.lastFrame === this.frame ? e.bytes : 0),
      0
    );
  }
  get residentCount() {
    return [...this.entries.values()].filter((e) => e.resident).length;
  }
}
