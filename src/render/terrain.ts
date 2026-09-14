import { setGroundRenderStage, terrainBlendMaterial } from './ground-display-list';
import * as THREE from 'three';
import { BRUSH, MAP_HALF, OBSTACLES } from '../content/map';
import { Random, segmentDistance } from '../simulation/math';

export const SCALE = 0.01;
const half = MAP_HALF * SCALE;

/** Painted terrain is generated once from the same authored layout used by navigation. */
export function createTerrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4096;
  const c = canvas.getContext('2d')!,
    n = canvas.width,
    random = new Random(717);
  const px = (value: number) => (value / (MAP_HALF * 2) + 0.5) * n;
  const py = (value: number) => (value / (MAP_HALF * 2) + 0.5) * n;
  c.fillStyle = '#284536';
  c.fillRect(0, 0, n, n);
  for (let i = 0; i < 18000; i++) {
    const x = random.next() * n,
      y = random.next() * n,
      r = random.between(4, 65);
    c.fillStyle = ['#36513a', '#314b34', '#2d4435', '#3b5036', '#35462f'][i % 5];
    c.globalAlpha = 0.24;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.7, random.next() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  const path = (color: string, width: number) => {
    c.strokeStyle = color;
    c.lineWidth = (width * n) / (MAP_HALF * 2);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px(-4300), py(3225));
    c.lineTo(px(4300), py(-3225));
    c.stroke();
  };
  path('#1c3327', 1040);
  path('#435137', 880);
  path('#657054', 750);
  path('#737660', 680);
  // Irregular worn paving follows the lane direction; joints remain darker than slabs.
  for (let row = -45; row <= 45; row++)
    for (let col = -3; col <= 3; col++) {
      const t = row * 100 + (col % 2) * 40;
      const cross = col * 93 + random.between(-9, 9);
      const x = t * 0.8 + cross * 0.6,
        y = -t * 0.6 + cross * 0.8;
      const w = random.between(33, 46),
        h = random.between(30, 41);
      c.save();
      c.translate(px(x), py(y));
      c.rotate(-0.64 + random.between(-0.13, 0.13));
      const s = n / (MAP_HALF * 2);
      c.scale(s, s);
      c.fillStyle = ['#838575', '#858879', '#797c6b', '#969680', '#717862'][
        Math.floor(random.next() * 5)
      ];
      c.strokeStyle = '#565e4d';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-w, -h + 8);
      c.lineTo(-w + 12, -h);
      c.lineTo(w - 5, -h + 2);
      c.lineTo(w, h - 8);
      c.lineTo(w - 12, h);
      c.lineTo(-w + 3, h - 2);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(202,204,171,.25)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-w + 12, -h + 4);
      c.lineTo(w - 7, -h + 6);
      c.stroke();
      c.restore();
    }
  // Jungle footpaths, each branching off the lane into the clear spaces between ledges.
  for (const side of [-1, 1]) {
    c.lineCap = 'round';
    c.strokeStyle = '#4b583c';
    c.lineWidth = n * 0.031;
    c.beginPath();
    c.moveTo(px(side * 1200), py(-side * 850));
    c.bezierCurveTo(
      px(side * 300),
      py(-side * 1600),
      px(-side * 550),
      py(-side * 1500),
      px(-side * 1900),
      py(-side * 1900)
    );
    c.stroke();
  }
  for (let i = 0; i < 22000; i++) {
    c.fillStyle = i % 2 ? 'rgba(209,210,151,.06)' : 'rgba(5,17,14,.12)';
    c.fillRect(random.next() * n, random.next() * n, random.between(1, 5), random.between(1, 5));
  }
  c.strokeStyle = '#1d3b35';
  c.lineWidth = n * 0.09;
  c.beginPath();
  c.moveTo(px(-4500), py(-3400));
  c.lineTo(px(4500), py(3400));
  c.stroke();
  c.strokeStyle = '#315d56';
  c.lineWidth = n * 0.067;
  c.beginPath();
  c.moveTo(px(-4500), py(-3400));
  c.lineTo(px(4500), py(3400));
  c.stroke();
  // Stone fords retain an interrupted line of travel across the river.
  for (let i = -4; i <= 4; i++) {
    const x = i * 85,
      y = -x * 0.75;
    c.fillStyle = i % 2 ? '#68766a' : '#7a8370';
    c.beginPath();
    c.ellipse(px(x), py(y), n * 0.008, n * 0.006, -0.6, 0, 7);
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function buildTerrain(scene: THREE.Object3D): {
  mapTexture: THREE.CanvasTexture;
  water: THREE.Mesh;
} {
  const mapTexture = createTerrainTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshLambertMaterial({ map: mapTexture })
  );
  ground.rotation.x = -Math.PI / 2;
  // Plane V grows toward negative Z; flip the authored map to match world coordinates.
  mapTexture.flipY = true;
  ground.receiveShadow = true;
  scene.add(ground);

  const waterGeometry = new THREE.PlaneGeometry(120, 4.4, 1, 1);
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x4a8c83,
      roughness: 0.36,
      metalness: 0.25,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  terrainBlendMaterial(water.material);
  setGroundRenderStage(water, 'terrainBlend');
  water.rotation.set(-Math.PI / 2, 0, -0.647);
  water.position.y = 0.022;
  scene.add(water);

  const random = new Random(12345),
    dummy = new THREE.Object3D();
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x657263 });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMaterial, 300);
  let rockCount = 0;
  for (const o of OBSTACLES) {
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2,
        r = o.radius * (j % 2 ? 0.7 : 0.3);
      dummy.position.set(
        (o.x + Math.cos(a) * r) * SCALE,
        o.height * SCALE * 0.32,
        (o.y + Math.sin(a) * r) * SCALE
      );
      dummy.rotation.set(random.next() * 0.2, random.next() * 7, random.next() * 0.3);
      dummy.scale.set(
        random.between(1.1, 2.1),
        o.height * SCALE * random.between(0.35, 0.6),
        random.between(0.9, 1.7)
      );
      dummy.updateMatrix();
      rocks.setMatrixAt(rockCount, dummy.matrix);
      rocks.setColorAt(
        rockCount++,
        new THREE.Color().setHSL(0.23, 0.12, random.between(0.22, 0.34))
      );
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = random.between(-half, half),
      z = x * 0.755 + random.between(-3.4, 3.4);
    if (Math.abs(z) > half) continue;
    dummy.position.set(x, 0.15, z);
    dummy.rotation.set(0.2, random.next() * 7, 0.1);
    dummy.scale.set(
      random.between(0.2, 0.55),
      random.between(0.15, 0.3),
      random.between(0.25, 0.5)
    );
    dummy.updateMatrix();
    rocks.setMatrixAt(rockCount, dummy.matrix);
    rocks.setColorAt(rockCount++, new THREE.Color(0x718276));
  }
  rocks.count = rockCount;
  rocks.receiveShadow = true;
  rocks.castShadow = true;
  scene.add(rocks);

  const trees: { x: number; y: number; h: number; scale: number }[] = [];
  for (let i = 0; i < 900; i++) {
    const x = random.between(-3900, 3900),
      y = random.between(-3900, 3900);
    const laneDistance = segmentDistance({ x, y }, { x: -5000, y: 3750 }, { x: 5000, y: -3750 });
    const riverDistance = Math.abs(y - 0.755 * x) / 1.25;
    if (laneDistance < 760 || riverDistance < 480 || distanceToObstacle(x, y) < -140) continue;
    trees.push({ x, y, h: random.between(3.1, 5), scale: random.between(0.85, 1.25) });
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.17, 0.31, 2.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x3b392b }),
    trees.length
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    trees.length * 3
  );
  trees.forEach((tree, i) => {
    dummy.position.set(tree.x * SCALE, 1.2, tree.y * SCALE);
    dummy.rotation.set(0, random.next() * 7, 0.02);
    dummy.scale.setScalar(tree.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let layer = 0; layer < 3; layer++) {
      const width = tree.scale * (1.45 - layer * 0.25);
      dummy.position.set(
        tree.x * SCALE + Math.sin(i) * 0.2,
        tree.h * 0.52 + layer * 0.95,
        tree.y * SCALE
      );
      dummy.scale.set(width, layer === 2 ? 1 : 0.95, width * 0.88);
      dummy.rotation.y = random.next() * 7;
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 3 + layer, dummy.matrix);
      crowns.setColorAt(
        i * 3 + layer,
        new THREE.Color().setHSL(
          0.36 + random.next() * 0.035,
          0.25,
          0.115 + layer * 0.023 + random.next() * 0.035
        )
      );
    }
  });
  scene.add(trunks, crowns);

  const blades = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.06, 0.65, 3),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    2200
  );
  let blade = 0;
  for (const brush of BRUSH)
    for (let i = 0; i < 420; i++) {
      const a = random.next() * Math.PI * 2,
        r = Math.sqrt(random.next()) * brush.radius;
      dummy.position.set(
        (brush.x + Math.cos(a) * r) * SCALE,
        0.25,
        (brush.y + Math.sin(a) * r) * SCALE
      );
      dummy.rotation.set(random.between(-0.2, 0.2), a, random.between(-0.2, 0.2));
      dummy.scale.set(1, random.between(0.7, 1.7), 1);
      dummy.updateMatrix();
      blades.setMatrixAt(blade, dummy.matrix);
      blades.setColorAt(blade++, new THREE.Color().setHSL(0.22, 0.4, random.between(0.21, 0.37)));
    }
  for (let i = 0; i < 1200; i++) {
    const x = random.between(-3800, 3800),
      y = -0.75 * x + (random.next() > 0.5 ? 1 : -1) * random.between(440, 680);
    if (Math.abs(y) > 3900) continue;
    dummy.position.set(x * SCALE, 0.1, y * SCALE);
    dummy.rotation.set(0.1, random.next() * 6, 0.1);
    dummy.scale.set(0.5, 0.45, 0.5);
    dummy.updateMatrix();
    blades.setMatrixAt(blade, dummy.matrix);
    blades.setColorAt(blade++, new THREE.Color(0x82935c));
  }
  blades.count = blade;
  scene.add(blades);

  // Small luminous flowers are instanced so decorative density does not multiply draw calls.
  const flowers = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.085, 0),
    new THREE.MeshBasicMaterial({ color: 0x95cace }),
    100
  );
  for (let i = 0; i < 100; i++) {
    const x = random.between(-3000, 3000),
      y = -0.75 * x + (i % 2 ? 1 : -1) * random.between(520, 800);
    dummy.position.set(x * SCALE, 0.14, y * SCALE);
    dummy.scale.setScalar(random.between(0.4, 1));
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
  }
  scene.add(flowers);
  return { mapTexture, water };
}
function distanceToObstacle(x: number, y: number): number {
  return Math.min(...OBSTACLES.map((o) => Math.hypot(x - o.x, y - o.y) - o.radius));
}
