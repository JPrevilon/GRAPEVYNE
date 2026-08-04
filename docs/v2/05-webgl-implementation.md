# Prompt 05 — Persistent WebGL Bottle Experience

## Verdict

Prompt 05 adds one route-local, persistent WebGL bottle layer to the existing nine-chapter homepage without changing the Flask backend, database, authentication, product routes, cinematic-media registry, typography, fonts, or display copy. The approved bottle is upright, label-forward, responsive, chapter-driven, and visually integrated with the accepted Prompt 04B composition. The CSS bottle remains the guaranteed first-paint and failure fallback.

The implementation passed asset verification, lint, TypeScript, 197 automated tests, production build, and real-browser rendering. Browser evidence and measurements are recorded below.

## Dependency and compatibility contract

| Package | Locked version | Role |
| --- | ---: | --- |
| `react` | 18.3.1 | Existing application runtime; unchanged |
| `react-dom` | 18.3.1 | Existing DOM runtime; unchanged |
| `three` | 0.169.0 | Renderer, scene graph, materials, math |
| `@react-three/fiber` | 8.17.10 | React 18-compatible R3F v8 renderer |
| `@react-three/drei` | 9.114.3 | `useGLTF` and `useTexture` loaders |
| `@types/three` | 0.169.0 | Exact development type dependency |

No R3F 9, Drei 10, direct postprocessing, physics, shader, WebGPU runtime/rendering, model-viewer, HDRI, or additional animation dependency was added, and none of those features is imported or used. The exact required packages do carry unused transitive helpers: `@types/three` carries types-only `@webgpu/types@0.1.71`, while Drei carries `glsl-noise` and `troika-three-text -> webgl-sdf-generator`; the production scene does not import them. A narrow `stats-gl > three` npm override deduplicates Drei's otherwise nested Three 0.170.0 to the required root Three 0.169.0. A clean temporary `npm ci` and `npm ls` both confirm one Three.js version and a clean React 18 tree; lockfile comparison shows 66 package additions with zero pre-existing package versions, integrities, or resolutions changed.

## Asset provenance and immutable manifest

The ten approved assets were positively located in `.grapevyne-v2-reference/frontend/public/assets/`, hash-checked before copying, and copied only into `frontend/public/assets/models/` and `frontend/public/assets/labels/`. Their immutable contract is machine-readable in [`05-webgl-asset-manifest.json`](./05-webgl-asset-manifest.json).

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `models/grapevyne-master-bottle.glb` | 1,182,548 | `2304b4b89cc7a249527746c6b1f7ceb02759f6395a709b129e539941c885c05a` |
| `models/grapevyne-master-bottle-mobile.glb` | 1,115,844 | `1caa5eb4786326199f0f2b1fd4066590aaccda02a54da03e14bfba9bee10e3f8` |
| `models/bottle-spec.json` | 868 | `94573f075540f23594070997db39391a2eae992a8638378e2a491e99afe5ddaf` |
| `models/model-validation.json` | 835 | `deb4d10988c743bdf0a6b3cba8c06e9001e5f99d1a55d13491e2b283ea4c3bfd` |
| `labels/grapevyne-label-front-red.png` | 788,087 | `fc1e798888c59d1dc335a964309de8ddf570be68b509f47b0be396be244f4281` |
| `labels/grapevyne-label-front-white.png` | 789,205 | `543107978d3e46f5b60846c326079f4cae8481ebaa91994c051a77450ecfa4c3` |
| `labels/grapevyne-label-front-sparkling.png` | 830,486 | `79a159d2399734f60f6602dde705cfc279d31aa70cfc607538244f29b0eed3ce` |
| `labels/grapevyne-label-front-rose.png` | 842,237 | `6f4b8d61ec65a22d50c391ebe2fd1846b2651ad5f30e08f40dcb953e3a074e50` |
| `labels/grapevyne-label-back.png` | 290,856 | `d33586e7beeec7ef60d203a5bf74bbb8a39b9d30f21471549a6b2e7d32f791d3` |
| `labels/grapevyne-label-neck-capsule.png` | 98,787 | `63e056294a30643153444a8f33df805f715ba4a09cfeb39fe4156377cef5992e` |

