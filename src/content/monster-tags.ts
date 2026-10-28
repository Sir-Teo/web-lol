import { SUMMONER_SMITE } from './summoner-smite';
import baron from './baron.json';
import type { MonsterSpecies } from './monsters';

/** Keep the original ordinary-camp pin intact; private epic tags use their own character pin. */
export function monsterTags(species: MonsterSpecies): readonly string[] {
  return species === 'baron' ? baron.monsterTags : SUMMONER_SMITE.monsterTags[species];
}
