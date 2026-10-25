import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const entry = '/?scene=fixture&champion=ahri';
async function ready(page: Page, url = entry) {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function setup(page: Page, learn = true) {
  await ready(page);
  await expect(page.locator('.champion-title strong')).toHaveText('AHRI');
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.battlefield.lineOfSight = () => true;
    w.battlefield.inBrush = () => false;
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      champion: w.hero.champion,
      mana: w.hero.maxMana,
      damage: w.hero.damage,
      context: w.battlefield.developmentAhri,
      serializedContext: JSON.parse(w.snapshot()).developmentAhri ?? null,
    };
  });
  if (learn) {
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.world.gainExperience(1e6);
      g.hud.update(60);
    });
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    for (const a of ['q', 'w', 'e', 'r']) {
      await page.locator(`[data-learn="${a}"]`).click();
      await page.evaluate(() => {
        const g = (window as any).__GAME__;
        g.world.step();
        g.hud.update(60);
      });
    }
  }
  return result;
}
async function aimAt(page: Page, x = 650, y = 0) {
  const p = await page.evaluate(({ x, y }) => (window as any).__GAME__.view.screenPoint({ x, y }), {
    x,
    y,
  });
  await page.mouse.move(p.x, p.y);
}
async function step(page: Page, n = 1) {
  await page.evaluate((n) => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(n);
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.hud.update(60);
  }, n);
}
async function save(page: Page) {
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
}
async function loaded(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}

test('Ahri player owns the HUD, local Q guide and committed keyboard cast', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const initial = await setup(page);
  expect(initial).toEqual({
    champion: 'ahri',
    mana: 418,
    damage: 53,
    context: true,
    serializedContext: null,
  });
  await expect(page.locator('.champion-title')).toContainText('THE NINE-TAILED FOX');
  await expect(page.locator('.focus-pips')).toHaveCount(0);
  await expect(page.locator('.resource.mana')).toBeVisible();
  await expect(page.locator('#ahri-essence')).toHaveText('0 / 9');
  const icons = await page.locator('[data-ability] img').evaluateAll((images) =>
    images.slice(0, 4).map((i) => ({
      src: i.getAttribute('src'),
      loaded: (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
    }))
  );
  expect(icons.map((i) => i.src)).toEqual([
    'assets/icons/AhriQ.png',
    'assets/icons/AhriW.png',
    'assets/icons/AhriE.png',
    'assets/icons/AhriR.png',
  ]);
  expect(icons.every((i) => i.loaded)).toBe(true);
  for (const rank of [2, 3, 4]) {
    await page.locator('[data-learn="e"]').click();
    await page.waitForFunction(
      (rank) => (window as any).__GAME__.world.player.spellRanks.e === rank,
      rank
    );
    if (rank === 2 || rank === 4) {
      await page.locator('[data-ability="e"]').hover();
      await expect(page.locator('#ability-tooltip')).toContainText(
        rank === 2 ? '1.35 seconds' : '1.65 seconds'
      );
    }
  }
  await page.locator('[data-ability="q"]').hover();
  await expect(page.locator('#ability-tooltip')).toContainText('true damage');
  await expect(page.locator('#ability-tooltip')).not.toContainText('Focus');
  await aimAt(page);
  await page.keyboard.down('q');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(5);
  const held = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      mode: g.view.aimMode,
      pending: g.world.player.pendingCast,
      cooldown: g.world.player.cooldowns.q,
    };
  });
  expect(held).toEqual({ mode: 'q', pending: null, cooldown: 0 });
  await page.screenshot({ path: info.outputPath('ahri-player-q-aim.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('q');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.q)).toBe(0);
  await aimAt(page);
  await page.keyboard.down('q');
  await page.keyboard.up('q');
  await step(page);
  const accepted = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      cast: w.player.pendingCast,
      clip: g.view.models.get(w.hero.id).actionName,
      focus: w.player.qStacks,
      hawkshot: w.player.eCharges,
      saved: w.snapshot(),
    };
  });
  expect(accepted.cast.ability).toBe('q');
  expect(accepted.clip).toBe('spell1');
  expect(accepted.focus).toBe(0);
  expect(accepted.hawkshot).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-player-q.json'),
    JSON.stringify({ initial, icons, held, accepted, errors }, null, 2)
  );
});

