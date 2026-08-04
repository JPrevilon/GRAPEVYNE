# Prompt 10A1R — Cinematic story rebuild

## Report status

This is the implementation report for Prompt 10A1R on
`feat/grapevyne-cinematic-v2`, based on accepted commit
`b99dd6d8bc75f97f3047ba71c3c92b9f34df9c0f`.

**Current verdict: PENDING FINAL RELEASE GATES.** The fixed-stage rebuild, media
pipeline, conditional Meshy subjects, static fallbacks, compact navigation, and
interactive bottle viewer are implemented in the working tree. The final local
frontend, backend, browser, accessibility, deterministic-visual, performance,
and evidence gates are complete. GitHub-hosted checks, a SHA-bound Vercel
Preview, hosted session/privacy checks, and deployment logs must still complete
before this report may be changed to PASS. No Production deployment or PR merge
is claimed.

Prompt 10A1R replaces the older Prompt 10A1. Prompt 10B is outside this report.

## 1. Overall visual verdict

The implementation replaces the accepted Preview's stacked-page feeling with
one restrained cinematic stage driven by a nine-step semantic scroll track.
The homepage now gives media, negative space, and one permitted 3D subject visual
priority. Copy and actions follow the locked minimal-content ceiling.

The final local Chromium matrix and checked-in evidence show the intended hero,
vineyard/grape, subject-free, transition, static-fallback, mobile, and
bottle-inspector compositions. The local visual verdict is PASS, including the
regression that every settled subject-free chapter clears any preceding WebGL
subject frame. Final release acceptance remains pending the new hosted Preview
review and its exact-SHA checks.

## 2. Before and after architecture

### Accepted Prompt 10A base

```text
Page document
  -> multiple visually independent chapter sections
      -> per-section cinematic layer
      -> persistent bottle treatment
      -> repeated chapter copy/actions/navigation
```

### Prompt 10A1R implementation

```text
Home story shell
  -> one sticky 100svh visual stage
      -> StoryMediaStack (nine layered poster/video pairs)
      -> shared obsidian transition veil
      -> pointer-inert WebGLExperience
          -> bottle group, grape group, or neither
      -> CSS/static subject fallbacks
  -> compact ChapterProgress
  -> one semantic native-scroll track
      -> nine stable chapter sections and hashes
      -> minimal live DOM headings, copy, and essential actions
```

`HomePage` owns the single story shell and semantic sections. `useScrollStory`
maps native/Lenis/ScrollTrigger progress into the existing `SceneProvider` ref.
`StoryMediaStack` and `SceneRig` consume that shared progress without placing a
React state update on every animation frame. The heavy WebGL scene and the
bottle viewer remain separate lazy imports from the Home route. Product routes
retain their existing static import isolation.

## 3. Exact nine-chapter contract

The IDs below remain stable. The `StorySubject` union is exactly `"bottle" |
"grapes" | "none"`.

| No. | Stable key and anchor | Media key / production slug | Source class | 3D subject | Visible title | Supporting line | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | `hero` / `chapter-01-hero` | `hero` / `hero-bottle-macro` | Accepted scene, new scrub derivative | **Bottle** | FIND THE BOTTLE / KEEP THE MEMORY | A private wine directory shaped by what you love. | DISCOVER; INSPECT BOTTLE |
| 02 | `discovery` / `chapter-02-discovery` | `vineyard` / `vineyard-flight` | User-supplied final master | **Grapes** | DESCRIBE THE MOMENT | Meal, mood, region, or price. | One compact SEARCH WINES form |
| 03 | `match` / `chapter-03-match` | `dateNight` / `date-night-table-pan` | User-supplied final master | **None** | WHY IT FITS | Clear reasons, not a mystery score. | None |
| 04 | `taste` / `chapter-04-taste` | `liquid` / `taste-liquid-transition` | Accepted scene, new scrub derivative | **None** | TASTE TAKES SHAPE | Every rating sharpens the profile. | None |
| 05 | `portal` / `chapter-05-portal` | `cellar` / `cellar-corridor-push` | Accepted scene, new scrub derivative | **Bottle** | OPEN THE CELLAR | Save the bottles worth remembering. | OPEN CELLAR or CREATE CELLAR |
| 06 | `cellar` / `chapter-06-cellar` | `barrelHouse` / `barrel-house-pan` | User-supplied final master | **None** | BUILD THE COLLECTION | A private record of the bottles that matter. | None |
| 07 | `memory` / `chapter-07-memory` | `memory` / `memory-table-ambience` | Accepted scene, new scrub derivative | **None** | REMEMBER THE POUR | The bottle, the place, the night. | None |
| 08 | `atlas` / `chapter-08-atlas` | `atlas` / `taste-atlas-finale` | Accepted scene, new scrub derivative | **Bottle** | FOLLOW YOUR TASTE | See the patterns behind what you love. | VIEW TASTE PROFILE |
| 09 | `finale` / `chapter-09-finale` | `oceanVoyage` / `ocean-wine-voyage` | User-supplied final master | **None** | KEEP THE STORY | From vineyard to table, every bottle leaves a trace. | DISCOVER; Under the Cork disclosure |

