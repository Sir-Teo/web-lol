/** Local pixel replay of privately staged Q contact texture transport.
 * Serves only the verified manifest and its seven files on loopback. Tests the
 * browser/driver at hand; this does not certify Riot's native renderer.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');
const output = resolve(process.env.PARTICLE_MIP_OUTPUT ?? '.cache/masteryi-q-contact-packed-v2');
const manifestBytes = await readFile(resolve(output, 'textures.json'));
const manifest = JSON.parse(manifestBytes);
if (manifest.format !== 1 || manifest.textures.length !== 7) throw Error('Unexpected texture closure');
const routes = new Map([
  ['/', { type: 'text/html', bytes: Buffer.from('<!doctype html><title>Authored mip pixel replay</title>') }],
  ['/textures.json', { type: 'application/json', bytes: manifestBytes }],
]);
for (const row of manifest.textures) {
  const path = resolve(row.path);
  if (path !== resolve(output, `${row.source.wadPathHash}.png`)) throw Error('Unexpected packed texture path');
  const bytes = await readFile(path);
  if (bytes.length !== row.bytes || checksum(bytes) !== row.sha256) throw Error('Packed PNG identity differs');
  routes.set(`/${row.source.wadPathHash}.png`, { type: 'image/png', bytes });
}
const server = createServer((request, response) => {
  const route = routes.get(request.url);
  response.writeHead(route ? 200 : 404, { 'Content-Type': route?.type ?? 'text/plain', 'Cache-Control': 'no-store' });
  response.end(route?.bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch(process.env.PARTICLE_MIP_CHROMIUM
    ? { executablePath: process.env.PARTICLE_MIP_CHROMIUM, args: ['--no-sandbox'] }
    : { channel: 'chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async () => {
    const digest = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
    if (!gl) throw Error('WebGL 2 is unavailable');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const manifest = await (await fetch('/textures.json')).json();
    const textures = [];
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const row of manifest.textures) {
      const response = await fetch(`/${row.source.wadPathHash}.png`);
      if (!response.ok) throw Error('Texture fetch failed');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== row.bytes || await digest(bytes) !== row.sha256) throw Error('Texture download differs');
      const blob = new Blob([bytes], { type: 'image/png' });
      const texture = gl.createTexture();
      const levels = [];
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const base = row.rectangles[0];
        gl.texStorage2D(gl.TEXTURE_2D, row.rectangles.length, gl.RGBA8, base.width, base.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, row.rectangles.length > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        for (const rect of row.rectangles) {
          const bitmap = await createImageBitmap(blob, rect.x, rect.y, rect.width, rect.height,
            { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' });
          try {
            if (bitmap.width !== rect.width || bitmap.height !== rect.height) throw Error('Browser resized mip');
            gl.texSubImage2D(gl.TEXTURE_2D, rect.level, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, rect.level);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Mip framebuffer is incomplete');
            const pixels = new Uint8Array(rect.width * rect.height * 4);
            gl.readPixels(0, 0, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            const hash = await digest(pixels);
            if (hash !== rect.rgbaSha256) throw Error(`GPU mip pixels differ: ${row.source.path} level ${rect.level}: ${hash}`);
            if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL upload/readback error');
            levels.push({ level: rect.level, width: rect.width, height: rect.height, rgbaSha256: hash });
          } finally { bitmap.close(); }
        }
      } finally { gl.deleteTexture(texture); }
      textures.push({ source: row.source.path, sha256: row.sha256, levels });
    }
    gl.deleteFramebuffer(framebuffer);
    return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      userAgent: navigator.userAgent, textures, generatedMipmaps: false, resizedPixels: false };
  });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(JSON.stringify({ manifestSha256: checksum(manifestBytes), browserVersion: browser.version(), ...result,
    scope: 'Pixel-exact local browser upload/readback of the canonical software decode; no native-renderer, physical-device, frame-rate or visual-parity certificate.' }, null, 2));
} finally {
  await browser?.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
