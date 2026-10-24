import { expect, test } from '@playwright/test';

test('hidden Lucent phases skip sampling and reveal exact saved buffers and pixels', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(async () => {
    const { LuxESource } = await import('/src/render/lux-e-source.ts');
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'red', { x: 0, y: 0 }, 'lux');
    lux.ai = false;
    const target = w.spawn('dummy', 'blue', { x: 600, y: 0 });
    target.hp = target.maxHp = 5000;
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
    w.step(75);
    let seen = true;
    w.pointVisible = () => seen;
    v.center = { x: 300, y: 0 };
    let draws = 0;
    const draw = LuxESource.prototype.draw;
    LuxESource.prototype.draw = function (...args: any[]) {
      draws++;
      return draw.apply(this, args);
    };
    const capture = () => {
      const groups = [...v.luxSingularities.models, ...v.luxSingularities.hitModels];
      return groups.map(([key, root]: any) => ({
        key,
        visible: root.visible,
        children: root.children.map((m: any) => ({
          name: m.name,
          count: m.geometry.drawRange.count,
          attributes: Object.fromEntries(
            Object.entries(m.geometry.attributes).map(([k, a]: any) => [k, Array.from(a.array)])
          ),
          index: Array.from(m.geometry.index.array),
        })),
      }));
    };
    const pixels = () => {
      const gl = v.renderer.getContext(),
        b = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b
      );
      return b;
    };
    const phases = [];
    try {
      for (const phase of ['field', 'burst']) {
        if (phase === 'burst') {
          seen = true;
          w.enqueue({ type: 'cast', unit: lux.id, ability: 'e', point: target });
          w.step(6);
        }
        v.render(w, 1, v.previousElapsed);
        seen = false;
        draws = 0;
        const before = w.snapshot();
        for (let i = 0; i < 20; i++) v.render(w, 1, v.previousElapsed);
        const hiddenDraws = draws,
          hidden = capture().every(
            (r: any) => !r.visible && r.children.every((m: any) => m.count === 0)
          );
        const unchanged = w.snapshot() === before;
        seen = true;
        w.step(6);
        v.render(w, 1, v.previousElapsed);
        const data = JSON.stringify(capture()),
          first = pixels(),
          saved = w.snapshot();
        const restored = w.constructor.fromSnapshot(saved, w.battlefield);
        restored.pointVisible = () => true;
        v.render(restored, 1, v.previousElapsed);
        const second = pixels();
        phases.push({
          phase,
          hiddenDraws,
          hidden,
          unchanged,
          revealedDraws: draws,
          buffersEqual: data === JSON.stringify(capture()),
          pixelsEqual: first.every((x: number, i: number) => x === second[i]),
          savedUnchanged: w.snapshot() === saved,
        });
      }
    } finally {
      LuxESource.prototype.draw = draw;
    }
    return phases;
  });
  for (const phase of result) {
    expect(phase.hiddenDraws).toBe(0);
    expect(phase.revealedDraws).toBeGreaterThan(0);
    expect(
      phase.hidden &&
        phase.unchanged &&
        phase.buffersEqual &&
        phase.pixelsEqual &&
        phase.savedUnchanged
    ).toBe(true);
  }
});
