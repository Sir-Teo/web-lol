import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('Space activates a focused HUD button while canvas Space recenters', async ({
  page,
}, info) => {
  await page.route('**/input-keyboard-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><canvas id="battlefield" tabindex="0"></canvas><div id="hud"><button id="trinket">Ward</button><button id="test-button">HUD action</button></div>',
    })
  );
  await page.goto('/input-keyboard-probe');
  await page.evaluate(async () => {
    const { GameInput } = await import('/src/input/input.ts');
    const canvas = document.querySelector('canvas')!,
      root = document.querySelector('#hud')!;
    const reading = { clicks: 0, recenters: 0, commands: [] as any[], aim: null as string | null };
    root.querySelector('#test-button')!.addEventListener('click', () => reading.clicks++);
    const world: any = {
      hero: { x: 0, y: 0, champion: 'ashe', team: 'blue' },
      player: { id: 1, trinket: { kind: 'ward' } },
      summonerSpell: (ability: string) => (ability === 'f' ? 'heal' : 'flash'),
      enqueue: (c: any) => reading.commands.push(c),
    };
    const view: any = {
      renderer: { domElement: canvas },
      pick: () => undefined,
      worldPoint: () => ({ x: 1, y: 2 }),
      setAim: (mode: string | null) => (reading.aim = mode),
      recenter: () => reading.recenters++,
    };
    const hud: any = {
      root,
      paused: false,
      modal: null,
      minimapPoint: () => null,
      scoreboard: () => {},
    };
    (window as any).__INPUT_PROBE__ = { reading, input: new GameInput(world, view, hud, () => {}) };
  });
  await page.locator('#test-button').focus();
  await page.keyboard.press('Space');
  const button = await page.evaluate(() => (window as any).__INPUT_PROBE__.reading);
  writeFileSync(info.outputPath('space-button.json'), JSON.stringify(button, null, 2) + '\n');
  expect(button.clicks).toBe(1);
  expect(button.recenters).toBe(0);
  await page.locator('#battlefield').focus();
  await page.keyboard.down('Space');
  expect(await page.evaluate(() => (window as any).__INPUT_PROBE__.input.recenterHeld)).toBe(true);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as any).__INPUT_PROBE__.input.recenterHeld)).toBe(false);
  expect(await page.evaluate(() => (window as any).__INPUT_PROBE__.reading.recenters)).toBe(1);
});

test('Space toggles the actual sound button without moving the camera and still recenters the battlefield', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const initial = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step = () => {};
    w.commands = [];
    g.view.locked = false;
    g.view.center = { x: w.hero.x + 700, y: w.hero.y + 500 };
    g.view.render(w, 1, g.view.previousElapsed);
    return { center: { ...g.view.center }, hero: { x: w.hero.x, y: w.hero.y }, sound: g.hud.sound };
  });
  await page.mouse.move(600, 400);
  const sound = page.getByRole('button', { name: 'Toggle sound', exact: true });
  await sound.focus();
  await page.keyboard.press('Space');
  const button = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return { sound: g.hud.sound, center: { ...g.view.center }, commands: g.world.commands };
  });
  writeFileSync(
    info.outputPath('hud-space.json'),
    JSON.stringify({ initial, button, errors }, null, 2) + '\n'
  );
  expect(button.sound).toBe(!initial.sound);
  expect(button.center).toEqual(initial.center);
  expect(button.commands).toEqual([]);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__GAME__.hud.sound)).toBe(initial.sound);
  await page.locator('#battlefield').focus();
  await page.keyboard.press('Space');
  const battlefield = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return { center: { ...g.view.center }, commands: g.world.commands };
  });
  expect(battlefield.center).toEqual(initial.hero);
  expect(battlefield.commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('hud-space.json'),
    JSON.stringify({ initial, button, battlefield, errors }, null, 2) + '\n'
  );
});
