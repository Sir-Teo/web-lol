/** Local WebGL comparison with the pinned external shader; no native fidelity claim. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const raw = fs.readFileSync('.cache/baron-emission-readers/rendering/shaders/quad.ts');
const sha = createHash('sha256').update(raw).digest('hex');
assert.equal(
  sha,
  '4ed5856ce44e9d482bea18a924544149a820587fdec409616be3446832c3093f',
  'External fragment shader differs'
);
const exports = {};
vm.runInNewContext(
  ts.transpileModule(raw.toString(), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
    .outputText,
  {
    exports,
    require: (name) => {
      assert.equal(name, '../utils/uniforms');
      return { SHEEN: { none: 0, drawn: 1, texel: 2 } };
    },
  }
);
const program = JSON.parse(fs.readFileSync('public/assets/effects/baron-attack/program.json'));
const server = await createServer({
  configFile: false,
  plugins: [
    {
      name: 'baron-material-isolation',
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== '/__baron-material-qa') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(
            '<!doctype html><link rel="icon" href="data:,"><title>Baron material pixel comparison</title>'
          );
        });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(server.resolvedUrls.local[0] + '__baron-material-qa');
  const result = await page.evaluate(
    async ({ program, fragment }) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { createBaronParticleMaterial } =
        await import('/src/render/baron-particle-material.ts');
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(32, 32);
      renderer.setClearColor(0x274965, 0.7);
      const target = new THREE.WebGLRenderTarget(32, 32, {
        type: THREE.UnsignedByteType,
        depthBuffer: false,
      });
      renderer.setRenderTarget(target);
      const scene = new THREE.Scene(),
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 2;
      const texture = (salt) => {
        const pixels = new Uint8Array(64 * 64 * 4);
        for (let y = 0; y < 64; y++)
          for (let x = 0; x < 64; x++)
            for (let c = 0; c < 4; c++)
              pixels[(y * 64 + x) * 4 + c] = (x * 17 + y * 31 + c * 47 + salt) % 256;
        const t = new THREE.DataTexture(pixels, 64, 64);
        t.minFilter = t.magFilter = THREE.NearestFilter;
        t.colorSpace = THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        return t;
      };
      const textures = new Map(
        program.textures.map((row, i) => [row.source.wadPathHash, texture(i * 13)])
      );
      const pixels = () => {
        const a = new Uint8Array(32 * 32 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 32, 32, a);
        return a;
      };
      const reports = [];
      for (const profile of program.profiles)
        for (let variant = 0; variant < 4; variant++) {
          const own = createBaronParticleMaterial(profile, textures);
          const geom = new THREE.PlaneGeometry(2, 2);
          const uvTurn = [variant * 0.19, 1 + variant * 0.2, 0.8 + variant * 0.1],
            shift = [-0.7 + variant * 0.4, 0.3 - variant * 0.2, 0, 0];
          const div = profile.settings.texDiv ?? [1, 1];
          shift[2] = (variant % div[0]) / div[0];
          shift[3] = (variant % div[1]) / div[1];
          const multTurn = [-0.2 * variant, 1, 1],
            multShift = [variant * 0.37, -variant * 0.21, 0, 0],
            tint = [0.8, 0.6, 1.2, 0.65],
            mix = [1, 0, 0, 0],
            drive = variant * 0.34;
          const attribute = (name, values) =>
            geom.setAttribute(
              name,
              new THREE.Float32BufferAttribute(
                Array.from({ length: 4 }, () => values).flat(),
                values.length
              )
            );
          attribute('sourceTint', tint);
          attribute('sourceUvTurn', uvTurn);
          attribute('sourceUvShift', shift);
          attribute('sourceMultTurn', multTurn);
          attribute('sourceMultShift', multShift);
          attribute('sourceErosionMix', mix);
          attribute('sourceErosionDrive', [drive]);
          attribute('_source_vertex_bgra', [0.4, 0.7, 0.9, 0.35]);
          const vertex = `
            attribute vec4 sourceTint;
            attribute vec3 sourceUvTurn;
            attribute vec4 sourceUvShift;
            attribute vec3 sourceMultTurn;
            attribute vec4 sourceMultShift;
            attribute float sourceErosionDrive;
            attribute vec4 _source_vertex_bgra;
            varying vec2 vUv;
            varying vec4 vColor;
            varying vec3 vTurn;
            varying vec4 vShift;
            varying vec3 vTurnMult;
            varying vec4 vShiftMult;
            varying float vErode;
            varying vec2 vLookup;
            void main() {
              vUv=uv; vColor=sourceTint;
              #ifdef SOURCE_MESH
              vColor *= _source_vertex_bgra.bgra;
              #endif
              vTurn=sourceUvTurn; vShift=sourceUvShift;
              vTurnMult=sourceMultTurn; vShiftMult=sourceMultShift;
              vErode=sourceErosionDrive; vLookup=vec2(0.5);
              gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
            }
          `;
          const reference = new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            defines: {
              HAS_MAP: 1,
              SHEEN: 0,
              LOCK_ALPHA: 0,
              ...(profile.geometry.kind === 'mesh' ? { SOURCE_MESH: 1 } : {}),
              ...(profile.material.multiplier ? { HAS_MAP_MULT: 1 } : {}),
              ...(profile.material.erosion ? { EROSION: 1, HAS_MAP_EROSION: 1 } : {}),
              ...(profile.material.palette ? { HAS_PALETTE: 1 } : {}),
            },
            uniforms: {
              ...own.uniforms,
              center: { value: new THREE.Vector2(0.5, 0.5) },
              flip: { value: new THREE.Vector2() },
              address: { value: 0 },
              cellMult: { value: new THREE.Vector2(1, 1) },
              centerMult: { value: new THREE.Vector2(0.5, 0.5) },
              flipMult: { value: new THREE.Vector2() },
              addressMult: { value: 0 },
              addressErosion: { value: 1 },
              erosionMix: { value: new THREE.Vector4(...mix) },
              erosionDefault: { value: new THREE.Vector4() },
              featherRate: { value: new THREE.Vector2(10, 10) },
              sliceWidth: { value: 1.5 },
              addressPalette: { value: 1 },
              paletteMix: { value: new THREE.Vector4(0.299, 0.587, 0.114, 0) },
              paletteScroll: { value: new THREE.Vector2() },
            },
            transparent: own.transparent,
            depthTest: own.depthTest,
            depthWrite: own.depthWrite,
            side: own.side,
            blending: own.blending,
            blendEquation: own.blendEquation,
            blendSrc: own.blendSrc,
            blendDst: own.blendDst,
            blendSrcAlpha: own.blendSrcAlpha,
            blendDstAlpha: own.blendDstAlpha,
            toneMapped: false,
          });
          const mesh = new THREE.Mesh(geom, own);
          scene.add(mesh);
          renderer.clear();
          const background = pixels();
          renderer.render(scene, camera);
          const actual = pixels();
          mesh.material = reference;
          renderer.clear();
          renderer.render(scene, camera);
          const expected = pixels();
          const drawnChannels = actual.reduce(
            (sum, value, index) => sum + Number(value !== background[index]),
            0
          );
          let differences = 0,
            maxDelta = 0;
          for (let i = 0; i < actual.length; i++)
            if (actual[i] !== expected[i]) {
              differences++;
              maxDelta = Math.max(maxDelta, Math.abs(actual[i] - expected[i]));
            }
          reports.push({
            role: profile.role,
            index: profile.index,
            variant,
            differences,
            maxDelta,
            drawnChannels,
          });
          scene.remove(mesh);
          geom.dispose();
          own.dispose();
          reference.dispose();
        }
      textures.forEach((t) => t.dispose());
      target.dispose();
      renderer.dispose();
      return { cases: reports.length, reports };
    },
    { program, fragment: exports.FRAGMENT }
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    'artifacts/baron-material-pixels.json',
    JSON.stringify(
      {
        externalShaderSha256: sha,
        browserVersion: browser.version(),
        nativeExecuted: false,
        ...result,
      },
      null,
      2
    ) + '\n'
  );
  for (const profile of program.profiles)
    assert(
      result.reports.some(
        (row) => row.role === profile.role && row.index === profile.index && row.drawnChannels > 0
      ),
      'Emitter rendered no visible pixels'
    );
  assert(
    result.reports.every((r) => r.differences === 0),
    'Baron material pixels differ'
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      cases: result.cases,
      externalShaderSha256: sha,
      nativeExecuted: false,
    })
  );
} finally {
  await browser?.close();
  await server.close();
}
