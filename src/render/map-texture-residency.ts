import type * as THREE from 'three';

/** GPU-only LRU eviction. Original CPU texture data stays available for an exact
 * re-upload. Textures drawn this frame are never evicted to satisfy a budget. */
export class MapTextureResidency {
  private frame = 0;
  private entries = new Map<
    THREE.Texture,
    { bytes: number; lastFrame: number; drawnFrame: number; resident: boolean }
  >();
  evictions = 0;
  constructor(readonly budgetBytes = 256 * 1024 * 1024) {}
  beginFrame() {
    this.frame++;
  }
  touch(texture: THREE.Texture, bytes: number) {
    const existing = this.entries.get(texture);
    if (existing) {
      existing.lastFrame = existing.drawnFrame = this.frame;
      existing.resident = true;
    } else
      this.entries.set(texture, {
        bytes,
        lastFrame: this.frame,
        drawnFrame: this.frame,
        resident: true,
      });
  }
  endFrame() {
    let bytes = this.residentBytes;
    if (bytes <= this.budgetBytes) return;
    const candidates = [...this.entries]
      .filter(([, e]) => e.resident && e.drawnFrame !== this.frame)
      .sort((a, b) => a[1].lastFrame - b[1].lastFrame);
    for (const [texture, entry] of candidates) {
      if (bytes <= this.budgetBytes) break;
      texture.dispose();
      entry.resident = false;
      bytes -= entry.bytes;
      this.evictions++;
    }
  }
  /** Warm nearby textures after drawing. Never displace visible or other nearby
   * textures, and never exceed the residency target for speculative uploads. */
  prefetch(
    nearby: ReadonlyMap<THREE.Texture, number>,
    upload: (texture: THREE.Texture) => void,
    now = () => performance.now(),
    maxUploads = 2,
    maxMS = 2
  ) {
    const start = now();
    let count = 0;
    for (const [texture, bytes] of nearby) {
      if (count >= maxUploads || now() - start >= maxMS) break;
      if (this.entries.get(texture)?.resident) continue;
      const candidates = [...this.entries]
        .filter(([t, e]) => e.resident && e.drawnFrame !== this.frame && !nearby.has(t))
        .sort((a, b) => a[1].lastFrame - b[1].lastFrame);
      let available = this.budgetBytes - this.residentBytes;
      if (available + candidates.reduce((sum, [, e]) => sum + e.bytes, 0) < bytes) continue;
      for (const [old, entry] of candidates) {
        if (available >= bytes) break;
        old.dispose();
        entry.resident = false;
        available += entry.bytes;
        this.evictions++;
      }
      upload(texture);
      this.entries.set(texture, { bytes, lastFrame: this.frame, drawnFrame: -1, resident: true });
      count++;
    }
    return count;
  }
  get residentBytes() {
    return [...this.entries.values()].reduce((sum, e) => sum + (e.resident ? e.bytes : 0), 0);
  }
  get currentFrameBytes() {
    return [...this.entries.values()].reduce(
      (sum, e) => sum + (e.resident && e.drawnFrame === this.frame ? e.bytes : 0),
      0
    );
  }
  get residentCount() {
    return [...this.entries.values()].filter((e) => e.resident).length;
  }
}
