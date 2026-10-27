import type { Ability } from '../simulation/types';
import type { World } from '../simulation/world';
import type { GameView } from '../render/view';
import type { Hud } from '../ui/hud';
import {
  instantSpell,
  minimapSpell,
  targetedSpell,
  spellTarget,
  targetInstruction,
} from './spell-controls';

export class GameInput {
  pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  inside = false;
  recenterHeld = false;
  private aiming: Ability | null = null;
  private wardAiming = false;
  private attackMove = false;
  constructor(
    private world: World,
    private view: GameView,
    private hud: Hud,
    unlockAudio: () => void
  ) {
    const canvas = view.renderer.domElement;
    hud.onInstantCast = () => {
      if (this.wardAiming) this.cancelAim();
    };
    window.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (this.wardAiming) view.setAim('ward', this.wardPoint() ?? world.hero);
      else if (this.aiming) view.setAim(this.aiming, this.castPoint(this.aiming));
    });
    window.addEventListener('pointerdown', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (e.button === 2 && hud.minimapPoint(e.clientX, e.clientY)) this.cancelAim();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      this.inside = true;
      this.updateHover();
    });
    canvas.addEventListener('pointerleave', () => {
      this.inside = false;
      this.updateHover();
    });
    canvas.addEventListener('pointerdown', (e) => {
      unlockAudio();
      if (hud.paused || hud.modal) return;
      canvas.focus({ preventScroll: true });
      this.pointer = { x: e.clientX, y: e.clientY };
      const target = view.pick(world, e.clientX, e.clientY),
        point = view.worldPoint(e.clientX, e.clientY);
      if (!point) return;
      if (e.button === 0 && this.wardAiming) {
        world.enqueue({ type: 'ward', unit: world.player.id, point });
        this.cancelAim();
        return;
      }
      if (e.button === 2 || (e.button === 0 && this.attackMove)) {
        const attackMove = e.button === 0 || e.shiftKey;
        this.cancelAim();
        world.enqueue({
          type: 'order',
          unit: world.player.id,
          order:
            target && target.team !== world.hero.team
              ? { type: 'attack', target: target.id }
              : { type: attackMove ? 'attackMove' : 'move', point },
        });
      } else if (e.button === 0) view.selected = target?.id ?? world.player.id;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!hud.modal) view.zoom = Math.max(0.7, Math.min(1.35, view.zoom + e.deltaY * 0.0005));
      },
      { passive: false }
    );
    window.addEventListener('keydown', (e) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if (typing) return;
      const key = e.key.toLowerCase();
      // Let focused HUD buttons keep their native Space activation.
      if (key === ' ' && e.target instanceof HTMLButtonElement) return;
      if (!hud.modal && ['tab', ' ', 'arrowup', 'arrowdown'].includes(key)) e.preventDefault();
      if (e.repeat) return;
      if (key === 'escape') {
        if (this.aiming || this.wardAiming || this.attackMove) this.cancelAim();
        else if (hud.modal) hud.closeModal();
        else hud.toggleModal('pause');
        return;
      }
      if (key === 'p') {
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
      if (e.ctrlKey && ['q', 'w', 'e', 'r'].includes(key)) {
        e.preventDefault();
        this.cancelAim();
        world.enqueue({
          type: 'learn',
          unit: world.player.id,
          ability: key as 'q' | 'w' | 'e' | 'r',
        });
        return;
      }
      if (key === 'tab') hud.scoreboard(true);
      if (key === ' ') {
        this.recenterHeld = true;
        view.recenter(world.hero);
      }
      if (key === '4') this.beginWardAim();
      if (key === 'y') hud.toggleCamera();
      if (key === 'shift') view.rangeVisible = true;
      if (key === 's') {
        this.cancelAim();
        world.enqueue({ type: 'order', unit: world.player.id, order: { type: 'idle' } });
      }
      if (key === 'a') {
        this.attackMove = true;
        view.rangeVisible = true;
        canvas.classList.add('aiming');
      }
      if (key === 'b') world.enqueue({ type: 'recall', unit: world.player.id });
      const spell = ['q', 'w', 'e', 'r', 'd', 'f'].includes(key) ? (key as Ability) : null;
      if (spell && this.wardAiming) this.cancelAim();
      if (spell && instantSpell(world, spell)) {
        const point =
          world.summonerSpell(spell) === 'heal' &&
          document.elementFromPoint(this.pointer.x, this.pointer.y) === canvas
            ? (view.pick(world, this.pointer.x, this.pointer.y) ??
              view.worldPoint(this.pointer.x, this.pointer.y) ??
              world.hero)
            : world.hero;
        world.enqueue({
          type: 'cast',
          unit: world.player.id,
          ability: key as Ability,
          point: { x: point.x, y: point.y },
        });
      }
      if (spell && !instantSpell(world, spell)) {
        this.aiming = key as Ability;
        canvas.classList.add('aiming');
        view.setAim(this.aiming, this.castPoint(this.aiming));
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === '4' && this.wardAiming) {
        const point = this.wardPoint();
        if (!hud.paused && !hud.modal && point)
          world.enqueue({ type: 'ward', unit: world.player.id, point });
        this.cancelAim();
      }
      if (key === 'tab') hud.scoreboard(false);
      if (key === ' ') this.recenterHeld = false;
      if (key === 'shift' && !this.attackMove) view.rangeVisible = false;
      if (key === this.aiming) {
        if (!hud.paused && !hud.modal) {
          const point = this.castPoint(this.aiming);
          if (point) {
            const target = targetedSpell(world, this.aiming)
              ? spellTarget(world, this.aiming, view.pick(world, this.pointer.x, this.pointer.y))
              : undefined;
            if (targetedSpell(world, this.aiming) && !target)
              hud.toast(targetInstruction(world, this.aiming));
            else
              world.enqueue({
                type: 'cast',
                unit: world.player.id,
                ability: this.aiming,
                point,
                ...(target ? { targetId: target.id } : {}),
              });
          }
        }
        this.cancelAim();
      }
    });
    hud.root.querySelector('#trinket')!.addEventListener('click', () => {
      if (!hud.paused && !hud.modal) this.beginWardAim();
    });
    window.addEventListener('blur', () => this.release());
  }
  private beginWardAim(): void {
    this.cancelAim();
    if (this.world.player.trinket.kind === 'oracle') {
      this.world.enqueue({ type: 'oracle', unit: this.world.player.id });
      return;
    }
    this.wardAiming = true;
    this.view.renderer.domElement.classList.add('aiming');
    this.view.setAim('ward', this.wardPoint() ?? this.world.hero);
  }
  private wardPoint(): { x: number; y: number } | null {
    if (document.elementFromPoint(this.pointer.x, this.pointer.y) !== this.view.renderer.domElement)
      return null;
    return this.view.worldPoint(this.pointer.x, this.pointer.y);
  }
  release(): void {
    this.recenterHeld = false;
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
  cancelAim(): void {
    this.aiming = null;
    this.wardAiming = false;
    this.attackMove = false;
    this.view.setAim(null, null);
    this.view.rangeVisible = false;
    this.view.renderer.domElement.classList.remove('aiming');
  }
  update(dt: number): void {
    if (this.wardAiming && this.world.player.trinket.kind !== 'ward') this.cancelAim();
    if (this.hud.paused || this.hud.modal) {
      this.cancelAim();
      return;
    }
    if (this.recenterHeld) this.view.recenter(this.world.hero);
    if (this.inside && !this.recenterHeld) {
      const x = this.pointer.x < 16 ? -1 : this.pointer.x > window.innerWidth - 16 ? 1 : 0;
      const y = this.pointer.y < 16 ? -1 : this.pointer.y > window.innerHeight - 16 ? 1 : 0;
      this.view.pan(x, y, dt);
    }
  }
  updateHover(): void {
    const canvas = this.view.renderer.domElement;
    const target =
      this.inside &&
      !this.hud.modal &&
      document.elementFromPoint(this.pointer.x, this.pointer.y) === canvas
        ? this.view.pick(this.world, this.pointer.x, this.pointer.y)
        : undefined;
    this.view.hovered = target?.id ?? null;
    canvas.classList.toggle('enemy-hover', !!target && target.team !== this.world.hero.team);
  }
}
