import { ABILITIES, ITEMS, TICK_RATE } from '../content/rules';
import { ASHE } from '../content/ashe-progression';
import { ASHE_E } from '../content/ashe-e';
import {
  experienceToNextLevel,
  growthAtLevel,
  MAX_LEVEL,
  statPrecision,
} from '../simulation/progression';
import { isStructureKind, type Ability } from '../simulation/types';
import type { World } from '../simulation/world';
import type { GameView } from '../render/view';

export interface HudActions {
  pause: (value: boolean) => void;
  reset: () => void;
  save: () => Promise<void>;
  sound: (enabled: boolean) => void;
}
export class Hud {
  root: HTMLDivElement;
  modal: string | null = null;
  paused = false;
  graphicsState: 'lost' | 'restoring' | 'failed' | null = null;
  sound = true;
  private mini: HTMLCanvasElement;
  private tip: HTMLDivElement;
  private floating: HTMLDivElement;
  private lastEventId = 0;
  private lastSecond = -1;
  private lastWelcomeTick = -1;
  private lastInventory = '';
  private toastUntil = 0;
  constructor(
    host: HTMLElement,
    private world: World,
    private view: GameView,
    private actions: HudActions
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="match-identity"><span class="rift-emblem">◈</span><div><strong>SUMMONER’S RIFT</strong><span>PRACTICE TOOL <i>•</i> LOCAL MATCH</span></div></div>
      <div class="match-top"><span class="team-score"><b class="blue-number" id="kills">0</b><i>⚔</i><b class="red-number" id="deaths">0</b></span><span class="personal-score" id="personal">0 / 0 / 0</span><span title="Creep score"><i class="gold-symbol">♜</i> <b id="cs">0</b></span><time id="clock">00:00</time><button class="icon-button" id="pause-button" title="Pause (Esc)" aria-label="Pause game">Ⅱ</button></div>
      <div class="welcome"><span>THE RIFT AWAITS</span><h1>Welcome to Summoner’s Rift</h1><div class="ornament">━━━━ ◈ ━━━━</div></div>
      <div id="toast" role="status" aria-live="polite"></div>
      <div class="target-panel" id="target-panel" hidden><span class="target-label">SELECTED TARGET</span><strong id="target-name"></strong><div class="target-health"><i></i></div><span id="target-hp"></span></div>
      <div class="practice-corner"><button class="quiet-button" id="practice-button">◇ <span>Practice tools</span></button><button class="quiet-button" id="help-button">? <span>Controls</span></button><small>REFERENCE BUILD 0.1</small></div>
      <section class="champion-hud" aria-label="Champion controls">
        <div class="champion-portrait"><img src="assets/icons/ashe.png" alt="Ashe"><span id="level">1</span><div class="portrait-frame"></div></div>
        <div class="champion-stats"><span title="Attack damage"><i>⚔</i><b id="ad">59</b></span><span title="Armor"><i>◈</i><b id="armor">26</b></span><span title="Attack speed"><i>⌁</i><b id="as">0.66</b></span><span title="Movement speed"><i>➤</i><b id="ms">325</b></span></div>
        <div class="champion-core"><div class="champion-title"><strong>ASHE</strong><span>THE FROST ARCHER</span><div class="focus-pips" aria-label="Focus stacks"><i></i><i></i><i></i><i></i></div></div>
          <div class="ability-row">${(['q', 'w', 'e', 'r'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}<div class="summoners">${(['d', 'f'] as Ability[]).map((a) => this.abilityMarkup(a)).join('')}</div></div>
          <div class="resource health"><i id="health-fill"></i><span id="health-text">610 / 610</span><small id="health-regen">+0.7</small></div>
          <div class="resource mana"><i id="mana-fill"></i><span id="mana-text">280 / 280</span></div>
          <div class="experience"><i id="xp-fill"></i></div>
        </div>
        <div class="inventory-panel"><div class="inventory-grid" id="inventory">${Array.from({ length: 6 }, (_, i) => `<div class="item-slot"><span>${i + 1}</span></div>`).join('')}</div><button id="shop-button" class="gold-button" title="Open shop (P)"><span>◆</span><b id="gold">500</b><kbd>P</kbd></button></div>
      </section>
      <div class="minimap-shell"><div class="map-controls"><button id="camera-button" aria-label="Toggle camera lock" title="Lock camera (Y)">▣</button><button id="sound-button" aria-label="Toggle sound" title="Toggle sound">♫</button><span id="fps">60 FPS</span></div><canvas id="minimap" width="256" height="256" aria-label="Minimap. Left-click to move the camera; right-click to move your champion."></canvas><span class="map-caption">SUMMONER’S RIFT</span></div>
      <div class="recall-progress" hidden><span>RECALLING</span><div><i></i></div><small>Taking damage or moving cancels recall</small></div>
      <div class="death-overlay" hidden><span>You have been slain</span><strong id="respawn-count"></strong></div>
      <div class="modal-backdrop" id="modal" hidden></div>
    `;
    host.append(this.root);
    this.tip = document.createElement('div');
    this.tip.className = 'tooltip';
    this.tip.hidden = true;
    this.root.append(this.tip);
    this.floating = document.createElement('div');
    this.floating.className = 'floating-layer';
    host.append(this.floating);
    this.mini = this.root.querySelector('#minimap')!;
    this.bind();
  }
  private abilityMarkup(a: Ability): string {
    return `<button class="ability ${a === 'd' || a === 'f' ? 'summoner' : ''}" data-ability="${a}" aria-label="${ABILITIES[a].name}"><img src="assets/icons/${ABILITIES[a].icon}.png" alt=""><span class="cooldown-shade"></span><span class="cooldown-text"></span><kbd>${a.toUpperCase()}</kbd><span class="ability-cost">${ABILITIES[a].cost || ''}</span>${a === 'e' ? '<span class="ability-charges" aria-hidden="true"></span><span class="ability-recharge" aria-hidden="true"><i></i></span>' : ''}</button>`;
  }
  private bind(): void {
    const on = (id: string, fn: () => void) =>
      this.root.querySelector(`#${id}`)!.addEventListener('click', fn);
    on('pause-button', () => this.toggleModal('pause'));
    on('shop-button', () => this.toggleModal('shop'));
    on('help-button', () => this.toggleModal('help'));
    on('practice-button', () => this.toggleModal('practice'));
    on('camera-button', () => this.toggleCamera());
    on('sound-button', () => {
      this.sound = !this.sound;
      this.actions.sound(this.sound);
      this.root.querySelector('#sound-button')!.classList.toggle('off', !this.sound);
    });
    this.mini.addEventListener('contextmenu', (e) => e.preventDefault());
    this.mini.addEventListener('pointerdown', (e) => {
      if (this.modal || this.paused) return;
      const point = this.minimapPoint(e.clientX, e.clientY);
      if (!point) return;
      if (e.button === 2)
        this.world.enqueue({
          type: 'order',
          unit: this.world.player.id,
          order: { type: 'move', point },
        });
      else {
        this.view.locked = false;
        this.view.center = point;
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach((button) => {
      const ability = button.dataset.ability as Ability;
      button.addEventListener('pointerenter', () => {
        const spec = ABILITIES[ability];
        this.tip.innerHTML = `<span class="tooltip-key">${ability.toUpperCase()}</span><strong>${spec.name}</strong><div class="tooltip-meta">${spec.cost} MANA <span>·</span> ${spec.cooldown}s COOLDOWN</div><p>${spec.description}</p><small>${['q', 'f'].includes(ability) ? 'Press to cast' : 'Hold the key to aim. Release to cast.'}</small>`;
        this.tip.hidden = false;
        const rect = button.getBoundingClientRect();
        this.tip.style.left = `${Math.min(rect.left, window.innerWidth - 330)}px`;
        this.tip.style.bottom = `${window.innerHeight - rect.top + 14}px`;
      });
      button.addEventListener('pointerleave', () => (this.tip.hidden = true));
      button.addEventListener('click', () => {
        if (this.paused || this.modal) return;
        if (ability === 'q' || ability === 'f')
          this.world.enqueue({
            type: 'cast',
            unit: this.world.player.id,
            ability,
            point: this.world.hero,
          });
        else this.toast(`Hold ${ability.toUpperCase()} to aim, then release to cast`);
      });
    });
  }
  toggleCamera(): void {
    this.view.locked = !this.view.locked;
    if (this.view.locked) this.view.recenter(this.world.hero);
  }
  setGraphicsState(state: Hud['graphicsState']): void {
    this.graphicsState = state;
    this.modal = null;
    this.toggleModal(state ? 'graphics' : this.world.winner ? 'result' : 'pause');
    this.focusModal();
  }
  focusModal(): void {
    this.root.querySelector<HTMLElement>('.game-dialog')?.focus();
  }
  toggleModal(which: string): void {
    if (this.graphicsState && which !== 'graphics') return;
    if (this.world.winner && which !== 'result' && which !== 'graphics') return;
    if (this.modal === which) {
      this.closeModal();
      return;
    }
    this.modal = which;
    this.tip.hidden = true;
    const backdrop = this.root.querySelector<HTMLDivElement>('#modal')!;
    backdrop.hidden = false;
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
            : 'Graphics could not be restored. Restart to try again.';
      content = `<p class="practice-note" role="status">${message}</p><button class="primary-button" data-action="reset">Restart match</button><p class="practice-note">Restarting starts a new match.</p>`;
    } else if (which === 'result') {
      title = this.world.winner === 'blue' ? 'Victory' : 'Defeat';
      subtitle =
        this.world.winner === 'blue' ? 'The enemy Nexus has fallen.' : 'Your Nexus has fallen.';
      content = '<button class="primary-button" data-action="reset">Play again</button>';
    } else if (which === 'pause') {
      title = 'Game paused';
      subtitle = 'A moment of clarity before the next move.';
      content =
        '<button class="primary-button" data-action="resume">Return to the Rift</button><button class="menu-button" data-action="save">Save match</button><button class="menu-button" data-action="help">Controls & keybindings</button><button class="menu-button" data-action="reset">Restart practice</button>';
    } else if (which === 'help') {
      title = 'Master the Rift';
      subtitle = 'Every movement begins with a decision.';
      const controls = [
        ['Right-click', 'Move / attack target'],
        ['A → click', 'Attack move'],
        ['S', 'Stop'],
        ['Q', 'Activate Focus at 4 stacks'],
        ['Hold W / E / R', 'Aim, then release to cast'],
        ['E / R over minimap', 'Aim across the map without moving the camera'],
        ['D / F', 'Flash / Heal'],
        ['B', 'Recall to fountain'],
        ['P', 'Open item shop'],
        ['Space / Y', 'Recenter / lock camera'],
        ['Shift', 'Show attack range'],
        ['Tab', 'Hold scoreboard'],
        ['Esc', 'Cancel aiming / pause'],
      ];
      content = `<div class="controls-list">${controls.map(([key, desc]) => `<kbd>${key}</kbd><span>${desc}</span>`).join('')}</div><button class="primary-button" data-action="resume">Return to the Rift</button>`;
    } else if (which === 'practice') {
      title = 'Practice tools';
      subtitle = 'Make room for the next perfect play.';
      content =
        '<div class="practice-grid"><button class="menu-button" data-action="restore">Restore health & mana</button><button class="menu-button" data-action="cooldowns">Reset cooldowns</button><button class="menu-button" data-action="gold">Add 1,000 gold</button><button class="menu-button" data-action="dummy">Restore target dummy</button></div><p class="practice-note">All four abilities are unlocked in this practice build. The champion kit, terrain, vision, items, and timing are still under development.</p><button class="primary-button" data-action="resume">Return to the Rift</button>';
    } else if (which === 'shop') {
      title = 'Item shop';
      subtitle = 'Prepare for the fight ahead.';
      content = `<div class="shop-balance">Available gold <b>◆ ${Math.floor(this.world.player.gold)}</b></div><div class="shop-items">${ITEMS.map((item) => `<button class="shop-item" data-buy="${item.id}"><img src="assets/icons/${item.icon}.png" alt=""><span><strong>${item.name}</strong><small>${item.description}</small></span><b>◆ ${item.price}</b></button>`).join('')}</div><p class="shop-message" role="status">Purchases are available at the blue fountain.</p>`;
    }
    if (which !== 'shop') this.actions.pause(true);
    backdrop.innerHTML = `<section class="game-dialog ${which}${which === 'result' ? (this.world.winner === 'blue' ? ' victory' : ' defeat') : ''}" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="dialog-title"><button class="close-button" aria-label="Close menu">×</button><span class="dialog-kicker">SUMMONER’S RIFT</span><h2 id="dialog-title">${title}</h2><p class="dialog-subtitle">${subtitle}</p><div class="dialog-rule">◈</div>${content}</section>`;
    if (which === 'result' || which === 'graphics')
      backdrop.querySelector<HTMLButtonElement>('.close-button')!.hidden = true;
    backdrop.querySelector('.close-button')!.addEventListener('click', () => this.closeModal());
    backdrop.onkeydown = (event) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        backdrop.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([hidden])')
      );
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next]?.focus();
    };
    backdrop.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) =>
      button.addEventListener('click', () => {
        const action = button.dataset.action;
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
        if (action === 'restore') {
          const h = this.world.hero;
          if (h.hp > 0) {
            h.hp = h.maxHp;
            h.mana = h.maxMana;
          }
          this.toast('Health and mana restored');
        }
        if (action === 'cooldowns') {
          for (const a of Object.keys(this.world.player.cooldowns) as Ability[])
            this.world.player.cooldowns[a] = 0;
          this.world.player.qStacks = 4;
          this.world.player.qStackExpiry = this.world.tick + 600;
          this.world.player.eCharges = ASHE_E.maximumCharges;
          this.world.player.eRechargeTick = null;
          this.toast('Abilities are ready');
        }
        if (action === 'gold') {
          this.world.player.gold += 1000;
          this.toast('Added 1,000 gold');
        }
        if (action === 'dummy') {
          for (const u of this.world.units)
            if (u.kind === 'dummy') {
              u.hp = u.maxHp;
              u.deadAt = null;
              u.respawnTick = null;
            }
          this.toast('Target dummy restored');
        }
      })
    );
    backdrop.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((button) =>
      button.addEventListener('click', () => {
        const result = this.world.buy(button.dataset.buy!);
        const message = backdrop.querySelector<HTMLElement>('.shop-message')!;
        message.textContent = result ?? 'Item purchased';
        message.classList.toggle('error', !!result);
        backdrop.querySelector('.shop-balance b')!.textContent =
          `◆ ${Math.floor(this.world.player.gold)}`;
      })
    );
    const initialFocus =
      (which === 'graphics' ? backdrop.querySelector<HTMLElement>('.game-dialog') : null) ??
      backdrop.querySelector<HTMLButtonElement>('.primary-button') ??
      backdrop.querySelector<HTMLButtonElement>('.shop-item') ??
      backdrop.querySelector<HTMLButtonElement>('.close-button');
    initialFocus?.focus();
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
    if (this.world.winner || this.graphicsState || document.hidden) return;
    this.modal = null;
    this.root.querySelector<HTMLElement>('#modal')!.hidden = true;
    this.actions.pause(false);
    this.view.renderer.domElement.focus({ preventScroll: true });
  }
  toast(message: string): void {
    this.root.querySelector('#toast')!.textContent = message;
    this.root.querySelector('#toast')!.classList.add('visible');
    this.toastUntil = performance.now() + 2600;
  }
  scoreboard(show: boolean): void {
    let panel = this.root.querySelector<HTMLDivElement>('.scoreboard');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'scoreboard';
      this.root.append(panel);
    }
    panel.hidden = !show;
    if (show)
      panel.innerHTML = `<div class="scoreboard-title">PRACTICE MATCH</div><div class="scoreboard-row"><img src="assets/icons/ashe.png" alt="Ashe"><strong>Ashe <small>You</small></strong><span>${this.world.player.kills} / ${this.world.player.deaths} / 0</span><span>${this.world.player.cs} CS</span></div><div class="scoreboard-row enemy"><img src="assets/icons/ashe.png" alt="Opponent"><strong>Sparring partner <small>Bot</small></strong><span>${this.world.player.deaths} / ${this.world.player.kills} / 0</span></div>`;
  }
  update(fps: number): void {
    if (this.world.winner && this.modal !== 'result') this.toggleModal('result');
    this.floating.hidden = !!this.world.winner;
    const w = this.world,
      p = w.player,
      h = w.hero;
    // Seek the announcement with match time so loading, pause and time jumps
    // cannot advance or replay its presentation independently of the simulation.
    const welcomeTick = Math.min(w.tick, 8 * TICK_RATE);
    if (welcomeTick !== this.lastWelcomeTick) {
      this.lastWelcomeTick = welcomeTick;
      this.root.style.setProperty('--welcome-age', `${-welcomeTick / TICK_RATE}s`);
    }
    const text = (id: string, value: string | number) => {
      const element = this.root.querySelector(`#${id}`)!;
      const v = String(value);
      if (element.textContent !== v) element.textContent = v;
    };
    const width = (id: string, value: number) =>
      ((this.root.querySelector(`#${id}`) as HTMLElement).style.width =
        `${Math.max(0, value) * 100}%`);
    text('health-text', `${Math.ceil(h.hp)} / ${Math.ceil(h.maxHp)}`);
    text('mana-text', `${Math.floor(h.mana)} / ${Math.floor(h.maxMana)}`);
    text(
      'health-regen',
      `+${(ASHE.healthRegen + ASHE.healthRegenGrowth * growthAtLevel(p.level)).toFixed(1)}`
    );
    width('health-fill', h.hp / h.maxHp);
    width('mana-fill', h.mana / h.maxMana);
    width('xp-fill', p.level === MAX_LEVEL ? 1 : p.xp / experienceToNextLevel(p.level));
    text('level', p.level);
    text('gold', Math.floor(p.gold));
    const shopBalance = this.root.querySelector('.shop-balance b');
    const balanceLabel = `◆ ${Math.floor(p.gold)}`;
    if (shopBalance && shopBalance.textContent !== balanceLabel)
      shopBalance.textContent = balanceLabel;
    text('ad', Math.round(h.damage));
    text('armor', Math.round(h.armor));
    text('ms', Math.round(statPrecision(w.movementSpeed(h))));
    text('as', ((60 / h.attackPeriod) * w.attackSpeedMultiplier(h, undefined)).toFixed(2));
    text('kills', p.kills);
    text('deaths', p.deaths);
    text('personal', `${p.kills} / ${p.deaths} / 0`);
    text('cs', p.cs);
    this.root
      .querySelectorAll<HTMLElement>('.focus-pips i')
      .forEach((pip, i) => pip.classList.toggle('charged', i < p.qStacks));
    this.root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach((button) => {
      const a = button.dataset.ability as Ability,
        cd = w.abilityCooldownTicks(a) / TICK_RATE;
      button.querySelector('.cooldown-text')!.textContent = cd > 0 ? String(Math.ceil(cd)) : '';
      button.classList.toggle('cooling', cd > 0);
      button.classList.toggle('insufficient', h.mana < ABILITIES[a].cost);
      button.classList.toggle('empowered', a === 'q' && p.qUntil > w.tick);
      if (a === 'e') {
        const remaining = Math.max(0, (p.eRechargeTick ?? w.tick) - w.tick) / TICK_RATE;
        button.querySelector('.ability-charges')!.textContent = String(p.eCharges);
        const recharge = button.querySelector<HTMLElement>('.ability-recharge')!;
        recharge.hidden = p.eRechargeTick === null;
        recharge.querySelector<HTMLElement>('i')!.style.transform =
          `scaleX(${Math.max(0, Math.min(1, 1 - remaining / ASHE_E.rechargeSecondsByRank[0]))})`;
        button.setAttribute(
          'aria-label',
          `Hawkshot, ${p.eCharges} of ${ASHE_E.maximumCharges} charges${p.eRechargeTick === null ? '' : `, next charge in ${Math.ceil(remaining)} seconds`}`
        );
      }
    });
    this.root.querySelector('#camera-button')!.classList.toggle('active', this.view.locked);
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
        `${Math.ceil(target.hp)} / ${Math.ceil(target.maxHp)}${w.vulnerable(target) ? '' : ' · Protected'}`
      );
      (panel.querySelector('.target-health i') as HTMLElement).style.width =
        `${(target.hp / target.maxHp) * 100}%`;
    }
    if (this.lastInventory !== p.inventory.join(',')) {
      this.lastInventory = p.inventory.join(',');
      this.root.querySelector('#inventory')!.innerHTML = Array.from({ length: 6 }, (_, i) => {
        const item = ITEMS.find((item) => item.id === p.inventory[i]);
        return `<div class="item-slot" title="${item?.name ?? 'Empty item slot'}">${item ? `<img src="assets/icons/${item.icon}.png" alt="${item.name}">` : ''}<span>${i + 1}</span></div>`;
      }).join('');
    }
    if (Math.floor(w.time) !== this.lastSecond) {
      this.lastSecond = Math.floor(w.time);
      text(
        'clock',
        `${String(Math.floor(w.time / 60)).padStart(2, '0')}:${String(Math.floor(w.time) % 60).padStart(2, '0')}`
      );
      text('fps', `${Math.round(fps)} FPS`);
    }
    if (performance.now() > this.toastUntil)
      this.root.querySelector('#toast')!.classList.remove('visible');
    for (const event of w.events)
      if (event.id > this.lastEventId) {
        this.lastEventId = event.id;
        if (!w.eventVisible(event)) continue;
        if (event.type === 'message') this.toast(event.text ?? '');
        if (['damage', 'gold', 'heal', 'level'].includes(event.type)) {
          const screen = this.view.screenPoint(event, 1.6);
          const element = document.createElement('span');
          element.className = `combat-text ${event.type}`;
          element.textContent =
            event.type === 'gold'
              ? `+${event.value}g`
              : event.type === 'heal'
                ? `+${event.value}`
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
    for (const u of w.units) {
      const knownDestroyed = w.knownStructureDestroyed(u);
      if (knownDestroyed === true || (knownDestroyed === null && (!w.alive(u) || !w.visible(u))))
        continue;
      const p = xy(u),
        r = u.kind === 'champion' ? 5 : isStructureKind(u.kind) ? 4 : 1.5;
      ctx.fillStyle = u.id === w.player.id ? '#f4dc88' : u.team === 'blue' ? '#60d1e5' : '#ee7b81';
      ctx.strokeStyle = '#102228';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
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
