import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function saveReload(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
}
async function modelSample(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      p = w.companions[0],
      entry = v.ownedCompanions.entries.get(p.ownerId),
      root = entry.root,
      forms: string[] = [];
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    root.traverse((o: any) => {
      if (o.isMesh && o.visible) forms.push(o.material.userData.sourceSubmesh);
    });
    const gl = v.renderer.getContext(),
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const read = () => {
      v.renderer.render(v.scene, v.camera);
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const shown = read();
    root.visible = false;
    const hidden = read();
    root.visible = true;
    read();
    let pixels = 0;
    for (let i = 0; i < shown.length; i += 4)
      if (
        shown[i] !== hidden[i] ||
        shown[i + 1] !== hidden[i + 1] ||
        shown[i + 2] !== hidden[i + 2]
      )
        pixels++;
    return {
      forms,
      pixels,
      key: entry.key,
      kind: p.kind,
      fed: p.fed,
      ownsUnit: w.units.some((u: any) => u.kind === 'monster' && u.id === p.ownerId),
    };
  });
}

test('owned companion follows real movement, assists combat and restores its pending strike', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  await page.goto('/?scene=fixture&encounter=gromp&companion=gustwalker');
  await ready(page);
  const move = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.step(180);
    w.hero.hp = w.hero.maxHp / 2;
    const monster = w.units.find((u: any) => u.kind === 'monster');
    monster.stunUntil = w.tick + 100000;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return { point: g.view.screenPoint({ x: 0, y: -300 }, 0), start: { ...w.companions[0] } };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(move.point.x, move.point.y, { button: 'right' });
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world,
      p = w.companions[0];
    const behind = {
      x: w.hero.x - 100 * Math.sin(w.hero.facing),
      y: w.hero.y - 100 * Math.cos(w.hero.facing),
    };
    return (
      Math.hypot(w.hero.x, w.hero.y + 300) < 20 && Math.hypot(p.x - behind.x, p.y - behind.y) < 12
    );
  });
  const attack = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    const u = w.units.find((u: any) => u.kind === 'monster');
    return {
      point: g.view.screenPoint(u, 0.6),
      pet: { ...w.companions[0] },
      hero: { x: w.hero.x, y: w.hero.y, facing: w.hero.facing },
    };
  });
  writeFileSync(
    'artifacts/owned-companion-movement.json',
    JSON.stringify({ move, attack }, null, 2) + '\n'
  );
  expect(Math.hypot(attack.pet.x - move.start.x, attack.pet.y - move.start.y)).toBeGreaterThan(80);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(attack.point.x, attack.point.y, { button: 'right' });
  await page.waitForFunction(() => {
    const g = (window as any).__GAME__;
    if (g.world.companions[0].releaseTick === null) return false;
    g.setPaused(true);
    return true;
  });
  expect((await modelSample(page)).forms).toEqual(['Baby']);
  await saveReload(page);
  const strike = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      p = w.companions[0],
      target = w.unit(p.targetId),
      before = target.hp;
    // The command was real input; isolate its already committed companion release.
    w.setOrder(w.hero, { type: 'idle' });
    const ticks = p.releaseTick - w.tick;
    w.step(ticks);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      delta: before - target.hp,
      heals: w.events.filter((e: any) => e.type === 'heal' && e.value === 12).length,
      release: p.releaseTick,
      target: g.view.screenPoint(target, 0.6),
    };
  });
  expect(strike.delta).toBeGreaterThanOrEqual(40);
  expect(strike.heals).toBeGreaterThan(0);
  expect(strike.release).toBeNull();
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.move(strike.target.x, strike.target.y);
  await page.keyboard.press('f');
  await expect(page.locator('[data-ability="f"] .ability-charges')).toHaveText('0');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/owned-companion-combat.png' });
  await saveReload(page);
  const death = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      monster = w.units.find((u: any) => u.kind === 'monster');
    w.damage(monster, w.hero, 999999, 'true');
    w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    const p = w.companions[0];
    return {
      visible: g.view.ownedCompanions.entries.get(p.ownerId).root.visible,
      target: p.targetId,
      release: p.releaseTick,
    };
  });
  expect(death).toEqual({ visible: false, target: null, release: null });
  await saveReload(page);
  expect(errors).toEqual([]);
});

