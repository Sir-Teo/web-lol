import type { MatchRole } from './bot-roles';

export const ORIGINAL_CHAMPIONS = ['brannic', 'taviq', 'irielle', 'vess', 'oona'] as const;
export type OriginalChampion = (typeof ORIGINAL_CHAMPIONS)[number];
export type OriginalSlot = 'q' | 'w' | 'e' | 'r';
export const ORIGINAL_SLOTS = ['q', 'w', 'e', 'r'] as const;

export interface OriginalSpell {
  name: string;
  description: string;
  shape: 'line' | 'disk' | 'self' | 'dash' | 'ring';
  range: number;
  radius: number;
  windup: number;
  mana: number;
  cooldown: number;
  damage?: number;
  physical?: boolean;
  first?: boolean;
  slow?: number;
  root?: number;
  shield?: number;
  heal?: number;
}

interface OriginalChampionDefinition {
  name: string;
  subtitle: string;
  role: MatchRole;
  passive: { name: string; description: string };
  color: number;
  sound: { frequency: number; wave: 'sine' | 'triangle' | 'sawtooth' };
  spells: Record<OriginalSlot, OriginalSpell>;
}

export const ORIGINAL_LINEUP: Readonly<Record<OriginalChampion, OriginalChampionDefinition>> = {
  brannic: {
    name: 'Brannic',
    subtitle: 'The Kilnwarden',
    role: 'top',
    color: 0xffae54,
    passive: {
      name: 'Temper',
      description:
        'Every third attack against a champion or large monster grants a 2-second shield.',
    },
    sound: { frequency: 118, wave: 'triangle' },
    spells: {
      q: {
        name: 'Ridgehammer',
        description: 'Strike a narrow fault line for physical damage.',
        shape: 'line',
        range: 490,
        radius: 76,
        windup: 10,
        mana: 28,
        cooldown: 4.8,
        damage: 118,
        physical: true,
      },
      w: {
        name: 'Bank the Fire',
        description: 'Raise a shield and slow nearby enemies.',
        shape: 'self',
        range: 0,
        radius: 250,
        windup: 7,
        mana: 38,
        cooldown: 8.8,
        shield: 175,
        slow: 114,
      },
      e: {
        name: 'Kilnstep',
        description: 'Dash to a reachable point and damage enemies around the landing.',
        shape: 'dash',
        range: 375,
        radius: 170,
        windup: 9,
        mana: 38,
        cooldown: 9,
        damage: 106,
        physical: true,
      },
      r: {
        name: 'Firing Ring',
        description: 'Sear and root enemies on the rim. The center is safe.',
        shape: 'ring',
        range: 590,
        radius: 315,
        windup: 18,
        mana: 80,
        cooldown: 70,
        damage: 320,
        root: 90,
      },
    },
  },
  taviq: {
    name: 'Taviq',
    subtitle: 'The Thornrunner',
    role: 'jungle',
    color: 0xadea65,
    passive: {
      name: 'Forager',
      description: 'Every third attack against a jungle monster restores health.',
    },
    sound: { frequency: 216, wave: 'triangle' },
    spells: {
      q: {
        name: 'Briar Sweep',
        description: 'Sweep an area at close range for physical damage.',
        shape: 'disk',
        range: 375,
        radius: 185,
        windup: 9,
        mana: 30,
        cooldown: 5.5,
        damage: 98,
        physical: true,
      },
      w: {
        name: 'Hidewrap',
        description: 'Wrap yourself in a shield that absorbs the next hits.',
        shape: 'self',
        range: 0,
        radius: 120,
        windup: 7,
        mana: 30,
        cooldown: 9.5,
        shield: 140,
      },
      e: {
        name: 'Vaultvine',
        description: 'Dash to a reachable point and slow around the landing.',
        shape: 'dash',
        range: 505,
        radius: 165,
        windup: 10,
        mana: 40,
        cooldown: 10.5,
        damage: 86,
        physical: true,
        slow: 96,
      },
      r: {
        name: 'Bramble Gate',
        description: 'After a warning, thorn roots close across a long corridor.',
        shape: 'line',
        range: 840,
        radius: 115,
        windup: 19,
        mana: 85,
        cooldown: 76,
        damage: 250,
        root: 96,
      },
    },
  },
  irielle: {
    name: 'Irielle',
    subtitle: 'The Prism Cantor',
    role: 'mid',
    color: 0xbb9cff,
    passive: {
      name: 'Refrain',
      description:
        'Every third attack against a champion or large monster cuts the remaining cooldown of Lattice by 1.5 seconds.',
    },
    sound: { frequency: 374, wave: 'sine' },
    spells: {
      q: {
        name: 'Lattice',
        description: 'Project a narrow beam that damages every enemy it crosses.',
        shape: 'line',
        range: 870,
        radius: 68,
        windup: 11,
        mana: 38,
        cooldown: 5.5,
        damage: 118,
      },
      w: {
        name: 'Violet Interval',
        description: 'Mark a disk that damages and slows enemies after a brief warning.',
        shape: 'disk',
        range: 790,
        radius: 215,
        windup: 16,
        mana: 48,
        cooldown: 9.5,
        damage: 98,
        slow: 120,
      },
      e: {
        name: 'Glass Mantle',
        description: 'Raise a refracting shield over yourself.',
        shape: 'self',
        range: 0,
        radius: 120,
        windup: 6,
        mana: 38,
        cooldown: 11,
        shield: 168,
      },
      r: {
        name: 'Resonant Crown',
        description: 'A distant prism erupts in a wide blast of magic damage.',
        shape: 'disk',
        range: 1090,
        radius: 275,
        windup: 22,
        mana: 90,
        cooldown: 76,
        damage: 345,
      },
    },
  },
  vess: {
    name: 'Vess',
    subtitle: 'The Coilwright',
    role: 'carry',
    color: 0xffd369,
    passive: {
      name: 'Overcharge',
      description:
        'Every third attack against a champion or large monster deals bonus physical damage.',
    },
    sound: { frequency: 270, wave: 'sawtooth' },
    spells: {
      q: {
        name: 'Copper Shot',
        description: 'Discharge a narrow shot that hits the first enemy in its path.',
        shape: 'line',
        range: 940,
        radius: 52,
        windup: 8,
        mana: 30,
        cooldown: 4.6,
        damage: 94,
        first: true,
        physical: true,
      },
      w: {
        name: 'Static Stake',
        description: 'Plant a charge that slows enemies in a marked area.',
        shape: 'disk',
        range: 720,
        radius: 175,
        windup: 15,
        mana: 40,
        cooldown: 9.2,
        damage: 84,
        slow: 120,
      },
      e: {
        name: 'Slip Coupling',
        description: 'Dash to a reachable point and raise a small shield.',
        shape: 'dash',
        range: 425,
        radius: 125,
        windup: 9,
        mana: 40,
        cooldown: 11,
        shield: 115,
      },
      r: {
        name: 'Arc Rail',
        description: 'Charge a wide rail burst that pierces enemies for physical damage.',
        shape: 'line',
        range: 1220,
        radius: 102,
        windup: 22,
        mana: 90,
        cooldown: 74,
        damage: 290,
        physical: true,
      },
    },
  },
  oona: {
    name: 'Oona Vale',
    subtitle: 'The Tideglass Mender',
    role: 'support',
    color: 0x72e8d5,
    passive: {
      name: 'Salt Thread',
      description:
        'Every third attack against a champion or large monster heals the most injured nearby allied champion, including you.',
    },
    sound: { frequency: 310, wave: 'sine' },
    spells: {
      q: {
        name: 'Glass Current',
        description: 'Damage and slow enemies along a shallow current.',
        shape: 'line',
        range: 770,
        radius: 78,
        windup: 11,
        mana: 34,
        cooldown: 6.5,
        damage: 86,
        slow: 84,
      },
      w: {
        name: 'Harbor Light',
        description: 'Shield allied champions in the marked area.',
        shape: 'disk',
        range: 670,
        radius: 235,
        windup: 9,
        mana: 46,
        cooldown: 9,
        shield: 148,
      },
      e: {
        name: 'Salt Circuit',
        description: 'After a warning, root enemies around a ring with a safe center.',
        shape: 'ring',
        range: 685,
        radius: 210,
        windup: 16,
        mana: 42,
        cooldown: 11,
        damage: 88,
        root: 90,
      },
      r: {
        name: 'Springtide',
        description:
          'Heal allied champions in the marked area and push back the fight with a strong slow.',
        shape: 'disk',
        range: 830,
        radius: 315,
        windup: 18,
        mana: 85,
        cooldown: 72,
        heal: 285,
        slow: 144,
      },
    },
  },
};

