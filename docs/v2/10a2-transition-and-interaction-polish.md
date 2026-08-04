# Prompt 10A2 — Transition and interaction polish

## Report status

This report describes the Prompt 10A2 implementation on
`feat/grapevyne-cinematic-v2`, based on the accepted Prompt 10A1R commit
`98d37d53e23eda7c47165d09e5370849654cf03d`.

**Status at final local verification: implementation and every available local
gate complete; exact-SHA release verification in progress.** Asset integrity,
lint, type checking, full unit/component coverage, the production build and
bundle budget, backend and migration contracts, dependency/security checks,
the complete local browser matrix, the computed-color check, and the 24-file
visual record have passed. The final single commit, exact-SHA GitHub checks,
and protected Preview verification are post-commit work and are not claimed as
complete in this tracked document.

Prompt 10A2 does not change the nine-chapter story, accepted media or model
binaries, product routes, API/authentication contracts, Preview database, or
Production. PR #1 must remain open and unmerged, Production must remain
unchanged, and Prompt 10B is outside this report.

## 1. Outcome and preserved contracts

The implementation makes three focused changes to the accepted cinematic
story:

1. Navigation, stage, media wrappers, videos, and the full-cover transition
   veil share one true-black base.
2. All eight chapter boundaries use one reversible, readiness-gated transition
   projection instead of independent opacity timing.
3. The live bottle in chapters 01/05/08 and live grapes in chapter 02 gain
   tightly bounded pointer, touch, and keyboard rotation controls.

The provider topology remains exactly one `BrowserRouter`, one `AuthProvider`,
one `QueryClientProvider`, and one `SceneProvider`. Browser data access remains
same-origin `/api` with `credentials: "include"`; Flask signed-session
identity, exact-origin unsafe-request protection, owner-scoped Cellar CRUD,
private Taste Profile and recommendation caching, and the existing success and
error envelopes are unchanged. No backend source, migration, schema,
recommendation formula, Taste Profile rule, accepted media binary, poster,
GLB, label, or manifest is modified by Prompt 10A2.

The accepted subject contract also remains unchanged:

| Chapter | Subject |
| --- | --- |
| 01 `hero` | Bottle |
| 02 `discovery` | Grapes |
| 03 `match` | None |
| 04 `taste` | None |
| 05 `portal` | Bottle |
| 06 `cellar` | None |
| 07 `memory` | None |
| 08 `atlas` | Bottle |
| 09 `finale` | None |

There is no state in which bottle and grapes are intentionally visible or
interactive together.

## 2. True-black color contract

The shared tokens live in `frontend/src/styles/design-system.css`:

```css
--color-navigation-black: #000000;
--color-story-transition: var(--color-navigation-black);
```

`.gv-nav` resolves `--color-navigation-black` directly. The story root, fixed
stage, media stack, media layers, scrub videos, and transition veil resolve
`--color-story-transition`. The veil is a flat color with no radial tint, and
the stage starts with `--story-veil-opacity: 1`, so startup and ownership
changes fail closed to black.

The focused browser contract reads computed `background-color` from the nav,
stage, media stack, media layer, video, and fully opaque veil. The completed
check resolved every value to `rgb(0, 0, 0)`. Champagne, ivory, burgundy, and
the rest of the brand palette remain unchanged outside the full-cover state.

## 3. One boundary-centered transition projection

`deriveStoryTransitionState` in `storyTransition.ts` is the only media/subject
opacity formula. It accepts overall story progress, the nine geometry-derived
chapter anchors, preceding owner, and lower/upper readiness. It returns one
mutable/reusable projection containing phase, boundary, owner, interactive
index, lower/upper indices and opacities, and veil opacity.

For progress `p`, chapter anchors `b[i]` and `b[i+1]`, local segment progress is:

```text
q = clamp((p - b[i]) / (b[i+1] - b[i]), 0, 1)
```

The first 70% of each segment is stable. Its final 30% is normalized to:

```text
t = clamp((q - 0.70) / 0.30, 0, 1)
```

