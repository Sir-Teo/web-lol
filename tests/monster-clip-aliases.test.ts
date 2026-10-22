import { expect, test } from 'vitest';
import { AnimationClip, NumberKeyframeTrack } from 'three';
import { monsterClipAliases } from '../src/render/monster-clip-aliases';

test('two spawn aliases retain identical source samples with independent names and tracks', () => {
  const source = new AnimationClip('source', 1, [
    new NumberKeyframeTrack('bone.position[x]', [0, 1], [0, 3]),
  ]);
  const unused = new AnimationClip('unused', 2, []);
  const clips = monsterClipAliases(
    [source, unused],
    { spawn: { name: 'source' }, spawn_mini1: { name: 'source' } },
    'wolf'
  );
  expect(clips.map((c) => c.name)).toEqual(['unused', 'spawn', 'spawn_mini1']);
  expect(source.name).toBe('source');
  expect(clips[0]).toBe(unused);
  expect(clips[1].tracks[0]).not.toBe(clips[2].tracks[0]);
  expect(clips[1].tracks[0].values).toEqual(source.tracks[0].values);
  expect(clips[2].tracks[0].values).toEqual(source.tracks[0].values);
  expect(() => monsterClipAliases([source], { spawn: { name: 'absent' } }, 'wolf')).toThrow(
    'wolf lacks absent'
  );
});