test('W is instant, E/R use their own guides and R charge feedback follows free recasts and Essence', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await setup(page);
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      t = w.spawn('dummy', 'red', { x: 650, y: 0 });
    t.hp = t.maxHp = 10000;
    t.magicResist = 0;
  });
  await aimAt(page);
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await step(page);
  const wCast = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      mode: g.view.aimMode,
      fires: g.world.ahriFoxFires[0].fires.length,
      clip: g.view.models.get(g.world.hero.id).actionName,
    };
  });
  expect(wCast).toEqual({ mode: null, fires: 3, clip: 'spell2' });
  await step(page, 20);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await aimAt(page);
  await page.keyboard.down('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(5);
  await page.keyboard.up('e');
  await step(page);
  const eCast = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      cast: g.world.player.pendingCast,
      clip: g.view.models.get(g.world.hero.id).actionName,
    };
  });
  expect(eCast.cast.ability).toBe('e');
  expect(eCast.clip).toBe('spell3_north');
  await step(page, 15);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await aimAt(page);
  await page.keyboard.down('r');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(35);
  await page.screenshot({ path: info.outputPath('ahri-player-r-aim.png') });
  await page.keyboard.up('r');
  await step(page);
  await expect(page.locator('[data-ability="r"] .ability-charges')).toHaveText('2');
  await expect(page.locator('[data-ability="r"] .ability-cost')).toHaveText('');
  const first = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      rush: g.world.ahriRushes[0],
      cooldown: g.world.player.cooldowns.r,
      clip: g.view.models.get(g.world.hero.id).actionName,
    };
  });
  expect(first.clip).toBe('spell4');
  await step(page, 60);
  await expect(page.locator('[data-ability="r"] .cooldown-text')).toHaveText('RECAST');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await aimAt(page);
  await page.keyboard.down('r');
  await page.keyboard.up('r');
  await step(page);
  await expect(page.locator('[data-ability="r"] .ability-charges')).toHaveText('1');
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    for (let n = 0; n < 8; n++) {
      const t = w.spawn('melee', 'red', { x: w.hero.x + 300, y: w.hero.y });
      t.ai = false;
      t.goldBounty = t.experienceBounty = 0;
      w.damage(w.hero, t, 1e6, 'true');
    }
    const target = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y }, 'lux');
    target.ai = false;
    w.damage(w.hero, target, 1e6, 'true');
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { rush: w.ahriRushes[0], counter: w.ahriCounters[0], cooldown: w.player.cooldowns.r };
  });
  expect(restored.rush.remainingCasts).toBe(2);
  expect(restored.rush.resets).toHaveLength(1);
  expect(restored.cooldown).toBe(first.cooldown);
  await expect(page.locator('#ahri-essence')).toHaveText('8 / 9');
  await expect(page.locator('[data-ability="r"] .ability-charges')).toHaveText('2');
  await page.screenshot({ path: info.outputPath('ahri-player-resources.png') });
  writeFileSync(
    info.outputPath('ahri-player-controls.json'),
    JSON.stringify({ wCast, eCast, first, restored }, null, 2)
  );
});

