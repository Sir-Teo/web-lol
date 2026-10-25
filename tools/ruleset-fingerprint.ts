import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const sourceRoots = ['src/simulation', 'src/content'];
// Fetched Rift data and source presentation tables behind generated retention
// constants have no direct module edge. Preserve their explicit compatibility pins.
const pinnedData = [
  'docs/reference/leona-e-particles.json',
  'docs/reference/leona-r-particles.json',
  'src/content/leona-w-particles.json',
  'docs/reference/leona-w-particles-decoded.json',
  'docs/reference/leona-w-particle-profiles.json',
  'public/assets/effects/alphaslice_mesh.png',
  'public/assets/effects/aura_self.png',
  'public/assets/effects/leona_base_ash.png',
  'public/assets/effects/leona_base_blastring.png',
  'public/assets/effects/leona_base_flare_1.png',
  'public/assets/effects/leona_base_glow5.png',
  'public/assets/effects/leona_base_mult_windblast.png',
  'public/assets/effects/leona_base_r_buf_mult.png',
  'public/assets/effects/leona_base_w_avatarmask.png',
  'public/assets/effects/leona_base_w_avatarmask_erosion.png',
  'public/assets/effects/leona_base_w_circle_normal.png',
  'public/assets/effects/leona_base_w_decalbase.png',
  'public/assets/effects/leona_base_w_glow.png',
  'public/assets/effects/leona_base_w_mask02.png',
  'public/assets/effects/leona_base_w_praxis.png',
  'public/assets/effects/leona_base_w_praxiswaves_ruined.png',
  'public/assets/effects/leona_base_w_rainbowray.png',
  'public/assets/effects/leona_base_w_rainbowray01.png',
  'public/assets/effects/leona_base_wisps2.png',
  'public/assets/effects/leona_base_z_color-bellcurve.png',
  'public/assets/effects/leona_base_z_color-brandblaze.png',
  'public/assets/effects/leona_base_z_color-rampdown.png',
  'public/assets/effects/leona_base_z_color-rampdown32.png',
  'public/assets/effects/leona_base_z_color-solar-corona-reverse.png',
  'public/assets/effects/leona_base_z_color-solar-corona.png',
  'public/assets/effects/leona_base_z_color-wildcard.png',
  'public/assets/effects/leona_base_z_eclipse-bead.png',
  'public/assets/effects/leona_base_z_exploshaft-yellow.png',
  'public/assets/effects/leona_base_z_gradient_01.png',
  'public/assets/effects/leona_base_z_shockwavesolar.png',
  'public/assets/effects/leona_base_z_solar-corona.png',
  'public/assets/effects/leona_base_z_solar-wave3.png',
  'public/assets/effects/leona_base_z_sundisc32.png',
  'public/assets/effects/leona_w_tar_tornado_burstwind_erosion_v01.png',
  'public/assets/effects/lux_skin07_w_distort_rgba_2.png',
  'public/assets/effects/tft_crack_noise_mult.png',
  'public/assets/models/leona-w-contact-cone.glb',
  'public/assets/models/leona-w-contact-cone.json',
  'public/assets/models/leona-w-praxis.glb',
  'public/assets/models/leona-w-praxis.json',
  'public/assets/models/leona-w-smoke-01.glb',
  'public/assets/models/leona-w-smoke-01.json',
  'public/assets/models/leona-w-smoke-02.glb',
  'public/assets/models/leona-w-smoke-02.json',
  'public/assets/models/leona-w-solar-flare.glb',
  'public/assets/models/leona-w-solar-flare.json',
  'public/assets/models/leona-w-shockwave.glb',
  'public/assets/models/leona-w-shockwave.json',
  'public/assets/models/leona-e-sword-normals.bin',
  'public/assets/maps/rift-layout.json',
  'public/assets/maps/rift-nav.json',
  'public/assets/maps/rift-nav.bin',
  'public/assets/models/leona-base.glb',
  'public/assets/models/leona-base.json',
  'src/content/leona-q-particles.json',
  'docs/reference/leona-q-particles-decoded.json',
  'public/assets/effects/base_brightspark_11.png',
  'public/assets/effects/leona_base_flicker_04.png',
  'public/assets/effects/leona_base_q_color-alphabend32.png',
  'public/assets/effects/leona_base_q_dust.png',
  'public/assets/effects/leona_base_q_flash_2.png',
  'public/assets/effects/leona_base_q_stardust.png',
  'public/assets/effects/leona_base_q_stun_groundsigil.png',
  'public/assets/effects/leona_base_sun_flare.png',
  'public/assets/effects/leona_base_z_color-bellramp.png',
  'public/assets/effects/leona_base_z_flare-fire.png',
  'public/assets/effects/leona_base_z_lens-halo-sun.png',
  'public/assets/effects/leona_base_z_pinwheel.png',
  'public/assets/effects/leona_base_z_ring_gold_04.png',
  'public/assets/effects/leona_base_z_shadow_step_12.png',
  'public/assets/effects/leona_base_z_sowflash.png',
  'docs/reference/leona-sunlight-particles-decoded.json',
  'public/assets/effects/leona_base_z_color-bellcurve.png',
  'public/assets/effects/leona_base_z_color-eyefade.png',
  'public/assets/effects/leona_base_z_color-rampdown.png',
  'public/assets/effects/leona_base_z_color-solar-corona-reverse.png',
  'public/assets/effects/leona_base_z_color_passive_rampdown.png',
  'public/assets/effects/leona_base_z_color_rampdown.png',
  'public/assets/effects/leona_base_z_flare_streak.png',
  'public/assets/effects/leona_base_z_passive_flares_02.png',
  'public/assets/effects/leona_base_z_passive_flicker.png',
  'public/assets/effects/leona_base_z_passive_rays.png',
  'public/assets/effects/leona_base_z_passive_ringflare.png',
  'public/assets/effects/leona_base_z_solar_tag.png',
  'src/content/lux-e-burst.json',
  'src/content/lux-e-field.json',
  'src/content/gromp-death.json',
  'src/content/gromp-attack.json',
  'src/content/garen-aa-particles.json',
];

