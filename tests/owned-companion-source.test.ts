import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import source from '../src/content/owned-companions.json';
import icons from '../docs/reference/owned-companion-icons.json';
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
test('controlled companion inputs retain all three rig/clip sources without changing source manifests', () => {
  expect(sha(source.sourcePin)).toBe(source.sourceSha256);
  for (const p of Object.values(source.profiles)) {
    const m = JSON.parse(readFileSync(`public/assets/models/${p.rig}.json`, 'utf8'));
    expect(m.output.sha256).toBe(p.modelSha256);
    expect(sha(`public/assets/models/${p.rig}.glb`)).toBe(p.modelSha256);
    expect(Object.keys(p.clips).sort()).toEqual([
      'attack',
      'heal',
      'idle',
      'run',
      'smite',
      'spawn',
      'transform',
    ]);
    for (const clip of Object.values(p.clips))
      expect(
        m.clips.some((c: any) => c.name === clip.name && c.durationSeconds === clip.durationSeconds)
      ).toBe(true);
  }
  expect(source.firstEvolutionFeeds).toBe(15);
  expect(source.fullGrowthFeeds).toBe(35);
  expect(source.controllerValues.LargeMonsterBonusGold).toBeNull();
});
test('four upgraded Smite icons decode from the pinned original DATA archive rather than substitute images', () => {
  expect(icons.extraction.archive).toBe('DATA/FINAL/DATA.wad.client');
  expect(icons.icons).toHaveLength(4);
  for (const item of icons.icons) {
    expect(sha(item.path)).toBe(item.sha256);
    expect(readFileSync(item.path).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(icons.extraction.files.find((f) => f.path === item.sourcePath)?.sha256).toBe(
      item.sourceSha256
    );
    expect(source.icons).toContainEqual(item);
  }
});
