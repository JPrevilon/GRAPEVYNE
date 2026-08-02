# Prompt 06 — Authentication and Session Security

## Security verdict

Authentication remains Flask's signed session cookie with `user_id` as its only application identity key (Flask also records its internal `_permanent` marker). No JWT, bearer token, third-party identity service, or browser-stored authentication state was introduced. The browser cannot choose its owner ID: every private query and mutation is authorized again by Flask against the signed session.

Production configuration now fails closed for a missing/placeholder secret, an absent exact frontend origin, a non-HTTPS production origin, a non-secure cookie policy, disabled origin enforcement, or attempts to turn debug/testing on through config overrides. Development and testing remain explicit and deterministic.

## Configuration modes

| Policy | Development | Testing | Production |
| --- | --- | --- | --- |
| Selection | `FLASK_ENV=development` or default | Explicit `create_app("testing")` | `FLASK_ENV=production` or explicit `create_app("production")` |
| Secret | `SECRET_KEY`, otherwise development-only fallback | Fixed deterministic test secret | Required non-placeholder `SECRET_KEY`; startup fails early otherwise |
| Database | `DATABASE_URL`, otherwise local PostgreSQL default | `TEST_DATABASE_URL`, otherwise in-memory SQLite; tests override with temporary SQLite | `DATABASE_URL` should identify the provisioned production database |
| Trusted origins | `FRONTEND_ORIGINS`/legacy singular value, otherwise localhost and `127.0.0.1` on ports 5173 and 4173 | Deterministic local origin set; ambient origin variables ignored | At least one exact environment-provided HTTPS origin required |
| Cookie `Secure` | Configurable, false by default for local HTTP | Always false | Always true, even if environment or override requests false |
| Cookie `HttpOnly` | true | true | true |
| Cookie `SameSite` | `Lax` | `Lax` | `Lax` |
| Lifetime/refresh | Permanent, seven days by default, fixed expiry | Permanent seven-day fixed expiry | Permanent configurable-day fixed expiry |
| Origin enforcement | Off by default | Off unless a security test explicitly enables it | Always on |
| Forwarded headers | Disabled unless explicitly enabled | Ambient opt-in ignored; tests can explicitly override | Disabled unless explicitly enabled behind a trusted proxy |

Testing deliberately ignores ambient cookie name, domain, secure, lifetime, origin, and proxy variables. This prevents a developer shell or CI environment from changing the security assertions.

## Environment variables

| Variable | Purpose and rules |
| --- | --- |
| `FLASK_ENV` | One of `development`, `testing`, or `production`; unknown values fail clearly. |
| `SECRET_KEY` | Signs Flask sessions. Production requires a real non-placeholder value; it must never be committed. |
| `DATABASE_URL` | SQLAlchemy production/development connection URL. The repository example is descriptive local development configuration, not a deployment credential. |
| `TEST_DATABASE_URL` | Optional test database override; the tracked suite normally creates isolated temporary SQLite databases. |
| `FRONTEND_ORIGINS` | Preferred comma-separated exact browser origins. Wildcards, credentials, paths, queries, fragments, and unsupported schemes are rejected. Every production value must use HTTPS. |
| `FRONTEND_ORIGIN` | Supported legacy singular fallback when `FRONTEND_ORIGINS` is absent. New configuration should use the plural form. |
| `SESSION_COOKIE_NAME` | Cookie name; default `session`. |
| `SESSION_COOKIE_DOMAIN` | Optional cookie domain; empty/unset means host-only and is preferred unless multiple trusted hostnames truly require sharing. |
| `SESSION_COOKIE_SECURE` | Development Boolean override. Production forces true; testing forces false. Invalid Boolean values fail clearly. |
| `SESSION_LIFETIME_DAYS` | Positive integer permanent-session lifetime; default seven days. |
| `TRUST_PROXY_HEADERS` | Boolean opt-in for exactly one trusted proxy hop. False by default. |
| `VITE_API_BASE_URL` | Optional frontend development override; `/api` is the default and expected production value. It never carries credentials. |