Total approved Prompt 05 asset payload is 5,939,753 bytes. Only the tier-appropriate model plus the red front and common back labels are requested during the current scene. White, sparkling, rose, and capsule artwork are copied and manifest-ready but not requested.

## Model and coordinate contract

Both GLBs contain meshes and nodes named exactly:

`Bottle_Glass`, `Wine_Liquid`, `Cork`, `Capsule`, `Label_Front`, `Label_Back`, and `Condensation`.

The desktop model contains 2,724 vertices and 5,284 triangles; the mobile model contains 828 vertices and 1,624 triangles. Both fit their 2.5 MB and 1.2 MB budgets.

The authored bottle is local Z-up. Runtime hierarchy is deliberately separated so decorative pointer pitch never mutates the permanent correction:

```text
interaction group
  -> chapter transform group
    -> normalization group (rotation.x = -Math.PI / 2)
      -> cloned GLB scene
```

Accessor bounds and normalized `Box3` validation produced:

| Tier | Normalized width | height | depth | base Y |
| --- | ---: | ---: | ---: | ---: |
| High/desktop | 0.7400 | 2.6800 | 0.7581 | 0.0000 |
| Standard/mobile | 0.7400 | 2.6800 | 0.7440 | 0.0000 |

The external labels require `flipY = true` for the approved placeholder UV convention. Browser inspection confirms the front label faces +Z toward the camera and is upright, readable, unmirrored, and not visible through the bottle back.

## Architecture and layer order

`HomePage` imports a light `WebGLExperience` shell. That shell makes the reduced-motion, Save-Data, hardware, pointer, viewport, and temporary WebGL probe decision before scheduling the dynamic `ExperienceCanvas` import after the semantic hero has rendered. Three, R3F, Drei, loaders, model code, materials, and scene code remain in the Home-only lazy graph.

There is exactly one fixed R3F `Canvas`, only while Home is mounted. The DOM order and z-index tokens implement:

```text
cinematic video/poster (background)
  -> CSS bottle while not ready / persistent WebGL bottle after ready
    -> semantic headings, search, navigation, controls, cards, and CTAs
```

The fixed wrapper and canvas are `aria-hidden`, inert, `tabIndex=-1`, transparent, and `pointer-events:none`. No meaningful text or interactive UI is rendered in WebGL.

The accepted single `BrowserRouter`, `AuthProvider`, `QueryClientProvider`, and `SceneProvider` topology is unchanged. `SceneProvider` now exposes one stable progress ref. The existing scroll runtime writes chapter/story progress and activity to that ref; the R3F frame loop reads it without React state updates or per-frame object allocation. GSAP and Lenis continue to own desktop scroll progress and DOM reveals. CSS sticky foregrounds replace GSAP's DOM-reparenting pin wrapper, avoiding route-unmount `removeChild` errors while preserving the accepted pinned visual behavior.

## Capability tiers

| Tier | Selection | Model/render policy |
| --- | --- | --- |
| High | Fine-pointer viewport at least 1024 px, adequate memory/cores, WebGL available, no reduced motion/Save-Data | Desktop GLB, DPR 1–1.5, antialiasing, condensation, shadow ellipse, four local lights, passive pointer response |
| Standard | WebGL-capable mobile/tablet or lower-capability hardware that remains above the fallback floor | Mobile GLB, DPR 1–1.1, no antialiasing, no condensation, no decorative geometry, simpler three-light rig, no pointer listener |
| Fallback | Reduced motion, Save-Data, no WebGL, major-performance caveat, clearly low memory/core count, loader/import/model/texture/renderer failure, unrecovered context loss | Preflight fallbacks make no lazy canvas/model/label request; runtime failures tear down work already requested. CSS bottle/poster and every semantic control remain available |

The renderer is transparent, high-performance, non-stenciled, does not preserve its drawing buffer, uses sRGB output, ACES filmic tone mapping, and restrained exposure (1.08 high, 1.0 standard). There is no postprocessing.

