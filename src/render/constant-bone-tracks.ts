import * as THREE from 'three';

/** Omit bone channels that always equal the loaded rest value across the complete clip set. */
export function removeConstantBoneTracks(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[]
): THREE.AnimationClip[] {
  if (clips.some((clip) => clip.blendMode !== THREE.NormalAnimationBlendMode)) return [...clips];
  const groups = new Map<string, { tracks: THREE.KeyframeTrack[]; removable: boolean }>();
  for (const clip of clips)
    for (const track of clip.tracks) {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      // Indexed/object bindings can overlap whole-property channels; do not infer independence.
      if (binding.objectName || binding.objectIndex || binding.propertyIndex) return [...clips];
      const node = THREE.PropertyBinding.findNode(root, binding.nodeName);
      if (!(node instanceof THREE.Bone)) continue;
      const property = binding.propertyName;
      if (property !== 'position' && property !== 'quaternion' && property !== 'scale') continue;
      const key = `${node.uuid}.${property}`;
      const group = groups.get(key) ?? { tracks: [], removable: true };
      const rest = node[property].toArray();
      group.tracks.push(track);
      group.removable &&=
        (track.getInterpolation() === THREE.InterpolateLinear ||
          track.getInterpolation() === THREE.InterpolateDiscrete) &&
        track.values.length === track.times.length * rest.length &&
        track.times.length > 0;
      if (group.removable)
        for (let i = 0; i < track.values.length; i++)
          if (!Number.isFinite(track.values[i]) || track.values[i] !== rest[i % rest.length]) {
            group.removable = false;
            break;
          }
      groups.set(key, group);
    }
  const removed = new Set(
    [...groups.values()].filter((group) => group.removable).flatMap((group) => group.tracks)
  );
  return clips.map(
    (clip) =>
      new THREE.AnimationClip(
        clip.name,
        clip.duration,
        clip.tracks.filter((track) => !removed.has(track)),
        clip.blendMode
      )
  );
}
