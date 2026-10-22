import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import pin from '../../docs/reference/jungle-character-source.json';
import red from '../../docs/reference/red-brambleback-source.json';
import wolves from '../../docs/reference/wolf-camps-source.json';
import raptors from '../../docs/reference/raptor-camps-source.json';
import krugs from '../../docs/reference/krug-camps-source.json';
import scuttler from '../../docs/reference/scuttler-source.json';
import scuttlerProfile from '../../src/content/scuttler.json';
import companions from '../../docs/reference/jungle-companions-source.json';
const modelSources: Record<string, { atomicClips: Record<string, string> }> = {
  ...pin.models,
  ...red.models,
  ...wolves.models,
  ...raptors.models,
  ...krugs.models,
  ...scuttler.models,
  ...companions.models,
};
const companionNames = Object.keys(companions.models);
const characters = [...pin.characters, ...companionNames];

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
const poseNote = document.querySelector<HTMLElement>('#pose-note')!;
const form = document.querySelector<HTMLSelectElement>('#form')!;
const formControl = document.querySelector<HTMLElement>('#form-control')!;
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();
let active: Entry | undefined, action: THREE.AnimationAction | undefined;
let playing = false,
  ready = false,
  selectedRecords: Record<string, RecordValue> = {};
let selected = '';
for (const name of characters) select.add(new Option(name, name));

function frame() {
  if (!active) return;
  const bounds = new THREE.Box3();
  active.root.traverseVisible((object) => {
    if (object instanceof THREE.Mesh) bounds.expandByObject(object);
  });
  const size = bounds.getSize(new THREE.Vector3()).length();
  controls.target.copy(bounds.getCenter(new THREE.Vector3()));
  camera.position.copy(controls.target).add(new THREE.Vector3(size * 0.65, size * 0.5, size * 1.3));
  controls.update();
}
function chooseForm(value: string) {
  if (!companionNames.includes(selected) || !['Adult', 'Baby'].includes(value)) return;
  form.value = value;
  active?.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const part = materials[0]?.userData.sourceSubmesh;
    if (part === 'Adult' || part === 'Baby') object.visible = part === value;
  });
  frame();
  render();
}

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
  const buried = selected === 'Sru_Crab' && name === scuttlerProfile.clips.hide.name;
  poseNote.hidden = !buried && !companionNames.includes(selected);
  poseNote.textContent = buried
    ? 'This source hide pose holds the body below the grid. An empty view at this camera position is expected.'
    : companionNames.includes(selected)
      ? 'Manual source Adult/Baby submesh review. Native pet growth, counter callbacks and animation dispatch are not implemented.'
      : '';
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
    const path = `../../assets/models/${name.toLowerCase().replaceAll('_', '-').replace('/skin', '-skin')}-base.glb`;
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
  if (!characters.includes(name)) throw new Error(`Unknown character: ${name}`);
  selected = name;
  poseNote.hidden = true;
  formControl.hidden = !companionNames.includes(name);
  form.disabled = true;
  form.value = 'Adult';
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
  const character = name.split('/')[0];
  const sourcePath = `data/characters/${character.toLowerCase()}/${character.toLowerCase()}.bin`;
  const source = (
    (companionNames.includes(name) ? companions.records : pin.records) as unknown as Record<
      string,
      Record<string, RecordValue>
    >
  )[sourcePath];
  selectedRecords = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value.__type === 'CharacterRecord')
  );
  const root = `Characters/${character}/CharacterRecords/Root`;
  records.replaceChildren(
    ...Object.keys(selectedRecords).map((key) => new Option(key === root ? 'Root' : key, key))
  );
  records.value = root;
  describe();
  clips.replaceChildren();
  for (const element of [clips, scrub, play]) element.disabled = true;
  retry.hidden = true;
  render();
  if (!Object.hasOwn(modelSources, name)) {
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
    const model = modelSources[name];
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
    const idleState = Object.entries(model.atomicClips).find(
      ([state, path]) =>
        state.toLowerCase() === 'idle1' || /_(idle_normal\d*|idle\d*)\.anm$/i.test(path)
    )![0];
    chooseClip(
      idleState.startsWith('{') ? `entry_${idleState.slice(1, -1)}` : idleState.toLowerCase()
    );
    frame();
    for (const element of [clips, scrub, play]) element.disabled = false;
    form.disabled = false;
    const skinLabel = companionNames.includes(name) ? `source skin ${name.at(-1)}` : 'base skin 0';
    status.textContent = `${name} · ${skinLabel} · ${active.clips.length} atomic clips · source metres`;
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
form.onchange = () => chooseForm(form.value);
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
const initial = new URLSearchParams(location.search).get('character') ?? 'SRU_Blue';
await choose(characters.includes(initial) ? initial : 'SRU_Blue');
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
    chooseForm,
    seek,
    renderer,
    scene,
    camera,
  },
});