for (const phase of ['q-windup', 'r-reset'] as const) {
  test(`Ahri player ${phase} survives actual private save and reload`, async ({ page }, info) => {
    test.setTimeout(120000);
    await setup(page);
    await aimAt(page);
    await page.keyboard.down(phase === 'q-windup' ? 'q' : 'r');
    await page.keyboard.up(phase === 'q-windup' ? 'q' : 'r');
    await step(page);
    const expected = await page.evaluate((phase) => {
      const g = (window as any).__GAME__,
        w = g.world;
      if (phase === 'r-reset') {
        const t = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y }, 'lux');
        t.ai = false;
        w.damage(w.hero, t, 1e6, 'true');
        w.step(25);
      }
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(300);
      return {
        saved,
        future: copy.snapshot(),
        champion: w.hero.champion,
        pending: w.player.pendingCast?.ability ?? null,
        rush: w.ahriRushes[0] ?? null,
      };
    }, phase);
    expect(expected.pending).toBe(phase === 'q-windup' ? 'q' : null);
    if (phase === 'r-reset') {
      expect(expected.rush.remainingCasts).toBe(3);
      expect(expected.rush.resets).toHaveLength(1);
    }
    await save(page);
    await page.reload();
    await loaded(page);
    const result = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world,
        saved = w.snapshot();
      w.step(300);
      return { saved, future: w.snapshot(), champion: w.hero.champion, paused: g.hud.paused };
    });
    expect(result.saved).toBe(expected.saved);
    expect(result.future).toBe(expected.future);
    expect(result.champion).toBe('ahri');
    expect(result.paused).toBe(true);
    writeFileSync(
      info.outputPath(`ahri-player-${phase}-reload.json`),
      JSON.stringify({ phase, expected, result }, null, 2)
    );
  });
}

test('private save and restart preserve Ahri while leaving the ordinary fixture save exact', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await ready(page, '/?scene=fixture');
  const ordinary = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 7777;
    g.world.step(17);
    return g.world.snapshot();
  });
  await save(page);
  await ready(page);
  const privateSaved = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 8888;
    g.world.step(5);
    return g.world.snapshot();
  });
  expect(
    JSON.parse(privateSaved).units.find((u: any) => u.id === JSON.parse(privateSaved).player.id)
      .champion
  ).toBe('ahri');
  await save(page);
  await ready(page, '/?scene=fixture');
  const normalRestored = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(normalRestored).toBe(ordinary);
  await ready(page);
  const privateRestored = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  expect(privateRestored).toBe(privateSaved);
  if (!(await page.getByRole('button', { name: 'Restart practice', exact: true }).isVisible()))
    await page.locator('#pause-button').click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart practice', exact: true }).click(),
  ]);
  await loaded(page);
  const restarted = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return {
      champion: g.world.hero.champion,
      gold: g.world.player.gold,
      ranks: g.world.player.spellRanks,
      counter: g.world.ahriCounters[0],
    };
  });
  expect(restarted.champion).toBe('ahri');
  expect(restarted.gold).toBe(500);
  expect(restarted.ranks).toEqual({ q: 0, w: 0, e: 0, r: 0 });
  expect(restarted.counter.stacks).toBe(0);
  writeFileSync(
    info.outputPath('ahri-player-save-isolation.json'),
    JSON.stringify({ ordinary, privateSaved, normalRestored, privateRestored, restarted }, null, 2)
  );
});

test('file controls reject another champion in Ahri practice and reject Ahri player files in ordinary practice', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await setup(page, false);
  const files = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return { ahri: w.snapshot(), ashe: new w.constructor(false, w.battlefield).snapshot() };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ashe.json',
    mimeType: 'application/json',
    buffer: Buffer.from(files.ashe),
  });
  await expect(page.locator('.file-status')).toContainText('Ahri match files only');
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeHidden();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(files.ahri);
  await page.locator('input[type=file]').setInputFiles({
    name: 'ahri.json',
    mimeType: 'application/json',
    buffer: Buffer.from(files.ahri),
  });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match', exact: true }).click(),
  ]);
  await loaded(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(files.ahri);
  await ready(page, '/?scene=fixture');
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return g.world.snapshot();
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'ahri.json',
    mimeType: 'application/json',
    buffer: Buffer.from(files.ahri),
  });
  await expect(page.locator('.file-status')).toContainText('Ahri');
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeHidden();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(before);
  writeFileSync(
    info.outputPath('ahri-player-imports.json'),
    JSON.stringify(
      {
        privateRejectsAshe: true,
        ownLoadExact: true,
        ordinaryRejectsAhri: true,
        currentStatePreserved: true,
      },
      null,
      2
    )
  );
});
