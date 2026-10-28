/** Inspect native ANM joint hashes at every source frame against the pinned SKL. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Use --report <fresh path>');
assert.equal(args[0], '--report');
const report = args[1];
assert(!existsSync(report), 'Report exists');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const pinPath = 'docs/reference/epic-models-source.json',
  pinBytes = readFileSync(pinPath),
  pin = JSON.parse(pinBytes),
  cache = '.cache/epic-models',
  tool = '.cache/animation-bindings-tool';
const files = new Map(pin.extraction.files.map((row) => [row.path, row]));
for (const row of files.values()) {
  const b = readFileSync(`${cache}/${row.path}`);
  assert.equal(b.length, row.bytes);
  assert.equal(hash(b), row.sha256);
}
mkdirSync(tool, { recursive: true });
const source = readFileSync('tools/assets/inspect-animation-bindings.cs');
writeFileSync(`${tool}/Program.cs`, source);
writeFileSync(
  `${tool}/Bindings.csproj`,
  '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Reference Include="../../.tools/converter/*.dll" /></ItemGroup></Project>'
);
const env = {
  ...process.env,
  DOTNET_CLI_HOME: resolve('.cache/dotnet-cli'),
  DOTNET_CLI_TELEMETRY_OPTOUT: '1',
};
const build = execFileSync(
  '.tools/dotnet/dotnet',
  ['build', `${tool}/Bindings.csproj`, '-c', 'Release'],
  { env, encoding: 'utf8' }
);
writeFileSync(`${tool}/build.log`, build);
const models = Object.entries(pin.models).map(([name, model]) => {
  const skin =
    pin.records[`data/characters/${name.toLowerCase()}/skins/skin0.bin`][model.skinKey]
      .skinMeshProperties;
  const skeleton = skin.skeleton.toLowerCase();
  return {
    name,
    skeleton: resolve(cache, skeleton),
    sha256: files.get(skeleton).sha256,
    clips: Object.entries(model.atomicClips).map(([state, path]) => ({
      state,
      path: resolve(cache, path),
      source: path,
      sha256: files.get(path).sha256,
    })),
  };
});
const config = resolve(tool, 'input.json'),
  raw = resolve(tool, `bindings-${Date.now()}.json`);
writeFileSync(config, JSON.stringify({ models }));
execFileSync('.tools/dotnet/dotnet', [`${tool}/bin/Release/net8.0/Bindings.dll`, config, raw], {
  env,
  stdio: 'inherit',
});
const result = {
  format: 1,
  sourcePinSha256: hash(pinBytes),
  helperSha256: hash(source),
  toolkitSha256: hash(readFileSync('.tools/converter/LeagueToolkit.dll')),
  scope:
    'All source-frame times and exact duration sampled; native joint hashes matched to ASCII ELF-lower skeleton names. Binding classification only; no native animation-dispatch or visual-parity claim.',
  models: JSON.parse(readFileSync(raw)),
};
const output = 'docs/reference/epic-models-bindings.json';
if (existsSync(output))
  assert.deepEqual(result, JSON.parse(readFileSync(output)), 'Binding pin differs');
else writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
const counts = result.models.map((m) => ({
  name: m.name,
  source: m.clips.length,
  bound: m.clips.filter((c) => !c.unbound).length,
  unbound: m.clips.filter((c) => c.unbound).map((c) => c.state),
}));
writeFileSync(
  report,
  JSON.stringify(
    {
      status: 'passed',
      bindingPinSha256: hash(readFileSync(output)),
      models: counts,
      buildLog: `${tool}/build.log`,
      node: process.version,
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log(JSON.stringify(counts));
