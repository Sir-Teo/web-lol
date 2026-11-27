import { publicSelectableChampion, selectableChampion } from './content/champion-profiles';
import { DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from './content/bot-difficulty';
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
import { readMatch, writeMatch, replaceMatch, recoveryMatchKey } from './storage/match-store';
import { RecoveryCheckpoints } from './storage/recovery-checkpoints';
import {
  readSoundEnabled,
  writeSoundEnabled,
  readSoundMix,
  writeSoundMix,
} from './storage/sound-preference';
import {
  loadPlayerSettings,
  savePlayerSettings,
  resetPlayerSettings,
  type PlayerSettings,
} from './storage/player-settings';
import { downloadMatch, prepareMatchImport } from './storage/match-files';
import { applyImmediatePracticeTool, type PracticeToolAction } from './practice/practice-tools';
import {
  MatchReplayPlayer,
  MatchReplayRecorder,
  downloadReplayLog,
  prepareReplayImport,
  type MatchReplayLog,
} from './replay/match-replay';
import { DT, TICK_RATE } from './content/rules';
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
import { ensureModelLoaded, loadReferenceModels } from './render/models';
import type { RuneLoadout } from './content/runes';
import { applyInitialRuneShards, createChampionRuneState } from './simulation/runes';
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
import { ORIGINAL_CHAMPIONS } from './content/original-lineup';

const host = document.querySelector<HTMLElement>('#app')!;
const loading = document.querySelector<HTMLDivElement>('#loading')!;

async function boot(): Promise<void> {
  const query = new URLSearchParams(location.search);
  const rosterPlaytest = import.meta.env.PROD && import.meta.env.MODE === 'roster-playtest';
  const fixture = import.meta.env.DEV && query.get('scene') === 'fixture';
  const baronEncounter = fixture && query.get('encounter') === 'baron';
  const rosterRiftTrial =
    rosterPlaytest || (import.meta.env.DEV && query.get('scene') === 'roster-rift');
  const liveBaron =
    rosterPlaytest ||
    (rosterRiftTrial && import.meta.env.DEV && query.get('objectives') === 'baron');
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
  const publicRift =
    !fixture &&
    !rosterRiftTrial &&
    !ahriRiftTrial &&
    !masterYiRiftTrial &&
    !leonaRiftTrial &&
    !garenRiftTrial;
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
        ...(liveBaron ? { rosterPlaytestBaron: true as const } : {}),
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
                : publicRift
                  ? { ...loadedBattlefield, publicRift: true as const }
                  : loadedBattlefield;
  const saveKey = rosterRiftTrial
    ? rosterPlaytest
      ? 'roster-playtest'
      : liveBaron
        ? 'development-roster-baron'
        : 'development-roster-rift'
    : baronEncounter
      ? 'development-baron-encounter'
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
  const freshPractice = (
    champion: import('./simulation/types').ChampionIdentity = 'ashe',
    botDifficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY
  ) => {
    if (!fixture && !publicRift && champion !== 'ashe' && champion !== 'lux')
      throw new Error('Choose Ashe or Lux for practice in this trial.');
    const created = baronEncounter
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
            const next = new World(true, battlefield, champion, botDifficulty);
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
    created.botDifficulty = botDifficulty;
    return created;
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
    saveNotice = '',
    recoveryAvailable = false;
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
  try {
    recoveryAvailable = (await readMatch(recoveryMatchKey(saveKey))) !== undefined;
  } catch {
    // Optional discovery must not prevent a valid manual checkpoint from opening.
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
  const soundEnabled = readSoundEnabled();
  const soundMix = readSoundMix();
  let playerSettings: PlayerSettings = loadPlayerSettings();
  view.setAccessibility(playerSettings.colorVision, playerSettings.reducedMotion);
  const audio = new GameAudio(world.events);
  audio.enabled = soundEnabled;
  audio.setMix(soundMix);
  const recorder = new MatchReplayRecorder(world, 30 * TICK_RATE);
  let replayPlayer: MatchReplayPlayer | null = null;
  const activeWorld = () => replayPlayer?.world ?? world;
  const sessionAbort = new AbortController();
  const signal = sessionAbort.signal;
  const frameRate = new FrameRate();
  let paused = false,
    accumulator = 0,
    previous = performance.now(),
    elapsed = 0;
  let input: GameInput | undefined;
  let checkpoints: RecoveryCheckpoints | undefined;
  let requestFrame = () => {};
  view.onAssetsReady = () => requestFrame();
  const syncReplayHud = () => {
    if (!replayPlayer) {
      hud.setReplayState(null);
      return;
    }
    hud.setReplayState({
      active: true,
      playing: replayPlayer.playing && !paused,
      speed: replayPlayer.speed,
      startTick: replayPlayer.log.startTick,
      currentTick: replayPlayer.world.tick,
      endTick: replayPlayer.log.endTick,
      verifiedCheckpoints: replayPlayer.verifiedCheckpoints,
      totalCheckpoints: replayPlayer.log.checkpoints.length,
      error: replayPlayer.divergenceError,
    });
  };
  const setPaused = (value: boolean) => {
    paused = value || document.hidden || !!hud.graphicsState;
    hud.paused = paused;
    const current = activeWorld();
    // Freeze the result's simulation while its scheduled audio tails finish.
    audio.setPaused((paused && !current.winner) || document.hidden || !!hud.graphicsState);
    accumulator = 0;
    previous = performance.now();
    frameRate.reset();
    // Release unfinished gestures; accepted commands belong to the frozen match state.
    if (paused) {
      input?.release();
      hud.releaseMinimapCamera();
      if (!replayPlayer) checkpoints?.checkpoint(world.tick, true);
    }
    syncReplayHud();
    requestFrame();
  };
  const prepareImport = (file: File) =>
    prepareMatchImport(
      file,
      battlefield,
      async (snapshot) => {
        await checkpoints!.replace(snapshot, world.tick);
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
    );
  let prepareRosterAssets!: (targetWorld: World, includeEnvironment: boolean) => Promise<unknown>;
  const startReplay = async (log: MatchReplayLog) => {
    const nextPlayer = new MatchReplayPlayer(log, battlefield);
    await prepareRosterAssets(nextPlayer.world, false);
    replayPlayer = nextPlayer;
    hud.modal = null;
    hud.root.querySelector<HTMLElement>('#modal')!.hidden = true;
    hud.setWorld(nextPlayer.world, true);
    input!.setWorld(nextPlayer.world, true);
    audio.syncWorld(nextPlayer.world);
    view.recenter(nextPlayer.world.hero);
    setPaused(false);
    hud.update(frameRate.value);
    requestFrame();
  };
  const exitReplay = () => {
    if (!replayPlayer) return;
    replayPlayer = null;
    hud.setReplayState(null);
    hud.setWorld(world, false);
    input!.setWorld(world, false);
    audio.syncWorld(world);
    view.recenter(world.hero);
    hud.toggleModal(world.winner ? 'result' : 'pause');
    hud.focusModal();
    setPaused(true);
    hud.update(frameRate.value);
    requestFrame();
  };
  const hud = new Hud(
    host,
    world,
    view,
    {
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
        if (kind === 'farsight') {
          try {
            await ensureModelLoaded('farsightward-base');
          } catch {
            return 'Farsight Alteration could not be prepared. Try again.';
          }
        }
        const swapError = swapTrinket(world, kind);
        if (swapError === null) recorder.recordTrinketSwap(kind, world.player.id);
        return swapError;
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
        if (itemId === 'control-ward') {
          try {
            await ensureModelLoaded('controlward-base');
          } catch {
            return 'Control Ward could not be prepared. Try again.';
          }
        }
        // The match continues while preparing; revalidate gold, ownership and shop access.
        return world.buy(itemId);
      },
      practiceTool: (action: PracticeToolAction) => {
        if (action === 'fast-forward-30s') {
          recorder.step(30 * TICK_RATE);
          checkpoints?.checkpoint(world.tick, !!world.winner);
          hud.update(frameRate.value);
          requestFrame();
          return 'Advanced match by 30 seconds';
        }
        const message = applyImmediatePracticeTool(world, action);
        recorder.recordPractice(action);
        hud.update(frameRate.value);
        requestFrame();
        return message;
      },
      reset: () => {
        void checkpoints!
          .replace(
            world.matchMode === 'lanes'
              ? createLaneMatch(
                  battlefield,
                  publicRift
                    ? publicSelectableChampion(world.hero.champion)
                    : rosterRiftTrial
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
                  world.player.summoners,
                  world.botDifficulty,
                  world.player.runeState?.loadout
                ).snapshot()
              : grompEncounter ||
                  world.botDifficulty !== DEFAULT_BOT_DIFFICULTY ||
                  world.hero.champion !== 'ashe' ||
                  !!world.player.runeState ||
                  world.player.summoners.d !== 'flash' ||
                  world.player.summoners.f !== 'heal'
                ? (() => {
                    const next = freshPractice(world.hero.champion, world.botDifficulty);
                    equipSummoners(next.player, world.player.summoners);
                    if (world.player.runeState?.loadout) {
                      next.player.runeState = createChampionRuneState(
                        world.player.runeState.loadout
                      );
                      applyInitialRuneShards(next, next.hero, next.player);
                    }
                    return next.snapshot();
                  })()
                : null,
            world.tick
          )
          .then(() => window.location.reload())
          .catch((error) => hud.toast(error.message));
      },
      startMatch: async (
        mode,
        champion,
        summoners,
        botDifficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
        runes?: RuneLoadout
      ) => {
        const next =
          mode === 'lanes'
            ? createLaneMatch(battlefield, champion, summoners, botDifficulty, runes)
            : freshPractice(champion, botDifficulty);
        if (mode === 'practice') {
          equipSummoners(next.player, summoners);
          if (runes && battlefield.publicRift) {
            next.player.runeState = createChampionRuneState(runes);
            applyInitialRuneShards(next, next.hero, next.player);
          }
        }
        await checkpoints!.replace(next.snapshot(), world.tick);
        window.location.reload();
      },
      save: async () => checkpoints!.save(world.snapshot(), world.tick),
      exportMatch: () => downloadMatch(activeWorld()),
      prepareImport,
      prepareRecovery: async () => {
        const snapshot = await readMatch(recoveryMatchKey(saveKey));
        if (snapshot === undefined) return null;
        const prepared = await prepareImport(
          new File([snapshot], 'recovery.json', { type: 'application/json' })
        );
        return { ...prepared, description: `Recovery checkpoint · ${prepared.description}` };
      },
      sound: (enabled) => {
        audio.enabled = enabled;
        writeSoundEnabled(enabled);
      },
      soundMix: () => ({ ...audio.mix }),
      updateSoundMix: (partial) => {
        const updated = audio.setMix(partial);
        writeSoundMix(updated);
        return updated;
      },
      playerSettings: () => playerSettings,
      updatePlayerSettings: (next) => {
        playerSettings = savePlayerSettings(next);
        view.setAccessibility(playerSettings.colorVision, playerSettings.reducedMotion);
        return playerSettings;
      },
      resetPlayerSettings: () => {
        playerSettings = resetPlayerSettings();
        view.setAccessibility(playerSettings.colorVision, playerSettings.reducedMotion);
        return playerSettings;
      },
      exportReplay: async () => {
        const log = replayPlayer ? replayPlayer.log : await recorder.exportLog();
        downloadReplayLog(log);
      },
      watchCurrentReplay: async () => {
        const log = await recorder.exportLog();
        await startReplay(log);
      },
      prepareReplay: (file) => prepareReplayImport(file, battlefield),
      watchPreparedReplay: (log) => startReplay(log),
      replayControl: (cmd) => {
        if (!replayPlayer) return;
        if (cmd.type === 'exit') {
          exitReplay();
          return;
        }
        if (cmd.type === 'toggle-play') {
          if (replayPlayer.atEnd && !replayPlayer.playing) {
            replayPlayer.seek(replayPlayer.log.startTick);
            hud.setWorld(replayPlayer.world, true);
            input!.setWorld(replayPlayer.world, true);
            audio.syncWorld(replayPlayer.world);
          }
          replayPlayer.playing = !replayPlayer.playing;
        } else if (cmd.type === 'restart') {
          replayPlayer.seek(replayPlayer.log.startTick);
          replayPlayer.playing = true;
          hud.setWorld(replayPlayer.world, true);
          input!.setWorld(replayPlayer.world, true);
          audio.syncWorld(replayPlayer.world);
        } else if (cmd.type === 'seek-delta') {
          replayPlayer.seek(replayPlayer.world.tick + cmd.deltaTicks);
          hud.setWorld(replayPlayer.world, true);
          input!.setWorld(replayPlayer.world, true);
          audio.syncWorld(replayPlayer.world);
        } else if (cmd.type === 'speed') {
          replayPlayer.speed = cmd.speed;
        }
        accumulator = 0;
        syncReplayHud();
        hud.update(frameRate.value);
        requestFrame();
      },
    },
    { soundEnabled, rosterPlaytest }
  );
  checkpoints = new RecoveryCheckpoints(
    world.tick,
    30 * TICK_RATE,
    {
      snapshot: () => world.snapshot(),
      recovery: (snapshot) => writeMatch(recoveryMatchKey(saveKey), snapshot),
      manual: (snapshot) => replaceMatch(saveKey, snapshot),
      failed: () =>
        hud.toast('Recovery checkpoint could not be saved. Your manual save is unchanged.'),
    },
    world.snapshot()
  );
  input = new GameInput(world, view, hud, () => audio.unlock(), () => playerSettings);
  if (restored) {
    view.recenter(world.hero);
    hud.root.querySelector('.welcome')?.remove();
  }
  window.addEventListener('resize', () => view.resize(), { signal });
  let baronAudioRequested = baronEncounter;
  const EARLY_5V5_DEFER_TICK = 5000;
  const deferred5v5Spec = (targetWorld: World) => {
    const canDeferEarly5v5 =
      targetWorld.matchMode === 'lanes' &&
      targetWorld.tick < EARLY_5V5_DEFER_TICK &&
      !targetWorld.units.some((u) => u.kind === 'monster');
    const deferredMonsters: MonsterSpecies[] = canDeferEarly5v5
      ? [
          ...new Set<MonsterSpecies>([
            ...(targetWorld.scuttlers ? (['scuttler'] as const) : []),
            ...(targetWorld.riftBaron ? (['baron'] as const) : []),
            ...(targetWorld.riftObjectives
              ? (['dragon-fire', 'elder-dragon', 'riftherald', 'voidgrub'] as const)
              : []),
            ...targetWorld.jungleCamps.flatMap((c) =>
              RIFT_CAMPS.find((d) => d.id === c.id)!.members.map((m) => m.species)
            ),
          ]),
        ]
      : [];
    const visionInUse =
      targetWorld.units.some((u) => u.kind === 'ward' && !!u.ward?.variant) ||
      targetWorld.player.trinket.kind === 'farsight' ||
      targetWorld.player.inventory.includes('control-ward');
    const deferredVision =
      canDeferEarly5v5 && !!targetWorld.riftObjectives && !visionInUse;
    const playerChamp = targetWorld.hero.champion;
    const deferAhriVfx =
      canDeferEarly5v5 &&
      playerChamp !== 'ahri' &&
      targetWorld.units.some((u) => u.champion === 'ahri');
    const deferLeonaVfx =
      canDeferEarly5v5 &&
      playerChamp !== 'leona' &&
      targetWorld.units.some((u) => u.champion === 'leona');
    const deferMasterYiVfx =
      canDeferEarly5v5 &&
      playerChamp !== 'masteryi' &&
      targetWorld.units.some((u) => u.champion === 'masteryi');
    const deferGarenVfx =
      canDeferEarly5v5 &&
      !import.meta.env.DEV &&
      playerChamp !== 'garen' &&
      targetWorld.units.some((u) => u.champion === 'garen');
    const deferLuxVfx =
      canDeferEarly5v5 &&
      !import.meta.env.DEV &&
      playerChamp !== 'lux' &&
      targetWorld.units.some((u) => u.champion === 'lux');
    const deferGrompVfx = canDeferEarly5v5 && deferredMonsters.includes('gromp');
    return {
      canDeferEarly5v5,
      deferredMonsters,
      deferredVision,
      visionInUse,
      deferAhriVfx,
      deferLeonaVfx,
      deferMasterYiVfx,
      deferGarenVfx,
      deferLuxVfx,
      deferGrompVfx,
    };
  };
  const loadAhriVfx = () => [
    view.ahriQCasts.load().catch((error) => {
      console.warn('Ahri Q cast particles unavailable; retry remains available.', error);
    }),
    view.ahriQProjectiles.load().catch((error) => {
      console.warn('Ahri Q projectile particles unavailable; retry remains available.', error);
    }),
    view.ahriWParticles.load().catch((error) => {
      console.warn('Ahri W particles unavailable; retry remains available.', error);
    }),
    view.ahriEParticles.load().catch((error) => {
      console.warn('Ahri E particles unavailable; retry remains available.', error);
    }),
    view.ahriRParticles.load().catch((error) => {
      console.warn('Ahri R particles unavailable; retry remains available.', error);
    }),
  ];
  const loadLeonaVfx = () => [
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
  ];
  const loadMasterYiVfx = () => [
    view.highlanderCasts.load(),
    view.highlanderKills.load(),
    view.primaryHits.load().catch((error) => {
      console.warn('Primary hit effects unavailable; explicit retry remains available.', error);
    }),
    view.meditateDamage.load(),
    view.swordGlows.load(),
    view.passiveTrails.load().catch((error) => {
      console.warn('Passive attack trails unavailable; explicit retry remains available.', error);
    }),
    view.primaryTrails.load().catch((error) => {
      console.warn('Primary attack trails unavailable; explicit retry remains available.', error);
    }),
    view.alphaCasts.load(),
    view.alphaEnds.load(),
    view.alphaContacts.load(),
    view.meditateCasts.load(),
    view.meditateBuffs.load(),
  ];
  const loadGarenVfx = () => [
    loadGarenSpin(),
    view.garenJustice.load(),
    view.garenCourage.load(),
    view.garenDecisiveStrike.load(),
    view.garenPerseverance.load(),
    view.garenBasicAttacks.load(),
  ];
  const loadLuxVfx = () => [
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
  ];
  const warmDeferred5v5Assets = (targetWorld: World, stage: 'requests' | 'rest'): Promise<void> => {
    const spec = deferred5v5Spec(targetWorld);
    if (!spec.canDeferEarly5v5) return Promise.resolve();
    if (stage === 'requests') {
      // Begin fetching scheduled objective rigs immediately so subpath/network checks observe them
      // without stalling the initial loading dismissal on heavy off-screen VFX or shader compiles.
      const eagerObjectives: MonsterSpecies[] = [
        ...(targetWorld.riftBaron ? (['baron'] as const) : []),
        ...(spec.deferredMonsters.includes('gromp') ? (['gromp'] as const) : []),
      ];
      if (!eagerObjectives.length) return Promise.resolve();
      return loadReferenceModels(eagerObjectives, false, false, false, false, false, [], false).catch(
        () => {}
      );
    }
    const remainingMonsters = spec.deferredMonsters.filter((m) => m !== 'baron' && m !== 'gromp');
    const steps: (() => Promise<unknown>)[] = [];
    for (const species of remainingMonsters) {
      steps.push(() =>
        loadReferenceModels([species], false, false, false, false, false, [], false)
      );
    }
    if (spec.deferredVision) {
      steps.push(() => loadReferenceModels([], false, false, false, false, false, [], true));
    }
    if (spec.deferGrompVfx) {
      steps.push(() => Promise.allSettled([view.grompDeath.load(), view.grompAttack.load()]));
    }
    if (spec.deferAhriVfx) steps.push(() => Promise.allSettled(loadAhriVfx()));
    if (spec.deferLeonaVfx) steps.push(() => Promise.allSettled(loadLeonaVfx()));
    if (spec.deferMasterYiVfx) steps.push(() => Promise.allSettled(loadMasterYiVfx()));
    if (spec.deferGarenVfx) steps.push(() => Promise.allSettled(loadGarenVfx()));
    if (spec.deferLuxVfx) steps.push(() => Promise.allSettled(loadLuxVfx()));
    if (!steps.length) return Promise.resolve();
    return (async () => {
      for (const step of steps) {
        if (signal.aborted) return;
        await step().catch(() => {});
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      }
      if (!signal.aborted) requestFrame();
    })();
  };
  // A scheduled camp can appear after boot, including a checkpoint whose last
  // corpse has already expired. Its rig must be ready before simulation resumes.
  prepareRosterAssets = (targetWorld: World, includeEnvironment: boolean) => {
    const spec = deferred5v5Spec(targetWorld);
    const monsterSpecies = [
      ...new Set<MonsterSpecies>([
        ...(!spec.canDeferEarly5v5 && targetWorld.scuttlers ? ['scuttler' as const] : []),
        ...(!spec.canDeferEarly5v5 && targetWorld.riftBaron ? ['baron' as const] : []),
        ...(!spec.canDeferEarly5v5 && targetWorld.riftObjectives
          ? (['dragon-fire', 'elder-dragon', 'riftherald', 'voidgrub'] as const)
          : []),
        ...(!spec.canDeferEarly5v5
          ? targetWorld.jungleCamps.flatMap((c) =>
              RIFT_CAMPS.find((d) => d.id === c.id)!.members.map((m) => m.species)
            )
          : []),
        ...targetWorld.units.flatMap((u) => (u.kind === 'monster' ? [u.monster.species] : [])),
      ]),
    ];
    const hasGrompContent = monsterSpecies.includes('gromp');
    const hasGaren = targetWorld.units.some((u) => u.champion === 'garen');
    const hasAhri = targetWorld.units.some((u) => u.champion === 'ahri');
    const hasLeona = targetWorld.units.some((u) => u.champion === 'leona');
    const hasMasterYi = targetWorld.units.some((u) => u.champion === 'masteryi');
    const extraChampions = (
      ['darius', 'vi', 'ezreal', 'morgana', ...ORIGINAL_CHAMPIONS] as const
    ).filter((c) => targetWorld.units.some((u) => u.champion === c));
    const includeVisionVariants =
      (!spec.canDeferEarly5v5 && !!targetWorld.riftObjectives) || spec.visionInUse;
    // Development probes may spawn Lux after boot.
    const prepareLux = import.meta.env.DEV || targetWorld.units.some((u) => u.champion === 'lux');
    return Promise.all([
      ...(targetWorld.units.some((u) => {
        const s = targetWorld.championState(u.id)?.trinket;
        return s?.kind === 'oracle' || !!s?.scan || !!s?.visuals.length;
      })
        ? [loadOracleLens(), audio.oracle.load()]
        : []),
      loadOwnedCompanions(targetWorld.companions.map((p) => p.kind)),
      loadInterfaceFonts(),
      audio.load({
        garenPresent: hasGaren && !spec.deferGarenVfx,
        masterYiPresent: hasMasterYi && !spec.deferMasterYiVfx,
        baronPreview: baronEncounter,
        ahriPresent: hasAhri && !spec.deferAhriVfx,
        prepareLux: prepareLux && !spec.deferLuxVfx,
      }),
      loadReferenceModels(
        monsterSpecies,
        hasLeona,
        hasAhri,
        hasMasterYi,
        import.meta.env.DEV || hasGaren,
        prepareLux,
        extraChampions,
        includeVisionVariants
      ),
      ...(hasGrompContent ? [view.grompDeath.load(), view.grompAttack.load()] : []),
      ...(hasAhri && !spec.deferAhriVfx ? loadAhriVfx() : []),
      ...(hasLeona && !spec.deferLeonaVfx
        ? [
            ...loadLeonaVfx(),
            audio.leonaW.load(),
            audio.leonaE.load(),
            audio.leonaR.load(),
            audio.leonaQ.load(),
            audio.leonaAA.load(),
            audio.leonaSunlight.load(),
            audio.leonaDeath.load(),
          ]
        : []),
      // Development probes can spawn Garen after boot.
      ...((import.meta.env.DEV || hasGaren) && !spec.deferGarenVfx ? [loadGarenSpin()] : []),
      ...(hasMasterYi && !spec.deferMasterYiVfx ? loadMasterYiVfx() : []),
      ...(hasGaren && !spec.deferGarenVfx
        ? [
            view.garenJustice.load(),
            view.garenCourage.load(),
            view.garenDecisiveStrike.load(),
            view.garenPerseverance.load(),
            view.garenBasicAttacks.load(),
          ]
        : []),
      ...(prepareLux && !spec.deferLuxVfx ? loadLuxVfx() : []),
      loadHawkshot(),
      loadAsheAttackArrow(),
      loadHawkshotWind(),
      loadHawkshotDust(),
      loadHawkshotSmoke(),
      loadHawkshotArrival(),
      loadHawkshotSparkle(),
      loadLingerAurora(),
      ...(includeEnvironment ? [view.loadEnvironment()] : []),
    ]);
  };
  const assetsReady = prepareRosterAssets(world, true);
  const pauseForInterruption = () => {
    if (!hud.modal) hud.toggleModal('pause');
    hud.focusModal();
    setPaused(true);
  };
  window.addEventListener('blur', pauseForInterruption, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pauseForInterruption();
      else requestFrame();
    },
    { signal }
  );
  if (document.hidden) pauseForInterruption();
  if (restored || saveNotice || recoveryAvailable) {
    hud.toggleModal(world.winner ? 'result' : 'pause');
    hud.focusModal();
    setPaused(true);
  }
  let graphicsGeneration = 0;
  let cancelWarmup: (() => void) | undefined;
  const warmGraphics = async (deferFullCompile = false): Promise<boolean> => {
    const generation = graphicsGeneration;
    if (view.renderer.getContext().isContextLost()) return false;
    let cancel!: () => void;
    const interrupted = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    cancelWarmup = cancel;
    try {
      const current = activeWorld();
      view.render(current, 1, elapsed);
      if (deferFullCompile) {
        return generation === graphicsGeneration && !view.renderer.getContext().isContextLost();
      }
      await Promise.race([view.renderer.compileAsync(view.scene, view.camera), interrupted]);
      if (generation !== graphicsGeneration || view.renderer.getContext().isContextLost())
        return false;
      view.render(current, 1, elapsed);
      return true;
    } finally {
      if (cancelWarmup === cancel) cancelWarmup = undefined;
    }
  };
  view.renderer.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      view.disposeContextResources();
      graphicsGeneration++;
      cancelWarmup?.();
      hud.setGraphicsState('lost');
      setPaused(true);
    },
    { signal }
  );
  view.renderer.domElement.addEventListener(
    'webglcontextrestored',
    () => {
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
    },
    { signal }
  );
  await assetsReady;
  const early5v5Boot = deferred5v5Spec(world).canDeferEarly5v5;
  // A loss during loading hands warmup to the restoration handler.
  if (!hud.graphicsState) await warmGraphics(early5v5Boot);
  if (early5v5Boot) void warmDeferred5v5Assets(world, 'requests');
  loading.classList.add('finished');
  if (saveNotice) hud.toast(saveNotice);
  else if (recoveryAvailable) hud.toast('A recovery checkpoint is available in Match files.');
  else if (restored) hud.toast('Saved match restored. Resume when you’re ready.');
  else if (rosterPlaytest) hud.toast('Roster playtest: open New match to choose a champion.');
  else if (rosterRiftTrial) hud.toast('Development trial: combined champion roster on the Rift.');
  else if (leonaRiftTrial) hud.toast('Development trial: Leona support on Summoner’s Rift.');
  else if (garenRiftTrial) hud.toast('Development trial: Garen top on Summoner’s Rift.');
  else if (masterYiBotRiftTrial)
    hud.toast('Development trial: Master Yi jungle bots on Summoner’s Rift.');
  else if (masterYiRiftTrial) hud.toast('Development trial: Master Yi jungle on Summoner’s Rift.');
  else if (ahriBotRiftTrial) hud.toast('Development trial: Ahri mid bots on Summoner’s Rift.');
  else if (ahriRiftTrial) hud.toast('Development trial: Ahri mid on Summoner’s Rift.');
  window.setTimeout(() => {
    loading.remove();
    if (early5v5Boot) {
      window.setTimeout(() => {
        if (signal.aborted) return;
        void warmDeferred5v5Assets(world, 'rest');
      }, 1500);
    }
  }, 600);
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
      wallSeconds = (now - previous) / 1000,
      dt = Math.min(wallSeconds, 0.1);
    previous = now;
    const initialWorld = activeWorld();
    const activelyStepping =
      !paused && (!replayPlayer || (replayPlayer.playing && !replayPlayer.atEnd));
    // Result effects drain on presentation time while simulation catch-up stays bounded.
    elapsed += initialWorld.winner ? wallSeconds : activelyStepping ? dt : 0;
    if (activelyStepping || initialWorld.winner) frameRate.record(now);
    input!.update(dt);
    if (replayPlayer) {
      if (!paused && replayPlayer.playing && !replayPlayer.atEnd) {
        accumulator += dt * replayPlayer.speed;
        const maxSteps = Math.max(6, Math.ceil(6 * replayPlayer.speed));
        let steps = 0;
        while (
          accumulator >= DT &&
          steps < maxSteps &&
          replayPlayer.playing &&
          !replayPlayer.atEnd
        ) {
          replayPlayer.step(1);
          accumulator -= DT;
          steps++;
        }
        if (accumulator >= DT) accumulator = 0;
      }
      syncReplayHud();
    } else if (!paused) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= DT && steps < 6) {
        recorder.step(1);
        accumulator -= DT;
        steps++;
      }
      if (accumulator >= DT) accumulator = 0;
      checkpoints!.checkpoint(world.tick, !!world.winner);
    }
    const current = activeWorld();
    const renderAlpha = activelyStepping ? accumulator / DT : 1;
    current.withVisionSnapshot(() => {
      view.render(current, renderAlpha, elapsed);
      input!.updateHoverAfterRender();
      uiElapsed += dt;
      if (uiElapsed >= 0.05 || !activelyStepping) {
        hud.update(frameRate.value);
        uiElapsed = 0;
      }
      const audibleProjectiles = current.projectiles.filter((p) => current.projectileVisible(p));
      const audibleScouts = current.scoutVisuals.filter(
        (effect) => effect.team === 'blue' || current.pointVisible(effect, 'blue')
      );
      audio.updateBindingFlight(
        audibleProjectiles,
        current.bindingStops.filter(
          (s) => s.team === 'blue' || current.pointVisible(s.point, 'blue')
        ),
        current.tick,
        view.center
      );
      audio.updateFlight(audibleProjectiles, audibleScouts, current.tick);
      audio.updateLinger(audibleScouts, current.tick);
      if (!baronAudioRequested && current.riftBaron && current.baronAttackVisuals.length) {
        baronAudioRequested = true;
        void audio.baronBasic.load();
      }
      if (baronAudioRequested) audio.updateBaronPreview(current, view.center);
      if (activelyStepping || current.tick > 0) {
        audio.updateLuxE(current, view.center);
        audio.updateAhri(current, view.center);
        audio.updateOracle(current, view.center);
        audio.updateGaren(current, view.center);
        audio.updateLeona(current, view.center);
      }
      audio.update(
        current.events.filter(
          (event) => current.eventVisible(event) && isPlayerFeedback(event, current.player.id)
        ),
        current.tick,
        view.center
      );
    });
    if (!activelyStepping && !current.winner) stopLoop();
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
    window.addEventListener(event, () => requestFrame(), { signal });
  requestFrame();
  let sessionDisposed = false;
  const disposeSession = async () => {
    if (sessionDisposed) return;
    sessionDisposed = true;
    stopLoop();
    sessionAbort.abort();
    recorder.detach();
    input?.dispose();
    hud.dispose();
    view.dispose();
    await audio.dispose();
  };
  window.addEventListener(
    'pagehide',
    () => {
      void disposeSession();
    },
    { once: true, signal }
  );
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __GAME__: {
        get world() {
          return activeWorld();
        },
        liveWorld: world,
        recorder,
        get replay() {
          return replayPlayer;
        },
        view,
        hud,
        audio,
        setPaused,
        startReplay,
        exitReplay,
        dispose: disposeSession,
        // Repaint direct fixture edits without resetting input or advancing time.
        repaint: requestFrame,
        snapshot: () => JSON.parse(activeWorld().snapshot()),
        ready: true,
      },
    });
  }
}

void boot().catch((error) => {
  console.error(error);
  loading.innerHTML = '<h1>Loading interrupted</h1><p>Reload to try again.</p>';
});
