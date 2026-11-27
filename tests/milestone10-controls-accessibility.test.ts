import { describe, expect, it } from 'vitest';
import {
  COLOR_VISION_MODES,
  DEFAULT_KEYBINDINGS,
  HUD_SCALES,
  PLAYER_SETTINGS_STORAGE_KEY,
  REBINDABLE_ACTIONS,
  TEXT_SCALES,
  defaultPlayerSettings,
  formatKeyLabel,
  loadPlayerSettings,
  matchesActionKey,
  normalizeBindKey,
  rebindAction,
  resetPlayerSettings,
  sanitizePlayerSettings,
  savePlayerSettings,
} from '../src/storage/player-settings';
import { SNAPSHOT_RULESET, SNAPSHOT_VERSION } from '../src/simulation/snapshot';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
import { ORIGINAL_CHAMPIONS, ORIGINAL_LINEUP, originalSpellAmount } from '../src/content/original-lineup';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('Milestone 10: Player controls, keybindings, accessibility, and schema 189', () => {
  it('defaults preserve baseline gameplay controls and HUD parity', () => {
    const defaults = defaultPlayerSettings(false);
    expect(defaults.castMode).toBe('quick-indicator');
    expect(defaults.attackMoveMode).toBe('click');
    expect(defaults.targetChampionsOnlyMode).toBe('hold');
    expect(defaults.selfCastModifier).toBe(true);
    expect(defaults.hudScale).toBe(1);
    expect(defaults.textScale).toBe(1);
    expect(defaults.colorVision).toBe('default');
    expect(defaults.reducedMotion).toBe(false);
    expect(defaults.keybindings).toEqual(DEFAULT_KEYBINDINGS);
    expect(new Set(Object.values(defaults.keybindings)).size).toBe(REBINDABLE_ACTIONS.length);
  });

  it('rebinds actions cleanly, swaps conflicting keys, and rejects reserved keys', () => {
    const swapped = rebindAction(DEFAULT_KEYBINDINGS, 'q', 'w');
    expect(swapped).not.toBeNull();
    expect(swapped!.keybindings.q).toBe('w');
    expect(swapped!.keybindings.w).toBe('q');
    expect(swapped!.swappedWith).toBe('w');
    expect(new Set(Object.values(swapped!.keybindings)).size).toBe(REBINDABLE_ACTIONS.length);

    const fresh = rebindAction(DEFAULT_KEYBINDINGS, 'q', 'z');
    expect(fresh).not.toBeNull();
    expect(fresh!.keybindings.q).toBe('z');
    expect(fresh!.swappedWith).toBeNull();

    // Reserved keys (Escape, Tab, F1-F5, Control, Shift, Alt, Enter) are rejected
    for (const reserved of ['Escape', 'Tab', 'F1', 'F5', 'Control', 'Shift', 'Alt', 'Enter']) {
      expect(normalizeBindKey(reserved)).toBeNull();
      expect(rebindAction(DEFAULT_KEYBINDINGS, 'q', reserved)).toBeNull();
    }

    // Backquote and Space normalize and match reliably across keyboard layouts
    expect(normalizeBindKey('~', 'Backquote')).toBe('`');
    expect(normalizeBindKey(' ', 'Space')).toBe(' ');
    expect(formatKeyLabel(' ')).toBe('SPACE');
    expect(formatKeyLabel('`')).toBe('`');
    expect(matchesActionKey(DEFAULT_KEYBINDINGS, 'targetChampionsOnly', '~', 'Backquote')).toBe(
      true
    );
    expect(matchesActionKey(DEFAULT_KEYBINDINGS, 'recenter', ' ', 'Space')).toBe(true);
  });

  it('sanitizes malformed or colliding persisted settings without crashing', () => {
    const sanitized = sanitizePlayerSettings(
      {
        castMode: 'bogus',
        attackMoveMode: 'quick',
        targetChampionsOnlyMode: 'toggle',
        selfCastModifier: false,
        hudScale: 1.25,
        textScale: 999,
        colorVision: 'deuteranopia',
        reducedMotion: true,
        keybindings: {
          q: 'z',
          w: 'z', // duplicate must be resolved cleanly
          e: 'Escape', // reserved must be replaced
        },
      },
      false
    );
    expect(sanitized.castMode).toBe('quick-indicator');
    expect(sanitized.attackMoveMode).toBe('quick');
    expect(sanitized.targetChampionsOnlyMode).toBe('toggle');
    expect(sanitized.selfCastModifier).toBe(false);
    expect(sanitized.hudScale).toBe(1.25);
    expect(sanitized.textScale).toBe(1);
    expect(sanitized.colorVision).toBe('deuteranopia');
    expect(sanitized.reducedMotion).toBe(true);
    expect(sanitized.keybindings.q).toBe('z');
    expect(sanitized.keybindings.w).not.toBe('z');
    expect(sanitized.keybindings.e).not.toBe('escape');
    expect(new Set(Object.values(sanitized.keybindings)).size).toBe(REBINDABLE_ACTIONS.length);
  });

  it('persists, reloads, and resets PlayerSettings in browser storage without affecting ruleset', () => {
    const storage = createMemoryStorage();
    const rulesetBefore = SNAPSHOT_RULESET;
    const custom = {
      ...defaultPlayerSettings(false),
      castMode: 'normal' as const,
      attackMoveMode: 'quick' as const,
      targetChampionsOnlyMode: 'toggle' as const,
      hudScale: HUD_SCALES[HUD_SCALES.length - 1],
      textScale: TEXT_SCALES[TEXT_SCALES.length - 1],
      colorVision: COLOR_VISION_MODES[COLOR_VISION_MODES.length - 1],
      reducedMotion: true,
      keybindings: rebindAction(DEFAULT_KEYBINDINGS, 'q', 'z')!.keybindings,
    };
    savePlayerSettings(custom, storage);
    expect(storage.getItem(PLAYER_SETTINGS_STORAGE_KEY)).toBeTruthy();
    expect(loadPlayerSettings(storage, false)).toEqual(custom);
    expect(SNAPSHOT_RULESET).toBe(rulesetBefore);

    const reset = resetPlayerSettings(storage);
    expect(storage.getItem(PLAYER_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(reset.castMode).toBe('quick-indicator');
    expect(reset.colorVision).toBe('default');
  });

  it('supports Milestone 9 schema 188 save upgrade to Milestone 10 schema 189', () => {
    expect(SNAPSHOT_VERSION).toBeGreaterThanOrEqual(189);
    const world = new World(false, PRACTICE_FIXTURE);
    world.step(12);
    const snap = JSON.parse(world.snapshot()) as Record<string, unknown>;
    snap.version = 188;
    snap.ruleset = '878d8aaf2b241c5b515b21c68ee3efb33e35ceeae4b5e442240e2deb1c6e76a2';
    const restored = World.fromSnapshot(JSON.stringify(snap), PRACTICE_FIXTURE);
    expect(restored.tick).toBe(world.tick);
    expect(restored.hero.champion).toBe(world.hero.champion);
  });

  it('preserves calibrated original-lineup rank progression across all 5 original champions', () => {
    expect(ORIGINAL_CHAMPIONS.length).toBe(5);
    for (const id of ORIGINAL_CHAMPIONS) {
      const def = ORIGINAL_LINEUP[id];
      const qRank1 = originalSpellAmount(def.spells.q.damage ?? 60, 'q', 1);
      const qRank5 = originalSpellAmount(def.spells.q.damage ?? 60, 'q', 5);
      const rRank1 = originalSpellAmount(def.spells.r.damage ?? def.spells.r.heal ?? 150, 'r', 1);
      const rRank3 = originalSpellAmount(def.spells.r.damage ?? def.spells.r.heal ?? 150, 'r', 3);
      expect(qRank5 - qRank1).toBeGreaterThanOrEqual(80);
      expect(rRank3 - rRank1).toBeGreaterThanOrEqual(110);
    }
  });
});
