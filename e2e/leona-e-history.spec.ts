import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const [phase, age] of [
  ['windup', 7],
  ['flight', 20],
  ['dash', 43],
  ['arrival', 75],
] as const) {
  test(`Zenith ${phase} survives the ordinary browser save, reload and following combat`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=fixture&npc=leona');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const prepared = await page.evaluate((age) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      const u = w.units.find((u: any) => u.champion === 'leona');
      w.units = [w.hero, u];
      w.pendingSpawns = [];
      w.nextWaveTick = Infinity;
      Object.assign(w.hero, { x: -3000, y: -3000, previous: { x: -3000, y: -3000 } });
      Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
      const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
      target.hp = target.maxHp = 100000;
      for (const v of w.units) v.ai = false;
      if (!w.championState(u.id).spellRanks.e) w.learnSpell('e', u.id);
      const startTick = w.tick + 1;
      w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
      w.step(age + 1);
      const history = structuredClone(w.championState(u.id).leonaEVisuals[0]);
      const saved = w.snapshot();
      const invalid = JSON.parse(saved);
      invalid.otherChampions.find((o: any) => o.id === u.id).leonaEVisuals[0].frames.pop();
      let rejected = false;
      try {
        w.constructor.fromSnapshot(JSON.stringify(invalid), w.battlefield);
      } catch {
        rejected = true;
      }
      w.step(90);
      const future = w.snapshot();
      Object.assign(w, w.constructor.fromSnapshot(saved, w.battlefield));
      return { saved, future, history, caster: u.id, rejected, startTick };
    }, age);
    expect(prepared.rejected).toBe(true);
    expect(prepared.history.startTick).toBe(prepared.startTick);
    if (phase === 'windup') expect(prepared.history.flight).toBeNull();
    if (phase === 'flight') expect(prepared.history.flight.stopTick).toBeNull();
    if (phase === 'dash') expect(prepared.history.dash.stopTick).toBeNull();
    if (phase === 'arrival') expect(prepared.history.arrival).not.toBeNull();
    if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
      await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const result = await page.evaluate((caster) => {
      const g = (window as any).__GAME__,
        w = g.world;
      g.setPaused(true);
      const saved = w.snapshot();
      const history = structuredClone(w.championState(caster).leonaEVisuals[0]);
      w.step(90);
      return { saved, history, future: w.snapshot() };
    }, prepared.caster);
    expect(result.saved).toBe(prepared.saved);
    expect(result.history).toEqual(prepared.history);
    expect(result.future).toBe(prepared.future);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('evidence.json'),
      JSON.stringify({ phase, age, prepared, result, errors }, null, 2)
    );
  });
}
