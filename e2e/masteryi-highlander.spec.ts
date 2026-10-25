import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const phase of ['slow-immunity', 'meditate-pause', 'takedown-extension'] as const) {
  test(`Highlander ${phase} retains independent clocks and source bones through real private Save/reload`, async ({
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
      w.gainExperience(1e6, yi.id);
      for (const ability of ['w', 'e', 'r'])
        if (w.learnSpell(ability, yi.id) !== null) throw new Error('Cannot learn own spell');
      const cast = (ability: string) => {
        w.enqueue({ type: 'cast', unit: yi.id, ability, point: yi });
        w.step();
      };
      yi.slowUntil = w.tick + 1000;
      yi.slowMultiplier = 0.2;
      cast('r');
      cast('e');
      if (phase === 'meditate-pause') {
        yi.hp = 100;
        cast('w');
        w.step(135);
      } else if (phase === 'takedown-extension') {
        w.step(25);
        const target = w.spawn('champion', 'red', { x: yi.x + 150, y: yi.y }, 'lux');
        target.ai = false;
        w.damage(yi, target, 1e9, 'true');
      } else {
        w.setOrder(yi, { type: 'move', point: { x: yi.x + 500, y: yi.y } });
        w.step(25);
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
        highlander: structuredClone(state.highlander),
        speed: w.movementSpeed(yi),
        slow: w.slowFactor(yi),
        multiplier: w.attackSpeedMultiplier(yi, undefined),
        empowerment: structuredClone(state.wujuStyle),
        child: structuredClone(state.doubleStrike),
        cycle: structuredClone(yi.attackCycle),
        attackTick: model.animationAttackTick,
        tick: w.tick,
        hp: yi.hp,
      };
    }, phase);
    expect(before.highlander).not.toBeNull();
    expect(before.bones).toHaveLength(90 * 16);
    expect(before.bones.every(Number.isFinite)).toBe(true);
    expect(before.slow).toBe(1);
    expect(before.speed).toBeCloseTo(355 * 1.4);
    expect(before.multiplier).toBeGreaterThan(1);
    if (phase === 'meditate-pause') {
      expect(before.channel.stopTick).toBeNull();
      expect(before.highlander.pausedTicks).toBe(135);
      expect(before.empowerment.pausedTicks).toBe(135);
      expect(before.clip).toBe('spell2_loop');
    } else if (phase === 'takedown-extension') {
      expect(before.highlander.extensionCount).toBe(1);
      expect(before.highlander.endTick - before.highlander.startTick).toBe(840);
    } else {
      expect(before.highlander.extensionCount).toBe(0);
      expect(before.clip).toBe('run');
    }
    await page.screenshot({ path: info.outputPath(`highlander-${phase}.png`) });
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
        empowerment = structuredClone(state.wujuStyle),
        highlander = structuredClone(state.highlander),
        speed = w.movementSpeed(yi),
        slow = w.slowFactor(yi);
      w.step(300);
      return {
        saved,
        future: w.snapshot(),
        channel,
        empowerment,
        highlander,
        speed,
        slow,
        bones,
        clip: model.actionName,
        paused: g.hud.paused,
      };
    }, before.id);
    expect(after.paused).toBe(true);
    expect(after.saved).toBe(before.saved);
    expect(after.future).toBe(before.future);
    expect(after.channel).toEqual(before.channel);
    expect(after.highlander).toEqual(before.highlander);
    expect(after.speed).toBe(before.speed);
    expect(after.slow).toBe(before.slow);
    expect(after.empowerment).toEqual(before.empowerment);
    expect(after.bones).toEqual(before.bones);
    expect(after.clip).toBe(before.clip);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('highlander-reload.json'),
      JSON.stringify({ phase, before, after, errors }, null, 2) + '\n'
    );
  });
}
