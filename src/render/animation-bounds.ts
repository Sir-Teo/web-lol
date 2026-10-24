import * as THREE from 'three';

interface Envelope {
  translation: number;
  scale: number;
}

/** Conservative bounds for imported TRS rigs and ordinary (non-additive) clip blends.
 * Rotation is bounded in every direction; translation/scale include every key and
 * the rest pose. Unsupported rigs retain disabled culling instead of a guessed bound.
 * Compute once on the unplaced source scene; SkeletonUtils clones retain the sphere.
 */
export function prepareAnimationBounds(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
  separateSortBounds = false
): void {
  const meshes: THREE.SkinnedMesh[] = [];
  const local = new Map<THREE.Object3D, Envelope>();
  const animated = new Set<THREE.Object3D>();
  let supported = true;
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) {
      node.frustumCulled = false;
      delete node.userData.animationBounds;
      delete node.userData.animationSeparateCullBounds;
      meshes.push(node);
    }
    // Imported TRS nodes only. Arbitrary authored shear needs a different bound.
    const composed = new THREE.Matrix4().compose(node.position, node.quaternion, node.scale);
    if (composed.elements.some((v, i) => Math.abs(v - node.matrix.elements[i]) > 1e-6))
      supported = false;
    if (Math.abs(node.quaternion.lengthSq() - 1) > 1e-5) supported = false;
    local.set(node, {
      translation: node.position.length(),
      scale: Math.max(...node.scale.toArray().map(Math.abs)),
    });
  });
  for (const clip of clips) {
    if (clip.blendMode !== THREE.NormalAnimationBlendMode) supported = false;
    for (const track of clip.tracks) {
      // GLTF cubic splines can report linear interpolation while replacing the factory.
      if (
        'createInterpolant' in track &&
        typeof track.createInterpolant === 'function' &&
        'isInterpolantFactoryMethodGLTFCubicSpline' in track.createInterpolant
      ) {
        supported = false;
        continue;
      }
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      const node = THREE.PropertyBinding.findNode(scene, binding.nodeName);
      if (
        !(node instanceof THREE.Object3D) ||
        !local.has(node) ||
        binding.objectName ||
        binding.propertyIndex !== undefined ||
        !['position', 'scale', 'quaternion'].includes(binding.propertyName) ||
        (track.getInterpolation() !== THREE.InterpolateLinear &&
          track.getInterpolation() !== THREE.InterpolateDiscrete)
      ) {
        supported = false;
        continue;
      }
      animated.add(node);
      const size = binding.propertyName === 'quaternion' ? 4 : 3;
      if (track.getValueSize() !== size || !Array.from(track.values).every(Number.isFinite)) {
        supported = false;
        continue;
      }
      const envelope = local.get(node)!;
      for (let i = 0; i < track.values.length; i += size) {
        const x = track.values[i],
          y = track.values[i + 1],
          z = track.values[i + 2];
        if (binding.propertyName === 'position')
          envelope.translation = Math.max(envelope.translation, Math.hypot(x, y, z));
        else if (binding.propertyName === 'scale')
          envelope.scale = Math.max(envelope.scale, Math.abs(x), Math.abs(y), Math.abs(z));
        else if (Math.abs(x * x + y * y + z * z + track.values[i + 3] ** 2 - 1) > 1e-5)
          supported = false;
      }
    }
  }
  if (!supported) return;
  const world = new Map<THREE.Object3D, Envelope>();
  function envelope(node: THREE.Object3D): Envelope {
    const cached = world.get(node);
    if (cached) return cached;
    const value = local.get(node)!;
    const parent = node === scene ? { translation: 0, scale: 1 } : envelope(node.parent!);
    const result = {
      translation: parent.translation + parent.scale * value.translation,
      // Covers floating-point quaternion normalization error along the chain.
      scale: parent.scale * value.scale * 1.0001,
    };
    world.set(node, result);
    return result;
  }
  for (const mesh of meshes) {
    if (
      mesh.bindMode !== THREE.AttachedBindMode ||
      Object.keys(mesh.geometry.morphAttributes).length
    )
      continue;
    let staticPath = true;
    for (let node: THREE.Object3D | null = mesh; node; node = node === scene ? null : node.parent)
      if (animated.has(node)) staticPath = false;
    if (!staticPath || !mesh.skeleton.bones.every((bone) => local.has(bone))) continue;
    const position = mesh.geometry.getAttribute('position');
    const indices = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    if (!position || !indices || !weights || indices.itemSize !== 4 || weights.itemSize !== 4)
      continue;
    const radii = new Array<number>(mesh.skeleton.bones.length).fill(-1);
    const vertex = new THREE.Vector3(),
      bound = new THREE.Vector3();
    let valid = true,
      maxWeight = 1;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const weight = weights.getComponent(i, k),
          joint = indices.getComponent(i, k);
        if (!Number.isFinite(weight) || weight < 0) {
          valid = false;
          break;
        }
        if (!weight) continue;
        if (!Number.isInteger(joint) || !mesh.skeleton.boneInverses[joint]) {
          valid = false;
          break;
        }
        const radius = bound.copy(vertex).applyMatrix4(mesh.skeleton.boneInverses[joint]).length();
        if (!Number.isFinite(radius)) {
          valid = false;
          break;
        }
        radii[joint] = Math.max(radii[joint], radius);
        sum += weight;
      }
      if (Math.abs(sum - 1) > 1e-5) valid = false;
      maxWeight = Math.max(maxWeight, sum);
    }
    if (!valid) continue;
    const radius =
      Math.max(
        ...radii.map((r, i) => {
          if (r < 0) return 0;
          const e = envelope(mesh.skeleton.bones[i]);
          return e.translation + e.scale * r;
        })
      ) * maxWeight;
    const inverse = mesh.bindMatrixInverse;
    // sqrt(||A||1 * ||A||infinity) bounds the operator norm, including shear.
    const m = inverse.elements;
    const row = Math.max(
      ...[0, 1, 2].map((i) => Math.abs(m[i]) + Math.abs(m[i + 4]) + Math.abs(m[i + 8]))
    );
    const column = Math.max(
      ...[0, 4, 8].map((i) => Math.abs(m[i]) + Math.abs(m[i + 1]) + Math.abs(m[i + 2]))
    );
    const sphere = new THREE.Sphere(
      new THREE.Vector3().applyMatrix4(inverse),
      (radius * 1.0001 + 1e-4) * Math.sqrt(row * column)
    );
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) continue;
    mesh.boundingSphere = sphere;
    mesh.userData.animationBounds = true;
    if (separateSortBounds)
      mesh.userData.animationSeparateCullBounds = {
        center: sphere.center.toArray(),
        radius: sphere.radius,
      };
    mesh.frustumCulled = true;
  }
}