## Chapter transform system

All target records include position, scale, rotation, visibility, key-light emphasis, and decoration intensity. All remain reversible because each frame damps from the current transform toward the current/next chapter blend.

| Chapter | High-tier story behavior | Standard/mobile behavior |
| --- | --- | --- |
| Hero | Right pedestal, label-forward, scale 1.12, subtle idle and bounded pointer response | Centered above mobile pedestal, scale 0.80, no pointer |
| Discovery | Moves farther right and opens the search field, exploratory yaw | Small rightward shift, scale 0.77 |
| Match | Becomes more central/prominent with strongest analytical key light | Modest right shift, scale 0.79 |
| Taste | Retreats slightly while liquid media dominates | Smaller/right, scale 0.72 |
| Portal | Travels left toward the cellar doorway and reduces | Reversible small left shift, scale 0.72 |
| Cellar | Returns right and integrates with shelving/corridor | Small right shelf composition, scale 0.72 |
| Memory | Sits beside, not over, the DOM memory card and glass | Small right composition, scale 0.72 |
| Atlas | Becomes smallest and distant so the atlas demonstration dominates | Small left/distant composition, scale 0.66 |
| Finale | Returns to a confident central-right label-forward composition | Centered, scale 0.76 |

Desktop pointer motion is limited to ±4° yaw and ±2° pitch through a passive window listener. It is ignored for touch pointers and hidden documents and removed at unmount. The mobile standard tier never attaches it.

## Materials and lighting

The cached GLTF scene is never mutated. Each mount deep-clones the scene, clones every geometry (computing missing vertex normals), creates scene-owned runtime materials, and creates bounded scene-owned label textures. Unmount disposes only those clones and derived textures; cached GLTF geometry/materials and source label textures remain intact for efficient re-entry.

- Glass: dark green-black physical material, restrained clearcoat, low roughness, believable edge highlights, controlled opacity, and explicit render order.
- Liquid: deep burgundy, physically distinct from the glass, non-metallic, never emissive/candy red.
- Cork: warm embedded color with high roughness and no metalness.
- Capsule: near-black embedded response with restrained metalness.
- Labels: sRGB aged-ivory paper response, high roughness, front-sided to prevent back-through duplication.
- Condensation: subtle and high-tier only.

Lighting is local-only: soft neutral/champagne hemisphere, champagne spot key, burgundy point fill, plus a restrained high-tier directional rim. There is no environment preset, remote HDRI, remote texture, or runtime CDN request.

## Ready, fallback, and recovery handshake

The CSS bottle renders with the semantic hero. Only after capability passes does the idle-scheduled lazy import begin. The chosen GLB and red/back labels load, the seven-node contract validates, and the cloned `Label_Front` mesh must execute its first real `onAfterRender` callback before `onReady` is emitted. A layout-effect readiness bridge crossfades the CSS bottle and WebGL layer in the same commit; runtime failure restores the CSS bottle before the failed canvas disappears, preventing an empty paint.

The dedicated error boundary catches lazy/render/model/texture/material failures. Context loss immediately marks the WebGL layer recovering, restores CSS, and stops rendering. One restoration is allowed; a second loss or 3.5-second restore timeout permanently returns to fallback for that activation. `document.hidden` and out-of-story state switch R3F to `frameloop="never"`; visibility/activity recovery invalidates and resumes it.

Actual DOM unmount clears the renderer animation loop and forces context loss immediately. A `canvas.isConnected` guard ensures React 18 Strict Effects' synthetic connected cleanup does not destroy the live renderer. Pointer, visibility, resize, scroll, IntersectionObserver, idle callback, timeouts, GSAP triggers/ticker, Lenis, derived materials, geometries, and textures all have explicit cleanup.

Reduced motion and Save-Data return before the WebGL probe/import stage: no Canvas, model, label, pointer listener, or WebGL chunk is requested. The nine chapters stay in normal flow with poster/CSS fallbacks.

## Verification

