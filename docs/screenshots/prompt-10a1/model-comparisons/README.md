# Prompt 10A1R — Meshy model comparison evidence

This directory records objective source-to-production evidence for the four user-supplied Meshy GLBs. The production files are self-contained GLB 2.0 assets with generated MikkTSpace tangents and embedded WebP textures. Geometry compression is intentionally disabled: there is no Draco, Meshopt, KTX2, external URI, or remote decoder dependency.

## Comparison

| Production asset | Source bytes | Production bytes | Reduction | Vertices (source → production) | Triangles | Textures (base / normal / MR) | Khronos validation |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `grapevyne-meshy-bottle.desktop.glb` | 33,632,796 | 3,954,456 | 88.2423% | 15,848 → 15,911 | 30,348 → 30,348 | 2048² / 2048² / 1024² | 0 errors, warnings, infos, hints |
| `grapevyne-meshy-bottle.mobile.glb` | 28,840,960 | 881,628 | 96.9431% | 5,375 → 5,385 | 9,356 → 9,356 | 1024² / 1024² / 512² | 0 errors, warnings, infos, hints |
| `grapevyne-meshy-grapes.desktop.glb` | 65,649,924 | 8,187,568 | 87.5284% | 35,032 → 35,142 | 30,122 → 30,122 | 2048² / 2048² / 1024² | 0 errors, warnings, infos, hints |
| `grapevyne-meshy-grapes.mobile.glb` | 53,957,112 | 1,890,584 | 96.4961% | 8,216 → 8,282 | 9,292 → 9,292 | 1024² / 1024² / 512² | 0 errors, warnings, infos, hints |

The small vertex-count increases are the expected UV-seam splits made while generating tangents. Index and triangle counts are unchanged. Source and production world bounds match exactly for every asset; the exact floating-point bounds, embedded texture byte counts, hashes, budgets, and asset contracts are in [`10a1-meshy-model-manifest.json`](../../../v2/10a1-meshy-model-manifest.json).

All four production assets preserve the source structure: one scene, one `Mesh_0` node, one `Mesh_0` mesh, one triangle primitive, one opaque double-sided `Material_0`, three textures, and no animations. Production primitives contain `POSITION`, `NORMAL`, `TEXCOORD_0`, and `TANGENT`.

## Production hashes

| Asset | SHA-256 |
| --- | --- |
| `grapevyne-meshy-bottle.desktop.glb` | `e3a78c10bf6b6253e552a77484656d267397521f54de1c57b6afcf337165165f` |
| `grapevyne-meshy-bottle.mobile.glb` | `70ef18a4fd8d6ddbd20a2f84e3600a42708e1dd566ec991a2d5e668727147e25` |
| `grapevyne-meshy-grapes.desktop.glb` | `2b6b475803ff1fd72d01afd6f912ba0acd558d2d668a3c5dcf18d4d280dedbb6` |
| `grapevyne-meshy-grapes.mobile.glb` | `cccac924677f6114cca2276b859ef967e055d3eafe6ed73521fb2b7a9c3ae489` |

Aggregate digest: `5f3b537986d932fb9b03369e310c9f7d6fea8d81432187858f9e40149c93bd47`. It is the SHA-256 of lexicographically sorted `shasum -a 256` lines for `frontend/public/assets/models/grapevyne-meshy-*.glb`, with repository-relative paths.

## Reproducible toolchain

The checked-in [`toolchain-package-lock.json`](./toolchain-package-lock.json) is npm lockfile v3 with SHA-256 `1758bb436322c4ef5d790d476190bea571d87048d1d5d476614b0e473926f595`. It locks glTF Transform CLI/Core/Extensions/Functions 4.3.0, Sharp 0.34.2, ndarray-pixels 5.0.1, Meshoptimizer 1.0.1, mikktspace 1.1.1, glTF Validator 2.0.0-dev.3.10, language-tags 1.0.9, and all transitives. It is an audit artifact only; no production package manifest was changed.

From the repository root:

```bash
GV_TOOL_DIR="$(mktemp -d /tmp/grapevyne-10a1-gltf.XXXXXX)"
GV_WORK_DIR="$(mktemp -d /tmp/grapevyne-10a1-models.XXXXXX)"
GV_NPM_CACHE=/tmp/grapevyne-10a1-npm-cache

cp docs/screenshots/prompt-10a1/model-comparisons/toolchain-package.json "$GV_TOOL_DIR/package.json"
cp docs/screenshots/prompt-10a1/model-comparisons/toolchain-package-lock.json "$GV_TOOL_DIR/package-lock.json"
cp docs/screenshots/prompt-10a1/model-comparisons/repair-zero-tangents.mjs "$GV_TOOL_DIR/repair-zero-tangents.mjs"

env npm_config_cache="$GV_NPM_CACHE" npm ci --prefix "$GV_TOOL_DIR"
GV_GLTF_TRANSFORM="$GV_TOOL_DIR/node_modules/.bin/gltf-transform"
```

