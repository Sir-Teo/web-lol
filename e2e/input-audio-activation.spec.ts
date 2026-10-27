import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('trusted keyboard and HUD input activate audio once without repeat or typing activation', async ({
  page,
}, info) => {
  await page.route('**/audio-input-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><canvas id="battlefield" tabindex="0"></canvas><div id="hud"><button id="trinket">Ward</button><button id="hud-action">HUD</button><input id="typing"></div>',
    })
  );
  await page.goto('/audio-input-probe');
  await page.evaluate(async () => {
    const { GameInput } = await import('/src/input/input.ts'),
      canvas = document.querySelector('canvas')!,
      root = document.querySelector('#hud')!,
      reading = { unlocks: 0, commands: [] as any[] };
    const world: any = {
      hero: { x: 0, y: 0, champion: 'ashe', team: 'blue' },
      player: { id: 1, trinket: { kind: 'ward' } },
      summonerSpell: () => 'heal',
      enqueue: (c: any) => reading.commands.push(c),
    };
    const view: any = {
      renderer: { domElement: canvas },
      pick: () => undefined,
      worldPoint: () => ({ x: 1, y: 2 }),
      setAim: () => {},
      recenter: () => {},
    };
    const hud: any = {
      root,
      paused: false,
      modal: null,
      minimapPoint: () => null,
      scoreboard: () => {},
    };
    (window as any).__AUDIO_INPUT__ = {
      reading,
      input: new GameInput(world, view, hud, () => reading.unlocks++),
    };
  });
  await page.locator('#battlefield').focus();
  await page.keyboard.down('s');
  await page.keyboard.down('s');
  await page.keyboard.up('s');
  const keyboard = await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading);
  writeFileSync(info.outputPath('input-audio.json'), JSON.stringify({ keyboard }, null, 2) + '\n');
  expect(keyboard.unlocks).toBe(1);
  expect(keyboard.commands).toHaveLength(1);
  await page.locator('#hud-action').click();
  expect(await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading.unlocks)).toBe(2);
  await page.locator('#battlefield').click();
  expect(await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading.unlocks)).toBe(3);
  await page.locator('#hud-action').focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading.unlocks)).toBe(4);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading.unlocks)).toBe(5);
  await page.locator('#typing').focus();
  await page.keyboard.type('abc ');
  expect(await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading.unlocks)).toBe(5);
  const final = await page.evaluate(() => (window as any).__AUDIO_INPUT__.reading);
  writeFileSync(
    info.outputPath('input-audio.json'),
    JSON.stringify({ keyboard, final }, null, 2) + '\n'
  );
});

test('the first keyboard Heal creates the actual game audio context before any pointer gesture', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.hero.hp = 100;
    return { context: g.audio.context?.state ?? null, tick: g.world.tick };
  });
  expect(before.context).toBeNull();
  await page.keyboard.press('f');
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world;
    return w.player.cooldowns.f > w.tick;
  });
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      context: g.audio.context?.state ?? null,
      hp: g.world.hero.hp,
      cooldown: g.world.player.cooldowns.f,
      tick: g.world.tick,
    };
  });
  writeFileSync(
    info.outputPath('first-keyboard-audio.json'),
    JSON.stringify({ before, after, errors }, null, 2) + '\n'
  );
  expect(after.context).toBe('running');
  expect(errors).toEqual([]);
});