Automated frontend results:

- `verify:assets`: 3 foundational + 30 immutable video/poster + 10 immutable WebGL assets passed.
- ESLint: passed with zero warnings.
- TypeScript: passed.
- Vitest: 34 files, 197 tests passed.
- Production build: 2,309 modules transformed and passed.
- `git diff --check`: passed.
- Formal `test:e2e`: not defined; no placeholder was added.
- Backend pytest suite: not present; the unchanged real Flask API was started and smoke-checked instead.

Behavioral tests cover capability tiers, early fallback without probing/importing, route isolation, exact models/labels, node errors, real `Label_Front` frame handshake, material/resource ownership, high/standard renderer policy, context loss/recovery, visibility, StrictMode vs real unmount cleanup, one canvas, fallback timing, pointer limits/listener cleanup, forward/reverse damping, stable progress refs, all nine chapters, media registry/hash invariants, and verifier mutation failures.

Real Flask smoke results:

- `GET /api/health` -> 200 accepted success envelope.
- `GET /api/auth/me` -> 401 `authentication_required` without a session.
- `GET /api/wines/search?query=steak` -> 200 real `WineService` result envelope.
- `GET /api/cellar` -> 401 `authentication_required` without a session.
- Credentialed CORS response allows `http://127.0.0.1:5173`.

### Browser matrix

The frontend and real Flask API were run at `http://127.0.0.1:5173` and `http://127.0.0.1:5000`. Automated Chromium verification covered Home, Discover, Demo Cellar, a real wine detail route, all nine chapter anchors, forward/reverse scroll, reduced motion, deliberately disabled WebGL, loader failure, and repeated route re-entry at:

- Desktop: 1440×900 and 1920×1080.
- Tablet: 768×1024 and 1024×768.
- Mobile: 360×800, 390×844, and 430×932.
- Reduced motion: 1440×900 and 390×844.
- Disabled WebGL: desktop session with context creation disabled.

Every normal viewport reached `.gv-story--webgl-ready` with exactly one canvas, one selected model tier, no horizontal overflow, no Vite overlay, and no page, shader, or application-console error. Desktop widths 1024, 1440, and 1920 selected `high` and requested only the desktop GLB plus red/front and back labels. Widths 360, 390, 430, and 768 selected `standard` and requested only the mobile GLB plus those same two labels. The canvas was observed with `aria-hidden="true"`, `tabindex="-1"`, and computed `pointer-events: none`.

All nine anchors selected correctly during forward navigation; reverse movement from chapter 09 to chapter 04 restored `04 / TASTE SIGNALS` with the same canvas. Mobile Taste and Atlas remained readable without overflow. Pointer-left and pointer-right states showed only the bounded high-tier yaw/pitch response.

Reduced motion at 1440×900 and 390×844, disabled WebGL at 1440×900, and the held-idle pre-ready state all produced zero canvases and zero lazy WebGL, GLB, or label requests. An intentionally aborted desktop GLB request produced zero transferred model bytes, requested no labels, restored the CSS fallback, and removed the failed canvas/context without a retry loop. The final 1440×900 fallback rectangle is x=876.39–1020.39 and y=369–866.19, leaving the complete bottle visible with nav separation and floor clearance. The intentional failure alone produced the expected caught React boundary stack and GRAPEVYNE fallback warning; normal sessions did not.

Product-route checks showed zero canvases and no WebGL/model/label graph on Discover, Demo Cellar, and Wine Detail. The production preview at `http://127.0.0.1:4173/` reached high/ready/one canvas; a direct preview load of `/discover` loaded only entry and Discover dependencies. Both had zero browser page errors. Preview-origin API calls logged one expected AuthProvider network error because the unchanged Flask CORS allowlist contains development origin `http://127.0.0.1:5173`, not disposable preview origin `:4173`; normal development-origin verification had no such error.

### Screenshots

