/** Persistent browser-only player controls, keybindings, and accessibility preferences.
 * Never enters match snapshots, replay streams, or the simulation ruleset fingerprint. */

export type CastMode = 'quick-indicator' | 'quick' | 'normal';
export type AttackMoveMode = 'click' | 'quick';
export type TargetChampionsOnlyMode = 'hold' | 'toggle';
export type ColorVisionMode =
  | 'default'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'high-contrast';

export const HUD_SCALE_OPTIONS = [0.75, 0.85, 1, 1.15, 1.25] as const;
export const HUD_SCALES = HUD_SCALE_OPTIONS;
export type HudScale = (typeof HUD_SCALE_OPTIONS)[number];

export const TEXT_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25] as const;
export const TEXT_SCALES = TEXT_SCALE_OPTIONS;
export type TextScale = (typeof TEXT_SCALE_OPTIONS)[number];

export const CAST_MODES: readonly CastMode[] = ['quick-indicator', 'quick', 'normal'];
export const ATTACK_MOVE_MODES: readonly AttackMoveMode[] = ['click', 'quick'];
export const TARGET_CHAMPIONS_ONLY_MODES: readonly TargetChampionsOnlyMode[] = ['hold', 'toggle'];
export const COLOR_VISION_MODES: readonly ColorVisionMode[] = [
  'default',
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'high-contrast',
];
export const COLOR_VISION_LABELS: Readonly<Record<ColorVisionMode, string>> = {
  default: 'Default',
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  'high-contrast': 'High contrast',
};

export type RebindableAction =
  | 'q'
  | 'w'
  | 'e'
  | 'r'
  | 'd'
  | 'f'
  | 'trinket'
  | 'item0'
  | 'item1'
  | 'item2'
  | 'item3'
  | 'item4'
  | 'item5'
  | 'attackMove'
  | 'stop'
  | 'recall'
  | 'shop'
  | 'cameraLock'
  | 'recenter'
  | 'targetChampionsOnly'
  | 'help';

export type Keybindings = Record<RebindableAction, string>;

export interface PlayerSettings {
  castMode: CastMode;
  attackMoveMode: AttackMoveMode;
  targetChampionsOnlyMode: TargetChampionsOnlyMode;
  selfCastModifier: boolean;
  keybindings: Keybindings;
  hudScale: HudScale;
  textScale: TextScale;
  colorVision: ColorVisionMode;
  reducedMotion: boolean;
}

export const REBINDABLE_ACTIONS: readonly RebindableAction[] = [
  'q',
  'w',
  'e',
  'r',
  'd',
  'f',
  'trinket',
  'item0',
  'item1',
  'item2',
  'item3',
  'item4',
  'item5',
  'attackMove',
  'stop',
  'recall',
  'shop',
  'cameraLock',
  'recenter',
  'targetChampionsOnly',
  'help',
];

export const DEFAULT_KEYBINDINGS: Readonly<Keybindings> = {
  q: 'q',
  w: 'w',
  e: 'e',
  r: 'r',
  d: 'd',
  f: 'f',
  trinket: '4',
  item0: '1',
  item1: '2',
  item2: '3',
  item3: '5',
  item4: '6',
  item5: '7',
  attackMove: 'a',
  stop: 's',
  recall: 'b',
  shop: 'p',
  cameraLock: 'y',
  recenter: ' ',
  targetChampionsOnly: '`',
  help: 'h',
};

export const REBINDABLE_ACTION_LABELS: Readonly<Record<RebindableAction, string>> = {
  q: 'Ability Q',
  w: 'Ability W',
  e: 'Ability E',
  r: 'Ultimate R',
  d: 'Summoner D',
  f: 'Summoner F',
  trinket: 'Trinket ward',
  item0: 'Item slot 1',
  item1: 'Item slot 2',
  item2: 'Item slot 3',
  item3: 'Item slot 4',
  item4: 'Item slot 5',
  item5: 'Item slot 6',
  attackMove: 'Attack-move',
  stop: 'Stop / Hold',
  recall: 'Recall',
  shop: 'Item shop',
  cameraLock: 'Toggle camera lock',
  recenter: 'Center camera',
  targetChampionsOnly: 'Target champions only',
  help: 'Controls help',
};

export const PLAYER_SETTINGS_STORAGE_KEY = 'rift.player-settings.v1';

const RESERVED_KEYS = new Set([
  'escape',
  'tab',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'control',
  'shift',
  'alt',
  'meta',
  'enter',
  'backspace',
  'capslock',
]);

