# Prompt 09 — Quality and release gates

## Decision

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`.
Accepted base: `f08452538bd283842140b28462ace52ef272c7c9`.

The **Prompt 09 engineering implementation passes its local quality gates**. The repository is **not
approved for public deployment**: the pinned frontend and Python dependency sets contain
known high-severity/runtime advisories that require a separate compatibility upgrade and
the full regression matrix. Prompt 09 does not deploy, push, merge, or begin Prompt 10.

This distinction is intentional. The Playwright, accessibility, build, bundle, backend,
migration, privacy, and local PostgreSQL checks pass; a passing quality implementation
does not erase the dependency and physical-device limitations recorded below.

## Gate summary

| Gate | Observed result | Decision |
| --- | --- | --- |
| Immutable assets | 3 foundational assets, 30 approved cinematic assets, and 10 approved WebGL/model/label/font assets verified | Pass |
| Frontend lint and strict TypeScript | ESLint passed with zero warnings; application and Playwright/E2E TypeScript projects passed | Pass |
| Frontend unit/component tests | 43 files, 290 tests passed | Pass |
| Production build and bundle budgets | Vite build passed; all 8 emitted-asset budgets and all 8 product-route isolation checks passed | Pass |
| Full Playwright umbrella | 216 project-expanded cases: 37 passed, 179 intentionally skipped, 0 failed | Pass |
| Chromium gate | 108 scheduled cases: 32 passed, 76 project/opt-in skips, 0 failed | Pass |
| Firefox/WebKit smoke | 9 scheduled cases: 5 passed, 4 expected project mismatches, 0 failed | Pass |
| Deterministic visual regression | 1 reduced-motion Chromium matrix passed against 11 strict baselines | Pass |
| Accessibility | Focused production-preview command passed: 1 test, zero violations across 12 WCAG A/AA states | Pass |
| Backend | 249 passed; 3 explicitly opt-in PostgreSQL-stage tests skipped in the ordinary SQLite run | Pass |
| Backend inventory and syntax | 15 Flask routes; compileall and pip dependency consistency passed | Pass |
| SQLite migration contract | 7 migration tests passed; head/current/check succeeded in the disposable test database | Pass |
| Local PostgreSQL contract | PostgreSQL 14.21: head write, baseline write after downgrade, and re-upgrade write each passed | Pass |
| CI PostgreSQL contract | PostgreSQL 18.4 service and three-stage job are present and structurally validated; GitHub-hosted execution has not occurred | Structurally ready, hosted run pending |
| Dependency and secret review | Findings reported exactly; targeted source/client secret scans found no production secret pattern | Pass as an audit; deployment blocked |
| Diff hygiene | `git diff --check` passed; the final handoff verifies the required single commit and clean worktree | Pass |

## Browser architecture and isolation

The tracked runner at [`frontend/scripts/run-e2e.mjs`](../../frontend/scripts/run-e2e.mjs)
creates a fresh temporary directory and SQLite database for every invocation. It applies
migrations, builds the frontend, starts Flask with a non-production secret on a dynamic
loopback port, starts Vite production preview on another dynamic port, and proxies
same-origin `/api` traffic to Flask. Cleanup terminates both processes and removes the
database on success, failure, timeout, `SIGINT`, or `SIGTERM`.

State-changing tests use unique `example.test` accounts and isolated browser contexts.
The two-owner privacy journey uses separate cookie jars, compares cross-owner and
nonexistent 404 envelopes, verifies GET/PATCH/DELETE denial, and proves that User B does
not inherit User A's Cellar, recommendation, or Taste Profile signals. No real account,
cookie, storage state, or production database is used or committed.

The Playwright projects are:

- desktop Chromium;
- desktop Firefox;
- desktop Playwright WebKit;
- mobile Chromium emulation;
- mobile WebKit emulation; and
- reduced-motion Chromium.

Playwright WebKit is not a claim of branded Safari or physical Apple hardware coverage.
The full stateful flow runs in Chromium; stable public/auth/private smoke cases run in
Firefox and WebKit; mobile projects cover the touch-capable navigation contract.

Detailed scenarios, project guards, skip reasons, and route/viewport coverage are in
[`09-e2e-test-matrix.md`](09-e2e-test-matrix.md).

## Accessibility and visual evidence

The pinned accessibility integration is `@axe-core/playwright@4.12.1`, resolving
`axe-core@4.12.1`. The focused gate scans Home, Discover initial/results, Wine Detail,
Login, Signup, demo Cellar, empty Profile, populated Cellar, the open memory editor,
active Taste Profile, and the open mobile drawer with the supported `wcag2a` and
`wcag2aa` tags. Every scanned state returned zero violations.

Browser/component checks cover drawer focus entry/trap/Escape/return, visible focus,
form naming and feedback, keyboard recommendation breakdown, keyboard-operable Taste
Atlas nodes and their text alternative, reduced motion, Save-Data/WebGL fallbacks,
text-spacing override, 320 CSS-pixel reflow, CDP 200% page scale, forced colors, and
primary mobile touch targets. The complete route surface was checked at 320×800,
360×800, 390×844, 430×932, 768×1024, 1024×768, 1440×900, and 1920×1080; the seven
Prompt 09-required sizes are all represented, with 320×800 added for the WCAG reflow
boundary.

Strict screenshots use fixed viewports, loaded fonts, reduced motion, approved posters,
the CSS bottle fallback, deterministic fixture data, disabled animations, and a zero-pixel
diff. Live WebGL has a separate non-pixel smoke requiring one ready full-hero canvas, a
hidden CSS fallback, and a nonblank captured frame; human review confirms the approved
label-forward bottle and covered pedestal composition.

See [`09-accessibility-audit.md`](09-accessibility-audit.md), the 11 baselines under
[`frontend/e2e/__snapshots__/`](../../frontend/e2e/__snapshots__/), and the 15 retained
release screenshots under [`docs/screenshots/prompt-09/`](../screenshots/prompt-09/).

## Performance and bundle results

All enforced bundle checks pass. The final measured gzip outputs are:

| Bundle | Actual gzip | Maximum gzip |
| --- | ---: | ---: |
| Principal initial JavaScript | 75,981 B | 82,000 B |
| Shared CSS | 25,325 B | 28,000 B |
| Home route, excluding optional imports | 9,746 B | 12,000 B |
| Discover route | 5,492 B | 8,000 B |
| Wine Detail route | 3,012 B | 6,000 B |
| Cellar route | 9,053 B | 12,000 B |
| Profile route | 3,690 B | 6,000 B |
| Lazy WebGL graph | 246,504 B | 255,000 B |

The lazy WebGL graph also passes its 930,000-byte raw maximum at 906,803 bytes. Static
manifest-closure checks prove that the eight product/auth/demo routes do not import the
home-only WebGL graph, GSAP, or Lenis.

The controlled local runtime lab confirms semantic content before optional WebGL, zero
early non-hero video requests, zero WebGL/model requests on the checked non-home product
Discover route, at most one Home canvas, and zero canvases after leaving Home. The sample missed
the soft CLS target (`0.22507716049382714` versus `0.10`) and recorded one initialization
long task of `1130 ms` versus the `500 ms` soft target. These noisy local values are reported,
not hidden or converted into false passes. Exact timing, request, transfer, API, and frame
cadence values are in [`09-performance-budget.json`](09-performance-budget.json).

## Backend, migrations, and contracts

The backend suite verifies the standard success/error envelope, strict query/body
validation, size/date constraints, rollback behavior, public/private response boundaries,
owner-indistinguishable 404s, bounded queries, deterministic large fixtures, and migration
reversibility. The ordinary suite completed with **249 passed and 3 opt-in PostgreSQL-stage
tests skipped**. Query budgets remain two SQL statements, including authentication, for
the realistic Cellar, recommendation, and Taste Profile fixtures. A deterministic
10,006-row in-memory Taste Profile stress fixture also passes with bounded output.

The accepted 2,506-row service benchmark was repeated with 20 warmups and 200 measured
calls while garbage collection was disabled only for measurement. All serialized outputs
were identical; median was **0.326271 ms**, nearest-rank p95 **0.357625 ms**, minimum
**0.318875 ms**, and maximum **0.507708 ms**. The compact deterministic payload was 2,644
bytes. This is a local in-process calculation benchmark, not a database or concurrent-load
measurement.

Local PostgreSQL 14.21 executed the real migration sequence against a disposable loopback
database: empty database to head and representative memory write; downgrade to
`0001_prompt07_baseline` with preserved/writable core data; then re-upgrade to head with
nullable memory fields restored and writable. The CI workflow repeats this contract with
the pinned `postgres:18.4-alpine` service. The workflow has only been structurally
validated locally; no GitHub-hosted result is claimed.

No endpoint, JSON body, response envelope, authentication, ownership, or database-schema
contract changed. Prompt 09 adds defense-in-depth `Cache-Control: private, no-store` and
`Vary: Cookie` headers to Auth and Cellar responses, matching the existing private
Profile/recommendation policy; adds an ID tie-breaker to the existing newest-first Cellar
ordering; and gives browser API requests a 15-second client timeout. The live contract is
recorded in [`06-live-api-contract.md`](06-live-api-contract.md).

## Dependency, privacy, and CI decision

The reproducible isolated-cache `npm audit` result is unchanged from the accepted baseline:
**10 package entries: 1 low, 5 moderate, 4 high, 0 critical**. `pip-audit 2.10.1` reports
**7 vulnerability records in 3 pinned packages**. Bandit 1.8.6 reports **3 low-severity,
medium-confidence B105 findings**, all reviewed false positives, with zero medium/high
findings. The targeted repository and generated-client scans found no recognized private
key or production-token forms. Full classifications and remediation versions are in
[`09-security-and-dependency-audit.md`](09-security-and-dependency-audit.md).

These dependency findings **block public deployment**. They were not auto-fixed because
the safe remediation spans Flask, Flask-CORS, python-dotenv, Vite, React Router, and
transitive build/runtime packages and therefore requires a dedicated compatibility branch
and the complete matrix. No `npm audit fix --force` was run.

[`ci.yml`](../../.github/workflows/ci.yml) adds frontend, backend, PostgreSQL, Chromium,
and Firefox/WebKit jobs with `contents: read`, locked installs, safe dependency caching,
failure-only Playwright artifacts, and no deployment or write permission. YAML structure
was validated locally; hosted Actions execution remains pending.

## Exact file manifest

Prompt 09 modifies 20 existing files and adds 62 files. Nothing was moved or deleted.

- Modified: `.gitignore`
- Modified: `backend/app/routes/auth.py`
- Modified: `backend/app/routes/cellar.py`
- Modified: `backend/app/services/cellar_service.py`
- Modified: `backend/tests/test_taste_profile.py`
- Modified: `docs/v2/06-live-api-contract.md`
- Modified: `frontend/eslint.config.js`
- Modified: `frontend/index.html`
- Modified: `frontend/package-lock.json`
- Modified: `frontend/package.json`
- Modified: `frontend/src/App.routes.test.tsx`
- Modified: `frontend/src/App.tsx`
- Modified: `frontend/src/api/__tests__/client.test.ts`
- Modified: `frontend/src/api/client.ts`
- Modified: `frontend/src/components/layout/AppLayout.tsx`
- Modified: `frontend/src/main.tsx`
- Modified: `frontend/src/pages/HomePage.test.tsx`
- Modified: `frontend/src/pages/HomePage.tsx`
- Modified: `frontend/vite.config.ts`
- Modified: `frontend/vitest.config.ts`
- Added: `.github/workflows/ci.yml`
- Added: `backend/tests/test_backend_quality.py`
- Added: `backend/tests/test_postgres_ci.py`
- Added: `backend/tests/test_query_budgets.py`
- Added: `docs/screenshots/prompt-09/01-homepage-desktop-production-preview.png`
- Added: `docs/screenshots/prompt-09/02-homepage-mobile-production-preview.png`
- Added: `docs/screenshots/prompt-09/03-discover-recommendations.png`
- Added: `docs/screenshots/prompt-09/04-populated-cellar.png`
- Added: `docs/screenshots/prompt-09/05-memory-editor.png`
- Added: `docs/screenshots/prompt-09/06-active-taste-profile.png`
- Added: `docs/screenshots/prompt-09/07-login-mobile.png`
- Added: `docs/screenshots/prompt-09/08-reduced-motion-hero.png`
- Added: `docs/screenshots/prompt-09/09-disabled-webgl-fallback.png`
- Added: `docs/screenshots/prompt-09/10-browser-zoom-200-percent.png`
- Added: `docs/screenshots/prompt-09/11-forced-colors-high-contrast.png`
- Added: `docs/screenshots/prompt-09/12-application-error-fallback.png`
- Added: `docs/screenshots/prompt-09/13-not-found-404.png`
- Added: `docs/screenshots/prompt-09/14-desktop-firefox-smoke.png`
- Added: `docs/screenshots/prompt-09/15-desktop-webkit-smoke.png`
- Added: `docs/v2/09-accessibility-audit.md`
- Added: `docs/v2/09-e2e-test-matrix.md`
- Added: `docs/v2/09-performance-budget.json`
- Added: `docs/v2/09-quality-release-gates.md`
- Added: `docs/v2/09-security-and-dependency-audit.md`
- Added: `docs/v2/quality-report.md`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/01-homepage-hero-desktop.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/02-homepage-hero-mobile.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/03-discover-results.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/04-wine-detail.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/05-cellar-populated.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/06-memory-editor.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/07-profile-empty.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/08-profile-active.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/09-login.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/10-signup.png`
- Added: `frontend/e2e/__snapshots__/visual.spec.ts/reduced-motion-chromium/11-demo-cellar.png`
- Added: `frontend/e2e/accessibility.spec.ts`
- Added: `frontend/e2e/auth-cellar-journey.spec.ts`
- Added: `frontend/e2e/auth-return.spec.ts`
- Added: `frontend/e2e/demo-mobile.spec.ts`
- Added: `frontend/e2e/discovery-reliability.spec.ts`
- Added: `frontend/e2e/evidence.spec.ts`
- Added: `frontend/e2e/helpers/accounts.ts`
- Added: `frontend/e2e/helpers/api.ts`
- Added: `frontend/e2e/helpers/browser.ts`
- Added: `frontend/e2e/helpers/projects.ts`
- Added: `frontend/e2e/helpers/seed.ts`
- Added: `frontend/e2e/modes-and-failures.spec.ts`
- Added: `frontend/e2e/performance.spec.ts`
- Added: `frontend/e2e/private-smoke.spec.ts`
- Added: `frontend/e2e/public-journeys.spec.ts`
- Added: `frontend/e2e/responsive-input.spec.ts`
- Added: `frontend/e2e/visual.spec.ts`
- Added: `frontend/playwright.config.ts`
- Added: `frontend/scripts/run-e2e.mjs`
- Added: `frontend/scripts/verify-bundle.mjs`
- Added: `frontend/src/components/routing/AppErrorBoundary.test.tsx`
- Added: `frontend/src/components/routing/AppErrorBoundary.tsx`
- Added: `frontend/src/components/routing/RouteMetadata.tsx`
- Added: `frontend/src/lib/safeDevelopmentConsole.ts`
- Added: `frontend/src/pages/NotFoundPage.tsx`
- Added: `frontend/tsconfig.e2e.json`

