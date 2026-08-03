# Prompt 10A Preview environment contract

This document records names and trust boundaries only. It intentionally contains no environment values, credentials, cookies, tokens, bypass secrets, or database URLs.

## Vercel Preview variables

| Name | Target | Sensitivity | Purpose |
| --- | --- | --- | --- |
| `FLASK_ENV` | Preview | Non-secret | Selects immutable production security policy for hosted Flask |
| `DATABASE_URL` | Preview | Secret | Dedicated pooled/serverless-safe Preview PostgreSQL connection |
| `DEPLOYMENT_DATABASE_SENTINEL` | Preview | Non-secret | Unique `grapevyne-preview-*` marker that must exactly match the Preview database custom setting |
| `SECRET_KEY` | Preview | Secret | Preview-only Flask session signing key |
| `FRONTEND_ORIGINS` | Preview | Non-secret | Optional additive exact HTTPS origin list |
| `SESSION_COOKIE_SECURE` | Preview | Non-secret | Documented as true; production policy also forces true |
| `SESSION_COOKIE_NAME` | Preview | Non-secret | Optional cookie-name override |
| `SESSION_COOKIE_DOMAIN` | Preview | Non-secret | Empty unless a reviewed shared cookie domain is required |
| `SESSION_LIFETIME_DAYS` | Preview | Non-secret | Fixed session lifetime |
| `TRUST_PROXY_HEADERS` | Preview | Non-secret | False unless a verified proxy requirement is documented |

Flask fixes `SESSION_COOKIE_HTTPONLY=true`, `SESSION_COOKIE_SAMESITE=Lax`, `SESSION_REFRESH_EACH_REQUEST=false`, `SQLALCHEMY_TRACK_MODIFICATIONS=false`, `TESTING=false`, and `DEBUG=false` in hosted production mode. These invariants are not loosened by environment values.

The provider may expose a separate direct/unpooled database variable. Its actual injected name is recorded in the hosted report after provisioning. It is used only for explicit Preview Alembic commands and is not selected by request-time application code.

## Vercel system metadata

The project enables Vercel’s automatically exposed system environment variables. Relevant non-secret names are:

```text
VERCEL
VERCEL_ENV
VERCEL_TARGET_ENV
VERCEL_URL
VERCEL_BRANCH_URL
VERCEL_PROJECT_PRODUCTION_URL
VERCEL_DEPLOYMENT_ID
VERCEL_REGION
```

The backend derives origins only when `VERCEL=1` and only after strict hostname validation. In that mode it also requires `VERCEL_ENV` to be exactly `preview` or `production`, validates the matching `DEPLOYMENT_DATABASE_SENTINEL` prefix, and exposes both values only as non-secret application configuration. The frontend build may use validated `VERCEL_URL` to make its already-local Open Graph image absolute; it does not expose server secrets.

## Hosted browser-test process variables

These names live only in the operator or CI process and are never committed to `.env` files or browser bundles:

| Name | Required | Purpose |
| --- | --- | --- |
| `PLAYWRIGHT_BASE_URL` | Yes | Exact commit-specific Vercel Preview origin |
| `GRAPEVYNE_PREVIEW_DATABASE_URL` | Yes | Direct encrypted Preview PostgreSQL URL used only by the guarded cleanup process |
| `GRAPEVYNE_PREVIEW_DATABASE_SENTINEL` | Yes | Non-secret marker expected from both hosted health and the cleanup connection |
| `GRAPEVYNE_E2E_MODE` | Runner-owned | Must equal `hosted-preview` after target verification |
| `GRAPEVYNE_HOSTED_PREVIEW_DEPLOYMENT_ID` | Runner-owned | Carries the inspected immutable Preview deployment ID into Playwright |
| `GRAPEVYNE_HOSTED_PREVIEW_STORAGE_STATE` | Runner-owned | Absolute path to an ephemeral mode-0600 protection-cookie state file |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Only if protected | Official Deployment Protection automation header value |

