import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import pin from '../../docs/reference/jungle-character-source.json';

type RecordValue = Record<string, unknown>;
type Entry = { root: THREE.Group; mixer: THREE.AnimationMixer; clips: THREE.AnimationClip[] };
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x101b23);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 2;
controls.maxDistance = 35;
scene.add(new THREE.GridHelper(20, 40, 0x546571, 0x243540));
const select = document.querySelector<HTMLSelectElement>('#character')!;
const records = document.querySelector<HTMLSelectElement>('#record')!;
const clips = document.querySelector<HTMLSelectElement>('#clip')!;
const scrub = document.querySelector<HTMLInputElement>('#time')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const status = document.querySelector<HTMLElement>('#status')!;
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();
let active: Entry | undefined, action: THREE.AnimationAction | undefined;
let playing = false,
  ready = false,
  selectedRecords: Record<string, RecordValue> = {};
let selected = '';
for (const name of pin.characters) select.add(new Option(name, name));

function render() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
}
function seek(time: number) {
  if (action) action.paused = false;
  active?.mixer.setTime(time);
  scrub.value = String(time);
  render();
}
function chooseClip(name: string) {
  const clip = active?.clips.find((c) => c.name === name);
  if (!active || !clip) throw new Error(`Unknown clip: ${name}`);
  active.mixer.stopAllAction();
  action = active.mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset().play();
  clips.value = name;
  scrub.max = String(clip.duration);
  playing = false;
  play.textContent = 'Play';
  seek(0);
}
const fields = [
  ['Health', 'baseHPModifiable'],
  ['Attack damage', 'baseDamageModifiable'],
  ['Armor', 'baseArmorModifiable'],
  ['Magic resistance', 'baseMR'],
  ['Move speed', 'baseMoveSpeedModifiable'],
  ['Attack range', 'attackRangeModifiable'],
  ['Attack speed', 'attackSpeedModifiable'],
  ['Attack period', 'basicAttack.mAttackTotalTime'],
  ['Attack cast time', 'basicAttack.mAttackCastTime'],
  ['Gold on death', 'goldGivenOnDeath'],
  ['Experience on death', 'expGivenOnDeath'],
  ['Experience radius', 'experienceRadius'],
  ['Pathfinding radius', 'pathfindingCollisionRadius'],
  ['Gameplay radius', 'overrideGameplayCollisionRadius'],
  ['Minion score', 'minionScoreValue'],
  ['Tags', 'unitTagsString'],
];
function describe() {
  const record = selectedRecords[records.value];
  const rows = fields.map(([label, path]) => {
    let value: unknown = record;
    for (const key of path.split('.')) value = (value as RecordValue | undefined)?.[key];
    if (value && typeof value === 'object') value = (value as RecordValue).baseValue;
    const row = document.createElement('tr');
    const title = document.createElement('td'),
      content = document.createElement('td');
    title.textContent = label;
    content.textContent = value === undefined ? 'Absent' : String(value);
    row.append(title, content);
    return row;
  });
  document.querySelector('#values')!.replaceChildren(...rows);
  document.querySelector('#details')!.textContent = JSON.stringify(record, null, 2);
}
async function load(name: string): Promise<Entry> {
  if (entries.has(name)) return entries.get(name)!;
  if (pending.has(name)) return pending.get(name)!;
  const promise = (async () => {
    const path = `../../assets/models/${name.toLowerCase().replaceAll('_', '-')}-base.glb`;
    const gltf = await new GLTFLoader().loadAsync(new URL(path, location.href).href);
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some((material) => material.userData.defaultHidden)) object.visible = false;
        object.frustumCulled = false;
      }
    });
    gltf.scene.visible = false;
    scene.add(gltf.scene);
    const entry = {
      root: gltf.scene,
      mixer: new THREE.AnimationMixer(gltf.scene),
      clips: gltf.animations,
    };
    entries.set(name, entry);
    return entry;
  })();
  pending.set(name, promise);
  try {
    return await promise;
  } finally {
    pending.delete(name);
  }
}
async function choose(name: string) {
  if (!pin.characters.includes(name)) throw new Error(`Unknown character: ${name}`);
  selected = name;
  ready = false;
  select.value = name;
  playing = false;
  play.textContent = 'Play';
  active = undefined;
  action = undefined;
  for (const entry of entries.values()) {
    entry.root.visible = false;
    entry.mixer.stopAllAction();
  }
  const sourcePath = `data/characters/${name.toLowerCase()}/${name.toLowerCase()}.bin`;
  const source = (pin.records as unknown as Record<string, Record<string, RecordValue>>)[
    sourcePath
  ];
  selectedRecords = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value.__type === 'CharacterRecord')
  );
  const root = `Characters/${name}/CharacterRecords/Root`;
  records.replaceChildren(
    ...Object.keys(selectedRecords).map((key) => new Option(key === root ? 'Root' : key, key))
  );
  records.value = root;
  describe();
  clips.replaceChildren();
  for (const element of [clips, scrub, play]) element.disabled = true;
  retry.hidden = true;
  render();
  if (!Object.hasOwn(pin.models, name)) {
    status.textContent = `${name} · character definitions only; source rig not imported yet`;
    ready = true;
    return;
  }
  status.textContent = `Loading ${name} base rig…`;
  try {
    const entry = await load(name);
    if (selected !== name) return;
    active = entry;
    active.root.visible = true;
    const model = pin.models[name as keyof typeof pin.models];
    const sources = new Map(
      Object.entries(model.atomicClips).map(([state, path]) => [
        state.startsWith('{') ? `entry_${state.slice(1, -1)}` : state.toLowerCase(),
        path.split('/').at(-1),
      ])
    );
    clips.replaceChildren(
      ...active.clips.map(
        (clip) => new Option(`${sources.get(clip.name)} · ${clip.name}`, clip.name)
      )
    );
    const idleState = Object.entries(model.atomicClips).find(([, path]) =>
      /_(idle_normal|idle1)\.anm$/.test(path)
    )![0];
    chooseClip(
      idleState.startsWith('{') ? `entry_${idleState.slice(1, -1)}` : idleState.toLowerCase()
    );
    const bounds = new THREE.Box3();
    active.root.traverseVisible((object) => {
      if (object instanceof THREE.Mesh) bounds.expandByObject(object);
    });
    const size = bounds.getSize(new THREE.Vector3()).length();
    controls.target.copy(bounds.getCenter(new THREE.Vector3()));
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3(size * 0.65, size * 0.5, size * 1.3));
    controls.update();
    for (const element of [clips, scrub, play]) element.disabled = false;
    status.textContent = `${name} · base skin 0 · ${active.clips.length} atomic clips · source metres`;
    ready = true;
    render();
  } catch {
    if (selected !== name) return;
    status.textContent = `${name} model could not load. Retry the asset request.`;
    retry.hidden = false;
  }
}
function resize() {
  const width = canvas.parentElement!.clientWidth,
    height = Math.max(320, innerHeight - 260);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  render();
}
select.onchange = () => void choose(select.value);
records.onchange = describe;
clips.onchange = () => chooseClip(clips.value);
retry.onclick = () => void choose(selected);
scrub.oninput = () => {
  playing = false;
  play.textContent = 'Play';
  seek(Number(scrub.value));
};
play.onclick = () => {
  if (!action) return;
  playing = !playing;
  if (playing && action.time >= action.getClip().duration) action.reset().play();
  play.textContent = playing ? 'Pause' : 'Play';
};
controls.addEventListener('change', render);
window.addEventListener('resize', resize);
resize();
await choose('SRU_Blue');
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (playing && active && action) {
    active.mixer.update(dt);
    scrub.value = String(action.time);
    if (action.paused) {
      playing = false;
      play.textContent = 'Play';
    }
    render();
  }
});
Object.assign(window, {
  __JUNGLE_CHARACTERS__: {
    get ready() {
      return ready;
    },
    entries,
    choose,
    chooseClip,
    seek,
    renderer,
    scene,
    camera,
  },
});
