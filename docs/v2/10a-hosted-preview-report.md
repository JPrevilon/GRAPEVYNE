# Prompt 10A hosted Preview report

## 1. Verdict and provenance

**PASS — the Prompt 10A hosted Preview and production-readiness engineering gates are complete.** The pull request remains open and unmerged, the deployment target is Preview, the database is Preview-only, and no Production environment, deployment, alias, custom domain, DNS record, migration, or release tag was created or changed.

| Item | Verified value |
| --- | --- |
| Accepted Prompt 09A base | `98202a81bb46ea314fce40e9a1b45b1e8c60199d` |
| Deployed and fully hosted-tested source | `1f9df90ce8a42de144fb163e122fdbe34a360ac3` |
| Branch | `feat/grapevyne-cinematic-v2` |
| Git remote | `https://github.com/JPrevilon/GRAPEVYNE.git` |
| GitHub identity | Authenticated as repository owner `JPrevilon`; credentials were not printed |
| Source branch push | Normal non-force push; the remote branch equaled the deployed source SHA before the later docs/evidence commit |
| Pull request | [#1](https://github.com/JPrevilon/GRAPEVYNE/pull/1), `OPEN`, `CLEAN`, `feat/grapevyne-cinematic-v2` → `main`, not merged |
| Immutable Preview | [deployment `dpl_8oLz2sKPWVfuPKMaNKVTY6i9CKsd`](https://grapevyne-55il05mr2-joshuaprevilon13-7141s-projects.vercel.app) |
| Stable branch Preview | [open GRAPEVYNE Preview](https://grapevyne-joshuaprevilon13-7141-joshuaprevilon13-7141s-projects.vercel.app) |

The immutable Preview was built from `1f9df90…`. The evidence/README commit that contains this report is intentionally a docs-only successor and does not change the deployed application artifact. Its SHA and final CI run are recorded in the external Prompt 10A handoff because a commit cannot embed its own SHA.

## 2. GitHub-hosted CI

The source deployment is backed by [Actions run 30850571969](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969), which completed successfully for exact SHA `1f9df90…`.

| Job | Job ID | Result | Duration |
| --- | ---: | --- | ---: |
| Frontend quality | [91809302307](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969/job/91809302307) | Passed | 194 s |
| Backend quality | [91809302356](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969/job/91809302356) | Passed | 185 s |
| PostgreSQL migration contract | [91809302384](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969/job/91809302384) | Passed | 56 s |
| Playwright Chromium | [91810128780](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969/job/91810128780) | Passed | 176 s |
| Playwright Firefox and WebKit smoke | [91810128796](https://github.com/JPrevilon/GRAPEVYNE/actions/runs/30850571969/job/91810128796) | Passed | 142 s |
| GitGuardian Security Checks | GitGuardian check | Passed | 1 s |

CI results were: 46 frontend test files / 353 tests; 3 foundational, 30 cinematic, and 10 WebGL/model/label/font asset checks; Vite 6.4.3 with 2,313 modules; 8 bundle budgets and route-isolation checks; 310 backend tests passed with 3 intentional opt-in skips; 15 Flask routes; PostgreSQL upgrade/downgrade/data-preservation/re-upgrade checks; 34 Chromium tests passed with 92 intentional project skips; and 5 Firefox/WebKit smoke tests passed with 4 intentional project skips. Failed-test artifact upload steps were correctly skipped because the browser jobs passed.

All preceding Prompt 10A source-fix runs also completed successfully: `30817481919`, `30844023811`, `30845416888`, `30846975619`, `30847965495`, and `30849124234`. Hosted-only failures were fixed with normal follow-up commits; no history was rewritten and no test was disabled.

## 3. Vercel account, project, and link

| Item | Verified value |
| --- | --- |
| Vercel CLI | `54.14.0` under Node `20.19.6` |
| Authenticated account | `joshuaprevilon13-7141` |
| Team | `joshuaprevilon13-7141's projects` |
| Team slug / ID | `joshuaprevilon13-7141s-projects` / `team_gFud94J3abXKcmNuleLCm9vh` |
| Project name / ID | `grapevyne` / `prj_Vi4q9Hmh5YQlk7402IohuOJlbTKQ` |
| Project root | Repository root (`.`) |
| Local link | `.vercel/project.json`, ignored and not committed |
| Git-provider link | Project API reports no provider repository link; deployment used the normal authenticated CLI with exact Git SHA/branch/repository metadata |
| Target / status | `preview` / `READY` |
| Deployment created | 2026-08-03 16:38:14 EDT |
| Function | `api/index`, 11.64 MB, `iad1` |

The CLI reused the verified project rather than creating a duplicate. `.vercel/repo.json` is absent. The automatically assigned branch Preview is not a Production or custom-domain alias. The existing older Production deployment predates Prompt 10A and was not altered.

The hosted build ran in `iad1` with 2 cores and 8 GB RAM, uploaded 1,631 files, used the prebuilt artifact, and completed `READY`. The root Node `20.x` engine correctly overrode the project's older `24.x` default setting. The successful build used `npm ci`, Vite 6.4.3, Python 3.12 selected by `.python-version`, and the root runtime requirements bridge. A local build initially retried because the operator's global npm cache pointed at an unavailable external volume and `uv` was not on the isolated PATH; a writable temporary cache/PATH resolved both without repository or hosted-CI changes.

## 4. One-origin deployment architecture and routes

```text
Browser HTTPS origin
  ├── / and explicit product routes -> Vite static output (frontend/dist)
  ├── /build/*                      -> content-hashed CDN assets
  ├── /assets/*, /images/*          -> local revalidated assets
  └── /api and /api/*               -> api/index.py -> existing Flask factory
                                               └── Preview-only Neon PostgreSQL
```

The exact API rewrites precede the SPA allowlist:

```text
/api       -> /api/index
/api/(.*)  -> /api/index
```

The original path and browser query string reach Flask; no synthetic `path` query parameter is introduced. Explicit SPA direct-load routes are `/`, `/discover`, `/wines/:path*`, `/demo/:path*`, `/login`, `/signup`, `/cellar`, `/profile`, and the deliberate client 404. Static filesystem paths are not swallowed by the SPA fallback. Full routing rationale is in [10a-deployment-topology.md](10a-deployment-topology.md).

## 5. Preview database and migrations

| Item | Verified value |
| --- | --- |
| Provider | Neon through Vercel Marketplace |
| Plan | `free_v3` (user-approved free plan) |
| Resource | `grapevyne-preview`, `store_pYtzK86BZZtHp99h` |
| Installation | `icfg_82NT5QPxaiv9d78VpP7yRzMO` |
| Region | `iad1` |
| Scope | Connected to Vercel Preview only; no Production data or variables |
| Runtime connection | Provider pooled `DATABASE_URL` |
| Migration connection | Provider direct `DATABASE_URL_UNPOOLED` |
| Neon branch | Initial root/default branch `main` |
| PostgreSQL database | `neondb` |
| Identity marker | Redacted non-secret Preview marker, stored as the dedicated PostgreSQL database comment |

The database name was queried directly without printing the connection, and Neon documents that a newly created project's root/default branch is [`main`](https://api-docs.neon.tech/reference/listprojectbranches). The resource's branch/database is isolated inside `grapevyne-preview`; credential-bearing connection values and provider IDs are intentionally omitted. The request runtime requires encrypted PostgreSQL and uses SQLAlchemy `NullPool`. The direct connection is used only for explicit migration, identity, and guarded cleanup commands.

Alembic revisions `0001` and `0002` upgraded successfully. `flask db current` reported `0002_prompt08_cellar_memories (head)` and `flask db check` reported no new upgrade operations. Hosted health independently read the database comment and returned `databaseVerified: true` with environment `preview` and the expected non-secret marker. Final guarded cleanup reported `users=0 cellar_entries=0`; no disposable hosted account remained.

## 6. Preview environment contract

The following encrypted variables exist for **Preview only**:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
DEPLOYMENT_DATABASE_SENTINEL
FLASK_ENV
SECRET_KEY
SESSION_COOKIE_SECURE
SESSION_LIFETIME_DAYS
TRUST_PROXY_HEADERS
NEON_PROJECT_ID
PGDATABASE
PGHOST
PGHOST_UNPOOLED
PGPASSWORD
PGUSER
POSTGRES_DATABASE
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_PRISMA_URL
POSTGRES_URL
POSTGRES_URL_NO_SSL
POSTGRES_URL_NON_POOLING
POSTGRES_USER
```

`FRONTEND_ORIGINS` is not set because validated Vercel system metadata supplies the exact same-origin Preview hosts; it remains an optional additive application contract. Vercel system names such as `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_DEPLOYMENT_ID`, and `VERCEL_REGION` are platform-owned. Production has no application/provider variables added by Prompt 10A. No values are recorded in source, reports, screenshots, or command transcripts. See [10a-preview-environment-contract.md](10a-preview-environment-contract.md).

## 7. Hosted HTTPS, origin, cache, and header results

| Contract | Hosted result |
| --- | --- |
| Session cookie | `Set-Cookie` present; stored cookie `HttpOnly`, `Secure`, `SameSite=Lax`; authenticated refresh persisted; logout cleared the session |
| Exact origin | Current immutable Preview origin accepted; untrusted Vercel and arbitrary external origins rejected |
| Unsafe cross-site request | `403 csrf_origin_rejected`, no `Access-Control-Allow-Origin` |
| Credentialed API CORS | Exact Preview origin plus `Access-Control-Allow-Credentials: true`; never wildcard |
| Private API cache | `Cache-Control: private, no-store`; `Vary: Cookie` and/or `Origin` as appropriate; CDN `MISS` |
| HTML/unhashed assets | `public,max-age=0,must-revalidate` |
| Hashed build assets | `public,max-age=31536000,immutable` |
| Preview indexing | `X-Robots-Tag: noindex,nofollow` |
| Security headers | Enforced self-only CSP, `nosniff`, strict referrer/permissions policy, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and same-origin resource policy |
| HTTPS platform header | HSTS `max-age=63072000; includeSubDomains; preload` |

Vercel adds `Access-Control-Allow-Origin: *` to public static root/assets; those resources contain no credentials or private data. Credentialed/private Flask APIs were separately measured and never returned wildcard CORS. Required same-origin scripts, styles, fonts, images, posters, video, models, labels, and API connections loaded without CSP violations.

Browser-facing observations included: `/api/health` `200`, exact-origin CORS, `Vary: Origin`, CDN `MISS`; `/api/auth/me` signed out `401` with the standard envelope, exact credentialed CORS, private/no-store; allowed-origin logout preflight `200`; untrusted cross-site logout `403` with no ACAO; root and static assets `200` with the intended cache classes. Hashed and unhashed test assets were CDN `HIT` on the measured warm requests.

## 8. Hosted API and end-to-end results

Hosted API statuses matched the preserved contract:

- health `200`; signed-out `/api/auth/me` `401`;
- search and explainable recommendations `200`;
- signup `201`; login/logout `200`;
- Cellar create `201`, duplicate `409`, and read/update/delete `200`;
- Taste Profile `200` through empty, limited, and active states;
- cross-site unsafe write `403`.

Hosted browser suites all passed:

| Suite | Result | Coverage note |
| --- | --- | --- |
| Primary hosted Preview | 17 passed; 34 intentional project skips | 15 desktop Chromium, 1 mobile Chromium, 1 reduced-motion Chromium execution |
| Firefox/WebKit smoke | 5 passed; 4 intentional project skips | 2 Firefox, 2 desktop WebKit, 1 mobile WebKit |
| Accessibility | 1 orchestration test passed | 12 Axe WCAG A/AA state scans |
| Evidence | 1 orchestration test passed | 18 hosted PNG captures |
| Performance | 5 samples passed | Five isolated Chromium observations |

Coverage included all nine chapters, direct routes, navigation/back-forward, catalog and recommendation modes, wine detail, exact return path, signup/login/refresh/logout, save/duplicate/edit/favorite/rating/status/delete, profile transitions, two-account owner isolation, public read-only demos, deliberate 404 and safe error presentation, mobile, reduced motion, live-capability and forced software-WebGL paths, console/CSP checks, private-cache isolation, and same-origin networking.

The ad hoc outer shell used to collect the final logs attempted to assign zsh's read-only `status` variable after every suite had already passed, so that wrapper process exited 1. This did not affect any tracked runner or test result. Its transient non-environment protection bypass was audited and revoked; the project retains only the single Vercel environment-owned automation bypass that the platform requires.

## 9. Accessibility, browsers, and performance

The 12 Axe state scans covered homepage, initial/results Discover, wine detail, login, signup, demo Cellar, empty profile, populated Cellar, memory editor, active profile, and the mobile drawer. Automated keyboard/focus, semantic alternatives, visible error states, reduced motion, and no-horizontal-overflow checks passed. Physical screen-reader review remains explicitly manual.

Verified browser/viewport conditions were Chromium `1440×900`, `1920×1080`, `390×844`, and `430×932`; desktop Firefox `1440×900`; desktop WebKit `1440×900`; mobile WebKit `390×844`; reduced-motion desktop and mobile; normal live-capability path; and forced software-renderer fallback. The headless performance host exposed only the accepted software-renderer fallback, so no hardware WebGL-ready timing is claimed.

Five hosted performance samples:

| Metric | Min | Median | Max |
| --- | ---: | ---: | ---: |
| LCP | 448 ms | 624 ms | 700 ms |
| CLS | 0.0013 | 0.0013 | 0.0089 |
| Hero semantic content | 294.5 ms | 321.4 ms | 508.6 ms |
| Requests | 19 | 22 | 22 |
| Transfer | 435,761 B | 2,517,244 B | 2,517,244 B |
| Longest application task | 0 ms | 0 ms | 0 ms |

The harness did not expose a trustworthy INP/interaction metric, so one is not fabricated; the hosted functional suite exercised the interactions. WebGL first-frame/import timings were correctly `null` under software fallback. CLS remained far below 0.10 and there was no recurring task above 200 ms.

First observation after an idle interval (a cold proxy, because platform cold state cannot be forced externally) and four warm observations were:

| Endpoint | First observation | Warm median | All statuses |
| --- | ---: | ---: | --- |
| `/api/health` | 295.8 ms | 190.2 ms | `200` |
| `/api/wines/search?query=steak` | 223.6 ms | 159.8 ms | `200` |

## 10. Network, assets, build/runtime logs, and security gates

All browser requests stayed on the verified Preview origin. The route checks covered HTML, content-hashed JS/CSS, local fonts, cinematic images/posters/video, the bottle model/label assets, and Flask API requests. There were no unexpected remote APIs, source-map disclosures, Vite overlays, required-resource failures, console errors, or CSP violations.

The final build log contained no error or secret. A 1,000-entry final runtime sample contained only informational/serverless events: 420 `200` responses, 560 expected anonymous `401` session probes, and 20 expected security-test `403` responses; there were zero errors, fatal entries, or `5xx` responses.

Security/regression results remained:

- npm: 0 low, high, or critical advisories; 2 previously accepted moderate React Router entries;
- Python: `pip check` passed, `pip-audit` 0 findings, Bandit 0 medium/high findings;
- secrets: GitGuardian passed; accepted reachable-history Gitleaks fixtures remained adjudicated false positives; built frontend had 0 secret findings;
- assets: all 3 foundational, 30 cinematic, and 10 WebGL/model/label/font hashes unchanged;
- privacy: owner isolation, private/no-store caching, account-switch cleanup, and Preview disposable-account cleanup passed.

## 11. Files and dependency changes

Against accepted Prompt 09A commit `98202a81…`, the exact tracked path set is:

```text
M .gitignore
A .python-version
A .vercelignore
M README.md
A api/index.py
M backend/.env.example
M backend/app/cli.py
M backend/app/config.py
A backend/app/deployment.py
M backend/app/routes/health.py
A backend/tests/test_deployment_config.py
A backend/tests/test_deployment_contract.py
A backend/tests/test_deployment_database_safety.py
A docs/v2/10a-deployment-topology.md
A docs/v2/10a-hosted-preview-report.md
A docs/v2/10a-preview-environment-contract.md
A docs/v2/10a-preview-manual-review-checklist.md
M frontend/e2e/evidence.spec.ts
M frontend/e2e/helpers/browser.ts
A frontend/e2e/helpers/hosted.ts
A frontend/e2e/hosted-evidence.spec.ts
A frontend/e2e/hosted-preview.spec.ts
M frontend/e2e/performance.spec.ts
M frontend/e2e/prompt09a-evidence.spec.ts
M frontend/e2e/public-journeys.spec.ts
M frontend/index.html
M frontend/package.json
M frontend/playwright.config.ts
A frontend/public/apple-touch-icon.png
A frontend/scripts/hosted-preview-contract.mjs
A frontend/scripts/hosted-preview-contract.test.mjs
A frontend/scripts/run-hosted-e2e.mjs
A frontend/src/components/routing/RouteMetadata.test.tsx
M frontend/src/components/routing/RouteMetadata.tsx
M frontend/src/experience/webgl/BottleModel.test.tsx
M frontend/src/experience/webgl/BottleModel.tsx
M frontend/vite.config.ts
A package.json
A requirements.txt
A vercel.json
A docs/screenshots/prompt-10a/01-hero-desktop-1440x900.png
A docs/screenshots/prompt-10a/02-hero-desktop-1920x1080.png
A docs/screenshots/prompt-10a/03-hero-mobile-390x844.png
A docs/screenshots/prompt-10a/04-discovery-desktop-1440x900.png
A docs/screenshots/prompt-10a/05-explainable-recommendation-desktop-1440x900.png
A docs/screenshots/prompt-10a/06-wine-detail-desktop-1440x900.png
A docs/screenshots/prompt-10a/07-demo-cellar-desktop-1440x900.png
A docs/screenshots/prompt-10a/08-authenticated-cellar-desktop-1440x900.png
A docs/screenshots/prompt-10a/09-tasting-memory-editor-empty-note-desktop-1440x900.png
A docs/screenshots/prompt-10a/10-active-taste-profile-desktop-1440x900.png
A docs/screenshots/prompt-10a/11-taste-atlas-mobile-390x844.png
A docs/screenshots/prompt-10a/12-login-empty-form-mobile-390x844.png
A docs/screenshots/prompt-10a/13-signup-empty-form-desktop-1440x900.png
A docs/screenshots/prompt-10a/14-homepage-memory-chapter-desktop-1440x900.png
A docs/screenshots/prompt-10a/15-homepage-finale-chapter-desktop-1440x900.png
A docs/screenshots/prompt-10a/16-reduced-motion-hero-desktop-1440x900.png
A docs/screenshots/prompt-10a/17-webgl-fallback-hero-desktop-1440x900.png
A docs/screenshots/prompt-10a/18-intentional-404-desktop-1440x900.png
```

No file was moved or deleted. No application dependency version or lockfile changed. `frontend/package.json` gained hosted scripts only. The root package selects Node 20 and delegates the deterministic frontend install/build to the committed frontend lockfile. Root `requirements.txt` exactly mirrors the existing runtime pins in `backend/requirements.txt`; a contract test prevents drift. Generated Vercel `pyproject.toml`/`uv.lock`, `.vercel/`, environment files, auth state, test results, and build output are not committed.

README now presents the V2 product, “From Vine to Memory” concept, protected Preview link, Vite/React/TypeScript + Flask/PostgreSQL architecture, deterministic recommendation logic, private Cellar and memories, Taste Profile/Atlas, WebGL/cinematic and accessibility behavior, security/session model, tests, local setup/migrations, named environment contract, Preview/Production boundary, hosted screenshots, and the honest six-record demonstration-catalog limitation.

## 12. Screenshot evidence

All captures came from the immutable hosted Preview, use disposable data, and contain no password, token, cookie, database URL, or private note.

```text
docs/screenshots/prompt-10a/01-hero-desktop-1440x900.png
docs/screenshots/prompt-10a/02-hero-desktop-1920x1080.png
docs/screenshots/prompt-10a/03-hero-mobile-390x844.png
docs/screenshots/prompt-10a/04-discovery-desktop-1440x900.png
docs/screenshots/prompt-10a/05-explainable-recommendation-desktop-1440x900.png
docs/screenshots/prompt-10a/06-wine-detail-desktop-1440x900.png
docs/screenshots/prompt-10a/07-demo-cellar-desktop-1440x900.png
docs/screenshots/prompt-10a/08-authenticated-cellar-desktop-1440x900.png
docs/screenshots/prompt-10a/09-tasting-memory-editor-empty-note-desktop-1440x900.png
docs/screenshots/prompt-10a/10-active-taste-profile-desktop-1440x900.png
docs/screenshots/prompt-10a/11-taste-atlas-mobile-390x844.png
docs/screenshots/prompt-10a/12-login-empty-form-mobile-390x844.png
docs/screenshots/prompt-10a/13-signup-empty-form-desktop-1440x900.png
docs/screenshots/prompt-10a/14-homepage-memory-chapter-desktop-1440x900.png
docs/screenshots/prompt-10a/15-homepage-finale-chapter-desktop-1440x900.png
docs/screenshots/prompt-10a/16-reduced-motion-hero-desktop-1440x900.png
docs/screenshots/prompt-10a/17-webgl-fallback-hero-desktop-1440x900.png
docs/screenshots/prompt-10a/18-intentional-404-desktop-1440x900.png
```

Dimensions are 14 captures at `1440×900`, 3 at `390×844`, and 1 at `1920×1080`.

## 13. Prompt 10A commits

```text
dea9a41fc7295da58c4881bc6a3ddd8717e5f20c chore(deploy): prepare hosted GRAPEVYNE preview
a1eb136f7788bbb4baf10faacef023d2ba2470b6 fix(deploy): support Neon preview identity guard
22806cd5f70971b3ac4a6f0c9ee81d7f89492780 fix(deploy): package Python preview dependencies
fdc29c5de31d0af3fa60bf99ec77c1f7f94de787 fix(deploy): route Preview API to Flask
f0d4bc91b9a18bc67b3ef0db9718425d08fcc446 fix(test): follow Vercel bypass cookie redirect
f66de75e163a9ab5410258569824bc4f2e2c6875 fix(test): isolate hosted Preview instrumentation
1f9df90ce8a42de144fb163e122fdbe34a360ac3 fix(test): frame hosted Preview evidence
```

The final docs/evidence commit is listed in the external handoff with the final branch status and its GitHub-hosted CI run.

## 14. Remaining gates and risks

The Preview is protected by Vercel Deployment Protection, so a reviewer may need to sign in to the verified project/team. The residual accepted npm moderates remain documented. The automated host could not produce hardware WebGL performance timing or a trustworthy INP value. Physical iPhone Safari, physical Mac Safari, and VoiceOver/another physical screen reader remain unclaimed manual gates in [10a-preview-manual-review-checklist.md](10a-preview-manual-review-checklist.md).

Prompt 10B still owns PR merge, Production database provisioning/confirmation, Production environment values, Production migration, Production deployment/promotion, custom domain/DNS, indexability switch, final recruiter URL, and the `v2.0.0-recruiter` tag. None began in Prompt 10A.

## 15. Commands executed (values and credentials redacted)

The normalized complete command families used for the phase are recorded below; repeated equivalent inspections and test reruns are consolidated. Secrets, cookies, connection strings, tokens, and provider values are replaced by descriptive placeholders.

```bash
git status --short --branch
git show --stat --oneline 98202a81bb46ea314fce40e9a1b45b1e8c60199d
git log --oneline --decorate origin/main..HEAD
git remote -v
git diff --check
git diff --name-status 98202a81bb46ea314fce40e9a1b45b1e8c60199d..HEAD
git add <PROMPT_10A_PATHS>
git commit -m "chore(deploy): prepare hosted GRAPEVYNE preview"
git commit -m <FOCUSED_HOSTED_FIX_MESSAGE>
git push origin feat/grapevyne-cinematic-v2

gh auth status
gh pr create --base main --head feat/grapevyne-cinematic-v2
gh pr view 1 --json number,url,state,mergeStateStatus,headRefOid,statusCheckRollup
gh run view <RUN_ID> --json status,conclusion,headSha,jobs,url
gh run watch <RUN_ID> --exit-status

vercel --version
vercel whoami
vercel teams ls
vercel project ls
vercel link --project grapevyne --scope joshuaprevilon13-7141s-projects
vercel integration installations
vercel integration list grapevyne --format=json
vercel env ls preview
vercel env ls production
vercel env add <NAME> preview                 # value supplied securely
vercel pull --environment=preview             # ignored temporary destination
vercel build
vercel deploy --prebuilt --yes                # Preview only; never --prod
vercel inspect <IMMUTABLE_PREVIEW_URL>
vercel inspect <IMMUTABLE_PREVIEW_URL> --logs
vercel logs <IMMUTABLE_PREVIEW_URL>
vercel curl /<PATH> --deployment <IMMUTABLE_PREVIEW_URL>

cd backend
DATABASE_URL=<REDACTED_DIRECT_PREVIEW_URL> python -m flask --app app db upgrade
DATABASE_URL=<REDACTED_DIRECT_PREVIEW_URL> python -m flask --app app db current
DATABASE_URL=<REDACTED_DIRECT_PREVIEW_URL> python -m flask --app app db check
psql <REDACTED_DIRECT_PREVIEW_URL>              # guarded database-comment identity operation
DATABASE_URL=<REDACTED_DIRECT_PREVIEW_URL> python -m flask --app app cleanup-preview-e2e --sentinel <NONSECRET_PREVIEW_MARKER>

npm --prefix frontend ci
npm --prefix frontend run verify:assets
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run verify:bundle
npm --prefix frontend run test:e2e:chromium
npm --prefix frontend run test:e2e:cross-browser
npm --prefix frontend run test:a11y
npm --prefix frontend run test:visual
npm --prefix frontend run test:performance
npm --prefix frontend audit
npm --prefix frontend exec -- vitest run scripts/hosted-preview-contract.test.mjs
PLAYWRIGHT_BASE_URL=<VERIFIED_PREVIEW_URL> npm --prefix frontend run test:e2e:hosted-preview
PLAYWRIGHT_BASE_URL=<VERIFIED_PREVIEW_URL> npm --prefix frontend run test:e2e:hosted-preview:cross-browser
PLAYWRIGHT_BASE_URL=<VERIFIED_PREVIEW_URL> npm --prefix frontend run test:a11y:hosted-preview
PLAYWRIGHT_BASE_URL=<VERIFIED_PREVIEW_URL> npm --prefix frontend run test:performance:hosted-preview
PLAYWRIGHT_BASE_URL=<VERIFIED_PREVIEW_URL> npm --prefix frontend run test:e2e:hosted-preview -- e2e/hosted-evidence.spec.ts --project=desktop-chromium --workers=1

cd backend
python -m pip check
python -m compileall app tests
python -m pytest
python -m pip_audit
python -m bandit -q --severity-level medium -r app
python -m flask --app app routes
actionlint
gitleaks detect <REDACTED_SCAN_OPTIONS>
sips -g pixelWidth -g pixelHeight docs/screenshots/prompt-10a/*.png
rg <REDACTED_SECRET_PATTERNS> README.md docs/v2/10a-*.md
```

Final guarded cleanup, environment inspection, deployment inspection, runtime-log inspection, PR inspection, and Git status were repeated after evidence capture. No Production-mutating command was run.
