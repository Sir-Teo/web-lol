import { GAREN_Q_AUDIO as P } from '../../src/content/garen-q-audio';

const kinds = ['cast', 'active', 'end', 'attack', 'attackDelayed'] as const;
type Kind = (typeof kinds)[number];
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
}>();
let context: AudioContext | undefined;
const status = document.querySelector<HTMLElement>('#status')!;
const level = document.querySelector<HTMLInputElement>('#level')!;
const state = { ready: false, buffers, profiles: P };
(window as any).__GAREN_Q_AUDIO_PREVIEW__ = state;
document.querySelector('#profile')!.textContent = JSON.stringify(P, null, 2);

function stopAll() {
  for (const voice of voices) {
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  }
  voices.clear();
}
async function play(selected: readonly Kind[]) {
  context ??= new AudioContext({ sampleRate: 44100 });
  await context.resume();
  stopAll();
  const now = context.currentTime;
  for (const kind of selected) {
    const p = P[kind],
      variant = p.variants[Number(selections.get(kind)!.value)];
    const source = context.createBufferSource(),
      gain = context.createGain();
    const volume = Number(level.value) * 10 ** ((p.gainDb + variant.gainDb) / 20);
    source.buffer = buffers.get(variant.id)!;
    source.loop = false;
    gain.gain.setValueAtTime(volume, now);
    source.connect(gain).connect(context.destination);
    const voice = { kind, source, gain, level: volume };
    voices.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      voices.delete(voice);
    };
    source.start(now + p.delaySeconds);
  }
  status.textContent = `Playing ${selected.map((k) => titles[k].toLowerCase()).join(' + ')} · source gains · no looping`;
}
document
  .querySelector('#attack')!
  .addEventListener('click', () => void play(['attack', 'attackDelayed']));
document.querySelector('#stop-all')!.addEventListener('click', stopAll);
document.querySelector('#stop-active')!.addEventListener('click', () => {
  if (!context) return;
  const now = context.currentTime;
  for (const voice of voices) {
    if (voice.kind !== 'active') continue;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.level, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + P.active.stop.fadeSeconds);
    voice.source.stop(now + P.active.stop.fadeSeconds);
  }
  status.textContent = 'Stopping active · source 250 ms linear fade';
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
  const decoder = new OfflineAudioContext(1, 1, 44100);
  await Promise.all(
    kinds
      .flatMap((kind) => P[kind].variants)
      .map(async (v) => {
        const response = await fetch(new URL('../../' + v.url, import.meta.url));
        if (!response.ok) throw new Error(`Q recording ${v.id}: ${response.status}`);
        buffers.set(v.id, await decoder.decodeAudioData(await response.arrayBuffer()));
      })
  );
  document.querySelectorAll('button').forEach((b) => (b.disabled = false));
  status.textContent = 'Ready · 13 source recordings · 44.1 kHz mono · original float headroom';
  state.ready = true;
} catch (error) {
  status.textContent = `Unable to load source recordings: ${String(error)}`;
  console.error(error);
}
window.addEventListener('pagehide', () => {
  stopAll();
  void context?.close();
});