Every one of the eight boundaries uses the same window:

| Phase | `t` window | Lower opacity | Upper opacity | Black veil |
| --- | ---: | ---: | ---: | ---: |
| Outgoing fade | `0.00 <= t < 0.40` | `1 - t / 0.40` | `0` | `1 - lower` |
| Full-black hold | `0.40 <= t < 0.62` | `0` | `0` | `1` |
| Incoming reveal | `0.62 <= t <= 1.00` | `0` | `(t - 0.62) / 0.38` when ready | `1 - upper` |

This enforces a strict non-crossfade invariant: the outgoing scene reaches
zero before the incoming scene can exceed zero. The veil is derived as
`1 - max(lowerOpacity, upperOpacity)`, so full media cover and full black agree
at the phase boundaries. Exact epsilon snapping yields objective zero/one
values for tests and browser instrumentation.

The same projection is evaluated for increasing and decreasing progress; there
is no separate reverse animation. A large progress jump that changes owner
outside the ordinary hold is converted to one fully black frame before any new
scene can appear.

## 4. Ownership, hysteresis, hashes, and cancellation

Chapter ownership changes only inside full black. Three thresholds provide a
small directional hysteresis band:

- forward owner changes lower → upper at `t = 0.56`;
- an ownerless/default projection resolves upper at `t = 0.51`;
- reverse owner changes upper → lower at `t = 0.46`.

All three values lie within the `0.40–0.62` full-black interval. Small progress
noise can therefore move within or around a boundary without alternating the
React chapter label or exposing a different layer.

In the full-motion story, native observers and GSAP publish progress candidates
only. `StoryMediaStack` is the sole component that commits
`currentChapterId`. This removes the former duplicate ownership path between
scroll callbacks and the media stack.

Chapter-menu links, direct hashes, hash changes, and browser history set a
shared `forceBlackGate` plus the intended navigation target before scrolling.
The inline veil is synchronously set to opacity one; the coordinator releases
it only after geometry, target ownership, and target-frame readiness agree.
Route departure cancels the active subject gesture, all pending frame
callbacks, seek bookkeeping, timers, and media visibility state before Home can
be re-entered.

## 5. Decode readiness and anti-flash behavior

Only the current chapter plus its previous and next neighbors prepare media.
The current video uses `preload="auto"`; adjacent videos use
`preload="metadata"`; distant posters and videos remain absent. A desktop/
mobile source key includes chapter, device family, and source generation, so a
breakpoint change cannot reuse readiness from the other source family.

Incoming visibility is not inferred from mounting. A scene becomes eligible
only when one of these source-keyed conditions is true:

- `requestVideoFrameCallback` confirms a frame whose `mediaTime` is within
  `1/24` second of the current requested time;
- on browsers without the complete request/cancel video-frame callback pair,
  `seeked` or `canplay` confirms `currentTime` within the same tolerance; or
- the approved poster is loaded and the bounded 1,200 ms fallback delay has
  elapsed, or the video source has failed.

Superseded frame callbacks are cancelled and request IDs/source keys prevent a
late callback from approving a newer seek. A currently visible scene may keep
its last known decoded frame while an ordinary same-scene seek is pending;
hidden incoming media may not use that exception and remains behind black until
its exact frame or approved poster is ready. Failed media does not expose a
browser-default video frame or a differently cropped background.

The media stack publishes deterministic browser instrumentation for transition
phase, boundary, owner, black-gate opacity, active media, active subject,
interactive index, per-layer opacity/visibility/z-index, frame readiness,
pending seek, request ID, target time, and decoded-frame state. Nonparticipating
layers are forced to opacity zero, `visibility: hidden`, and z-index zero. The
fixed z-order is media below WebGL/fallback/grain, with the black veil at the top
of the visual stack.

## 6. Scroll-to-video seeking

The story retains frame-by-frame, paused, reversible media ownership. It never
calls `video.play()` and does not use autoplay as the timeline owner.