Use this exact seven-stage pipeline:

```bash
build_model() {
  GV_ASSET_KEY="$1"
  GV_SOURCE_PATH="$2"
  GV_BASE_SIZE="$3"
  GV_NORMAL_SIZE="$4"
  GV_MR_SIZE="$5"
  GV_NORMAL_MODE="$6"
  GV_ASSET_DIR="$GV_WORK_DIR/$GV_ASSET_KEY"

  mkdir "$GV_ASSET_DIR"
  "$GV_GLTF_TRANSFORM" tangents "$GV_SOURCE_PATH" "$GV_ASSET_DIR/01-tangents.glb"
  "$GV_GLTF_TRANSFORM" resize "$GV_ASSET_DIR/01-tangents.glb" "$GV_ASSET_DIR/02-base.glb" --pattern Image_0 --width "$GV_BASE_SIZE" --height "$GV_BASE_SIZE" --filter lanczos3
  "$GV_GLTF_TRANSFORM" resize "$GV_ASSET_DIR/02-base.glb" "$GV_ASSET_DIR/03-normal.glb" --pattern normal --width "$GV_NORMAL_SIZE" --height "$GV_NORMAL_SIZE" --filter lanczos3
  "$GV_GLTF_TRANSFORM" resize "$GV_ASSET_DIR/03-normal.glb" "$GV_ASSET_DIR/04-mr.glb" --pattern Image_1 --width "$GV_MR_SIZE" --height "$GV_MR_SIZE" --filter lanczos3
  "$GV_GLTF_TRANSFORM" webp "$GV_ASSET_DIR/04-mr.glb" "$GV_ASSET_DIR/05-base-webp.glb" --slots baseColorTexture --quality 88 --effort 100

  if [ "$GV_NORMAL_MODE" = near-lossless ]; then
    "$GV_GLTF_TRANSFORM" webp "$GV_ASSET_DIR/05-base-webp.glb" "$GV_ASSET_DIR/06-normal-webp.glb" --slots normalTexture --near-lossless --quality 90 --effort 100
  else
    "$GV_GLTF_TRANSFORM" webp "$GV_ASSET_DIR/05-base-webp.glb" "$GV_ASSET_DIR/06-normal-webp.glb" --slots normalTexture --lossless --effort 100
  fi

  "$GV_GLTF_TRANSFORM" webp "$GV_ASSET_DIR/06-normal-webp.glb" "$GV_ASSET_DIR/final.glb" --slots metallicRoughnessTexture --lossless --effort 100
}

build_model bottle-desktop /Users/rachel/Downloads/grapevyne-meshy-bottle-desktop-source.glb 2048 2048 1024 lossless
build_model bottle-mobile /Users/rachel/Downloads/grapevyne-meshy-bottle-mobile-source.glb 1024 1024 512 lossless
build_model grape-desktop /Users/rachel/Downloads/grapevyne-meshy-grape-desktop-source.glb 2048 2048 1024 near-lossless
build_model grape-mobile /Users/rachel/Downloads/grapevyne-meshy-grape-mobile-source.glb 1024 1024 512 lossless
```

For `grape-desktop` only, run the checked-in tangent repair from the locked tool directory after stage seven. Exactly two repairs are required; any other count aborts:

```bash
(
  cd "$GV_TOOL_DIR"
  node repair-zero-tangents.mjs \
    "$GV_WORK_DIR/grape-desktop/final.glb" \
    "$GV_WORK_DIR/grape-desktop/final-valid.glb" \
    2
)
```

Copy `final.glb` for the other three assets and `final-valid.glb` for grape desktop to the four exact production paths, then verify:

```bash
cp "$GV_WORK_DIR/bottle-desktop/final.glb" frontend/public/assets/models/grapevyne-meshy-bottle.desktop.glb
cp "$GV_WORK_DIR/bottle-mobile/final.glb" frontend/public/assets/models/grapevyne-meshy-bottle.mobile.glb
cp "$GV_WORK_DIR/grape-desktop/final-valid.glb" frontend/public/assets/models/grapevyne-meshy-grapes.desktop.glb
cp "$GV_WORK_DIR/grape-mobile/final.glb" frontend/public/assets/models/grapevyne-meshy-grapes.mobile.glb

for GV_MODEL in frontend/public/assets/models/grapevyne-meshy-*.glb; do
  "$GV_GLTF_TRANSFORM" validate "$GV_MODEL" --format md
  "$GV_GLTF_TRANSFORM" inspect "$GV_MODEL" --format md
  shasum -a 256 "$GV_MODEL"
  stat -f '%N|%z' "$GV_MODEL"
done

shasum -a 256 frontend/public/assets/models/grapevyne-meshy-*.glb \
  | sort \
  | shasum -a 256
```

