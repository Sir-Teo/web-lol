import { GAREN_Q_AUDIO as P } from '../../src/content/garen-q-audio';
import { floatSourceBuffer, verifySourceWave } from '../../src/audio/float-source-wav';

const kinds = ['cast', 'active', 'end', 'attack', 'attackDelayed'] as const;
type Kind = (typeof kinds)[number];
type Variant = (typeof P)[Kind]['variants'][number];
const titles: Record<Kind, string> = {
  cast: 'Activation',
  active: 'Active',
  end: 'Deactivation',
  attack: 'Attack immediate',
  attackDelayed: 'Attack delayed',
};
const buffers = new Map<number, AudioBuffer>();
const selections = new Map<Kind, HTMLSelectElement>();
const voices = new Set<{
  kind: Kind;
  source: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
  sourceGain: number;
  fadeEnd: number | null;
}>();
let context: AudioContext | undefined;
let generation = 0;
let pendingKinds: readonly Kind[] = [];
const status = document.querySelector<HTMLElement>('#status')!;
const level = document.querySelector<HTMLInputElement>('#level')!;
const state = { ready: false, buffers, profiles: P };
(window as any).__GAREN_Q_AUDIO_PREVIEW__ = state;
document.querySelector('#profile')!.textContent = JSON.stringify(P, null, 2);

function releaseVoices() {
  for (const voice of voices) {
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  }
  voices.clear();
}
function stopAll() {
  generation++;
  pendingKinds = [];
  releaseVoices();
  status.textContent = 'Audition stopped.';
}
async function play(selected: readonly Kind[]) {
  const token = ++generation;
  releaseVoices();
  pendingKinds = [...selected];
  status.textContent = 'Preparing audition…';
  try {
    if (!context || context.state === 'closed') context = new AudioContext({ sampleRate: 44100 });
    await context.resume();
    if (token !== generation) return;
    pendingKinds = [];
    const now = context.currentTime;
    for (const kind of selected) {
      const p = P[kind],
        variant = p.variants[Number(selections.get(kind)!.value)];
      const source = context.createBufferSource(),
        gain = context.createGain();
      const sourceGain = 10 ** ((p.gainDb + variant.gainDb) / 20);
      const volume = Number(level.value) * sourceGain;
      source.buffer = buffers.get(variant.id)!;
      source.loop = false;
      gain.gain.setValueAtTime(volume, now);
      source.connect(gain).connect(context.destination);
      const voice = { kind, source, gain, level: volume, sourceGain, fadeEnd: null };
      voices.add(voice);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        voices.delete(voice);
        if (token === generation && voices.size === 0)
          status.textContent = `Finished ${selected.map((k) => titles[k].toLowerCase()).join(' + ')}.`;
      };
      source.start(now + p.delaySeconds);
    }
    status.textContent = `Playing ${selected.map((k) => titles[k].toLowerCase()).join(' + ')} · source gains · no looping`;
  } catch (error) {
    if (token !== generation) return;
    pendingKinds = [];
    releaseVoices();
    status.textContent = `Unable to start audition: ${error instanceof Error ? error.message : String(error)}`;
  }
}
document
  .querySelector('#attack')!
  .addEventListener('click', () => void play(['attack', 'attackDelayed']));
document.querySelector('#stop-all')!.addEventListener('click', stopAll);
document.querySelector('#stop-active')!.addEventListener('click', () => {
  const cancelledPending = pendingKinds.includes('active');
  if (cancelledPending) {
    generation++;
    pendingKinds = [];
  }
  if (!context) return;
  let stopping = false;
  const now = context.currentTime;
  for (const voice of voices) {
    if (voice.kind !== 'active') continue;
    stopping = true;
    voice.fadeEnd = now + P.active.stop.fadeSeconds;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.level, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + P.active.stop.fadeSeconds);
    voice.source.stop(now + P.active.stop.fadeSeconds);
  }
  status.textContent = stopping
    ? 'Stopping active · source 250 ms linear fade'
    : cancelledPending
      ? 'Pending active audition cancelled.'
      : 'No active audition to stop.';
});

level.addEventListener('input', () => {
  const monitor = Number(level.value);
  document.querySelector('#level-value')!.textContent = `${Math.round(monitor * 100)}%`;
  if (!context) return;
  const now = context.currentTime;
  for (const voice of voices) {
    voice.level = monitor * voice.sourceGain;
    const remaining = voice.fadeEnd === null ? null : Math.max(0, voice.fadeEnd - now);
    const fraction = remaining === null ? 1 : remaining / P.active.stop.fadeSeconds;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.level * fraction, now);
    if (remaining !== null && remaining > 0)
      voice.gain.gain.linearRampToValueAtTime(0, voice.fadeEnd!);
  }
});

for (const kind of kinds) {
  const p = P[kind],
    card = document.createElement('article'),
    title = document.createElement('h2');
  title.textContent = titles[kind];
  const detail = document.createElement('p');
  detail.textContent = `${p.variants.length} variant${p.variants.length === 1 ? '' : 's'} · container ${p.gainDb} dB · delay ${p.delaySeconds * 1000} ms · source global cap ${p.policy.u16MaxNumInstance}`;
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('label'),
    select = document.createElement('select');
  select.setAttribute('aria-label', `${titles[kind]} variant`);
  label.append(`${titles[kind]} variant `, select);
  for (const [i, v] of p.variants.entries()) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${v.id} · ${v.durationSeconds.toFixed(3)} s · sound ${v.gainDb} dB`;
    select.append(option);
  }
  selections.set(kind, select);
  const button = document.createElement('button');
  button.textContent = `Play ${titles[kind].toLowerCase()}`;
  button.disabled = true;
  button.addEventListener('click', () => void play([kind]));
  row.append(label, button);
  card.append(title, detail, row);
  document.querySelector('#actions')!.append(card);
}

try {
  await Promise.all(
    kinds
      .flatMap<Variant>((kind) => P[kind].variants)
      .map(async (v) => {
        const response = await fetch(new URL('../../' + v.url, import.meta.url));
        if (!response.ok) throw new Error(`Q recording ${v.id}: ${response.status}`);
        const raw = await response.arrayBuffer();
        await verifySourceWave(raw, v.sha256);
        buffers.set(v.id, floatSourceBuffer(raw, v));
      })
  );
  document.querySelectorAll('button').forEach((b) => (b.disabled = false));
  status.textContent =
    'Ready · 13 source recordings · verified SHA-256 · 44.1 kHz mono · original float headroom';
  state.ready = true;
} catch (error) {
  status.textContent = `Unable to load source recordings: ${String(error)}`;
  console.error(error);
}
window.addEventListener('pagehide', () => {
  stopAll();
  if (context && context.state !== 'closed') void context.close().catch(() => {});
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAll();
});
