/** Browser preference only; never enters a match snapshot or ruleset. */
export const SOUND_PREFERENCE_KEY = 'browser-moba.sound.v1';

export function readSoundEnabled(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return (storage ?? globalThis.localStorage).getItem(SOUND_PREFERENCE_KEY) !== 'muted';
  } catch {
    return true;
  }
}

export function writeSoundEnabled(enabled: boolean, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(
      SOUND_PREFERENCE_KEY,
      enabled ? 'enabled' : 'muted'
    );
  } catch {
    // A blocked/quota-limited preference store must not interrupt the live toggle.
  }
}
