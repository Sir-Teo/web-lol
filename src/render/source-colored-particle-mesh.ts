import * as THREE from 'three';

export interface SourceColoredMeshShape {
  vertices: number;
  triangles: number;
}
/** Consumes a newly parsed static particle scene. The caller owns the returned
 * geometry; parsed staging materials are released. Failure releases each
 * staging geometry/material once. Textures are not part of this source shape. */
export function consumeSourceColoredParticleMesh(
  scene: THREE.Object3D,
  expected: SourceColoredMeshShape
): THREE.BufferGeometry {
  if (scene.userData.sourceParticleMeshConsumed)
    throw Error('Source particle mesh scene has already been consumed');
  scene.userData.sourceParticleMeshConsumed = true;
  const found: THREE.Mesh[] = [],
    geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      found.push(node);
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        materials.add(material);
    }
  });
  try {
    if (
      !Number.isSafeInteger(expected.vertices) ||
      expected.vertices < 1 ||
      !Number.isSafeInteger(expected.triangles) ||
      expected.triangles < 1 ||
      found.length !== 1 ||
      (found[0] as THREE.SkinnedMesh).isSkinnedMesh ||
      !found[0].matrixWorld.equals(new THREE.Matrix4())
    )
      throw Error('Particle source requires one untransformed static mesh');
    const geometry = found[0].geometry,
      position = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv'),
      color = geometry.getAttribute('color'),
      index = geometry.getIndex();
    if (
      !position ||
      position.itemSize !== 3 ||
      position.count !== expected.vertices ||
      !uv ||
      uv.itemSize !== 2 ||
      uv.count !== expected.vertices ||
      !color ||
      color.itemSize !== 4 ||
      color.count !== expected.vertices ||
      !index ||
      index.count !== expected.triangles * 3 ||
      geometry.getAttribute('_source_vertex_bgra') ||
      geometry.userData.sourceCentimetresScaleApplied !== undefined
    )
      throw Error('Particle source topology or authored RGBA stream differs');
    const bgra = new Uint8Array(expected.vertices * 4);
    for (let i = 0; i < expected.vertices; i++) {
      const rgba = [color.getX(i), color.getY(i), color.getZ(i), color.getW(i)];
      if (
        ![position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)].every(
          Number.isFinite
        ) ||
        !rgba.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
      )
        throw Error('Invalid particle source coordinate or color');
      bgra.set(
        [rgba[2], rgba[1], rgba[0], rgba[3]].map((v) => Math.round(v * 255)),
        i * 4
      );
    }
    for (let i = 0; i < index.count; i++) {
      const vertex = index.getX(i);
      if (!Number.isSafeInteger(vertex) || vertex < 0 || vertex >= expected.vertices)
        throw Error('Invalid particle source triangle');
    }
    geometry.setAttribute('_source_vertex_bgra', new THREE.Uint8BufferAttribute(bgra, 4, true));
    geometry.scale(0.01, 0.01, 0.01);
    geometry.userData.sourceCentimetresScaleApplied = 0.01;
    return geometry;
  } catch (error) {
    for (const geometry of geometries) geometry.dispose();
    throw error;
  } finally {
    for (const material of materials) material.dispose();
  }
}
