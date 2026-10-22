import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import catalog from '../content/jungle-map-inspection.json';
import './jungle-map-inspection.css';

type Positioned = { position: number[]; key?: string; name: string | null };

/** Read-only client-source annotations. No World, spawn roster or camp AI is created. */
export class JungleMapInspection {
  readonly catalog = catalog;
  readonly group = new THREE.Group();
  readonly groups = {
    camps: new THREE.Group(),
    characters: new THREE.Group(),
    recommendations: new THREE.Group(),
  };
  readonly panel = document.createElement('section');
  private label = document.createElement('div');
  private selected = catalog.camps[0];
  private projected = new THREE.Vector3();
  private selection: THREE.Mesh;

  constructor(
    host: HTMLElement,
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls,
    private canvas: HTMLCanvasElement
  ) {
    this.group.name = 'Jungle client-source annotations';
    const ring = new THREE.RingGeometry(0.55, 0.8, 24),
      dot = new THREE.CircleGeometry(0.3, 12),
      material = (color: number) =>
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
    const add = (
      items: Positioned[],
      group: THREE.Group,
      kind: string,
      geometry: THREE.BufferGeometry,
      color: number
    ) => {
      const shared = material(color);
      for (const item of items) {
        const mesh = new THREE.Mesh(geometry, shared);
        mesh.position.copy(this.worldPoint(item.position));
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 100;
        mesh.userData = { kind, key: item.key ?? item.name };
        mesh.name = `${kind}: ${item.name ?? item.key}`;
        group.add(mesh);
      }
      this.group.add(group);
    };
    add(catalog.camps, this.groups.camps, 'camp', ring, 0xffd26b);
    add(catalog.neutralObjects, this.groups.characters, 'character', dot, 0x62e4e3);
    add(catalog.recommendations, this.groups.recommendations, 'recommendation', ring, 0xee91d9);
    this.groups.characters.visible = this.groups.recommendations.visible = false;
    this.selection = new THREE.Mesh(ring, material(0xffffff));
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.scale.setScalar(1.5);
    this.selection.renderOrder = 101;
    this.group.add(this.selection);
    scene.add(this.group);

    this.panel.className = 'jungle-source-panel';
    this.panel.setAttribute('aria-label', 'Jungle source inspection');
    this.panel.innerHTML = `<h2>Jungle source inspection</h2>
      <p>18 client camp anchors. Live camp spawning and combat remain unfinished.</p>
      <label>Selected anchor <select id="jungle-camp"></select></label>
      <button id="jungle-focus">Show selected anchor</button>
      <label><input id="jungle-characters" type="checkbox"> Neutral character objects (53)</label>
      <label><input id="jungle-recommendations" type="checkbox"> Recommendation positions (16)</label>
      <p>Gold: camp anchors · Cyan: character objects · Pink: recommendations.</p>
      <p>Character objects include faelight pads and off-map templates. These do not define a live spawn roster.</p>
      <pre id="jungle-details"></pre>`;
    const select = this.panel.querySelector<HTMLSelectElement>('#jungle-camp')!;
    for (const camp of catalog.camps) {
      const option = document.createElement('option');
      option.value = camp.key;
      option.textContent = camp.name;
      select.append(option);
    }
    select.addEventListener('change', () => {
      this.selected = catalog.camps.find((camp) => camp.key === select.value)!;
      this.describe();
    });
    this.panel.querySelector('#jungle-focus')!.addEventListener('click', () => {
      const target = this.worldPoint(this.selected.position);
      this.controls.target.copy(target);
      this.camera.position.copy(target).add(new THREE.Vector3(0, 28, 21));
      this.controls.update();
      for (const button of host.querySelectorAll('[data-view]'))
        button.setAttribute('aria-pressed', 'false');
    });
    for (const [selector, group] of [
      ['#jungle-characters', this.groups.characters],
      ['#jungle-recommendations', this.groups.recommendations],
    ] as const) {
      const checkbox = this.panel.querySelector<HTMLInputElement>(selector)!;
      checkbox.addEventListener('change', () => (group.visible = checkbox.checked));
    }
    this.label.className = 'jungle-source-label';
    host.append(this.panel, this.label);
    this.describe();
  }
  private worldPoint(position: number[]) {
    return new THREE.Vector3(
      (position[0] - 7425) * 0.01,
      position[1] * 0.01,
      (7425 - position[2]) * 0.01
    );
  }
  private describe() {
    this.selection.position.copy(this.worldPoint(this.selected.position));
    this.label.textContent = this.selected.name;
    const recommendation = catalog.recommendations.find(
      (entry) => entry.name.toLowerCase() === this.selected.name.toLowerCase()
    );
    this.panel.querySelector('#jungle-details')!.textContent = JSON.stringify(
      { anchor: this.selected, recommendation: recommendation ?? null },
      null,
      2
    );
  }
  setVisible(visible: boolean) {
    this.group.visible = visible;
    this.panel.hidden = !visible;
    this.update();
  }
  update() {
    this.projected.copy(this.selection.position).project(this.camera);
    const p = this.projected,
      canvas = this.canvas.getBoundingClientRect();
    this.label.hidden =
      !this.group.visible || Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1;
    this.label.style.left = `${canvas.left + ((p.x + 1) * canvas.width) / 2}px`;
    this.label.style.top = `${canvas.top + ((1 - p.y) * canvas.height) / 2}px`;
  }
}
