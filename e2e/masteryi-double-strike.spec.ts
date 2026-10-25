import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const phase of ['pending', 'contact', 'recovery'] as const) {
  test(`Double Strike ${phase} retains its source pose through actual private Save/reload`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ready = async () => {
      await page.waitForFunction(() => (window as any).__GAME__?.ready);
      await page.locator('#loading').waitFor({ state: 'detached' });
    };
    await page.goto('/?scene=fixture&npc=masteryi');
    await ready();
    const before = await page.evaluate((phase) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      w.nextWaveTick = Infinity;
      w.pendingSpawns = [];
      for (const unit of w.units) unit.ai = false;
      const yi = w.units.find((u: any) => u.champion === 'masteryi');
      const target = w.spawn('dummy', 'red', { x: yi.x + 150, y: yi.y });
      target.hp = target.maxHp = 1e6;
      target.armor = 0;
      for (let n = 0; n < 4; n++) {
        w.setOrder(yi, { type: 'attack', target: target.id });
        w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
        w.step(yi.releaseTick - w.tick);
        w.setOrder(yi, { type: 'idle' });
      }
      const passive = w.championState(yi.id).doubleStrike;
      if (!passive.strike) throw new Error('Fourth primary failed to commit Double Strike');
      w.step(
        phase === 'pending'
          ? 5
          : passive.strike.releaseTick - w.tick + (phase === 'recovery' ? 8 : 0)
      );
      g.view.zoom = 0.6;
      g.view.recenter(yi);
      g.view.render(w, 1, g.view.previousElapsed);
      const model = g.view.models.get(yi.id);
      model.root.updateMatrixWorld(true);
      const bones: number[] = [];
      model.root.traverse((o: any) => {
        if (o.isBone) bones.push(...o.matrixWorld.toArray());
      });
      const saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(300);
      return {
        saved,
        future: copy.snapshot(),
        bones,
        clip: model.actionName,
        attackTick: model.animationAttackTick,
        id: yi.id,
        tick: w.tick,
        passive: structuredClone(passive),
        damage: target.maxHp - target.hp,
        projectiles: w.projectiles.filter((p: any) => p.source === yi.id).length,
      };
    }, phase);
    expect(before.clip).toBe('entry_85dac0b3');
    expect(before.attackTick).toBe(before.passive.strike.startTick);
    expect(before.bones).toHaveLength(90 * 16);
    expect(before.bones.every(Number.isFinite)).toBe(true);
    expect(before.projectiles).toBe(0);
    expect(before.damage).toBe(phase === 'pending' ? 260 : 292.5);
    expect(before.passive.strike.result).toBe(phase === 'pending' ? 'pending' : 'hit');
    await page.screenshot({ path: info.outputPath(`double-strike-${phase}.png`) });
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready();
    const after = await page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world,
        yi = w.unit(id);
      g.view.zoom = 0.6;
      g.view.recenter(yi);
      g.view.render(w, 1, g.view.previousElapsed);
      const model = g.view.models.get(id);
      model.root.updateMatrixWorld(true);
      const bones: number[] = [];
      model.root.traverse((o: any) => {
        if (o.isBone) bones.push(...o.matrixWorld.toArray());
      });
      const saved = w.snapshot(),
        passive = structuredClone(w.championState(id).doubleStrike);
      w.step(300);
      return {
        saved,
        future: w.snapshot(),
        bones,
        clip: model.actionName,
        attackTick: model.animationAttackTick,
        passive,
        paused: g.hud.paused,
      };
    }, before.id);
    expect(after.paused).toBe(true);
    expect(after.saved).toBe(before.saved);
    expect(after.future).toBe(before.future);
    expect(after.bones).toEqual(before.bones);
    expect(after.clip).toBe(before.clip);
    expect(after.attackTick).toBe(before.attackTick);
    expect(after.passive).toEqual(before.passive);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('double-strike-reload.json'),
      JSON.stringify({ phase, before, after, errors }, null, 2) + '\n'
    );
  });
}