The locked visibility result is therefore bottle only in 01/05/08, grapes only
in 02, and no 3D subject in 03/04/06/07/09. Grapes are decorative and never
interactive in the story stage.

## 4. Scroll-scrub and transition implementation

The old `CinematicVideo` component was removed. `StoryMediaStack` implements the
replacement contract:

- each selected video is `muted`, `playsInline`, control-free, paused, and has
  no `autoplay` or `loop` attribute;
- normalized chapter progress maps directly to `currentTime`, with the end
  clamped 0.04 seconds before duration;
- one requestAnimationFrame scheduler coalesces scroll updates; stopping scroll
  holds the last frame and reverse progress seeks backward;
- seeks begin only after metadata exists and failures preserve the paired
  poster;
- the poster remains visible until `seeked` or
  `requestVideoFrameCallback` confirms a decoded frame;
- only the current, previous, and next chapters mount media; the active clip
  preloads `auto` and adjacent clips preload `metadata`;
- device changes replace the video element and reset decode/failure state so a
  desktop frame cannot leak into the mobile presentation;
- page visibility, route departure, and component cleanup cancel the pending
  rAF/video-frame callback, pause all videos, and clear seek bookkeeping.

Media transition timing is deterministic and reversible. The current scene
fades from normalized progress 0.70–0.84. The common obsidian veil rises and
falls across the boundary, and the next scene enters from 0.90–1.00. Subject
timing is deliberately wider: fade out from 0.68–0.82, fully hidden from
0.82–0.90, then permitted next-subject fade-in from 0.90–1.00.

`SceneRig` selects the next transform at the fully hidden boundary. Position,
scale, and depth are applied while opacity is zero, so neither the bottle nor
grapes visibly flies between chapters. A parent group owns final visibility,
and the renderer uses a final demand-render before sleeping in a settled
subject-free chapter; document-hidden and off-story states stop it entirely.
Pointer response is limited to a small fine-pointer bottle motion. Chapter 02
grapes receive only restrained progress-linked rotation/depth, never a
continuous spin.

## 5. Story media provenance and encoding

The additive authority is
[`10a1-story-media-manifest.json`](10a1-story-media-manifest.json). It records
every source probe, output path, output probe, derivation command, byte count,
and SHA-256. It does not rewrite the accepted Prompt 04A manifest.

### User-supplied masters

All eight inputs came from `/Users/rachel/Downloads/FINAL_STORY_MASTERS/` and
were read without mutation.

| Source master | Bytes | SHA-256 |
| --- | ---: | --- |
| `vineyard-flight.desktop.mp4` | 52,508,118 | `50a054aa95dfc0b59f53da1d89fb3435467d7f592fda598b9c89b0bf0dfe6672` |
| `vineyard-flight.mobile.mp4` | 43,190,827 | `9b0cb2595ebe1aa74628dcc4c71a7be214f5297f191f70b5e239919337a4348a` |
| `date-night-table-pan.desktop.mp4` | 39,172,041 | `00a5369caecad13064f76ac4b9db69c70ee6d619992053416b6224db7e4e0c58` |
| `date-night-table-pan.mobile.mp4` | 30,514,260 | `7f02b4937b38b0293dd68f26d1d0fcbf7ee40d67e85fedba698e6be65a4e49ca` |
| `barrel-house-pan.desktop.mp4` | 45,162,789 | `4fb3b8007c717cc523d7ff05b67a2320bbf3deb7740f07b5a7081466be716f1c` |
| `barrel-house-pan.mobile.mp4` | 51,760,862 | `608b1a14676310a3b188e429a003bd8462423c4095de9e61b6d943cee86c633f` |
| `ocean-wine-voyage.desktop.mp4` | 54,887,383 | `2c5d2f7fff73af12e98fa04e7622a373be223f57d3a018676638f9e9ef9a46b2` |
| `ocean-wine-voyage.mobile.mp4` | 53,660,634 | `2998303d23907d07d7b73264aeb347069e444c6d2b1d82647779271dba5655c2` |

### Production payload

The Prompt 10A1R media set adds 44 files totaling 283,369,038 bytes:

| Class | Files | Bytes |
| --- | ---: | ---: |
| Four new scenes, desktop/mobile MP4 + WebM | 16 | 165,258,613 |
| Four new scenes, desktop/mobile final-frame poster | 8 | 2,417,932 |
| Five accepted scenes, additive desktop/mobile MP4 + WebM scrub encodes | 20 | 115,692,493 |
| **Total** | **44** | **283,369,038** |

The SHA-256 over lexicographically sorted payload-hash lines is
`e69b316c7893d163d7cc20873357c2b6bdeb92347c097e19aa354391dd63f4c3`.
The manifest is the non-truncated source for all 44 individual production
hashes. The 30 accepted Prompt 04A files remain byte-for-byte unchanged at
83,431,933 bytes, with source-tree digest
`0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018`.

Every production video is silent 24 fps, `yuv420p`, BT.709 limited range. MP4
uses H.264 and fast-start; WebM uses VP9. Both have a forced keyframe every six
frames (0.25 seconds), including the first/final frame. Desktop output is
1920×1080 and mobile output is 1080×1920. All 36 videos completed a full decode
during manifest creation.