The 31 accepted final captures are stored in [`docs/screenshots/prompt-05/`](../screenshots/prompt-05/): `05`–`14` cover all required ready sizes and fallbacks; `15`–`22` cover chapters 02–09; `23` is reverse chapter 04; `24` is true pre-ready; `25`–`27` are product routes; `30` is the settled third Home re-entry; `31`–`32` are mobile Taste/Atlas; `33`–`34` are pointer extremes; `35` is model-load failure; and `36`–`37` are production-preview Home/Discover. `sips` explicitly confirmed required desktop captures `05`, `12`, `14`, `24`, and `35` are exactly 1440×900.

## Build and performance

| Output | Prompt 04B baseline raw/gzip | Prompt 05 raw/gzip | Delta raw/gzip |
| --- | ---: | ---: | ---: |
| Principal application JS | 215.20 / 69.24 kB | 215.28 / 69.28 kB | +0.08 / +0.04 kB |
| Home JS | 22.76 / 7.77 kB | 26.87 / 9.47 kB | +4.11 / +1.70 kB |
| Shared CSS | 124.92 / 22.46 kB | 124.92 / 22.46 kB | 0 / 0 kB |
| Home CSS | 18.36 / 4.17 kB | 19.54 / 4.43 kB | +1.18 / +0.26 kB |
| Lazy WebGL graph | none | 904.71 / 246.34 kB | lazy-only |

Vite's default graph keeps Three.js, R3F, Drei, and the experience code inside one Home-only dynamic `ExperienceCanvas` output. Attempts to force per-library manual chunks caused Rollup/Vite shared helpers to become eager product-route dependencies, so the safe default graph was retained. `dist/index.html`, the principal entry, Discover, Cellar, and Wine Detail contain no `ExperienceCanvas` import/preload; only the Home dynamic dependency map references it. Per-library physical file sizes are therefore not independently emitted; the combined lazy graph is reported above.

Runtime source payload per activation is 2,261,491 bytes for high tier (desktop GLB + red/front + back labels) and 2,194,787 bytes for standard tier (mobile GLB + the same two labels). Derived labels are capped near 1489×2048 high and 745×1024 standard rather than uploading the 2400×3300 sources directly.

The cold-ish mobile development Home recorded 84 resource entries: 72 scripts, 3 images, 3 stylesheets, 3 fetches, 1 other, and 2 video entries. Its WebGL payload URLs were same-origin only:

- `http://127.0.0.1:5173/assets/models/grapevyne-master-bottle-mobile.glb`
- `http://127.0.0.1:5173/assets/labels/grapevyne-label-front-red.png`
- `http://127.0.0.1:5173/assets/labels/grapevyne-label-back.png`
- `http://127.0.0.1:5173/assets/video/posters/mobile/hero-bottle-macro.mobile.jpg`
- `http://127.0.0.1:5173/assets/video/mobile/hero-bottle-macro.mobile.webm`

The dev graph additionally requested the local `WebGLExperience`, `qualityTier`, `WebGLBoundary`, lazy `ExperienceCanvas`, `SceneRig`, `BottleModel`, `sceneTargets`, `pointerMotion`, `modelAssets`, and `modelContract` modules plus Vite's local Three/R3F/Drei transforms. No remote model, label, HDRI, environment, or CDN URL appeared. Mobile model/red/back transfer and decoded sizes were 1,116,144/1,115,844, 788,387/788,087, and 291,156/290,856 bytes; the mobile hero poster/WebM were 241,775/241,475 and 2,109,320/2,109,020 bytes. The observed desktop GLB was 1,182,848/1,182,548 bytes.

An instrumented dev SPA activation measured navigation-to-semantic-hero at 15.5 ms, hero-to-first-valid-WebGL-frame at 407.4 ms, navigation-to-ready at 422.9 ms, and the internal import-to-frame measure at 371.0 ms. Cold/cache/server state varied from 564.1 ms mobile to 695.7 ms wide desktop, with one uncached/restart desktop activation at 1,952.3 ms. Dev initialization observed six long tasks (57, 64, 256, 56, 116, and 79 ms); the production preview's 510.1 ms import-to-frame activation observed none.

