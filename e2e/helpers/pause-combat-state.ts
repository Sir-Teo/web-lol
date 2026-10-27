import type { Page } from '@playwright/test';

/** Let real input and simulation run, then freeze the first matching tick.
 * This retains short combat states while a software renderer finishes painting. */
export async function pauseAtCombatState(
  page: Page,
  phase:
    'garen-q' | 'garen-q-hit' | 'garen-w' | 'garen-e' | 'garen-e-end' | 'pending-cast' | 'leona-q'
) {
  await page.evaluate((phase) => {
    const g = (window as any).__GAME__,
      w = g.world,
      original = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = Reflect.apply(original, this, args),
        p = this.player;
      const ready =
        phase === 'garen-q'
          ? !!p.garenQ
          : phase === 'garen-q-hit'
            ? !!p.garenQ?.consumed && this.units.some((u: any) => u.silenceUntil > this.tick)
            : phase === 'garen-w'
              ? !!p.garenW
              : phase === 'garen-e'
                ? !!p.garenE
                : phase === 'garen-e-end'
                  ? !p.garenE && this.abilityCooldownTicks('e') > 0
                  : phase === 'leona-q'
                    ? !!p.leonaQ
                    : !!p.pendingCast;
      if (ready) {
        this.step = original;
        g.setPaused(true);
      }
      return result;
    };
  }, phase);
}