One `requestAnimationFrame` scheduler coalesces all story-media work. Requested
time remains a deterministic function of chapter progress and duration, with
the accepted end epsilon. A new `currentTime` write occurs only when the target
differs from the preceding requested value by at least `1/48` second—one half
of a 24 fps source frame. The decoded-frame acceptance window is one source
frame (`1/24` second). All videos are paused after each projection, and large
targets remain clamped by the existing scrub-time helper.

No additional progress low-pass is applied in the media layer. Fine-pointer
desktop retains the accepted bounded Lenis configuration; coarse-pointer,
mobile, and reduced-motion paths retain native scrolling. This avoids adding
lag to rapid direction changes, direct hashes, or reverse scrubbing.

The frame scheduler reuses transition input/output objects, stable per-chapter
video refs and video-frame callback functions, mutable maps/sets, and a bounded
source-key array. It does not create a rAF loop per video or perform React state
updates on every story frame.

## 7. Direct model interaction architecture

The interaction state is one Home-owned ref shared by the semantic DOM control
and `SceneRig`. It contains separate bottle and grape records plus the active
control bridge. Each subject record stores target and rendered yaw/pitch,
dragging state, and whether the visitor modified the pose.

Ownership is explicit:

```text
final subject rotation = chapter base rotation + user yaw/pitch offset
```

The scroll/transition system owns subject type, chapter pose, scale, position,
opacity, and visibility. The visitor owns only additive yaw/pitch. Bottle and
grape records never share offsets. Automatic reset uses
`resetSubjectInteractionWhenHidden`, which is a no-op unless that subject's
opacity is fully zero; explicit Home/R reset is available at any visible pose.

`SceneRig` damps rendered offsets toward targets with a coefficient of 12 while
dragging and 8 after release, with frame delta capped at `1/20` second. This
keeps release poses stable while smoothing input. There is no idle auto-spin,
uncontrolled roll, GSAP mutation of Three.js rotations, Framer Motion control,
or React state update on `pointermove`/`useFrame`.

### Bottle

- Active only in chapters 01, 05, and 08.
- Horizontal movement adds unbounded yaw at `pi / 240` radians per pixel, so
  front, quarter, side, back, and full rotations remain available.
- Vertical movement adds pitch at the same sensitivity, clamped to ±25°.
- The current user pose remains stable within a bottle chapter and resets only
  while the bottle is fully hidden or when the visitor requests reset.
- The existing lazy bottle-inspector modal remains independent and retains its
  focus trap, return focus, zoom, reset, reduced-motion, and static fallback.

### Grapes

- Active only in chapter 02.
- Yaw is unbounded and pitch is clamped to ±30°; roll is unchanged.
- Grapes do not spin while the visitor reads or searches.
- Runtime grape materials use double-sided rendering and grape meshes disable
  frustum culling, preventing leaves, stems, or berries from disappearing at
  inspected angles.
- No label is applied to grapes.

The accepted optimized Meshy assets are reused. Direct interaction does not
create another canvas or subject clone.

## 8. Scoped hit area and input behavior

The WebGL canvas remains `aria-hidden`, `tabIndex=-1`, transparent, inert, and
`pointer-events: none`. The only pointer target is a semantic transparent DOM
button created when all of these are true: full-motion mode is active, WebGL
has completed its first-frame handshake, the stable chapter owns bottle or
grapes, and the transition projection exposes an interactive index.

`SceneRig` computes the active model's precise world `Box3` only when the
control element or subject group changes, converts its eight corners to group-
local space, and caches them. Each frame then transforms and projects those
preallocated cached corners into stage pixels, adds bounded padding, and
writes button geometry directly only when a bound changes by at least 0.5 px.
This keeps the region aligned after rotation/viewport changes without a React
render or `Box3.setFromObject` traversal each frame. One typed desktop/mobile
chapter rectangle supplies startup geometry before the first projected bound.
The full stage never becomes a pointer target, so search, links, navigation,
chapter controls, and normal scrolling remain outside the interaction layer.

Mouse and pen activate immediately on primary press, capture the pointer, use a
grab/grabbing cursor, and release on up/cancel/lost capture. Touch uses these
conflict rules:

