import { selectableChampion } from './content/champion-profiles';
import { loadLuxIlluminationTriggerTextures } from './render/lux-illumination-triggers';
import { loadLuxIlluminationTextures } from './render/lux-illumination';
import { loadLuxGroundWarningTextures } from './render/lux-ground-warnings';
import { loadLuxGroundChargeTextures } from './render/lux-ground-charge';
import { loadLuxScorchTextures } from './render/lux-scorches';
import { loadLuxImpactTextures } from './render/lux-impacts';
import { loadLuxCrescentAssets } from './render/lux-attack-crescents';
import { loadLuxTrailTextures } from './render/lux-attack-trails';
import { loadLuxAttackTextures } from './render/lux-attack-hoops';
import './style.css';
import { readMatch, writeMatch } from './storage/match-store';
import { downloadMatch, prepareMatchImport } from './storage/match-files';
import { DT } from './content/rules';
import { World } from './simulation/world';
import { createGrompEncounter } from './simulation/gromp-encounter';
import { createLaneMatch } from './simulation/lane-match';
import { GameView } from './render/view';
import { Hud } from './ui/hud';
import { loadInterfaceFonts } from './ui/fonts';
import { GameInput } from './input/input';
import { GameAudio } from './audio/audio';
import { loadLuxChargeRayTextures } from './render/lux-charge-rays';
import { loadLuxBokehTextures } from './render/lux-bokeh';
import { loadLuxRStreakTextures } from './render/lux-r-streaks';
import { loadLuxBeamTextures } from './render/lux-beams';
import { loadReferenceModels } from './render/models';
import { RIFT_CAMPS } from './content/rift-camps';
import type { MonsterSpecies } from './content/monsters';
import { loadHawkshotWind } from './render/hawkshot-wind';
import { loadAsheAttackArrow } from './render/ashe-attack-arrow';
import { loadHawkshotDust } from './render/hawkshot-dust';
import { loadHawkshotSmoke } from './render/hawkshot-smoke';
import { loadHawkshotArrival } from './render/hawkshot-arrival';
import { loadHawkshotSparkle } from './render/hawkshot-sparkle';
import { loadLingerAurora } from './render/hawkshot-linger-aurora';
import { loadHawkshot } from './render/hawkshot';
import { loadRiftBattlefield } from './content/rift';
import { PRACTICE_FIXTURE } from './content/practice-fixture';
import { loadGarenSpin } from './render/garen-spin';

const host = document.querySelector<HTMLElement>('#app')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;