export function prefersReducedMotionSystem(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

export function defaultPlayerSettings(reducedMotion = prefersReducedMotionSystem()): PlayerSettings {
  return {
    castMode: 'quick-indicator',
    attackMoveMode: 'click',
    targetChampionsOnlyMode: 'hold',
    selfCastModifier: true,
    keybindings: { ...DEFAULT_KEYBINDINGS },
    hudScale: 1,
    textScale: 1,
    colorVision: 'default',
    reducedMotion,
  };
}

/** Normalize a keyboard event key into a canonical stored binding token, or null if reserved/invalid. */
export function normalizeBindKey(rawKey: string, code?: string): string | null {
  if (code === 'Backquote') return '`';
  if (code === 'Space') return ' ';
  if (!rawKey || rawKey === 'Unidentified' || rawKey === 'Dead') return null;
  const lower = rawKey === ' ' ? ' ' : rawKey.toLowerCase();
  if (RESERVED_KEYS.has(lower)) return null;
  if (lower === ' ') return ' ';
  if (lower.length === 1 && /^[a-z0-9`\-=[\]\\;',./]$/.test(lower)) return lower;
  return null;
}

export function formatKeyLabel(key: string): string {
  if (key === ' ') return 'SPACE';
  if (key === '`') return '`';
  return key.toUpperCase();
}

export function isRebindableAction(value: string): value is RebindableAction {
  return Object.hasOwn(DEFAULT_KEYBINDINGS, value);
}

/** Rebind an action to `key`, swapping with any other action that previously owned `key`. */
export function rebindAction(
  bindings: Readonly<Keybindings>,
  action: RebindableAction,
  rawKey: string,
  code?: string
): { keybindings: Keybindings; swappedWith: RebindableAction | null } | null {
  const normalized = normalizeBindKey(rawKey, code);
  if (!normalized) return null;
  const next: Keybindings = { ...bindings };
  const previous = next[action];
  let swappedWith: RebindableAction | null = null;
  for (const other of Object.keys(next) as RebindableAction[]) {
    if (other !== action && next[other] === normalized) {
      next[other] = previous;
      swappedWith = other;
      break;
    }
  }
  next[action] = normalized;
  return { keybindings: next, swappedWith };
}

/** Match a keyboard event against the configured keybinding for an action. */
export function matchesActionKey(
  bindings: Readonly<Keybindings>,
  action: RebindableAction,
  key: string,
  code?: string
): boolean {
  const bound = bindings[action];
  if (bound === '`') return key === '`' || key === '~' || code === 'Backquote';
  if (bound === ' ') return key === ' ' || code === 'Space';
  return key.toLowerCase() === bound;
}

function sanitizeKeybindings(raw: unknown): Keybindings {
  const result: Keybindings = { ...DEFAULT_KEYBINDINGS };
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  const used = new Set<string>();
  const actions = Object.keys(DEFAULT_KEYBINDINGS) as RebindableAction[];
  for (const action of actions) {
    const candidate = typeof obj[action] === 'string' ? normalizeBindKey(obj[action]) : null;
    if (candidate && !used.has(candidate)) {
      result[action] = candidate;
      used.add(candidate);
    } else {
      result[action] = '';
    }
  }
  // Fill any missing/colliding slots with defaults or free keys so every action remains bound uniquely.
  const fallbackPool = [
    ...Object.values(DEFAULT_KEYBINDINGS),
    'z',
    'x',
    'c',
    'v',
    'g',
    't',
    'n',
    'm',
    '8',
    '9',
    '0',
  ];
  for (const action of actions) {
    if (result[action]) continue;
    const def = DEFAULT_KEYBINDINGS[action];
    if (!used.has(def)) {
      result[action] = def;
      used.add(def);
    } else {
      const free = fallbackPool.find((k) => !used.has(k)) ?? def;
      result[action] = free;
      used.add(free);
    }
  }
  return result;
}

export function sanitizePlayerSettings(
  raw: unknown,
  fallbackReducedMotion = prefersReducedMotionSystem()
): PlayerSettings {
  const defaults = defaultPlayerSettings(fallbackReducedMotion);
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    castMode: CAST_MODES.includes(obj.castMode as CastMode)
      ? (obj.castMode as CastMode)
      : defaults.castMode,
    attackMoveMode: ATTACK_MOVE_MODES.includes(obj.attackMoveMode as AttackMoveMode)
      ? (obj.attackMoveMode as AttackMoveMode)
      : defaults.attackMoveMode,
    targetChampionsOnlyMode: TARGET_CHAMPIONS_ONLY_MODES.includes(
      obj.targetChampionsOnlyMode as TargetChampionsOnlyMode
    )
      ? (obj.targetChampionsOnlyMode as TargetChampionsOnlyMode)
      : defaults.targetChampionsOnlyMode,
    selfCastModifier:
      typeof obj.selfCastModifier === 'boolean' ? obj.selfCastModifier : defaults.selfCastModifier,
    keybindings: sanitizeKeybindings(obj.keybindings),
    hudScale: HUD_SCALE_OPTIONS.includes(obj.hudScale as HudScale)
      ? (obj.hudScale as HudScale)
      : defaults.hudScale,
    textScale: TEXT_SCALE_OPTIONS.includes(obj.textScale as TextScale)
      ? (obj.textScale as TextScale)
      : defaults.textScale,
    colorVision: COLOR_VISION_MODES.includes(obj.colorVision as ColorVisionMode)
      ? (obj.colorVision as ColorVisionMode)
      : defaults.colorVision,
    reducedMotion:
      typeof obj.reducedMotion === 'boolean' ? obj.reducedMotion : defaults.reducedMotion,
  };
}

export function loadPlayerSettings(
  storage?: Pick<Storage, 'getItem'> | null,
  fallbackReducedMotion = prefersReducedMotionSystem()
): PlayerSettings {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!target) return defaultPlayerSettings(fallbackReducedMotion);
  try {
    const raw = target.getItem(PLAYER_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultPlayerSettings(fallbackReducedMotion);
    return sanitizePlayerSettings(JSON.parse(raw), fallbackReducedMotion);
  } catch {
    return defaultPlayerSettings(fallbackReducedMotion);
  }
}

export function savePlayerSettings(
  settings: PlayerSettings,
  storage?: Pick<Storage, 'setItem'> | null
): PlayerSettings {
  const sanitized = sanitizePlayerSettings(settings, settings.reducedMotion);
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (target) {
    try {
      target.setItem(PLAYER_SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Persistence is optional in restricted browser contexts.
    }
  }
  return sanitized;
}

export function resetPlayerSettings(
  storage?: Pick<Storage, 'removeItem' | 'setItem'> | null
): PlayerSettings {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (target && 'removeItem' in target) {
    try {
      target.removeItem(PLAYER_SETTINGS_STORAGE_KEY);
    } catch {
      // Persistence is optional in restricted browser contexts.
    }
  }
  return defaultPlayerSettings();
}
