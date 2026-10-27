import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const phase of ['active-loop', 'control-linger', 'reset-child-overlap'] as const) {
  test(`Meditate ${phase} retains independent clocks and source bones through real private Save/reload`, async ({
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
      for (const u of w.units) u.ai = false;
      const yi = w.units.find((u: any) => u.champion === 'masteryi');
      if (w.learnSpell('w', yi.id) !== null) throw new Error('Cannot learn own Meditate');
      const target = w.spawn('dummy', 'red', { x: yi.x + 150, y: yi.y });
      target.hp = target.maxHp = 1e6;
      target.armor = 0;
      const cast = (ability: string) => {
        w.enqueue({ type: 'cast', unit: yi.id, ability, point: yi });
        w.step();
      };
      if (phase === 'reset-child-overlap') {
        for (let i = 0; i < 4; i++) {
          w.setOrder(yi, { type: 'attack', target: target.id });
          w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
          w.step(yi.releaseTick - w.tick);
          w.setOrder(yi, { type: 'idle' });
        }
        cast('w');
        w.gainExperience(1e6, yi.id);
        w.setOrder(yi, { type: 'attack', target: target.id });
        w.step();
        w.step(yi.releaseTick - w.tick);
      } else {
        w.gainExperience(280, yi.id);
        if (w.learnSpell('e', yi.id) !== null) throw new Error('Cannot learn E interaction');
        yi.hp = 100;
        cast('e');
        cast('w');
        w.step(phase === 'active-loop' ? 135 : 10);
        if (phase === 'control-linger') w.applyStun(yi, 60);
      }
      const state = w.championState(yi.id);
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
        id: yi.id,
        bones,
        clip: model.actionName,
        channel: structuredClone(state.meditate),
        empowerment: structuredClone(state.wujuStyle),
        child: structuredClone(state.doubleStrike),
        cycle: structuredClone(yi.attackCycle),
        attackTick: model.animationAttackTick,
        tick: w.tick,
        hp: yi.hp,
      };
    }, phase);
    expect(before.channel).not.toBeNull();
    expect(before.bones).toHaveLength(90 * 16);
    expect(before.bones.every(Number.isFinite)).toBe(true);
    if (phase === 'active-loop') {
      expect(before.channel.stopTick).toBeNull();
      expect(before.empowerment.pausedTicks).toBe(135);
      expect(before.clip).toBe('spell2_loop');
      expect(before.hp).toBeGreaterThan(100);
      await expect(page.locator('.combat-text.heal').first()).toBeVisible();
      for (const label of await page.locator('.combat-text.heal').allTextContents())
        expect(label).toMatch(/^\+\d+$/);
    } else if (phase === 'control-linger') {
      expect(before.channel.stopReason).toBe('control');
      expect(before.empowerment.pausedTicks).toBe(10);
      expect(before.clip).not.toBe('spell2_loop');
    } else {
      expect(before.channel.stopReason).toBe('order');
      expect(before.child.strike.result).toBe('pending');
      expect(before.child.stacks).toBe(1);
      expect(before.child.strike.poseStopTick).toBe(before.channel.startTick);
      expect(before.attackTick).toBe(before.cycle.startTick);
      expect(before.attackTick).not.toBe(before.child.strike.startTick);
      expect(before.clip).toBe('entry_d5c55cfd');
    }
    await page.screenshot({ path: info.outputPath(`meditate-${phase}.png`) });
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await ready();
    const after = await page.evaluate((id) => {
      const g = (window as any).__GAME__,
        w = g.world,
        yi = w.unit(id),
        state = w.championState(id);
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
        channel = structuredClone(state.meditate),
        empowerment = structuredClone(state.wujuStyle);
      w.step(300);
      return {
        saved,
        future: w.snapshot(),
        channel,
        empowerment,
        bones,
        clip: model.actionName,
        paused: g.hud.paused,
      };
    }, before.id);
    expect(after.paused).toBe(true);
    expect(after.saved).toBe(before.saved);
    expect(after.future).toBe(before.future);
    expect(after.channel).toEqual(before.channel);
    expect(after.empowerment).toEqual(before.empowerment);
    expect(after.bones).toEqual(before.bones);
    expect(after.clip).toBe(before.clip);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('meditate-reload.json'),
      JSON.stringify({ phase, before, after, errors }, null, 2) + '\n'
    );
  });
}
