# GRAPEVYNE V2 Prompt 09 quality report

## Prompt 09A current release-candidate status

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`.
Accepted Prompt 09 commit:
`14f7e4cb85d585d6da1e153c3882da4549f6e4fa`.

Prompt 09A **passes the completed local release-blocker gates**. Exact dependency
remediation leaves zero high/critical npm entries, zero Python audit records, and only two
documented moderate React Router package entries with no known exploitable path in this
client-rendered SPA. The CLS and local software-renderer main-thread blockers now pass five
controlled repetitions. Full-history secret scanning and local CI policy validation are
complete, and all rerun product, browser, accessibility, privacy, build, bundle, and asset
contracts pass.

This is a **locally verified release candidate**, not a public deployment or recruiter
handoff. No push, merge, Vercel link, preview, production deployment, DNS, hosted secret,
or Prompt 10 action occurred.

Current evidence:

- [Prompt 09A release-blocker remediation](09a-release-blocker-remediation.md)
- [Prompt 09A dependency inventory](09a-dependency-inventory.json)
- [Prompt 09A dependency remediation](09a-dependency-remediation.md)
- [Prompt 09A performance results](09a-performance-results.json)
- [Prompt 09A full-history secret scan](09a-history-secret-scan.md)
- [nine retained Prompt 09A screenshots](../screenshots/prompt-09a/)

### Current gate classification

| Classification | Evidence | Current result |
| --- | --- | --- |
| **PASSED local engineering gates** | Assets, lint, TypeScript, 44-file/294-test frontend suite, 256-pass backend suite, production build, 8 bundle budgets, 8 route-isolation checks, Chromium, Firefox/WebKit smoke, Axe, deterministic visual matrix, and the five-repeat performance gate | **Passed locally** |
| **RESOLVED local release blockers** | npm high/critical findings, all Python audit findings, CLS, software-renderer long task, full reachable-history scan, and CI syntax/supply-chain policy | **Resolved or explicitly adjudicated** |
| **Remaining Prompt 10 hosted/manual boundaries** | GitHub-hosted execution, Vercel linkage and environments, production database/backups, real `/api` edge topology, HTTPS cookie/CORS/header validation, logs/rollback, public-domain browsers, native GPU, physical Safari/iPhone, and screen readers | **Not started; still required** |

### Dependency comparison

| Ecosystem | Prompt 09 / fresh Prompt 09A baseline | Prompt 09A final |
| --- | --- | --- |
| npm full tree | 10 package entries: 1 low, 5 moderate, 4 high, 0 critical | 2 moderate; 0 low/high/critical |
| npm runtime-only tree | 8 package entries: 1 low, 5 moderate, 2 high, 0 critical | 2 moderate; 0 low/high/critical |
| Python | Fresh audit: 8 records in 4 packages, including a newly published pytest record | 0 records |

The two npm residual entries are `react-router` and `react-router-dom`. The reviewed
vulnerable surfaces are backslash redirect handling and SSR state deserialization.
GrapeVyne has no Router SSR/hydration path and validates every auth return destination with
`isSafeInternalReturnTo`, rejecting protocol-relative, backslash, CR/LF, and external
destinations. The residuals are documented individually rather than suppressed. A Router
7 migration was rejected because the current 7.x graph introduces a high RSC advisory;
the 8.3 fix requires incompatible Node/React majors and lacks a matching Router DOM release.

Python pins are now Flask 3.1.3, Flask-CORS 6.0.5, python-dotenv 1.2.2, and pytest 9.0.3.
The anchored `/api` CORS resource, explicit PNA denial, and case/`+`/precedence regressions
preserve the exact-origin, credentialed session contract. `pip check`, compileall, 256
backend tests, and `pip-audit` pass. Bandit retains only three reviewed low-severity B105
fixture/message false positives and has no medium/high or high-confidence finding. The CI
Bandit command enforces medium and higher severity and exits zero without hiding the lows;
both full/runtime npm high-threshold CI audit commands likewise exit zero while raw JSON
continues to disclose the two residual moderates.

### Performance comparison

All five final runs pass the hard CLS 0.10 and long-task 500 ms limits:

| Metric | Baseline median | Baseline p95/max | Final median | Final p95/max |
| --- | ---: | ---: | ---: | ---: |
| CLS | 0.22507716049382714 | 0.22541578811205953 | 0.001299892305183149 | 0.001299892305183149 |
| Maximum long task | 1,120 ms | 1,172 ms | 0 ms | 52 ms |
| LCP | 316 ms accepted single run | 316 ms accepted single run | 264 ms | 348 ms |
| Semantic hero | 100.3 ms accepted single run | 100.3 ms accepted single run | 82.3 ms | 172.7 ms |
| Initial requests | 25 accepted single run | 25 accepted single run | 21 | 22 |
| Initial transfer | 5,015,783 B accepted single run | 5,015,783 B accepted single run | 2,507,064 B | 4,564,672 B |

The dominant CLS source was the footer moving when the lazy Home fallback was replaced;
the fix reserves the Home viewport and keeps CSS-bottle geometry stable through the
visibility-only crossfade. Trace evidence attributes the long spike to visible
SwiftShader frame/layer composition and GLES2 readback/wait work. Explicit software
renderers now receive the existing semantic/CSS fallback without importing the WebGL
graph. Hardware-capable devices still receive lazy live WebGL: the forced capable-renderer
smoke proves one ready nonblank canvas, stable fallback bounds, model/label requests, and
context-loss recovery.

The local reference renderer correctly falls back, so no final native hero-to-WebGL timing
exists; inventing one would be misleading. Prompt 10 must measure that timing on actual
GPU-backed hardware. Full samples and attribution are in
[`09a-performance-results.json`](09a-performance-results.json).

### Current build and browser evidence

| Asset graph | Raw bytes | Gzip bytes | Result |
| --- | ---: | ---: | --- |
| Principal initial JavaScript | 242,970 | 76,809 | Pass |
| Shared CSS | 147,472 | 25,362 | Pass |
| Homepage route | 28,111 | 9,960 | Pass |
| Discover route | 15,962 | 5,490 | Pass |
| Wine Detail route | 8,497 | 3,011 | Pass |
| Cellar route | 28,293 | 9,051 | Pass |
| Profile route | 10,135 | 3,686 | Pass |
| Lazy WebGL graph | 907,605 | 246,633 | Pass |

The final local browser matrix records 34 passed Chromium cases with 83 intentional
project/opt-in skips, 5 passed Firefox/WebKit smoke cases with 4 expected project
mismatches, one passing Axe representative-state matrix, and one passing strict
reduced-motion visual matrix. It covers 1440×900 and 1920×1080 desktop Chromium, 390×844
mobile Chromium, reduced-motion desktop/mobile, desktop Firefox, and desktop/mobile
Playwright WebKit. Reduced motion still performs zero video and WebGL requests; major
routes have no horizontal overflow or unexpected console/page errors.

Gitleaks 8.30.1 covered all 15 reachable commits and the working tree. Its two redacted
generic-API findings are deterministic test fixtures, not credentials; no raw candidate
value is committed here. `actionlint 1.7.12` passes the immutable, least-privilege,
non-deploying workflow. Hosted Actions have intentionally not run.

The post-upgrade disposable PostgreSQL 14.21 cycle passed: fresh upgrade to `0002`,
`current`/`check`, and head write; downgrade to `0001` with preservation and baseline
write; then re-upgrade to `0002`, `current`/`check`, and nullable-memory-field write. The
server was stopped and temporary cluster removed. CI is digest-pinned to PostgreSQL 18.4;
that hosted version remains unexecuted until Prompt 10.

### Remaining Prompt 10 boundary

Prompt 10 must run hosted CI; link and configure Vercel Preview/Production; provision and
test the production database, least privilege, backups, restore, migrations, and rollback;
validate the real same-origin `/api` topology, HTTPS cookies, exact origins/CORS/PNA,
private cache and security headers, auth rate limiting, logs and error redaction; record
monitoring/rollback; repeat public-domain browser journeys and native-GPU WebGL timing; and
complete physical Safari/iPhone plus available VoiceOver/NVDA/JAWS, keyboard, 200% zoom,
video-contrast, and rapid-flash review. Until then, do not call the project production-
deployed or recruiter-ready.

## Prompt 09 accepted release QA verdict (historical baseline)

_This archived section preserves the accepted Prompt 09 evidence exactly as the baseline
that triggered Prompt 09A. Its advisory counts and soft performance misses are historical;
the current Prompt 09A values above supersede them._

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

### Final automated results

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

### Bundle results

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

### Controlled local runtime lab

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

### Accessibility findings

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

### Security, privacy, and deployment blockers

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

### Known limits and handoff

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
