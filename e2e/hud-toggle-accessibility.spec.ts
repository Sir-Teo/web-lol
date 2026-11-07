import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const initiallyLocked of [true, false])
  test(`HUD toggle states follow mouse, keyboard and camera updates (initial lock ${initiallyLocked})`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/hud-toggle-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><script type="module" src="/@vite/client"></script><style>img{width:20px;height:20px}canvas{width:32px;height:32px}</style><canvas id="battlefield" tabindex="0"></canvas><main></main>',
      })
    );
    await page.goto('/hud-toggle-probe');
    await page.evaluate(async (initiallyLocked) => {
      const [{ Hud }, { GameInput }, { World }, { PRACTICE_FIXTURE }] = await Promise.all([
        import('/src/ui/hud.ts'),
        import('/src/input/input.ts'),
        import('/src/simulation/world.ts'),
        import('/src/content/practice-fixture.ts'),
      ]);
      const world = new World(false, PRACTICE_FIXTURE),
        soundChanges: boolean[] = [];
      const view: any = {
        renderer: { domElement: document.querySelector('canvas') },
        locked: initiallyLocked,
        selected: null,
        recenter: () => {},
        setAim: () => {},
        pick: () => undefined,
        worldPoint: () => ({ x: 0, y: 0 }),
        screenPoint: () => ({ x: 0, y: 0 }),
      };
      const hud: any = new Hud(document.querySelector('main')!, world, view, {
        sound: (value: boolean) => soundChanges.push(value),
      } as any);
      // Exercise real HUD/input controls without initializing a WebGL renderer.
      hud.drawMinimap = () => {};
      const input = new GameInput(world, view, hud, () => {});
      (window as any).__HUD_TOGGLES__ = {
        world,
        view,
        hud,
        input,
        soundChanges,
        before: world.snapshot(),
      };
    }, initiallyLocked);
    const sound = page.getByRole('button', { name: 'Toggle sound', exact: true });
    const camera = page.getByRole('button', { name: 'Toggle camera lock', exact: true });
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await expect(camera).toHaveAttribute('aria-pressed', String(initiallyLocked));
    await expect(camera).toHaveAttribute(
      'title',
      initiallyLocked ? 'Unlock camera (Y)' : 'Lock camera (Y)'
    );
    await camera.click();
    await expect(camera).toHaveAttribute('aria-pressed', String(!initiallyLocked));
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect(sound).toHaveAttribute('title', 'Unmute sound');
    await page.keyboard.press('Space');
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#battlefield').focus();
    await page.keyboard.press('y');
    await expect(camera).toHaveAttribute('aria-pressed', String(initiallyLocked));
    await page.evaluate((initiallyLocked) => {
      const probe = (window as any).__HUD_TOGGLES__;
      probe.view.locked = !initiallyLocked;
      probe.hud.update(null);
    }, initiallyLocked);
    await expect(camera).toHaveAttribute('aria-pressed', String(!initiallyLocked));
    const reading = await page.evaluate(() => {
      const p = (window as any).__HUD_TOGGLES__;
      return {
        soundChanges: p.soundChanges,
        commands: p.world.commands,
        worldUnchanged: p.before === p.world.snapshot(),
      };
    });
    expect(reading.soundChanges).toEqual([false, true, false]);
    expect(reading.commands).toEqual([]);
    expect(reading.worldUnchanged).toBe(true);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('hud-toggle-states.json'),
      JSON.stringify({ initiallyLocked, ...reading, errors }, null, 2) + '\n'
    );
  });
