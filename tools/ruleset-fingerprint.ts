import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(file) : entry.name.endsWith('.ts') ? [file] : [];
  });
}
export const rulesetFiles = [
  ...sourceFiles('src/simulation'),
  ...sourceFiles('src/content'),
  'src/content/attack-sound-materials.json',
  'src/content/garen-passive-particles.json',
  'src/content/gromp.json',
  'src/content/blue-sentinel.json',
  'src/content/red-brambleback.json',
  'src/content/wolf-camps.json',
  'src/content/raptor-camps.json',
  'src/content/krug-camps.json',
  'src/content/scuttler.json',
  'src/content/owned-companions.json',
  'src/content/warding-totem.json',
  'src/content/oracle-lens.json',
  'src/content/oracle-presentation.json',
  'src/content/lux-e-particles.json',
  'src/content/lux-e-burst.json',
  'src/content/lux-e-field.json',
  'src/content/gromp-death.json',
  'src/content/gromp-attack.json',
  'src/content/rift-gromp-camps.json',
  'public/assets/maps/rift-layout.json',
  'public/assets/maps/rift-nav.json',
  'public/assets/maps/rift-nav.bin',
  'package.json',
].sort();
export function rulesetFingerprint(): string {
  const hash = createHash('sha256');
  for (const file of rulesetFiles)
    hash.update(file).update('\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
}
export const absoluteRulesetFiles = new Set(rulesetFiles.map((file) => resolve(file)));

export function affectsRuleset(file: string): boolean {
  return (
    absoluteRulesetFiles.has(file) ||
    ['src/simulation', 'src/content'].some(
      (directory) => file.startsWith(resolve(directory) + '/') && file.endsWith('.ts')
    )
  );
}
