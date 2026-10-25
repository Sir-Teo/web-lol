import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
for (const mode of ['ordinary', 'critical', 'eclipse', 'canceled'] as const) {
  test(`Leona ${mode} attempt restores its saved history and following combat`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=fixture&champion=leona');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const prepared = await page.evaluate((mode) => {
      const g = (window as any).__GAME__,
        w = g.world,
        u = w.hero,
        s = w.player;
      g.hud.closeModal();
      g.setPaused(true);
      w.units = [u];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 }, ai: false });
      w.setOrder(u, { type: 'idle' });
      w.battlefield.inBrush = () => false;
      w.battlefield.lineOfSight = () => true;
      w.battlefield.lineWalkable = () => true;
      w.battlefield.reachable = (p: any) => ({ ...p });
      w.battlefield.findPath = (_a: any, b: any) => [{ ...b }];
      if (mode === 'critical')
        s.inventory.push('agility', 'agility', 'agility', 'agility', 'agility', 'infinity-edge');
      if (mode === 'eclipse') {
        w.learnSpell('w');
        w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
        w.step();
      }
      const target = w.spawn('siege', 'red', { x: 150, y: 0 });
      target.ai = false;
      target.hp = target.maxHp = 100000;
      w.setOrder(u, { type: 'attack', target: target.id });
      w.step();
      const start = w.tick,
        release = u.releaseTick;
      if (mode === 'canceled') {
        w.step(3);
        w.setOrder(u, { type: 'move', point: { x: 0, y: 500 } });
        w.step();
      } else w.step(release - w.tick + 3);
      const r = s.leonaAAVisuals.find((r: any) => r.startTick === start);
      g.view.locked = false;
      g.view.zoom = 0.6;
      g.view.recenter({ x: 75, y: 0 });
      g.view.render(w, 1, 25.5);
      g.hud.update(60);
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(90);
      return {
        saved,
        future: copy.snapshot(),
        record: r,
        release,
        version: JSON.parse(saved).version,
        gl: g.view.renderer.getContext().getError(),
      };
    }, mode);
    expect(prepared.version).toBe(128);
    expect(prepared.gl).toBe(0);
    expect(prepared.record.targetRig).toBe('red-siege');
    if (mode === 'canceled') {
      expect(prepared.record.cancelTick).not.toBeNull();
      expect(prepared.record.impact).toBeNull();
    } else {
      expect(prepared.record.impact.tick).toBe(prepared.release);
      expect(prepared.record.impact.material).toBe('Metal');
    }
    if (mode === 'critical') expect(prepared.record.kind).toBe('crit');
    if (mode === 'eclipse') expect(prepared.record.kind).toBe('spell2_attack');
    await page.screenshot({ path: info.outputPath('attempt.png') });
    if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
      await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const restored = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      g.hud.closeModal();
      const w = g.world,
        saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(90);
      return { saved, future: copy.snapshot(), gl: g.view.renderer.getContext().getError() };
    });
    expect(restored.saved).toBe(prepared.saved);
    expect(restored.future).toBe(prepared.future);
    expect(restored.gl).toBe(0);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('saved-history.json'),
      JSON.stringify({ mode, prepared, restored, errors }, null, 2)
    );
  });
}
