import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
async function setup(page: any) {
  await page.route('**/modifier-input-probe', (route: any) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><canvas id="battlefield" tabindex="0"></canvas><div id="hud"><button id="trinket">Ward</button></div>',
    })
  );
  await page.goto('/modifier-input-probe');
  await page.evaluate(async () => {
    const { GameInput } = await import('/src/input/input.ts'),
      canvas = document.querySelector('canvas')!,
      root = document.querySelector('#hud')!,
      reading = { commands: [] as any[], events: [] as any[], unlocks: 0 };
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
      toggleModal: () => {},
      closeModal: () => {},
    };
    (window as any).__MODIFIER_INPUT__ = {
      reading,
      hud,
      input: new GameInput(world, view, hud, () => reading.unlocks++),
    };
    window.addEventListener('keydown', (e) =>
      reading.events.push({
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        prevented: e.defaultPrevented,
      })
    );
  });
  await page.locator('#battlefield').focus();
}
for (const shortcut of ['Control+f', 'Meta+f', 'Alt+f'])
  test(`${shortcut} remains a browser shortcut without a Heal command`, async ({ page }, info) => {
    await setup(page);
    await page.keyboard.press(shortcut);
    const reading = await page.evaluate(() => (window as any).__MODIFIER_INPUT__.reading);
    writeFileSync(
      info.outputPath('modifier-shortcut.json'),
      JSON.stringify({ shortcut, ...reading }, null, 2) + '\n'
    );
    expect(reading.events.some((e: any) => e.key === 'f')).toBe(true);
    expect(reading.commands).toEqual([]);
    expect(reading.unlocks).toBe(0);
    expect(reading.events.find((e: any) => e.key === 'f').prevented).toBe(false);
  });
test('Ctrl learning stays reserved while normal game keys still dispatch', async ({
  page,
}, info) => {
  await setup(page);
  for (const key of ['q', 'w', 'e', 'r']) {
    await page.keyboard.press(`Control+${key}`);
    // Synthetic repeats exercise preventDefault without asking the browser to
    // repeatedly close/reload its own tab if the reservation regresses.
    await page.evaluate(
      (key) =>
        document
          .querySelector('#battlefield')!
          .dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              ctrlKey: true,
              repeat: true,
              bubbles: true,
              cancelable: true,
            })
          ),
      key
    );
  }

  const learning = await page.evaluate(() => (window as any).__MODIFIER_INPUT__.reading);
  expect(learning.commands.map((c: any) => [c.type, c.ability])).toEqual(
    ['q', 'w', 'e', 'r'].map((k) => ['learn', k])
  );
  expect(
    learning.events
      .filter((e: any) => ['q', 'w', 'e', 'r'].includes(e.key))
      .every((e: any) => e.prevented)
  ).toBe(true);
  await page.keyboard.press('f');
  const final = await page.evaluate(() => (window as any).__MODIFIER_INPUT__.reading);
  expect(final.commands.map((c: any) => c.type)).toEqual([
    'learn',
    'learn',
    'learn',
    'learn',
    'cast',
  ]);
  expect(final.unlocks).toBe(1);
  await page.evaluate(() => {
    const g = (window as any).__MODIFIER_INPUT__;
    g.hud.paused = true;
    document
      .querySelector('#battlefield')!
      .dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'r',
          ctrlKey: true,
          repeat: true,
          bubbles: true,
          cancelable: true,
        })
      );
  });
  const paused = await page.evaluate(() => (window as any).__MODIFIER_INPUT__.reading);
  expect(paused.commands).toEqual(final.commands);
  expect(paused.events.at(-1).prevented).toBe(false);
  writeFileSync(
    info.outputPath('modifier-learning.json'),
    JSON.stringify({ learning, final, paused }, null, 2) + '\n'
  );
});
