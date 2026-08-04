# Prompt 09 — Security and Dependency Audit

## Verdict and scope

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`.

The repository is **not cleared for a public deployment in its current dependency state**.
No critical advisory was reported, but the pinned Python runtime contains known
vulnerabilities and the frontend lockfile retains high-severity advisory paths. The
required remediation crosses Flask-CORS, Vite, React Router, and related compatibility
boundaries, so upgrades must be made in a separate implementation pass and followed by the
full backend, frontend, browser, PostgreSQL, migration, and production-topology gates.

The dependency scanners were run without auto-fixes or package upgrades. Prompt 09 did add
and test the private-response cache headers identified during review, but did not change
dependency versions, production configuration, secrets, or infrastructure, and did not
deploy.

## Evidence and method

The following labels are used throughout:

- **Automated** means a local scanner or focused regression command produced the stated
  result.
- **Manual** means the current source/configuration was inspected for reachability and
  compensating controls. It is not a penetration test or proof that an advisory is harmless.
- **Previously accepted baseline** means a result retained from the accepted Prompt 08
  verification and reproduced where stated below.

| Check | Classification | Result |
| --- | --- | --- |
| `pip-audit 2.10.1` against `backend/requirements.txt` | Automated, isolated Python 3.12.12 | Failed as expected: 7 records in 3 packages. |
| `bandit 1.8.6 -r backend/app` | Automated, isolated Python 3.12.12 | 3 low-severity/medium-confidence B105 findings; 0 medium, 0 high. |
| `npm audit --json` with an isolated npm cache | Automated | Failed as expected: 10 package entries — 1 low, 5 moderate, 4 high, 0 critical. |
| `npm audit --json` with the existing default cache | Automated diagnostic | 30 affected package entries — 4 low, 9 moderate, 17 high, 0 critical. The 20 extra entries are dependent/meta-vulnerability propagation paths, not 20 additional independent advisories. |
| High-confidence secret patterns in tracked plus untracked Prompt 09 files | Automated | No private-key headers or recognized AWS, GitHub, Slack, OpenAI, Google, or Stripe token forms found. |
| High-confidence secret patterns in `frontend/dist` | Automated | No matches in the generated client snapshot. |
| Credential-bearing URL scan | Automated | Four intentional loopback/example locations: `.github/workflows/ci.yml`, `backend/.env.example`, `backend/app/config.py`, and `backend/tests/test_migrations.py`; no production host or credential was found. |
| Localhost/reference URL scan | Automated | Only documented examples, defaults, tests, and prior local-verification documentation; no localhost string in `frontend/dist`. |
| Focused backend security regressions | Automated | 48 passed in 3.31 seconds. |
| Focused frontend auth/transport/return-route regressions | Automated | 3 files and 34 tests passed. |
| Auth, privacy, CORS, error, deployment, and dependency-path review | Manual | Findings and boundaries are recorded below. |

The isolated Python audit environment was
`/tmp/grapevyne-python-audit-prompt09.yJF2Dl`; the isolated npm audit cache was
`/tmp/grapevyne-npm-audit-prompt09.xZ5A2m`. Both are outside the repository and are not
deployment artifacts.

## Python dependency findings

The exact scanner output was:

```text
Found 7 known vulnerabilities in 3 packages
Name          Version ID              Fix Versions
------------- ------- --------------- ------------
flask         3.0.3   PYSEC-2026-2151 3.1.3
flask-cors    4.0.1   PYSEC-2024-71   4.0.2
flask-cors    4.0.1   PYSEC-2024-260  4.0.2
flask-cors    4.0.1   PYSEC-2026-1383 6.0.0
flask-cors    4.0.1   PYSEC-2026-1384 6.0.0
flask-cors    4.0.1   PYSEC-2026-1385 6.0.0
python-dotenv 1.0.1   PYSEC-2026-2270 1.2.2
```

`PYSEC-*` values are current PyPA advisory-index identifiers; the corresponding CVEs are
the canonical vulnerability identifiers. An earlier audit instruction abbreviated the
three Flask-CORS path records as `PYSEC-2024-1383/-1384/-1385`; `pip-audit 2.10.1` and the
current PyPA database return `PYSEC-2026-1383/-1384/-1385`. Their canonical CVEs remain
from 2024.

| Pin and advisory | Canonical record | Current reachability and mitigation | Required disposition |
| --- | --- | --- | --- |
| `Flask==3.0.3`, [`PYSEC-2026-2151`](https://github.com/pypa/advisory-database/blob/main/vulns/flask/PYSEC-2026-2151.yaml) | [`CVE-2026-27205` / `GHSA-68rp-wp8r-4726`](https://github.com/advisories/GHSA-68rp-wp8r-4726) | The issue concerns a missing `Vary: Cookie` for some session-access forms. Current auth reads use `session.get`, not membership-only access. Prompt 09 now applies and tests `Cache-Control: private, no-store` plus `Vary: Cookie` across auth, private Cellar, Taste Profile, and recommendation responses, including errors. This is a direct shared-cache mitigation but does not patch Flask itself. | Upgrade to **Flask 3.1.3 or newer** before public deployment and retest all session/cookie/error/cache contracts through the real edge path. |
| `Flask-Cors==4.0.1`, [`PYSEC-2024-71`](https://github.com/pypa/advisory-database/blob/main/vulns/flask-cors/PYSEC-2024-71.yaml) and duplicate `PYSEC-2024-260` | [`CVE-2024-6221` / `GHSA-hxwh-jpp2-84pm`](https://github.com/advisories/GHSA-hxwh-jpp2-84pm) | The affected default can authorize Private Network Access for an otherwise permitted origin. GrapeVyne limits credentialed CORS to exact origins, rejects wildcards, and prefers a same-origin `/api` rewrite. That limits who can receive approval but does not change the vulnerable dependency behavior. PyPA marks `PYSEC-2024-260` withdrawn as a duplicate; the scanner still reports both rows, so the seven-row total is retained exactly. | The narrow fix is 4.0.2, but the unified upgrade target is **Flask-CORS 6.0.0 or newer** because of the three path-matching CVEs below. Revalidate preflight and Private Network Access behavior. |
| `Flask-Cors==4.0.1`, [`PYSEC-2026-1383`](https://github.com/pypa/advisory-database/blob/main/vulns/flask-cors/PYSEC-2026-1383.yaml) | [`CVE-2024-6866` / `GHSA-43qf-4rqw-9q2g`](https://github.com/advisories/GHSA-43qf-4rqw-9q2g) | Case-insensitive resource-path matching can apply a policy to the wrong path. This app configures one broad `/api/*` CORS policy with one exact origin set, rather than different permissive/restrictive policies, and Flask routes are case-sensitive. That substantially reduces the identified policy-confusion path but is not a package fix. | Upgrade to **Flask-CORS 6.0.0 or newer** and rerun mixed-case negative tests. |
| `Flask-Cors==4.0.1`, [`PYSEC-2026-1384`](https://github.com/pypa/advisory-database/blob/main/vulns/flask-cors/PYSEC-2026-1384.yaml) | [`CVE-2024-6839` / `GHSA-7rxf-gvfg-47g4`](https://github.com/advisories/GHSA-7rxf-gvfg-47g4) | Regex-priority behavior matters most when several resources have different CORS policies. GrapeVyne has one resource policy, one exact allowlist, no wildcard, and a separate unsafe-method Origin/Fetch-Metadata check. The risky multi-policy configuration was not found. | Upgrade to **Flask-CORS 6.0.0 or newer** and keep one unambiguous API policy. |
| `Flask-Cors==4.0.1`, [`PYSEC-2026-1385`](https://github.com/pypa/advisory-database/blob/main/vulns/flask-cors/PYSEC-2026-1385.yaml) | [`CVE-2024-6844` / `GHSA-8vgw-p6qm-5gr7`](https://github.com/advisories/GHSA-8vgw-p6qm-5gr7) | `+` path normalization can select an unexpected resource policy. The same single-policy/exact-origin controls reduce differential-policy reachability; they do not remove the flawed matcher. | Upgrade to **Flask-CORS 6.0.0 or newer** and add encoded/`+` path negatives. |
| `python-dotenv==1.0.1`, [`PYSEC-2026-2270`](https://github.com/pypa/advisory-database/blob/main/vulns/python-dotenv/PYSEC-2026-2270.yaml) | [`CVE-2026-28684` / `GHSA-mf9w-mj56-hr94`](https://github.com/advisories/GHSA-mf9w-mj56-hr94) | The vulnerable file-rewrite path is `set_key()`/`unset_key()` following a symlink. Repository application code imports and calls only `load_dotenv()`; no request or CLI path calls either vulnerable writer. This makes the reported overwrite path unreachable in the reviewed application flow, although a future local tooling use could reintroduce it. | Upgrade to **python-dotenv 1.2.2 or newer** before public deployment and retain the read-only runtime usage. |

The CORS controls are compensating controls, not authorization and not reasons to suppress
the advisories. Owner-filtered database queries and the signed session remain the private
data boundary.

## Frontend dependency findings

The reproducible isolated-cache baseline is **10 affected package entries: 1 low, 5
moderate, 4 high, 0 critical**. `npm audit` exited 1. The entries and installed paths are:

| Audit entry | Severity | Dependency path / reviewed surface |
| --- | --- | --- |
| `@babel/core@7.29.0` | Low | Transitive through `@vitejs/plugin-react`; build-time source-map processing. [`GHSA-4x5r-pxfx-6jf8`](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8). |
| `@react-three/drei@9.114.3` | Moderate | Direct runtime dependency; inherits the `uuid` advisory. Application source does not directly import `uuid` or invoke UUID v3/v5/v6 buffer APIs. |
| `brace-expansion@1.1.14` | High | Transitive through `minimatch`/ESLint; local/CI lint tooling, not emitted application code. [`GHSA-3jxr-9vmj-r5cp`](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg). |
| `esbuild@0.21.5` | Moderate | Transitive through Vite; the affected development server must not be internet-exposed. [`GHSA-67mh-4wv8-2f99`](https://github.com/advisories/GHSA-67mh-4wv8-2f99). |
| `js-yaml@4.1.1` | High | Transitive through ESLint configuration loading; reviewed workflow supplies tracked configuration rather than public YAML. [`GHSA-h67p-54hq-rp68`](https://github.com/advisories/GHSA-h67p-54hq-rp68), [`GHSA-52cp-r559-cp3m`](https://github.com/advisories/GHSA-52cp-r559-cp3m). |
| `postcss@8.5.10` | High | Transitive through Vite; build-time CSS/source-map processing. The public app does not accept CSS uploads, but CI/build input integrity still matters. [`GHSA-6g55-p6wh-862q`](https://github.com/advisories/GHSA-6g55-p6wh-862q), [`GHSA-r28c-9q8g-f849`](https://github.com/advisories/GHSA-r28c-9q8g-f849). |
| `react-router@6.30.3` | Moderate | Runtime via `react-router-dom`; open-redirect and hydration paths. GrapeVyne's `isSafeInternalReturnTo` rejects protocol-relative URLs, backslashes, CR, and LF, and focused tests pass. The app is a client-rendered Vite SPA, not a React Router SSR hydration application. These controls reduce the reviewed reachability but do not patch the library. [`GHSA-2j2x-hqr9-3h42`](https://github.com/advisories/GHSA-2j2x-hqr9-3h42), [`GHSA-wrjc-x8rr-h8h6`](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [`GHSA-337j-9hxr-rhxg`](https://github.com/advisories/GHSA-337j-9hxr-rhxg). |
| `react-router-dom@6.30.3` | Moderate | Direct runtime dependency; same return-route mitigation, with no general permission to navigate to untrusted external state. [`GHSA-jjmj-jmhj-qwj2`](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2). |
| `uuid@9.0.1` | Moderate | Transitive through Drei; affected caller-controlled output-buffer APIs are not used directly by application source. [`GHSA-w5hq-g745-h8pq`](https://github.com/advisories/GHSA-w5hq-g745-h8pq). |
| `vite@5.4.21` | High | Direct build/development dependency; not a server shipped as the production application. The Vercel build still executes this toolchain, and a developer must not expose `vite dev` to an untrusted network. [`GHSA-4w7w-66w2-5vf9`](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [`GHSA-v6wh-96g9-6wx3`](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [`GHSA-fx2h-pf6j-xcff`](https://github.com/advisories/GHSA-fx2h-pf6j-xcff). |

The existing default npm cache returned 30 entries because it also materialized dependent
packages whose `via` chains terminate in the primary findings above (for example ESLint and
its plugins inheriting `brace-expansion`/`js-yaml`, and Vite consumers inheriting Vite).
That result is retained as a diagnostic because both commands failed, but it is not counted
as 30 independent vulnerabilities and does not replace the isolated 10-entry baseline.

No `npm audit fix --force` was run. The complete remediation path crosses at least React
Router 6 to 7 (the current advisory path points to 7.18.0 or newer) and Vite 5 to a current
8.x line, plus compatible React plugin, Vitest, Drei/UUID, ESLint, TypeScript-ESLint,
PostCSS, Babel, and lockfile resolution. Those upgrades can affect navigation semantics,
test transforms, build output, WebGL behavior, and CI; they require an intentional matrix
rather than a forced lockfile rewrite.

## Bandit and secret-scan results

Bandit scanned 3,962 lines under `backend/app`, skipped no files, and reported exactly:

| Location | Finding | Assessment |
| --- | --- | --- |
| `backend/app/config.py:207` | B105, `testing-secret-key` | False positive: deterministic `TestingConfig` value. Production rejects this and other placeholder markers at startup. |
| `backend/app/utils/validation.py:67` | B105, `Password is required.` | False positive: user-facing signup validation text, not a credential. |
| `backend/app/utils/validation.py:97` | B105, `Password is required.` | False positive: user-facing login validation text, not a credential. |

All three are low severity and medium confidence. There were **0 medium-severity, 0
high-severity, and 0 high-confidence findings**. No `# nosec` suppression was added.

The high-confidence scan covered the union of `git ls-files` and
`git ls-files --others --exclude-standard`, so the uncommitted Prompt 09 workflow, tests,
runner, and documents were included before commit. It and the generated-client scan found
no recognized token or private-key form. The credential-URL check found only the documented
local PostgreSQL default in `backend/.env.example` and `backend/app/config.py`, the explicit
loopback-only CI service credentials in `.github/workflows/ci.yml`, and the intentionally
unused offline-render fixture in `backend/tests/test_migrations.py`. Other localhost or
loopback matches are development origins, documentation, or tests. None appeared in
`frontend/dist`.

This is a targeted pattern scan, not full secret-history scanning. Ignored local `.env`
files were intentionally not opened or reported, commit history was not scanned, and no
Vercel environment values were available for inspection. Before deployment, provision
secrets through the platform, verify no secret uses a `VITE_*` prefix, scan Git history with
the organization's approved secret scanner, and rotate any value whose provenance is
uncertain. Production currently fails closed for a missing/placeholder `SECRET_KEY`, but it
does **not** fail closed for a missing `DATABASE_URL`; the platform must provide a real
production database URL rather than falling back to the unusable localhost default.

## Authentication and session review

### Automated evidence

- The focused backend set passed 48 tests covering auth, production session configuration,
  CORS/origin behavior, owner isolation, standard envelopes, rollback, and detail-free error
  logging.
- The focused frontend set passed 34 tests covering credential inclusion, auth lifecycle,
  private-cache removal, and safe internal return destinations.
- Passwords are stored through Werkzeug's password-hash helpers; plaintext password fields
  are neither serialized by `User.to_dict()` nor stored in browser auth state.

### Manual findings

- Flask's signed cookie stores only the server-selected `user_id` application identity (and
  Flask's internal permanence marker). Signup/login clear the previous session before
  writing a new identity; logout and missing-user cleanup clear it.
- Production requires a non-placeholder signing secret, an exact HTTPS frontend origin,
  `Secure`, `HttpOnly`, `SameSite=Lax`, fixed expiry, enabled origin checks, and disabled
  debug/testing. Proxy headers are trusted only by explicit opt-in.
- The browser always sends `credentials: include`; no password, session cookie, bearer token,
  user object, or authorization grant is stored in local storage. Cross-tab storage fallback
  contains only a short-lived action/sequence/source notification and triggers server
  revalidation.
- Login uses one `invalid_credentials` response for unknown email and wrong password.
  Signup deliberately returns `email_already_exists`, which permits account enumeration.
- No rate limiter, login throttling/lockout, MFA, email verification, password reset,
  centralized session revocation, or server-side session store is present. A copied signed
  cookie remains valid until fixed expiry or secret rotation. These are explicit public-auth
  risks; rate limiting and an account-enumeration decision are required before open signup
  is exposed broadly.

## Privacy and authorization review

### Automated evidence

- Owner-isolation tests use independent clients and prove cross-owner private Cellar GET,
  PATCH, and DELETE return the same 404 response as a nonexistent entry.
- Backend query/service tests cover `user_id` filtering and prevent client-supplied ownership
  fields from becoming authorization.
- Frontend auth tests cover canceling/removing all `['private', userId, ...]` queries and
  private mutations on logout or identity change.
- Taste Profile and personalized recommendation tests cover `private, no-store`,
  `Vary: Cookie`, narrow owner projections, and omission of free-form memory text.

### Manual findings

- Private ownership is derived from the signed session on every Cellar endpoint. The
  expected-user request header is a stale-session precondition, not authority.
- Profile and personalized recommendation calculations are per request, owner-scoped, and
  not shared server caches. Their projections omit free-form notes, memory title, location,
  opened-with text, database row IDs, and user identity.
- Public search/detail and demo routes are separate from private query keys. The browser
  removes prior-owner private cache state before accepting another identity.
- Prompt 09 closes the application-level cache-policy gap: auth, private Cellar, Profile,
  and recommendation responses explicitly emit `Cache-Control: private, no-store` and
  `Vary: Cookie`, and successful plus error paths are covered. The policy still needs to be
  verified through the real Vercel/CDN path after the Flask upgrade; no edge behavior is
  inferred from local Flask tests.
- No deployed analytics, log drain, database access policy, backup policy, data-retention
  rule, account deletion flow, or privacy notice was available to verify. Application-level
  owner filtering does not substitute for those operational controls.

## CORS and CSRF review

### Automated evidence

The focused suite passed exact trusted-origin credentialed CORS, untrusted-origin denial,
cross-site Fetch Metadata rejection, trusted-only preflight, wildcard/malformed-origin
startup failure, safe GET behavior, and canonical default-port handling.

### Manual findings

- CORS applies only to `/api/*`, reflects only a canonical exact allowlist, enables
  credentials, disables wildcard sending, and adds `Vary: Origin` through Flask-CORS.
- Production accepts only environment-provided HTTPS origins. A workspace-local
  `vercel.json` routes same-origin `/api/:path*` to the backend service, which is the
  preferred browser topology and limits the need for cross-origin access. That adapter and
  `backend/main.py` are excluded through `.git/info/exclude`; they are not a versioned
  deployment guarantee and must be reviewed/provisioned through the actual deployment
  workflow.
- Production separately rejects unsafe `/api/` methods when `Sec-Fetch-Site` is explicitly
  `cross-site` or a present `Origin` is malformed/untrusted. Requests without browser origin
  metadata remain accepted for non-browser clients by design. There is no synchronizer CSRF
  token; the defense relies on SameSite cookies, exact origins, Fetch Metadata, and
  owner-scoped authorization.
- The five Flask-CORS scanner rows remain real dependency blockers even though the single
  broad policy and exact allowlist reduce the reviewed exploit paths. After upgrading, test
  PNA preflight, case variants, encoded/`+` paths, and every supported preview/production
  origin without introducing a wildcard.

## Error-handling and platform review

### Automated evidence

Focused tests passed the stable success/error envelopes, 404/405/413 normalization,
database rollback, generic 500 bodies, and logs that contain exception class names without
the injected private marker.

### Manual findings

- SQLAlchemy failures roll back, log only the exception class, and return a generic
  `database_error`. Unexpected production failures likewise log the class and return a
  generic `internal_server_error`; provider failures map to bounded 503/504 messages.
- Development deliberately re-raises unexpected errors while debug is enabled. Production
  policy cannot be overridden to enable debug/testing, so a production traceback should not
  reach the API response through this handler.
- HTTP exceptions use Werkzeug's controlled description in the standard envelope. Route
  validation uses bounded, non-reflective messages for security-sensitive parameters.
- The repository defines no comprehensive response-header policy for CSP, HSTS,
  `X-Content-Type-Options`, frame restrictions, `Referrer-Policy`, or `Permissions-Policy`.
  Platform defaults were not assumed. Define and browser-test an explicit policy, allowing
  only the media, font, WebGL, and API origins the cinematic application actually needs.
- No deployed Vercel logs, firewall, WAF/rate-limit policy, TLS/domain behavior, environment
  variables, database, or cache behavior was available. This was source/config review, not
  a production security test.
- The local Vercel service adapter and production Flask entrypoint are Git-excluded. A
  Git-connected deployment cannot assume those local-only files exist; deployment topology
  and configuration provenance require an explicit, reviewable decision.

## Public-deployment blockers and required retest

Public deployment remains blocked until all of the following are complete:

1. Upgrade and pin Flask to at least 3.1.3, Flask-CORS to at least 6.0.0, and
   python-dotenv to at least 1.2.2; rerun `pip-audit`, Bandit, Pytest, migration, live
   PostgreSQL, cookie, CORS, PNA, and private-cache tests.
2. Resolve the npm advisory paths through compatible parent-package upgrades. At minimum,
   validate the React Router 7.18+ and current Vite 8.x migration paths plus Drei/UUID and
   the Babel/PostCSS/ESLint/Vitest graph. Rerun isolated-cache `npm audit`, lint, typecheck,
   Vitest, production build, bundle budgets, Playwright across supported browsers, WebGL,
   reduced motion, accessibility, and navigation/open-redirect negatives.
3. Retain the tested Flask private/non-cacheable policy for every authenticated or
   personalized response, configure the corresponding edge behavior, and verify successful
   and error responses through the real deployment URL.
4. Provision a strong `SECRET_KEY`, real `DATABASE_URL`, and exact HTTPS
   `FRONTEND_ORIGINS`; confirm no secret is exposed through `VITE_*`, generated JavaScript,
   logs, screenshots, or deployment output.
5. Add or explicitly approve production controls for auth rate limiting, account
   enumeration, security headers, log redaction/retention, database least privilege,
   backup/restore, and session-secret rotation.
6. Make the intended Vercel service/entrypoint configuration reviewable and reproducible,
   or prove the equivalent project-level configuration. Verify the same-origin rewrite and
   production Flask mode from the real deployment artifact.

Zero critical advisories does not waive these blockers. A private, access-controlled preview
can be evaluated separately, but it must not be represented as a production security pass.

## Commands executed

The material audit commands were:

```bash
PYENV_VERSION=3.12.12 python -m venv "$audit_env"
"$audit_env/bin/python" -m pip install --quiet pip-audit==2.10.1 bandit==1.8.6
"$audit_env/bin/pip-audit" -r backend/requirements.txt
"$audit_env/bin/bandit" -r backend/app

audit_cache="$(mktemp -d /tmp/grapevyne-npm-audit-prompt09.XXXXXX)"
npm_config_cache="$audit_cache" npm audit --json
npm audit --json
npm ls --depth=0
npm ls react-router react-router-dom vite esbuild postcss uuid \
  @react-three/drei @babel/core eslint js-yaml brace-expansion minimatch --all

{ git ls-files -z; git ls-files --others --exclude-standard -z; } | \
  sort -zu | xargs -0 rg -I -l -P \
  '(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{32,}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,}|pk_live_[0-9A-Za-z]{20,}|sk_live_[0-9A-Za-z]{20,})'
rg -I -l -P \
  '(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{32,}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,}|pk_live_[0-9A-Za-z]{20,}|sk_live_[0-9A-Za-z]{20,})' \
  frontend/dist
{ git ls-files -z; git ls-files --others --exclude-standard -z; } | \
  sort -zu | xargs -0 rg -I --with-filename -n -P \
  '(?i)(?:postgres(?:ql)?(?:\+[a-z0-9_-]+)?|mysql|mongodb(?:\+srv)?|redis|https?):\/\/[^\s/:@]+:[^\s/@]+@(?:localhost|127\.0\.0\.1)(?::[0-9]+)?[^\s]*'
{ git ls-files -z; git ls-files --others --exclude-standard -z; } | \
  sort -zu | xargs -0 rg -I --with-filename -n \
  '(?:localhost|127\.0\.0\.1)'
rg -I --with-filename -n '(?:localhost|127\.0\.0\.1)' frontend/dist

backend/.venv/bin/python -m pytest -q \
  backend/tests/test_auth.py \
  backend/tests/test_session_security.py \
  backend/tests/test_cors_origin.py \
  backend/tests/test_cellar_ownership.py \
  backend/tests/test_backend_quality.py
npx vitest run \
  src/api/__tests__/client.test.ts \
  src/features/auth/AuthContext.test.tsx \
  src/lib/returnTo.test.ts
```

The Pytest command was executed from `backend/` as `.venv/bin/python -m pytest ...`; the
Vitest and npm commands were executed from `frontend/`. Read-only source inspection also
used `rg`, `sed`, `git ls-files`, `git status`, and current PyPA advisory records. No
dependency remediation, push, or deployment command was executed; the single Prompt 09
quality commit was created only after the full gate set completed.
