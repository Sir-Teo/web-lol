import type { AnimationClip } from 'three';

/** Several runtime names can refer to one source clip, without renaming it away. */
export function monsterClipAliases(
  clips: readonly AnimationClip[],
  aliases: Readonly<Record<string, { name: string }>>,
  rig: string
): AnimationClip[] {
  const originals = new Map(clips.map((clip) => [clip.name, clip]));
  const used = new Set(Object.values(aliases).map((source) => source.name));
  const renamed = Object.entries(aliases).map(([alias, source]) => {
    const original = originals.get(source.name);
    if (!original) throw new Error(`${rig} lacks ${source.name}`);
    const clip = original.clone();
    clip.name = alias;
    return clip;
  });
  return [...clips.filter((clip) => !used.has(clip.name)), ...renamed];
}
