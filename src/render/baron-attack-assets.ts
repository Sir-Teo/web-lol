import { checkedAssetBytes, type AuthoredMipAsset } from './authored-mip-texture';
import type { BaronAttackProgram } from './baron-attack-program';

export const BARON_ATTACK_ASSET_ROOT = 'assets/effects/baron-attack/';
export const BARON_ATTACK_PROGRAM_SHA256 =
  '4cbf74ec11628b0a840d03687c9d77995d57a2251b016950ac39357cc0e1cd3d';
interface TextureTransport extends Omit<AuthoredMipAsset, 'url'> {
  path: string;
  source: { wadPathHash: string };
}
interface MeshTransport {
  name: string;
  bytes: number;
  sha256: string;
  source: { wadPathHash: string };
}
export interface BaronAttackAssets extends BaronAttackProgram {
  textures: TextureTransport[];
  meshes: MeshTransport[];
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
let pending: Promise<BaronAttackAssets> | undefined;
/** Nothing is fetched at module import. Failed reads can be retried by the owner. */
export function loadBaronAttackAssets(): Promise<BaronAttackAssets> {
  return (pending ??= checkedAssetBytes(
    BARON_ATTACK_ASSET_ROOT + 'program.json',
    223594,
    BARON_ATTACK_PROGRAM_SHA256
  )
    .then((raw) =>
      freeze(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as BaronAttackAssets)
    )
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
export function baronTextureAsset(row: TextureTransport): AuthoredMipAsset {
  return { ...row, url: BARON_ATTACK_ASSET_ROOT + row.path };
}