Frame sampling held 60.0 FPS on both tiers: desktop high recorded 150 frames over 2,505.9 ms (16.67 ms average, 17.0 ms p95, 17.3 ms max); mobile standard recorded 150 over 2,506.9 ms (16.67 ms average, 16.8 ms p95, 17.4 ms max). Production transferred 246,642 bytes for the 904,708-byte decoded lazy WebGL chunk, again requesting only the desktop GLB and red/back labels.

Three complete Home -> Discover -> Home -> Demo Cellar -> Home -> Wine Detail -> Home cycles, including a rapid cycle, never exceeded one canvas. Every departure settled at zero and every Home at one; after the initial canvas, mutation totals were nine additions and nine removals. One cached model/red/back resource entry served all cycles. Used JS heap moved from 30,035,612 bytes to 32,815,461 bytes after natural collection/final inspection (+2.78 MB), with a 36,574,986-byte transient snapshot peak and no monotonic canvas/context growth. Home owned five video nodes (only hero active), while Discover owned zero; Lenis/smoothing classes cleared off-route, pin spacers stayed zero, and expected teardown-only Three context-loss info logs did not accumulate into warnings or failures.

## Preserved API, auth, and data contracts

No backend, migration, schema, service, API adapter, recommendation, Taste Atlas, or deployment file changed.

- API base remains `VITE_API_BASE_URL` or `http://<browser-host>:5000/api`.
- Every frontend request retains `credentials: "include"`.
- Success remains `{ "data": ..., "message"?: ... }`; errors remain `{ "error": { "code", "message", "details"? } }`.
- Auth remains Flask's signed, HTTP-only, SameSite-Lax session using `session["user_id"]`, with the accepted seven-day lifetime and credentialed CORS.
- `/cellar` and `/profile` remain protected; demo routes remain public.
- Cellar reads/writes remain filtered by authenticated `user_id`; duplicate-save and owner-not-found behaviors are unchanged.
- React Query private keys remain identity-scoped and are removed when identity changes.
- The 30 accepted cinematic assets still match aggregate digest `0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018`.

## Advisory comparison

| Audit | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Accepted Prompt 04B | 1 | 3 | 4 | 0 | 8 |
| Prompt 05 final | 1 | 5 | 4 | 0 | 10 |

Three and R3F introduced no advisory. The exact pinned Drei 9.114.3 tree adds the two counted moderate entries `@react-three/drei -> uuid@9.0.1` and `uuid` for GHSA-w5hq-g745-h8pq. The audit's suggested Drei 9.122.0 conflicts with the phase's exact version lock. Existing findings remain `@babel/core`, `brace-expansion`, `esbuild -> vite`, `js-yaml`, `postcss`, `react-router -> react-router-dom`, and `vite`. No peer warning or critical advisory exists. No forced audit remediation was run.

## Remaining limitations and deferred work

- The capability tier is selected once per Home activation. A live desktop-to-mobile resize keeps the already selected model until Home re-entry; normal responsive layout remains correct.
- A request that stalls forever without resolving or rejecting can leave the transparent loading Canvas mounted while the visible CSS fallback remains usable. Import/model/texture rejection is handled, but no application-level network-abort timeout is added in this phase.
- The accepted immutable “Under the Cork” copy still describes WebGL as future work; Prompt 05 explicitly prohibited copy changes.
- Vite emits one expected >500 kB warning for the lazy Three/R3F/Drei graph. It is not part of product-route initial loading.
- Future label switching, richer decoration, postprocessing, editable 3D cellar, personalized Taste Atlas data, and Prompt 06 work remain intentionally deferred.

## Command ledger

Principal commands executed during Prompt 05 (all install/audit commands used `/tmp/grapevyne-p05-npm.BRhjUk`, never `/Volumes/LaCie/.npm-cache`):

