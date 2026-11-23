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
        range: 460,
        radius: 65,
        windup: 14,
        mana: 35,
        cooldown: 7,
        damage: 66,
        physical: true,
      },
      w: {
        name: 'Bank the Fire',
        description: 'Raise a shield and slow nearby enemies.',
        shape: 'self',
        range: 0,
        radius: 220,
        windup: 9,
        mana: 45,
        cooldown: 13,
        shield: 75,
        slow: 96,
      },
      e: {
        name: 'Kilnstep',
        description: 'Dash to a reachable point and damage enemies around the landing.',
        shape: 'dash',
        range: 335,
        radius: 145,
        windup: 12,
        mana: 45,
        cooldown: 13,
        damage: 50,
        physical: true,
      },
      r: {
        name: 'Firing Ring',
        description: 'Sear and root enemies on the rim. The center is safe.',
        shape: 'ring',
        range: 565,
        radius: 315,
        windup: 29,
        mana: 90,
        cooldown: 89,
        damage: 175,
        root: 63,
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
        range: 355,
        radius: 170,
        windup: 11,
        mana: 35,
        cooldown: 7,
        damage: 68,
        physical: true,
      },
      w: {
        name: 'Hidewrap',
        description: 'Wrap yourself in a shield that absorbs the next hits.',
        shape: 'self',
        range: 0,
        radius: 115,
        windup: 8,
        mana: 35,
        cooldown: 12,
        shield: 92,
      },
      e: {
        name: 'Vaultvine',
        description: 'Dash to a reachable point and slow around the landing.',
        shape: 'dash',
        range: 485,
        radius: 150,
        windup: 13,
        mana: 45,
        cooldown: 13,
        damage: 52,
        physical: true,
        slow: 84,
      },
      r: {
        name: 'Bramble Gate',
        description: 'After a warning, thorn roots close across a long corridor.',
        shape: 'line',
        range: 815,
        radius: 100,
        windup: 27,
        mana: 90,
        cooldown: 88,
        damage: 155,
        root: 78,
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
        range: 820,
        radius: 55,
        windup: 16,
        mana: 45,
        cooldown: 7,
        damage: 78,
      },
      w: {
        name: 'Violet Interval',
        description: 'Mark a disk that damages and slows enemies after a brief warning.',
        shape: 'disk',
        range: 735,
        radius: 195,
        windup: 25,
        mana: 55,
        cooldown: 12,
        damage: 59,
        slow: 105,
      },
      e: {
        name: 'Glass Mantle',
        description: 'Raise a refracting shield over yourself.',
        shape: 'self',
        range: 0,
        radius: 115,
        windup: 8,
        mana: 45,
        cooldown: 15,
        shield: 97,
      },
      r: {
        name: 'Resonant Crown',
        description: 'A distant prism erupts in a wide blast of magic damage.',
        shape: 'disk',
        range: 1040,
        radius: 255,
        windup: 36,
        mana: 100,
        cooldown: 94,
        damage: 235,
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
        range: 900,
        radius: 43,
        windup: 10,
        mana: 34,
        cooldown: 6,
        damage: 64,
        first: true,
        physical: true,
      },
      w: {
        name: 'Static Stake',
        description: 'Plant a charge that slows enemies in a marked area.',
        shape: 'disk',
        range: 680,
        radius: 155,
        windup: 21,
        mana: 45,
        cooldown: 12,
        damage: 45,
        slow: 111,
      },
      e: {
        name: 'Slip Coupling',
        description: 'Dash to a reachable point and raise a small shield.',
        shape: 'dash',
        range: 395,
        radius: 120,
        windup: 11,
        mana: 45,
        cooldown: 15,
        shield: 55,
      },
      r: {
        name: 'Arc Rail',
        description: 'Charge a wide rail burst that pierces enemies for physical damage.',
        shape: 'line',
        range: 1160,
        radius: 86,
        windup: 33,
        mana: 95,
        cooldown: 92,
        damage: 182,
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
        range: 725,
        radius: 68,
        windup: 14,
        mana: 38,
        cooldown: 8,
        damage: 52,
        slow: 66,
      },
      w: {
        name: 'Harbor Light',
        description: 'Shield allied champions in the marked area.',
        shape: 'disk',
        range: 620,
        radius: 215,
        windup: 13,
        mana: 55,
        cooldown: 12,
        shield: 70,
      },
      e: {
        name: 'Salt Circuit',
        description: 'After a warning, root enemies around a ring with a safe center.',
        shape: 'ring',
        range: 640,
        radius: 200,
        windup: 25,
        mana: 50,
        cooldown: 14,
        damage: 45,
        root: 63,
      },
      r: {
        name: 'Springtide',
        description:
          'Heal allied champions in the marked area and push back the fight with a strong slow.',
        shape: 'disk',
        range: 790,
        radius: 295,
        windup: 27,
        mana: 95,
        cooldown: 90,
        heal: 156,
        slow: 132,
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
  hp: 638,
  hpGrowth: 106,
  mana: 325,
  manaGrowth: 47,
  damage: 63,
  damageGrowth: 3.9,
  healthRegen: 8.1,
  healthRegenGrowth: 0.65,
  manaRegen: 7.2,
  manaRegenGrowth: 0.62,
  armor: 34,
  armorGrowth: 4.5,
  magicResist: 32,
  magicResistGrowth: 2.05,
  speed: 345,
  range: 145,
  attackSpeed: 0.65,
  attackSpeedGrowth: 0.027,
  attackSpeedRatio: 0.65,
  missileSpeed: 0,
  windupTicks: 18,
};
const ranged = {
  ...melee,
  hp: 586,
  hpGrowth: 96,
  mana: 365,
  damage: 55,
  damageGrowth: 3.05,
  armor: 25,
  healthRegen: 5.9,
  healthRegenGrowth: 0.55,
  manaRegen: 8.4,
  manaRegenGrowth: 0.74,
  armorGrowth: 4.1,
  magicResist: 30,
  magicResistGrowth: 1.35,
  speed: 330,
  range: 545,
  missileSpeed: 1900,
  windupTicks: 19,
};
export const ORIGINAL_PROGRESSION = {
  brannic: { ...melee, name: ORIGINAL_LINEUP.brannic.name, hp: 665, range: 155 },
  taviq: { ...melee, name: ORIGINAL_LINEUP.taviq.name, speed: 350, attackSpeed: 0.68 },
  irielle: { ...ranged, name: ORIGINAL_LINEUP.irielle.name, mana: 420, range: 550 },
  vess: {
    ...ranged,
    name: ORIGINAL_LINEUP.vess.name,
    damage: 61,
    range: 570,
    attackSpeed: 0.67,
    attackSpeedGrowth: 0.036,
  },
  oona: { ...ranged, name: ORIGINAL_LINEUP.oona.name, hp: 612, mana: 400, range: 505 },
} satisfies Record<OriginalChampion, CombatProfile & { name: string }>;

export const ORIGINAL_EFFECT_TICKS = 25;
export const ORIGINAL_PASSIVE_HITS = 3;
export const ORIGINAL_PASSIVE_EXPIRY = 300;

export function originalSpellAmount(base: number, slot: OriginalSlot, rank: number) {
  return base + Math.max(0, rank - 1) * (slot === 'r' ? 56 : 19);
}
