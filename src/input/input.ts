import type { Ability } from '../simulation/types';
import type { World } from '../simulation/world';
import type { GameView } from '../render/view';
import type { Hud } from '../ui/hud';
import { ABILITIES } from '../content/rules';

export class GameInput {
  pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  inside = false;
  recenterHeld = false;
  private aiming: Ability | null = null;
  private attackMove = false;
  constructor(
    private world: World,
    private view: GameView,
    private hud: Hud,
    unlockAudio: () => void
  ) {
    const canvas = view.renderer.domElement;
    window.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (this.aiming) view.setAim(this.aiming, this.castPoint(this.aiming));
    });
    window.addEventListener('pointerdown', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (e.button === 2 && hud.minimapPoint(e.clientX, e.clientY)) this.cancelAim();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      this.inside = true;
      const target = view.pick(world, e.clientX, e.clientY);
      view.hovered = target?.id ?? null;
      canvas.classList.toggle('enemy-hover', !!target && target.team === 'red');
    });
    canvas.addEventListener('pointerleave', () => {
      this.inside = false;
      view.hovered = null;
    });
    canvas.addEventListener('pointerdown', (e) => {
      unlockAudio();
      if (hud.paused || hud.modal) return;
      canvas.focus({ preventScroll: true });
      this.pointer = { x: e.clientX, y: e.clientY };
      const target = view.pick(world, e.clientX, e.clientY),
        point = view.worldPoint(e.clientX, e.clientY);
      if (!point) return;
      if (e.button === 2) {
        this.cancelAim();
        world.enqueue({
          type: 'order',
          unit: world.player.id,
          order:
            target && target.team !== world.hero.team
              ? { type: 'attack', target: target.id }
              : { type: 'move', point },
        });
      } else if (e.button === 0) {
        if (this.attackMove) {
          world.enqueue({
            type: 'order',
            unit: world.player.id,
            order:
              target && target.team !== world.hero.team
                ? { type: 'attack', target: target.id }
                : { type: 'attackMove', point },
          });
          this.cancelAim();
        } else view.selected = target?.id ?? world.player.id;
      }
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
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) return;
      const key = e.key.toLowerCase();
      if (!hud.modal && ['tab', ' ', 'arrowup', 'arrowdown'].includes(key)) e.preventDefault();
      if (e.repeat) return;
      if (key === 'escape') {
        if (this.aiming || this.attackMove) this.cancelAim();
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
      if (key === 'tab') hud.scoreboard(true);
      if (key === ' ') {
        this.recenterHeld = true;
        view.recenter(world.hero);
      }
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
      if (['q', 'f'].includes(key)) {
        const point =
          key === 'f' && document.elementFromPoint(this.pointer.x, this.pointer.y) === canvas
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
      if (['w', 'e', 'r', 'd'].includes(key)) {
        this.aiming = key as Ability;
        canvas.classList.add('aiming');
        view.setAim(this.aiming, this.castPoint(this.aiming));
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'tab') hud.scoreboard(false);
      if (key === ' ') this.recenterHeld = false;
      if (key === 'shift' && !this.attackMove) view.rangeVisible = false;
      if (key === this.aiming) {
        if (!hud.paused && !hud.modal) {
          const point = this.castPoint(this.aiming);
          if (point)
            world.enqueue({ type: 'cast', unit: world.player.id, ability: this.aiming, point });
        }
        this.cancelAim();
      }
    });
    window.addEventListener('blur', () => this.release());
  }
  release(): void {
    this.recenterHeld = false;
    this.inside = false;
    this.cancelAim();
    this.hud.scoreboard(false);
  }
  private castPoint(ability: Ability): { x: number; y: number } | null {
    const { x, y } = this.pointer;
    const minimap = this.hud.minimapPoint(x, y);
    if (minimap) return ABILITIES[ability].minimapTargeting ? minimap : null;
    if (document.elementFromPoint(x, y) !== this.view.renderer.domElement) return null;
    return this.view.worldPoint(x, y);
  }
  cancelAim(): void {
    this.aiming = null;
    this.attackMove = false;
    this.view.setAim(null, null);
    this.view.rangeVisible = false;
    this.view.renderer.domElement.classList.remove('aiming');
  }
  update(dt: number): void {
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
}
