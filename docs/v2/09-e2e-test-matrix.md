# Prompt 09 end-to-end test matrix

## Status and scope

This document records the tracked Playwright system added during Prompt 09 on
`feat/grapevyne-cinematic-v2`, based on accepted Prompt 08 commit
`f08452538bd283842140b28462ace52ef272c7c9`. It describes the tests that are in
the repository, the production-preview topology they exercise, the deliberate
project selection rules, and the locally observed results as of 2026-08-03.

The suite uses exact development dependencies `@playwright/test@1.62.1` and
`@axe-core/playwright@4.12.1`. The local verification host used Node 20.19.6,
Chrome for Testing 151.0.7922.34, Firefox 153, and Playwright WebKit revision
2336. WebKit results are results from Playwright's WebKit build; they are not a
claim that branded Safari was tested on physical Apple hardware. Playwright's
declared Node requirement is `>=20`, and axe's installed peer contract accepts
the installed `playwright-core`, so the repository's Node runtime satisfies both
packages.

## What the counts mean

There are 36 logical test cases in 12 spec files. `npx playwright test --list`
lists each logical case once for each of the six configured projects, so it
reports 216 project-expanded cases. The number 216 is not 216 independently
authored scenarios.

Project guards are evaluated at runtime with `test.skip(...)`. The targeted
release scripts therefore schedule a predictable superset and report explicit,
reasoned skips for cases that belong to another project:

| Gate | Scheduled | Passed | Intentionally skipped | Failed |
| --- | ---: | ---: | ---: | ---: |
| Full six-project umbrella | 216 | 37 | 179 | 0 |
| Chromium desktop, mobile, and reduced motion | 108 | 32 | 76 | 0 |
| Firefox, WebKit, and mobile WebKit `@smoke` | 9 | 5 | 4 | 0 |
| Axe desktop Chromium state matrix | 1 | 1 | 0 | 0 |
| Strict reduced-motion visual matrix | 1 | 1 | 0 | 0 |

The Axe case is also part of the 32 passing Chromium cases and the default
umbrella. The cross-browser smoke cases are also present in the umbrella. The
strict visual case is intentionally skipped by the default umbrella and enabled
only by `npm run test:visual`, so the rows must not be added together as unique
coverage.

Observed commands:

```text
cd frontend
npx playwright test --list
# 216 tests in 12 files

npm run test:e2e
# 37 passed, 179 skipped, 0 failed

npm run test:e2e:chromium
# 32 passed, 76 skipped, 0 failed

npm run test:e2e:cross-browser
# 5 passed, 4 skipped, 0 failed

npm run test:a11y
# 1 passed, 0 failed; that case performs 12 separate axe scans

npm run test:visual
# 1 passed, 0 failed; that case performs 11 strict screenshot comparisons
```

`npm run test:e2e` remains the full six-project entry point. The focused scripts
above are the release gates: complete stateful and failure coverage belongs to
Chromium, other engines run the stable smoke contract, and visual baselines use
their deterministic reduced-motion project. `test:e2e:headed` runs desktop
Chromium for local debugging and is not a CI gate.

## Production-preview and data-isolation contract

Every package-level E2E command goes through `frontend/scripts/run-e2e.mjs`.
The runner does the following for each invocation:

1. Creates a unique operating-system temporary directory and SQLite database.
2. Allocates independent loopback ports for Flask and Vite preview.
3. Sets `FLASK_ENV=testing`, an E2E-only secret, the exact preview origin, and
   `TEST_DATABASE_URL` for the disposable database.
4. Migrates that empty database to the current Alembic head.
5. Runs the real TypeScript/Vite production build unless `--skip-build` was
   explicitly requested.
6. Starts Flask without the development reloader.
7. Starts Vite production preview with `/api` proxied to that Flask process.
8. Waits for both the direct Flask health endpoint and the same-origin proxied
   health endpoint before starting Playwright.
9. Stops both child processes and recursively removes only the uniquely named
   E2E temporary directory on success, test failure, startup failure, SIGINT, or
   SIGTERM.

Browser code and test setup call `/api/*` through the Vite preview origin. The
`sameOriginApi` helper rejects non-relative or cross-origin paths and uses
`credentials: "include"`, so setup traffic exercises the same signed-session,
cookie, CORS, and proxy topology as the UI. Tests do not bypass the application
with a separately reachable backend client.

No real account, cookie file, or reusable storage state is committed. Account
identifiers combine a test label, timestamp, process ID, worker index, repeat
index, and random suffix under the reserved `example.test` domain. Stateful
tests use their own accounts; the principal private-cellar flow is serial, and
privacy checks use two independent browser contexts. Parallel read-only tests
and unrelated stateful tests can share one disposable run database without
sharing an owner. Playwright reports, traces, videos, failure screenshots,
temporary auth directories, databases, and logs are ignored by Git.

