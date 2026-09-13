import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { ASHE_RECALL_CLIPS } from '../src/render/recall-animation';

test('recall order matches the pinned base animation graph sequence', () => {
  const pin = JSON.parse(readFileSync('docs/reference/ashe-model.json', 'utf8'));
  const clips = pin.animations.data['Characters/Ashe/Animations/Skin0'].mClipDataMap;
  expect(clips.Recall.__type).toBe('SequencerClipData');
  expect(ASHE_RECALL_CLIPS).toEqual(clips.Recall.mClipNameList.map((s: string) => s.toLowerCase()));
  for (const name of clips.Recall.mClipNameList) expect(clips[name].__type).toBe('AtomicClipData');
});
