import * as THREE from 'three';

/** Omit bone channels that always equal the loaded rest value across the complete clip set. */
export function removeConstantBoneTracks(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[]
): THREE.AnimationClip[] {
  if (clips.some((clip) => clip.blendMode !== THREE.NormalAnimationBlendMode)) return [...clips];
  const nodesByName = new Map<string, THREE.Object3D>();
  root.traverse((node) => {
    if (node.name && !nodesByName.has(node.name)) nodesByName.set(node.name, node);
  });
  const groups = new Map<string, { tracks: THREE.KeyframeTrack[]; removable: boolean }>();
  for (const clip of clips)
    for (const track of clip.tracks) {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      // Indexed/object bindings can overlap whole-property channels; do not infer independence.
      if (binding.objectName || binding.objectIndex || binding.propertyIndex) return [...clips];
      const node =
        nodesByName.get(binding.nodeName) ??
        THREE.PropertyBinding.findNode(root, binding.nodeName);
      if (!(node instanceof THREE.Bone)) continue;
      const property = binding.propertyName;
      if (property !== 'position' && property !== 'quaternion' && property !== 'scale') continue;
      const key = `${node.uuid}.${property}`;
      const group = groups.get(key) ?? { tracks: [], removable: true };
      const propObj = node[property];
      const stride = property === 'quaternion' ? 4 : 3;
      const r0 = propObj.x,
        r1 = propObj.y,
        r2 = propObj.z,
        r3 = property === 'quaternion' ? (propObj as THREE.Quaternion).w : 0;
      group.tracks.push(track);
      group.removable &&=
        (track.getInterpolation() === THREE.InterpolateLinear ||
          track.getInterpolation() === THREE.InterpolateDiscrete) &&
        track.values.length === track.times.length * stride &&
        track.times.length > 0;
      if (group.removable) {
        const vals = track.values;
        if (stride === 3) {
          for (let i = 0; i < vals.length; i += 3) {
            const v0 = vals[i],
              v1 = vals[i + 1],
              v2 = vals[i + 2];
            if (
              !Number.isFinite(v0) ||
              !Number.isFinite(v1) ||
              !Number.isFinite(v2) ||
              v0 !== r0 ||
              v1 !== r1 ||
              v2 !== r2
            ) {
              group.removable = false;
              break;
            }
          }
        } else {
          for (let i = 0; i < vals.length; i += 4) {
            const v0 = vals[i],
              v1 = vals[i + 1],
              v2 = vals[i + 2],
              v3 = vals[i + 3];
            if (
              !Number.isFinite(v0) ||
              !Number.isFinite(v1) ||
              !Number.isFinite(v2) ||
              !Number.isFinite(v3) ||
              v0 !== r0 ||
              v1 !== r1 ||
              v2 !== r2 ||
              v3 !== r3
            ) {
              group.removable = false;
              break;
            }
          }
        }
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