This SQLite topology tests the browser-to-application contract without risking
production data. PostgreSQL schema and write compatibility are tested by the
separate Prompt 09 PostgreSQL job; this E2E runner does not claim PostgreSQL
coverage.

## Browser projects

| Project | Playwright device/configuration | Intended coverage |
| --- | --- | --- |
| `desktop-chromium` | Desktop Chrome, 1440 x 900 | Complete public, authentication, private-data, ownership, failure, performance, accessibility, and responsive-matrix journeys |
| `desktop-firefox` | Desktop Firefox, 1440 x 900 | Public and authenticated `@smoke` journeys |
| `desktop-webkit` | Desktop Safari device descriptor using Playwright WebKit, 1440 x 900 | Public and authenticated `@smoke` journeys |
| `mobile-chromium` | Pixel 7 descriptor, 390 x 844 | Mobile menu, focus-return, discovery, reflow, and touch-capable emulation smoke |
| `mobile-webkit` | iPhone 13 descriptor, 390 x 844 | Mobile menu, focus-return, discovery, reflow, and touch-capable emulation smoke |
| `reduced-motion-chromium` | Desktop Chrome, 1440 x 900, `contextOptions.reducedMotion: "reduce"` | Nine-chapter semantic/poster path and deterministic visual baseline host |

The configuration is fully parallel. Local runs use zero retries; CI uses two
workers, one retry, and `forbidOnly`. The list and HTML reporters run together.
Failure screenshots are captured automatically, and traces and videos are
retained only for failures.

## Logical spec inventory

| Spec | Logical cases | Project selection | Main contract |
| --- | ---: | --- | --- |
| `accessibility.spec.ts` | 1 | Desktop Chromium | Twelve axe WCAG A/AA scans across public, auth, demo, private, profile, editor, and mobile-menu states; Atlas keyboard operation, adjacent Wine Detail navigation, and private-note exclusion |
| `auth-cellar-journey.spec.ts` | 1 | Desktop Chromium | UI signup/login/logout, protected return, real save, full memory edit and refresh persistence, limited Profile, history, two-context ownership isolation, delete |
| `auth-return.spec.ts` | 1 | Desktop Chromium | Exact pathname/search/hash return through signup and login, refresh session, duplicate 409 feedback, open-redirect rejection, private cache isolation after account switch |
| `demo-mobile.spec.ts` | 2 | Demo isolation on desktop Chromium; mobile smoke on both mobile projects | Public read-only demo with no Cellar/Profile traffic; mobile drawer focus/Escape/return and live discovery |
| `discovery-reliability.spec.ts` | 3 | Desktop Chromium | Input validation, empty results, limited-catalog disclosure, keyboard score breakdown, unreachable API recovery, superseded-request protection |
| `evidence.spec.ts` | 3 | Explicit opt-in and matching Chromium/Firefox/WebKit project | Fifteen tracked release-evidence screenshots; not a pixel-diff gate |
| `modes-and-failures.spec.ts` | 7 | Reduced-motion case on its project; remaining cases on desktop Chromium | Semantic poster path, disabled WebGL/Save-Data, autoplay rejection, live WebGL ready-frame evidence, context recovery/fallback, auth boot recovery, and Profile/PATCH/DELETE pending/failure truthfulness |
| `performance.spec.ts` | 2 | Desktop Chromium | Runtime/resource/lifecycle budgets, semantic hero and WebGL timing, route isolation, API timings, desktop cadence, throttled reduced-motion mobile readiness |
| `private-smoke.spec.ts` | 1 | Three desktop engines | Signup, session-backed cellar create/update/read/delete, limited Profile, logout, protected redirect |
| `public-journeys.spec.ts` | 2 | Public smoke on three desktop engines; comprehensive journey on desktop Chromium | Homepage/nine chapters, demo, Discover, not-found, recommendation/detail context, history, catalog search |
| `responsive-input.spec.ts` | 12 | Desktop Chromium | Eight fixed-width Home/Discover reflow cases, the complete route/viewport surface matrix, 200% page scale, text-spacing override, and forced colors |
| `visual.spec.ts` | 1 | Explicit opt-in on reduced-motion Chromium | Eleven deterministic strict screenshot comparisons |
| **Total** | **36** | Six projects expand the inventory to 216 | — |

## Required journey traceability

### Public homepage and discovery

- All nine semantic chapter sections and their order are asserted.
- Chapter navigation, the homepage natural-language query, representative
  public navigation/CTAs, browser back/forward, Discover catalog search, direct
  Wine Detail context, and the honest not-found route are exercised.