for (const [kind, skin, icon] of [
  ['gustwalker', 0, 'Utility'],
  ['scorchclaw', 1, 'Offensive'],
  ['mosstomper', 2, 'Defensive'],
] as const)
  test(`${kind} earns both evolutions, restores growth and uses champion/area Smite`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [],
      rigs: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(r.url()));
    page.on('request', (r) => {
      if (/sru-jungle-companions-skin[012]-base\.glb$/.test(r.url())) rigs.push(r.url());
    });
    await page.goto(`/?scene=fixture&encounter=gromp&companion=${kind}`);
    await ready(page);
    await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      for (const u of w.units) {
        u.ai = false;
        u.stunUntil = w.tick + 100000;
      }
      w.step(180);
      g.view.render(w, 1, g.view.previousElapsed);
    });
    const baby = await modelSample(page);
    expect(baby.forms).toEqual(['Baby']);
    expect(baby.pixels).toBeGreaterThan(20);
    expect(baby.ownsUnit).toBe(false);
    await page.screenshot({ path: `artifacts/owned-companion-${kind}-baby.png` });
    const evolve = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      // Feed only through real large-monster death/reward paths, with diagnostic targets.
      for (let i = 0; i < 15; i++) {
        const u = w.spawnMonster({ x: 1500, y: -1500 });
        w.damage(w.hero, u, 999999, 'true');
      }
      w.step();
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      return { ...w.companions[0] };
    });
    expect(evolve.fed).toBe(15);
    expect(evolve.pose.action).toBe('transform');
    await expect(page.locator('[data-ability="f"] img')).toHaveAttribute(
      'src',
      'assets/icons/S5_SummonerSmitePlayerGanker.png'
    );
    await expect(page.locator('#companion-status')).toContainText('Smite 1000');
    await saveReload(page);
    const enemy = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      const u = w.spawn('champion', 'red', { x: 250, y: 100 }, 'lux');
      u.ai = false;
      g.view.render(w, 1, g.view.previousElapsed);
      return { id: u.id, point: g.view.screenPoint(u, 0.6) };
    });
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await page.mouse.move(enemy.point.x, enemy.point.y);
    await page.keyboard.press('f');
    await page.waitForFunction((id) => {
      const g = (window as any).__GAME__,
        u = g.world.unit(id);
      if (!u.slows.some((s: any) => s.kind === 'smite')) return false;
      g.setPaused(true);
      return true;
    }, enemy.id);
    expect(
      await page.evaluate(
        (id) =>
          (window as any).__GAME__.world.events.some(
            (e: any) => e.type === 'damage' && e.unit === id && e.value === 40
          ),
        enemy.id
      )
    ).toBe(true);
    await saveReload(page);
    // Exercise the existing practice reset to ready the next real F cast.
    await page.locator('#practice-button').click();
    await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
    await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
    const pack = await page.evaluate(() => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      for (let i = 0; i < 20; i++) {
        const u = w.spawnMonster({ x: 1500, y: -1500 });
        w.damage(w.hero, u, 999999, 'true');
      }
      w.step();
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      return { fed: w.companions[0].fed, pose: w.companions[0].pose.action };
    });
    expect(pack).toEqual({ fed: 35, pose: 'transform' });
    await expect(page.locator('[data-ability="f"] img')).toHaveAttribute(
      'src',
      `assets/icons/SummonerSmiteAvatar${icon}.png`
    );
    await expect(page.locator('#companion-status')).toContainText('Smite 1400');
    await saveReload(page);
    const adult = await page.evaluate(async () => {
      const g = (window as any).__GAME__,
        w = g.world;
      const { loadReferenceModels } = await import('/src/render/models.ts');
      await loadReferenceModels(['wolf-mini']);
      w.step(360);
      const main = w.units.find((u: any) => u.kind === 'monster' && w.alive(u)),
        small = w.spawnMonster({ x: main.x + 120, y: main.y }, undefined, 'wolf-mini'),
        outside = w.spawnMonster({ x: main.x + 550, y: main.y });
      for (const u of [main, small, outside]) {
        u.hp = u.maxHp = 2000;
        u.stunUntil = w.tick + 100000;
      }
      g.view.render(w, 1, g.view.previousElapsed);
      g.hud.update(60);
      return {
        ids: [main.id, small.id, outside.id],
        point: g.view.screenPoint(main, 0.6),
        charges: w.player.smite.charges,
      };
    });
    const grown = await modelSample(page);
    expect(grown.forms).toEqual(['Adult']);
    expect(grown.pixels).toBeGreaterThan(20);
    await page.screenshot({ path: `artifacts/owned-companion-${kind}-adult.png` });
    await page.evaluate(() => (window as any).__GAME__.setPaused(false));
    await page.mouse.move(adult.point.x, adult.point.y);
    await page.keyboard.press('f');
    await page.waitForFunction((ids) => {
      const g = (window as any).__GAME__;
      if (g.world.unit(ids[0]).hp > 600) return false;
      g.setPaused(true);
      return true;
    }, adult.ids);
    const hits = await page.evaluate((ids) => {
      const w = (window as any).__GAME__.world;
      return { hp: ids.map((id) => w.unit(id).hp), charges: w.player.smite.charges };
    }, adult.ids);
    expect(hits.hp).toEqual([600, 600, 2000]);
    expect(hits.charges).toBe(adult.charges - 1);
    await saveReload(page);
    expect(rigs.every((url) => url.endsWith(`skin${skin}-base.glb`))).toBe(true);
    expect(rigs.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    writeFileSync(
      `artifacts/owned-companion-${kind}-diagnostics.json`,
      JSON.stringify({ baby, grown, hits, rigs }, null, 2) + '\n'
    );
  });
