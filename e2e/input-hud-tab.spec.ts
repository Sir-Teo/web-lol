import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('HUD Tab and Shift+Tab move focus while battlefield Tab holds the scoreboard', async ({
  page,
}, info) => {
  await page.route('**/hud-tab-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><canvas id="battlefield" tabindex="0"></canvas><div id="hud"><button id="trinket">Ward</button><button id="first">First</button><span tabindex="0" id="buff">Buff details</span><button id="last">Last</button></div>',
    })
  );
  await page.goto('/hud-tab-probe');
  await page.evaluate(async () => {
    const { GameInput } = await import('/src/input/input.ts');
    const canvas = document.querySelector('canvas')!;
    const reading = { scoreboard: [] as boolean[], commands: [] as any[], events: [] as any[] };
    const world: any = {
      hero: { x: 0, y: 0, champion: 'ashe', team: 'blue' },
      player: { id: 1, trinket: { kind: 'ward' } },
      enqueue: (command: any) => reading.commands.push(command),
    };
    const view: any = { renderer: { domElement: canvas }, setAim: () => {} };
    const hud: any = {
      root: document.querySelector('#hud'),
      modal: null,
      paused: false,
      scoreboard: (visible: boolean) => reading.scoreboard.push(visible),
    };
    new GameInput(world, view, hud, () => {});
    (window as any).__TAB_READING__ = reading;
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Tab')
        reading.events.push({
          prevented: event.defaultPrevented,
          target: (event.target as HTMLElement).id,
        });
    });
  });
  await page.locator('#first').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#buff')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#last')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#buff')).toBeFocused();
  const hud = await page.evaluate(() => (window as any).__TAB_READING__);
  expect(hud.scoreboard).not.toContain(true);
  expect(hud.events.every((event: any) => !event.prevented)).toBe(true);
  await page.locator('#battlefield').focus();
  await page.keyboard.down('Tab');
  await expect(page.locator('#battlefield')).toBeFocused();
  expect(await page.evaluate(() => (window as any).__TAB_READING__.scoreboard.at(-1))).toBe(true);
  await page.keyboard.up('Tab');
  const final = await page.evaluate(() => (window as any).__TAB_READING__);
  expect(final.scoreboard.at(-1)).toBe(false);
  expect(final.events.at(-1).prevented).toBe(true);
  expect(final.commands).toEqual([]);
  writeFileSync(info.outputPath('hud-tab.json'), JSON.stringify({ hud, final }, null, 2) + '\n');
});

test('the actual HUD camera and sound buttons support native Tab navigation', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    // Keyboard focus and commands are under test; retain a complete scene,
    // then stop continuous software rendering between trusted key gestures.
    g.world.step = () => {};
    g.world.commands = [];
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.view.renderer.setAnimationLoop(null);
  });
  const camera = page.getByRole('button', { name: 'Toggle camera lock', exact: true });
  const sound = page.getByRole('button', { name: 'Toggle sound', exact: true });
  await camera.focus();
  await page.keyboard.press('Tab');
  await expect(sound).toBeFocused();
  const initialSound = await page.evaluate(() => (window as any).__GAME__.hud.sound);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as any).__GAME__.hud.sound)).toBe(!initialSound);
  await page.keyboard.press('Shift+Tab');
  await expect(camera).toBeFocused();
  const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('actual-hud-tab.json'),
    JSON.stringify({ initialSound, commands, errors }, null, 2) + '\n'
  );
});