`SESSION_REFRESH_EACH_REQUEST` is not an environment knob: application policy fixes it to `false` in every mode so ordinary reads cannot rotate the cookie.

## Cookie contract

Signup and login clear any prior session, set `session.permanent = true`, and store only the server-selected user ID as application identity; Flask manages the corresponding internal `_permanent` marker. With the default policy, their cookie has a seven-day expiry. `GET /api/auth/me` does not refresh or reissue an unchanged cookie because `SESSION_REFRESH_EACH_REQUEST` is fixed false. Logout clears the cookie.

The verified flags are:

- local development: host-only `session`, `HttpOnly`, `SameSite=Lax`, no `Secure` on intentional local HTTP;
- testing: deterministic host-only `session`, `HttpOnly`, `SameSite=Lax`, no `Secure`;
- production: host-only unless a domain is intentionally configured, `Secure`, `HttpOnly`, `SameSite=Lax`.

`HttpOnly` was confirmed in the local browser because the session cookie was not visible through `document.cookie`. Cookie values were not printed, captured, or committed. `Secure=false` is accepted only for local HTTP; production policy cannot be overridden to emit a non-secure session cookie.

Fixed expiry also prevents an older in-flight read response from refreshing and restoring a cookie after logout. Secret rotation invalidates existing signed sessions; there is no server-side session store or token denylist in this phase.

## Trusted origins, CORS, and CSRF defense

Origin parsing canonicalizes scheme/host/default port, removes duplicates, and rejects wildcard values, path-bearing URLs, embedded credentials, queries, fragments, or non-HTTP(S) schemes. Credentialed CORS is configured only for the resulting exact set. The server never combines `Access-Control-Allow-Origin: *` with credentials.

In production, a request under `/api/` using `POST`, `PUT`, `PATCH`, or `DELETE` is rejected with status 403 and this normal error envelope when either condition is true:

```json
{
  "error": {
    "code": "csrf_origin_rejected",
    "message": "This request did not come from a trusted application origin."
  }
}
```

- `Sec-Fetch-Site` explicitly says `cross-site`; or
- an `Origin` header is present but malformed or not in the exact trusted-origin set.

Same-origin proxy requests are accepted. Non-browser integration clients without browser origin metadata are also accepted; browser cross-site requests normally provide `Origin` and/or Fetch Metadata. This is an origin/Fetch-Metadata defense for the signed SameSite cookie topology, not a partially installed CSRF-token system. Safe GET requests are unaffected. Preflight approves only an exact trusted origin.

`ProxyFix` is absent by default. When `TRUST_PROXY_HEADERS=true` is explicitly accepted in a trusted deployment, it trusts one hop for `X-Forwarded-For`, protocol, host, and port. The application must not enable this when arbitrary clients can supply those headers directly.

## Browser authentication lifecycle

`AuthProvider` performs a cancellable `GET /api/auth/me` at app boot. Protected routes render a session-check loading state until that call resolves, so `/cellar` and `/profile` cannot issue private API calls before auth boot completes.

The state transitions are:

1. `200` current-user response: normalize the user, clear stale auth error, enter ready/authenticated.
2. `401 authentication_required`: remove the prior identity and its private cache, then enter ready/signed-out.
3. Network/service error: retain an explicit auth-error state; protected content stays hidden behind a retryable session-verification panel.
4. Aborted/superseded request: no user-facing failure and no stale state write.

Only one auth request is active. A later signup, login, logout, or refresh aborts its predecessor, and operation IDs prevent late responses from taking control. A remote-tab signal that arrives while an auth operation is active is coalesced and revalidated after the operation finishes. Focus and visible-document events re-check `/auth/me` whenever no newer auth operation is already doing so.

