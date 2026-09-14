import { ITEMS } from '../content/rules';

/** Inspect only the displayed item, never the live enemy inventory behind it. */
export class ScoreboardItemTooltip {
  private tip = document.createElement('div');
  private hovered: HTMLElement | null = null;
  private focused: HTMLElement | null = null;
  private owner: HTMLElement | null = null;
  private preferred: 'hovered' | 'focused' = 'hovered';

  constructor(private root: HTMLElement) {
    this.tip.className = 'tooltip scoreboard-item-tooltip';
    this.tip.id = 'scoreboard-item-tooltip';
    this.tip.setAttribute('role', 'tooltip');
    this.tip.hidden = true;
    this.tip.innerHTML = '<strong></strong><div class="tooltip-meta"></div><p></p>';
    root.append(this.tip);
    const target = (value: EventTarget | null) =>
      value instanceof Element ? value.closest<HTMLElement>('[data-scoreboard-item]') : null;
    root.addEventListener('pointerover', (event) => {
      this.hovered = target(event.target);
      this.preferred = 'hovered';
      this.refresh();
    });
    root.addEventListener('pointerout', (event) => {
      this.hovered = target(event.relatedTarget);
      this.refresh();
    });
    root.addEventListener('focusin', (event) => {
      this.focused = target(event.target);
      this.preferred = 'focused';
      this.refresh();
    });
    root.addEventListener('focusout', (event) => {
      this.focused = target(event.relatedTarget);
      this.refresh();
    });
    root.addEventListener('scroll', () => this.refresh(), true);
    window.addEventListener('resize', () => this.refresh());
    window.addEventListener('blur', () => this.clear());
  }

  clear(): void {
    this.hovered = this.focused = null;
    this.owner?.removeAttribute('aria-describedby');
    this.owner = null;
    this.tip.hidden = true;
  }

  focusKey(): string | undefined {
    const active = document.activeElement as HTMLElement | null;
    return active && this.root.contains(active) ? active.dataset.itemKey : undefined;
  }

  refresh(focusKey?: string): void {
    const resolve = (old: HTMLElement | null) => {
      if (!old) return null;
      const element = old.isConnected
        ? old
        : this.root.querySelector<HTMLElement>(
            `[data-item-key="${old.dataset.itemKey}"][data-scoreboard-item]`
          );
      const panel = element?.closest<HTMLElement>('.scoreboard');
      if (!element || !panel || panel.hidden) return null;
      const box = element.getBoundingClientRect(),
        clip = panel.getBoundingClientRect();
      return box.bottom > clip.top && box.top < clip.bottom ? element : null;
    };
    const previousFocus = this.focused;
    this.hovered = resolve(this.hovered);
    this.focused = resolve(this.focused);
    if (focusKey) {
      this.focused = resolve(
        this.root.querySelector<HTMLElement>(`[data-item-key="${focusKey}"][data-scoreboard-item]`)
      );
      this.preferred = 'focused';
    }
    const owner = this[this.preferred] ?? this.hovered ?? this.focused;
    this.owner?.removeAttribute('aria-describedby');
    this.owner = owner;
    const item = ITEMS.find((item) => item.id === owner?.dataset.scoreboardItem);
    if (!owner || !item) {
      this.tip.hidden = true;
      return;
    }
    this.tip.querySelector('strong')!.textContent = item.name;
    this.tip.querySelector('.tooltip-meta')!.textContent = `${item.price} GOLD`;
    this.tip.querySelector('p')!.textContent = item.description;
    this.tip.hidden = false;
    owner.setAttribute('aria-describedby', this.tip.id);
    const box = owner.getBoundingClientRect(),
      margin = 12;
    this.tip.style.left = `${Math.max(margin, Math.min(box.left, innerWidth - this.tip.offsetWidth - margin))}px`;
    this.tip.style.top = `${Math.max(margin, Math.min(box.top - this.tip.offsetHeight - 10, innerHeight - this.tip.offsetHeight - margin))}px`;
    if (this.focused && this.focused !== previousFocus) this.focused.focus({ preventScroll: true });
  }
}