Localized source cleanup is recorded rather than hidden: the barrel-house
mobile center bottle and ocean-voyage glyphs were removed with narrowly scoped,
tracked masks. The approximately 4:3 ocean desktop source keeps its complete
foreground frame over restrained ambient side fill rather than using a
destructive center crop. Final local browser evidence confirms clean settled
barrel-house and ocean-voyage compositions with no leaked 3D subject; hosted
media delivery remains part of the Preview release gate.

## 6. Meshy model provenance and optimization

The additive model authority is
[`10a1-meshy-model-manifest.json`](10a1-meshy-model-manifest.json), with
reproducibility material under
[`docs/screenshots/prompt-10a1/model-comparisons/`](../screenshots/prompt-10a1/model-comparisons/).
The four source GLBs remained outside `frontend/public` and were never mutated.

| Subject/tier | Source bytes / SHA-256 | Production bytes / SHA-256 | Geometry | Result |
| --- | --- | --- | --- | --- |
| Bottle desktop | 33,632,796 / `ce44f8031a49fee0d7772c6ea460c7888b774316fd24ae7c2c56654b0d65be6e` | 3,954,456 / `e3a78c10bf6b6253e552a77484656d267397521f54de1c57b6afcf337165165f` | 30,348 triangles; 15,848 → 15,911 vertices | 88.2423% smaller; preferred and hard budgets pass |
| Bottle mobile | 28,840,960 / `b4f0e15b8bf096661b59e49598de3b8b172a1a4fe50d5ba321e2c601f41ebe11` | 881,628 / `70ef18a4fd8d6ddbd20a2f84e3600a42708e1dd566ec991a2d5e668727147e25` | 9,356 triangles; 5,375 → 5,385 vertices | 96.9431% smaller; preferred and hard budgets pass |
| Grapes desktop | 65,649,924 / `06708b822a9a09c27b46c04e26d222b9da1ce79f0a3058bdb93e2115c362883b` | 8,187,568 / `2b6b475803ff1fd72d01afd6f912ba0acd558d2d668a3c5dcf18d4d280dedbb6` | 30,122 triangles; 35,032 → 35,142 vertices | 87.5284% smaller; preferred and hard budgets pass |
| Grapes mobile | 53,957,112 / `2355db9698752de47462086d7799ed0125bed81d88f493a72d3bf839821af54f` | 1,890,584 / `cccac924677f6114cca2276b859ef967e055d3eafe6ed73521fb2b7a9c3ae489` | 9,292 triangles; 8,216 → 8,282 vertices | 96.4961% smaller; preferred and hard budgets pass |

Production model total is 14,914,236 bytes; aggregate SHA-256 is
`5f3b537986d932fb9b03369e310c9f7d6fea8d81432187858f9e40149c93bd47`.

The pinned temporary toolchain uses glTF Transform 4.3.0 and Sharp 0.34.2.
It generates MikkTSpace tangents, resizes desktop textures to
2048²/2048²/1024² and mobile textures to 1024²/1024²/512², and embeds browser-
safe WebP. The grape desktop normal uses reviewed near-lossless quality 90; all
other normals and metallic/roughness maps are lossless. Two UV-degenerate
grape-desktop tangents were deterministically repaired without changing
positions, normals, UVs, indices, triangles, bounds, materials, or textures.

All four production models preserve source bounds and triangle counts and pass
the Khronos validator with zero errors, warnings, infos, or hints. Each remains
one `Mesh_0`, one opaque double-sided material, three embedded textures, no
animation, and no external URI. Draco, Meshopt, KTX2, remote decoders, remote
textures, and CDNs are not used. The small vertex increase is limited to
expected tangent/UV seam splits.

The retained rollback assets are:

- `grapevyne-master-bottle.glb`, 1,182,548 bytes,
  SHA-256 `2304b4b89cc7a249527746c6b1f7ceb02759f6395a709b129e539941c885c05a`;
- `grapevyne-master-bottle-mobile.glb`, 1,115,844 bytes,
  SHA-256 `1caa5eb4786326199f0f2b1fd4066590aaccda02a54da03e14bfba9bee10e3f8`.

Four deterministic 1600x900 production-camera source-versus-production browser
renders are checked in under the comparison directory. Local inspection passed
for leaf/stem silhouette, grape bloom, berry layout, glass/capsule, label
boundaries, mesh orientation, UV placement, and material regions, with no
missing geometry, inversion, unexpected transparency, or visible tangent
artifact.

## 7. Exact label and interactive viewer

`MeshySubjectModel` treats each Meshy asset as its authored single PBR mesh. For
the bottle only, it adds a separate curved paper mask and exact GRAPEVYNE front
artwork at runtime. The overlay uses outward-facing geometry, polygon offset,
paper roughness, a close bottle-body radius, and a lower body placement to hide
untrusted source lettering without mirroring, floating, or z-fighting. The
variant map remains exact for red, white, sparkling, and rosé; the story and
viewer default to red. No label is applied to grapes.

The lazy `BottleInspectorModal` is deliberately separate from the pointer-inert
story canvas. It provides:

- an accessible modal name/description, initial close-button focus, Tab trap,
  Escape close, and focus return to the invoking button;
- background `inert` state and body scroll lock only while open;
- a demand-rendered R3F canvas with mouse/touch rotation, clamped vertical
  rotation, bounded zoom, no pan, and RESET VIEW;
