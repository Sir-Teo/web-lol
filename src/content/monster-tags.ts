import { SUMMONER_SMITE } from './summoner-smite';
import baron from './baron.json';
import type { MonsterSpecies } from './monsters';

const EPIC_TAGS: Readonly<Record<string, readonly string[]>> = {
  'dragon-fire': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'dragon-earth': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'dragon-water': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'dragon-air': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'dragon-hextech': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'dragon-chemtech': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  'elder-dragon': ['Monster', 'Monster_Epic', 'Monster_Dragon', 'Monster_Camp'],
  riftherald: [
    'Monster',
    'Monster_Large',
    'Monster_Epic',
    'Special_Void',
    'Monster_Camp',
    'Monster_RiftHerald',
  ],
  voidgrub: [
    'Monster',
    'Monster_Large',
    'Monster_Epic',
    'Special_Void',
    'Monster_Camp',
    'Monster_Horde',
  ],
};

/** Keep the original ordinary-camp pin intact; private epic tags use their own character pin. */
export function monsterTags(species: MonsterSpecies): readonly string[] {
  if (species === 'baron') return baron.monsterTags;
  if (Object.hasOwn(EPIC_TAGS, species)) return EPIC_TAGS[species];
  return SUMMONER_SMITE.monsterTags[species as keyof typeof SUMMONER_SMITE.monsterTags];
}
