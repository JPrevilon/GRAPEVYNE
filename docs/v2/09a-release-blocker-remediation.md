# Prompt 09A — Release-blocker remediation

## Verdict and boundary

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`.
Accepted Prompt 09 commit:
`14f7e4cb85d585d6da1e153c3882da4549f6e4fa`.

The Prompt 09A work is a **locally verified release candidate**. The actionable
dependency, CLS, software-renderer main-thread, full-history scan, and local CI
configuration blockers have been remediated or adjudicated with reproducible evidence.
All completed local product, build, browser, accessibility, privacy, migration, and asset
contracts remain intact.

This is not a deployment approval. No branch was created or changed, no push or merge was
performed, no Vercel project was linked, and no preview or production deployment was
started. GitHub-hosted execution, real platform configuration, public-edge validation,
native-device testing, and operational readiness remain Prompt 10 boundaries.

The machine-readable evidence is split by concern:

- [dependency inventory](09a-dependency-inventory.json) and
  [dependency remediation](09a-dependency-remediation.md);
- [performance results](09a-performance-results.json);
- [full-history secret scan](09a-history-secret-scan.md); and
- the consolidated [quality report](quality-report.md).

## Blocker disposition

| Prompt 09 finding | Prompt 09A result | Disposition |
| --- | --- | --- |
| npm: 10 affected package entries (1 low, 5 moderate, 4 high) | 2 package entries, both moderate; 0 low, high, or critical in both full and runtime-only audits | **Resolved for the release target.** The two residual React Router entries are documented individually and have no known exploitable path in this client-rendered SPA. |
| Python: 7 scanner records in 3 packages | Current audit also identified a pytest advisory, making the fresh baseline 8 records in 4 packages; final `pip-audit` reports 0 | **Resolved.** Exact safe pins were applied and regression-tested. |
| CLS approximately 0.225077 | Five-run median/p95/max: 0.001299892305183149 | **Resolved.** Every run passes 0.10 and 0.05. |
| One approximately 1,130 ms main-thread task | Five-run maximum-task median 0 ms, p95/max 52 ms | **Resolved in the reference environment.** Trace evidence identified software-rendered composition; capable-hardware WebGL remains enabled. |
| Full Git-history secret scanning outstanding | All 15 reachable commits and the working tree scanned; two redacted deterministic test-fixture findings adjudicated as non-secrets | **Resolved locally.** No credential was committed or repeated in documentation. |
| CI only structurally present | `actionlint 1.7.12` passes; actions and PostgreSQL image are immutable; tool/runtime versions are exact; audit steps fail at high severity | **Resolved locally.** GitHub-hosted jobs have intentionally not run. |
| Hosted platform and physical-device validation | Not attempted | **Prompt 10 boundary.** |

## Dependency remediation

### Frontend

Direct changes are exact:

- `@react-three/drei` `9.114.3` to `9.122.0`, removing the vulnerable UUID path while
  preserving React 18, React Three Fiber 8, and Three.js 0.169;
- `react-router-dom` resolved `6.30.3` to exact `6.30.4`, clearing the compatible
  `GHSA-2j2x-hqr9-3h42` fix while preserving the established Router API;
- Vite resolved `5.4.21` to exact `6.4.3`, and `@vitejs/plugin-react` resolved `4.7.0`
  was pinned exactly and classified correctly as build-only; and
- safe lockfile refreshes moved Babel, `brace-expansion`, `js-yaml`, PostCSS, and esbuild
  to patched versions without an uncontrolled framework migration.

React and React DOM remain on 18, React Three Fiber remains on 8, and no override installs
an API-incompatible package. A diagnostic React Router 7 migration was rejected: current
7.x releases introduce a high-severity RSC advisory in this dependency graph, while the
8.3 fix requires Node and React major upgrades and has no matching `react-router-dom` 8.3
release. Exact Router 6.30.4 therefore yields the safer reviewed tree: no high/critical
record, with two moderate package entries whose vulnerable paths are not exposed here.

Both `npm audit --json` and `npm audit --omit=dev --json` now report **2 moderate package
entries and 0 low/high/critical**. The residual records concern backslash redirect handling,
SSR state deserialization, and related `react-router-dom` redirect behavior. GrapeVyne is a
client-rendered Vite SPA with no React Router SSR/hydration state, and every dynamic auth
return destination passes `isSafeInternalReturnTo`, which rejects protocol-relative URLs,
backslashes, CR/LF, and external destinations. Focused tests preserve that contract. These
records are accepted as currently non-exploitable residual risk, not hidden or suppressed.

### Backend

Exact pins changed as follows:

- Flask `3.0.3` to `3.1.3`;
- Flask-CORS `4.0.1` to `6.0.5`;
- python-dotenv `1.0.1` to `1.2.2`; and
- pytest `8.4.2` to `9.0.3` after the fresh audit found its additional current advisory.

Each package step was followed by installation into a fresh Python 3.12.12 environment,
`pip check`, compileall, the backend suite, and `pip-audit`. The final Python audit reports
zero vulnerabilities. The Flask-CORS policy is anchored to the lowercase `/api` boundary,
explicitly denies Private Network Access, and has regressions for case, `+`, policy
precedence, trusted origins, and untrusted origins. Signed-session semantics, API envelopes,
ownership predicates, and both migrations are unchanged.

Bandit scans 3,973 application lines and reports three low-severity,
medium-confidence B105 findings: one testing-only secret marker and two copies of a
user-facing password-required message. They are reviewed false positives; there are zero
medium/high-severity and zero high-confidence findings. No suppression was added.

## Performance diagnosis and final evidence

The accepted Prompt 09 reference run measured semantic hero at 100.3 ms, LCP at 316 ms,
CLS at 0.22507716049382714, hero-to-WebGL at 694.9 ms, 25 initial requests, and 5,015,783
transferred bytes. Prompt 09A reproduced the two blockers across five runs:

| Metric | Baseline samples | Median | p95 / maximum |
| --- | --- | ---: | ---: |
| CLS | 0.22507716049382714, 0.22541578811205953, 0.209300163120432, 0.22541578811205953, 0.209300163120432 | 0.22507716049382714 | 0.22541578811205953 |
| Maximum long task (ms) | 1124, 1105, 1120, 1108, 1172 | 1120 | 1172 |

Layout-shift source records identified the footer moving when an undersized lazy Home
fallback was replaced as the dominant shift (approximately 0.20333), with a much smaller
CSS-bottle geometry shift (approximately 0.0045). Home now reserves viewport-height space
while its still-lazy route chunk resolves, and the CSS bottle keeps the same geometry while
readiness changes only visibility.

Chrome tracing found the long spike in `CrRendererMain` frame/layer commit work and GLES2
readback/wait work under SwiftShader. A separate trace capture reached 1,308.5 ms; hiding
the visible composition reduced the control maximum to 114 ms, and reduced motion produced
no long task. This evidence points to local software-rasterizer composition, not module
parsing or an application loop. Capability selection now recognizes explicit software
renderers and keeps the existing semantic/CSS fallback without importing the WebGL graph.
Hardware-capable devices still receive the lazy premium renderer.

The controlled final five runs are:

| Metric | Final samples | Median | p95 / maximum |
| --- | --- | ---: | ---: |
| CLS | 0.001121257724421832, 0.001299892305183149, 0.001299892305183149, 0.001121257724421832, 0.001299892305183149 | 0.001299892305183149 | 0.001299892305183149 |
| Maximum long task (ms) | 0, 0, 52, 0, 0 | 0 | 52 |
| LCP (ms) | 348, 268, 264, 264, 188 | 264 | 348 |
| Semantic hero (ms) | 172.7, 91.8, 79.4, 77.6, 82.3 | 82.3 | 172.7 |
| Initial requests | 21, 22, 21, 21, 21 | 21 | 22 |
| Transferred bytes | 2,507,064; 4,564,672; 2,507,064; 2,507,064; 2,507,064 | 2,507,064 | 4,564,672 |

The larger transfer sample is retained as the p95/maximum; it was not discarded. It still
remains below the accepted Prompt 09 reference. The local Chromium environment correctly
selects `fallback/software-renderer`, so the final default run has no WebGL import/frame
and a hero-to-WebGL number would be fabricated. The forced capable-renderer smoke instead
proves one ready canvas within the 8-second assertion, model plus both label requests,
stable CSS-bottle bounds within one pixel through the crossfade, a nonblank image, and
context-loss recovery. A native-GPU hero-to-WebGL timing remains a Prompt 10 measurement.

The deterministic Playwright performance gate now fails above CLS 0.10 or a 500 ms
observed task. It also proves semantic-first rendering, no early non-hero or wrong-device
video, no WebGL/model request on the fallback path, no WebGL on Discover, at most one Home
canvas, and no retained canvas after navigation. Reduced motion still makes zero video and
zero WebGL requests.

## CI and supply-chain readiness

Local `actionlint 1.7.12` validation passes. The workflow retains repository-wide
`contents: read`, uses `ubuntu-24.04`, and pins Node `20.19.6` and Python `3.12.12`.
Checkout, Node setup, Python setup, and artifact upload use immutable commit SHAs with
human-readable version comments. PostgreSQL `18.4-alpine` is digest-pinned. Frontend CI
runs full and runtime npm audits at the high threshold; backend CI installs exact
`pip-audit 2.10.1` and Bandit `1.8.6`, with Bandit enforcing medium and higher severity
while the three reviewed low findings remain visible in this report; caches key from
lock/requirements files; and failed browser evidence warns when missing and expires after
seven days. Both npm high-threshold commands exit zero; their raw JSON commands correctly
exit one because they still report the two documented moderates. No job deploys, needs a
production secret, targets `pull_request_target`, persists checkout credentials, or grants
write permission.

Gitleaks 8.30.1 scanned all 15 reachable commits with `--log-opts=--all`, then scanned the
working tree. It returned two redacted generic-API candidates in deterministic test
fixtures: a disposable E2E session-signing value and a production-config rejection test
constant. Neither is a real credential. Only the two example environment files are
tracked; browser auth state, databases, Vercel tokens, real `.env` files, and generated raw
scanner reports are not tracked. The scanner's nonzero raw finding count and manual
adjudication are both retained in [the history report](09a-history-secret-scan.md).

## Regression matrix

| Local gate | Prompt 09A result |
| --- | --- |
| Immutable assets | Passed before and after: 3 foundational, 30 cinematic, and 10 WebGL/model/label/font contracts |
| Lint / TypeScript | ESLint passed with zero warnings; application and E2E typechecks passed |
| Frontend unit/component | 44 files, 294 tests passed |
| Backend ordinary suite | 256 passed, 3 opt-in PostgreSQL-stage skips |
| Focused CORS/security | 18 passed, including PNA and resource-boundary regressions |
| Build / static bundle | Vite production build passed; 8 budgets and 8 route-isolation checks passed |
| Dedicated performance | 5/5 controlled repetitions passed |
| Desktop modes/performance | 10 passed, 1 intentional project skip |
| Chromium desktop/mobile/reduced motion | 34 passed, 83 intentional project/opt-in skips |
| Firefox/WebKit smoke | 5 passed, 4 expected project mismatches |
| Accessibility | 1 focused matrix passed; zero Axe WCAG A/AA violations across the representative states |
| Deterministic visual | 1 reduced-motion Chromium matrix passed against all existing strict baselines |
| Python dependency health | `pip check`, compileall, and `pip-audit` passed; 0 audit findings |
| PostgreSQL migration cycle | Local PostgreSQL 14.21 fresh upgrade/current/check/head write, downgrade/baseline preservation and write, then re-upgrade/current/check/nullable-memory write all passed; final revision `0002` |
| Source security | Bandit has 3 reviewed low false positives and 0 medium/high; full-history scan has 2 reviewed fixture false positives and no real secret |
| CI syntax/policy | `actionlint` and focused workflow contract tests passed |
| Diff hygiene | Final `git diff --check`, staged manifest, commit, and clean-status checks are completion-gate actions |

The Prompt 09A PostgreSQL rerun used a disposable loopback PostgreSQL 14.21 cluster: fresh
upgrade to `0002`, `current`/`check`, and head write passed; downgrade to `0001` preserved
and accepted baseline data; and re-upgrade to `0002`, `current`/`check`, and a nullable
memory-field write passed. Each targeted stage recorded one pass with the other two stage
cases deselected. The server stopped and its temporary cluster was deleted. CI remains
digest-pinned to PostgreSQL 18.4, so the local 14.21 pass does not claim that the hosted
18.4 job has run.

Browser evidence covers desktop Chromium at 1440×900 and 1920×1080, mobile Chromium at
390×844, reduced-motion desktop/mobile behavior, Firefox desktop, and Playwright WebKit
desktop/mobile smoke. The larger responsive suite continues to cover 320×800, 360×800,
390×844, 430×932, 768×1024, 1024×768, 1440×900, and 1920×1080 with no horizontal overflow.
Playwright WebKit is not branded Safari or physical Apple hardware.

Authentication/signup/login/logout, same-origin credentialed API transport, safe internal
return routes, Discover and explainable recommendations, owner-scoped Cellar memories,
two-user privacy isolation, private query-cache clearing, Taste Profile/Taste Atlas, 404,
and error recovery remain covered. The dependency pass does not change route URLs, API
envelopes, signed-session behavior, query ownership, or schema/migration contracts.

## Build and immutable assets

All final artifacts remain within the existing budgets:

| Asset graph | Raw bytes | Gzip bytes | Maximum |
| --- | ---: | ---: | ---: |
| Principal initial JavaScript | 242,970 | 76,809 | 82,000 gzip |
| Shared CSS | 147,472 | 25,362 | 28,000 gzip |
| Homepage route | 28,111 | 9,960 | 12,000 gzip |
| Discover route | 15,962 | 5,490 | 8,000 gzip |
| Wine Detail route | 8,497 | 3,011 | 6,000 gzip |
| Cellar route | 28,293 | 9,051 | 12,000 gzip |
| Profile route | 10,135 | 3,686 | 6,000 gzip |
| Lazy WebGL graph | 907,605 | 246,633 | 930,000 raw / 255,000 gzip |

Discover, Wine Detail, Cellar, Profile, Login, Signup, demo Cellar, and demo Taste Atlas
remain isolated from the Home-only WebGL graph, GSAP, and Lenis. Approved cinematic media,
posters, fonts, model, and label checksums did not change.

Retained Prompt 09A evidence is under
[`docs/screenshots/prompt-09a/`](../screenshots/prompt-09a/): desktop and mobile hero after
the CLS fix, forced WebGL-ready hero, reduced-motion hero, Discover, Cellar memory editor,
active Taste Profile, error-boundary recovery, and the honest 404. The private-note field
was cleared before capture and all users/accounts are disposable fixtures.

## Remaining Prompt 10 boundaries

Only hosted or human-hardware work remains:

1. run and record GitHub-hosted CI on the release commit;
2. link the intended Vercel project without changing the reviewed application contract;
3. provision Preview and Production `SECRET_KEY`, `DATABASE_URL`, and exact HTTPS
   `FRONTEND_ORIGINS` without exposing them to the client;
4. provision the production database with least privilege, backups, restore validation,
   migration execution, and rollback evidence;
5. verify the versioned production Flask entrypoint and same-origin `/api` rewrite through
   the actual Vercel edge/runtime topology;
6. validate real HTTPS cookies, origin/CORS/PNA behavior, private cache headers, security
   headers, rate limiting, logs, error redaction, and owner isolation on the public domain;
7. record Vercel build/runtime logs, monitoring, rollback, and recovery behavior;
8. repeat public-domain browser journeys and native-GPU WebGL timing; and
9. complete physical Safari/iPhone plus available VoiceOver/NVDA/JAWS, keyboard, 200% zoom,
   video-contrast, and rapid-flash review.

Until those checks pass, describe this repository as a **locally verified release
candidate**, not production-deployed or recruiter-ready.
