import type * as THREE from 'three';
import { loadAuthoredMipTexture, type AuthoredMipAsset } from './authored-mip-texture';

type Resource = Awaited<ReturnType<typeof loadAuthoredMipTexture>>;
interface Entry {
  signature: string;
  promise: Promise<THREE.Texture>;
  resource?: Resource;
}
/** One owner for shared authored textures and their bitmaps. Consumers borrow
 * textures; only the cache disposes them. Failed requests are evicted, while
 * callers decide when to retry. A pending request never owns unrelated assets. */
export class AuthoredMipTextureCache {
  private entries = new Map<string, Entry>();
  private closed = false;
  constructor(private loader = loadAuthoredMipTexture) {}
  load(asset: AuthoredMipAsset, lookup: boolean): Promise<THREE.Texture> {
    if (this.closed) return Promise.reject(Error('Authored texture cache is disposed'));
    const signature = JSON.stringify({
      bytes: asset.bytes,
      sha256: asset.sha256,
      width: asset.width,
      height: asset.height,
      rectangles: asset.rectangles.map(({ level, x, y, width, height }) => [
        level,
        x,
        y,
        width,
        height,
      ]),
      lookup,
    });
    const previous = this.entries.get(asset.url);
    if (previous)
      return previous.signature === signature
        ? previous.promise
        : Promise.reject(Error('Conflicting shared authored texture declaration: ' + asset.url));
    const entry: Entry = {
      signature,
      promise: Promise.resolve()
        .then(async () => {
          const resource = await this.loader(asset, lookup);
          if (this.closed) {
            resource.dispose();
            throw Error('Authored texture cache disposed during load');
          }
          entry.resource = resource;
          return resource.texture;
        })
        .catch((error) => {
          if (this.entries.get(asset.url) === entry) this.entries.delete(asset.url);
          throw error;
        }),
    };
    this.entries.set(asset.url, entry);
    return entry.promise;
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.entries.values()) entry.resource?.dispose();
    this.entries.clear();
  }
}