- an explicit reduced-motion viewer with no automatic movement;
- a CSS bottle fallback with no model download for Save-Data or WebGL failure.

Local Chromium coverage passed pointer/touch behavior, focus containment,
scroll lock, RESET VIEW, and exact-label readability from front, quarter, and
side angles at desktop and mobile sizes. Hosted re-attestation is still part of
the Preview release gate; physical iOS Safari and assistive-technology checks
remain recommended device follow-ups.

## 8. Text, controls, and navigation reductions

The homepage now has one global navigation brand lockup and no repeated chapter
wordmarks. Each chapter has one label, one heading, one optional single-line
support, and at most the locked action set in the chapter table. Long feature
explanations and duplicate search controls were removed from the film.

Chapter 02 owns the only inline homepage search. It trims input, rejects an
empty value with an accessible error, URL-encodes valid input, and routes to
`/discover?query=<encoded query>`. Full discovery remains on `/discover`, full
Cellar controls remain on `/cellar`, Taste Profile detail remains on `/profile`,
and implementation disclosure is confined to `Under the Cork` in Chapter 09.

The former always-visible nine-label rail is replaced by a compact current
number/name, progress line, and ALL CHAPTERS button. The deliberate menu retains
all stable hash links, `aria-current="step"`, visible focus, keyboard operation,
Escape closure, and focus return.

Raleway Variable and Jost Variable remain the typography families. The rebuild
uses the accepted Precision Cellar direction with smaller display scales,
controlled tracking, shorter lines, generous negative space, and no repeated
pill/card composition.

## 9. Reduced-motion, Save-Data, and failure behavior

Reduced-motion and Save-Data both switch the homepage to nine normal semantic
chapters using final desktop/mobile posters; neither mounts the scrub video
stack. Static bottle art appears only in 01/05/08 and the generated grape PNG
appears only in 02. Subject-free chapters remain poster/copy-only.

The grape fallback is a transparent 1024×1200 RGBA capture from the integrated
optimized desktop Meshy grape under production story lighting:

```text
frontend/public/assets/models/fallbacks/grapevyne-meshy-grapes.png
297,864 bytes
SHA-256 8e8c3f07d22604051a208e219d68168a9c9cf747cc01c345238cefd4b285a4d8
```

Reduced motion does not load the heavy story WebGL path, but an explicitly
opened inspector can remain interactive because it has no automatic motion.
Save-Data keeps the inspector static and avoids the optional GLB. WebGL/model
failure restores the subject-appropriate fallback instead of showing a bottle
in grape/none chapters.

## 10. Preserved product, API, authentication, and privacy contracts

No backend source, migration, database schema, recommendation formula, Taste
Profile rule, deployment topology, or environment contract is changed by the
cinematic rebuild.

The provider topology remains exactly one `BrowserRouter`, one `AuthProvider`,
one `QueryClientProvider`, and one `SceneProvider`. Browser requests remain
same-origin `/api` with `credentials: "include"`. Success and error envelopes
remain:

```json
{ "data": {}, "message": "optional" }
```

```json
{ "error": { "code": "machine_readable_code", "message": "public message", "details": {} } }
```

Authentication remains Flask's signed, HTTP-only, Secure-in-hosted,
SameSite-Lax session, with only `session["user_id"]` as application identity.
Production/Preview unsafe methods retain exact-origin/Fetch-Metadata checks;
credentialed CORS is exact-origin and never wildcard. `/cellar` and `/profile`
remain protected, return-to-route sanitization remains in place, and public demo
routes remain isolated from private queries.

The logical API surface remains health; signup/login/logout/me; wine search and
detail; explainable recommendations; owner-scoped Cellar list/create/detail/
update/delete; and private Taste Profile. Cellar ownership comes only from the
signed session, mutations retain the expected-user consistency precondition,
private React Query keys remain identity-scoped, and auth/cellar/profile/
recommendation responses retain private/no-store cache isolation. Tasting
memory fields, migrations `0001` and `0002_prompt08_cellar_memories`, deterministic
recommendation weights, limited-catalog disclosures, free-form-memory privacy,
and Preview-only Neon isolation remain unchanged.

The prior one-origin Vercel topology remains static SPA assets plus `/api` and
`/api/*` rewrites to the existing Flask function. Prompt 10A1R must deploy only
to the already linked Vercel project's Preview target and use the existing
Preview-only Neon `grapevyne-preview` resource in `iad1`.

## 11. Implementation files

This local working-tree inventory is relative to accepted commit `b99dd6d8…`.
The release step must re-attest it against the final commit SHA; hosted evidence
and deployment identifiers are intentionally not present yet.

### Added implementation and tests

```text
frontend/e2e/cinematic-story.spec.ts
frontend/src/experience/StoryMediaStack.test.tsx
frontend/src/experience/StoryMediaStack.tsx
frontend/src/experience/media.test.ts
frontend/src/experience/storyMediaMath.ts
frontend/src/experience/storySubject.test.ts
frontend/src/experience/storySubject.ts
frontend/src/experience/webgl/BottleInspectorModal.tsx
frontend/src/experience/webgl/MeshySubjectModel.test.ts
frontend/src/experience/webgl/MeshySubjectModel.tsx
frontend/src/experience/webgl/meshyLabelGeometry.ts
frontend/src/experience/webgl/modelAssets.test.ts
frontend/src/hooks/useStoryStaticMode.ts
```

