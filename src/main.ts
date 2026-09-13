import './style.css';
import { DT } from './content/rules';
import { World } from './simulation/world';
import { GameView } from './render/view';
import { Hud } from './ui/hud';
import { GameInput } from './input/input';
import { GameAudio } from './audio/audio';

const host = document.querySelector<HTMLElement>('#app')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;

async function boot(): Promise<void> {
  const world = new World();
  let view: GameView;
  try { view = new GameView(host); }
  catch (error) {
    loading.innerHTML = '<span class="loading-mark">◇</span><h1>Unable to open the Rift</h1><p>This game requires WebGL 2. Enable hardware acceleration and reload.</p>';
    console.error(error); return;
  }
  const audio = new GameAudio();
  let paused = false, accumulator = 0, previous = performance.now(), elapsed = 0;
  let input: GameInput | undefined;
  const setPaused = (value: boolean) => {
    paused = value; hud.paused = value; accumulator = 0; previous = performance.now();
    if (value) { input?.release(); world.commands.length = 0; }
  };
  const hud = new Hud(host, world, view, { pause: setPaused, reset: () => window.location.reload(), sound: enabled => { audio.enabled = enabled; } });
  input = new GameInput(world, view, hud, () => audio.unlock());
  window.addEventListener('resize', () => view.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { input?.release(); if (!hud.modal) hud.toggleModal('pause'); else setPaused(true); }
  });
  view.renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); setPaused(true); hud.toast('Graphics interrupted. Restoring the battlefield…');
  });
  view.renderer.domElement.addEventListener('webglcontextrestored', () => {
    hud.toggleModal('pause'); hud.toast('Graphics restored. Resume when you’re ready.');
  });
  // Renderer initialization and shader warmup precede dismissing the load screen.
  view.render(world, 1, 0);
  await view.renderer.compileAsync(view.scene, view.camera);
  loading.classList.add('finished'); window.setTimeout(() => loading.remove(), 600);
  let frames = 0, frameTime = 0, fps = 60, uiElapsed = 0;
  view.renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min((now - previous) / 1000, .1); previous = now;
    elapsed += paused ? 0 : dt; frameTime += dt; frames++;
    if (frameTime >= .5) { fps = frames / frameTime; frameTime = 0; frames = 0; }
    input!.update(dt);
    if (!paused) {
      accumulator += dt; let steps = 0;
      while (accumulator >= DT && steps < 6) { world.step(); accumulator -= DT; steps++; }
      if (accumulator >= DT) accumulator = 0;
    }
    view.render(world, paused ? 1 : accumulator / DT, elapsed);
    uiElapsed += dt;
    if (uiElapsed >= .05) { hud.update(fps); uiElapsed = 0; }
    audio.update(world.events.filter(e => e.unit === undefined || !world.unit(e.unit) || world.visible(world.unit(e.unit)!)));
  });
  if (import.meta.env.DEV) {
    Object.assign(window, { __GAME__: { world, view, hud, setPaused, snapshot: () => JSON.parse(world.snapshot()), ready: true } });
  }
}

void boot().catch(error => {
  console.error(error);
  loading.innerHTML = '<h1>Loading interrupted</h1><p>Reload to try again.</p>';
});
