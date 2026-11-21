import {
  isAhriSpell,
  ahriDescription,
  ahriPreviewResources,
  ahriPassiveDescription,
} from './ahri-spells';
import { activeSpiritRush } from '../simulation/ahri-spirit-rush';
import { isPlayerFeedback } from './player-feedback';
import { alliedChampionIntent } from './allied-intent';
import { cameraKeyTarget } from '../input/camera-targets';
import { AHRI_R } from '../content/ahri-r';
import { mountOfflinePack } from './offline-pack';
import { ROLE_LABELS } from '../content/bot-roles';
import { WARD_SOURCE } from '../content/warding-totem';
import { TRINKETS, ORACLE_SOURCE, type TrinketKind } from '../content/trinkets';
import { trinketSwapError } from '../simulation/trinkets';
import { shrinePoint } from '../simulation/scuttler';
import { RIVER_SIDES, SCUTTLER_POLICY } from '../content/scuttler-policy';
import { RIFT_BARON, baronReadyTick } from '../content/baron';
import {
  BOT_DIFFICULTIES,
  DEFAULT_BOT_DIFFICULTY,
  isBotDifficulty,
  type BotDifficulty,
} from '../content/bot-difficulty';
import { PLAYER_CHAMPION_ROLES } from '../content/champion-roles';
import {
  PUBLIC_SELECTABLE_CHAMPIONS,
  championProfile,
  isMeleeChampion,
} from '../content/champion-profiles';
import { isMilestone6Champion } from '../simulation/milestone6-champions';
import {
  ROLE_QUESTS,
  isRoleQuestComplete,
  maxChampionLevelForQuest,
  maxInventorySlotsForQuest,
  maxStealthWardsForQuest,
} from '../content/role-quests';
import {
  DEFENSE_SHARD_IDS,
  FLEX_SHARD_IDS,
  KEYSTONES,
  KEYSTONE_IDS,
  OFFENSE_SHARD_IDS,
  SECONDARY_RUNES,
  SECONDARY_RUNE_IDS,
  STAT_SHARD_LABELS,
  type DefenseShardId,
  type FlexShardId,
  type KeystoneId,
  type OffenseShardId,
  type RuneLoadout,
  type SecondaryRuneId,
} from '../content/runes';
import { defaultRuneLoadoutForRole } from '../simulation/runes';
import { getExpandedItem } from '../simulation/item-effects';
import { FARSIGHT_POLICY, FAELIGHT_NODES } from '../content/faelights';
import {
  DRAGON_ELEMENT_NAMES,
  DRAGON_SOUL_NAMES,
  EPIC_OBJECTIVE_TIMING,
} from '../content/epic-objectives';
import { isElementalRiftTransformed } from '../simulation/epic-objectives';
import {
  REFERENCE_COVERAGE_LEDGER,
  summarizeReferenceCoverage,
} from '../content/reference-coverage';
import { MASTER_YI } from '../content/masteryi-progression';
import {
  isMasterYiSpell,
  masterYiPreviewResources,
  masterYiDescription,
  masterYiPassiveDescription,
} from './masteryi-spells';
import { GAREN } from '../content/garen-progression';
import { GAREN_W } from '../content/garen-w';
import { garenEStrikes } from '../simulation/garen-e';
import {
  GAREN_SPELLS,
  isGarenSpell,
  garenDescription,
  garenPreviewResources,
} from './garen-spells';
import { AttackStatTooltip } from './attack-stat-tooltip';
import { LUX_SPELLS, isLuxSpell, luxDescription, luxPreviewResources } from './lux-spells';
import {
  LEONA_HUD_SPELLS,
  isLeonaSpell,
  leonaDescription,
  leonaPreviewResources,
} from './leona-spells';
import {
  instantSpell,
  targetedSpell,
  targetInstruction,
  garenRecastLockTicks,
} from '../input/spell-controls';
import {
  applyImmediatePracticeTool,
  isImmediatePracticeAction,
  type PracticeToolAction,
} from '../practice/practice-tools';
import {
  REPLAY_SPEEDS,
  type MatchReplayLog,
  type PreparedReplayImport,
  type ReplaySpeed,
} from '../replay/match-replay';
import { DEFAULT_SOUND_MIX, type SoundMixPreferences } from '../storage/sound-preference';
import type { PreparedMatchImport } from '../storage/match-files';
import { ScoreboardItemTooltip } from './scoreboard-item-tooltip';
import { ABILITIES, ITEMS, TICK_RATE, crystalArrowDescription } from '../content/rules';
import { ASHE_E } from '../content/ashe-e';
import { ASHE_Q } from '../content/ashe-q';
import {
  redBuffActive,
  redBuffHealingPerSecond,
  cinderSlow,
  cinderDamagePerTick,
  RED_BUFF_DURATION_TICKS,
} from '../simulation/red-buff';
import {
  blueBuffHaste,
  blueBuffManaPerSecond,
  BLUE_BUFF_DURATION_TICKS,
} from '../simulation/blue-buff';
import {
  asheFocusValues,
  asheSpellResources,
  asheVolleyValues,
  asheHawkshotValues,
} from '../simulation/ashe-spell-values';
import { SUMMONER_HEAL } from '../content/summoner-heal';
import { SUMMONER_SMITE } from '../content/summoner-smite';
import {
  COMPANION_SOURCE,
  companionSmiteDamage,
  companionStage,
  mosstomperShield,
} from '../content/companion-policy';
import { companionMovementBonus } from '../simulation/companion-passives';
import { ownedCompanion } from '../simulation/owned-companions';
import { companionItemKind } from '../content/companion-items-policy';
import {
  SUMMONERS,
  isSummonerSlot,
  type SummonerLoadout,
  type SummonerSlot,
  type SummonerSpell,
} from '../content/summoners';
import { experienceToNextLevel, growthAtLevel, statPrecision } from '../simulation/progression';
import { isStructureKind, type Ability, type ChampionIdentity } from '../simulation/types';
import type { World } from '../simulation/world';
import type { GameView } from '../render/view';

export interface ReplayHudState {
  active: boolean;
  playing: boolean;
  speed: ReplaySpeed;
  startTick: number;
  currentTick: number;
  endTick: number;
  verifiedCheckpoints: number;
  totalCheckpoints: number;
  error: string | null;
}

export type ReplayControlCommand =
  | { type: 'toggle-play' }
  | { type: 'seek-delta'; deltaTicks: number }
  | { type: 'restart' }
  | { type: 'speed'; speed: ReplaySpeed }
  | { type: 'exit' };

