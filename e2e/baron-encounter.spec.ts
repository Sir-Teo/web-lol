import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__GAME__.world.snapshot());
}
async function stored(page: Page, key: string) {
  return page.evaluate(async (key) => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return readMatch(key);
  }, key);
}
async function pause(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Save match', exact: true })).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
}
async function files(page: Page) {
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
}
async function upload(page: Page, text: string) {
  await page
    .getByLabel('Match file', { exact: true })
    .setInputFiles({ name: 'baron.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('real Baron combat saves, reloads and continues exactly without replacing ordinary practice', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/?scene=fixture');
  await ready(page);
  await pause(page);
  await save(page);
  const ordinary = await snapshot(page);
  expect(await stored(page, 'practice-fixture')).toBe(ordinary);
  expect(requests.filter((u) => u.endsWith('sru-baron-base.glb'))).toHaveLength(0);
  await page.goto('/?scene=fixture&encounter=baron');
  await ready(page);
  const initial = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron');
    return {
      id: b.id,
      hp: b.hp,
      maxHp: b.maxHp,
      damage: b.damage,
      armor: b.armor,
      magicResist: b.magicResist,
      point: g.view.screenPoint(b, 0.65),
      encounter: w.encounter,
    };
  });
  expect(initial).toMatchObject({
    encounter: 'baron',
    hp: 17791.75,
    maxHp: 17791.75,
    damage: 350.5,
    armor: 104.2,
    magicResist: 67.1,
  });
  await page.mouse.click(initial.point.x, initial.point.y, { button: 'right' });
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const w = (window as any).__GAME__.world,
            b = w.unit(id);
          return b.hp < b.maxHp && w.hero.hp < w.hero.maxHp;
        }, initial.id),
      { timeout: 20000 }
    )
    .toBe(true);
  await page.keyboard.press('s');
  await pause(page);
  const checkpoint = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.unit(id),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      saved,
      future: copy.snapshot(),
      boss: { x: b.x, y: b.y, hp: b.hp },
      heroHp: w.hero.hp,
    };
  }, initial.id);
  expect(checkpoint.heroHp).toBeGreaterThan(0);
  expect(checkpoint.boss).toMatchObject({ x: 450, y: 0 });
  await save(page);
  expect(await stored(page, 'development-baron-encounter')).toBe(checkpoint.saved);
  expect(await stored(page, 'practice-fixture')).toBe(ordinary);
  await page.reload();
  await ready(page);
  expect(await snapshot(page)).toBe(checkpoint.saved);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: info.outputPath('baron-combat-restored.png') });
  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return w.snapshot();
  });
  expect(future).toBe(checkpoint.future);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-combat-save.json'),
    JSON.stringify(
      { initial, checkpoint, futureExact: true, ordinarySavePreserved: true, errors },
      null,
      2
    )
  );
});

test('Baron match files reject an ordinary host and import exactly into their private scene', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&encounter=baron');
  await ready(page);
  await pause(page);
  await page.evaluate(() => (window as any).__GAME__.world.step(61));
  const expected = await snapshot(page);
  await files(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current match' }).click();
  const downloaded = await pending;
  const text = await readFile((await downloaded.path())!, 'utf8');
  expect(text).toBe(expected);
  await downloaded.saveAs(info.outputPath('baron-match.json'));
  await page.goto('/?scene=fixture');
  await ready(page);
  await pause(page);
  const ordinary = await snapshot(page),
    ordinaryStored = await stored(page, 'practice-fixture');
  await files(page);
  await upload(page, text);
  await expect(page.locator('.file-status')).toContainText('Baron');
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeHidden();
  expect(await snapshot(page)).toBe(ordinary);
  expect(await stored(page, 'practice-fixture')).toBe(ordinaryStored);
  await page.goto('/?scene=fixture&encounter=baron');
  await ready(page);
  await pause(page);
  await files(page);
  await upload(page, text);
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeVisible();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Load this match', exact: true }).click();
  await reloaded;
  await ready(page);
  expect(await snapshot(page)).toBe(expected);
  expect(await stored(page, 'development-baron-encounter')).toBe(expected);
  expect(await stored(page, 'practice-fixture')).toBe(ordinaryStored);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-file-roundtrip.json'),
    JSON.stringify(
      { exact: true, ordinaryHostRejected: true, ordinarySavePreserved: true, errors },
      null,
      2
    )
  );
});

test('default Smite casts at Baron and a cleared save reloads without the private rig or a ghost unit', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/?scene=fixture&encounter=baron&npc=masteryi');
  await ready(page);
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron');
    return { id: b.id, hp: b.hp, spell: w.player.summoners.f, point: g.view.screenPoint(b, 0.65) };
  });
  expect(state.spell).toBe('smite');
  await page.mouse.move(state.point.x, state.point.y);
  await page.keyboard.press('f');
  await expect
    .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, state.id), {
      timeout: 20000,
    })
    .toBe(state.hp - 600);
  await pause(page);
  const death = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.unit(id),
      reward = { gold: w.player.gold, xp: w.player.xp, cs: w.player.cs };
    w.damage(w.hero, b, b.hp + 1, 'true');
    w.step(24);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      reward,
      after: { gold: w.player.gold, xp: w.player.xp, cs: w.player.cs },
      hp: b.hp,
      corpse: b.corpseLifetimeTicks,
    };
  }, state.id);
  expect(death.hp).toBe(0);
  expect(death.after).toEqual(death.reward);
  await page.screenshot({ path: info.outputPath('baron-death.png') });
  const cleared = await page.evaluate(
    ({ id, corpse }) => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.step(corpse + 1);
      g.view.render(w, 1, g.view.previousElapsed);
      return { snapshot: w.snapshot(), unit: w.unit(id) ?? null, model: g.view.models.has(id) };
    },
    { id: state.id, corpse: death.corpse }
  );
  expect(cleared.unit).toBeNull();
  expect(cleared.model).toBe(false);
  await save(page);
  const count = requests.filter((u) => u.endsWith('/sru-baron-base.glb')).length;
  await page.reload();
  await ready(page);
  expect(await snapshot(page)).toBe(cleared.snapshot);
  expect(requests.filter((u) => u.endsWith('/sru-baron-base.glb'))).toHaveLength(count);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-smite-clear.json'),
    JSON.stringify({ state, death, cleared, count, errors }, null, 2)
  );
});
