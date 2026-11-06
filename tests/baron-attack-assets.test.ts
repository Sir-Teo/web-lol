import { beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const checked = vi.hoisted(() => vi.fn());
vi.mock('../src/render/authored-mip-texture', () => ({ checkedAssetBytes: checked }));
beforeEach(() => {
  vi.resetModules();
  checked.mockReset();
});
const raw = readFileSync('public/assets/effects/baron-attack/program.json');
const bytes = () => Uint8Array.from(raw).buffer;
test('Baron assets load lazily, share requests and preserve the pinned transport closure', async () => {
  const assets = await import('../src/render/baron-attack-assets');
  expect(checked).not.toHaveBeenCalled();
  checked.mockResolvedValue(bytes());
  const a = assets.loadBaronAttackAssets(),
    b = assets.loadBaronAttackAssets();
  expect(a).toBe(b);
  const program = await a;
  expect(checked).toHaveBeenCalledExactlyOnceWith(
    assets.BARON_ATTACK_ASSET_ROOT + 'program.json',
    raw.length,
    assets.BARON_ATTACK_PROGRAM_SHA256
  );
  expect(createHash('sha256').update(raw).digest('hex')).toBe(assets.BARON_ATTACK_PROGRAM_SHA256);
  expect(Object.isFrozen(program.profiles[0].settings)).toBe(true);
  expect(program.textures).toHaveLength(25);
  expect(program.meshes).toHaveLength(2);
  for (const row of [...program.textures.map((t) => ({ ...t, name: t.path })), ...program.meshes]) {
    const content = readFileSync('public/' + assets.BARON_ATTACK_ASSET_ROOT + row.name);
    expect(content.length).toBe(row.bytes);
    expect(createHash('sha256').update(content).digest('hex')).toBe(row.sha256);
  }
  expect(assets.baronTextureAsset(program.textures[0]).url).toBe(
    assets.BARON_ATTACK_ASSET_ROOT + program.textures[0].path
  );
});
test('failed integrity/fetch and JSON reads are evicted for a later retry', async () => {
  const { loadBaronAttackAssets } = await import('../src/render/baron-attack-assets');
  checked
    .mockRejectedValueOnce(Error('checksum differs'))
    .mockResolvedValueOnce(new TextEncoder().encode('{').buffer)
    .mockResolvedValueOnce(bytes());
  await expect(loadBaronAttackAssets()).rejects.toThrow('checksum differs');
  await expect(loadBaronAttackAssets()).rejects.toThrow();
  await expect(loadBaronAttackAssets()).resolves.toHaveProperty('format', 2);
  expect(checked).toHaveBeenCalledTimes(3);
});
