import { AuthoredMipTextureCache } from './authored-mip-texture-cache';
/** Page-owned source textures shared by W cast/buff programs. Each program
 * retains its independent closure/readiness and explicit retry policy. */
export const meditateTextures = new AuthoredMipTextureCache();