The hosted runner resolves the current full Git SHA, invokes `vercel inspect`, reads the authenticated deployment API metadata, requires a `READY` deployment whose target is `preview`, requires the inspected URL to equal `PLAYWRIGHT_BASE_URL`, and requires the deployment metadata to identify the current SHA. It then forces one Playwright worker. It cannot target Production in Prompt 10A.

When a protection bypass secret is present, the runner sends it only on one exact-origin `/api/health` request with redirects disabled. That preflight must attest the expected Preview database marker before any signup or mutation. The returned bypass cookie is narrowed to the verified deployment hostname and written to an ephemeral mode-0600 Playwright storage-state file. Playwright never receives the original bypass secret, database URL, Vercel token, provider credentials, or GitHub credentials; hosted traces are always disabled. The runner removes the state file in `finally` and runs the sentinel-guarded database cleanup both before and after Playwright, including after test failure.

## Separation rules

- Preview and Production must have different `SECRET_KEY` values.
- Preview and Production must have different PostgreSQL resources/branches and URLs.
- Prompt 10A does not set or migrate Production values.
- No backend-only variable has a `VITE_` prefix.
- `VITE_API_BASE_URL` remains an optional local-development override; hosted browser code uses relative `/api`.
- Values are added through stdin or the Vercel integration and are never printed in reports or command transcripts.
- `.env*`, `.vercel/`, Playwright auth state, database dumps, and credentials stay ignored.
- Hosted cleanup receives the direct database URL only in its trusted child-process environment; it is excluded from the Playwright child environment.

## Explicit Preview migration sequence

After securely pulling Preview variables into an ignored temporary environment, the operator:

1. selects the provider’s Preview direct/unpooled connection without printing it;
2. supplies that connection to the existing `DATABASE_URL` name for the migration process only;
3. runs `python -m flask --app app db upgrade` from `backend/`;
4. runs `python -m flask --app app db current` and verifies both tracked revisions are at head;
5. runs `python -m flask --app app db check`;
6. restores request-time use of the pooled Preview `DATABASE_URL`;
7. deploys Preview only after all migration checks pass.

## Preview database identity guard

Before deployment, export one unique non-secret marker with a `grapevyne-preview-` prefix as `DEPLOYMENT_DATABASE_SENTINEL` in the Vercel Preview environment. Install that exact marker in the dedicated Preview database using its direct/unpooled connection only:

```bash
psql "$GRAPEVYNE_PREVIEW_DIRECT_DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=sentinel="$DEPLOYMENT_DATABASE_SENTINEL" <<'SQL'
SELECT format(
  'ALTER DATABASE %I SET grapevyne.deployment_sentinel = %L',
  current_database(),
  :'sentinel'
) \gexec
SQL
```

`ALTER DATABASE ... SET grapevyne.deployment_sentinel` is a **Preview-only Prompt 10A operation**. Do not run it against Production, and do not reuse the Preview marker for Production. The setting applies to new database sessions, so close the setup connection before migration and health verification. Hosted `/api/health` fails closed with a standard `503` envelope unless PostgreSQL returns the exact configured marker; a verified response includes only the non-secret environment, marker, and `databaseVerified: true`.

After hosted evidence is complete, remove disposable hosted accounts with the same verified Preview connection:

```bash
cd backend
DATABASE_URL="$GRAPEVYNE_PREVIEW_DATABASE_URL" \
python -m flask --app app cleanup-preview-e2e \
  --sentinel "$DEPLOYMENT_DATABASE_SENTINEL"
```

The command refuses non-PostgreSQL or non-encrypted connections, malformed or non-Preview markers, and any database whose custom setting is absent or does not match exactly. It deletes only users matching `e2e-%@example.test` and their dependent Cellar entries, commits, verifies that none remain, and prints counts without identities or connection values.

Disposable hosted accounts remain in the dedicated Preview database only until evidence capture is complete. Because the product intentionally has no public account-deletion test endpoint, the guarded CLI cleanup removes those users through the dedicated Preview database rather than adding a Production-reachable bypass.
