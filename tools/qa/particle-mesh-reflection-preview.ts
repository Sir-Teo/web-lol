import * as THREE from 'three';
import {
  createParticleMeshReflectionMaterial,
  createParticleMeshRimMaterial,
} from '../../src/render/particle-mesh-reflection-material';

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(64, 64);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.append(renderer.domElement);
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
camera.position.z = 1000;
camera.updateMatrixWorld();

function texture(values: number[], width = 1) {
  const t = new THREE.DataTexture(new Uint8Array(values), width, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function probe(o: any) {
  const resources: { dispose(): void }[] = [],
    tex = (values: number[], width = 1) => {
      const t = texture(values, width);
      resources.push(t);
      return t;
    };
  let cube: THREE.CubeTexture | undefined;
  if (!o.rimOnly) {
    const faces = (o.cubeFaces ?? Array(6).fill(o.cube)).map((v: number[]) => tex(v));
    cube = new THREE.CubeTexture(faces);
    cube.minFilter = cube.magFilter = THREE.NearestFilter;
    cube.colorSpace = THREE.NoColorSpace;
    cube.needsUpdate = true;
    resources.push(cube);
  }
  const g = new THREE.BufferGeometry(),
    scale = o.scale ?? [1, 1, 1],
    points = [
      [-1, -1, 0],
      [3, -1, 0],
      [-1, 3, 0],
    ];
  resources.push(g);
  // Keep projected points/barycentric weights fixed when checking nonuniform scale.
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      points.flatMap((p) => p.map((v, i) => v / scale[i])),
      3
    )
  );
  g.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(o.normals ?? Array(3).fill(o.normal).flat(), 3)
  );
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      Array(3)
        .fill(o.uv ?? [0.25, 0.5])
        .flat(),
      2
    )
  );
  const bindings = {
    texture: tex(o.source, o.width ?? 1),
    lookup: tex(o.lookup),
    remap: tex(o.remap ?? [0, 0, 0, 0]),
    uvTransform: new THREE.Matrix3().fromArray(o.transform ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]),
    lookupUv: [0.5, 0.5] as const,
    tint: o.tint,
    fresnel: o.fresnel,
    depthPushPull: o.depthPushPull ?? 0,
    alphaRef: o.alphaRef ?? 0,
  };
  const material = o.rimOnly
    ? createParticleMeshRimMaterial(g, bindings)
    : createParticleMeshReflectionMaterial(g, {
        ...bindings,
        environment: cube!,
        reflection: o.reflection,
        reflectionColor: o.reflectionColor,
      });
  resources.push(material);
  material.depthTest = !!o.occluder;
  const mesh = new THREE.Mesh(g, material),
    scene = new THREE.Scene();
  mesh.scale.fromArray(scale);
  scene.add(mesh);
  if (o.occluder) {
    const plane = new THREE.PlaneGeometry(2, 2),
      flat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0), toneMapped: false }),
      other = new THREE.Mesh(plane, flat);
    other.position.z = -0.25;
    scene.add(other);
    resources.push(plane, flat);
  }
  try {
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    const pixels = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
    const gl = renderer.getContext(),
      properties = renderer.properties.get(material) as {
        currentProgram?: { program?: WebGLProgram };
      },
      // An occluder can be the last draw. Inspect this material's linked program,
      // rather than whichever program happens to remain current in WebGL.
      program = properties.currentProgram?.program;
    if (!program) throw Error('Mesh probe linked program unavailable');
    const activeUniforms = Array.from(
      { length: gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) },
      (_, i) => gl.getActiveUniform(program, i)!.name
    );
    return {
      pixels: [...pixels],
      error: renderer.getContext().getError(),
      geometries: renderer.info.memory.geometries,
      cubeResources: cube ? 1 : 0,
      activeUniforms,
    };
  } finally {
    renderer.setRenderTarget(null);
    for (const r of resources) r.dispose();
  }
}
(window as any).__MESH_REFLECTION__ = { probe, renderer, ready: true };