const cullingBounds = new WeakMap<THREE.SkinnedMesh, THREE.Sphere>();
const worldSphere = new THREE.Sphere();

/** Install on each cloned rig. Three also uses boundingSphere.center for depth
 * sorting. Keep that sphere's original first-pose sampling and use the all-clip
 * envelope only for camera/shadow rejection, preserving overlapping draw order. */
export function configureAnimationCulling(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (
      !(node instanceof THREE.SkinnedMesh) ||
      !node.userData.animationSeparateCullBounds ||
      cullingBounds.has(node)
    )
      return;
    const data = node.userData.animationSeparateCullBounds;
    const sphere = new THREE.Sphere(new THREE.Vector3().fromArray(data.center), data.radius);
    cullingBounds.set(node, sphere);
    // Three 0.186 has a nullable sort sphere and this culling hook. The
    // installed 0.183 declarations predate that runtime interface.
    const mesh = node as unknown as {
      boundingSphere: THREE.Sphere | null;
      computeBoundingSphere: () => void;
      matrixWorld: THREE.Matrix4;
      intersectsFrustum: (frustum: THREE.Frustum) => boolean;
    };
    mesh.boundingSphere = null;
    mesh.intersectsFrustum = (frustum) => {
      // The original uncullable mesh also sampled this sphere on its first
      // projection, including when outside the camera. Keep that timing intact.
      if (mesh.boundingSphere === null) mesh.computeBoundingSphere();
      return frustum.intersectsSphere(worldSphere.copy(sphere).applyMatrix4(mesh.matrixWorld));
    };
  });
}

export function animationCullingSphere(mesh: THREE.SkinnedMesh): THREE.Sphere | null {
  return cullingBounds.get(mesh) ?? mesh.boundingSphere;
}