export interface HudActions {
  swapTrinket: (kind: TrinketKind) => Promise<string | null>;
  buyItem: (itemId: string) => Promise<string | null>;
  practiceTool?: (action: PracticeToolAction) => string;
  pause: (value: boolean) => void;
  reset: () => void;
  startMatch: (
    mode: 'practice' | 'lanes',
    champion: ChampionIdentity,
    summoners: SummonerLoadout,
    botDifficulty?: BotDifficulty,
    runes?: RuneLoadout
  ) => Promise<void>;
  save: () => Promise<void>;
  exportMatch: () => void;
  prepareImport: (file: File) => Promise<PreparedMatchImport>;
  prepareRecovery: () => Promise<PreparedMatchImport | null>;
  sound: (enabled: boolean) => void;
  soundMix?: () => SoundMixPreferences;
  updateSoundMix?: (partial: Partial<SoundMixPreferences>) => SoundMixPreferences;
  exportReplay?: () => Promise<void>;
  watchCurrentReplay?: () => Promise<void>;
  prepareReplay?: (file: File) => Promise<PreparedReplayImport>;
  watchPreparedReplay?: (log: MatchReplayLog) => Promise<void>;
  replayControl?: (command: ReplayControlCommand) => void;
}
export class Hud {
  root: HTMLDivElement;
  /** A HUD instant spell can replace an active targeting gesture. */
  onInstantCast?: () => void;
  modal: string | null = null;
  paused = false;
  replaying = false;
  graphicsState: 'lost' | 'restoring' | 'failed' | null = null;
  sound = true;
  private readonly abort = new AbortController();
  private renderedHeroKey = '';
  private offlineCleanup: (() => void) | null = null;
  private replacingMatch = false;
  private importError = '';
  private mini: HTMLCanvasElement;
  private minimapPointer: number | null = null;
  private allyCameraGroup: HTMLDivElement;
  private allyCameraButtons: HTMLButtonElement[];
  private tip: HTMLDivElement;
  private itemTooltip: ScoreboardItemTooltip;
  private attackStatTooltip: AttackStatTooltip;
  private hoveredAbility: HTMLButtonElement | null = null;
  private focusedAbility: HTMLButtonElement | null = null;
  private floating: HTMLDivElement;
  private lastEventId = 0;
  private lastSecond = -1;
  private lastWelcomeTick = -1;
  private lastInventory = '';
  private lastScoreboard = '';
  private buyingItem = false;
  private toastUntil = 0;
  private readonly rosterPlaytest: boolean;
  constructor(
    host: HTMLElement,
    private world: World,
    private view: GameView,
    private actions: HudActions,
    options: { soundEnabled?: boolean; rosterPlaytest?: boolean } = {}
  ) {
    this.sound = options.soundEnabled ?? true;
    this.rosterPlaytest = options.rosterPlaytest ?? false;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="match-identity"><span class="rift-emblem">◈</span><div><strong>SUMMONER’S RIFT</strong><span>${world.matchMode === 'lanes' ? '5V5 MATCH' : 'PRACTICE TOOL'} <i>•</i> ${this.rosterPlaytest ? 'ROSTER PLAYTEST' : 'LOCAL MATCH'}</span></div></div>
      <div class="match-top"><span class="team-score"><b class="blue-number" id="kills">0</b><i>⚔</i><b class="red-number" id="deaths">0</b></span><span class="personal-score" id="personal">0 / 0 / 0</span><span title="Creep score"><i class="gold-symbol">♜</i> <b id="cs">0</b></span><time id="clock">00:00</time><button class="icon-button" id="pause-button" title="Pause (Esc)" aria-label="Pause game">Ⅱ</button></div>
      <section class="replay-bar" id="replay-bar" role="region" aria-label="Match replay controls" hidden>
        <span class="replay-badge">REPLAY</span>
        <span class="replay-verify" id="replay-verify">✓ Verified</span>
        <time class="replay-time" id="replay-time">00:00 / 00:00</time>
        <div class="replay-buttons" role="group" aria-label="Replay transport">
          <button type="button" class="replay-btn" data-replay-cmd="restart" aria-label="Restart replay" title="Restart replay">⏮</button>
          <button type="button" class="replay-btn" data-replay-cmd="back-5s" aria-label="Rewind 5 seconds" title="Rewind 5s">-5s</button>
          <button type="button" class="replay-btn" data-replay-cmd="toggle-play" id="replay-play-btn" aria-label="Pause replay">Pause</button>
          <button type="button" class="replay-btn" data-replay-cmd="forward-5s" aria-label="Forward 5 seconds" title="Forward 5s">+5s</button>
        </div>
        <div class="replay-speeds" role="group" aria-label="Replay speed">
          ${REPLAY_SPEEDS.map((speed) => `<button type="button" class="replay-btn" data-replay-speed="${speed}" aria-pressed="${speed === 1}">${speed}×</button>`).join('')}
        </div>
        <button type="button" class="replay-btn replay-exit" data-replay-cmd="exit">Exit replay</button>
      </section>
      <div class="welcome"><span>THE RIFT AWAITS</span><h1>Welcome to Summoner’s Rift</h1><div class="ornament">━━━━ ◈ ━━━━</div></div>
      <div id="toast" role="status" aria-live="polite"></div>
      <div class="targeting-mode" role="status">Champions only</div>
      <div class="target-panel" id="target-panel" hidden><span class="target-label">SELECTED TARGET</span><strong id="target-name"></strong><div class="target-health"><i></i></div><span id="target-hp"></span></div>
      <div class="practice-corner"><button class="quiet-button" id="practice-button">◇ <span>Practice tools</span></button><button class="quiet-button" id="help-button">? <span>Controls</span></button><small>REFERENCE BUILD 0.1</small></div>
      <section class="champion-hud" aria-label="Champion controls">
        <div class="champion-portrait"><img src="assets/icons/${world.hero.champion}.png" alt="${championProfile(world.hero.champion!).name}"><span id="level">1</span><div class="portrait-frame"></div></div>
        <div class="champion-stats"><span title="Attack damage" aria-label="Attack damage"><i class="stat-icon stat-ad" aria-hidden="true"></i><b id="ad">59</b></span><span title="Ability power" aria-label="Ability power"><i class="stat-icon stat-ap" aria-hidden="true"></i><b id="ap">0</b></span><span title="Armor" aria-label="Armor"><i class="stat-icon stat-armor" aria-hidden="true"></i><b id="armor">26</b></span><span title="Magic resistance" aria-label="Magic resistance"><i class="stat-icon stat-mr" aria-hidden="true"></i><b id="mr">33</b></span><span title="Attack speed" aria-label="Attack speed"><i class="stat-icon stat-as" aria-hidden="true"></i><b id="as">0.66</b></span><span title="Movement speed" aria-label="Movement speed"><i class="stat-icon stat-ms" aria-hidden="true"></i><b id="ms">325</b></span></div>
        <div class="champion-core"><div class="champion-buffs" id="champion-buffs" aria-label="Active buffs" hidden><span class="blue-buff" id="blue-buff" tabindex="0" role="img" hidden><img src="assets/icons/buffcampblue.png" alt=""><b>Crest of Insight</b><time id="blue-buff-time"></time><i class="buff-duration"><i id="blue-buff-fill"></i></i></span><span class="blue-buff red-buff" id="red-buff" tabindex="0" role="img" hidden><img src="assets/icons/buffcampred.png" alt=""><b>Crest of Cinders</b><time id="red-buff-time"></time><i class="buff-duration"><i id="red-buff-fill"></i></i></span></div><div class="champion-title"><strong>${championProfile(world.hero.champion!).name.toUpperCase()}</strong><span>${this.championSubtitle(world.hero.champion!)}</span>${this.championPassiveWidget(world.hero.champion!)}</div>
          <div class="ability-row">${(['q', 'w', 'e', 'r'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}<div class="summoners">${(['d', 'f'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}</div></div>
          <div class="resource health" role="meter" aria-label="Health" aria-valuemin="0"><i id="health-fill"></i><span id="health-text">610 / 610</span><small id="health-regen">+0.7</small></div>
          <div class="resource mana" role="meter" aria-label="Mana" aria-valuemin="0" ${world.hero.champion === 'garen' ? 'hidden' : ''}><i id="mana-fill"></i><span id="mana-text">280 / 280</span></div>
          <div class="resource garen-resource" ${world.hero.champion === 'garen' ? '' : 'hidden'}><span id="garen-passive"></span></div>
          <div class="experience"><i id="xp-fill"></i></div>
        </div>
        <div class="inventory-panel"><div class="inventory-tools"><div class="inventory-grid" id="inventory">${Array.from({ length: 6 }, (_, i) => `<div class="item-slot"><span>${[1, 2, 3, 5, 6, 7][i]}</span></div>`).join('')}</div><button id="trinket" class="item-slot trinket-slot" aria-label="Stealth Ward"><img src="assets/icons/3340.png" alt="Stealth Ward"><b class="trinket-charges"></b><time class="trinket-cooldown"></time><span>4</span></button></div><button id="shop-button" class="gold-button" title="Open shop (P)" aria-keyshortcuts="P"><span>◆</span><b id="gold">500</b><kbd>P</kbd></button></div>
      </section>
      <div class="minimap-shell"><div class="ally-portraits" role="group" aria-label="Teammate cameras" hidden>${[2, 3, 4, 5].map((slot) => `<button class="ally-portrait" data-ally-camera="f${slot}" type="button"><img alt=""><kbd>F${slot}</kbd><span class="ally-respawn"></span><span class="ally-health"><i></i></span></button>`).join('')}</div><div class="map-controls"><button id="camera-button" aria-label="Toggle camera lock" aria-pressed="${view.locked}" title="${view.locked ? 'Unlock' : 'Lock'} camera (Y)">▣</button><button id="sound-button" aria-label="Toggle sound" aria-pressed="${this.sound}" title="${this.sound ? 'Mute' : 'Unmute'} sound">♫</button><span id="fps">— FPS</span></div><canvas id="minimap" width="256" height="256" aria-label="Minimap. Left-click or drag to move the camera; right-click to move your champion."></canvas><span class="map-caption">SUMMONER’S RIFT</span></div>
      <div class="recall-progress" hidden><span>RECALLING</span><div><i></i></div><small>Taking damage or moving cancels recall</small></div>
      <div class="death-overlay" hidden><span>You have been slain</span><strong id="respawn-count"></strong></div>
      <div class="modal-backdrop" id="modal" hidden></div>
    `;
    this.root
      .querySelector('#champion-buffs')!
      .insertAdjacentHTML(
        'beforeend',
        '<span class="blue-buff baron-buff" id="baron-buff" tabindex="0" role="img" hidden><b>Hand of Baron</b><time id="baron-buff-time"></time></span><span class="blue-buff elder-buff" id="elder-buff" tabindex="0" role="img" hidden><b>Aspect of the Dragon</b><time id="elder-buff-time"></time></span>'
      );
    host.append(this.root);
    this.allyCameraGroup = this.root.querySelector<HTMLDivElement>('.ally-portraits')!;
    this.allyCameraButtons = [
      ...this.allyCameraGroup.querySelectorAll<HTMLButtonElement>('button'),
    ];
    for (const button of this.allyCameraButtons) {
      const key = button.dataset.allyCamera!;
      button.addEventListener('click', (event) => {
        if (this.paused || this.modal) return;
        const ally = cameraKeyTarget(this.world, key);
        if (!ally) return;
        this.view.locked = false;
        this.view.recenter(ally);
        if (event.detail > 0) this.view.renderer.domElement.focus({ preventScroll: true });
      });
    }
    this.tip = document.createElement('div');
    this.tip.className = 'tooltip';
    this.tip.id = 'ability-tooltip';
    this.tip.setAttribute('role', 'tooltip');
    this.tip.hidden = true;
    this.root.append(this.tip);
    this.itemTooltip = new ScoreboardItemTooltip(this.root);
    this.attackStatTooltip = new AttackStatTooltip(
      this.root,
      this.root.querySelector<HTMLElement>('[aria-label="Attack damage"]')!,
      world
    );
    this.floating = document.createElement('div');
    this.floating.className = 'floating-layer';
    host.append(this.floating);
    this.mini = this.root.querySelector('#minimap')!;
    this.renderedHeroKey = this.heroIdentityKey();
    this.bind();
    this.root.querySelector<HTMLButtonElement>('#practice-button')!.hidden =
      world.matchMode === 'lanes';
    this.updateCameraButton();
    this.updateSoundButton();
    this.updateGold();
    this.updateResourceMeter('health-text', Math.ceil(world.hero.hp), Math.ceil(world.hero.maxHp));
    this.updateResourceMeter(
      'mana-text',
      Math.floor(world.hero.mana),
      Math.floor(world.hero.maxMana)
    );
  }
  private heroIdentityKey(): string {
    return `${this.world.hero.champion}:${this.world.player.summoners.d}:${this.world.player.summoners.f}`;
  }
  private championSubtitle(champion: ChampionIdentity): string {
    if (champion === 'garen') return 'THE MIGHT OF DEMACIA';
    if (champion === 'lux') return 'THE LADY OF LUMINOSITY';
    if (champion === 'leona') return 'THE RADIANT DAWN';
    if (champion === 'ahri') return 'THE NINE-TAILED FOX';
    if (champion === 'masteryi') return 'THE WUJU BLADESMAN';
    if (champion === 'darius') return 'THE HAND OF NOXUS';
    if (champion === 'vi') return 'THE PILTOVER ENFORCER';
    if (champion === 'ezreal') return 'THE PRODIGAL EXPLORER';
    if (champion === 'morgana') return 'THE FALLEN';
    return 'THE FROST ARCHER';
  }
  private championPassiveWidget(champion: ChampionIdentity): string {
    if (champion === 'ashe')
      return '<div class="focus-pips" aria-label="Focus stacks"><i></i><i></i><i></i><i></i></div>';
    if (champion === 'ahri')
      return '<span id="ahri-essence" class="essence-counter" tabindex="0" aria-label="Essence Theft, 0 of 9 kills">0 / 9</span>';
    if (champion === 'masteryi')
      return '<span id="masteryi-double-strike" class="essence-counter yi-double-strike" tabindex="0" aria-label="Double Strike, 0 of 3 stacks"><img src="assets/icons/MasterYi_Passive1.png" alt=""><b>0 / 3</b></span>';
    return '';
  }
  setWorld(world: World, replaying = false): void {
    this.world = world;
    this.replaying = replaying;
    this.attackStatTooltip.setWorld(world);
    this.hoveredAbility = null;
    this.focusedAbility = null;
    this.refreshTooltip();
    this.itemTooltip.clear();
    this.floating.replaceChildren();
    this.lastEventId = Math.max(0, ...world.events.map((event) => event.id));
    this.lastSecond = -1;
    this.lastWelcomeTick = -1;
    this.lastInventory = '';
    this.lastScoreboard = '';
    const identitySpan = this.root.querySelector<HTMLElement>('.match-identity div > span')!;
    const modeText = world.matchMode === 'lanes' ? '5V5 MATCH' : 'PRACTICE TOOL';
    const tagText = replaying ? 'REPLAY' : this.rosterPlaytest ? 'ROSTER PLAYTEST' : 'LOCAL MATCH';
    identitySpan.innerHTML = `${modeText} <i>•</i> ${tagText}`;
    this.root.querySelector<HTMLButtonElement>('#practice-button')!.hidden =
      replaying || world.matchMode === 'lanes';
    this.root.querySelector<HTMLButtonElement>('#shop-button')!.disabled = replaying;
    const scoreboardTitle = this.root.querySelector<HTMLElement>('.scoreboard-title');
    if (scoreboardTitle)
      scoreboardTitle.textContent = world.matchMode === 'lanes' ? '5V5 MATCH' : 'PRACTICE MATCH';
    const nextHeroKey = this.heroIdentityKey();
    if (nextHeroKey !== this.renderedHeroKey) {
      this.renderedHeroKey = nextHeroKey;
      const champion = world.hero.champion ?? 'ashe';
      const portrait = this.root.querySelector<HTMLImageElement>('.champion-portrait img')!;
      portrait.src = `assets/icons/${champion}.png`;
      portrait.alt = championProfile(champion).name;
      this.root.querySelector<HTMLElement>('.champion-title')!.innerHTML =
        `<strong>${championProfile(champion).name.toUpperCase()}</strong><span>${this.championSubtitle(champion)}</span>${this.championPassiveWidget(champion)}`;
      this.root.querySelector<HTMLElement>('.resource.mana')!.hidden = champion === 'garen';
      this.root.querySelector<HTMLElement>('.resource.garen-resource')!.hidden =
        champion !== 'garen';
      this.root.querySelector<HTMLElement>('.ability-row')!.innerHTML =
        `${(['q', 'w', 'e', 'r'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}<div class="summoners">${(['d', 'f'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}</div>`;
      this.bindAbilityButtons();
    }
  }
  syncEventsToCurrentTick(): void {
    this.lastEventId = Math.max(0, ...this.world.events.map((event) => event.id));
    this.lastSecond = -1;
    this.lastWelcomeTick = -1;
    this.lastInventory = '';
    this.lastScoreboard = '';
    this.floating.replaceChildren();
  }
  setReplayState(state: ReplayHudState | null): void {
    const bar = this.root.querySelector<HTMLElement>('#replay-bar')!;
    if (!state || !state.active) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const formatClock = (ticks: number) => {
      const totalSeconds = Math.max(0, Math.floor(ticks / TICK_RATE));
      const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const s = String(totalSeconds % 60).padStart(2, '0');
      return `${m}:${s}`;
    };
    const verify = bar.querySelector<HTMLElement>('#replay-verify')!;
    if (state.error) {
      verify.textContent = state.error;
      verify.classList.add('error');
    } else {
      verify.textContent = `✓ ${state.verifiedCheckpoints}/${state.totalCheckpoints} hashes`;
      verify.classList.remove('error');
    }
    bar.querySelector<HTMLElement>('#replay-time')!.textContent =
      `${formatClock(state.currentTick)} / ${formatClock(state.endTick)}`;
    const playBtn = bar.querySelector<HTMLButtonElement>('#replay-play-btn')!;
    const label = state.playing ? 'Pause' : 'Play';
    if (playBtn.textContent !== label) playBtn.textContent = label;
    const aria = state.playing ? 'Pause replay' : 'Play replay';
    if (playBtn.getAttribute('aria-label') !== aria) playBtn.setAttribute('aria-label', aria);
    bar.querySelectorAll<HTMLButtonElement>('[data-replay-speed]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.replaySpeed) === state.speed));
    });
  }
  dispose(): void {
    this.offlineCleanup?.();
    this.offlineCleanup = null;
    this.releaseMinimapCamera();
    this.abort.abort();
    this.attackStatTooltip.dispose();
    this.itemTooltip.dispose();
    this.floating.remove();
    this.root.remove();
  }
  private spellSpec(a: Ability) {
    if (
      isSummonerSlot(a) ||
      this.world.hero.champion === 'ahri' ||
      this.world.hero.champion === 'masteryi' ||
      isMilestone6Champion(this.world.hero.champion)
    )
      return this.world.abilitySpec(a);
    if (this.world.hero.champion === 'garen' && isGarenSpell(a)) return GAREN_SPELLS[a];
    if (this.world.hero.champion === 'leona' && isLeonaSpell(a)) return LEONA_HUD_SPELLS[a];
    return this.world.hero.champion === 'lux' && isLuxSpell(a) ? LUX_SPELLS[a] : ABILITIES[a];
  }
  private isLuxRecast(a: Ability): boolean {
    return this.world.hero.champion === 'lux' && a === 'e' && instantSpell(this.world, a);
  }
  private isGarenRecast(a: Ability): boolean {
    return this.world.hero.champion === 'garen' && a === 'e' && !!this.world.player.garenE;
  }
  private tooltipResources(a: Ability) {
    if (this.isLuxRecast(a)) return { mana: 0, cooldownSeconds: 0 };
    if (a === 'd' || a === 'f' || this.world.abilityRank(a)) return this.world.abilityResources(a);
    if (isMilestone6Champion(this.world.hero.champion)) {
      const spec = this.world.abilitySpec(a);
      return {
        mana: spec.cost,
        cooldownSeconds: (spec.cooldown * 100) / (100 + this.world.abilityHaste()),
      };
    }
    if (this.world.hero.champion === 'masteryi' && isMasterYiSpell(a)) {
      const preview = masterYiPreviewResources(a);
      return {
        ...preview,
        cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
      };
    }
    if (this.world.hero.champion === 'ahri' && isAhriSpell(a)) {
      const preview = ahriPreviewResources(a);
      return {
        ...preview,
        cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
      };
    }
    if (this.world.hero.champion === 'leona' && isLeonaSpell(a)) {
      const preview = leonaPreviewResources(a);
      return {
        ...preview,
        cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
      };
    }
    if (this.world.hero.champion === 'lux' && isLuxSpell(a)) {
      const preview = luxPreviewResources(a);
      return {
        ...preview,
        cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
      };
    }
    if (this.world.hero.champion === 'garen' && isGarenSpell(a)) {
      const preview = garenPreviewResources(a);
      return {
        ...preview,
        cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
      };
    }
    const preview = asheSpellResources(a, 1);
    return {
      ...preview,
      cooldownSeconds: (preview.cooldownSeconds * 100) / (100 + this.world.abilityHaste()),
    };
  }
  private abilityMarkup(a: Ability): string {
    const spec = this.spellSpec(a);
    const button = `<button class="ability ${a === 'd' || a === 'f' ? 'summoner' : ''}" data-ability="${a}" aria-label="${spec.name}"><img src="assets/icons/${spec.icon}.png" alt=""><span class="cooldown-shade"></span><span class="cooldown-text"></span><kbd>${a.toUpperCase()}</kbd><span class="ability-cost">${spec.cost || ''}</span>${(a === 'e' && this.world.hero.champion === 'ashe') || (a === 'r' && this.world.hero.champion === 'ahri') || this.world.summonerSpell(a) === 'smite' ? '<span class="ability-charges" aria-hidden="true"></span><span class="ability-recharge" aria-hidden="true"><i></i></span>' : ''}</button>`;
    if (a === 'd' || a === 'f') return button;
    return `<div class="ability-slot">${button}<button class="spell-learn" data-learn="${a}" aria-label="Upgrade ${spec.name}" title="Upgrade ${a.toUpperCase()} (Ctrl+${a.toUpperCase()})" hidden></button><span class="spell-ranks" aria-hidden="true">${Array.from({ length: a === 'r' ? 3 : 5 }, () => '<i></i>').join('')}</span></div>`;
  }
  private positionTooltip(): void {
    if (this.tip.hidden) return;
    const button = this.root.querySelector<HTMLElement>(
      `button[data-ability="${this.tip.dataset.tooltipAbility}"]`
    );
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const margin = 12;
    this.tip.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - this.tip.offsetWidth - margin))}px`;
    this.tip.style.top = `${Math.max(margin, Math.min(rect.top - this.tip.offsetHeight - 14, window.innerHeight - this.tip.offsetHeight - margin))}px`;
  }
  private abilityDescription(ability: Ability): string {
    const learned = this.world.abilityRank(ability);
    return `${learned ? '' : 'This ability has not been learned. Rank 1 preview: '}${this.rankedAbilityDescription(ability, Math.max(1, learned))}`;
  }
  private rankedAbilityDescription(ability: Ability, rank: number): string {
    if (this.world.summonerSpell(ability) === 'smite') {
      const p = ownedCompanion(this.world, this.world.player.id);
      if (p) {
        const stage = companionStage(p.fed);
        const passive =
          p.kind === 'gustwalker'
            ? 'Gain 30% Move Speed in brush, decaying over 1.5 seconds after leaving. Large monster kills grant 45% Move Speed, decaying over 1.5 seconds.'
            : p.kind === 'mosstomper'
              ? `Gain a ${mosstomperShield(this.world.player.level)} shield after large monster kills or 10 seconds out of combat.`
              : 'Gain 3 Ember every 0.5 seconds, up to 100. At 100, your next Attack or Ability hit on an enemy champion burns nearby enemies for 5% max health true damage over 4 seconds and slows by 30%, decaying over 3 seconds. Large monster kills ready this immediately.';
        return `Deal ${companionSmiteDamage(p.fed)} true damage to a large or medium monster or enemy lane minion.${stage > 0 ? ' Against champions, deal 40 true damage and slow by 20% for 2 seconds.' : ''}${stage === 2 ? ' Damages monsters within 425 units of the target.' : ''} Companion fed ${p.fed}/35 treats. Regains one charge every 90 seconds. ${stage === 2 ? passive : `At full growth: ${passive}`}`;
      }
      return `${SUMMONERS.smite.description} Regains one charge every ${SUMMONER_SMITE.rechargeSeconds} seconds. Purchase a jungle companion and feed it to upgrade Smite.`;
    }
    if (this.world.hero.champion === 'garen' && isGarenSpell(ability)) {
      const h = this.world.hero;
      const bonusHealth = Math.max(
        0,
        h.maxHp - GAREN.hp - GAREN.hpGrowth * growthAtLevel(this.world.player.level)
      );
      return garenDescription(
        ability,
        rank,
        h.damage,
        bonusHealth,
        garenEStrikes(this.world.player.level)
      );
    }
    if (this.world.hero.champion === 'masteryi' && isMasterYiSpell(ability)) {
      const h = this.world.hero;
      const base =
        MASTER_YI.damage + MASTER_YI.damageGrowth * growthAtLevel(this.world.player.level);
      return masterYiDescription(
        ability,
        rank,
        h.damage,
        Math.max(0, h.damage - base),
        this.world.abilityPower()
      );
    }
    if (this.world.hero.champion === 'ahri' && isAhriSpell(ability))
      return ahriDescription(ability, rank, this.world.abilityPower());
    if (this.world.hero.champion === 'lux' && isLuxSpell(ability))
      return luxDescription(ability, rank, this.world.abilityPower(), this.world.player.level);
    if (this.world.hero.champion === 'leona' && isLeonaSpell(ability))
      return leonaDescription(ability, rank, this.world.abilityPower(), this.world.player.level);
    if (isMilestone6Champion(this.world.hero.champion) && ability !== 'd' && ability !== 'f')
      return this.world.abilitySpec(ability).description;
    if (ability === 'q') {
      const values = asheFocusValues(rank);
      return `Build 4 Focus with attacks. Consume Focus to gain ${Math.round(values.bonusAttackSpeed * 100)}% attack speed for ${ASHE_Q.durationSeconds} seconds and empower attacks to deal ${Math.round(values.damageMultiplier * 100)}% damage. Activating resets your attack timer.`;
    }
    if (ability === 'e')
      return `Send a hawk that reveals its route, then grants destination vision for ${ASHE_E.visionSeconds} seconds. Stores ${ASHE_E.maximumCharges} charges, restoring one every ${Number(((asheHawkshotValues(rank).rechargeSeconds * 100) / (100 + this.world.abilityHaste())).toFixed(2))} seconds.`;
    if (ability === 'w')
      return `Fire ${asheVolleyValues(rank, 0).arrows} frost arrows in a cone, dealing ${Math.round(this.world.volleyDamage(this.world.hero, rank))} physical damage before armor. Each enemy takes damage from one arrow and is slowed.`;
    if (ability === 'r')
      return crystalArrowDescription(this.world.crystalArrowDamage(this.world.hero, rank));
    if (this.world.summonerSpell(ability) === 'heal') {
      const base = this.world.summonerHealAmount();
      const self = this.world.summonerHealAmount(this.world.hero, this.world.hero);
      return `Restore up to ${Math.round(base)} health to yourself and one nearby allied champion. Both gain ${SUMMONER_HEAL.speedBonus * 100}% movement speed for ${SUMMONER_HEAL.speedDurationSeconds} second. Healing is reduced by ${100 - SUMMONER_HEAL.repeatHealMultiplier * 100}% on targets recently affected by Summoner Heal.${self < base ? ` Your healing is currently reduced to ${Math.round(self)}.` : ''}`;
    }
    return this.world.abilitySpec(ability).description;
  }
  private tooltipInstruction(ability: Ability): string {
    if (!this.world.abilityRank(ability) && ability !== 'd' && ability !== 'f') {
      const reason = this.world.spellLearningError(ability);
      return reason
        ? `Cannot learn yet: ${reason}.`
        : `Press Ctrl+${ability.toUpperCase()} to learn.`;
    }
    if (this.isLuxRecast(ability)) return 'Press E to detonate. No additional mana cost.';
    if (this.isGarenRecast(ability))
      return garenRecastLockTicks(this.world)
        ? 'Press E again after the first second to end Judgment.'
        : 'Press E to end Judgment. Its full cooldown then starts.';
    if (targetedSpell(this.world, ability)) return targetInstruction(this.world, ability);
    return instantSpell(this.world, ability)
      ? 'Press to cast'
      : 'Hold the key to aim. Release to cast.';
  }
  private updateShopPurchases(): void {
    if (this.modal !== 'shop') return;
    this.root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((button) => {
      const id = button.dataset.buy!;
      const reason = this.buyingItem ? 'Preparing purchase…' : this.world.purchaseError(id);
      const unavailable = String(!!reason);
      if (button.getAttribute('aria-disabled') !== unavailable)
        button.setAttribute('aria-disabled', unavailable);
      const title = reason ?? 'Purchase item';
      if (button.title !== title) button.title = title;
      const price = `◆ ${this.world.purchasePlan(id)!.cost}`;
      if (button.querySelector('b')!.textContent !== price)
        button.querySelector('b')!.textContent = price;
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-trinket]').forEach((button) => {
      const kind = button.dataset.trinket as TrinketKind;
      const reason = this.buyingItem ? 'Preparing purchase…' : trinketSwapError(this.world, kind);
      button.setAttribute('aria-disabled', String(!!reason));
      button.title =
        reason ??
        (kind === 'ward'
          ? 'Free. Place hidden wards that grant team vision.'
          : kind === 'farsight'
            ? 'Free (Level 9+). Place untargetable long-range vision up to 4,000 units away.'
            : 'Free. Scan for 8 seconds to reveal and disable enemy wards and warn of hidden champions.');
      button.querySelector('b')!.textContent =
        this.world.player.trinket.kind === kind ? 'Equipped' : 'Free';
    });
    const undoBtn = this.root.querySelector<HTMLButtonElement>('[data-action="undo-shop"]');
    if (undoBtn) {
      const canUndo =
        !this.buyingItem &&
        !!this.world.player.itemState?.undoHistory.length &&
        this.world.canShop();
      undoBtn.disabled = !canUndo;
    }
  }
  private updateShopOwnedItems(): void {
    const owned = this.root.querySelector<HTMLElement>('.shop-owned');
    if (!owned) return;
    const stacks = this.world.player.itemState?.slotStacks ?? {};
    const key = JSON.stringify({ inv: this.world.player.inventory, stacks });
    if (owned.dataset.inventory === key) return;
    const focused = owned.contains(document.activeElement)
      ? (document.activeElement as HTMLButtonElement)
      : null;
    const focusedSlot = Number(focused?.dataset.sell);
    const existing = Array.from(owned.querySelectorAll<HTMLButtonElement>('[data-sell]'));
    const buttons: HTMLButtonElement[] = [];
    this.world.player.inventory.forEach((id, slot) => {
      if (!id) return;
      const item = ITEMS.find((entry) => entry.id === id)!;
      const stackCount = stacks[slot] ?? 1;
      const stackTag = `${id}:${stackCount}`;
      let button = existing.find(
        (entry) => entry.dataset.sell === String(slot) && entry.dataset.stackTag === stackTag
      );
      if (!button) {
        button = document.createElement('button');
        button.className = 'shop-item';
        button.dataset.sell = String(slot);
        button.dataset.item = id;
        button.dataset.stackTag = stackTag;
        const unsellable = !!companionItemKind(item.id);
        button.setAttribute('aria-disabled', String(unsellable));
        button.title = unsellable ? 'Jungle companions cannot be sold' : 'Sell item';
        button.setAttribute(
          'aria-label',
          unsellable
            ? `${item.name}, slot ${slot + 1}, cannot be sold`
            : `Sell ${item.name}${stackCount > 1 ? ` (${stackCount} stacked)` : ''}, slot ${slot + 1}, for ${item.sell} gold`
        );
        button.innerHTML = `<img src="assets/icons/${item.icon}.png" alt=""><span><strong>${item.name}${stackCount > 1 ? ` ×${stackCount}` : ''}</strong><small>${unsellable ? 'Cannot be sold' : `Sell · slot ${slot + 1}`}</small></span><b>${unsellable ? '—' : `◆ ${item.sell}`}</b>`;
      }
      buttons.push(button);
    });
    // Keep surviving controls in place, preserving focus and scroll during purchases.
    for (const child of Array.from(owned.children))
      if (!buttons.includes(child as HTMLButtonElement)) child.remove();
    buttons.forEach((button, index) => {
      if (owned.children[index] !== button)
        owned.insertBefore(button, owned.children[index] ?? null);
    });
    if (!buttons.length) owned.innerHTML = '<p>No items owned.</p>';
    owned.dataset.inventory = key;
    if (focused && !focused.isConnected) {
      const next =
        buttons.find((button) => Number(button.dataset.sell) >= focusedSlot) ?? buttons.at(-1);
      (next ?? this.root.querySelector<HTMLButtonElement>('.close-button'))?.focus({
        preventScroll: true,
      });
    }
  }
  private bind(): void {
    const signal = this.abort.signal;
    window.addEventListener('resize', () => this.positionTooltip(), { signal });
    const inventory = this.root.querySelector<HTMLElement>('#inventory')!;
    let dragged: { slot: number; item: string } | null = null;
    inventory.addEventListener('dragstart', (event) => {
      const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-inventory-slot]');
      const index = Number(slot?.dataset.inventorySlot);
      const item = this.world.player.inventory[index];
      if (!slot || !item || this.replaying || this.modal || this.paused || this.world.winner) {
        event.preventDefault();
        return;
      }
      dragged = { slot: index, item };
      event.dataTransfer!.effectAllowed = 'move';
      event.dataTransfer!.setData('text/plain', String(index));
    });
    inventory.addEventListener('dragover', (event) => {
      if (!dragged || this.replaying || this.modal || this.paused) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
    });
    inventory.addEventListener('drop', (event) => {
      event.preventDefault();
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-inventory-slot]');
      if (
        dragged &&
        target &&
        !this.replaying &&
        !this.modal &&
        !this.paused &&
        this.world.player.inventory[dragged.slot] === dragged.item
      ) {
        const error = this.world.moveItem(dragged.slot, Number(target.dataset.inventorySlot));
        if (error) this.toast(error);
      }
      dragged = null;
    });
    inventory.addEventListener('dragend', () => {
      dragged = null;
    });
    const on = (id: string, fn: () => void) =>
      this.root.querySelector(`#${id}`)!.addEventListener('click', fn);
    on('pause-button', () => this.toggleModal('pause'));
    on('shop-button', () => {
      if (!this.replaying) this.toggleModal('shop');
    });
    on('help-button', () => this.toggleModal('help'));
    on('practice-button', () => {
      if (!this.replaying) this.toggleModal('practice');
    });
    on('camera-button', () => this.toggleCamera());
    on('sound-button', () => {
      this.sound = !this.sound;
      this.actions.sound(this.sound);
      this.updateSoundButton();
    });
    this.root.querySelector('#replay-bar')!.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!btn) return;
      const cmd = btn.dataset.replayCmd;
      if (cmd === 'toggle-play') this.actions.replayControl?.({ type: 'toggle-play' });
      else if (cmd === 'restart') this.actions.replayControl?.({ type: 'restart' });
      else if (cmd === 'back-5s')
        this.actions.replayControl?.({ type: 'seek-delta', deltaTicks: -5 * TICK_RATE });
      else if (cmd === 'forward-5s')
        this.actions.replayControl?.({ type: 'seek-delta', deltaTicks: 5 * TICK_RATE });
      else if (cmd === 'exit') this.actions.replayControl?.({ type: 'exit' });
      else if (btn.dataset.replaySpeed) {
        this.actions.replayControl?.({
          type: 'speed',
          speed: Number(btn.dataset.replaySpeed) as ReplaySpeed,
        });
      }
    });
    this.mini.addEventListener('contextmenu', (e) => e.preventDefault());
    this.mini.addEventListener('pointerdown', (e) => {
      if (this.modal || (this.paused && !this.replaying)) return;
      const point = this.minimapPoint(e.clientX, e.clientY);
      if (!point) return;
      if (e.button === 2 && !this.replaying && !this.paused)
        this.world.enqueue({
          type: 'order',
          unit: this.world.player.id,
          order: { type: e.shiftKey ? 'attackMove' : 'move', point },
        });
      else if (e.button === 0 && e.isPrimary && this.minimapPointer === null) {
        e.preventDefault();
        this.view.renderer.domElement.focus({ preventScroll: true });
        this.minimapPointer = e.pointerId;
        this.mini.setPointerCapture(e.pointerId);
        this.view.locked = false;
        this.view.center = point;
      }
    });
    this.mini.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.minimapPointer) return;
      if (this.modal || (this.paused && !this.replaying) || !(e.buttons & 1)) {
        this.releaseMinimapCamera();
        return;
      }
      const bounds = this.mini.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const fraction = (value: number, start: number, size: number) =>
        Math.max(0, Math.min(1, (value - start) / size));
      const half = this.world.battlefield.half;
      this.view.locked = false;
      this.view.center = {
        x: (fraction(e.clientX, bounds.left, bounds.width) - 0.5) * half * 2,
        y: (fraction(e.clientY, bounds.top, bounds.height) - 0.5) * half * 2,
      };
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      this.mini.addEventListener(type, (e) => {
        if (e.pointerId === this.minimapPointer) this.releaseMinimapCamera();
      });
    window.addEventListener('blur', () => this.releaseMinimapCamera(), { signal });
    this.bindAbilityButtons();
  }
  private bindAbilityButtons(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-learn]').forEach((button) => {
      button.addEventListener('click', () => {
        if (this.replaying || this.paused || this.modal) return;
        this.world.enqueue({
          type: 'learn',
          unit: this.world.player.id,
          ability: button.dataset.learn as 'q' | 'w' | 'e' | 'r',
        });
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach((button) => {
      const ability = button.dataset.ability as Ability;
      button.addEventListener('pointerenter', () => {
        this.hoveredAbility = button;
        this.refreshTooltip(button);
      });
      button.addEventListener('pointerleave', () => {
        if (this.hoveredAbility === button) this.hoveredAbility = null;
        this.refreshTooltip();
      });
      button.addEventListener('focus', () => {
        this.focusedAbility = button;
        this.refreshTooltip(button);
      });
      button.addEventListener('blur', () => {
        if (this.focusedAbility === button) this.focusedAbility = null;
        this.refreshTooltip();
      });
      button.addEventListener('click', () => {
        if (this.replaying || this.paused || this.modal) return;
        if (instantSpell(this.world, ability)) {
          this.onInstantCast?.();
          this.world.enqueue({
            type: 'cast',
            unit: this.world.player.id,
            ability,
            point: this.world.hero,
          });
        } else
          this.toast(
            targetedSpell(this.world, ability)
              ? targetInstruction(this.world, ability)
              : `Hold ${ability.toUpperCase()} to aim, then release to cast`
          );
      });
    });
  }
  private refreshTooltip(preferred?: HTMLButtonElement): void {
    const current = [this.hoveredAbility, this.focusedAbility].find(
      (button) => button && button.dataset.ability === this.tip.dataset.tooltipAbility
    );
    const button = preferred ?? current ?? this.hoveredAbility ?? this.focusedAbility;
    this.root
      .querySelectorAll('[aria-describedby="ability-tooltip"]')
      .forEach((element) => element.removeAttribute('aria-describedby'));
    if (this.modal || !button) {
      this.tip.hidden = true;
      delete this.tip.dataset.tooltipAbility;
      return;
    }
    const ability = button.dataset.ability as Ability;
    const spec = this.spellSpec(ability);
    const resources = this.tooltipResources(ability);
    this.tip.dataset.tooltipResources = JSON.stringify(resources);
    this.tip.innerHTML = `<span class="tooltip-key">${ability.toUpperCase()}</span><strong>${spec.name}</strong><div class="tooltip-meta">${resources.mana ? `${resources.mana} MANA` : 'NO COST'} <span>·</span> ${resources.cooldownSeconds ? `${Number(resources.cooldownSeconds.toFixed(2))}s COOLDOWN` : 'NO COOLDOWN'}</div><p>${this.abilityDescription(ability)}</p><small>${this.tooltipInstruction(ability)}</small>`;
    this.tip.dataset.tooltipAbility = ability;
    this.tip.dataset.tooltipRank = String(this.world.abilityRank(ability));
    this.tip.hidden = false;
    button.setAttribute('aria-describedby', this.tip.id);
    this.positionTooltip();
  }
  toggleCamera(): void {
    this.view.locked = !this.view.locked;
    if (this.view.locked) this.view.recenter(this.world.hero);
    this.updateCameraButton();
  }
  private updateSoundButton(): void {
    const button = this.root.querySelector<HTMLButtonElement>('#sound-button')!;
    button.classList.toggle('off', !this.sound);
    button.setAttribute('aria-pressed', String(this.sound));
    button.title = this.sound ? 'Mute sound' : 'Unmute sound';
  }
  private updateGold(): void {
    const gold = String(Math.floor(this.world.player.gold));
    const text = this.root.querySelector<HTMLElement>('#gold')!;
    if (text.textContent !== gold) text.textContent = gold;
    const button = this.root.querySelector<HTMLButtonElement>('#shop-button')!;
    const label = `Open item shop, ${gold} gold`;
    if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
  }
  private updateResourceMeter(id: string, value: number, maximum: number): void {
    const text = this.root.querySelector<HTMLElement>(`#${id}`)!;
    const display = `${value} / ${maximum}`;
    if (text.textContent !== display) text.textContent = display;
    const meter = text.parentElement!;
    for (const [key, next] of [
      ['aria-valuenow', String(Math.max(0, Math.min(maximum, value)))],
      ['aria-valuemax', String(maximum)],
    ])
      if (meter.getAttribute(key) !== next) meter.setAttribute(key, next);
  }
  private updateCameraButton(): void {
    const button = this.root.querySelector<HTMLButtonElement>('#camera-button')!;
    button.classList.toggle('active', this.view.locked);
    button.setAttribute('aria-pressed', String(this.view.locked));
    button.title = `${this.view.locked ? 'Unlock' : 'Lock'} camera (Y)`;
  }
  setGraphicsState(state: Hud['graphicsState']): void {
    this.graphicsState = state;
    this.modal = null;
    this.toggleModal(
      state ? 'graphics' : !this.replaying && this.world.winner ? 'result' : 'pause'
    );
    this.focusModal();
  }
  focusModal(): void {
    this.root.querySelector<HTMLElement>('.game-dialog')?.focus();
  }
  toggleModal(which: string): void {
    if (this.replacingMatch && which !== 'graphics') return;
    if (this.graphicsState && which !== 'graphics') return;
    if (
      !this.replaying &&
      this.world.winner &&
      which !== 'result' &&
      which !== 'graphics' &&
      which !== 'replay'
    )
      return;
    this.releaseMinimapCamera();
    if (this.modal === which) {
      this.closeModal();
      return;
    }
    this.offlineCleanup?.();
    this.offlineCleanup = null;
    this.modal = which;
    this.itemTooltip.clear();
    this.hoveredAbility = null;
    this.focusedAbility = null;
    this.refreshTooltip();
    const backdrop = this.root.querySelector<HTMLDivElement>('#modal')!;
    backdrop.hidden = false;
    const playerChoices: readonly ChampionIdentity[] = this.world.battlefield.publicRift
      ? PUBLIC_SELECTABLE_CHAMPIONS
      : this.world.battlefield.developmentRosterBots
        ? ['ashe', 'lux', 'garen', 'masteryi', 'leona', 'ahri']
        : ['ashe', 'lux'];
    const currentChampion = this.world.hero.champion;
    let chosenChampion: ChampionIdentity =
      currentChampion && playerChoices.includes(currentChampion) ? currentChampion : 'ashe';
    let chosenDifficulty: BotDifficulty = this.world.botDifficulty;
    let runesCustomized = !!this.world.player.runeState;
    let chosenRunes: RuneLoadout = this.world.player.runeState
      ? {
          keystone: this.world.player.runeState.loadout.keystone,
          secondary: this.world.player.runeState.loadout.secondary,
          shards: { ...this.world.player.runeState.loadout.shards },
        }
      : defaultRuneLoadoutForRole(PLAYER_CHAMPION_ROLES[chosenChampion]);
    const isJunglerChoice = (champ: ChampionIdentity) => champ === 'masteryi' || champ === 'vi';
    const laneDescription = () =>
      this.world.battlefield.publicRift
        ? `Play ${championProfile(chosenChampion).name} in ${ROLE_LABELS[PLAYER_CHAMPION_ROLES[chosenChampion]].toLowerCase()} with four allied bots against five opponents across all 10 distinct champions (zero mirrors). Role Quests, Elemental Drakes, Voidgrubs (06:00), Rift Herald (15:00), and Baron Nashor (20:00) are active.${isJunglerChoice(chosenChampion) ? ' Smite is required to buy your own jungle companion.' : ''}`
        : this.world.battlefield.developmentRosterBots
          ? `Play ${championProfile(chosenChampion).name} in ${ROLE_LABELS[PLAYER_CHAMPION_ROLES[chosenChampion]].toLowerCase()} with four allied bots against five opponents. Your champion takes that allied position in the ${this.rosterPlaytest ? 'playtest' : 'development'} roster. Jungle bots use Smite and a paid companion.${chosenChampion === 'masteryi' ? ' Smite is required to buy your own jungle companion.' : ''} Major objectives and complete team strategy are in development.`
          : `Play ${chosenChampion === 'lux' ? 'Lux in mid' : 'Ashe in bottom lane'} with four allied bots against five opponents. Each team has top, jungle, mid, bottom and support assignments. Jungle bots use Smite and a companion. Ashe and Lux are selectable here; major objectives and complete team strategy are in development.`;
    const canPractice = () =>
      !!this.world.battlefield.publicRift || chosenChampion === 'ashe' || chosenChampion === 'lux';
    const practiceDescription = () =>
      canPractice()
        ? 'Train with a sparring partner, target dummy and practice tools. Rift jungle camps and Scuttlers follow their normal spawn calendars.'
        : 'Choose Ashe or Lux for practice in this trial.';
    const chosenSummoners = { ...this.world.player.summoners };
    const summonerChoices = () =>
      `<div class="summoner-selection" role="group" aria-label="Choose summoner spells">${(['d', 'f'] as const).map((slot) => `<fieldset><legend>${slot.toUpperCase()} spell</legend><div class="summoner-choices">${(Object.keys(SUMMONERS) as SummonerSpell[]).map((spell) => `<button class="menu-button" data-action="choose-summoner" data-summoner-slot="${slot}" data-spell="${spell}" aria-pressed="${chosenSummoners[slot] === spell}"><img src="assets/icons/${SUMMONERS[spell].icon}.png" alt="">${SUMMONERS[spell].name}</button>`).join('')}</div></fieldset>`).join('')}</div>`;
    const botSkillChoices = () =>
      `<div class="summoner-selection bot-difficulty-selection" role="group" aria-label="Choose bot skill"><fieldset><legend>Bot skill</legend><div class="summoner-choices bot-difficulty-choices">${(Object.keys(BOT_DIFFICULTIES) as BotDifficulty[]).map((level) => `<button class="menu-button" data-action="choose-bot-difficulty" data-bot-difficulty="${level}" aria-pressed="${chosenDifficulty === level}" title="${BOT_DIFFICULTIES[level].description}">${BOT_DIFFICULTIES[level].name}</button>`).join('')}</div></fieldset></div>`;
    const runeChoices = () =>
      this.world.battlefield.publicRift
        ? `<div class="rune-selection" role="group" aria-label="Choose runes and stat shards">
            <h4>Keystone &amp; Secondary Rune</h4>
            <div class="rune-row">${KEYSTONE_IDS.map((k) => `<button type="button" class="menu-button rune-choice" data-action="choose-keystone" data-keystone="${k}" aria-pressed="${chosenRunes.keystone === k}" title="${KEYSTONES[k].description}"><img src="assets/icons/${KEYSTONES[k].icon}.png" alt="">${KEYSTONES[k].name}</button>`).join('')}</div>
            <div class="rune-row">${SECONDARY_RUNE_IDS.map((s) => `<button type="button" class="menu-button rune-choice" data-action="choose-secondary-rune" data-secondary-rune="${s}" aria-pressed="${chosenRunes.secondary === s}" title="${SECONDARY_RUNES[s].description}">${SECONDARY_RUNES[s].name}</button>`).join('')}</div>
            <h4>Stat Shards</h4>
            <div class="rune-row">${OFFENSE_SHARD_IDS.map((o) => `<button type="button" class="menu-button rune-choice" data-action="choose-shard" data-shard-row="offense" data-shard-id="${o}" aria-pressed="${chosenRunes.shards.offense === o}">${STAT_SHARD_LABELS.offense[o]}</button>`).join('')}</div>
            <div class="rune-row">${FLEX_SHARD_IDS.map((f) => `<button type="button" class="menu-button rune-choice" data-action="choose-shard" data-shard-row="flex" data-shard-id="${f}" aria-pressed="${chosenRunes.shards.flex === f}">${STAT_SHARD_LABELS.flex[f]}</button>`).join('')}</div>
            <div class="rune-row">${DEFENSE_SHARD_IDS.map((d) => `<button type="button" class="menu-button rune-choice" data-action="choose-shard" data-shard-row="defense" data-shard-id="${d}" aria-pressed="${chosenRunes.shards.defense === d}">${STAT_SHARD_LABELS.defense[d]}</button>`).join('')}</div>
          </div>`
        : '';
    let content = '',
      title = '',
      subtitle = '';
    if (which === 'graphics') {
      title =
        this.graphicsState === 'failed'
          ? 'Graphics recovery interrupted'
          : 'Restoring the battlefield';
      subtitle = 'The match is paused.';
      const message =
        this.graphicsState === 'lost'
          ? 'Waiting for graphics to recover. Your match is kept in this tab.'
          : this.graphicsState === 'restoring'
            ? 'Preparing the battlefield. You can resume once it is ready.'
            : 'Graphics could not be restored. Save your match or restart to try again.';
      content = `<p class="practice-note" role="status">${message}</p>${this.replaying ? '' : '<button class="menu-button" data-action="save">Save match</button>'}<button class="menu-button" data-action="export">Download current match</button><button class="primary-button" data-action="reset">Restart match</button><p class="practice-note">Restarting starts a new match.</p>`;
    } else if (which === 'result') {
      title = this.world.winner === 'blue' ? 'Victory' : 'Defeat';
      subtitle =
        this.world.winner === 'blue' ? 'The enemy Nexus has fallen.' : 'Your Nexus has fallen.';
      content =
        '<button class="primary-button" data-action="reset">Play again</button><button class="menu-button" data-action="watch-replay">Watch replay</button><button class="menu-button" data-action="export-replay">Download replay</button><button class="menu-button" data-action="export">Download current match</button>';
    } else if (which === 'pause') {
      title = this.replaying ? 'Replay paused' : 'Game paused';
      subtitle = this.replaying
        ? 'Deterministic command-log playback.'
        : 'A moment of clarity before the next move.';
      content = this.replaying
        ? '<button class="primary-button" data-action="resume">Return to replay</button><button class="menu-button" data-action="replay">Replay files</button><button class="menu-button" data-action="audio">Sound & mix</button><button class="menu-button" data-action="reference-audit">Reference &amp; patch 26.18</button><button class="menu-button" data-action="help">Controls & keybindings</button><button class="menu-button" data-action="exit-replay">Exit replay</button>'
        : `<button class="primary-button" data-action="resume">Return to the Rift</button><button class="menu-button" data-action="save">Save match</button><button class="menu-button" data-action="files">Match files</button><button class="menu-button" data-action="replay">Replay</button><button class="menu-button" data-action="audio">Sound & mix</button><button class="menu-button" data-action="offline">Offline files</button><button class="menu-button" data-action="reference-audit">Reference &amp; patch 26.18</button>${this.world.battlefield.id === 'rift' ? '<button class="menu-button" data-action="new-match">New match</button>' : ''}<button class="menu-button" data-action="help">Controls & keybindings</button><button class="menu-button" data-action="reset">${this.world.matchMode === 'lanes' ? 'Restart 5v5 match' : 'Restart practice'}</button>`;
    } else if (which === 'reference-audit') {
      const summary = summarizeReferenceCoverage();
      title = 'Reference & Patch 26.18';
      subtitle =
        'Pinned reference coverage, intentional adaptations, and player-visible deviations.';
      content = `<div class="audit-summary" role="group" aria-label="Reference ledger summary">
        <span class="audit-pill"><b>${summary.byCategory.champion}</b> champions (${summary.byCategory.ability} abilities)</span>
        <span class="audit-pill"><b>${summary.byStatus['verified-behavior']}</b> verified behavior</span>
        <span class="audit-pill"><b>${summary.byStatus['verified-data']}</b> verified data</span>
        <span class="audit-pill"><b>${summary.byStatus.approximation}</b> approximations</span>
        <span class="audit-pill"><b>${summary.byStatus.unimplemented}</b> deferred</span>
      </div>
      <div class="shop-categories" role="group" aria-label="Filter reference ledger">
        ${(['all', 'verified-behavior', 'verified-data', 'approximation', 'unimplemented'] as const).map((f) => `<button type="button" class="menu-button shop-category-btn" data-audit-filter="${f}" aria-pressed="${f === 'all'}">${f === 'all' ? 'All entries' : f}</button>`).join('')}
      </div>
      <div class="audit-scroll" id="audit-list">
        ${REFERENCE_COVERAGE_LEDGER.map((entry) => `<div class="audit-entry" data-audit-kind="${entry.status}"><div><span class="audit-badge">${entry.status}</span><strong>${entry.name}</strong></div><small>${entry.category} · Source: ${entry.sourceReference}${entry.playerDeviationNote ? ` · Deviation: ${entry.playerDeviationNote}` : ''}</small></div>`).join('')}
      </div>
      <button class="menu-button" data-action="back">Back to pause menu</button>`;
    } else if (which === 'replay') {
      title = 'Match replay';
      subtitle = 'Deterministic command-log verification and spectator playback.';
      content = `${this.replaying ? '' : '<button class="primary-button" data-action="watch-replay">Watch current replay</button><button class="menu-button" data-action="export-replay">Download replay file</button>'}<button class="menu-button" data-action="choose-replay-file">Choose replay file</button><input type="file" accept=".json,application/json" aria-label="Replay file" hidden><p class="practice-note replay-file-status" role="status">Choose a replay file from this game version and ruleset to verify and watch it.</p><button class="primary-button" data-action="load-replay-file" hidden>Watch loaded replay</button><button class="menu-button" data-action="${!this.replaying && this.world.winner ? 'result-back' : 'back'}">${!this.replaying && this.world.winner ? 'Back to match result' : 'Back to pause menu'}</button>`;
    } else if (which === 'audio') {
      title = 'Sound & mix';
      subtitle = 'Balance combat effects, feedback cues, and busy-fight limiting.';
      const mix = this.actions.soundMix?.() ?? DEFAULT_SOUND_MIX;
      const presets = [0, 0.25, 0.5, 0.75, 1] as const;
      const mixRow = (channel: 'master' | 'combat' | 'feedback', label: string) =>
        `<div class="mix-group" role="group" aria-label="${label}"><span class="mix-label">${label}</span><div class="mix-presets">${presets.map((val) => `<button type="button" class="menu-button mix-preset" data-mix-channel="${channel}" data-mix-value="${val}" aria-pressed="${Math.abs(mix[channel] - val) < 0.01}">${Math.round(val * 100)}%</button>`).join('')}</div></div>`;
      content = `<button type="button" class="menu-button" data-action="toggle-sound-modal" aria-pressed="${this.sound}">${this.sound ? 'Sound: Enabled (click to mute)' : 'Sound: Muted (click to unmute)'}</button>${mixRow('master', 'Master volume')}${mixRow('combat', 'Combat SFX')}${mixRow('feedback', 'UI & feedback cues')}<button type="button" class="menu-button" data-action="toggle-limiter" aria-pressed="${mix.dynamicLimiter}">${mix.dynamicLimiter ? 'Dynamic fight limiter: On' : 'Dynamic fight limiter: Off'}</button><button type="button" class="menu-button" data-action="reset-mix">Reset mix defaults</button><button type="button" class="menu-button" data-action="back">Back to pause menu</button>`;
    } else if (which === 'new-match') {
      title = 'Choose your match';
      subtitle = this.rosterPlaytest
        ? 'Internal roster playtest. Saves are separate from the public game.'
        : 'Play locally. Your browser runs the match.';
      content = `<div class="champion-choice" role="group" aria-label="Choose your champion">${playerChoices.map((champion) => `<button class="menu-button" data-action="choose-champion" data-champion="${champion}" aria-pressed="${champion === chosenChampion}"><img src="assets/icons/${champion}.png" alt=""><span>${championProfile(champion).name}</span></button>`).join('')}</div>${summonerChoices()}${botSkillChoices()}${runeChoices()}<button class="primary-button" data-action="start-lanes">Start 5v5 match</button><p class="practice-note lane-description">${laneDescription()}</p><button class="menu-button" data-action="start-practice" ${canPractice() ? '' : 'disabled'}>Start practice</button><p class="practice-note practice-description">${practiceDescription()}</p><p class="practice-note">Starting replaces your current match and browser save. Download a match file first if you want to keep it.</p><button class="menu-button" data-action="back">Back to pause menu</button>`;
    } else if (which === 'offline') {
      title = 'Offline files';
      subtitle = 'Keep a complete game pack on this browser.';
      content =
        '<div class="offline-panel"></div><button class="menu-button" data-action="back">Back to pause menu</button>';
    } else if (which === 'files') {
      title = 'Match files';
      subtitle = 'Keep a copy. Continue on another browser.';
      content =
        '<button class="menu-button" data-action="export">Download current match</button><button class="menu-button" data-action="choose-file">Choose match file</button><button class="menu-button" data-action="recovery">Preview recovery checkpoint</button><p class="practice-note">An automatic backup is kept separately from your manual save.</p><input type="file" accept=".json,application/json" aria-label="Match file" hidden><p class="practice-note file-status" role="status">Choose a file from this game version to preview it before loading.</p><button class="primary-button" data-action="load-file" hidden>Load this match</button><button class="menu-button" data-action="back">Back to pause menu</button>';
    } else if (which === 'help') {
      title = 'Master the Rift';
      subtitle = 'Every movement begins with a decision.';
      const controls = [
        ['Right-click', 'Move / attack target'],
        ['Hold right-click', 'Follow cursor movement / target changes'],
        ['A → click', 'Attack move'],
        ['Shift + right-click', 'Attack move immediately'],
        ['Hold &#96;', 'Champion-only right-click and targeted spells'],
        ['S', 'Stop'],
        ...(this.world.hero.champion === 'masteryi'
          ? [
              ['Hold Q', 'Point at an enemy in range, then release Alpha Strike'],
              ['W / E / R', 'Activate Meditate / Wuju Style / Highlander'],
              ['Right-click during Q', 'Choose your return side'],
              ['Move or Stop during W', 'End Meditate'],
            ]
          : this.world.hero.champion === 'garen'
            ? [
                ['Q / W / E', 'Activate Decisive Strike / Courage / Judgment'],
                ['E again', 'End Judgment after its first second'],
                ['Hold R', 'Point at an enemy champion in range, then release'],
              ]
            : this.world.hero.champion === 'ahri'
              ? [
                  ['Hold Q / E / R', 'Aim Orb of Deception / Charm / Spirit Rush, then release'],
                  ['W', 'Activate Fox-Fire'],
                  ['R again', 'Use a stored Spirit Rush cast while its window is active'],
                ]
              : this.world.hero.champion === 'leona'
                ? [
                    ['Q / W', 'Activate Shield of Daybreak / Eclipse'],
                    ['Hold E / R', 'Aim Zenith Blade / Solar Flare, then release'],
                  ]
                : this.world.hero.champion === 'lux'
                  ? [
                      ['Hold Q / W / E / R', 'Aim, then release to cast'],
                      ['E again', 'Detonate Lucent Singularity'],
                    ]
                  : this.world.hero.champion === 'darius'
                    ? [
                        ['Q / W', 'Activate Decimate / Crippling Strike'],
                        ['Hold E', 'Aim Apprehend cone pull, then release'],
                        ['Hold R', 'Point at an enemy champion for Noxian Guillotine'],
                      ]
                    : this.world.hero.champion === 'vi'
                      ? [
                          ['Hold Q', 'Aim Vault Breaker dash, then release'],
                          ['E', 'Empower next attack with Relentless Force'],
                          ['Hold R', 'Point at an enemy champion for Cease and Desist'],
                        ]
                      : this.world.hero.champion === 'ezreal'
                        ? [
                            [
                              'Hold Q / W / E / R',
                              'Aim Mystic Shot / Essence Flux / Arcane Shift / Trueshot Barrage',
                            ],
                            ['R over minimap', 'Aim Trueshot Barrage globally across the map'],
                          ]
                        : this.world.hero.champion === 'morgana'
                          ? [
                              ['Hold Q / W', 'Aim Dark Binding / Tormented Shadow, then release'],
                              [
                                'Hold E',
                                'Hover an ally (or empty ground for self) to grant Black Shield',
                              ],
                              ['R', 'Bind nearby enemy champions with Soul Shackles'],
                            ]
                          : [
                              ['Q', 'Activate Focus at 4 stacks'],
                              ['Hold W / E / R', 'Aim, then release to cast'],
                              [
                                'E / R over minimap',
                                'Aim across the map without moving the camera',
                              ],
                            ]),
        ['D / F', `${this.spellSpec('d').name} / ${this.spellSpec('f').name}`],
        ['1–3, 5–8', 'Use active or consumable item in slot'],
        ['B', 'Recall to fountain'],
        ['4', 'Stealth Ward / Farsight Alteration (aim) or Oracle Lens (instant)'],
        ['P', 'Open item shop'],
        ['Space / Y', 'Recenter / lock camera'],
        ['Drag minimap', 'Move camera; right-click to move your champion'],
        ['F1', 'Hold to follow your champion'],
        ...(this.world.matchMode === 'lanes'
          ? [
              ['F2–F5', 'Hold to follow a teammate'],
              ['Ally portraits', 'Click above the minimap to view a teammate'],
            ]
          : []),
        ['Shift', 'Show attack range'],
        ['Tab', 'Hold scoreboard'],
        ['Esc', 'Cancel aiming / pause'],
      ];
      content = `<div class="controls-list">${controls.map(([key, desc]) => `<kbd>${key}</kbd><span>${desc}</span>`).join('')}</div><button class="primary-button" data-action="resume">Return to the Rift</button>`;
    } else if (which === 'practice') {
      title = 'Practice tools';
      subtitle = 'Make room for the next perfect play.';
      content =
        '<div class="practice-grid"><button class="menu-button" data-action="restore">Restore health & mana</button><button class="menu-button" data-action="cooldowns">Reset cooldowns</button><button class="menu-button" data-action="gold">Add 1,000 gold</button><button class="menu-button" data-action="dummy">Restore target dummy</button><button class="menu-button" data-action="level-up">Level up (+1)</button><button class="menu-button" data-action="max-level">Max level (18)</button><button class="menu-button" data-action="reset-enemy">Restore opponent</button><button class="menu-button" data-action="fast-forward-30s">Advance 30s</button></div><p class="practice-note">Spend skill points to learn and upgrade abilities. Reset cooldowns readies learned abilities, summoners and your trinket, while preserving your skill choices.</p><button class="primary-button" data-action="resume">Return to the Rift</button>';
    } else if (which === 'shop') {
      title = 'Item shop';
      subtitle = 'Prepare for the fight ahead.';
      const role =
        this.world.player.role ?? PLAYER_CHAMPION_ROLES[this.world.hero.champion ?? 'ashe'];
      const shopCategories = [
        ['all', 'All'],
        ['recommended', 'Recommended'],
        ['starter', 'Starter & Consumable'],
        ['boots', 'Boots'],
        ['attack', 'Attack'],
        ['magic', 'Magic'],
        ['defense', 'Defense'],
        ['support', 'Support'],
      ] as const;
      content = `<div class="shop-balance"><span>Available gold <b>◆ ${Math.floor(this.world.player.gold)}</b></span><button type="button" class="menu-button shop-undo-button" data-action="undo-shop" ${this.world.player.itemState?.undoHistory.length && this.world.canShop() ? '' : 'disabled'}>↶ Undo</button></div><div class="shop-panels"><section class="shop-catalog-panel" aria-label="Item catalog"><h3>All items</h3><div class="shop-categories" role="group" aria-label="Item categories">${shopCategories.map(([id, label]) => `<button type="button" class="menu-button shop-category-btn" data-shop-category="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('')}</div><div class="shop-catalog shop-items">${ITEMS.map(
        (item) => {
          const exp = getExpandedItem(item.id);
          const cat =
            exp?.category ??
            (item.id === 'boots'
              ? 'boots'
              : item.id === 'blade'
                ? 'starter'
                : companionItemKind(item.id)
                  ? 'starter'
                  : 'component');
          const rec =
            exp?.recommendedRoles?.includes(role) ||
            (role === 'jungle' && !!companionItemKind(item.id)) ||
            (role === 'carry' && (item.id === 'infinity-edge' || item.id === 'blade')) ||
            (role === 'mid' && (item.id === 'chapter' || item.id === 'deathcap'));
          return `<button class="shop-item" data-buy="${item.id}" data-item-category="${cat}" data-item-recommended="${rec ? 'true' : 'false'}"><img src="assets/icons/${item.icon}.png" alt=""><span><strong>${item.name}</strong><small>${item.description}</small></span><b>◆ ${this.world.purchasePlan(item.id)!.cost}</b></button>`;
        }
      ).join(
        ''
      )}</div></section><section class="shop-inventory-panel" aria-label="Owned items"><h3>Owned items</h3><div class="shop-owned shop-items"></div><h3>Trinkets</h3><div class="shop-trinkets shop-items">${(Object.keys(TRINKETS) as TrinketKind[]).map((kind) => `<button class="shop-item" data-trinket="${kind}"><img src="assets/icons/${TRINKETS[kind].icon}.png" alt=""><span><strong>${TRINKETS[kind].name}</strong><small>${kind === 'ward' ? 'Place wards' : kind === 'farsight' ? 'Lv. 9+ 4k sight' : '8s sweep'}</small></span><b>Free</b></button>`).join('')}</div></section></div><p class="shop-message" role="status">Buy and sell at your fountain, or while dead.</p>`;
    }
    if (which !== 'shop') this.actions.pause(true);
    backdrop.innerHTML = `<section class="game-dialog ${which}${which === 'result' ? (this.world.winner === 'blue' ? ' victory' : ' defeat') : ''}" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="dialog-title"><button class="close-button" aria-label="Close menu">×</button><span class="dialog-kicker">SUMMONER’S RIFT</span><h2 id="dialog-title">${title}</h2><p class="dialog-subtitle">${subtitle}</p><div class="dialog-rule">◈</div>${content}</section>`;
    backdrop
      .querySelector('[data-action="start-practice"]')
      ?.classList.toggle('practice-unavailable', !canPractice());
    if (this.importError) {
      const error = document.createElement('p');
      error.className = 'practice-note import-error';
      error.setAttribute('role', 'alert');
      error.textContent = this.importError;
      backdrop.querySelector('.dialog-rule')!.after(error);
    }
    if (which === 'result' || which === 'graphics')
      backdrop.querySelector<HTMLButtonElement>('.close-button')!.hidden = true;
    backdrop.querySelector('.close-button')!.addEventListener('click', () => this.closeModal());
    backdrop.onkeydown = (event) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        backdrop.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([hidden])')
      );
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        index < 0
          ? event.shiftKey
            ? buttons.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next]?.focus();
    };
    backdrop.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) =>
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (this.replacingMatch) return;
        if (action === 'new-match') this.toggleModal('new-match');
        if (action === 'choose-summoner') {
          const slot = button.dataset.summonerSlot as SummonerSlot,
            spell = button.dataset.spell as SummonerSpell;
          const other = slot === 'd' ? 'f' : 'd';
          if (chosenSummoners[other] === spell) chosenSummoners[other] = chosenSummoners[slot];
          chosenSummoners[slot] = spell;
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-summoner-slot]')
            .forEach((choice) =>
              choice.setAttribute(
                'aria-pressed',
                String(
                  chosenSummoners[choice.dataset.summonerSlot as SummonerSlot] ===
                    choice.dataset.spell
                )
              )
            );
        }
        if (action === 'choose-bot-difficulty') {
          const level = button.dataset.botDifficulty;
          if (!isBotDifficulty(level)) return;
          chosenDifficulty = level;
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-bot-difficulty]')
            .forEach((choice) =>
              choice.setAttribute(
                'aria-pressed',
                String(choice.dataset.botDifficulty === chosenDifficulty)
              )
            );
        }
        if (action === 'choose-champion') {
          const champion = button.dataset.champion as ChampionIdentity;
          if (!playerChoices.includes(champion)) return;
          chosenChampion = champion;
          if (!runesCustomized) {
            chosenRunes = defaultRuneLoadoutForRole(PLAYER_CHAMPION_ROLES[chosenChampion]);
            backdrop
              .querySelectorAll<HTMLButtonElement>('[data-keystone]')
              .forEach((btn) =>
                btn.setAttribute(
                  'aria-pressed',
                  String(btn.dataset.keystone === chosenRunes.keystone)
                )
              );
            backdrop
              .querySelectorAll<HTMLButtonElement>('[data-secondary-rune]')
              .forEach((btn) =>
                btn.setAttribute(
                  'aria-pressed',
                  String(btn.dataset.secondaryRune === chosenRunes.secondary)
                )
              );
            backdrop.querySelectorAll<HTMLButtonElement>('[data-shard-row]').forEach((btn) => {
              const row = btn.dataset.shardRow as 'offense' | 'flex' | 'defense';
              btn.setAttribute(
                'aria-pressed',
                String(btn.dataset.shardId === chosenRunes.shards[row])
              );
            });
          }
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-champion]')
            .forEach((choice) =>
              choice.setAttribute(
                'aria-pressed',
                String(choice.dataset.champion === chosenChampion)
              )
            );
          backdrop.querySelector('.lane-description')!.textContent = laneDescription();
          backdrop.querySelector<HTMLButtonElement>('[data-action="start-practice"]')!.disabled =
            !canPractice();
          backdrop
            .querySelector('[data-action="start-practice"]')!
            .classList.toggle('practice-unavailable', !canPractice());
          backdrop.querySelector('.practice-description')!.textContent = practiceDescription();
        }
        if (action === 'choose-keystone') {
          const k = button.dataset.keystone as KeystoneId;
          if (!KEYSTONE_IDS.includes(k)) return;
          runesCustomized = true;
          chosenRunes = { ...chosenRunes, keystone: k };
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-keystone]')
            .forEach((btn) =>
              btn.setAttribute(
                'aria-pressed',
                String(btn.dataset.keystone === chosenRunes.keystone)
              )
            );
        }
        if (action === 'choose-secondary-rune') {
          const s = button.dataset.secondaryRune as SecondaryRuneId;
          if (!SECONDARY_RUNE_IDS.includes(s)) return;
          runesCustomized = true;
          chosenRunes = { ...chosenRunes, secondary: s };
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-secondary-rune]')
            .forEach((btn) =>
              btn.setAttribute(
                'aria-pressed',
                String(btn.dataset.secondaryRune === chosenRunes.secondary)
              )
            );
        }
        if (action === 'choose-shard') {
          const row = button.dataset.shardRow as 'offense' | 'flex' | 'defense';
          const id = button.dataset.shardId!;
          runesCustomized = true;
          if (row === 'offense' && (OFFENSE_SHARD_IDS as readonly string[]).includes(id))
            chosenRunes = {
              ...chosenRunes,
              shards: { ...chosenRunes.shards, offense: id as OffenseShardId },
            };
          if (row === 'flex' && (FLEX_SHARD_IDS as readonly string[]).includes(id))
            chosenRunes = {
              ...chosenRunes,
              shards: { ...chosenRunes.shards, flex: id as FlexShardId },
            };
          if (row === 'defense' && (DEFENSE_SHARD_IDS as readonly string[]).includes(id))
            chosenRunes = {
              ...chosenRunes,
              shards: { ...chosenRunes.shards, defense: id as DefenseShardId },
            };
          backdrop
            .querySelectorAll<HTMLButtonElement>(`[data-shard-row="${row}"]`)
            .forEach((btn) =>
              btn.setAttribute(
                'aria-pressed',
                String(btn.dataset.shardId === chosenRunes.shards[row])
              )
            );
        }
        if (action === 'start-lanes' || action === 'start-practice') {
          if (action === 'start-practice' && !canPractice()) return;
          this.replacingMatch = true;
          backdrop.querySelectorAll<HTMLButtonElement>('button').forEach((control) => {
            control.disabled = true;
          });
          const dialog = backdrop.querySelector<HTMLElement>('.game-dialog')!;
          dialog.focus({ preventScroll: true });
          const status = document.createElement('p');
          status.className = 'practice-note';
          status.setAttribute('role', 'status');
          status.textContent = 'Starting match…';
          dialog.querySelector('.dialog-rule')!.after(status);
          const mode = action === 'start-lanes' ? 'lanes' : 'practice';
          const passRunes =
            this.world.battlefield.publicRift && (mode === 'lanes' || runesCustomized)
              ? chosenRunes
              : undefined;
          void (
            passRunes
              ? this.actions.startMatch(
                  mode,
                  chosenChampion,
                  chosenSummoners,
                  chosenDifficulty,
                  passRunes
                )
              : chosenDifficulty === DEFAULT_BOT_DIFFICULTY
                ? this.actions.startMatch(mode, chosenChampion, chosenSummoners)
                : this.actions.startMatch(mode, chosenChampion, chosenSummoners, chosenDifficulty)
          ).catch((error) => {
            this.replacingMatch = false;
            this.importError =
              error instanceof Error ? error.message : 'Match could not be started.';
            this.setGraphicsState(this.graphicsState);
          });
        }
        if (action === 'reference-audit') this.toggleModal('reference-audit');
        if (action === 'undo-shop') {
          const err = this.world.undoShop();
          const msgEl = backdrop.querySelector<HTMLElement>('.shop-message');
          if (msgEl) {
            msgEl.textContent = err ?? 'Last shop transaction undone';
            msgEl.classList.toggle('error', !!err);
          }
          const bal = backdrop.querySelector('.shop-balance b');
          if (bal) bal.textContent = `◆ ${Math.floor(this.world.player.gold)}`;
          this.updateShopOwnedItems();
          this.updateShopPurchases();
        }
        if (action === 'offline') this.toggleModal('offline');
        if (action === 'files') this.toggleModal('files');
        if (action === 'replay') this.toggleModal('replay');
        if (action === 'audio') this.toggleModal('audio');
        if (action === 'back') this.toggleModal('pause');
        if (action === 'result-back') this.toggleModal('result');
        if (action === 'exit-replay') {
          this.closeModal();
          this.actions.replayControl?.({ type: 'exit' });
        }
        if (action === 'export') {
          try {
            this.actions.exportMatch();
          } catch {
            this.toast('Match could not be downloaded.');
          }
        }
        if (action === 'export-replay') {
          button.disabled = true;
          void (this.actions.exportReplay?.() ?? Promise.resolve())
            .then(() => this.toast('Replay file downloaded.'))
            .catch((error) =>
              this.toast(error instanceof Error ? error.message : 'Replay could not be downloaded.')
            )
            .finally(() => {
              if (button.isConnected) button.disabled = false;
            });
        }
        if (action === 'watch-replay') {
          button.disabled = true;
          void (this.actions.watchCurrentReplay?.() ?? Promise.resolve())
            .catch((error) =>
              this.toast(error instanceof Error ? error.message : 'Replay could not be started.')
            )
            .finally(() => {
              if (button.isConnected) button.disabled = false;
            });
        }
        if (action === 'toggle-sound-modal') {
          this.sound = !this.sound;
          this.actions.sound(this.sound);
          this.updateSoundButton();
          button.setAttribute('aria-pressed', String(this.sound));
          button.textContent = this.sound
            ? 'Sound: Enabled (click to mute)'
            : 'Sound: Muted (click to unmute)';
        }
        if (action === 'toggle-limiter') {
          const current = this.actions.soundMix?.() ?? DEFAULT_SOUND_MIX;
          const updated = this.actions.updateSoundMix?.({
            dynamicLimiter: !current.dynamicLimiter,
          }) ?? { ...current, dynamicLimiter: !current.dynamicLimiter };
          button.setAttribute('aria-pressed', String(updated.dynamicLimiter));
          button.textContent = updated.dynamicLimiter
            ? 'Dynamic fight limiter: On'
            : 'Dynamic fight limiter: Off';
        }
        if (action === 'reset-mix') {
          const updated =
            this.actions.updateSoundMix?.({ ...DEFAULT_SOUND_MIX }) ?? DEFAULT_SOUND_MIX;
          backdrop.querySelectorAll<HTMLButtonElement>('[data-mix-channel]').forEach((preset) => {
            const channel = preset.dataset.mixChannel as 'master' | 'combat' | 'feedback';
            preset.setAttribute(
              'aria-pressed',
              String(Math.abs(updated[channel] - Number(preset.dataset.mixValue)) < 0.01)
            );
          });
          const limiterBtn = backdrop.querySelector<HTMLButtonElement>(
            '[data-action="toggle-limiter"]'
          );
          if (limiterBtn) {
            limiterBtn.setAttribute('aria-pressed', String(updated.dynamicLimiter));
            limiterBtn.textContent = updated.dynamicLimiter
              ? 'Dynamic fight limiter: On'
              : 'Dynamic fight limiter: Off';
          }
          this.toast('Sound mix reset to defaults.');
        }
        if (action === 'resume') this.closeModal();
        if (action === 'help') this.toggleModal('help');
        if (action === 'reset') this.actions.reset();
        if (action === 'save') {
          button.disabled = true;
          void this.actions
            .save()
            .then(() => this.toast('Match saved on this browser.'))
            .catch((error) =>
              this.toast(error instanceof Error ? error.message : 'Match could not be saved.')
            )
            .finally(() => {
              button.disabled = false;
            });
        }
        if (isImmediatePracticeAction(action) || action === 'fast-forward-30s') {
          const feedback = this.actions.practiceTool
            ? this.actions.practiceTool(action)
            : action === 'fast-forward-30s'
              ? (() => {
                  this.world.step(30 * TICK_RATE);
                  return 'Advanced match by 30 seconds';
                })()
              : applyImmediatePracticeTool(this.world, action);
          this.toast(feedback);
        }
      })
    );
    if (which === 'reference-audit') {
      backdrop.querySelectorAll<HTMLButtonElement>('[data-audit-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = btn.dataset.auditFilter!;
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-audit-filter]')
            .forEach((b) =>
              b.setAttribute('aria-pressed', String(b.dataset.auditFilter === filter))
            );
          backdrop.querySelectorAll<HTMLElement>('[data-audit-kind]').forEach((row) => {
            const kind = row.dataset.auditKind!;
            row.hidden = filter === 'all' ? false : kind !== filter;
          });
        });
      });
    }
    if (which === 'shop') {
      backdrop.querySelectorAll<HTMLButtonElement>('[data-shop-category]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.shopCategory!;
          backdrop
            .querySelectorAll<HTMLButtonElement>('[data-shop-category]')
            .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shopCategory === cat)));
          backdrop.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((itemBtn) => {
            const itemCat = itemBtn.dataset.itemCategory!;
            const isRec = itemBtn.dataset.itemRecommended === 'true';
            itemBtn.hidden =
              cat === 'all'
                ? false
                : cat === 'recommended'
                  ? !isRec
                  : cat === 'starter'
                    ? itemCat !== 'starter' && itemCat !== 'consumable'
                    : itemCat !== cat;
          });
        });
      });
    }
    if (which === 'audio') {
      backdrop.querySelectorAll<HTMLButtonElement>('[data-mix-channel]').forEach((preset) => {
        preset.addEventListener('click', () => {
          const channel = preset.dataset.mixChannel as 'master' | 'combat' | 'feedback';
          const value = Number(preset.dataset.mixValue);
          const updated = this.actions.updateSoundMix?.({ [channel]: value }) ?? DEFAULT_SOUND_MIX;
          backdrop
            .querySelectorAll<HTMLButtonElement>(`[data-mix-channel="${channel}"]`)
            .forEach((btn) =>
              btn.setAttribute(
                'aria-pressed',
                String(Math.abs(updated[channel] - Number(btn.dataset.mixValue)) < 0.01)
              )
            );
        });
      });
    }
    if (which === 'replay') {
      const dialog = backdrop.querySelector<HTMLElement>('.game-dialog')!;
      const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
      const choose = dialog.querySelector<HTMLButtonElement>('[data-action="choose-replay-file"]')!;
      const watchLoaded = dialog.querySelector<HTMLButtonElement>(
        '[data-action="load-replay-file"]'
      )!;
      const status = dialog.querySelector<HTMLElement>('.replay-file-status')!;
      let preparedLog: MatchReplayLog | null = null;
      let selection = 0;
      choose.onclick = () => fileInput.click();
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file || !this.actions.prepareReplay) return;
        const generation = ++selection;
        preparedLog = null;
        watchLoaded.hidden = true;
        status.textContent = 'Verifying replay file…';
        void this.actions
          .prepareReplay(file)
          .then((result) => {
            if (!dialog.isConnected || generation !== selection) return;
            preparedLog = result.log;
            status.textContent = result.description;
            watchLoaded.hidden = false;
            watchLoaded.focus();
          })
          .catch((error) => {
            if (!dialog.isConnected || generation !== selection) return;
            status.textContent =
              error instanceof Error ? error.message : 'Replay file could not be read.';
          });
      };
      watchLoaded.onclick = () => {
        if (!preparedLog || !this.actions.watchPreparedReplay) return;
        watchLoaded.disabled = true;
        status.textContent = 'Opening replay…';
        void this.actions.watchPreparedReplay(preparedLog).catch((error) => {
          if (!dialog.isConnected) return;
          watchLoaded.disabled = false;
          status.textContent =
            error instanceof Error ? error.message : 'Replay could not be opened.';
        });
      };
    }
    if (which === 'files') {
      const dialog = backdrop.querySelector<HTMLElement>('.game-dialog')!;
      const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
      const choose = dialog.querySelector<HTMLButtonElement>('[data-action="choose-file"]')!;
      const recovery = dialog.querySelector<HTMLButtonElement>('[data-action="recovery"]')!;
      const load = dialog.querySelector<HTMLButtonElement>('[data-action="load-file"]')!;
      const status = dialog.querySelector<HTMLElement>('.file-status')!;
      let prepared: PreparedMatchImport | null = null;
      let selection = 0;
      choose.onclick = () => fileInput.click();
      const preview = (prepare: () => Promise<PreparedMatchImport | null>, checking: string) => {
        const generation = ++selection;
        prepared = null;
        load.hidden = true;
        status.textContent = checking;
        void prepare()
          .then((result) => {
            if (!dialog.isConnected || generation !== selection) return;
            if (!result) {
              status.textContent = 'No recovery checkpoint is available on this browser yet.';
              return;
            }
            prepared = result;
            status.textContent = result.description;
            load.hidden = false;
            load.focus();
          })
          .catch((error) => {
            if (!dialog.isConnected || generation !== selection) return;
            status.textContent =
              error instanceof Error ? error.message : 'Match file could not be read.';
          });
      };
      fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (file) preview(() => this.actions.prepareImport(file), 'Checking match file…');
      };
      recovery.onclick = () =>
        preview(() => this.actions.prepareRecovery(), 'Checking recovery checkpoint…');
      load.onclick = () => {
        if (!prepared || this.replacingMatch) return;
        this.replacingMatch = true;
        this.importError = '';
        dialog.querySelector('.import-error')?.remove();
        dialog.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
          button.disabled = true;
        });
        dialog.focus({ preventScroll: true });
        status.textContent = 'Loading match…';
        void prepared.load().catch((error) => {
          this.replacingMatch = false;
          dialog.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.disabled = false;
          });
          status.textContent =
            error instanceof Error ? error.message : 'Match could not be loaded.';
          if (dialog.isConnected) load.focus();
          else {
            // Graphics interruption can replace the import dialog while its write is pending.
            // Rebuild the current recovery/pause surface after releasing the import lock.
            this.importError = status.textContent;
            this.setGraphicsState(this.graphicsState);
            this.toast(status.textContent);
          }
        });
      };
    }
    const showShopResult = (result: string | null, success: string) => {
      const message = backdrop.querySelector<HTMLElement>('.shop-message')!;
      message.textContent = result ?? success;
      message.classList.toggle('error', !!result);
      backdrop.querySelector('.shop-balance b')!.textContent =
        `◆ ${Math.floor(this.world.player.gold)}`;
      this.updateShopOwnedItems();
      backdrop.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((button) => {
        button.querySelector('b')!.textContent =
          `◆ ${this.world.purchasePlan(button.dataset.buy!)!.cost}`;
      });
    };
    this.updateShopOwnedItems();
    backdrop.querySelectorAll<HTMLButtonElement>('[data-trinket]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (this.buyingItem) return;
        this.buyingItem = true;
        this.updateShopPurchases();
        backdrop.querySelector<HTMLElement>('.shop-message')!.textContent = 'Preparing trinket…';
        try {
          const result = await this.actions.swapTrinket(button.dataset.trinket as TrinketKind);
          if (this.modal === 'shop' && button.isConnected)
            showShopResult(result, 'Trinket equipped');
        } finally {
          this.buyingItem = false;
          this.updateShopPurchases();
        }
      });
    });
    backdrop.querySelector('.shop-owned')?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-sell]');
      if (!button) return;
      if (this.world.player.inventory[Number(button.dataset.sell)] !== button.dataset.item) {
        showShopResult('Inventory changed. Select the item again.', '');
        return;
      }
      showShopResult(this.world.sell(Number(button.dataset.sell)), 'Item sold');
    });
    backdrop.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((button) =>
      button.addEventListener('click', async () => {
        if (this.buyingItem) return;
        this.buyingItem = true;
        this.updateShopPurchases();
        backdrop.querySelector<HTMLElement>('.shop-message')!.textContent = 'Preparing purchase…';
        try {
          const result = await this.actions.buyItem(button.dataset.buy!);
          if (this.modal === 'shop' && button.isConnected) showShopResult(result, 'Item purchased');
        } finally {
          this.buyingItem = false;
          this.updateShopPurchases();
        }
      })
    );
    if (which === 'offline')
      this.offlineCleanup = mountOfflinePack(
        backdrop.querySelector<HTMLElement>('.offline-panel')!
      );
    const initialFocus =
      (which === 'graphics' || which === 'offline'
        ? backdrop.querySelector<HTMLElement>('.game-dialog')
        : null) ??
      backdrop.querySelector<HTMLButtonElement>('.primary-button:not([hidden])') ??
      backdrop.querySelector<HTMLButtonElement>('.menu-button:not([hidden])') ??
      backdrop.querySelector<HTMLButtonElement>('.shop-item') ??
      backdrop.querySelector<HTMLButtonElement>('.close-button');
    initialFocus?.focus();
  }
  releaseMinimapCamera(): void {
    const pointer = this.minimapPointer;
    this.minimapPointer = null;
    if (pointer !== null && this.mini.hasPointerCapture(pointer))
      this.mini.releasePointerCapture(pointer);
  }
  private updateAllyCameras(): void {
    this.allyCameraGroup.hidden = this.world.matchMode !== 'lanes';
    if (this.allyCameraGroup.hidden) return;
    let count = 0;
    for (const button of this.allyCameraButtons) {
      const key = button.dataset.allyCamera!;
      const ally = cameraKeyTarget(this.world, key);
      button.hidden = !ally;
      if (!ally) continue;
      count++;
      const state = this.world.championState(ally.id);
      const role = state?.role ? ROLE_LABELS[state.role] : 'Teammate';
      const alive = this.world.alive(ally);
      const seconds =
        !alive && ally.respawnTick !== null
          ? Math.max(0, Math.ceil((ally.respawnTick - this.world.tick) / TICK_RATE))
          : null;
      const name = championProfile(ally.champion!).name;
      const life = alive
        ? `${Math.ceil(ally.hp)} / ${Math.ceil(ally.maxHp)} health`
        : `Dead${seconds === null ? '' : `, respawns in ${seconds} seconds`}`;
      const label = `View ${name}, ${role}. ${life}. ${key.toUpperCase()}`;
      if (button.getAttribute('aria-label') !== label) {
        button.setAttribute('aria-label', label);
        button.title = label;
      }
      if (button.dataset.champion !== ally.champion) {
        button.dataset.champion = ally.champion!;
        button.querySelector('img')!.src = `assets/icons/${ally.champion}.png`;
      }
      button.dataset.unitId = String(ally.id);
      button.classList.toggle('dead', !alive);
      button.classList.toggle('focused', this.view.cameraFocusId === ally.id);
      const health = button.querySelector<HTMLElement>('.ally-health i')!;
      const width = `${Math.round(Math.max(0, Math.min(1, ally.hp / ally.maxHp)) * 1000) / 10}%`;
      if (health.style.width !== width) health.style.width = width;
      const counter = button.querySelector<HTMLElement>('.ally-respawn')!;
      const text = alive ? '' : seconds === null ? '†' : String(seconds);
      if (counter.textContent !== text) counter.textContent = text;
    }
    this.allyCameraGroup.hidden = count === 0;
  }
  minimapPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const bounds = this.mini.getBoundingClientRect();
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      clientX < bounds.left ||
      clientX >= bounds.right ||
      clientY < bounds.top ||
      clientY >= bounds.bottom ||
      document.elementFromPoint(clientX, clientY) !== this.mini
    )
      return null;
    return {
      x: ((clientX - bounds.left) / bounds.width - 0.5) * this.world.battlefield.half * 2,
      y: ((clientY - bounds.top) / bounds.height - 0.5) * this.world.battlefield.half * 2,
    };
  }
  closeModal(): void {
    if (
      this.replacingMatch ||
      (!this.replaying && this.world.winner) ||
      this.graphicsState ||
      document.hidden
    )
      return;
    this.offlineCleanup?.();
    this.offlineCleanup = null;
    this.modal = null;
    this.importError = '';
    this.root.querySelector<HTMLElement>('#modal')!.hidden = true;
    this.actions.pause(false);
    this.view.renderer.domElement.focus({ preventScroll: true });
  }
  toast(message: string): void {
    this.root.querySelector('#toast')!.textContent = message;
    this.root.querySelector('#toast')!.classList.add('visible');
    this.toastUntil = performance.now() + 2600;
  }
  private objectiveTimeLeft(endTick: number): string {
    const seconds = Math.ceil((endTick - this.world.tick) / TICK_RATE);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  private updateBaronObjective(panel: HTMLElement): void {
    const w = this.world;
    const objective = w.riftBaron;
    panel.hidden = !objective;
    if (!objective) return;
    const boss = objective.unitId === null ? undefined : w.unit(objective.unitId);
    const readyTick = baronReadyTick(objective.lastClear?.tick ?? null);
    const message =
      w.tick < RIFT_BARON.firstReadyTick
        ? `Baron Nashor in ${this.objectiveTimeLeft(readyTick)}`
        : boss && w.alive(boss) && w.vulnerable(boss) && w.visible(boss, w.hero.team)
          ? 'Baron Nashor in sight'
          : objective.lastClear?.team === w.hero.team && w.tick < readyTick
            ? `Baron Nashor respawns in ${this.objectiveTimeLeft(readyTick)}`
            : 'Scout the top river pit for Baron Nashor.';
    if (panel.textContent !== message) panel.textContent = message;
  }
  private updateRiverObjectives(panel: HTMLElement): void {
    const w = this.world;
    panel.hidden = !w.scuttlers;
    if (!w.scuttlers) return;
    const statuses: string[] = [];
    if (w.tick < SCUTTLER_POLICY.firstReadyTick) {
      statuses.push(`First Scuttlers in ${this.objectiveTimeLeft(SCUTTLER_POLICY.firstReadyTick)}`);
    } else {
      const names = { dragon: 'Bottom river', baron: 'Top river' };
      for (const side of RIVER_SIDES) {
        const id = w.scuttlers.unitIds[side];
        const crab = id === null ? undefined : w.unit(id);
        if (
          crab?.kind === 'monster' &&
          crab.monster.phase !== 'spawning' &&
          w.alive(crab) &&
          w.visible(crab, w.hero.team)
        )
          statuses.push(`${names[side]}: Scuttler in sight`);

        const shrine = w.scuttlers.shrines.find((entry) => entry.river === side);
        if (
          shrine &&
          shrine.endTick > w.tick &&
          w.pointVisible(shrinePoint(side, w.battlefield), w.hero.team)
        )
          statuses.push(
            `${names[side]}: ${shrine.team === w.hero.team ? 'Allied' : 'Enemy'} shrine (${this.objectiveTimeLeft(shrine.endTick)})`
          );
      }
    }
    const message = statuses.join(' · ') || 'Scout the river for Scuttlers.';
    if (panel.textContent !== message) panel.textContent = message;
  }
  private updateEpicObjectives(panel: HTMLElement): void {
    const w = this.world;
    const obj = w.riftObjectives;
    panel.hidden = !obj;
    if (!obj) return;
    const parts: string[] = [];
    const drakeUnit = obj.dragon.unitId === null ? undefined : w.unit(obj.dragon.unitId);
    const elem = obj.dragon.nextElement;
    if (obj.dragon.soulTeam && obj.dragon.soulElement) {
      const soulLabel = `${obj.dragon.soulTeam === 'blue' ? 'Blue' : 'Red'} ${DRAGON_SOUL_NAMES[obj.dragon.soulElement]}`;
      parts.push(soulLabel);
      if (drakeUnit && w.alive(drakeUnit) && w.visible(drakeUnit, w.hero.team)) {
        parts.push('Elder Dragon in sight');
      } else if (w.tick < obj.dragon.nextReadyTick) {
        parts.push(`Elder Dragon in ${this.objectiveTimeLeft(obj.dragon.nextReadyTick)}`);
      } else {
        parts.push('Scout bottom pit for Elder Dragon');
      }
    } else if (w.tick < EPIC_OBJECTIVE_TIMING.dragonFirstReadyTick) {
      parts.push(
        `${DRAGON_ELEMENT_NAMES[elem]} in ${this.objectiveTimeLeft(EPIC_OBJECTIVE_TIMING.dragonFirstReadyTick)}`
      );
    } else if (drakeUnit && w.alive(drakeUnit) && w.visible(drakeUnit, w.hero.team)) {
      parts.push(`${DRAGON_ELEMENT_NAMES[elem]} in sight`);
    } else if (w.tick < obj.dragon.nextReadyTick) {
      parts.push(
        `${DRAGON_ELEMENT_NAMES[elem]} in ${this.objectiveTimeLeft(obj.dragon.nextReadyTick)}`
      );
    } else {
      parts.push(`Scout bottom pit for ${DRAGON_ELEMENT_NAMES[elem]}`);
    }
    parts.push(`Drakes B:${obj.dragon.stacks.blue.length} R:${obj.dragon.stacks.red.length}`);
    if (w.tick < EPIC_OBJECTIVE_TIMING.voidgrubDespawnTick && obj.voidgrubs.spawnsCompleted < 2) {
      if (obj.voidgrubs.unitIds.length > 0) parts.push('Voidgrubs active');
      else if (obj.voidgrubs.nextReadyTick !== null && w.tick < obj.voidgrubs.nextReadyTick)
        parts.push(`Voidgrubs in ${this.objectiveTimeLeft(obj.voidgrubs.nextReadyTick)}`);
    } else if (
      w.tick < EPIC_OBJECTIVE_TIMING.heraldDespawnTick &&
      obj.herald.clearedTick === null
    ) {
      if (w.tick < EPIC_OBJECTIVE_TIMING.heraldFirstReadyTick)
        parts.push(
          `Rift Herald in ${this.objectiveTimeLeft(EPIC_OBJECTIVE_TIMING.heraldFirstReadyTick)}`
        );
      else parts.push('Rift Herald in top pit');
    }
    if (obj.voidgrubs.stacks.blue || obj.voidgrubs.stacks.red) {
      parts.push(`Grubs B:${obj.voidgrubs.stacks.blue} R:${obj.voidgrubs.stacks.red}`);
    }
    const message = parts.join(' · ');
    if (panel.textContent !== message) panel.textContent = message;
  }
  scoreboard(show: boolean): void {
    let panel = this.root.querySelector<HTMLDivElement>('.scoreboard');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'scoreboard';
      panel.innerHTML = `<div class="scoreboard-title">${this.world.matchMode === 'lanes' ? '5V5 MATCH' : 'PRACTICE MATCH'}</div><section class="scoreboard-objectives" aria-label="River objectives" hidden></section><section class="scoreboard-objectives" aria-label="Epic objectives" hidden></section><section class="scoreboard-objectives" aria-label="Baron Nashor" hidden></section><div class="scoreboard-teams"></div>`;
      panel.addEventListener('contextmenu', (event) => event.preventDefault());
      this.root.append(panel);
    }
    panel.hidden = !show;
    if (!show) {
      this.itemTooltip.clear();
      return;
    }
    this.updateRiverObjectives(
      panel.querySelector<HTMLElement>('[aria-label="River objectives"]')!
    );
    this.updateEpicObjectives(panel.querySelector<HTMLElement>('[aria-label="Epic objectives"]')!);
    this.updateBaronObjective(panel.querySelector<HTMLElement>('[aria-label="Baron Nashor"]')!);
    const rows = this.world.units
      .filter((u) => u.kind === 'champion')
      .sort((a, b) => Number(a.team === 'red') - Number(b.team === 'red') || a.id - b.id)
      .map((u) => {
        const state = this.world.championState(u.id)!;
        const observed =
          u.team === this.world.hero.team || this.world.visible(u, this.world.hero.team)
            ? state
            : state.observedStats[this.world.hero.team];
        return {
          id: u.id,
          name: u.name,
          champion: u.champion!,
          dead: !this.world.alive(u),
          respawnSeconds:
            !this.world.alive(u) && u.respawnTick !== null
              ? Math.max(0, Math.ceil((u.respawnTick - this.world.tick) / TICK_RATE))
              : null,
          level: observed?.level ?? null,
          team: u.team,
          kills: state.kills,
          deaths: state.deaths,
          assists: state.assists,
          cs: observed?.cs ?? null,
          inventory: observed?.inventory ?? null,
          summoners: state.summoners,
          role: state.role,
          intent: alliedChampionIntent(this.world, u),
        };
      });
    const signature = JSON.stringify({
      rows,
      playerSpellIcons: (['d', 'f'] as const).map((a) => this.world.abilitySpec(a).icon),
    });
    if (signature === this.lastScoreboard) return;
    this.lastScoreboard = signature;
    const focusedItem = this.itemTooltip.focusKey();
    panel.querySelector('.scoreboard-teams')!.innerHTML =
      '<section class="scoreboard-team" data-team="blue" aria-label="Blue team"><h2>BLUE TEAM</h2></section><section class="scoreboard-team" data-team="red" aria-label="Red team"><h2>RED TEAM</h2></section>';
    for (const data of rows) {
      const row = document.createElement('div');
      row.className = `scoreboard-row${data.team === 'red' ? ' enemy' : ''}`;
      row.dataset.champion = String(data.id);
      row.classList.toggle('dead', data.dead);
      row.innerHTML =
        '<span class="scoreboard-portrait" role="img"><img><span class="scoreboard-death-timer" aria-hidden="true"></span><span class="scoreboard-level"></span></span><span class="scoreboard-summoners" role="group" aria-label="Summoner spells"></span><strong></strong><span class="scoreboard-kda"></span><span class="scoreboard-cs"></span><span class="scoreboard-items"></span>';
      const level = row.querySelector('.scoreboard-level')!;
      level.textContent = data.level === null ? '?' : String(data.level);
      level.setAttribute(
        'aria-label',
        data.level === null ? 'Level unknown' : `Level ${data.level}`
      );
      const portrait = row.querySelector('img')!;
      portrait.src = `assets/icons/${data.champion}.png`;
      portrait.alt = championProfile(data.champion).name;
      const deathTimer = row.querySelector<HTMLElement>('.scoreboard-death-timer')!;
      deathTimer.hidden = !data.dead;
      deathTimer.textContent = data.respawnSeconds === null ? '†' : String(data.respawnSeconds);
      const identity = `${portrait.alt}, ${data.level === null ? 'level unknown' : `level ${data.level}`}`;
      row
        .querySelector('.scoreboard-portrait')!
        .setAttribute(
          'aria-label',
          data.dead
            ? `${identity}, dead${data.respawnSeconds === null ? '' : `, respawns in ${data.respawnSeconds} seconds`}`
            : identity
        );

      const summoners = row.querySelector('.scoreboard-summoners')!;
      // Identities are public; enemy cooldown state is not exposed here.
      for (const ability of ['d', 'f'] as const) {
        const spell =
          data.id === this.world.player.id
            ? this.world.abilitySpec(ability, data.id)
            : SUMMONERS[data.summoners[ability]];
        const icon = document.createElement('img');
        icon.src = `assets/icons/${spell.icon}.png`;
        icon.alt = spell.name;
        icon.title = spell.name;
        summoners.append(icon);
      }
      const name = row.querySelector('strong')!;
      name.textContent = data.name;
      name.title = data.name;
      const role = document.createElement('small');
      role.textContent = [
        data.id === this.world.player.id ? 'You' : data.team === 'blue' ? 'Ally' : 'Opponent',
        data.role ? ROLE_LABELS[data.role] : null,
      ]
        .filter(Boolean)
        .join(' · ');
      name.append(role);
      if (data.intent) {
        const intent = document.createElement('span');
        intent.className = 'scoreboard-intent';
        intent.textContent = data.intent;
        intent.title = data.intent;
        intent.setAttribute('aria-label', `Team intent: ${data.intent}`);
        name.append(intent);
      }
      row.dataset.role = data.role ?? '';
      row.querySelector('.scoreboard-kda')!.textContent =
        `${data.kills} / ${data.deaths} / ${data.assists}`;
      row.querySelector('.scoreboard-cs')!.textContent =
        `${data.cs === null ? '?' : Math.floor(data.cs)} CS`;
      const inventory = row.querySelector('.scoreboard-items')!;
      const slotCount = Math.max(6, data.inventory?.length ?? 6);
      inventory.classList.toggle('seven-slots', slotCount === 7);
      inventory.setAttribute('role', 'group');
      inventory.setAttribute('aria-label', data.inventory === null ? 'Inventory unknown' : 'Items');
      for (let slot = 0; slot < slotCount; slot++) {
        const cell = document.createElement('span');
        cell.className = 'scoreboard-item';
        const item = ITEMS.find((item) => item.id === data.inventory?.[slot]);
        cell.title =
          item?.name ??
          (data.inventory === null ? 'Inventory unknown' : `Empty item slot ${slot + 1}`);
        if (item) {
          cell.removeAttribute('title');
          cell.tabIndex = 0;
          cell.dataset.scoreboardItem = item.id;
          cell.dataset.itemKey = `${data.id}:${slot}`;
          const image = document.createElement('img');
          image.src = `assets/icons/${item.icon}.png`;
          image.alt = item.name;
          cell.append(image);
        } else {
          cell.setAttribute('aria-label', cell.title);
          if (data.inventory === null) cell.textContent = '?';
        }
        inventory.append(cell);
      }
      panel.querySelector(`[data-team="${data.team}"]`)!.append(row);
    }
    this.itemTooltip.refresh(focusedItem);
  }

  update(fps: number | null): void {
    if (!this.replaying && this.world.winner && this.modal !== 'result') this.toggleModal('result');
    this.updateAllyCameras();
    this.attackStatTooltip.refresh(this.modal === null);
    this.floating.hidden = !!this.world.winner;
    const w = this.world,
      p = w.player,
      h = w.hero;
    const trinket = this.root.querySelector<HTMLButtonElement>('#trinket')!;
    const kind = p.trinket.kind,
      definition = TRINKETS[kind];
    if (trinket.dataset.kind !== kind) {
      trinket.dataset.kind = kind;
      const icon = trinket.querySelector('img')!;
      icon.src = `assets/icons/${definition.icon}.png`;
      icon.alt = definition.name;
    }
    const charges = p.trinket.charges;
    const cooldown = Math.max(0, p.trinket.cooldownTick - w.tick);
    const recharge =
      p.trinket.rechargeEndTick === null ? 0 : Math.max(0, p.trinket.rechargeEndTick - w.tick);
    const placed = w.units.filter(
      (u) =>
        u.kind === 'ward' &&
        u.ward!.ownerId === h.id &&
        (u.ward!.variant ?? 'stealth') === 'stealth' &&
        w.alive(u)
    ).length;
    const maxPlaced = maxStealthWardsForQuest(p.roleQuest);
    const maxCharges =
      kind === 'ward' ? WARD_SOURCE.maxCharges : kind === 'farsight' ? 1 : ORACLE_SOURCE.maxCharges;
    trinket.querySelector('.trinket-charges')!.textContent = String(charges);
    trinket.querySelector('.trinket-cooldown')!.textContent =
      cooldown > 0
        ? String(Math.ceil(cooldown / 60))
        : charges === 0
          ? String(Math.ceil(recharge / 60))
          : '';
    trinket.classList.toggle('empty', charges === 0);
    const scanLeft = Math.max(0, (p.trinket.scan?.endTick ?? 0) - w.tick);
    trinket.classList.toggle('active', scanLeft > 0);
    trinket.setAttribute(
      'aria-label',
      `${definition.name}: ${charges}/${maxCharges} charges${kind === 'ward' ? `, ${placed}/${maxPlaced} placed` : scanLeft > 0 ? `, scan active ${Math.ceil(scanLeft / 60)} seconds` : ''}`
    );
    trinket.title =
      kind === 'ward'
        ? `Stealth Ward (4) · ${charges}/${WARD_SOURCE.maxCharges} charges · ${placed}/${maxPlaced} placed. Hold 4 and release over the battlefield, or click and choose a location. Grants ${WARD_SOURCE.sightRadius} sight; up to ${maxPlaced} wards. Next charge: ${Math.ceil(recharge / 60)}s.`
        : kind === 'farsight'
          ? `Farsight Alteration (4) · ${charges}/1 charge. Hold 4 and release over the battlefield or minimap up to ${FARSIGHT_POLICY.range} units away to reveal the target area and leave an untargetable visible Farsight Ward (${FARSIGHT_POLICY.sightRadius} sight). Next charge: ${Math.ceil(recharge / 60)}s.`
          : `Oracle Lens (4) · ${charges}/${ORACLE_SOURCE.maxCharges} charges. Press 4 or click to scan for ${ORACLE_SOURCE.durationSeconds}s. Reveals and disables enemy wards; warns of hidden champions without granting sight. ${scanLeft > 0 ? `Scan active: ${Math.ceil(scanLeft / 60)}s. ` : ''}Next charge: ${Math.ceil(recharge / 60)}s.`;
    // Seek the announcement with match time so loading, pause and time jumps
    // cannot advance or replay its presentation independently of the simulation.
    const welcomeTick = Math.min(w.tick, 8 * TICK_RATE);
    if (welcomeTick !== this.lastWelcomeTick) {
      this.lastWelcomeTick = welcomeTick;
      this.root.style.setProperty('--welcome-age', `${-welcomeTick / TICK_RATE}s`);
    }
    if (!this.tip.hidden && this.tip.dataset.tooltipAbility) {
      if (
        this.tip.dataset.tooltipRank !==
          String(w.abilityRank(this.tip.dataset.tooltipAbility as Ability)) ||
        this.tip.dataset.tooltipResources !==
          JSON.stringify(this.tooltipResources(this.tip.dataset.tooltipAbility as Ability))
      )
        this.refreshTooltip();
      const description = this.abilityDescription(this.tip.dataset.tooltipAbility as Ability);
      const instruction = this.tip.querySelector('small')!;
      const nextInstruction = this.tooltipInstruction(this.tip.dataset.tooltipAbility as Ability);
      if (instruction.textContent !== nextInstruction) {
        instruction.textContent = nextInstruction;
        this.positionTooltip();
      }
      const paragraph = this.tip.querySelector('p')!;
      if (paragraph.textContent !== description) {
        paragraph.textContent = description;
        this.positionTooltip();
      }
    }
    const text = (id: string, value: string | number) => {
      const element = this.root.querySelector(`#${id}`)!;
      const v = String(value);
      if (element.textContent !== v) element.textContent = v;
    };
    const width = (id: string, value: number) =>
      ((this.root.querySelector(`#${id}`) as HTMLElement).style.width =
        `${Math.max(0, value) * 100}%`);
    this.updateResourceMeter('health-text', Math.ceil(h.hp), Math.ceil(h.maxHp));
    this.updateResourceMeter('mana-text', Math.floor(h.mana), Math.floor(h.maxMana));
    const blueBuff = p.blueBuff && p.blueBuff.endTick > w.tick ? p.blueBuff : null;
    const redBuff = redBuffActive(p, w.tick) ? p.redBuff : null;
    const baronEnd = w.handOfBaronEndTick(h);
    const baronBuff = this.root.querySelector<HTMLElement>('#baron-buff')!;
    baronBuff.hidden = baronEnd === null;
    if (baronEnd !== null) {
      const time = this.objectiveTimeLeft(baronEnd);
      text('baron-buff-time', time);
      const bonus = Math.round((RIFT_BARON.handStructureMultiplier - 1) * 100);
      const description = `Hand of Baron: nearby allied minions deal ${bonus}% more damage to structures. ${time} remaining. Lost on death.`;
      if (baronBuff.title !== description) {
        baronBuff.title = description;
        baronBuff.setAttribute('aria-label', description);
      }
    }
    const elderActive =
      w.riftObjectives?.dragon.elderBuff &&
      w.riftObjectives.dragon.elderBuff.team === h.team &&
      w.riftObjectives.dragon.elderBuff.endTick > w.tick &&
      w.riftObjectives.dragon.elderBuff.holders.includes(h.id)
        ? w.riftObjectives.dragon.elderBuff
        : null;
    const elderBuff = this.root.querySelector<HTMLElement>('#elder-buff')!;
    elderBuff.hidden = !elderActive;
    if (elderActive) {
      const time = this.objectiveTimeLeft(elderActive.endTick);
      text('elder-buff-time', time);
      const description = `Aspect of the Dragon: attacks and abilities burn enemies and execute enemy champions below ${Math.round(EPIC_OBJECTIVE_TIMING.elderExecuteThreshold * 100)}% HP. ${time} remaining.`;
      if (elderBuff.title !== description) {
        elderBuff.title = description;
        elderBuff.setAttribute('aria-label', description);
      }
    }
    this.root.querySelector<HTMLElement>('#champion-buffs')!.hidden =
      !blueBuff && !redBuff && baronEnd === null && !elderActive;
    this.root.querySelector<HTMLElement>('#blue-buff')!.hidden = !blueBuff;
    this.root.querySelector<HTMLElement>('#red-buff')!.hidden = !redBuff;
    if (blueBuff) {
      const seconds = Math.ceil((blueBuff.endTick - w.tick) / TICK_RATE);
      text(
        'blue-buff-time',
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      );
      width('blue-buff-fill', (blueBuff.endTick - w.tick) / BLUE_BUFF_DURATION_TICKS);
      const buff = this.root.querySelector<HTMLElement>('#blue-buff')!;
      const description = `Crest of Insight: +${blueBuffHaste(p, w.tick)} Ability Haste${h.maxMana ? `, +${blueBuffManaPerSecond(h.maxMana).toFixed(1)} Mana per second` : ''}. ${seconds}s remaining. Transfers to your killer when slain.`;
      buff.title = description;
      buff.setAttribute('aria-label', description);
    }
    if (redBuff) {
      const seconds = Math.ceil((redBuff.endTick - w.tick) / TICK_RATE);
      text('red-buff-time', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
      width('red-buff-fill', (redBuff.endTick - w.tick) / RED_BUFF_DURATION_TICKS);
      const buff = this.root.querySelector<HTMLElement>('#red-buff')!;
      const healing =
        w.tick < p.redBuffHealReadyTick
          ? 'Healing paused after damage'
          : `+${redBuffHealingPerSecond(p, h.maxHp, w.tick).toFixed(1)} Health per second`;
      const description = `Crest of Cinders: attacks burn for ${(3 * cinderDamagePerTick(p.level)).toFixed(1)} true damage and slow by ${(100 * cinderSlow(p.level, isMeleeChampion(h.champion))).toFixed(1)}%. ${healing}. ${seconds}s remaining. Transfers to your killer when slain.`;
      buff.title = description;
      buff.setAttribute('aria-label', description);
    }
    text(
      'health-regen',
      `+${(championProfile(h.champion!).healthRegen + championProfile(h.champion!).healthRegenGrowth * growthAtLevel(p.level) + w.perseveranceRegenPerSecond(h) + (w.alive(h) ? redBuffHealingPerSecond(p, h.maxHp, w.tick) : 0)).toFixed(1)}`
    );
    width('health-fill', h.hp / h.maxHp);
    width('mana-fill', h.maxMana ? h.mana / h.maxMana : 0);
    if (h.champion === 'garen') {
      const readyIn = Math.max(0, p.garenPassiveReadyTick - w.tick);
      const passive = !w.alive(h)
        ? 'DEFEATED'
        : readyIn
          ? `PERSEVERANCE IN ${Math.ceil(readyIn / TICK_RATE)}s`
          : 'PERSEVERANCE READY';
      const courage = p.spellRanks.w
        ? `COURAGE ${p.garenCourageStacks}/${Math.ceil(GAREN_W.maxResistGain / GAREN_W.resistGainPerStack)}`
        : 'COURAGE UNLEARNED';
      text('garen-passive', `${passive} · ${courage}`);
    }
    const maxHeroLevel = maxChampionLevelForQuest(p.roleQuest);
    width('xp-fill', p.level >= maxHeroLevel ? 1 : p.xp / experienceToNextLevel(p.level));
    text('level', p.level);
    this.updateGold();
    const shopBalance = this.modal === 'shop' ? this.root.querySelector('.shop-balance b') : null;
    if (shopBalance) {
      this.updateShopPurchases();
      this.updateShopOwnedItems();
    }
    const balanceLabel = `◆ ${Math.floor(p.gold)}`;
    if (shopBalance && shopBalance.textContent !== balanceLabel)
      shopBalance.textContent = balanceLabel;
    text('ad', Math.round(h.damage));
    text('armor', Math.round(w.effectiveArmor(h)));
    text('mr', Math.round(w.effectiveMagicResist(h)));
    text('ap', Math.round(w.abilityPower()));
    text('ms', Math.round(statPrecision(w.movementSpeed(h))));
    text('as', ((60 / h.attackPeriod) * w.attackSpeedMultiplier(h, undefined)).toFixed(2));
    const champions = w.units.filter((u) => u.kind === 'champion');
    for (const team of ['blue', 'red'] as const)
      text(
        team === 'blue' ? 'kills' : 'deaths',
        champions.reduce((sum, u) => sum + (u.team === team ? w.championState(u.id)!.kills : 0), 0)
      );
    if (this.root.querySelector<HTMLElement>('.scoreboard')?.hidden === false)
      this.scoreboard(true);
    text('personal', `${p.kills} / ${p.deaths} / ${p.assists}`);
    text('cs', Math.floor(p.cs));
    this.root
      .querySelectorAll<HTMLElement>('.focus-pips i')
      .forEach((pip, i) => pip.classList.toggle('charged', i < p.qStacks));
    const yiCounter = this.root.querySelector<HTMLElement>('#masteryi-double-strike');
    if (yiCounter) {
      const stacks = p.doubleStrike?.stacks ?? 0;
      yiCounter.querySelector('b')!.textContent = `${stacks} / 3`;
      yiCounter.classList.toggle('ready', stacks === 3);
      yiCounter.setAttribute(
        'aria-label',
        stacks === 3 ? 'Double Strike ready' : `Double Strike, ${stacks} of 3 stacks`
      );
      yiCounter.title = masterYiPassiveDescription(stacks);
    }
    const ahriRush = h.champion === 'ahri' ? activeSpiritRush(w, h.id) : undefined;
    const essence = this.root.querySelector<HTMLElement>('#ahri-essence');
    if (essence) {
      const stacks = w.ahriCounters.find((c) => c.sourceId === h.id)?.stacks ?? 0;
      essence.textContent = `${stacks} / 9`;
      essence.setAttribute('aria-label', `Essence Theft, ${stacks} of 9 kills`);
      essence.title = ahriPassiveDescription(p.level, w.abilityPower());
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach((button) => {
      const a = button.dataset.ability as Ability,
        spinning = this.isGarenRecast(a),
        lock = spinning ? garenRecastLockTicks(w) : 0,
        recast =
          this.isLuxRecast(a) ||
          (spinning && lock === 0) ||
          (a === 'r' &&
            !!ahriRush &&
            ahriRush.remainingCasts > 0 &&
            w.abilityCooldownTicks(a) === 0),
        cd = spinning ? lock / TICK_RATE : recast ? 0 : w.abilityCooldownTicks(a) / TICK_RATE;
      button.querySelector('.cooldown-text')!.textContent = recast
        ? 'RECAST'
        : cd > 0
          ? String(Math.ceil(cd))
          : '';
      button.classList.toggle('recasting', recast);
      button.classList.toggle('cooling', cd > 0);
      const resources = recast ? { mana: 0 } : w.abilityResources(a);
      if (w.summonerSpell(a) === 'smite') {
        const spec = w.abilitySpec(a),
          img = button.querySelector('img')!,
          src = `assets/icons/${spec.icon}.png`;
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      }
      button.querySelector('.ability-cost')!.textContent = resources.mana
        ? String(resources.mana)
        : '';
      button.classList.toggle('insufficient', !w.abilityRank(a) || h.mana < resources.mana);
      button.classList.toggle(
        'empowered',
        recast ||
          (a === 'q' && p.qUntil > w.tick) ||
          (h.champion === 'leona' &&
            ((a === 'q' && !!p.leonaQ && w.tick < p.leonaQ.endTick) ||
              (a === 'w' && !!p.leonaW && w.tick < p.leonaW.endTick) ||
              (a === 'e' && (!!p.leonaEWindup || !!p.leonaDash)) ||
              (a === 'r' && !!p.leonaR))) ||
          (h.champion === 'masteryi' &&
            ((a === 'q' && !!p.alphaStrike) ||
              (a === 'w' && p.meditate?.stopTick === null) ||
              (a === 'e' && !!p.wujuStyle && w.tick < p.wujuStyle.endTick) ||
              (a === 'r' && !!p.highlander && w.tick < p.highlander.endTick))) ||
          (h.champion === 'garen' &&
            ((a === 'q' && !!p.garenQ && !p.garenQ.consumed && w.tick < p.garenQ.attackUntil) ||
              (a === 'w' && !!p.garenW && w.tick < p.garenW.defenseUntil) ||
              spinning))
      );
      if (h.champion === 'lux' && a === 'e')
        button.setAttribute(
          'aria-label',
          recast ? 'Detonate Lucent Singularity' : 'Lucent Singularity'
        );
      if (h.champion === 'garen' && a === 'e')
        button.setAttribute(
          'aria-label',
          spinning
            ? lock
              ? `Judgment, spinning, recast in ${Math.ceil(lock / TICK_RATE)} seconds`
              : 'End Judgment'
            : 'Judgment'
        );
      if (w.summonerSpell(a) === 'smite' && p.smite) {
        const remaining = Math.max(0, (p.smite.rechargeTick ?? w.tick) - w.tick) / TICK_RATE;
        button.querySelector('.ability-charges')!.textContent = String(p.smite.charges);
        const recharge = button.querySelector<HTMLElement>('.ability-recharge')!;
        recharge.hidden = p.smite.rechargeTick === null;
        recharge.querySelector<HTMLElement>('i')!.style.transform =
          `scaleX(${Math.max(0, Math.min(1, 1 - remaining / SUMMONER_SMITE.rechargeSeconds))})`;
        button.setAttribute(
          'aria-label',
          `${w.abilitySpec(a).name}, ${p.smite.charges} charges${remaining > 0 ? `, next charge in ${Math.ceil(remaining)} seconds` : ''}`
        );
      }
      if (a === 'r' && h.champion === 'ahri') {
        const charges = ahriRush?.remainingCasts ?? (p.spellRanks.r ? AHRI_R.maxCasts : 0),
          remaining = ahriRush ? Math.max(0, ahriRush.endTick - w.tick) / TICK_RATE : 0;
        button.querySelector('.ability-charges')!.textContent = String(charges);
        const windowMeter = button.querySelector<HTMLElement>('.ability-recharge')!;
        windowMeter.hidden = !ahriRush;
        windowMeter.querySelector<HTMLElement>('i')!.style.transform =
          `scaleX(${Math.min(1, remaining / AHRI_R.recastWindowSeconds)})`;
        button.setAttribute(
          'aria-label',
          ahriRush
            ? `Spirit Rush, ${charges} of 3 casts, ${Math.ceil(remaining)} seconds to recast`
            : `Spirit Rush, ${charges} casts when ready${cd > 0 ? `, ${Math.ceil(cd)} seconds cooldown` : ''}`
        );
      }
      if (a === 'e' && h.champion === 'ashe') {
        const remaining = Math.max(0, (p.eRechargeTick ?? w.tick) - w.tick) / TICK_RATE;
        button.querySelector('.ability-charges')!.textContent = String(p.eCharges);
        const recharge = button.querySelector<HTMLElement>('.ability-recharge')!;
        recharge.hidden = p.eRechargeTick === null;
        recharge.querySelector<HTMLElement>('i')!.style.transform =
          `scaleX(${Math.max(0, Math.min(1, 1 - remaining / (p.eRechargeDurationTicks / TICK_RATE)))})`;
        button.setAttribute(
          'aria-label',
          `Hawkshot, ${p.eCharges} of ${ASHE_E.maximumCharges} charges${p.eRechargeTick === null ? '' : `, next charge in ${Math.ceil(remaining)} seconds`}`
        );
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-learn]').forEach((button) => {
      const ability = button.dataset.learn as 'q' | 'w' | 'e' | 'r';
      button.hidden = w.spellLearningError(ability) !== null;
      button.title = `Upgrade ${ability.toUpperCase()} (Ctrl+${ability.toUpperCase()}) · ${p.skillPoints} skill points`;
      button
        .parentElement!.querySelectorAll('.spell-ranks i')
        .forEach((pip, index) => pip.classList.toggle('learned', index < p.spellRanks[ability]));
    });
    this.updateCameraButton();
    let companionStatus = this.root.querySelector<HTMLElement>('#companion-status');
    const companion = ownedCompanion(w, p.id);
    if (companion && !companionStatus) {
      companionStatus = document.createElement('div');
      companionStatus.id = 'companion-status';
      companionStatus.className = 'companion-status';
      this.root.append(companionStatus);
    }
    if (companionStatus) {
      companionStatus.hidden = !companion;
      if (companion) {
        const passive = companion.passive;
        const effect =
          passive?.kind === 'gustwalker'
            ? ` · Move speed +${Math.round(companionMovementBonus(w, h) * 100)}%`
            : passive?.kind === 'scorchclaw'
              ? ` · Ember ${passive.stacks}/100`
              : passive?.kind === 'mosstomper'
                ? ` · Shield ${Math.ceil(h.shields.filter((s) => s.companionGrantTick !== undefined).reduce((n, s) => n + s.amount, 0))}${passive.rechargeTick !== null ? ` · refresh ${Math.ceil(Math.max(0, passive.rechargeTick - w.tick) / 60)}s` : ''}`
                : '';
        companionStatus.textContent = `${COMPANION_SOURCE.profiles[companion.kind].name} · ${companion.fed}/35 treats · ${companion.bonusTreats} bonus · Smite ${companionSmiteDamage(companion.fed)}${effect}`;
      }
    }
    let roleQuestStatus = this.root.querySelector<HTMLElement>('#role-quest-status');
    if (p.roleQuest && !roleQuestStatus) {
      roleQuestStatus = document.createElement('div');
      roleQuestStatus.id = 'role-quest-status';
      roleQuestStatus.className = 'role-quest-status';
      this.root.append(roleQuestStatus);
    }
    if (roleQuestStatus) {
      roleQuestStatus.hidden = !p.roleQuest;
      if (p.roleQuest) {
        const meta = ROLE_QUESTS[p.roleQuest.role];
        const done = isRoleQuestComplete(p.roleQuest);
        roleQuestStatus.classList.toggle('completed', done);
        const runeTag = p.runeState ? ` · ${KEYSTONES[p.runeState.loadout.keystone].name}` : '';
        const textValue = done
          ? `✓ ${meta.name}: ${meta.rewardName}${runeTag}`
          : `${meta.name}: ${Math.floor(p.roleQuest.progress)} / ${p.roleQuest.target} ${meta.unitLabel}${runeTag}`;
        if (roleQuestStatus.textContent !== textValue) roleQuestStatus.textContent = textValue;
        roleQuestStatus.title = `${meta.summary} → ${meta.rewardSummary}`;
      }
    }
    const recall = this.root.querySelector<HTMLDivElement>('.recall-progress')!;
    recall.hidden = p.recallEnd === null;
    if (p.recallEnd !== null)
      (recall.querySelector('i') as HTMLElement).style.width =
        `${(1 - (p.recallEnd - w.tick) / 480) * 100}%`;
    this.root.querySelector<HTMLElement>('.death-overlay')!.hidden = h.hp > 0;
    if (h.respawnTick)
      text('respawn-count', `Respawning in ${Math.ceil((h.respawnTick - w.tick) / 60)}`);
    const target = this.view.selected === null ? undefined : w.unit(this.view.selected);
    const panel = this.root.querySelector<HTMLElement>('#target-panel')!;
    panel.hidden = !target || target.id === p.id || !w.visible(target) || !w.alive(target);
    if (target && !panel.hidden) {
      text('target-name', target.name);
      text(
        'target-hp',
        `${Math.ceil(target.hp)} / ${Math.ceil(target.maxHp)}${w.vulnerable(target) ? '' : ' · Protected'}${w.baronEmpoweredMinion(target) ? ' · Baron-empowered' : ''}`
      );
      (panel.querySelector('.target-health i') as HTMLElement).style.width =
        `${(target.hp / target.maxHp) * 100}%`;
    }
    const maxSlots = maxInventorySlotsForQuest(p.roleQuest);
    this.root.querySelector('.inventory-panel')?.classList.toggle('seven-slots', maxSlots === 7);
    const activeCdSignature = p.inventory
      .map((id, idx) => {
        if (!id) return '';
        const st = p.itemState?.slotStacks[idx] ?? 1;
        const cdReady = p.itemState?.activeCooldowns[id] ?? 0;
        const cdSec = cdReady > w.tick ? Math.ceil((cdReady - w.tick) / TICK_RATE) : 0;
        return `${id}:${st}:${cdSec}`;
      })
      .join('|');
    const invKey = `${maxSlots}::${p.inventory.join(',')}::${activeCdSignature}`;
    if (this.lastInventory !== invKey) {
      this.lastInventory = invKey;
      const slotKeys = [1, 2, 3, 5, 6, 7, 8];
      this.root.querySelector('#inventory')!.innerHTML = Array.from(
        { length: maxSlots },
        (_, i) => {
          const item = ITEMS.find((item) => item.id === p.inventory[i]);
          const exp = item ? getExpandedItem(item.id) : undefined;
          const stacks = item ? (p.itemState?.slotStacks[i] ?? 1) : 1;
          const cdReady = item ? (p.itemState?.activeCooldowns[item.id] ?? 0) : 0;
          const cdSec = cdReady > w.tick ? Math.ceil((cdReady - w.tick) / TICK_RATE) : 0;
          const activeReady = !!exp?.active && cdSec === 0;
          const title = item
            ? `${item.name}${stacks > 1 ? ` ×${stacks}` : ''}${exp?.active ? ` · Press ${slotKeys[i]} to activate ${exp.active.name}` : ''} · Drag to move`
            : 'Empty item slot';
          return `<div class="item-slot${activeReady ? ' active-ready' : ''}" data-inventory-slot="${i}" draggable="${!!item}" title="${title}">${item ? `<img draggable="false" src="assets/icons/${item.icon}.png" alt="${item.name}">` : ''}${stacks > 1 ? `<b class="item-stack">×${stacks}</b>` : ''}${cdSec > 0 ? `<time class="item-cooldown">${cdSec}</time>` : ''}<span>${slotKeys[i]}</span></div>`;
        }
      ).join('');
    }
    if (Math.floor(w.time) !== this.lastSecond) {
      this.lastSecond = Math.floor(w.time);
      text(
        'clock',
        `${String(Math.floor(w.time / 60)).padStart(2, '0')}:${String(Math.floor(w.time) % 60).padStart(2, '0')}`
      );
    }
    text('fps', fps === null ? '— FPS' : `${Math.round(fps)} FPS`);
    if (performance.now() > this.toastUntil)
      this.root.querySelector('#toast')!.classList.remove('visible');
    for (const event of w.events)
      if (event.id > this.lastEventId) {
        this.lastEventId = event.id;
        if (!w.eventVisible(event)) continue;
        if (event.type === 'message' && isPlayerFeedback(event, p.id)) this.toast(event.text ?? '');
        if (['damage', 'gold', 'heal', 'level'].includes(event.type)) {
          const screen = this.view.screenPoint(event, 1.6);
          const element = document.createElement('span');
          element.className = `combat-text ${event.type}`;
          element.textContent =
            event.type === 'gold'
              ? `+${event.value}g`
              : event.type === 'heal'
                ? `+${Math.round(event.value ?? 0)}`
                : event.type === 'level'
                  ? 'LEVEL UP!'
                  : String(event.value);
          element.style.left = `${screen.x}px`;
          element.style.top = `${screen.y}px`;
          this.floating.append(element);
          element.addEventListener('animationend', () => element.remove(), { once: true });
        }
      }
    this.drawMinimap();
  }
  private drawMinimap(): void {
    const ctx = this.mini.getContext('2d')!,
      n = this.mini.width,
      w = this.world;
    ctx.drawImage(this.view.mapTexture.image as HTMLCanvasElement, 0, 0, n, n);
    ctx.fillStyle = 'rgba(4,16,18,.38)';
    ctx.fillRect(0, 0, n, n);
    ctx.drawImage(this.view.fogCanvas, 0, 0, n, n);
    const xy = (p: { x: number; y: number }) => ({
      x: (p.x / (this.world.battlefield.half * 2) + 0.5) * n,
      y: (p.y / (this.world.battlefield.half * 2) + 0.5) * n,
    });
    for (const shrine of w.scuttlers?.shrines ?? []) {
      const point = shrinePoint(shrine.river, w.battlefield);
      if (shrine.endTick <= w.tick || !w.pointVisible(point)) continue;
      const p = xy(point);
      ctx.strokeStyle = shrine.team === w.hero.team ? '#6ed6d4' : '#e89575';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (w.battlefield.publicRift && w.matchMode === 'lanes') {
      const transformed = isElementalRiftTransformed(w);
      for (const ring of FAELIGHT_NODES) {
        if (ring.elementalOnly && !transformed) continue;
        if (!w.pointVisible(ring, w.hero.team)) continue;
        const rp = xy(ring);
        ctx.strokeStyle = 'rgba(110, 243, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const u of w.units) {
      const knownDestroyed = w.knownStructureDestroyed(u);
      if (knownDestroyed === true || (knownDestroyed === null && (!w.alive(u) || !w.visible(u))))
        continue;
      const isEpicMonster =
        u.kind === 'monster' &&
        (u.monster.species === 'baron' ||
          u.monster.species === 'elder-dragon' ||
          u.monster.species.startsWith('dragon-') ||
          u.monster.species === 'riftherald' ||
          u.monster.species === 'voidgrub');
      const p = xy(u),
        r =
          u.kind === 'champion'
            ? 5
            : isStructureKind(u.kind)
              ? 4
              : isEpicMonster
                ? 4
                : u.kind === 'ward'
                  ? 3
                  : 1.5;
      ctx.fillStyle =
        u.id === w.player.id
          ? '#f4dc88'
          : isEpicMonster
            ? u.monster!.species.startsWith('dragon-') || u.monster!.species === 'elder-dragon'
              ? '#ff9d3b'
              : '#c37aff'
            : u.team === 'neutral'
              ? '#dfba6a'
              : u.team === 'blue'
                ? '#60d1e5'
                : '#ee7b81';
      ctx.strokeStyle = '#102228';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (u.kind === 'ward') {
        const variant = u.ward?.variant ?? 'stealth';
        ctx.fillStyle =
          u.team === 'blue'
            ? variant === 'farsight'
              ? '#66c9ff'
              : variant === 'control'
                ? '#ff75a0'
                : '#aed986'
            : '#ee7b81';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#18332b';
        ctx.fill();
        continue;
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(231,240,225,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [i, corner] of [
      [0, 0],
      [this.view.width, 0],
      [this.view.width, this.view.height],
      [0, this.view.height],
    ].entries()) {
      const p = this.view.worldPoint(corner[0], corner[1]);
      if (!p) continue;
      const q = xy(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