A clean replay of the complete bottle-mobile pipeline was byte-for-byte identical to production (`cmp` passed). The checked-in repair script also reproduced the exact grape-desktop production hash.

## Render evidence and fallbacks

The four checked-in 1600 × 900 PNGs are direct browser renders of each read-only source master beside its exact production counterpart:

| Comparison | PNG | SHA-256 |
| --- | --- | --- |
| Bottle desktop | [`bottle-desktop-source-vs-production.png`](./bottle-desktop-source-vs-production.png) | `0c6b9924422d2a28c06af4bbab3d68109c29eaa003014f5e0b4bc8f30da8496f` |
| Bottle mobile | [`bottle-mobile-source-vs-production.png`](./bottle-mobile-source-vs-production.png) | `c22adde2248f2910a82f31d75e834d51ab5c804a3515a92fdbeacbc222c8f837` |
| Grape desktop | [`grapes-desktop-source-vs-production.png`](./grapes-desktop-source-vs-production.png) | `9fc208944513a3d2d33e3a341870d114b7658806354e2af03490d045ccbd2899` |
| Grape mobile | [`grapes-mobile-source-vs-production.png`](./grapes-mobile-source-vs-production.png) | `e7f79bc17dbbce0f8f0da12427e15b57ded44721770cabeaf8fadceca5e25966` |

The renders use the checked-in [`render-harness.html`](./render-harness.html), Three.js 0.169.0 from `frontend/node_modules`, and standard `GLTFLoader`. Both halves of each image are rendered in the same WebGL renderer with the same fixed camera, ACES tone mapping, pixel ratio, lighting, normalized framing, and rotation. Source files are loaded read-only from `/Users/rachel/Downloads`; they are never copied into the repository or any public path. Production files are loaded from their exact checked-in paths. The page has no remote URL, decoder, texture, font, or other network dependency.

Capture environment: Headless Chrome 151, WebGL through ANGLE Metal on Apple M1 Pro, viewport 1600 × 900, device-pixel ratio 1. A repeated capture of the final comparison was byte-for-byte identical (`cmp` passed), confirming stable output within the recorded environment.

Visual inspection of all four PNGs passed. Each production render preserves its source silhouette, mesh orientation, UV placement, material regions, and recognizable surface detail at the capture scale. Bottle capsules, neck reflections, and label boundaries remain aligned; grape stems, leaves, berry layout, bloom, and highlights remain aligned. No missing geometry, texture inversion, unexpected transparency, or visible tangent artifact was observed. The expected production differences are limited to texture resampling/WebP encoding and generated tangents; the desktop-grape normal map uses its documented near-lossless exception. The separate exact GRAPEVYNE runtime label is intentionally excluded because it is application-owned overlay geometry rather than part of either Meshy GLB.

### Reproduce the comparisons

Run from the repository root. The local server uses `/` as its document root only so one same-origin page can read the four external source masters and four repository production files without copying any source model. Stop the server immediately after capture.

```bash
python3 -m http.server 8777 --bind 127.0.0.1 --directory /

GV_COMPARE_URL="http://127.0.0.1:8777/Users/rachel/Desktop/GRAPEVYNE/docs/screenshots/prompt-10a1/model-comparisons/render-harness.html"
GV_COMPARE_OUT="docs/screenshots/prompt-10a1/model-comparisons"
GV_AGENT_BROWSER="agent-browser"

"$GV_AGENT_BROWSER" --session grapevyne-model-compare set viewport 1600 900

for GV_PAIR in bottle-desktop bottle-mobile grapes-desktop grapes-mobile; do
  "$GV_AGENT_BROWSER" --session grapevyne-model-compare open "$GV_COMPARE_URL?pair=$GV_PAIR"
  "$GV_AGENT_BROWSER" --session grapevyne-model-compare wait 'body.ready'
  "$GV_AGENT_BROWSER" --session grapevyne-model-compare eval \
    'JSON.stringify({ready: window.__comparisonReady, comparison: window.__comparison})'
  "$GV_AGENT_BROWSER" --session grapevyne-model-compare errors
  "$GV_AGENT_BROWSER" --session grapevyne-model-compare screenshot \
    "$GV_COMPARE_OUT/$GV_PAIR-source-vs-production.png"
done

"$GV_AGENT_BROWSER" --session grapevyne-model-compare close

file "$GV_COMPARE_OUT"/*-source-vs-production.png
shasum -a 256 "$GV_COMPARE_OUT"/*-source-vs-production.png
```

The existing CSS/poster fallbacks and legacy GLBs remain unchanged by this comparison workflow.
