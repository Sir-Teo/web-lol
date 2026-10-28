import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page, rift = false) {
  await page.goto(rift ? '/' : '/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(false);
    // Isolate camera/input state: retain the actual render/input loop and HUD.
    g.world.step = () => {};
    g.world.commands = [];
    g.view.locked = true;
    const mini = document.querySelector('#minimap')!;
    mini.addEventListener('gotpointercapture', (e) => {
      (window as any).__MINIMAP_POINTER__ = (e as PointerEvent).pointerId;
    });
    return {
      half: g.world.battlefield.half,
      padding: g.world.battlefield.id === 'rift' ? 100 : 500,
      hero: { x: g.world.hero.x, y: g.world.hero.y },
      sound: g.hud.sound,
      snapshot: g.world.snapshot(),
    };
  });
}
async function center(page: Page) {
  return page.evaluate(() => ({ ...(window as any).__GAME__.view.center }));
}
async function expectedCenter(page: Page, x: number, y: number) {
  await expect
    .poll(async () => {
      const p = await center(page);
      return Math.hypot(p.x - x, p.y - y);
    })
    .toBeLessThan(0.01);
}

test('trusted minimap dragging captures the pointer, clamps outside and changes no match state', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const initial = await ready(page, true);
  await page.locator('#sound-button').focus();
  const mini = page.locator('#minimap'),
    box = (await mini.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.75);
  await page.mouse.down();
  await expect(page.locator('#battlefield')).toBeFocused();
  await expectedCenter(page, -initial.half * 0.5, initial.half * 0.5);
  expect(await page.evaluate(() => (window as any).__GAME__.view.locked)).toBe(false);
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, { steps: 4 });
  await expectedCenter(page, initial.half * 0.5, -initial.half * 0.5);
  expect(
    await mini.evaluate((el) => el.hasPointerCapture((window as any).__MINIMAP_POINTER__))
  ).toBe(true);
  await mini.evaluate((el) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 999,
        button: 0,
        buttons: 1,
        isPrimary: false,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      })
    );
    el.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 999,
        buttons: 1,
        isPrimary: false,
        clientX: box.left,
        clientY: box.top,
      })
    );
  });
  await expectedCenter(page, initial.half * 0.5, -initial.half * 0.5);
  await page.screenshot({ path: info.outputPath('dragged-camera.png') });
  await page.mouse.move(box.x - 180, box.y - 180, { steps: 3 });
  await expectedCenter(page, -initial.half + initial.padding, -initial.half + initial.padding);
  await page.mouse.up();
  expect(
    await mini.evaluate((el) => el.hasPointerCapture((window as any).__MINIMAP_POINTER__))
  ).toBe(false);
  const released = await center(page);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  expect(await center(page)).toEqual(released);
  await page.setViewportSize({ width: 1024, height: 720 });
  const small = (await mini.boundingBox())!;
  await page.mouse.move(small.x + small.width * 0.6, small.y + small.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(small.x + small.width * 0.4, small.y + small.height * 0.6);
  await expectedCenter(page, -initial.half * 0.2, initial.half * 0.2);
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath('dragged-camera-1024.png') });
  await page.keyboard.down('Space');
  await expectedCenter(page, initial.hero.x, initial.hero.y);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as any).__GAME__.hud.sound)).toBe(initial.sound);
  const final = await page.evaluate(() => ({
    snapshot: (window as any).__GAME__.world.snapshot(),
    commands: (window as any).__GAME__.world.commands,
  }));
  expect(final.snapshot).toBe(initial.snapshot);
  expect(final.commands).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('drag.json'),
    JSON.stringify(
      { half: initial.half, released, commands: final.commands, snapshotUnchanged: true, errors },
      null,
      2
    )
  );
});

test('minimap drag cancels on pause, modal, blur and capture loss; right-click orders stay distinct', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const initial = await ready(page);
  const mini = page.locator('#minimap'),
    box = (await mini.boundingBox())!;
  const start = async () => {
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await expectedCenter(page, -initial.half * 0.2, -initial.half * 0.2);
  };
  for (const interruption of ['pause', 'modal', 'blur', 'capture', 'cancel']) {
    await start();
    await page.evaluate((mode) => {
      const g = (window as any).__GAME__,
        mini = document.querySelector('#minimap')!;
      if (mode === 'pause') {
        g.setPaused(true);
        g.setPaused(false);
      }
      if (mode === 'modal') {
        g.hud.toggleModal('help');
        g.hud.closeModal();
      }
      if (mode === 'blur') {
        window.dispatchEvent(new Event('blur'));
        g.hud.closeModal();
        g.setPaused(false);
      }
      if (mode === 'capture') mini.releasePointerCapture((window as any).__MINIMAP_POINTER__);
      if (mode === 'cancel')
        mini.dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: (window as any).__MINIMAP_POINTER__ })
        );
    }, interruption);
    const retained = await center(page);
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
    expect(await center(page), interruption).toEqual(retained);
    expect(
      await mini.evaluate((el) => el.hasPointerCapture((window as any).__MINIMAP_POINTER__)),
      interruption
    ).toBe(false);
    await page.mouse.up();
  }
  const retained = await center(page);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6, { button: 'middle' });
  expect(await center(page)).toEqual(retained);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6, { button: 'right' });
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.7, { button: 'right' });
  await page.keyboard.up('Shift');
  const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
  expect(commands).toHaveLength(2);
  expect(commands.map((c: any) => c.order.type)).toEqual(['move', 'attackMove']);
  for (const [index, command] of commands.entries()) {
    expect(command.type).toBe('order');
    expect(command.order.point.x).toBeCloseTo(initial.half * (index ? 0.4 : 0.2), 0);
    expect(command.order.point.y).toBeCloseTo(initial.half * (index ? 0.4 : 0.2), 0);
  }
  expect(await center(page)).toEqual(retained);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('cancellation.json'),
    JSON.stringify(
      {
        interruptions: ['pause', 'modal', 'blur', 'capture', 'cancel'],
        commands,
        retained,
        errors,
      },
      null,
      2
    )
  );
});
