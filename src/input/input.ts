import type { Ability, Order } from '../simulation/types';
import type { World } from '../simulation/world';
import type { GameView } from '../render/view';
import type { Hud } from '../ui/hud';
import { cameraKeyTarget } from './camera-targets';
import {
  instantSpell,
  minimapSpell,
  targetedSpell,
  spellTarget,
  targetInstruction,
} from './spell-controls';
import { getExpandedItem } from '../simulation/item-effects';

const ITEM_SLOT_BY_KEY: Readonly<Record<string, number>> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
};

export class GameInput {
  pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  inside = false;
  recenterHeld = false;
  readOnly = false;
  private readonly abort = new AbortController();
  private cameraKeys: string[] = [];
  private aiming: Ability | null = null;
  private wardAiming = false;
  private itemAimingSlot: number | null = null;
  private attackMove = false;
  private championsOnly = false;
  private hitCache: { x: number; y: number; overCanvas: boolean } | null = null;
  private heldOrder: {
    pointerId: number;
    point: { x: number; y: number };
    inside: boolean;
    attackMove: boolean;
    elapsed: number;
  } | null = null;
  constructor(
    private world: World,
    private view: GameView,
    private hud: Hud,
    unlockAudio: () => void
  ) {
    const canvas = view.renderer.domElement;
    const signal = this.abort.signal;
    view.onBeforeAim = () => {
      if (this.aiming || this.wardAiming || this.itemAimingSlot !== null) {
        this.updateHover();
        this.refreshAim();
      }
    };
    hud.onInstantCast = () => {
      this.heldOrder = null;
      if (this.wardAiming || this.itemAimingSlot !== null) this.cancelAim();
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        this.pointer = { x: e.clientX, y: e.clientY };
        this.hitCache = { x: e.clientX, y: e.clientY, overCanvas: e.target === canvas };
        if (this.heldOrder?.pointerId === e.pointerId) {
          if (!(e.buttons & 2)) this.heldOrder = null;
          else {
            this.heldOrder.point = { ...this.pointer };
            this.heldOrder.attackMove = e.shiftKey;
          }
        }
        this.refreshAim();
      },
      { signal }
    );
    window.addEventListener(
      'pointerup',
      (e) => {
        this.hitCache = null;
        if (this.heldOrder?.pointerId === e.pointerId && (e.button === 2 || !(e.buttons & 2)))
          this.heldOrder = null;
      },
      { signal }
    );
    window.addEventListener(
      'pointercancel',
      (e) => {
        this.hitCache = null;
        if (this.heldOrder?.pointerId === e.pointerId) this.heldOrder = null;
      },
      { signal }
    );
    window.addEventListener(
      'pointerdown',
      (e) => {
        unlockAudio();
        this.pointer = { x: e.clientX, y: e.clientY };
        this.hitCache = { x: e.clientX, y: e.clientY, overCanvas: e.target === canvas };
        if (e.button === 2 && hud.minimapPoint(e.clientX, e.clientY)) this.cancelAim();
      },
      { signal }
    );
    window.addEventListener(
      'keydown',
      () => {
        this.hitCache = null;
      },
      { signal }
    );
    window.addEventListener(
      'keyup',
      () => {
        this.hitCache = null;
      },
      { signal }
    );
    window.addEventListener(
      'resize',
      () => {
        this.hitCache = null;
      },
      { signal }
    );
    window.addEventListener(
      'blur',
      () => {
        this.hitCache = null;
      },
      { signal }
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    canvas.addEventListener(
      'pointermove',
      (e) => {
        this.pointer = { x: e.clientX, y: e.clientY };
        this.hitCache = { x: e.clientX, y: e.clientY, overCanvas: e.target === canvas };
        this.inside = true;
        if (this.heldOrder?.pointerId === e.pointerId) this.heldOrder.inside = true;
        this.updateHover();
      },
      { signal }
    );
    canvas.addEventListener(
      'pointerleave',
      (e) => {
        this.inside = false;
        this.hitCache = null;
        if (this.heldOrder?.pointerId === e.pointerId) this.heldOrder.inside = false;
        this.updateHover();
      },
      { signal }
    );
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (hud.paused || hud.modal) return;
        canvas.focus({ preventScroll: true });
        this.pointer = { x: e.clientX, y: e.clientY };
        const target = view.pick(
            this.world,
            e.clientX,
            e.clientY,
            this.championsOnly && e.button === 2 && !e.shiftKey
          ),
          point = view.worldPoint(e.clientX, e.clientY);
        if (!point) return;
        if (this.readOnly) {
          if (e.button === 0) view.selected = target?.id ?? this.world.player.id;
          return;
        }
        if (e.button === 0 && this.wardAiming) {
          this.world.enqueue({
            type: this.world.player.trinket.kind === 'farsight' ? 'farsight' : 'ward',
            unit: this.world.player.id,
            point,
          });
          this.cancelAim();
          return;
        }
        if (e.button === 0 && this.itemAimingSlot !== null) {
          this.world.enqueue({
            type: 'use-item',
            unit: this.world.player.id,
            slot: this.itemAimingSlot,
            point,
          });
          this.cancelAim();
          return;
        }
        if (e.button === 2 || (e.button === 0 && this.attackMove)) {
          const attackMove = e.button === 0 || e.shiftKey;
          this.cancelAim();
          this.world.enqueue({
            type: 'order',
            unit: this.world.player.id,
            order:
              target && target.team !== this.world.hero.team
                ? { type: 'attack', target: target.id }
                : { type: attackMove ? 'attackMove' : 'move', point },
          });
          if (e.button === 2 && e.isPrimary)
            this.heldOrder = {
              pointerId: e.pointerId,
              point: { ...this.pointer },
              inside: true,
              attackMove: e.shiftKey,
              elapsed: 0,
            };
        } else if (e.button === 0) view.selected = target?.id ?? this.world.player.id;
      },
      { signal }
    );
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!hud.modal) view.zoom = Math.max(0.7, Math.min(1.35, view.zoom + e.deltaY * 0.0005));
      },
      { passive: false, signal }
    );
    window.addEventListener(
      'keydown',
      (e) => {
        const typing =
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement;
        if (typing) return;
        const key = e.key.toLowerCase();
        const learnShortcut =
          e.ctrlKey && !e.altKey && !e.metaKey && ['q', 'w', 'e', 'r'].includes(key);
        if ((e.ctrlKey || e.altKey || e.metaKey) && !learnShortcut) return;
        const championTargeting = e.code === 'Backquote';
        if (championTargeting && !hud.paused && !hud.modal) e.preventDefault();
        const cameraTarget = cameraKeyTarget(this.world, key);
        // Reserve repeat events too, especially F1 help and F3 browser search.
        if (cameraTarget && !hud.paused && !hud.modal) e.preventDefault();
        // Reserve learning chords even on repeat; enqueue only on first keydown.
        if (learnShortcut && !hud.paused && !hud.modal) e.preventDefault();
        // Autoplay activation belongs to the first real gameplay/HUD gesture.
        // Printable keys and button Enter/Space qualify; repeats and browser
        // modifier shortcuts must not enqueue more context transitions.
        if (
          !e.repeat &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          (key.length === 1 || (key === 'enter' && e.target instanceof HTMLButtonElement))
        )
          unlockAudio();
        // HUD controls retain native focus traversal, including focusable buffs.
        if (key === 'tab' && e.target instanceof Node && hud.root.contains(e.target)) return;
        // Let focused HUD buttons keep their native Space activation.
        if (key === ' ' && e.target instanceof HTMLButtonElement) return;
        if (!hud.modal && ['tab', ' ', 'arrowup', 'arrowdown'].includes(key)) e.preventDefault();
        if (e.repeat) return;
        if (key === 'escape') {
          if (this.aiming || this.wardAiming || this.itemAimingSlot !== null || this.attackMove)
            this.cancelAim();
          else if (hud.modal) hud.closeModal();
          else hud.toggleModal('pause');
          return;
        }
        if (key === 'p' && !this.readOnly) {
          this.cancelAim();
          hud.toggleModal('shop');
          return;
        }
        if (key === 'h') {
          this.cancelAim();
          hud.toggleModal('help');
          return;
        }
        if (hud.paused || hud.modal) return;
        if (championTargeting && !this.readOnly) {
          this.setChampionTargeting(true);
          this.updateHover();
          return;
        }
        if (cameraTarget) {
          this.cameraKeys = [...this.cameraKeys.filter((held) => held !== key), key];
          const focus = this.updateCameraFocus();
          if (focus) view.recenter(focus);
          return;
        }
        if (key === 'tab') hud.scoreboard(true);
        if (key === ' ') {
          this.recenterHeld = true;
          this.updateCameraFocus();
          view.recenter(this.world.hero);
        }
        if (key === 'y') hud.toggleCamera();
        if (key === 'shift') {
          view.rangeVisible = true;
          if (this.heldOrder) this.heldOrder.attackMove = true;
        }
        if (this.readOnly) return;
        if (learnShortcut) {
          e.preventDefault();
          this.cancelAim();
          this.world.enqueue({
            type: 'learn',
            unit: this.world.player.id,
            ability: key as 'q' | 'w' | 'e' | 'r',
          });
          return;
        }
        if (key === '4') this.beginWardAim();
        const itemSlot = ITEM_SLOT_BY_KEY[key];
        if (itemSlot !== undefined) {
          this.activateItemSlot(itemSlot);
          return;
        }
        if (key === 's') {
          this.heldOrder = null;
          this.cancelAim();
          this.world.enqueue({
            type: 'order',
            unit: this.world.player.id,
            order: { type: 'idle' },
          });
        }
        if (key === 'a') {
          this.heldOrder = null;
          this.attackMove = true;
          view.rangeVisible = true;
          canvas.classList.add('aiming');
        }
        if (key === 'b') {
          this.heldOrder = null;
          this.world.enqueue({ type: 'recall', unit: this.world.player.id });
        }
        const spell = ['q', 'w', 'e', 'r', 'd', 'f'].includes(key) ? (key as Ability) : null;
        if (spell) this.heldOrder = null;
        if (spell && (this.wardAiming || this.itemAimingSlot !== null)) this.cancelAim();
        if (spell && instantSpell(this.world, spell)) {
          const point =
            this.world.summonerSpell(spell) === 'heal' &&
            document.elementFromPoint(this.pointer.x, this.pointer.y) === canvas
              ? (this.pick() ?? view.worldPoint(this.pointer.x, this.pointer.y) ?? this.world.hero)
              : this.world.hero;
          this.world.enqueue({
            type: 'cast',
            unit: this.world.player.id,
            ability: key as Ability,
            point: { x: point.x, y: point.y },
          });
        }
        if (spell && !instantSpell(this.world, spell)) {
          this.aiming = key as Ability;
          canvas.classList.add('aiming');
          view.setAim(this.aiming, this.castPoint(this.aiming));
        }
      },
      { signal }
    );
    window.addEventListener(
      'keyup',
      (e) => {
        const key = e.key.toLowerCase();
        if (e.code === 'Backquote') {
          this.setChampionTargeting(false);
          this.updateHover();
        }
        if (this.cameraKeys.includes(key)) {
          e.preventDefault();
          this.cameraKeys = this.cameraKeys.filter((held) => held !== key);
          this.updateCameraFocus();
        }
        if (key === '4' && this.wardAiming) {
          const point = this.wardPoint();
          if (!this.readOnly && !hud.paused && !hud.modal && point)
            this.world.enqueue({
              type: this.world.player.trinket.kind === 'farsight' ? 'farsight' : 'ward',
              unit: this.world.player.id,
              point,
            });
          this.cancelAim();
        }
        const releaseItemSlot = ITEM_SLOT_BY_KEY[key];
        if (releaseItemSlot !== undefined && this.itemAimingSlot === releaseItemSlot) {
          const point = this.wardPoint();
          if (!this.readOnly && !hud.paused && !hud.modal && point)
            this.world.enqueue({
              type: 'use-item',
              unit: this.world.player.id,
              slot: releaseItemSlot,
              point,
            });
          this.cancelAim();
        }
        if (key === 'tab') hud.scoreboard(false);
        if (key === ' ') {
          this.recenterHeld = false;
          this.updateCameraFocus();
        }
        if (key === 'shift' && !this.attackMove) view.rangeVisible = false;
        if (key === 'shift' && this.heldOrder) this.heldOrder.attackMove = false;
        if (key === this.aiming) {
          if (!this.readOnly && !hud.paused && !hud.modal) {
            const point = this.castPoint(this.aiming);
            if (point) {
              const hovered = this.pick();
              const target = targetedSpell(this.world, this.aiming)
                ? spellTarget(this.world, this.aiming, hovered)
                : this.world.hero.champion === 'morgana' &&
                    this.aiming === 'e' &&
                    hovered?.kind === 'champion' &&
                    hovered.team === this.world.hero.team &&
                    this.world.alive(hovered)
                  ? hovered
                  : undefined;
              if (targetedSpell(this.world, this.aiming) && !target)
                hud.toast(targetInstruction(this.world, this.aiming));
              else
                this.world.enqueue({
                  type: 'cast',
                  unit: this.world.player.id,
                  ability: this.aiming,
                  point,
                  ...(target ? { targetId: target.id } : {}),
                });
            }
          }
          this.cancelAim();
        }
      },
      { signal }
    );
    hud.root.querySelector('#trinket')?.addEventListener(
      'click',
      () => {
        if (!this.readOnly && !hud.paused && !hud.modal) this.beginWardAim();
      },
      { signal }
    );
    hud.root.querySelector('#inventory')?.addEventListener(
      'click',
      (e) => {
        if (this.readOnly || hud.paused || hud.modal) return;
        const slotEl = (e.target as HTMLElement).closest<HTMLElement>('[data-inventory-slot]');
        if (!slotEl) return;
        const slot = Number(slotEl.dataset.inventorySlot);
        if (Number.isInteger(slot) && slot >= 0) this.activateItemSlot(slot);
      },
      { signal }
    );
    window.addEventListener('blur', () => this.release(), { signal });
  }
  setWorld(world: World, readOnly = false): void {
    this.release();
    this.world = world;
    this.readOnly = readOnly;
  }
  dispose(): void {
    this.release();
    this.abort.abort();
  }
  private activateItemSlot(slot: number): void {
    const itemId = this.world.player.inventory[slot];
    if (!itemId) return;
    const expanded = getExpandedItem(itemId);
    if (!expanded?.active) return;
    this.heldOrder = null;
    this.cancelAim();
    if (expanded.active.targetedPoint) {
      this.itemAimingSlot = slot;
      this.view.renderer.domElement.classList.add('aiming');
      this.view.setAim('control-ward', this.wardPoint() ?? this.world.hero);
      return;
    }
    this.world.enqueue({ type: 'use-item', unit: this.world.player.id, slot });
  }
  private beginWardAim(): void {
    this.heldOrder = null;
    this.cancelAim();
    if (this.world.player.trinket.kind === 'oracle') {
      this.world.enqueue({ type: 'oracle', unit: this.world.player.id });
      return;
    }
    this.wardAiming = true;
    this.view.renderer.domElement.classList.add('aiming');
    const aimKind = this.world.player.trinket.kind === 'farsight' ? 'farsight' : 'ward';
    this.view.setAim(aimKind, this.wardPoint() ?? this.world.hero);
  }
  private wardPoint(): { x: number; y: number } | null {
    if (this.wardAiming && this.world.player.trinket.kind === 'farsight') {
      const minimap = this.hud.minimapPoint(this.pointer.x, this.pointer.y);
      if (minimap) return minimap;
    }
    if (document.elementFromPoint(this.pointer.x, this.pointer.y) !== this.view.renderer.domElement)
      return null;
    return this.view.worldPoint(this.pointer.x, this.pointer.y);
  }
  private refreshAim(): void {
    if (this.wardAiming) {
      const aimKind = this.world.player.trinket.kind === 'farsight' ? 'farsight' : 'ward';
      this.view.setAim(aimKind, this.wardPoint() ?? this.world.hero);
    } else if (this.itemAimingSlot !== null) {
      this.view.setAim('control-ward', this.wardPoint() ?? this.world.hero);
    } else if (this.aiming) this.view.setAim(this.aiming, this.castPoint(this.aiming));
  }
  release(): void {
    this.heldOrder = null;
    this.setChampionTargeting(false);
    this.recenterHeld = false;
    this.cameraKeys = [];
    this.view.cameraFocusId = null;
    this.inside = false;
    this.updateHover();
    this.cancelAim();
    this.hud.scoreboard(false);
  }
  private castPoint(ability: Ability): { x: number; y: number } | null {
    const { x, y } = this.pointer;
    const minimap = this.hud.minimapPoint(x, y);
    if (minimap) return minimapSpell(this.world, ability) ? minimap : null;
    if (document.elementFromPoint(x, y) !== this.view.renderer.domElement) return null;
    return this.view.worldPoint(x, y);
  }
  private setChampionTargeting(value: boolean): void {
    if (this.championsOnly === value) return;
    this.championsOnly = value;
    this.hud.root.classList.toggle('champions-only', value);
  }
  private pick() {
    return this.view.pick(this.world, this.pointer.x, this.pointer.y, this.championsOnly);
  }
  private samePointerOrder(a: Order, b: Order): boolean {
    if (a.type === 'attack' && b.type === 'attack') return a.target === b.target;
    return (
      (a.type === 'move' || a.type === 'attackMove') &&
      b.type === a.type &&
      Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) < 4
    );
  }
  private refreshHeldOrder(): void {
    const held = this.heldOrder;
    if (!held) return;
    if (this.hud.paused || this.hud.modal || this.world.winner) {
      this.heldOrder = null;
      return;
    }
    if (held.elapsed < 0.12 || !held.inside) return;
    held.elapsed = 0;
    const canvas = this.view.renderer.domElement;
    if (document.elementFromPoint(held.point.x, held.point.y) !== canvas) return;
    this.view.refreshCamera();
    const point = this.view.worldPoint(held.point.x, held.point.y);
    if (!point) return;
    const target = this.view.pick(
      this.world,
      held.point.x,
      held.point.y,
      this.championsOnly && !held.attackMove
    );
    const order: Order =
      target && target.team !== this.world.hero.team
        ? { type: 'attack', target: target.id }
        : { type: held.attackMove ? 'attackMove' : 'move', point };
    // Only the newest queued order describes the destination we will execute.
    let current = this.world.hero.order;
    for (let i = this.world.commands.length - 1; i >= 0; i--) {
      const command = this.world.commands[i];
      if (command.type === 'order' && command.unit === this.world.player.id) {
        current = command.order;
        break;
      }
    }
    if (
      this.samePointerOrder(order, current) ||
      ((order.type === 'move' || order.type === 'attackMove') &&
        current.type === 'idle' &&
        Math.hypot(point.x - this.world.hero.x, point.y - this.world.hero.y) < 4)
    )
      return;
    this.world.enqueue({ type: 'order', unit: this.world.player.id, order });
  }
  cancelAim(): void {
    this.aiming = null;
    this.wardAiming = false;
    this.itemAimingSlot = null;
    this.attackMove = false;
    this.view.setAim(null, null);
    this.view.rangeVisible = false;
    this.view.renderer.domElement.classList.remove('aiming');
  }
  private updateCameraFocus() {
    const target = this.recenterHeld
      ? this.world.hero
      : cameraKeyTarget(this.world, this.cameraKeys.at(-1) ?? '');
    this.view.cameraFocusId = target?.id ?? null;
    return target;
  }
  update(dt: number): void {
    if (
      this.wardAiming &&
      this.world.player.trinket.kind !== 'ward' &&
      this.world.player.trinket.kind !== 'farsight'
    )
      this.cancelAim();
    if (this.itemAimingSlot !== null && !this.world.player.inventory[this.itemAimingSlot])
      this.cancelAim();
    if (this.hud.paused || this.hud.modal) {
      this.heldOrder = null;
      this.setChampionTargeting(false);
      this.recenterHeld = false;
      this.cameraKeys = [];
      this.view.cameraFocusId = null;
      this.cancelAim();
      return;
    }
    if (this.heldOrder)
      this.heldOrder.elapsed = Math.min(0.12, this.heldOrder.elapsed + Math.max(0, dt));
    const cameraTarget = this.updateCameraFocus();
    if (cameraTarget) this.view.recenter(cameraTarget);
    if (this.inside && !cameraTarget) {
      const x = this.pointer.x < 16 ? -1 : this.pointer.x > window.innerWidth - 16 ? 1 : 0;
      const y = this.pointer.y < 16 ? -1 : this.pointer.y > window.innerHeight - 16 ? 1 : 0;
      this.view.pan(x, y, dt);
    }
    this.refreshHeldOrder();
  }
  private pointerOverCanvas(canvas: HTMLCanvasElement): boolean {
    if (this.hitCache && this.hitCache.x === this.pointer.x && this.hitCache.y === this.pointer.y)
      return this.hitCache.overCanvas;
    const overCanvas = document.elementFromPoint(this.pointer.x, this.pointer.y) === canvas;
    this.hitCache = { x: this.pointer.x, y: this.pointer.y, overCanvas };
    return overCanvas;
  }
  updateHover(): void {
    const canvas = this.view.renderer.domElement;
    const target =
      this.inside && !this.hud.modal && this.pointerOverCanvas(canvas) ? this.pick() : undefined;
    this.view.hovered = target?.id ?? null;
    canvas.classList.toggle('enemy-hover', !!target && target.team !== this.world.hero.team);
  }
  updateHoverAfterRender(): void {
    // Active gestures already refresh against this frame's poses before drawing.
    // Keep ordinary/manual-preview hover behavior without a second ray query.
    if (!this.aiming && !this.wardAiming) this.updateHover();
  }
}