### Modified implementation and tests

```text
frontend/e2e/helpers/browser.ts
frontend/e2e/hosted-preview.spec.ts
frontend/e2e/modes-and-failures.spec.ts
frontend/e2e/public-journeys.spec.ts
frontend/e2e/responsive-input.spec.ts
frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/01-homepage-hero-desktop.png
frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/02-homepage-hero-mobile.png
frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/06-memory-editor.png
frontend/scripts/verify-assets.mjs
frontend/scripts/verify-assets.test.mjs
frontend/src/components/navigation/ChapterProgress.test.tsx
frontend/src/components/navigation/ChapterProgress.tsx
frontend/src/experience/media.ts
frontend/src/experience/sceneContextValue.ts
frontend/src/experience/storyChapters.ts
frontend/src/experience/webgl/ExperienceCanvas.test.tsx
frontend/src/experience/webgl/ExperienceCanvas.tsx
frontend/src/experience/webgl/SceneRig.test.tsx
frontend/src/experience/webgl/SceneRig.tsx
frontend/src/experience/webgl/WebGLExperience.test.tsx
frontend/src/experience/webgl/WebGLExperience.tsx
frontend/src/experience/webgl/modelAssets.ts
frontend/src/hooks/useScrollStory.test.tsx
frontend/src/hooks/useScrollStory.ts
frontend/src/pages/HomePage.test.tsx
frontend/src/pages/HomePage.tsx
frontend/src/styles/design-system.css
frontend/src/styles/scroll-story.css
```

### Deleted obsolete implementation

```text
frontend/src/experience/CinematicVideo.test.tsx
frontend/src/experience/CinematicVideo.tsx
```

### Added manifests, evidence, models, and media

```text
docs/v2/10a1-cinematic-rebuild.md
docs/v2/10a1-meshy-model-manifest.json
docs/v2/10a1-story-media-manifest.json
docs/screenshots/prompt-10a1/README.md
docs/screenshots/prompt-10a1/local-public/
docs/screenshots/prompt-10a1/model-comparisons/
docs/screenshots/prompt-10a1/product-regressions/
frontend/public/assets/models/fallbacks/grapevyne-meshy-grapes.png
frontend/public/assets/models/grapevyne-meshy-bottle.desktop.glb
frontend/public/assets/models/grapevyne-meshy-bottle.mobile.glb
frontend/public/assets/models/grapevyne-meshy-grapes.desktop.glb
frontend/public/assets/models/grapevyne-meshy-grapes.mobile.glb
frontend/public/assets/video/desktop/{barrel-house-pan,date-night-table-pan,ocean-wine-voyage,vineyard-flight}.desktop.{mp4,webm}
frontend/public/assets/video/mobile/{barrel-house-pan,date-night-table-pan,ocean-wine-voyage,vineyard-flight}.mobile.{mp4,webm}
frontend/public/assets/video/posters/desktop/{barrel-house-pan,date-night-table-pan,ocean-wine-voyage,vineyard-flight}.desktop.jpg
frontend/public/assets/video/posters/mobile/{barrel-house-pan,date-night-table-pan,ocean-wine-voyage,vineyard-flight}.mobile.jpg
frontend/public/assets/video/scrub/desktop/{cellar-corridor-push,hero-bottle-macro,memory-table-ambience,taste-atlas-finale,taste-liquid-transition}.desktop.{mp4,webm}
frontend/public/assets/video/scrub/mobile/{cellar-corridor-push,hero-bottle-macro,memory-table-ambience,taste-atlas-finale,taste-liquid-transition}.mobile.{mp4,webm}
```

The two JSON manifests, rather than brace shorthand, are authoritative for every
exact generated-asset path, byte count, hash, and derivation.

## 12. Automated gate ledger

The local Prompt 10A1R matrix is complete and green except for the explicitly
hosted PostgreSQL stage. These results describe the final local working tree;
the release commit still requires GitHub and Vercel SHA-bound re-attestation.