- the initial control keeps `touch-action: pan-y`;
- a 160 ms hold is required before activation;
- movement greater than 10 px before activation cancels the gesture so native
  scrolling continues;
- only after activation does the button capture the pointer, switch temporarily
  to `touch-action: none`, and install one non-passive `touchmove` guard;
- release, cancellation, transition start, visibility change, disable, or
  unmount immediately restores native behavior and removes the temporary
  listener.

The visible `ROTATE` affordance appears on hover, keyboard focus, or active
drag. It does not request sensors, vibration, or motion permission.

## 9. Keyboard and assistive technology

The semantic control has an exact subject-specific accessible name:

- `Rotate the GRAPEVYNE wine bottle`;
- `Rotate the GRAPEVYNE grape cluster`.

An `aria-describedby` instruction explains drag, arrow keys, Home/R, and
Escape; `aria-keyshortcuts` lists the same keys. Left/Right change yaw in 15°
increments. Up/Down change pitch in 5° increments within the subject clamp.
Home or R resets to the chapter base pose. Escape cancels an active gesture and
leaves the control. Focus uses the existing visible focus system.

The canvas remains decorative, and rotation is stored in data/ref state rather
than an `aria-live` stream, so assistive technology receives no per-frame
announcements. Reduced-motion, Save-Data, and WebGL-failure modes mount no live
3D rotation control. Static chapter subjects and all existing product actions
remain available.

## 10. Cleanup and performance contract

The implementation preserves one story rAF scheduler, one WebGL canvas, the
accepted current-plus-adjacent media window, the accepted device-specific
media family, and Home-route lazy graph isolation. `StoryMediaStack` and
`StorySubjectInteractionControl` are separate lazy chunks, keeping the Home
route at 27,086 raw / 9,590 gzip bytes against its 12,000-byte gzip budget.
It adds no video playback loop, model clone for interaction, window-level
pointer tracking, or React state update per drag/render frame.

Cleanup covers:

- active pointer capture, hold timer, temporary touch listener, cursor and
  `touch-action` overrides;
- pending `requestVideoFrameCallback` handles, pending seeks, poster-fallback
  timers, decoded/source caches, and all video playback;
- visibility changes, route departure, breakpoint source replacement, failed
  media, and WebGL context loss;
- the accepted Lenis listener/ticker, owned ScrollTriggers, GSAP context, and
  renderer frameloop/context lifecycle.

The story render activity sleeps offscreen, when the document is hidden, and
after one final demand-render in subject-free chapters. The E2E instrumentation
collects long tasks, current/adjacent prepared media count, video/canvas count,
request paths, and repeated route-entry behavior. Five repeated local
performance runs passed with no observed long tasks, LCP from 192–384 ms, CLS
from 0.001121–0.001300, 22 initial requests, and 5,875,593 transferred bytes in
the software-WebGL fallback environment. Numeric heap growth and dropped/late
decoded-frame rates are not instrumented and are not inferred.

## 11. Implementation inventory

Relative to accepted commit `98d37d53…`, the Prompt 10A2 implementation adds:

```text
frontend/e2e/prompt10a2-polish.spec.ts
frontend/e2e/prompt10a2-evidence.spec.ts
frontend/src/experience/storyTransition.test.ts
frontend/src/experience/storyTransition.ts
frontend/src/experience/webgl/StorySubjectInteractionControl.test.tsx
frontend/src/experience/webgl/StorySubjectInteractionControl.tsx
frontend/src/experience/webgl/storyInteractionRegions.test.ts
frontend/src/experience/webgl/storyInteractionRegions.ts
frontend/src/experience/webgl/subjectInteraction.test.ts
frontend/src/experience/webgl/subjectInteraction.ts
frontend/src/styles/storyTransitionColor.test.ts
docs/screenshots/prompt-10a2/README.md
docs/screenshots/prompt-10a2/local-public/*.png (19 numbered files)
docs/screenshots/prompt-10a2/walkthroughs/*.webm (5 numbered files)
docs/v2/10a2-transition-and-interaction-polish.md
```