// Seekable presentation kernels also determine the interpretation of saved
// effect clocks. Traverse their runtime dependencies just like simulation roots;
// hashing only the entry file would miss a changed curve/motion helper.
export const rulesetModuleRoots = [
  'src/render/leona-zenith-particles.ts',
  'src/render/leona-zenith-surfaces.ts',
  'src/render/leona-solar-particles.ts',
  'src/render/leona-solar-frame.ts',
  'src/render/leona-solar-surfaces.ts',
  'src/render/particle-distortion-pass.ts',
  'src/render/leona-solar-projection-frame.ts',
  'src/render/leona-solar-projections.ts',
  'src/render/particle-decal-receivers.ts',
  'src/render/leona-solar-history.ts',
  'src/render/leona-zenith-history.ts',
  'src/render/leona-zenith-trails.ts',
  'src/render/leona-eclipse-particles.ts',
  'src/render/leona-eclipse-values.ts',
  'src/render/leona-eclipse-skin-material.ts',
  'src/render/particle-skin-mult-material.ts',
  'src/render/leona-eclipse-surface-material.ts',
  'src/audio/leona-q-state.ts',
  'src/audio/leona-aa-state.ts',
  'src/audio/leona-sunlight-state.ts',
  'src/audio/leona-death-state.ts',
  'src/audio/leona-w-state.ts',
  'src/audio/leona-e-state.ts',
  'src/audio/leona-r-state.ts',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : entry.name.endsWith('.ts') ? [file] : [];
  });
}

function projectFile(root: string, file: string): string {
  const name = relative(root, file);
  if (name === '..' || name.startsWith(`..${sep}`))
    throw new Error(`Ruleset dependency is outside the project: ${file}`);
  return name.split(sep).join('/');
}

export function collectRulesetFiles(projectRoot = process.cwd()): string[] {
  const root = resolve(projectRoot);
  const files = new Set([
    ...pinnedData,
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tools/ruleset-fingerprint.ts',
  ]);
  const configFile = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    {
      ...ts.sys,
      readFile(file) {
        files.add(projectFile(root, resolve(file)));
        return ts.sys.readFile(file);
      },
    },
    root
  );
  if (parsed.errors.length)
    throw new Error(
      parsed.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n')
    );
  const options = parsed.options;
  const visited = new Set<string>();

  function visit(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);
    files.add(projectFile(root, file));
    const source = readFileSync(file, 'utf8');
    if (file.endsWith('.json')) return;
    // Follow emitted imports: type-only references never execute. This also
    // handles mixed imports and type-only re-exports with the project's flags.
    const emitted = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: options,
    }).outputText;
    const ast = ts.createSourceFile(file, emitted, ts.ScriptTarget.Latest, true);

    function dependency(specifier: string): void {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (!resolved)
        throw new Error(`Unresolved ruleset import in ${projectFile(root, file)}: ${specifier}`);
      // Installed packages are represented by package declarations + lockfile.
      if (resolved.isExternalLibraryImport) return;
      if (!/\.(?:[cm]?[jt]sx?|json)$/.test(resolved.resolvedFileName))
        throw new Error(`Unsupported ruleset import in ${projectFile(root, file)}: ${specifier}`);
      visit(resolve(resolved.resolvedFileName));
    }

    function scan(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (!ts.isStringLiteralLike(node.moduleSpecifier))
          throw new Error(`Nonliteral ruleset import: ${file}`);
        dependency(node.moduleSpecifier.text);
      } else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isMetaProperty(node.expression.expression) &&
        ['glob', 'globEager'].includes(node.expression.name.text)
      ) {
        throw new Error(`Unsupported ruleset glob import in ${projectFile(root, file)}`);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteralLike(argument))
          throw new Error(`Nonliteral ruleset import in ${projectFile(root, file)}`);
        dependency(argument.text);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }

  for (const directory of sourceRoots)
    for (const file of sourceFiles(resolve(root, directory))) visit(file);
  for (const file of rulesetModuleRoots) visit(resolve(root, file));
  return [...files].sort();
}

export const rulesetFiles = collectRulesetFiles();

export function rulesetFingerprint(projectRoot = process.cwd()): string {
  const hash = createHash('sha256');
  for (const file of collectRulesetFiles(projectRoot))
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(resolve(projectRoot, file)))
      .update('\0');
  return hash.digest('hex');
}

export const absoluteRulesetFiles = new Set(rulesetFiles.map((file) => resolve(file)));

export function affectsRuleset(file: string): boolean {
  const absolute = resolve(file);
  return (
    absoluteRulesetFiles.has(absolute) ||
    sourceRoots.some(
      (directory) => absolute.startsWith(resolve(directory) + sep) && absolute.endsWith('.ts')
    )
  );
}