| Gate | Current evidence | Final status |
| --- | --- | --- |
| Input presence/hashes | Eight masters and four GLBs positively located; hashes/sizes match the Prompt and manifests | Verified |
| Final asset verifier | 3 foundational, 30 accepted media, 44 additive story-media, 10 legacy WebGL, 4 optimized Meshy models, and the static grape fallback | **PASS**, 1.64 s |
| New media technical validation | 36/36 videos full-decoded; all structural/keyframe/color/audio checks passed; 8 posters probed | Verified in manifest |
| New model technical validation | 4/4 Khronos clean; budgets/bounds/triangles/local-URI contracts pass | Verified in manifest |
| ESLint | Full repository with `--max-warnings=0` | **PASS**, zero warnings, 4.30 s |
| TypeScript | Application plus `tsconfig.e2e.json` | **PASS**, 9.63 s |
| Frontend unit | 50 test files / 361 tests | **PASS**, 9.70 s |
| Production build | Vite 6.4.3; 2,317 modules; build phase 5.16 s | **PASS**, command wall 10.16 s; one expected optional Meshy chunk-size warning |
| Bundle contract | 8/8 emitted-asset budgets and 8/8 product-route isolation checks | **PASS**, 1.08 s |
| Backend dependency/compile/unit | Python 3.12.12 disposable environment: `pip check` pass, `compileall` pass, 310 passed / 3 opt-in PostgreSQL skips | **PASS** for supported local stages |
| Python security | `pip-audit` 0 findings; Bandit 0 medium/high and 4 low findings | **PASS** under the existing low-finding policy |
| SQLite Alembic | heads/upgrade/current/check passed at `0002_prompt08_cellar_memories`; 7 migration tests passed | **PASS** |
| PostgreSQL migration stage | No safe local test database and Docker unavailable; 3 PostgreSQL tests skipped | **BLOCKED LOCALLY; GitHub-hosted PostgreSQL job required** |
| Flask route inventory | 14 API endpoints plus the existing static SPA route, unchanged | Verified read-only |
| `git diff --check` | No whitespace errors | **PASS** |
| Frontend `npm audit` | 2 moderate vulnerable packages (`react-router`, `react-router-dom`), representing 3 advisory records; no fix available; 0 high/critical | Recorded risk; expected exit 1 |
| Secret scan | Full history/snapshot retained exactly 2 previously adjudicated redacted generic-key test fixtures; vendored `.vercel/python/cache` false positives excluded | Verified; no new application secret finding |
| Chromium story/E2E | 44 passed / 112 intentionally project-skipped | **PASS**, 55.7 s |
| Firefox/WebKit smoke | 7 passed / 5 intentionally project-skipped | **PASS** |
| Axe accessibility | 1 passed | **PASS** |
| Deterministic visual suite | 1 strict comparison passed after the three intentional baseline updates | **PASS** |
| Performance suite | 5/5 passed; no long tasks; detailed samples below | **PASS** |
| GitHub Actions | No Prompt 10A1R release-commit run recorded yet | **PENDING** |
| Vercel Preview/hosted contract | No new Prompt 10A1R Preview ID or URL recorded yet | **PENDING** |

The repository's existing `.venv` uses unsupported Python 3.14.3 and was not
used for the backend run. The supported disposable environment used
Python 3.12.12. No database was mutated.

## 13. Bundle and performance report

The final local production build and bundle-contract run reported:

| Output | Raw bytes | Gzip bytes | Status |
| --- | ---: | ---: | --- |
| Principal application JS | 245,772 | 77,777 | Within existing 82,000-byte gzip budget |
| Shared application CSS | 147,488 | 25,363 | Within budget |
| Home route JS excluding optional imports | 28,954 | 10,202 | Within existing 12,000-byte gzip budget |
| Discover route JS | 15,934 | 5,478 | Within budget |
| Wine Detail route JS | 8,469 | 3,000 | Within budget |
| Cellar route JS | 28,260 | 9,038 | Within budget |
| Taste Profile route JS | 10,135 | 3,686 | Within budget |
| Lazy `ExperienceCanvas` entry | 6,422 | 2,647 | Within the lazy-entry budget |
| Lazy bottle inspector | 20.23 kB | 6.85 kB | Home-only optional import |
| Optional shared Meshy/Three graph | 897.41 kB | 243.65 kB | Home-only; expected Vite >500 kB warning |

Current model payloads are 3,954,456/
881,628 bytes for desktop/mobile bottle and 8,187,568/1,890,584 bytes for
desktop/mobile grapes. The complete additive media payload is 283,369,038 bytes,
but runtime preparation is intentionally limited to current/adjacent scenes and
one device family.

Five deterministic local performance runs passed. Semantic Hero timing was
`[101.4, 93.3, 87.8, 88.6, 96.6]` ms; LCP was
`[152, 140, 136, 132, 152]` ms; and CLS was
`[0.0011212577, 0.0012998923, 0.0011212577, 0.0011212577, 0.0012998923]`.
Initial request counts were `[21, 21, 21, 21, 22]`; transfer totals were
`[5,870,006, 5,870,006, 5,870,006, 5,870,006, 5,881,947]` bytes. No long task
was observed. CLS is well below both the 0.05 preferred and 0.10 mandatory
thresholds.

A supplemental production-mode frame sample measured approximately 89.97 FPS
at desktop size and 117.29 FPS at mobile size. Chromium contracts also passed
forward/reverse seek stability, stopped-frame hold, route/device cleanup,
repeated story entry, and zero heavy story-video/GLB requests in reduced-motion,
Save-Data, and disabled-WebGL modes. Hosted cache/transfer behavior, protected
session paths, and runtime logs still require the Preview release run; physical
device memory and thermals are explicitly outside the local automation claim.

## 14. Browser, accessibility, and visual evidence matrix

Evidence root: [`docs/screenshots/prompt-10a1/`](../screenshots/prompt-10a1/),
with a concise provenance index in its `README.md`. The checked-in visual-media
payload contains 37 artifacts totaling 27,124,128 bytes. Its aggregate SHA-256
is `925f607a897051c0a76e1a58abe7dac615e53dbb317cddd1c936b8940883f1e9`,
computed from lexicographically sorted repository-relative `shasum -a 256`
lines. Documentation, the render harness, and reproducibility scripts are not
included in that visual-payload digest.

