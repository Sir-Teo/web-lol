import type { World } from '../simulation/world';

/** Public local-player combat stats, refreshed while hovered or keyboard focused. */
export class AttackStatTooltip {
  private tip = document.createElement('div');
  private hovered = false;
  private focused = false;
  private dismissed = false;
  private lastText = '';
  private enabled = true;
  constructor(
    private root: HTMLElement,
    private owner: HTMLElement,
    private world: World
  ) {
    owner.tabIndex = 0;
    owner.removeAttribute('title');
    this.tip.className = 'tooltip attack-stat-tooltip';
    this.tip.id = 'attack-stat-tooltip';
    this.tip.setAttribute('role', 'tooltip');
    this.tip.hidden = true;
    this.tip.innerHTML =
      '<strong>Attack damage</strong><div class="tooltip-meta"></div><p></p><small></small>';
    root.append(this.tip);
    owner.addEventListener('pointerenter', () => {
      this.hovered = true;
      this.dismissed = false;
      this.refresh();
    });
    owner.addEventListener('pointerleave', () => {
      this.hovered = false;
      this.refresh();
    });
    owner.addEventListener('focus', () => {
      this.focused = true;
      this.dismissed = false;
      this.refresh();
    });
    owner.addEventListener('blur', () => {
      this.focused = false;
      this.refresh();
    });
    owner.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.tip.hidden) {
        event.stopPropagation();
        this.dismissed = true;
        this.refresh();
      }
    });
    window.addEventListener('blur', () => {
      this.hovered = this.focused = false;
      this.refresh();
    });
    window.addEventListener('resize', () => this.refresh());
  }
  refresh(enabled = this.enabled): void {
    this.enabled = enabled;
    if (!enabled) this.hovered = this.focused = false;
    if (!enabled || this.dismissed || (!this.hovered && !this.focused) || !this.root.isConnected) {
      this.tip.hidden = true;
      this.owner.removeAttribute('aria-describedby');
      return;
    }
    const w = this.world,
      h = w.hero;
    const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;
    const chance = percent(w.criticalChance(h));
    const multiplier = percent(w.basicAttackDamageMultiplier(h, true));
    const detail =
      h.champion === 'ashe'
        ? `Frost Shot: ${multiplier} of attack damage. Critical strikes strengthen the slow instead of dealing extra damage.`
        : `Critical strikes: ${multiplier} of attack damage.`;
    const text = JSON.stringify([h.damage, chance, detail]);
    if (text !== this.lastText) {
      this.lastText = text;
      this.tip.querySelector('.tooltip-meta')!.textContent =
        `${Number(h.damage.toFixed(2))} ATTACK DAMAGE`;
      this.tip.querySelector('p')!.textContent = `Critical strike chance: ${chance}. ${detail}`;
      this.tip.querySelector('small')!.textContent =
        'Before armor. Critical modifiers do not apply to structures or separate on-hit effects.';
    }
    this.tip.hidden = false;
    this.owner.setAttribute('aria-describedby', this.tip.id);
    const box = this.owner.getBoundingClientRect(),
      margin = 12;
    this.tip.style.left = `${Math.max(margin, Math.min(box.left, innerWidth - this.tip.offsetWidth - margin))}px`;
    this.tip.style.top = `${Math.max(margin, Math.min(box.top - this.tip.offsetHeight - 10, innerHeight - this.tip.offsetHeight - margin))}px`;
  }
}