It modifies:

```text
frontend/e2e/modes-and-failures.spec.ts
frontend/e2e/cinematic-story.spec.ts
frontend/src/components/navigation/ChapterProgress.test.tsx
frontend/src/components/navigation/ChapterProgress.tsx
frontend/src/experience/SceneProvider.tsx
frontend/src/experience/StoryMediaStack.test.tsx
frontend/src/experience/StoryMediaStack.tsx
frontend/src/experience/sceneContextValue.ts
frontend/src/experience/storyMediaMath.ts
frontend/src/experience/webgl/ExperienceCanvas.test.tsx
frontend/src/experience/webgl/ExperienceCanvas.tsx
frontend/src/experience/webgl/MeshySubjectModel.tsx
frontend/src/experience/webgl/SceneRig.test.tsx
frontend/src/experience/webgl/SceneRig.tsx
frontend/src/experience/webgl/WebGLExperience.tsx
frontend/src/hooks/useScrollStory.test.tsx
frontend/src/hooks/useScrollStory.ts
frontend/src/pages/HomePage.test.tsx
frontend/src/pages/HomePage.tsx
frontend/src/styles/design-system.css
frontend/src/styles/scroll-story.css
docs/screenshots/README.md
```

No production source or evidence from Prompt 10A1R is deleted or replaced.
The final handoff's exact `git diff --name-status` is authoritative.

## 12. Local verification ledger

This ledger records the completed local Prompt 10A2 gates. Exact-SHA hosted
rows remain pending until the single commit exists.

| Gate | Prompt 10A2 result |
| --- | --- |
| Accepted asset verifier | **PASS** — 3 foundational assets, 30 accepted media, 44 additive story-media files, 10 legacy WebGL assets, 4 optimized Meshy models, and static grape fallback |
| Accepted 30-media aggregate | **UNCHANGED** — `0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018` |
| Additive 44-media aggregate | **UNCHANGED** — `e69b316c7893d163d7cc20873357c2b6bdeb92347c097e19aa354391dd63f4c3` |
| Optimized Meshy aggregate | **UNCHANGED** — `5f3b537986d932fb9b03369e310c9f7d6fea8d81432187858f9e40149c93bd47` |
| Static grape fallback | **UNCHANGED** — `8e8c3f07d22604051a208e219d68168a9c9cf747cc01c345238cefd4b285a4d8` |
| ESLint | **PASS** in completed implementation run |
| TypeScript application + E2E config | **PASS** in completed implementation run |
| Full Vitest suite | **PASS** — 55 files, 424 tests |
| Production Vite build and bundle verifier | **PASS** — 2,319 modules; Home 27,086 raw / 9,590 gzip bytes against 12,000 gzip; StoryMediaStack 14,465 / 4,635, interaction control 5,035 / 2,001, ExperienceCanvas 8,155 / 3,351; accepted optional Meshy chunk 897,496 / 243,711 warning remains |
| Computed true-black desktop Chromium check | **PASS** — nav/stage/stack/layer/video/veil all `rgb(0, 0, 0)` |
| Exhaustive eight-boundary forward/reverse browser test | **PASS** — all eight boundaries symmetric, black-gated, decoded, and mutually exclusive |
| Complete local Playwright matrix | **PASS** — all projects 60 passed / 306 intentionally skipped; Chromium stability run 51 / 132; Firefox/WebKit smoke 9 / 6; Axe 1; visual 1; performance 5 repeated runs |
| Prompt 10A2 evidence capture | **PASS** — 2 serial capture tests; 19 PNGs and 5 WebMs |
| Backend unit/security suite | **PASS** — Python 3.12.12, `pip check`, compileall, 310 passed / 3 skipped, `pip-audit` no known vulnerabilities, Bandit medium-or-higher clean |
| PostgreSQL migration contract | **PASS** — PostgreSQL 18.4; fresh `base -> 0001 -> 0002`, head/current/check, downgrade to 0001, preservation/write, re-upgrade and nullable-memory write; 3 selected tests passed |
| Workflow and secret scans | **PASS after unchanged-fixture adjudication** — actionlint 1.7.12 clean; Gitleaks 8.30.1 found only the two documented deterministic fixtures in version-control-visible files and no new credential |
| `npm audit` | **UNCHANGED PRIOR RISK** — all-package and production-only high-threshold commands exit zero; the existing two moderate React Router advisories remain and require a breaking-major upgrade |
| GitHub Actions and GitGuardian on final SHA | **Pending** |
| Protected Vercel Preview and hosted matrix | **Pending; no Prompt 10A2 Preview is claimed here** |

