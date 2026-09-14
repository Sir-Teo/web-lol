#!/usr/bin/env bash
set -euo pipefail
# Requires the isolated tool installations documented in docs/MAP-ASSETS.md.
map_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$map_root"
test "$(.tools/dotnet10/dotnet --version)" = "10.0.401"
test "$(git -C .tools/map-converter rev-parse HEAD)" = "7fe8d5c9b82fd0a86ea682fced28f8021bb3e063"
test "$(git -C .tools/league-toolkit rev-parse HEAD)" = "76bf57bf4fd195343dec610bf0f912a06b910914"
for pair in "map-converter:map-converter" "league-toolkit:league-toolkit-map"; do
  checkout="${pair%%:*}"
  patch_name="${pair#*:}"
  patch_path="$map_root/tools/assets/patches/$patch_name.patch"
  if ! git -C ".tools/$checkout" apply --reverse --check "$patch_path" 2>/dev/null; then
    git -C ".tools/$checkout" apply --check "$patch_path"
    git -C ".tools/$checkout" apply "$patch_path"
  fi
done
PATH="$map_root/.tools/dotnet10:$PATH" DOTNET_ROLL_FORWARD=Major \
  .tools/dotnet10/dotnet publish .tools/map-converter/src/lol2gltf/lol2gltf.csproj \
  -c Release -r osx-arm64 -o .tools/map-converter-bin --self-contained false \
  -p:PublishReadyToRun=false -p:PublishSingleFile=false -p:RestoreLockedMode=true
.tools/dotnet10/dotnet .tools/map-converter-bin/lol2gltf.dll mapgeo2gltf \
  -m .cache/map-sources/data/maps/mapgeometry/map11/base_srx.mapgeo \
  -b .cache/map-sources/data/maps/mapgeometry/map11/base_srx.materials.bin \
  -g .cache/map-textured.glb -d .cache/map-sources --flipX false -l Default -q High
.tools/cdtb-venv/bin/python tools/assets/convert-navgrid.py
node tools/assets/pack-reference-map.mjs
node tools/assets/pack-map-geometry.mjs
.tools/cdtb-venv/bin/python tools/assets/export-rift-layout.py
node tools/assets/validate-map.mjs
