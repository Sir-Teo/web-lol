import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

for (const phase of ['child-vanished', 'marked-vanished', 'recovery-buffer'] as const) {
  test(`Alpha Strike ${phase} survives real private Save/reload and reveals its own rig`, async ({
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
      for (const u of w.units.filter((u: any) => u.kind === 'dummy' && u.team === 'red'))
        w.damage(yi, u, 1e9, 'true');
      w.gainExperience(1e6, yi.id);
      for (const a of ['q', 'e', 'r'])
        if (w.learnSpell(a, yi.id) !== null) throw new Error('Cannot learn own ' + a);
      const target = w.spawn('dummy', 'red', { x: yi.x + 150, y: yi.y });
      target.hp = target.maxHp = 1e6;
      target.armor = 0;
      const cast = (a: string) => {
        w.enqueue({
          type: 'cast',
          unit: yi.id,
          ability: a,
          point: target,
          ...(a === 'q' ? { targetId: target.id } : {}),
        });
        w.step();
      };
      if (phase === 'child-vanished')
        for (let i = 0; i < 4; i++) {
          w.setOrder(yi, { type: 'attack', target: target.id });
          w.step(Math.max(1, yi.nextAttackTick - w.tick + 1));
          w.step(yi.releaseTick - w.tick);
          w.setOrder(yi, { type: 'idle' });
        }
      cast('e');
      cast('r');
      cast('q');
      w.step(phase === 'child-vanished' ? 7 : phase === 'marked-vanished' ? 31 : 60);
      if (phase === 'recovery-buffer')
        w.setOrder(yi, { type: 'move', point: { x: yi.x + 500, y: yi.y } });
      g.view.zoom = 0.6;
      g.view.recenter(yi);
      g.view.render(w, 1, g.view.previousElapsed);
      const model = g.view.models.get(yi.id),
        visible = model.root.visible;
      const bones: number[] = [];
      if (visible) {
        model.root.updateMatrixWorld(true);
        model.root.traverse((o: any) => {
          if (o.isBone) bones.push(...o.matrixWorld.toArray());
        });
      }
      const state = w.championState(yi.id),
        saved = w.snapshot(),
        copy = w.constructor.fromSnapshot(saved, w.battlefield);
      copy.step(300);
      const bar = document.querySelector(`[data-unit="${yi.id}"].unit-bar`) as HTMLElement | null;
      return {
        phase,
        id: yi.id,
        saved,
        future: copy.snapshot(),
        visible,
        bones,
        clip: model.actionName,
        q: structuredClone(state.alphaStrike),
        e: structuredClone(state.wujuStyle),
        r: structuredClone(state.highlander),
        child: structuredClone(state.doubleStrike),
        barHidden: !bar || bar.hidden,
        tick: w.tick,
      };
    }, phase);
    expect(before.q).not.toBeNull();
    expect(before.q.rank).toBe(1);
    if (phase === 'recovery-buffer') {
      expect(before.visible).toBe(true);
      expect(before.bones).toHaveLength(90 * 16);
      expect(before.bones.every(Number.isFinite)).toBe(true);
      expect(before.q.marks.map((m: any) => m.result)).toEqual(['hit', 'hit', 'hit', 'hit']);
      expect(before.q.resumeOrder.type).toBe('move');
      expect(before.q.reappearTick).not.toBeNull();
      expect(before.clip).not.toBe('spell1');
    } else {
      expect(before.visible).toBe(false);
      expect(before.barHidden).toBe(true);
      expect(before.q.reappearTick).toBeNull();
      if (phase === 'child-vanished') {
        expect(before.q.marks).toEqual([]);
        expect(before.child.strike.result).toBe('pending');
        expect(before.child.strike.poseStopTick).toBe(before.q.startTick);
      } else expect(before.q.marks.map((m: any) => m.result)).toEqual(['pending', 'hit']);
      // Hidden cached bones are not an observable pose; reveal is checked below.
      expect(before.bones).toEqual([]);
    }
    expect(before.e.pausedTicks).toBe(
      phase === 'child-vanished' ? 7 : phase === 'marked-vanished' ? 31 : 56
    );
    expect(before.r.pausedTicks).toBe(before.e.pausedTicks);
    await page.screenshot({ path: info.outputPath(`alpha-${phase}.png`) });
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
      const model = g.view.models.get(id),
        visible = model.root.visible,
        bones: number[] = [];
      if (visible) {
        model.root.updateMatrixWorld(true);
        model.root.traverse((o: any) => {
          if (o.isBone) bones.push(...o.matrixWorld.toArray());
        });
      }
      const saved = w.snapshot(),
        q = structuredClone(state.alphaStrike),
        e = structuredClone(state.wujuStyle),
        r = structuredClone(state.highlander);
      w.step(300);
      g.view.render(w, 1, g.view.previousElapsed);
      model.root.updateMatrixWorld(true);
      const revealed: number[] = [];
      model.root.traverse((o: any) => {
        if (o.isBone) revealed.push(...o.matrixWorld.toArray());
      });
      return {
        saved,
        future: w.snapshot(),
        q,
        e,
        r,
        visible,
        bones,
        clip: model.actionName,
        paused: g.hud.paused,
        revealedVisible: model.root.visible,
        revealed,
      };
    }, before.id);
    expect(after.paused).toBe(true);
    expect(after.saved).toBe(before.saved);
    expect(after.future).toBe(before.future);
    expect(after.q).toEqual(before.q);
    expect(after.e).toEqual(before.e);
    expect(after.r).toEqual(before.r);
    expect(after.visible).toBe(before.visible);
    expect(after.bones).toEqual(before.bones);
    expect(after.revealedVisible).toBe(true);
    expect(after.revealed).toHaveLength(90 * 16);
    expect(after.revealed.every(Number.isFinite)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`alpha-${phase}-revealed.png`) });
    writeFileSync(
      info.outputPath('alpha-reload.json'),
      JSON.stringify({ phase, before, after, errors }, null, 2) + '\n'
    );
  });
}
