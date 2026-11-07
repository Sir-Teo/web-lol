import { expect, test } from 'vitest';
import {
  SOUND_PREFERENCE_KEY,
  readSoundEnabled,
  writeSoundEnabled,
} from '../src/storage/sound-preference';

test('only the explicit muted token disables sound; missing and invalid data keep the default', () => {
  for (const value of [null, '', 'enabled', 'false', 'corrupt'])
    expect(readSoundEnabled({ getItem: () => value })).toBe(true);
  expect(readSoundEnabled({ getItem: () => 'muted' })).toBe(false);
});
test('mute and unmute persist independently of match saves', () => {
  const values = new Map<string, string>([['match-save', 'retained checkpoint']]);
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  writeSoundEnabled(false, store);
  expect(readSoundEnabled(store)).toBe(false);
  writeSoundEnabled(true, store);
  expect(readSoundEnabled(store)).toBe(true);
  expect([...values.keys()]).toEqual(['match-save', SOUND_PREFERENCE_KEY]);
  expect(values.get('match-save')).toBe('retained checkpoint');
});
test('unavailable storage defaults safely and failed writes do not break live controls', () => {
  const blocked = () => {
    throw new Error('Storage access denied');
  };
  expect(readSoundEnabled({ getItem: blocked })).toBe(true);
  expect(() => writeSoundEnabled(false, { setItem: blocked })).not.toThrow();
  const inaccessible = {
    get getItem(): Storage['getItem'] {
      throw new Error('Blocked storage getter');
    },
  };
  expect(readSoundEnabled(inaccessible)).toBe(true);
});