export function isOriginalChampion(id: string | undefined): id is OriginalChampion {
  return id !== undefined && Object.hasOwn(ORIGINAL_LINEUP, id);
}

export function originalSpellIcon(id: OriginalChampion, slot: OriginalSlot) {
  return `${id}-${slot}`;
}

export const ORIGINAL_CLIPS = {
  idle1: 1.8,
  run: 0.76,
  attack1: 0.66,
  crit: 0.75,
  spell1: 0.64,
  spell2: 0.75,
  spell3: 0.85,
  spell4: 1.1,
  recall: 1.6,
  death: 1.25,
} as const;
export const ORIGINAL_RIG_DURATIONS = Object.fromEntries(
  ORIGINAL_CHAMPIONS.map((id) => [`${id}-base`, ORIGINAL_CLIPS])
) as Record<`${OriginalChampion}-base`, typeof ORIGINAL_CLIPS>;
export const ORIGINAL_CHAMPION_DURATIONS = Object.fromEntries(
  ORIGINAL_CHAMPIONS.map((id) => [id, ORIGINAL_CLIPS])
) as Record<OriginalChampion, typeof ORIGINAL_CLIPS>;

interface CombatProfile {
  hp: number;
  hpGrowth: number;
  mana: number;
  manaGrowth: number;
  healthRegen: number;
  healthRegenGrowth: number;
  manaRegen: number;
  manaRegenGrowth: number;
  damage: number;
  damageGrowth: number;
  armor: number;
  armorGrowth: number;
  magicResist: number;
  magicResistGrowth: number;
  speed: number;
  range: number;
  attackSpeed: number;
  attackSpeedGrowth: number;
  attackSpeedRatio: number;
  missileSpeed: number;
  windupTicks: number;
}
const melee = {
  hp: 668,
  hpGrowth: 114,
  mana: 345,
  manaGrowth: 50,
  damage: 66,
  damageGrowth: 4.4,
  healthRegen: 8.8,
  healthRegenGrowth: 0.75,
  manaRegen: 7.8,
  manaRegenGrowth: 0.68,
  armor: 38,
  armorGrowth: 4.9,
  magicResist: 34,
  magicResistGrowth: 2.15,
  speed: 348,
  range: 150,
  attackSpeed: 0.67,
  attackSpeedGrowth: 0.031,
  attackSpeedRatio: 0.67,
  missileSpeed: 0,
  windupTicks: 16,
};
const ranged = {
  ...melee,
  hp: 618,
  hpGrowth: 102,
  mana: 390,
  damage: 58,
  damageGrowth: 3.45,
  armor: 28,
  healthRegen: 6.6,
  healthRegenGrowth: 0.62,
  manaRegen: 9.2,
  manaRegenGrowth: 0.82,
  armorGrowth: 4.4,
  magicResist: 32,
  magicResistGrowth: 1.5,
  speed: 335,
  range: 555,
  missileSpeed: 2000,
  windupTicks: 17,
};
export const ORIGINAL_PROGRESSION = {
  brannic: {
    ...melee,
    name: ORIGINAL_LINEUP.brannic.name,
    hp: 760,
    hpGrowth: 124,
    armor: 44,
    armorGrowth: 5.2,
    damage: 74,
    damageGrowth: 5.0,
    attackSpeed: 0.7,
    attackSpeedGrowth: 0.034,
    range: 165,
  },
  taviq: {
    ...melee,
    name: ORIGINAL_LINEUP.taviq.name,
    hp: 690,
    hpGrowth: 116,
    armor: 39,
    armorGrowth: 4.9,
    damage: 68,
    damageGrowth: 4.5,
    speed: 353,
    attackSpeed: 0.7,
    attackSpeedGrowth: 0.032,
  },
  irielle: {
    ...ranged,
    name: ORIGINAL_LINEUP.irielle.name,
    hp: 645,
    magicResist: 36,
    mana: 450,
    range: 570,
  },
  vess: {
    ...ranged,
    name: ORIGINAL_LINEUP.vess.name,
    hp: 635,
    hpGrowth: 104,
    armor: 30,
    damage: 66,
    damageGrowth: 3.9,
    range: 580,
    attackSpeed: 0.71,
    attackSpeedGrowth: 0.042,
  },
  oona: {
    ...ranged,
    name: ORIGINAL_LINEUP.oona.name,
    hp: 690,
    hpGrowth: 108,
    armor: 33,
    magicResist: 36,
    mana: 440,
    range: 530,
  },
} satisfies Record<OriginalChampion, CombatProfile & { name: string }>;

export const ORIGINAL_EFFECT_TICKS = 25;
export const ORIGINAL_PASSIVE_HITS = 3;
export const ORIGINAL_PASSIVE_EXPIRY = 300;

export function originalSpellAmount(base: number, slot: OriginalSlot, rank: number) {
  return base + Math.max(0, rank - 1) * (slot === 'r' ? 92 : 28);
}
