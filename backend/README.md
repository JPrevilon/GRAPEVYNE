# GrapeVyne Backend

Flask API foundation for GrapeVyne.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask --app app init-db
flask --app app seed-demo-data
flask --app app run --debug
```

`init-db` runs `flask db upgrade` against the tracked history. It is an explicit command;
creating or serving the Flask app does not mutate the schema. For a fresh database,
existing unversioned database, production rollout, current-revision check, and rollback,
follow [`docs/v2/08-migration-and-rollback.md`](../docs/v2/08-migration-and-rollback.md).

The health check is available at:

```text
GET http://localhost:5000/api/health
```

## Auth Endpoints

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Authentication uses Flask's signed, HTTP-only session cookie. Frontend requests
should include credentials.

## Private Cellar and Taste Profile Endpoints

```text
GET    /api/cellar
POST   /api/cellar
GET    /api/cellar/:entryId
PATCH  /api/cellar/:entryId
DELETE /api/cellar/:entryId
GET    /api/profile/taste
```

All require the signed Flask session and derive ownership from it. The six nullable memory
columns are `memory_title`, `tasted_on`, `location`, `pairing`, `opened_with`, and
`would_buy_again`. The profile endpoint is read-only, accepts no query parameters, returns
`Cache-Control: private, no-store` and `Vary: Cookie`, and omits row IDs and free-form
memory fields. See [`docs/v2/08-taste-profile-api-contract.md`](../docs/v2/08-taste-profile-api-contract.md).

## Tests

Install the separately pinned development dependencies and run the isolated
temporary-SQLite suite:

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pip check
python -m pytest
```

The tests create their own temporary database and do not use `DATABASE_URL`.

## Session and browser security configuration

Development uses an HTTP-compatible `session` cookie with `HttpOnly` and
`SameSite=Lax`; `Secure` is false by default. The session is permanent for
`SESSION_LIFETIME_DAYS` (seven by default), and
`SESSION_REFRESH_EACH_REQUEST=false` keeps that expiry fixed from login or
signup. Read-only requests therefore do not reissue an older session cookie
after logout.
`SESSION_COOKIE_DOMAIN` is unset by default so the cookie remains host-only.

Production (`FLASK_ENV=production`) fails during app creation unless
`SECRET_KEY` is set to a non-placeholder value and `FRONTEND_ORIGINS` contains
at least one exact origin. Production always requires `Secure`, `HttpOnly`,
`SameSite=Lax`, fixed session expiry, and origin enforcement. Set
`FRONTEND_ORIGINS` to a comma-separated list of exact `https://` application
origins; wildcard origins are rejected. Unsafe browser requests with an untrusted `Origin` or
`Sec-Fetch-Site: cross-site` receive a structured 403 response. Requests sent
through the same-origin `/api` proxy and non-browser requests without browser
origin metadata remain supported.

`TRUST_PROXY_HEADERS` is false by default. Enable it only when the process is
behind a trusted reverse proxy that controls the forwarded headers.
