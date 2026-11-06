import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const scene of ['fixture', 'rift']) {
  test(`attack range caches terrain geometry in ${scene}`, async ({ page }, info) => {
    await page.goto(scene === 'fixture' ? '/?scene=fixture' : '/');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      (window as any).__GAME__.setPaused(true);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const result = await page.evaluate((scene) => {
      const { world: w, view: v } = (window as any).__GAME__;
      v.rangeVisible = true;
      const render = () => v.render(w, 1, v.previousElapsed);
      render();
      const positions = v.range.geometry.attributes.position;
      const first = positions.version;
      const original = Array.from(positions.array);
      for (let i = 0; i < (scene === 'fixture' ? 120 : 8); i++) render();
      const stationary = positions.version - first;
      const frame = () => {
        render();
        const gl = v.renderer.getContext();
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels
        );
        return pixels;
      };
      const cachedFrame = frame();
      v.rangeGeometryAt = undefined;
      const rebuiltFrame = frame();
      const nonempty = cachedFrame.some((value, index) => index % 4 !== 3 && value > 0);
      const identical = cachedFrame.every((value, index) => value === rebuiltFrame[index]);
      let version = positions.version;
      w.hero.x += 100;
      render();
      const moved = positions.version - version;
      version = positions.version;
      w.hero.range += 75;
      render();
      const resized = positions.version - version;
      const changed = original.some((value, index) => value !== positions.array[index]);
      version = positions.version;
      v.rangeVisible = false;
      w.hero.x += 50;
      render();
      const hidden = positions.version - version;
      v.rangeVisible = true;
      render();
      const revealed = positions.version - version;
      return { stationary, identical, nonempty, moved, resized, changed, hidden, revealed };
    }, scene);
    expect(result).toEqual({
      stationary: 0,
      identical: true,
      nonempty: true,
      moved: 1,
      resized: 1,
      changed: true,
      hidden: 0,
      revealed: 1,
    });
    await writeFile(info.outputPath('range-geometry.json'), JSON.stringify(result, null, 2));
    await page.screenshot({ path: info.outputPath('attack-range.png') });
  });
}
