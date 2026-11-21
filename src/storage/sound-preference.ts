/** Browser preference only; never enters a match snapshot or ruleset. */
export const SOUND_PREFERENCE_KEY = 'browser-moba.sound.v1';
export const SOUND_MIX_KEY = 'browser-moba.sound-mix.v1';

export interface SoundMixPreferences {
  master: number;
  combat: number;
  feedback: number;
  dynamicLimiter: boolean;
}

export const DEFAULT_SOUND_MIX: Readonly<SoundMixPreferences> = Object.freeze({
  master: 1,
  combat: 1,
  feedback: 1,
  dynamicLimiter: true,
});

function clampUnitGain(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, Math.round(value * 100) / 100))
    : fallback;
}

export function normalizeSoundMix(
  input: Partial<SoundMixPreferences> | null | undefined,
  base: SoundMixPreferences = DEFAULT_SOUND_MIX
): SoundMixPreferences {
  return {
    master: clampUnitGain(input?.master, base.master),
    combat: clampUnitGain(input?.combat, base.combat),
    feedback: clampUnitGain(input?.feedback, base.feedback),
    dynamicLimiter:
      typeof input?.dynamicLimiter === 'boolean' ? input.dynamicLimiter : base.dynamicLimiter,
  };
}

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

export function readSoundMix(storage?: Pick<Storage, 'getItem'>): SoundMixPreferences {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(SOUND_MIX_KEY);
    if (!raw) return { ...DEFAULT_SOUND_MIX };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SOUND_MIX };
    return normalizeSoundMix(parsed as Partial<SoundMixPreferences>);
  } catch {
    return { ...DEFAULT_SOUND_MIX };
  }
}

export function writeSoundMix(mix: SoundMixPreferences, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(
      SOUND_MIX_KEY,
      JSON.stringify(normalizeSoundMix(mix))
    );
  } catch {
    // Preference storage failure must not interrupt gameplay audio.
  }
}