Successful signup/login/logout publishes an auth-change notification with `BroadcastChannel`; a short-lived `localStorage` event is only a fallback notification transport. Neither mechanism stores a user, password, cookie, token, or authorization decision. Tabs receiving the signal revalidate against Flask before changing identity.

Every auth operation clears visible notifications before revalidation begins. Known-user protected content remains mounted so private drafts survive a same-user focus check, but it is hidden and inert until the check resolves. Public wine detail also disables private writes and withholds private save feedback unless auth state is `ready`.

## Return-route and open-redirect policy

Protected routes and wine-detail saves preserve the complete internal destination as `pathname + search + hash`. Login/signup switch links preserve the same navigation state. After success, navigation uses `replace` to the sanitized value.

A return path is accepted only when it:

- begins with exactly an internal `/` path rather than `//`;
- contains no backslash, carriage return, or newline;
- is either a string or a location-like object converted to path/search/hash.

Unsafe, malformed, and external destinations fall back to `/cellar`. Browser verification preserved a complete wine-detail query/hash destination and rejected an injected `https://attacker.example.test/...` destination without leaving the application origin.

## Private data and mutation safety

Every private query key is rooted at `['private', userId, ...]`. A changed or cleared identity cancels/removes all private queries and removes private mutations. Public search/detail caches are separate and may survive logout because they contain no account data.

Cellar list and mutation responses are normalized and checked so `entry.userId` must equal the active signed-in user. An owner mismatch is treated as `session_identity_mismatch`, not displayed or cached, and triggers `/auth/me` revalidation. The duplicate-save `error.details.entry` is also accepted only when its owner matches the active identity.

Cellar update and delete are server-confirmed rather than optimistic: no success UI or cache change occurs until Flask returns success. The browser adds `X-Grapevyne-Expected-User-Id` to save, PATCH, and DELETE requests. This value is never authorization; Flask compares it with the signed-session identity before any mutation and returns `session_identity_changed` on a stale cross-tab expectation. Matching server-confirmed cache changes are retained even if a focus check starts while the response is pending, while stale private toasts/editor feedback are suppressed. Save, PATCH, DELETE, and logout failures leave prior authenticated/private state intact and render an honest error when the same verified session remains active. A 401 or identity mismatch from a private operation re-checks the session before redirecting or clearing state.

## Security regression coverage

The tracked backend suite includes 19 session/configuration tests and 11 CORS/origin tests. It proves development/testing/production cookie flags, fixed expiry, auth cookie writes, production missing/placeholder-secret failure, required HTTPS origins, non-bypassable production policy, explicit-only `ProxyFix`, invalid configuration failure, exact trusted-origin CORS, structured origin rejection, Fetch Metadata rejection, safe GET behavior, preflight behavior, wildcard/malformed origin startup failure, and canonical origin normalization.

Auth and ownership tests additionally prove generic invalid credentials, duplicate-account behavior, deleted-user session cleanup, independent clients, rejected unknown auth fields, all protected cellar endpoints, forged ownership rejection, same-response cross-owner 404s, and zero-write rejection for malformed, out-of-range, overlong, or stale expected-user preconditions.

## Remaining deployment work and risks

- No deployment, Vercel rewrite, production domain, production database, secret provisioning, or HTTPS smoke test was performed in Prompt 06.
- Deployment must route same-origin `/api/*` to Flask, set a strong `SECRET_KEY`, set exact HTTPS `FRONTEND_ORIGINS`, provision `DATABASE_URL`, and decide whether a host-only cookie is sufficient.
- Flask's signed cookie is stateless. Logout clears the browser cookie, but there is no centralized session revocation list for a copied cookie before its fixed expiry.
- Rate limiting, MFA, email verification, password reset, account deletion, security headers at the edge, and secret rotation procedures are outside this phase.
- CORS is not authorization. The owner-scoped database filters remain the security boundary for cellar records.
- If the backend is exposed for direct cross-origin browser access instead of the preferred rewrite, every legitimate exact origin and cookie behavior must be retested; wildcard relaxation is not permitted.
