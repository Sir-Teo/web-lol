import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

for (const team of ['blue', 'red'])
  test(`${team} base models align with terrain and inhibitors retain their animated destroyed state`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const initial = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      const structures = w.units.filter(
        (u: any) => u.team === team && ['inhibitor', 'nexus'].includes(u.kind)
      );
      const nexus = structures.find((u: any) => u.kind === 'nexus');
      w.reveal = { point: { x: nexus.x, y: nexus.y }, endTick: Infinity };
      v.center = { x: nexus.x, y: nexus.y };
      v.locked = false;
      v.zoom = 0.8;
      w.tick += 8;
      v.render(w, 1, 10);
      g.hud.update(60);
      return structures.map((u: any) => {
        const m = v.models.get(u.id);
        return {
          kind: u.kind,
          asset: m.referenceAsset,
          ground: m.root.position.y,
          expectedGround: u.structureTransform[13] * 0.01,
          intact: m.submeshes.filter((o: any) => o.visible).map((o: any) => o.userData.submesh),
          bar: m.barHeight,
        };
      });
    }, team);
    expect(initial).toHaveLength(4);
    for (const u of initial) {
      expect(u.asset).toBe(`${team}-${u.kind}`);
      expect(u.ground).toBeCloseTo(u.expectedGround, 8);
      expect(u.intact).toHaveLength(1);
      expect(u.intact).not.toContain('Destroyed');
      expect(u.bar).toBe(u.kind === 'nexus' ? 5 : 3.7);
    }
    await page.screenshot({ path: `artifacts/browser-${team}-base.png` });
    const result = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      const inhibitor = w.units.find(
        (u: any) => u.team === team && u.kind === 'inhibitor' && u.structure.lane === 'mid'
      );
      // Remove this lane's defenders in their dependency order.
      for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret']) {
        const u = w.units.find(
          (u: any) => u.team === team && u.structure?.role === role && u.structure.lane === 'mid'
        );
        w.damage(w.hero, u, 1e6, 'true');
      }
      w.damage(w.hero, inhibitor, 1e6, 'true');
      w.reveal = { point: inhibitor, endTick: Infinity };
      v.center = { x: inhibitor.x, y: inhibitor.y };
      v.render(w, 1, v.previousElapsed + 0.05);
      const model = v.models.get(inhibitor.id),
        deathDuration = model.actions[model.destroyedClip].getClip().duration;
      const frames = Math.ceil((deathDuration + 0.5) / 0.05);
      for (let i = 0; i < frames; i++) {
        w.step(3);
        v.render(w, 1, v.previousElapsed + 0.05);
      }
      g.hud.update(60);
      return {
        parts: model.submeshes.filter((o: any) => o.visible).map((o: any) => o.userData.submesh),
        action: model.actionName,
        deadIdle: model.deadIdleClip,
        visible: model.root.visible,
        retained: !!w.unit(inhibitor.id),
        barHidden: v.healthBars.get(inhibitor.id).hidden,
      };
    }, team);
    expect(result.parts).toEqual(['Destroyed']);
    expect(result.action).toBe(result.deadIdle);
    expect(result.visible).toBe(true);
    expect(result.retained).toBe(true);
    expect(result.barHidden).toBe(true);
    await page.screenshot({ path: `artifacts/browser-${team}-inhibitor-destroyed.png` });
    expect(errors).toEqual([]);
  });

for (const losingTeam of ['red', 'blue'])
  test(`${losingTeam === 'red' ? 'Victory' : 'Defeat'} freezes gameplay, keeps the destruction animation running, and restarts cleanly`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const target = await page.evaluate((team) => {
      const g = (window as any).__GAME__,
        w = g.world,
        v = g.view;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      w.units = w.units.filter((u: any) => u.id === w.hero.id || u.structure);
      for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor']) {
        const u = w.units.find(
          (u: any) => u.team === team && u.structure?.role === role && u.structure.lane === 'mid'
        );
        w.damage(w.hero, u, 1e6, 'true');
      }
      for (const u of w.units.filter(
        (u: any) => u.team === team && u.structure?.role === 'nexus-turret'
      ))
        w.damage(w.hero, u, 1e6, 'true');
      const nexus = w.units.find((u: any) => u.kind === 'nexus' && u.team === team);
      const point = w.battlefield.reachable(
        { x: nexus.x + 450, y: nexus.y },
        35,
        team === 'red' ? 'blue' : 'red'
      );
      const attacker = team === 'red' ? w.hero : w.spawn('champion', 'red', point);
      Object.assign(attacker, point, { previous: { ...point }, ai: false });
      nexus.hp = 1;
      v.center = { x: nexus.x, y: nexus.y };
      v.locked = false;
      w.reveal = { point: { x: nexus.x, y: nexus.y }, endTick: Infinity };
      w.tick += 8;
      v.render(w, 1, 10);
      g.hud.update(60);
      g.setPaused(false);
      if (team === 'blue')
        w.enqueue({
          type: 'order',
          unit: attacker.id,
          order: { type: 'attack', target: nexus.id },
        });
      return { id: nexus.id, screen: v.screenPoint(nexus, 1.8) };
    }, losingTeam);
    if (losingTeam === 'red')
      await page.mouse.click(target.screen.x, target.screen.y, { button: 'right' });
    await expect(
      page.getByRole('heading', { name: losingTeam === 'red' ? 'Victory' : 'Defeat', exact: true })
    ).toBeVisible();
    const before = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return { tick: w.tick, winner: w.winner };
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('w');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Download current match' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const g = (window as any).__GAME__,
            m = g.view.models.get(id);
          return m.actions[m.destroyedClip].time;
        }, target.id)
      )
      .toBeGreaterThan(0.5);
    const after = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return { tick: w.tick, winner: w.winner, commands: w.commands.length };
    });
    expect(after).toEqual({ ...before, commands: 0 });
    await expect(page.locator('.floating-layer')).toBeHidden();
    const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download current match' }).click();
    const download = await pendingDownload;
    expect(await readFile((await download.path())!, 'utf8')).toBe(saved);
    expect(
      await page.evaluate((text) => {
        const w = (window as any).__GAME__.world;
        return w.constructor.fromSnapshot(text, w.battlefield).snapshot();
      }, saved)
    ).toBe(saved);
    await page.screenshot({
      path: `artifacts/browser-${losingTeam === 'red' ? 'victory' : 'defeat'}.png`,
    });
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(
      () => (window as any).__GAME__?.ready && !(window as any).__GAME__.world.winner
    );
    await page.locator('#loading').waitFor({ state: 'detached' });
    await expect(page.locator('#modal')).toBeHidden();
  });