- Recommendation validation, no-match output, limited-catalog disclosure,
  keyboard-expanded score explanation, backend outage/recovery, and a delayed
  superseded request are asserted.
- Runtime instrumentation records semantic hero availability before the
  optional first WebGL frame. Reduced motion, Save-Data/WebGL failure, and
  autoplay rejection each preserve a usable poster/CSS-bottle path.

### Authentication and safe returns

- Accounts are created through the actual Signup UI, and login/logout use the
  actual forms and controls.
- A full page refresh proves the signed session remains valid.
- A signed-out save preserves the exact wine pathname, query, and hash through
  both Signup and Login.
- A forged external return target is rejected without a request to the external
  host and falls back to `/cellar`.
- Logout followed by a second account login proves owner-A cellar/profile text
  does not survive in owner B's private UI cache.

### Cellar, Taste Profile, and privacy

- A real catalog wine is saved; duplicate save returns 409 with truthful status
  feedback.
- The editor writes title, tasted date, location, pairing, opened-with, rating,
  status, occasion, tags, private note, buy-again choice, and favorite state;
  refresh persistence is checked before the entry is deleted.
- Empty, limited, and active Profile states are generated from real account and
  cellar data. The active Atlas exposes a readable text alternative and
  keyboard-operable nodes. Its adjacent catalog recommendation is asserted as
  an internal Wine Detail link, followed, and returned from with browser
  history.
- A private-note sentinel is checked against both the Profile API response and
  rendered Profile text.
- User B receives the same 404 envelope for nonexistent and user-A-owned entry
  GET, PATCH, and DELETE requests. B's cellar/Profile state is empty, A's entry
  remains unchanged, and account switching removes A's data from B's UI. B's
  recommendation response is also required to report zero personal signals,
  `insufficient_data`, request-only scoring, and zero points in any
  personal-taste breakdown entries.

### Demo and controlled failures

- `/demo/cellar` and `/demo/taste-atlas` remain public, visibly fictional,
  read-only, and free of authenticated Cellar/Profile network requests.
- Controlled routing failures cover auth bootstrap, recommendations, Profile,
  Cellar PATCH, and Cellar DELETE. The PATCH is deliberately held while the
  disabled `Saving memory…` state is asserted. Tests then assert that failed
  writes do not show a success message and that previously persisted data
  remains present.
- Media and renderer failures cover rejected autoplay, unavailable WebGL,
  Save-Data, first context loss/recovery, and the subsequent CSS fallback.

## Accessibility, responsive, and input coverage

The `test:a11y` command performs 12 separate `axe-core` analyses with
`wcag2a` and `wcag2aa` tags inside one isolated logical test:

1. Homepage
2. Discover initial state
3. Discover recommendation results
4. Wine Detail
5. Login
6. Signup
7. Demo Cellar
8. Empty Profile
9. Populated private Cellar
10. Open memory editor
11. Active Taste Profile
12. Open mobile drawer

Each scan waits for local fonts and attaches the full violation array to the
Playwright report. The active-Profile path also focuses and toggles a Taste
Atlas node with the keyboard before scanning.

The fixed responsive matrix is 320 x 800, 360 x 800, 390 x 844, 430 x 932,
768 x 1024, 1024 x 768, 1440 x 900, and 1920 x 1080. Each width verifies core
landmarks, the expected navigation mode, no horizontal overflow, semantic Home
and Discover content, and that any present canvas cannot intercept pointer
input. Compact navigation controls are checked for at least 44 CSS pixels.
Separate tests cover Chromium page scale at 200%, a WCAG-style text-spacing
override at 360 CSS pixels, and forced-colors emulation at 390 CSS pixels.

A second route-surface pass uses every one of those eight viewports for Wine
Detail, populated Cellar, active Profile, Demo Cellar, Demo Taste Atlas, Not
Found, Login, and Signup. It asserts visible route headings and landmarks, no
clipped H1/H2 text, no document-level horizontal overflow, and no
pointer-intercepting canvas when one is present. That adds 64 route/viewport
checks to the 16 Home and Discover checks.

Keyboard assertions include mobile drawer initial focus, Escape dismissal and
focus return, recommendation disclosure, Atlas nodes, form controls, and delete
confirmation focus. Mobile project descriptors provide touch-capable browser
emulation, but they do not substitute for physical-device or assistive-
technology testing. Manual/browser-assisted findings are recorded separately
in `docs/v2/09-accessibility-audit.md`.

## Visual regression and release evidence

`visual.spec.ts` owns 11 tracked PNG baselines under
`frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/`:

1. Homepage hero desktop
2. Homepage hero mobile
3. Discover results
4. Wine Detail
5. Populated Cellar
6. Open memory editor
7. Empty Profile
8. Active Taste Profile
9. Login
10. Signup
11. Demo Cellar

The strict matrix runs only when `GRAPEVYNE_VISUAL_BASELINES=1`. It uses the
fixed reduced-motion Chromium project, disables WebGL through the capability
path, waits for fonts and `<main>`, uses fixed viewports, disables residual
capture-time animation, and compares with `maxDiffPixels: 0`. Dynamic private
identity and note regions are masked rather than written into durable visual
artifacts. The tracked baselines were generated and immediately repeated
successfully on the authoring host; updating them is an explicit review action,
not part of a routine test run.

Canonical verification command:

```text
npm run test:visual
```

The separate opt-in evidence spec writes 15 reviewed screenshots to
`docs/screenshots/prompt-09/`: 13 Chromium product/fallback/accessibility/error
states plus one Firefox and one WebKit smoke frame. Evidence capture asserts
the expected state before writing each image; the primary desktop Home capture
now requires the live renderer's ready state and exactly one canvas. Evidence
capture is not a replacement for the screenshot-diff test.

Live WebGL is intentionally tested as a functional visual smoke rather than a
frame-perfect snapshot. Its dedicated desktop Chromium case requires a visible
ready layer at full opacity, exactly one canvas at least 1400 x 880, and a hidden
CSS fallback; it also retains a full-page PNG over 100 kB as the
`live-webgl-label-forward-visual-smoke` report attachment. Separate tests cover
context recovery, CSS fallback after failure, no early non-hero video, and no
WebGL/model graph on product routes. Approved label orientation, pedestal
composition, and bottle realism remain human-visual and model/unit invariants;
there is no brittle computer-vision assertion for them.

## Skip policy

Every observed skip is deliberate and carries a reason in source:

- Most cases belong to one named project so stateful journeys are not repeated
  six times.
- `@smoke` selection runs public/private cases on desktop Firefox and desktop
  WebKit, and the responsive-navigation case on mobile WebKit. The four other
  project/case combinations are expected mismatches.
- Evidence generation requires `GRAPEVYNE_CAPTURE_EVIDENCE=1`.
- Strict visual comparison requires `GRAPEVYNE_VISUAL_BASELINES=1` and the
  reduced-motion Chromium project; `npm run test:visual` sets both selections.
- The WebGL context-loss case may skip if the local renderer exposes no usable
  WebGL context. The dedicated live-renderer smoke remains a hard gate. The
  conditional context-loss skip did not occur in the reported 32-pass Chromium
  run.

There are no `test.only` gates hidden in local code; CI rejects them through
`forbidOnly`.

## Reports and CI

Local runs write transient artifacts beneath `frontend/test-results/`:

- `playwright/` for per-test output, attachments, traces, screenshots, and
  videos;
- `html/` for the browsable Playwright report;
- Axe violation JSON, runtime-performance JSON, and the live-WebGL PNG as test
  attachments.

GitHub Actions installs only Chromium for the Chromium job and only Firefox and
WebKit for the cross-browser job. Both jobs run the same production-preview
runner and upload transient Playwright output only on failure. The workflow has
`contents: read`, does not cache auth state, and contains no deployment step.
Local results above do not claim that the GitHub-hosted jobs have run.

## Known limitations and explicit boundaries

- The browser matrix is local Playwright automation. It does not include a
  physical iOS/Android device, branded Safari, a real screen reader, or a
  hardware virtual keyboard.
- The E2E database is isolated SQLite. PostgreSQL compatibility is a separate
  migration/write contract and must not be inferred from these browser tests.
- The 200% zoom check uses Chromium DevTools Protocol page scale; forced colors,
  mobile devices, network, and CPU conditions are emulations.
- Runtime timings and approximate frame cadence are controlled local lab
  measurements, not field-user guarantees. Noisy timing targets are reported
  separately from hard resource/lifecycle assertions.
- Strict pixel baselines deliberately use posters and the CSS bottle. Animated
  video and live WebGL are covered by lifecycle, resource, fallback, and manual
  visual checks rather than unstable per-frame diffs.
- Visual and documentation evidence commands are opt-in and are not currently
  part of the default CI workflow. Their tracked outputs require intentional
  review when the rendering host or approved composition changes.
- Automated axe results do not replace keyboard, contrast-over-video,
  screen-reader, focus-trap, or physical-device review; see the accessibility
  audit for those boundaries.
- Live WebGL assertions do not algorithmically judge label-forward orientation
  or pedestal coverage; those remain accepted visual evidence plus lower-level
  model/scene tests.