```bash
sed -n '1,1720p' /Users/rachel/.codex/attachments/e48c6690-a051-49d1-8f53-a7fc3ae5abf8/pasted-text.txt
sed -n '1,260p' .grapevyne-v2-reference/prompts/codex/00-MASTER-RULES.md
sed -n '1,520p' .grapevyne-v2-reference/prompts/codex/05-WEBGL-SCENE.md
git status --short --branch
git show --stat --oneline d83b362abe94f14f1644e6483f86be5ff559be87
npm run verify:assets
find .grapevyne-v2-reference -type f \( -name 'grapevyne-master-bottle*.glb' -o -name 'bottle-spec.json' -o -name 'model-validation.json' -o -name 'grapevyne-label-*.png' \) | sort
shasum -a 256 <all ten approved source and copied assets>
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm install --save-exact three@0.169.0 @react-three/fiber@8.17.10 @react-three/drei@9.114.3
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm install --save-dev --save-exact @types/three@0.169.0
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm install
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm install --force  # attempted package-tree reification only; not audit remediation
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm ci --ignore-scripts   # disposable lock/reification validation
npm ls react react-dom three @react-three/fiber @react-three/drei @types/three
npm run verify:assets
npm run lint
npm run typecheck
npm test
npm run build
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm audit --json
env npm_config_cache=/tmp/grapevyne-p05-npm.BRhjUk npm audit
npm ls @webgpu/types
npm ls glsl-noise webgl-sdf-generator @mediapipe/tasks-vision --all
git diff --check
backend/.venv/bin/pip check
.venv/bin/flask --app app run --host 127.0.0.1 --port 5000
curl --include http://127.0.0.1:5000/api/health
curl --include http://127.0.0.1:5000/api/auth/me
curl --include 'http://127.0.0.1:5000/api/wines/search?query=steak'
curl --include http://127.0.0.1:5000/api/cellar
node --input-type=module <GLB JSON/accessor/node/bounds/triangle validation>
sips -g pixelWidth -g pixelHeight frontend/public/assets/labels/*.png
rg <provider/router/route/media/WebGL/remote-URL invariants>
```

Browser automation used the temp-cache-installed `agent-browser` binary in named disposable sessions. The principal command patterns were:

```bash
npx --cache /tmp/grapevyne-p05-npm.BRhjUk --yes agent-browser --session <name> batch --bail "set viewport W H" "open http://127.0.0.1:5173/" "wait .gv-story--webgl-ready" "eval '<evidence>'" "screenshot docs/screenshots/prompt-05/<file>.png"
agent-browser --session p05finalreduced900 batch --bail "set viewport 1440 900" "set media light reduced-motion" "open http://127.0.0.1:5173/" "eval '<zero-WebGL evidence>'" "screenshot docs/screenshots/prompt-05/12-reduced-motion-1440-final.png"
agent-browser --session p05finaldisabled900 --args "--disable-webgl" batch --bail "set viewport 1440 900" "open http://127.0.0.1:5173/" "eval '<zero-WebGL evidence>'" "screenshot docs/screenshots/prompt-05/14-webgl-disabled-1440-final.png"
agent-browser --session p05finalfailure900 batch --bail "set viewport 1440 900" "network route http://127.0.0.1:5173/assets/models/grapevyne-master-bottle.glb --abort" "open http://127.0.0.1:5173/" "wait 5000" "eval '<fallback evidence>'" "screenshot docs/screenshots/prompt-05/35-model-load-failure-final.png"
npm run preview -- --host 127.0.0.1 --port 4173
sips -g pixelWidth -g pixelHeight docs/screenshots/prompt-05/{05-home-1440-final.png,12-reduced-motion-1440-final.png,14-webgl-disabled-1440-final.png,24-hero-before-webgl-ready-final.png,35-model-load-failure-final.png}
```

Chapter checks used `scrollIntoView`, waited for `[aria-current=step]`, and then reversed 09 -> 04. Pointer checks moved the mouse to x=0 and x=1439. Route cycles used SPA `pushstate` with 100 ms and 750 ms departure pacing plus per-state DOM/resource snapshots. FPS used a 2.5-second `requestAnimationFrame` sampler; initialization used `MutationObserver`, performance marks/measures, and a buffered long-task observer. Each named browser and preview session was closed after capture.