async function boot(): Promise<void> {
  const fixture =
    import.meta.env.DEV && new URLSearchParams(location.search).get('scene') === 'fixture';
  const battlefield = fixture ? PRACTICE_FIXTURE : await loadRiftBattlefield();
  const garenFixture = fixture && new URLSearchParams(location.search).get('champion') === 'garen';
  const grompEncounter =
    fixture && new URLSearchParams(location.search).get('encounter') === 'gromp';
  const freshPractice = (champion: 'ashe' | 'lux' | 'garen' = 'ashe') =>
    grompEncounter
      ? createGrompEncounter(battlefield, champion)
      : new World(true, battlefield, champion);
  let world = freshPractice(garenFixture ? 'garen' : 'ashe');
  let restored = false,
    saveNotice = '';
  try {
    const saved = await readMatch(battlefield.id);
    const candidate = saved ? World.fromSnapshot(saved, battlefield) : null;
    if (
      candidate &&
      (!garenFixture || candidate.hero.champion === 'garen') &&
      candidate.encounter === (grompEncounter ? 'gromp' : null)
    ) {
      world = candidate;
      restored = true;
    }
  } catch (error) {
    saveNotice = error instanceof Error ? error.message : 'Saved match could not be loaded.';
  }
  let view: GameView;
  try {
    view = new GameView(host, battlefield);
  } catch (error) {
    loading.innerHTML =
      '<span class="loading-mark">◇</span><h1>Unable to open the Rift</h1><p>This game requires WebGL 2. Enable hardware acceleration and reload.</p>';
    console.error(error);
    return;
  }
  const audio = new GameAudio(world.events);
  let paused = false,
    accumulator = 0,
    previous = performance.now(),
    elapsed = 0;
  let input: GameInput | undefined;
  const setPaused = (value: boolean) => {
    paused = value || document.hidden || !!hud.graphicsState;
    hud.paused = paused;
    audio.setPaused(paused);
    accumulator = 0;
    previous = performance.now();
    // Release unfinished gestures; accepted commands belong to the frozen match state.
    if (paused) input?.release();
  };
  const hud = new Hud(host, world, view, {
    pause: setPaused,
    reset: () => {
      void writeMatch(
        battlefield.id,
        world.matchMode === 'lanes'
          ? createLaneMatch(battlefield, selectableChampion(world.hero.champion)).snapshot()
          : grompEncounter || world.hero.champion === 'lux' || world.hero.champion === 'garen'
            ? freshPractice(world.hero.champion).snapshot()
            : null
      )
        .then(() => window.location.reload())
        .catch((error) => hud.toast(error.message));
    },
    startMatch: async (mode, champion) => {
      const next =
        mode === 'lanes' ? createLaneMatch(battlefield, champion) : freshPractice(champion);
      await writeMatch(battlefield.id, next.snapshot());
      window.location.reload();
    },
    save: async () => writeMatch(battlefield.id, world.snapshot()),
    exportMatch: () => downloadMatch(world),
    prepareImport: (file) =>
      prepareMatchImport(file, battlefield, async (snapshot) => {
        await writeMatch(battlefield.id, snapshot);
        window.location.reload();
      }),
    sound: (enabled) => {
      audio.enabled = enabled;
    },
  });
  input = new GameInput(world, view, hud, () => audio.unlock());
  if (restored) {
    view.recenter(world.hero);
    hud.root.querySelector('.welcome')?.remove();
  }
  window.addEventListener('resize', () => view.resize());
  // A scheduled camp can appear after boot, including a checkpoint whose last
  // corpse has already expired. Its rig must be ready before simulation resumes.
  const monsterSpecies = [
    ...new Set<MonsterSpecies>([
      ...world.jungleCamps.map((c) => RIFT_CAMPS.find((d) => d.id === c.id)!.species),
      ...world.units.flatMap((u) => (u.kind === 'monster' ? [u.monster.species] : [])),
    ]),
  ];
  const hasGrompContent = monsterSpecies.includes('gromp');
  const assetsReady = Promise.all([
    loadInterfaceFonts(),
    audio.load(world.units.some((u) => u.champion === 'garen')),
    loadReferenceModels(monsterSpecies),
    ...(hasGrompContent ? [view.grompDeath.load(), view.grompAttack.load()] : []),
    loadGarenSpin(),
    ...(world.units.some((u) => u.champion === 'garen')
      ? [view.garenJustice.load(), view.garenCourage.load(), view.garenDecisiveStrike.load()]
      : []),
    loadLuxBeamTextures(),
    loadLuxRStreakTextures(),
    loadLuxBokehTextures(),
    loadLuxScorchTextures(),
    loadLuxGroundChargeTextures(),
    loadLuxGroundWarningTextures(),
    loadLuxChargeRayTextures(),
    loadLuxAttackTextures(),
    loadLuxImpactTextures(),
    loadLuxIlluminationTextures(),
    loadLuxIlluminationTriggerTextures(),
    loadLuxTrailTextures(),
    loadLuxCrescentAssets(),
    loadHawkshot(),
    loadAsheAttackArrow(),
    loadHawkshotWind(),
    loadHawkshotDust(),
    loadHawkshotSmoke(),
    loadHawkshotArrival(),
    loadHawkshotSparkle(),
    loadLingerAurora(),
    view.loadEnvironment(),
  ]);
  const pauseForInterruption = () => {
    if (!hud.modal) hud.toggleModal('pause');
    hud.focusModal();
    setPaused(true);
  };
  window.addEventListener('blur', pauseForInterruption);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseForInterruption();
  });
  if (document.hidden) pauseForInterruption();
  if (restored || saveNotice) {
    hud.toggleModal(world.winner ? 'result' : 'pause');
    hud.focusModal();
    setPaused(true);
  }
  let graphicsGeneration = 0;
  let cancelWarmup: (() => void) | undefined;
  const warmGraphics = async (): Promise<boolean> => {
    const generation = graphicsGeneration;
    if (view.renderer.getContext().isContextLost()) return false;
    let cancel!: () => void;
    const interrupted = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    cancelWarmup = cancel;
    try {
      view.render(world, 1, elapsed);
      await Promise.race([view.renderer.compileAsync(view.scene, view.camera), interrupted]);
      if (generation !== graphicsGeneration || view.renderer.getContext().isContextLost())
        return false;
      view.render(world, 1, elapsed);
      return true;
    } finally {
      if (cancelWarmup === cancel) cancelWarmup = undefined;
    }
  };
  view.renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    view.smoke.depth.dispose();
    graphicsGeneration++;
    cancelWarmup?.();
    hud.setGraphicsState('lost');
    setPaused(true);
  });
  view.renderer.domElement.addEventListener('webglcontextrestored', () => {
    const generation = graphicsGeneration;
    hud.setGraphicsState('restoring');
    void (async () => {
      try {
        await assetsReady;
        if (generation !== graphicsGeneration) return;
        if (!(await warmGraphics()) || generation !== graphicsGeneration) return;
        hud.setGraphicsState(null);
        setPaused(true);
        hud.toast('Graphics restored. Resume when you’re ready.');
      } catch (error) {
        if (generation !== graphicsGeneration) return;
        console.error(error);
        hud.setGraphicsState('failed');
        setPaused(true);
      }
    })();
  });
  await assetsReady;
  // A loss during loading hands warmup to the restoration handler.
  if (!hud.graphicsState) await warmGraphics();
  loading.classList.add('finished');
  if (restored) hud.toast('Saved match restored. Resume when you’re ready.');
  else if (saveNotice) hud.toast(saveNotice);
  window.setTimeout(() => loading.remove(), 600);
  let frames = 0,
    frameTime = 0,
    fps = 60,
    uiElapsed = 0;
  view.renderer.setAnimationLoop(() => {
    if (hud.graphicsState) {
      previous = performance.now();
      return;
    }
    const now = performance.now(),
      dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    elapsed += paused && !world.winner ? 0 : dt;
    frameTime += dt;
    frames++;
    if (frameTime >= 0.5) {
      fps = frames / frameTime;
      frameTime = 0;
      frames = 0;
    }
    input!.update(dt);
    if (!paused) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= DT && steps < 6) {
        world.step();
        accumulator -= DT;
        steps++;
      }
      if (accumulator >= DT) accumulator = 0;
    }
    view.render(world, paused ? 1 : accumulator / DT, elapsed);
    input!.updateHover();
    uiElapsed += dt;
    if (uiElapsed >= 0.05) {
      hud.update(fps);
      uiElapsed = 0;
    }
    audio.updateBindingFlight(
      world.projectiles.filter((p) => world.projectileVisible(p)),
      world.bindingStops.filter((s) => s.team === 'blue' || world.pointVisible(s.point, 'blue')),
      world.tick,
      view.center
    );
    audio.updateFlight(
      world.projectiles.filter((p) => world.projectileVisible(p)),
      world.scoutVisuals.filter((e) => e.team === 'blue' || world.pointVisible(e, 'blue')),
      world.tick
    );
    audio.updateLinger(
      world.scoutVisuals.filter(
        (effect) => effect.team === 'blue' || world.pointVisible(effect, 'blue')
      ),
      world.tick
    );
    audio.updateGaren(world, view.center);
    audio.update(
      world.events.filter((event) => world.eventVisible(event)),
      world.tick,
      view.center
    );
  });
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __GAME__: {
        world,
        view,
        hud,
        audio,
        setPaused,
        snapshot: () => JSON.parse(world.snapshot()),
        ready: true,
      },
    });
  }
}

void boot().catch((error) => {
  console.error(error);
  loading.innerHTML = '<h1>Loading interrupted</h1><p>Reload to try again.</p>';
});
