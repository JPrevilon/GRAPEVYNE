# Prompt 10A deployment topology

Status: deployment-preparation architecture. Hosted identifiers and measured results are recorded in `10a-hosted-preview-report.md` after the Preview is verified.

## Decision

GRAPEVYNE uses one stable Vercel project and one browser-facing HTTPS origin:

```text
Browser
  ├── / and product routes -> Vite static output (frontend/dist)
  ├── /build/*             -> content-hashed frontend bundles
  ├── /assets/*, /images/* -> local un-hashed product assets
  └── /api/*               -> api/index.py -> backend/app Flask factory
                                  └── dedicated Preview PostgreSQL
```

The Vercel project root is the repository root. Experimental `services`, `experimentalServices`, legacy `builds`, and legacy `routes` are not used. The repository’s earlier ignored `vercel.json` used an experimental two-service design and was replaced rather than adopted.

This follows Vercel’s current stable [Vite SPA](https://vercel.com/docs/frameworks/frontend/vite), [Flask](https://vercel.com/docs/frameworks/backend/flask), [Python runtime](https://vercel.com/docs/functions/runtimes/python), and [project configuration](https://vercel.com/docs/project-configuration/vercel-json) contracts.

## Build and runtime

- Root `package.json` selects the supported Node `20.x` line. GitHub CI remains pinned to Node `20.19.6`; Vercel rolls supported minor and patch updates.
- Root `.python-version` selects the supported Python `3.12` line. GitHub CI remains pinned to Python `3.12.12`; the deployed patch is taken from the build log.
- `npm --prefix frontend ci` installs exactly the committed frontend lockfile.
- `npm --prefix frontend run build` type-checks and builds Vite.
- `frontend/dist` is the only public build output.
- `requirements.txt` bridges to the exact runtime-only pins in `backend/requirements.txt`.
- `api/index.py` prepends `backend` to `sys.path` to preserve the real application’s existing `from app...` import contract, then exports exactly one production-mode Flask app.
- The adapter does not run a server, migration, schema creation, or seed on import.
- `includeFiles` makes `backend/app/**` explicit because the adapter adjusts `sys.path`; tests, migrations, documentation, evidence, local environments, and frontend files are excluded from the Function bundle.

## Route mapping

| Browser path | Destination | Contract |
| --- | --- | --- |
| `/` | Vite `index.html` | Cinematic homepage |
| `/discover` | Vite `index.html` | React direct load |
| `/wines/:path*` | Vite `index.html` | React wine detail direct load |
| `/demo/:path*` | Vite `index.html` | Public demo direct load |
| `/login`, `/signup` | Vite `index.html` | Auth direct load |
| `/cellar`, `/profile` | Vite `index.html` | Protected direct load, then signed-session routing |
| `/an-intentional-404` | Vite `index.html` | Deliberate branded client 404 |
| `/api/*` | Native Flask Function routing | Full original path reaches Flask |
| `/build/*` | Static CDN file | Vite content hash; immutable cache |
| `/assets/*`, `/images/*`, `/favicon.svg` | Static CDN file | Local un-hashed asset; must revalidate |

The SPA rewrite is an explicit allowlist. It cannot swallow `/api`, JavaScript, CSS, fonts, video, posters, models, labels, images, or missing asset paths. Vercel’s filesystem handles real static files before rewrites.

## PostgreSQL and migrations

- Preview uses a dedicated PostgreSQL database or provider branch; it never uses SQLite or the Production database.
- The request-time `DATABASE_URL` is normalized to SQLAlchemy’s `postgresql+psycopg://` driver.
- Vercel production-mode startup rejects a missing or non-PostgreSQL `DATABASE_URL`.
- Vercel production-mode startup accepts only `VERCEL_ENV=preview|production` and requires a non-secret `DEPLOYMENT_DATABASE_SENTINEL` whose `grapevyne-preview-*` or `grapevyne-production-*` prefix matches that environment.
- PostgreSQL encryption is required. Secure provider modes (`require`, `verify-ca`, `verify-full`) are preserved; a missing mode is supplied through psycopg connection arguments.
- Vercel Functions use SQLAlchemy `NullPool`, avoiding a warm-instance application pool in front of a provider’s serverless pool.
- Preview migrations use the provider’s direct/unpooled connection when supplied. The operator temporarily maps that value to `DATABASE_URL` for explicit Alembic commands; request-time code never prefers the migration URL.
- Migration 0001 and 0002 are applied before the first Preview deployment. Migration never runs during import, build, or Function invocation.
- The dedicated Preview database receives the same marker through `ALTER DATABASE ... SET grapevyne.deployment_sentinel` over its direct connection. Hosted health queries `current_setting('grapevyne.deployment_sentinel', true)` and returns `503` without exposing database details when the value is absent, mismatched, or unavailable.
- Hosted-E2E cleanup is an explicit CLI operation guarded by the same Preview marker. It can remove only `e2e-%@example.test` users and their dependent Cellar entries; it never creates a public cleanup endpoint.

The Function region is selected only after the database region is known. No region is guessed in source configuration.

## Origin, session, and cache boundary

Configured `FRONTEND_ORIGINS` remains additive. When and only when `VERCEL=1`, the backend may add exact HTTPS origins derived from validated `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`. Commit and branch URLs must be hostname-only `*.vercel.app` values. No wildcard suffix matching is used, and an unrelated Vercel deployment is not trusted.

Hosted sessions retain `Secure`, `HttpOnly`, `SameSite=Lax`, fixed expiry, and same-origin browser requests. Flask remains authoritative for private `Cache-Control: private, no-store` and `Vary: Cookie` responses; Vercel configuration does not add an API cache rule.

The deployment adds a self-only CSP, clickjacking protection, MIME sniffing protection, a strict referrer policy, a bounded Permissions Policy, same-origin resource policy, and explicit Preview `noindex,nofollow`. HSTS is not hardcoded in the environment-agnostic repository rule; Vercel supplies HTTPS platform headers, and the Production policy is reviewed in Prompt 10B.

## Promotion boundary

Prompt 10A may create only Preview deployments. It does not merge the pull request, deploy or promote Production, assign a Production/custom domain, alter DNS, migrate Production, or create the release tag. Prompt 10B owns those actions after human review.
