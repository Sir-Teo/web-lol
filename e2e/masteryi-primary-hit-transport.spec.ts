import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

// This private transport probe intentionally starts on an empty document. It
// tests the production texture loader without adding dispatch or public files.
test('all primary-hit authored mips survive the actual Three GPU upload', async ({ page }, info) => {
  const record = JSON.parse(
    readFileSync('.cache/masteryi-primary-hit-packed-v2/textures.json', 'utf8')
  );
  const pin = JSON.parse(readFileSync('docs/reference/masteryi/primary-hit-particles.json', 'utf8'));
  const lookupPaths = new Set<string>();
  for (const row of Object.values(pin.resources) as any[])
    for (const emitter of row.definition.complexEmitterDefinitionData)
      if (emitter.particleColorTexture) lookupPaths.add(emitter.particleColorTexture.toLowerCase());
  const assets = record.textures.map((row: any) => ({
    ...row,
    url: `__private-primary-hit/${row.source.wadPathHash}.png`,
    lookup: lookupPaths.has(row.source.path),
  }));
  let requests = 0;
  for (const asset of assets)
    await page.route(`**/${asset.url}`, async (route) => {
      requests++;
      await route.fulfill({ contentType: 'image/png', body: readFileSync(asset.path) });
    });
  await page.route('**/__primary-hit-transport.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Private mip probe</title>' })
  );
  await page.goto('/__primary-hit-transport.html');
  const result = await page.evaluate(async (assets) => {
    const threePath = '/node_modules/three/build/three.module.js',
      cachePath = '/src/render/authored-mip-texture-cache.ts',
      THREE = await import(threePath),
      { AuthoredMipTextureCache } = await import(cachePath),
      cache = new AuthoredMipTextureCache(),
      renderer = new THREE.WebGLRenderer(),
      gl = renderer.getContext(),
      fb = gl.createFramebuffer(),
      previous = gl.getParameter(gl.FRAMEBUFFER_BINDING),
      mips = [],
      settings = [];
    try {
      for (const asset of assets) {
        const [texture, same] = await Promise.all([
          cache.load(asset, asset.lookup), cache.load(asset, asset.lookup),
        ]);
        if (texture !== same) throw Error('Concurrent transport load did not share its texture');
        if (texture.generateMipmaps || texture.mipmaps.length !== asset.rectangles.length)
          throw Error('Authored mip chain changed');
        renderer.initTexture(texture);
        const native = renderer.properties.get(texture).__webglTexture;
        if (!native) throw Error('Missing actual uploaded texture');
        for (const rect of asset.rectangles) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, native, rect.level);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw Error('Incomplete primary-hit mip framebuffer');
          const bytes = new Uint8Array(rect.width * rect.height * 4);
          gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          if (gl.getError() !== gl.NO_ERROR) throw Error('Primary-hit mip GPU readback failed');
          const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
            .map((b) => b.toString(16).padStart(2, '0')).join('');
          if (sha256 !== rect.rgbaSha256) throw Error('Authored primary-hit GPU mip differs');
          mips.push({ url: asset.url, level: rect.level, width: rect.width, height: rect.height, sha256 });
        }
        settings.push({ url: asset.url, lookup: asset.lookup, generateMipmaps: texture.generateMipmaps,
          colorSpace: texture.colorSpace, minFilter: texture.minFilter, magFilter: texture.magFilter,
          wrapS: texture.wrapS, wrapT: texture.wrapT, flipY: texture.flipY });
      }
      return { mips, settings, renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION), gameBooted: '__GAME__' in window };
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
      gl.deleteFramebuffer(fb);
      renderer.resetState();
      cache.dispose();
      renderer.dispose();
    }
  }, assets);
  expect(result.mips).toHaveLength(93);
  expect(result.settings).toHaveLength(11);
  expect(result.gameBooted).toBe(false);
  expect(requests).toBe(11);
  writeFileSync(info.outputPath('authored-gpu-mips.json'), JSON.stringify(result, null, 2));
});
