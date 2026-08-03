# GRAPEVYNE V2 Prompt 09 quality report

## Release QA verdict

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`.
Accepted base: `f08452538bd283842140b28462ace52ef272c7c9`.

The Prompt 09 implementation **passes the completed local engineering gates**:
assets, lint, typecheck, unit and backend tests, production build, bundle
budgets, browser journeys, visual regression, and automated accessibility all
passed. The application is **not approved for public deployment**. Known Python
and frontend advisories, production topology/configuration, GitHub-hosted CI,
and physical-device/assistive-technology review remain explicit blockers or
boundaries. Prompt 09 performed no push, merge, or deployment.

Detailed evidence:

- [quality and release gates](09-quality-release-gates.md)
- [Playwright architecture and E2E matrix](09-e2e-test-matrix.md)
- [performance and bundle source data](09-performance-budget.json)
- [accessibility audit](09-accessibility-audit.md)
- [security and dependency audit](09-security-and-dependency-audit.md)
- [15 retained release screenshots](../screenshots/prompt-09/)

## Final automated results

| Gate | Final local result |
| --- | --- |
| Frontend unit/component | **43 files, 290 tests passed** |
| Backend | **249 passed, 3 skipped**; the skips are the explicitly opt-in PostgreSQL stage tests in the ordinary SQLite run |
| Full six-project E2E umbrella | **37 passed, 179 intentionally skipped, 0 failed** |
| Chromium desktop/mobile/reduced-motion gate | **32 passed, 76 project/opt-in skips, 0 failed** |
| Firefox/WebKit smoke gate | **5 passed, 4 expected project mismatches, 0 failed** |
| Accessibility | **1 passed, 0 failed**, performing **12** separate axe WCAG A/AA scans |
| Deterministic visual regression | **1 matrix passed** against **11** strict baselines |
| Build and static budgets | Production build passed; all 8 bundle budgets and 8 product-route isolation checks passed |
| Immutable assets | 3 foundational, 30 cinematic, and 10 WebGL/model/label/font contracts passed |
| Backend inventory/migrations | 15 routes; compileall, pip check, SQLite migration tests, and local PostgreSQL upgrade/downgrade/re-upgrade checks passed |

The repeated 2,506-row Taste Profile service benchmark used 20 warmups and 200
measured calls: every compact serialized output was identical; median was
0.326271 ms, nearest-rank p95 0.357625 ms, minimum 0.318875 ms, and maximum
0.507708 ms. The deterministic compact payload was 2,644 bytes. The separate
10,006-row stress fixture also remained deterministic and output-bounded, while
Cellar, recommendations, and Profile each stayed at two SQL statements including
authentication in their realistic owner-scoped fixtures.

The browser runner uses a fresh temporary SQLite database, unique test accounts,
dynamic loopback ports, Flask plus Vite production preview, and a same-origin
`/api` proxy for every invocation. Cleanup removes its database and processes on
success, failure, timeout, or signal. The full state-changing journeys cover
signup/login/logout, return routes, Discover and Wine Detail, Cellar create/edit/
refresh/delete, duplicate feedback, Profile states, and two-owner isolation.

The responsive suite exercises Home and Discover at all eight required/reflow
viewports. It also checks Wine Detail, populated Cellar, active Profile/Taste
Atlas, both demo routes, the honest 404, Login, and Signup at every viewport—64
additional route/viewport checks—without claiming that every nested private
form is opened at every size.

## Bundle results

These are the final values in
[`09-performance-budget.json`](09-performance-budget.json), measured from the
Vite manifest and emitted files with level-9 gzip:

| Asset graph | Raw bytes | Gzip bytes | Enforced maximum |
| --- | ---: | ---: | ---: |
| Principal initial JavaScript | 241,125 | 75,981 | 82,000 gzip |
| Shared CSS | 147,451 | 25,325 | 28,000 gzip |
| Homepage route, excluding optional imports | 27,492 | 9,746 | 12,000 gzip |
| Discover route | 15,962 | 5,492 | 8,000 gzip |
| Wine Detail route | 8,497 | 3,012 | 6,000 gzip |
| Cellar route | 28,293 | 9,053 | 12,000 gzip |
| Profile route | 10,135 | 3,690 | 6,000 gzip |
| Lazy WebGL graph | 906,803 | 246,504 | 930,000 raw / 255,000 gzip |

Manifest-closure assertions also prove that Discover, Wine Detail, Cellar,
Profile, Login, Signup, demo Cellar, and demo Taste Atlas do not import the
home-only WebGL graph, GSAP, or Lenis.

## Controlled local runtime lab

These are production-preview lab measurements on loopback with a fresh browser
context. They are not field guarantees.

| Measurement | Final value |
| --- | ---: |
| Semantic hero visible | 100.3 ms |
| Largest Contentful Paint | 316 ms |
| Cumulative Layout Shift | **0.22507716049382714** |
| Initial long tasks | 79, 110, 88, and **1,130 ms** |
| Hero DOM to first valid WebGL frame | 694.9 ms |
| WebGL import to first valid frame | 511.8 ms |
| Initial requests | 25 |
| Initial transferred bytes | 5,015,783 |
| Cellar list API | 8.7 ms |
| Taste Profile API | 9.3 ms |
| Recommendations API | 8.4 ms |
| Approximate desktop WebGL cadence | 16.8624 fps |
| Approximate reduced-motion mobile cadence under throttle | 96.463 fps |

Hard lifecycle assertions passed: semantic content appeared before optional
WebGL, no non-hero video loaded initially, the checked Discover product route made no WebGL/model
request, Home never exceeded one canvas, and no canvas remained after leaving
Home.

Two soft targets missed and are not hidden: CLS exceeded `0.10`, and the
1,130 ms initialization task exceeded `500 ms`. These require investigation in
a later performance pass without reducing approved media/model quality or
removing semantic content. The timing and cadence figures are informational;
resource and lifecycle checks are the hard regression gates.

## Accessibility findings

`@axe-core/playwright@4.12.1`/`axe-core@4.12.1` reported zero WCAG 2 A/AA
violations across Home, Discover initial/results, Wine Detail, Login, Signup,
demo Cellar, empty Profile, populated Cellar, the memory editor, active Taste
Profile, and the open mobile drawer.

Browser and component coverage verifies visible focus, modal drawer focus entry
and trap, Escape and focus return, non-modal Cellar panel focus return, form
labels/errors/live feedback, keyboard recommendation details, keyboard-operable
Atlas nodes plus an equivalent text summary, reduced motion, 320 CSS-pixel
reflow, text spacing, CDP 200% scale, forced colors, primary touch targets, and
pointer-inert decorative canvas/video. Approved media is muted, decorative, and
nonessential to the semantic story.

Remaining manual boundaries are real browser-control 200% zoom, full keyboard
traversal, NVDA/JAWS/VoiceOver, physical devices and branded Safari, every-frame
composite video contrast, and rapid-flash review. The screenshots and axe run do
not substitute for those checks.

## Security, privacy, and deployment blockers

The isolated-cache npm audit remains **10 affected package entries: 1 low, 5
moderate, 4 high, 0 critical**. `pip-audit` reports **7 vulnerability records in
3 pinned packages**: Flask 3.0.3, Flask-CORS 4.0.1, and python-dotenv 1.0.1.
Bandit reported three reviewed low-severity B105 false positives and no medium,
high, or high-confidence finding. Targeted source and built-client scans found no
recognized production token or private-key pattern.

Public deployment remains blocked until at least:

1. Flask is upgraded to 3.1.3 or newer, Flask-CORS to 6.0.0 or newer, and
   python-dotenv to 1.2.2 or newer, followed by the complete regression matrix;
2. the React Router, Vite, Drei/UUID, Babel/PostCSS, ESLint/Vitest, and related
   npm advisory paths are remediated in a dedicated compatibility branch;
3. strong platform `SECRET_KEY`, real `DATABASE_URL`, exact HTTPS
   `FRONTEND_ORIGINS`, security headers, auth rate limiting, database least
   privilege/backups, and log/session policies are provisioned and tested;
4. the intended Vercel service/Flask entrypoint and same-origin rewrite become
   reviewable deployment configuration rather than an assumption from
   Git-excluded local adapter files; and
5. the full-history secret scan and real deployed edge/database checks complete.

Private responses now carry `Cache-Control: private, no-store` and
`Vary: Cookie`, ownership queries remain session scoped, cross-owner reads and
mutations remain indistinguishable from nonexistent records, and retained
screenshots expose no private note, email, user ID, Cellar entry ID, or internal
database ID. These are meaningful controls, not substitutes for dependency
upgrades or production verification.

## Known limits and handoff

- Playwright WebKit is not branded Safari or physical Apple hardware.
- Browser E2E uses isolated SQLite; local PostgreSQL 14.21 passed the real
  migration/write sequence, while the PostgreSQL 18.4 GitHub Actions job is
  structurally validated but has not run on a GitHub-hosted runner.
- Strict visual baselines use deterministic reduced-motion poster/CSS-bottle
  states. Live video and WebGL use lifecycle smoke plus retained human-reviewed
  evidence, not brittle frame-perfect comparisons.
- The six-record demonstration catalog and controlled recommendation vocabulary
  remain intentionally limited and visibly disclosed.
- The local engineering pass does not waive the dependency, platform, physical
  accessibility, or runtime soft-target work above.

The tracked [CI workflow](../../.github/workflows/ci.yml) contains frontend,
backend, PostgreSQL, Chromium, and Firefox/WebKit jobs with `contents: read`,
failure-only browser artifacts, and no deployment step. Its GitHub-hosted result
must be recorded before a public release is considered.