The completed evidence inventory is
[`docs/screenshots/prompt-10a2/README.md`](../screenshots/prompt-10a2/README.md).
It records 19 PNGs (9,894,411 bytes), five WebMs (11,717,696 bytes), 21,612,107
bytes total, individual SHA-256 values, and aggregate SHA-256
`344a08725909315b2382b9bbe5598c3d6c87c9a385a5190a4df67e5d00713a7f`.

## 13. Release attestation and one-commit constraint

Prompt 10A2 requires exactly one coherent commit with message:

```text
fix(experience): smooth cinematic transitions and add direct model rotation
```

The final commit SHA does not exist until this report itself is committed.
GitHub Actions, GitGuardian, and a SHA-bound Vercel Preview can run only after
that commit is pushed. Editing this tracked report with those post-commit
coordinates would create a second commit and a different SHA, invalidating the
"exactly one commit" rule and making the attestation self-referential.

Therefore the exact final SHA, GitHub run ID/job results, GitGuardian status,
immutable Preview URL, deployment ID, stable branch alias, hosted browser/API/
database results, Production-before/after identity, PR #1 state, and final
clean `git status` belong in the external final handoff. They must be checked
against the one commit containing this report; they are intentionally not
guessed or backfilled here.

## 14. Evidence inventory

The completed Prompt 10A2 visual record is additive under
[`docs/screenshots/prompt-10a2/`](../screenshots/prompt-10a2/). Its numbered
index contains 19 screenshots and five walkthrough/interaction clips covering
true black, forward/reverse boundary phases, bottle/grape inspection, mobile
hold-drag, reduced motion, Save-Data, and WebGL failure. The captures were
generated from the exact accepted base plus the uncommitted Prompt 10A2 diff;
the final one-commit SHA is recorded externally after commit.

Prompt 10A1R evidence under `docs/screenshots/prompt-10a1/` remains intact and
is prior-state evidence only. Prompt 10A2 captures must identify local versus
hosted provenance and must not be represented as Production proof.

## 15. Remaining limitations and follow-ups

- Physical iOS Safari touch behavior and physical VoiceOver/NVDA remain
  recommended complements to browser automation; automated WebKit and Axe are
  not physical-device substitutes.
- A video that cannot produce an exact decoded target intentionally holds black
  for up to 1,200 ms before the approved poster fallback becomes eligible.
  This favors anti-flash correctness over an early stale-frame reveal.
- Software-rendered CI/Preview environments cannot replace a physical GPU
  review of repeated full-yaw grape material response, thermals, or memory.
- The accepted media payload and optional Meshy/Three chunk remain large. This
  phase preserves quality and current/adjacent loading rather than changing
  those accepted binaries.
- Local performance checks observed no long tasks and passed request-count and
  repeated route-entry budgets. Hosted numbers remain pending. Dropped/late
  decoded-frame rates and numeric heap growth are unmeasured rather than
  inferred.
- Existing dependency/security findings must be compared explicitly in the
  final handoff. Prompt 10A2 neither upgrades routing dependencies nor changes
  the backend/security contract.

## 16. Completion boundary

This tracked report documents Prompt 10A2 only. The full local matrix is
complete. Completion now requires one commit, exact-SHA CI/GitGuardian, a new
protected Vercel Preview using the Preview-only Neon environment, immutable
hosted checks, and an external final handoff. PR #1 must remain open and
unmerged, Production must remain untouched, and Prompt 10B must not begin.
