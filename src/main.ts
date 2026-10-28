import { selectableChampion } from './content/champion-profiles';
import { loadLuxIlluminationTriggerTextures } from './render/lux-illumination-triggers';
import { loadLuxESource } from './render/lux-e-source';
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
import { createBaronEncounter } from './simulation/baron-encounter';
import { createLaneMatch } from './simulation/lane-match';
import { equipSummoners } from './simulation/smite';
import { grantCompanion } from './simulation/owned-companions';
import { COMPANION_SOURCE, type CompanionKind } from './content/companion-policy';
import { loadOwnedCompanions } from './render/owned-companions';
import { loadOracleLens } from './render/oracle-lens';
import { swapTrinket, trinketSwapError } from './simulation/trinkets';
import { companionItemKind } from './content/companion-items-policy';
import { GameView } from './render/view';
import { FramePacer } from './render/frame-pacer';
import { FrameRate } from './render/frame-rate';
import { Hud } from './ui/hud';
import { isPlayerFeedback } from './ui/player-feedback';
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
  const query = new URLSearchParams(location.search);
  const fixture = import.meta.env.DEV && query.get('scene') === 'fixture';
  const baronEncounter = fixture && query.get('encounter') === 'baron';
  const rosterRiftTrial = import.meta.env.DEV && query.get('scene') === 'roster-rift';
  const leonaRiftTrial = import.meta.env.DEV && query.get('scene') === 'leona-rift';
  const garenRiftTrial = import.meta.env.DEV && query.get('scene') === 'garen-rift';
  const masterYiRiftTrial = import.meta.env.DEV && query.get('scene') === 'masteryi-rift';
  const masterYiBotRiftTrial = masterYiRiftTrial && query.get('bots') === 'masteryi';
  const ahriRiftTrial = import.meta.env.DEV && query.get('scene') === 'ahri-rift';
  const ahriBotRiftTrial = ahriRiftTrial && query.get('bots') === 'ahri';
  const masterYiNpc =
    fixture && !baronEncounter && query.get('npc') === 'masteryi' && !query.has('champion');
  const ahriPlayerFixture = fixture && query.get('champion') === 'ahri';
  const masterYiPlayerFixture = fixture && query.get('champion') === 'masteryi';
  const rawBattlefield = fixture ? PRACTICE_FIXTURE : await loadRiftBattlefield();
  const loadedBattlefield = baronEncounter
    ? { ...rawBattlefield, developmentBaron: true as const }
    : rawBattlefield;
  const battlefield = rosterRiftTrial
    ? {
        ...loadedBattlefield,
        developmentRosterBots: true as const,
        developmentGaren: true as const,
        developmentLeona: true as const,
        developmentAhriRift: true as const,
        developmentAhriBots: true as const,
        developmentMasterYiRift: true as const,
        developmentMasterYiBots: true as const,
      }
    : ahriRiftTrial
      ? {
          ...loadedBattlefield,
          developmentAhriRift: true as const,
          ...(ahriBotRiftTrial ? { developmentAhriBots: true as const } : {}),
        }
      : masterYiRiftTrial
        ? {
            ...loadedBattlefield,
            developmentMasterYiRift: true as const,
            ...(masterYiBotRiftTrial ? { developmentMasterYiBots: true as const } : {}),
          }
        : leonaRiftTrial
          ? { ...loadedBattlefield, developmentLeona: true as const }
          : garenRiftTrial
            ? { ...loadedBattlefield, developmentGaren: true as const }
            : masterYiPlayerFixture
              ? { ...loadedBattlefield, developmentMasterYi: true as const }
              : ahriPlayerFixture
                ? { ...loadedBattlefield, developmentAhri: true as const }
                : loadedBattlefield;
  const saveKey = baronEncounter
    ? 'development-baron-encounter'
    : rosterRiftTrial
      ? 'development-roster-rift'
      : ahriBotRiftTrial
        ? 'development-ahri-bots-rift'
        : ahriRiftTrial
          ? 'development-ahri-rift'
          : masterYiBotRiftTrial
            ? 'development-masteryi-bots-rift'
            : masterYiRiftTrial
              ? 'development-masteryi-rift'
              : masterYiPlayerFixture
                ? 'development-masteryi-player-fixture'
                : masterYiNpc
                  ? 'development-masteryi-npc-fixture'
                  : leonaRiftTrial
                    ? 'development-leona-rift'
                    : garenRiftTrial
                      ? 'development-garen-rift'
                      : ahriPlayerFixture
                        ? 'development-ahri-player-fixture'
                        : battlefield.id;
  const leonaNpc =
    fixture && !baronEncounter && new URLSearchParams(location.search).get('npc') === 'leona';
  const ahriNpc = fixture && !baronEncounter && query.get('npc') === 'ahri';
  const garenFixture = fixture && new URLSearchParams(location.search).get('champion') === 'garen';
  const leonaFixture = fixture && new URLSearchParams(location.search).get('champion') === 'leona';
  const grompEncounter =
    fixture && new URLSearchParams(location.search).get('encounter') === 'gromp';
  const companionQuery = grompEncounter
    ? new URLSearchParams(location.search).get('companion')
    : null;
  const companionKind =
    companionQuery && Object.hasOwn(COMPANION_SOURCE.profiles, companionQuery)
      ? (companionQuery as CompanionKind)
      : null;
  const freshPractice = (champion: import('./simulation/types').ChampionIdentity = 'ashe') => {
    if (!fixture && champion !== 'ashe' && champion !== 'lux')
      throw new Error('Choose Ashe or Lux for practice in this trial.');
    return baronEncounter
      ? createBaronEncounter(battlefield, champion)
      : grompEncounter
        ? (() => {
            const next = createGrompEncounter(battlefield, champion);
            if (companionKind) {
              equipSummoners(next.player, { d: 'flash', f: 'smite' });
              grantCompanion(next, companionKind);
            }
            return next;
          })()
        : (() => {
            const next = new World(true, battlefield, champion);
            if (leonaNpc) {
              const npc = next.spawn('champion', 'blue', { x: -650, y: 350 }, 'leona');
              next.gainExperience(2400, npc.id);
              for (const ability of ['q', 'w', 'e', 'r'] as const) next.learnSpell(ability, npc.id);
            }
            if (masterYiNpc)
              next.spawn('champion', 'blue', { x: -650, y: 350 }, 'masteryi').ai = false;
            if (ahriNpc) next.spawn('champion', 'blue', { x: -650, y: 350 }, 'ahri');
            return next;
          })();
  };
  let world = rosterRiftTrial
    ? createLaneMatch(battlefield, 'ashe')
    : ahriRiftTrial
      ? createLaneMatch(battlefield, 'ahri')
      : masterYiRiftTrial
        ? createLaneMatch(battlefield, 'masteryi', { d: 'smite', f: 'flash' })
        : leonaRiftTrial
          ? createLaneMatch(battlefield, 'leona')
          : garenRiftTrial
            ? createLaneMatch(battlefield, 'garen')
            : freshPractice(
                masterYiPlayerFixture
                  ? 'masteryi'
                  : ahriPlayerFixture
                    ? 'ahri'
                    : garenFixture
                      ? 'garen'
                      : leonaFixture
                        ? 'leona'
                        : 'ashe'
              );
  let restored = false,
    saveNotice = '';
  try {
    const saved = await readMatch(saveKey);
    const candidate = saved ? World.fromSnapshot(saved, battlefield) : null;
    if (
      candidate &&
      (!garenFixture || candidate.hero.champion === 'garen') &&
      (!leonaFixture || candidate.hero.champion === 'leona') &&
      (!masterYiPlayerFixture ||
        (candidate.hero.champion === 'masteryi' && candidate.matchMode === 'practice')) &&
      (!ahriPlayerFixture ||
        (candidate.hero.champion === 'ahri' && candidate.matchMode === 'practice')) &&
      (!leonaNpc || candidate.units.some((u) => u.champion === 'leona')) &&
      (!ahriNpc || candidate.units.some((u) => u.champion === 'ahri')) &&
      (!masterYiNpc ||
        (candidate.hero.champion === 'ashe' &&
          candidate.units.some((u) => u.champion === 'masteryi'))) &&
      candidate.encounter === (baronEncounter ? 'baron' : grompEncounter ? 'gromp' : null) &&
      (candidate.companions.find(
        (p) => p.ownerId === candidate.player.id && p.acquisition.kind === 'fixture'
      )?.kind ?? null) === companionKind
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
  const frameRate = new FrameRate();
  let paused = false,
    accumulator = 0,
    previous = performance.now(),
    elapsed = 0;
  let input: GameInput | undefined;
  let requestFrame = () => {};
  view.onAssetsReady = () => requestFrame();
  const setPaused = (value: boolean) => {
    paused = value || document.hidden || !!hud.graphicsState;
    hud.paused = paused;
    // Freeze the result's simulation while its scheduled audio tails finish.
    audio.setPaused((paused && !world.winner) || document.hidden || !!hud.graphicsState);
    accumulator = 0;
    previous = performance.now();
    frameRate.reset();
    // Release unfinished gestures; accepted commands belong to the frozen match state.
    if (paused) {
      input?.release();
      hud.releaseMinimapCamera();
    }
    requestFrame();
  };
  const hud = new Hud(host, world, view, {
    pause: setPaused,
    swapTrinket: async (kind) => {
      const error = trinketSwapError(world, kind);
      if (error) return error;
      if (kind === 'oracle') {
        try {
          await Promise.all([loadOracleLens(), audio.oracle.load()]);
        } catch {
          return 'Oracle Lens could not be prepared. Try again.';
        }
      }
      return swapTrinket(world, kind);
    },
    buyItem: async (itemId) => {
      const error = world.purchaseError(itemId);
      if (error) return error;
      const kind = companionItemKind(itemId);
      if (kind) {
        try {
          await loadOwnedCompanions([kind]);
        } catch {
          return 'Companion could not be prepared. Try again.';
        }
      }
      // The match continues while preparing; revalidate gold, ownership and shop access.
      return world.buy(itemId);
    },
    reset: () => {
      void writeMatch(
        saveKey,
        world.matchMode === 'lanes'
          ? createLaneMatch(
              battlefield,
              rosterRiftTrial
                ? world.hero.champion
                : ahriRiftTrial && world.hero.champion === 'ahri'
                  ? 'ahri'
                  : masterYiRiftTrial && world.hero.champion === 'masteryi'
                    ? 'masteryi'
                    : leonaRiftTrial && world.hero.champion === 'leona'
                      ? 'leona'
                      : garenRiftTrial && world.hero.champion === 'garen'
                        ? 'garen'
                        : selectableChampion(world.hero.champion),
              world.player.summoners
            ).snapshot()
          : grompEncounter ||
              world.hero.champion === 'lux' ||
              world.hero.champion === 'garen' ||
              world.hero.champion === 'leona' ||
              world.hero.champion === 'ahri' ||
              world.hero.champion === 'masteryi' ||
              world.player.summoners.d !== 'flash' ||
              world.player.summoners.f !== 'heal'
            ? (() => {
                const next = freshPractice(world.hero.champion);
                equipSummoners(next.player, world.player.summoners);
                return next.snapshot();
              })()
            : null
      )
        .then(() => window.location.reload())
        .catch((error) => hud.toast(error.message));
    },
    startMatch: async (mode, champion, summoners) => {
      const next =
        mode === 'lanes'
          ? createLaneMatch(battlefield, champion, summoners)
          : freshPractice(champion);
      if (mode === 'practice') equipSummoners(next.player, summoners);
      await writeMatch(saveKey, next.snapshot());
      window.location.reload();
    },
    save: async () => writeMatch(saveKey, world.snapshot()),
    exportMatch: () => downloadMatch(world),
    prepareImport: (file) =>
      prepareMatchImport(
        file,
        battlefield,
        async (snapshot) => {
          await writeMatch(saveKey, snapshot);
          window.location.reload();
        },
        masterYiPlayerFixture
          ? 'masteryi'
          : ahriPlayerFixture
            ? 'ahri'
            : masterYiNpc
              ? 'ashe'
              : undefined,
        masterYiNpc ? 'masteryi' : undefined,
        baronEncounter ? 'baron' : undefined
      ),
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
      ...(world.scuttlers ? ['scuttler' as const] : []),
      ...world.jungleCamps.flatMap((c) =>
        RIFT_CAMPS.find((d) => d.id === c.id)!.members.map((m) => m.species)
      ),
      ...world.units.flatMap((u) => (u.kind === 'monster' ? [u.monster.species] : [])),
    ]),
  ];
  const hasGrompContent = monsterSpecies.includes('gromp');
  const assetsReady = Promise.all([
    ...(world.units.some((u) => {
      const s = world.championState(u.id)?.trinket;
      return s?.kind === 'oracle' || !!s?.scan || !!s?.visuals.length;
    })
      ? [loadOracleLens(), audio.oracle.load()]
      : []),
    loadOwnedCompanions(world.companions.map((p) => p.kind)),
    loadInterfaceFonts(),
    audio.load(
      world.units.some((u) => u.champion === 'garen'),
      world.units.some((u) => u.champion === 'masteryi')
    ),
    loadReferenceModels(
      monsterSpecies,
      world.units.some((u) => u.champion === 'leona'),
      world.units.some((u) => u.champion === 'ahri'),
      world.units.some((u) => u.champion === 'masteryi')
    ),
    ...(hasGrompContent ? [view.grompDeath.load(), view.grompAttack.load()] : []),
    ...(world.units.some((u) => u.champion === 'leona')
      ? [
          view.sunlight.load(),
          view.leonaDaybreak.load(),
          view.leonaEclipseSkins.load(),
          view.leonaZenithSkins.load(),
          view.leonaSolarSkins.load(),
          view.leonaSolarProjections.load(),
          view.leonaZenithSurfaces.load(),
          view.leonaSolarSurfaces.load(),
          view.leonaZenithTrails.load(),
          view.leonaEclipseSurfaces.load(),
          audio.leonaW.load(),
          audio.leonaE.load(),
          audio.leonaR.load(),
          audio.leonaQ.load(),
          audio.leonaAA.load(),
          audio.leonaSunlight.load(),
          audio.leonaDeath.load(),
        ]
      : []),
    loadGarenSpin(),
    ...(world.units.some((u) => u.champion === 'masteryi')
      ? [
          view.highlanderCasts.load(),
          view.highlanderKills.load(),
          view.primaryHits.load().catch((error) => {
            console.warn(
              'Primary hit effects unavailable; explicit retry remains available.',
              error
            );
          }),
          view.meditateDamage.load(),
          view.swordGlows.load(),
          view.passiveTrails.load().catch((error) => {
            console.warn(
              'Passive attack trails unavailable; explicit retry remains available.',
              error
            );
          }),
          view.primaryTrails.load().catch((error) => {
            console.warn(
              'Primary attack trails unavailable; explicit retry remains available.',
              error
            );
          }),
          view.alphaCasts.load(),
          view.alphaEnds.load(),
          view.alphaContacts.load(),
          view.meditateCasts.load(),
          view.meditateBuffs.load(),
        ]
      : []),
    ...(world.units.some((u) => u.champion === 'garen')
      ? [
          view.garenJustice.load(),
          view.garenCourage.load(),
          view.garenDecisiveStrike.load(),
          view.garenPerseverance.load(),
          view.garenBasicAttacks.load(),
        ]
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
    loadLuxESource(),
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
    else requestFrame();
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
    view.leonaEclipseSurfaces.disposeDepth();
    view.particleDistortion.dispose();
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
  else if (rosterRiftTrial) hud.toast('Development trial: combined champion roster on the Rift.');
  else if (leonaRiftTrial) hud.toast('Development trial: Leona support on Summoner’s Rift.');
  else if (garenRiftTrial) hud.toast('Development trial: Garen top on Summoner’s Rift.');
  else if (masterYiBotRiftTrial)
    hud.toast('Development trial: Master Yi jungle bots on Summoner’s Rift.');
  else if (masterYiRiftTrial) hud.toast('Development trial: Master Yi jungle on Summoner’s Rift.');
  else if (ahriBotRiftTrial) hud.toast('Development trial: Ahri mid bots on Summoner’s Rift.');
  else if (ahriRiftTrial) hud.toast('Development trial: Ahri mid on Summoner’s Rift.');
  window.setTimeout(() => loading.remove(), 600);
  let uiElapsed = 0;
  const pacer = new FramePacer();
  let loopRunning = false;
  const stopLoop = () => {
    view.renderer.setAnimationLoop(null);
    loopRunning = false;
  };
  const frame = (timestamp: number) => {
    if (document.hidden || hud.graphicsState) {
      stopLoop();
      previous = performance.now();
      return;
    }
    if (!pacer.ready(timestamp)) return;
    const now = performance.now(),
      dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    elapsed += paused && !world.winner ? 0 : dt;
    if (!paused || world.winner) frameRate.record(now);
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
    world.withVisionSnapshot(() => {
      view.render(world, paused ? 1 : accumulator / DT, elapsed);
      input!.updateHoverAfterRender();
      uiElapsed += dt;
      if (uiElapsed >= 0.05 || paused) {
        hud.update(frameRate.value);
        uiElapsed = 0;
      }
      const audibleProjectiles = world.projectiles.filter((p) => world.projectileVisible(p));
      const audibleScouts = world.scoutVisuals.filter(
        (effect) => effect.team === 'blue' || world.pointVisible(effect, 'blue')
      );
      audio.updateBindingFlight(
        audibleProjectiles,
        world.bindingStops.filter((s) => s.team === 'blue' || world.pointVisible(s.point, 'blue')),
        world.tick,
        view.center
      );
      audio.updateFlight(audibleProjectiles, audibleScouts, world.tick);
      audio.updateLinger(audibleScouts, world.tick);
      audio.updateLuxE(world, view.center);
      audio.updateOracle(world, view.center);
      audio.updateGaren(world, view.center);
      audio.updateLeona(world, view.center);
      audio.update(
        world.events.filter(
          (event) => world.eventVisible(event) && isPlayerFeedback(event, world.player.id)
        ),
        world.tick,
        view.center
      );
    });
    if (paused && !world.winner) stopLoop();
  };
  requestFrame = () => {
    if (document.hidden || hud.graphicsState) {
      if (loopRunning) stopLoop();
      return;
    }
    if (loopRunning) return;
    previous = performance.now();
    frameRate.reset();
    pacer.reset();
    loopRunning = true;
    view.renderer.setAnimationLoop(frame);
  };
  // A paused frame is static. Paint once after an interaction or resize, then
  // sleep again; menus and asynchronous DOM feedback retain their own events.
  for (const event of ['resize', 'click', 'keydown', 'keyup', 'wheel'])
    window.addEventListener(event, () => requestFrame());
  requestFrame();
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __GAME__: {
        world,
        view,
        hud,
        audio,
        setPaused,
        // Repaint direct fixture edits without resetting input or advancing time.
        repaint: requestFrame,
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