| Required evidence | Local evidence/status |
| --- | --- |
| Hero desktop | `local-public/hero-desktop-1440x900.png` — PASS |
| Hero mobile | `local-public/hero-mobile-390x844.png` — PASS |
| Vineyard desktop, grapes visible | `local-public/vineyard-grapes-desktop-1440x900.png` — PASS |
| Vineyard mobile, grapes visible | `local-public/vineyard-grapes-mobile-390x844.png` — PASS |
| Chapter 02 grape fallback | `local-public/chapter-02-grape-static-fallback-desktop-1440x900.png` — PASS |
| Date night desktop, no 3D subject | `local-public/date-night-none-desktop-1440x900.png` — PASS |
| Taste desktop, no 3D subject | `local-public/taste-signals-none-desktop-1440x900.png` — PASS |
| Cellar portal desktop, bottle visible | `local-public/cellar-portal-bottle-desktop-1440x900.png` — PASS |
| Barrel house desktop, no 3D subject | `local-public/barrel-house-none-desktop-1440x900.png` — PASS |
| Memory desktop, no 3D subject | `local-public/memory-none-desktop-1440x900.png` — PASS |
| Taste Atlas mobile, bottle visible | `local-public/taste-atlas-bottle-mobile-390x844.png` — PASS |
| Ocean voyage desktop, no 3D subject | `local-public/ocean-voyage-none-desktop-1440x900.png` — PASS |
| Subject hidden during 01→02 and grapes hidden before 03 | `local-public/transition-bottle-fully-hidden-desktop-1440x900.png` and `transition-grapes-hidden-before-chapter-03-desktop-1440x900.png` — PASS |
| Bottle reappears in 05 and 08 | `local-public/bottle-reappeared-chapter-05-desktop-1440x900.png` and `bottle-reappeared-chapter-08-mobile-390x844.png` — PASS |
| Representative settled NONE chapter | `local-public/representative-none-chapter-07-desktop-1440x900.png` — PASS |
| Compact progress and deliberate chapter menu | `local-public/compact-chapter-progress-menu-desktop-1440x900.png` — PASS |
| Chapter 02 search | `local-public/chapter-02-search-desktop-1440x900.png` — PASS |
| Bottle viewer desktop/mobile | `local-public/inspector-{front,quarter,side}-label-desktop-1440x900.png` and `inspector-mobile-390x844.png` — PASS |
| Reduced-motion poster flow | `local-public/reduced-motion-hero-{desktop-1440x900,mobile-390x844}.png` — PASS |
| Save-Data fallback | `local-public/save-data-fallback-hero-{desktop-1440x900,mobile-390x844}.png` — PASS |
| WebGL/model-failure fallback | `local-public/webgl-unavailable-css-fallback-desktop-1440x900.png` — PASS |
| Discover route | `product-regressions/discover-route-regression.png` plus `local-public/discover-route-public-desktop-1440x900.png` — PASS locally |
| Authenticated Cellar | `product-regressions/authenticated-cellar-regression.png` — PASS locally; hosted owner-isolation recheck pending |
| Active Taste Profile | `product-regressions/active-taste-profile-regression.png` — PASS locally; hosted private-data recheck pending |
| Source-versus-production model renders | Four `model-comparisons/*-source-vs-production.png` captures — PASS |
| After-state walkthrough | `local-public/after-state-public-walkthrough-desktop.webm` — local capture complete; hosted replacement pending |

The passing Chromium matrix exercised 1440×900, 1920×1080, 768×1024,
1024×768, 360×800, 390×844, and 430×932, plus desktop/mobile
reduced-motion, Save-Data, and disabled-WebGL modes. It checked console/page
errors, failed resources, horizontal overflow, touch/native scrolling, viewer
scroll lock, forward/reverse scrubbing, stopped-frame hold, direct hashes,
history navigation, device-source replacement, and subject exclusivity. Strict
visual comparison, Axe, and Firefox/WebKit smoke also passed.

Physical VoiceOver/NVDA and physical iOS Safari touch testing remain recommended
device checks; automated Axe and desktop/mobile WebKit are not represented as
physical-device substitutes and are not blockers for the local automation
verdict.

## 15. GitHub and Preview deployment

| Item | Prompt 10A1R value |
| --- | --- |
| Branch | `feat/grapevyne-cinematic-v2` |
| Accepted base | `b99dd6d8bc75f97f3047ba71c3c92b9f34df9c0f` |
| Commit hash(es) | **PENDING** focused commits |
| Pull request | Existing PR #1; must remain open and unmerged — final status **PENDING** recheck |
| GitHub Actions run | **PENDING** URL, run ID, exact SHA, jobs, and conclusions |
| Vercel target | Preview only |
| New immutable Preview URL | **PENDING** |
| Stable branch Preview URL | **PENDING** re-attestation |
| Deployment ID | **PENDING** |
| Deployment source SHA | **PENDING** exact match |
| Deployment Protection | Must remain enabled; **PENDING** re-attestation |
| Database | Existing Preview-only Neon `grapevyne-preview`, `free_v3`, `iad1`; **PENDING** hosted sentinel re-attestation |
| Production | Must remain untouched; **PENDING** final read-only proof |