## Commands represented by this report

Frontend commands were run from `frontend/`:

```text
npm ci --no-audit --no-fund
npm run verify:assets
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:bundle
npm run test:e2e
npm run test:e2e:chromium
npm run test:e2e:cross-browser
npm run test:visual
npm run test:a11y
npm audit --json
```

Backend and repository commands included:

```text
python -m pip check
python -m compileall app tests migrations
python -m pytest
python -m flask --app app routes
python -m flask --app app db heads
python -m flask --app app db current
python -m flask --app app db check
pip-audit -r backend/requirements.txt
bandit -r backend/app
git diff --check
```

Installation and npm audit operations used temporary writable caches outside the
repository. `/Volumes/LaCie/.npm-cache` was not accessed. PostgreSQL commands used only
explicit disposable loopback test databases. Scanner environments and Playwright reports,
traces, videos, auth state, temporary databases, and successful-run artifacts are not
committed.

## Remaining release work

- Complete the dependency remediation in a separate compatibility branch and rerun every
  frontend, backend, browser, accessibility, migration, PostgreSQL, and bundle gate.
- Investigate the controlled-lab CLS and initialization long-task soft misses without
  changing approved media/model quality or semantic content.
- Run the structurally validated workflow on GitHub-hosted runners; do not infer that
  result from local YAML review.
- Perform physical-device, branded-Safari, real 200% browser zoom, screen-reader, complete
  keyboard-only, and full-motion composite-contrast/rapid-flash review.
- Before deployment, provision and inspect platform environment values, run an approved
  full-history secret scanner, and confirm the production database/edge topology.
- Keep this phase isolated: stop without pushing, merging, deploying, or beginning
  Prompt 10.
