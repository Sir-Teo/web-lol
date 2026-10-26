import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
/** Page-owned Yi source textures; each effect retains independent readiness,
 * verified successes and explicit retry. Borrowers never dispose shared bitmaps. */
export const masterYiTextures = new AuthoredMipTextureCache();