The accepted Prompt 10A Preview described in
[`10a-hosted-preview-report.md`](10a-hosted-preview-report.md) is prior-state
evidence only. It must not be reported as the Prompt 10A1R deployment.

Hosted completion requires exact-SHA deployment inspection, `/api/health`,
signed-session signup/login/refresh/logout, exact-origin and rejected-origin
CORS/CSRF behavior, private cache headers, owner-isolated Cellar CRUD, Taste
Profile privacy, recommendation behavior, guarded disposable-account cleanup,
missing-asset/5xx checks, and final build/runtime logs. Credentials, cookies,
database URLs, tokens, and protection bypass values must remain redacted.

## 16. Risks and remaining work

- The 44 new media files total 283.37 MB. Runtime loading is bounded, but Vercel
  upload/build limits and hosted cache behavior require actual Preview proof.
- The desktop grape is 8,187,568 bytes, below the stated 8 MiB target by a narrow
  margin. Local browser visual quality passed; real-device memory/thermal review
  remains recommended.
- Production GLBs require native embedded-WebP support. No decoder fallback is
  added; the CSS/static experience is the failure path.
- The stale-subject demand-render regression is now covered by real WebGL
  clear/draw probing, the passing bidirectional story suite, and settled NONE
  chapter evidence. It remains an important hosted regression check rather than
  an unresolved local defect.
- Local PostgreSQL migration-stage tests could not run safely without a test
  PostgreSQL instance or Docker. The GitHub-hosted PostgreSQL job is mandatory.
- The full local accessibility, deterministic-visual, performance, and model
  comparison gates passed. Physical mobile and assistive-technology review is
  still recommended but is outside the automated proof.
- `npm audit` reports two moderate vulnerable packages and three advisory
  records in the preserved React Router 6 line, with no available fix. There
  are no high or critical findings; the release handoff must retain this known
  dependency risk rather than silently changing the routing contract.
- Gitleaks retained exactly two previously adjudicated generic-key test-fixture
  findings. They are redacted/non-secret, but their accepted adjudication must
  remain explicit in CI/release records.
- No broad media or model payload should be assumed cached on first visit;
  hosted initial/current-adjacent transfer must be measured rather than derived
  from repository totals.

## 17. Command ledger

The completed local ledger used the following principal commands. The release
step must append credential-redacted commit/push, CI, Preview, hosted-contract,
and log-inspection commands without exposing environment values.

```bash
git status --short --branch
git show --stat --oneline b99dd6d8bc75f97f3047ba71c3c92b9f34df9c0f
find /Users/rachel/Downloads/FINAL_STORY_MASTERS -type f ...
find /Users/rachel/Downloads -type f -name 'grapevyne-meshy-*-source.glb' ...
stat -f '%N|%z' <input-or-production-asset>
shasum -a 256 <input-or-production-asset>
ffprobe ... <story-master-or-production-video>
ffmpeg ... <story-master-or-accepted-video> <scrub-output>
ffmpeg -hide_banner -loglevel error -xerror -i <payload-video> -map 0:v:0 -an -f null -
npm ci --prefix <temporary-pinned-gltf-tool-directory>
gltf-transform tangents|resize|webp|inspect|validate ...
(cd frontend && npm run verify:assets)
(cd frontend && npm run lint)
(cd frontend && npm run typecheck)
(cd frontend && npm test)
(cd frontend && npm run build)
(cd frontend && npm run verify:bundle)
(cd frontend && npm run test:e2e:chromium)
(cd frontend && npm run test:e2e:cross-browser)
(cd frontend && npm run test:a11y)
(cd frontend && npm run test:visual)
(cd frontend && npm run test:performance)
(cd frontend && npm audit)
(cd frontend && npm audit --json)
python -m pip check
python -m compileall backend/app backend/tests
python -m pytest backend/tests
python -m pip_audit
python -m bandit -r backend/app -ll
python -m flask --app app routes
python -m flask --app app db heads|upgrade|current|check
git diff --check
gitleaks detect ...
find docs/screenshots/prompt-10a1/local-public -type f -print ...
find docs/screenshots/prompt-10a1/product-regressions -type f -print ...
find docs/screenshots/prompt-10a1/model-comparisons -name '*-source-vs-production.png' -print ...
shasum -a 256 <sorted-evidence-paths> | shasum -a 256
```

Browser inspection used the repository's Vercel agent-browser workflow against
the local Vite server. The npm scripts above expand to the exact Playwright
projects declared in `package.json`; the Chromium run used desktop, mobile, and
reduced-motion Chromium, while cross-browser smoke used desktop Firefox,
desktop WebKit, and mobile WebKit. Final release entries must include
commit/push/CI inspection, Preview deployment/inspection, the hosted contract
runner, log checks, and guarded Preview cleanup. Any environment-variable
values, connection strings, auth state, cookies, tokens, or bypass secrets must
be replaced by names or `<redacted>`.

## 18. Completion boundary

Do not change this report to PASS until every pending item above is replaced by
evidence from the final committed SHA and its new protected Vercel Preview. PR #1
must remain unmerged, Production must remain untouched, and Prompt 10B must not
begin.
