# Prompt 06 — Live API Contract

## Contract verdict

The browser and Flask application now share one explicit contract: browser calls use relative same-origin `/api` URLs, every request includes cookies, Flask remains the authorization authority, and typed frontend normalizers adapt real Flask fields without changing the backend merely to suit the UI. The implementation keeps the accepted success envelope and nested error envelope:

```json
{ "data": {}, "message": "Optional success message" }
```

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Useful public message",
    "details": {}
  }
}
```

`message` and `error.details` are optional. Expected 400, 401, 403, 404, and 409 responses retain this shape; in production/non-debug mode, database and unexpected errors are mapped to generic structured 500 responses rather than exposing a Python traceback. Development debug mode deliberately re-raises unexpected exceptions for local diagnosis.

## Browser topology

```text
Local development
Browser http://127.0.0.1:5173
  -> relative /api/* with credentials: "include"
  -> Vite proxy (changeOrigin, no path rewrite)
  -> http://127.0.0.1:5000/api/*

Preferred production topology
Browser https://app.example.test
  -> same-origin /api/*
  -> deployment rewrite/proxy
  -> Flask /api/*
```

`frontend/src/api/client.ts` uses `VITE_API_BASE_URL` when explicitly configured and otherwise defaults to `/api`; trailing slashes are removed. `frontend/vite.config.ts` proxies `/api` to `http://127.0.0.1:5000` and preserves the request path, cookies, and normal HTTP methods. Production must add an infrastructure rewrite from the frontend origin to the Flask service while retaining `/api`; no Vercel rewrite or deployment was added in Prompt 06.

All frontend requests pass `credentials: "include"`. JSON request bodies receive `Content-Type: application/json` unless the caller already supplied a content type or is sending `FormData`. A failed fetch becomes `network_error`; an unreadable response becomes a separate `network_error`; an `AbortError` remains an abort and is not converted into a visible service failure.

## Endpoint inventory

The tables below describe the real routes. “Public” means the route does not require `session["user_id"]`; production origin validation still applies to unsafe methods.

### Health

| Endpoint | Auth | Request | Success | Errors | Ownership, validation, and cache |
| --- | --- | --- | --- | --- | --- |
| `GET /api/health` | Public | No accepted fields; request bodies and query values are not read. | `200` with `data.status = "ok"`, `data.service = "grapevyne-api"`, and `data.phase = "foundation"`. | Standard structured 500 only for an unexpected application failure. | Safe GET is not blocked by origin enforcement. Flask sets no endpoint-specific HTTP cache policy; the frontend health helper does not create private state. |

### Authentication

| Endpoint | Auth | Accepted request fields | Rejected or ignored fields | Success | Contract errors | Ownership and cache |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/auth/signup` | Public | JSON object containing `name`, `email`, `password`. Name is trimmed, email is trimmed/lowercased, password is used verbatim. | Every unknown field is rejected with `validation_error`; ownership or role fields are not accepted. Non-object or invalid JSON is `invalid_json`. | `201`; `data = { user, authenticated: true }`; message `Account created.`; starts a permanent signed session. | `400 invalid_json`; `400 validation_error`; `409 email_already_exists`; production `403 csrf_origin_rejected`. | The created user ID is server-generated. Auth state is held by `AuthProvider`, not a React Query public cache. Identity change clears every private query and mutation. |
| `POST /api/auth/login` | Public | JSON object containing `email`, `password`. Email is trimmed/lowercased. | Unknown fields rejected. Non-object or invalid JSON rejected. | `200`; `data = { user, authenticated: true }`; message `Signed in.`; replaces any prior session. | `400 invalid_json`; `400 validation_error`; `401 invalid_credentials`; production `403 csrf_origin_rejected`. Unknown email and wrong password deliberately use the same error. | The server derives identity from the matched user and writes only `session["user_id"]`. Successful identity change clears prior private caches. |
| `POST /api/auth/logout` | Public/idempotent | No body fields are read. | `200`; `data = { authenticated: false }`; message `Signed out.`; clears the server-signed browser session. | Production `403 csrf_origin_rejected`; structured 500 for unexpected failure. | A successful frontend logout removes identity-scoped query and mutation state. A failed request deliberately leaves the browser authenticated rather than claiming success. |
| `GET /api/auth/me` | Session required | No accepted fields. | `200`; `data = { user, authenticated: true }`. | `401 authentication_required` when missing, invalid, or deleted-user session; standard 500 errors. | The user comes only from signed `session["user_id"]`. Auth boot, focus/visibility revalidation, and cross-tab auth signals call this route directly and do not put the user in a public query key. |

The returned user object contains `id`, `name`, `email`, `createdAt`, and `updatedAt`; password and password-hash fields are never serialized.

Prompt 09 cache hardening adds `Cache-Control: private, no-store` and `Vary: Cookie` to every auth response, including validation/authentication errors. This response-header contract does not change any status code or JSON envelope.

Signup validation is exact:

- `name`: required non-empty text after trimming, maximum 120 characters;
- `email`: required syntactically valid text after normalization, maximum 255 characters;
- `password`: required text, 8–256 characters.

Login requires a valid email plus a non-empty password no longer than 256 characters. It does not impose the signup minimum on an existing password.

### Wine discovery

| Endpoint | Auth | Accepted request fields | Rejected or ignored fields | Success | Contract errors | Ownership, duplicate, and cache |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/wines/search?query=<query>` | Public | One `query` string; Flask trims surrounding whitespace. | Missing/whitespace-only query is rejected. More than 200 characters is rejected. Other query parameters are not read. | `200`; `data = { query, results, source }`. An honest empty result is `results: []`. | `400 missing_query`; `400 validation_error`; `503 wine_service_unavailable`; `504 wine_service_timeout`; generic `500 internal_server_error` for an unexpected provider bug. | No user data or duplicate semantics. Frontend key is `['public', 'wine-search', trimmedQuery]`, stale for five minutes. Superseded query functions receive React Query's `AbortSignal`. |
| `GET /api/wines/<externalWineId>` | Public | External provider ID in the path. Flask's path converter preserves encoded slashes. | No JSON fields; query values are not read. | `200`; `data = { wine, source }`. | `404 wine_not_found`; `503 wine_service_unavailable`; `504 wine_service_timeout`; generic structured 500 for unexpected failures. | Frontend key is `['public', 'wine', externalWineId]`, stale for five minutes. The real external ID is URL-encoded by the client; numeric local database IDs are not substituted. |

The current `WineService` source is `mock`: a local, static six-record catalog behind the real service abstraction. Search matches normalized terms against record metadata, pairings, tasting notes, structure, and occasion. This is not an external provider or an internet-wide catalog. The 503 and 504 mappings exist for real/injected service exception paths; the normal static implementation does not manufacture outages or timeouts.

Catalog responses include `externalWineId`, `source`, `name`, producer/location/vintage fields, description, image, average rating, price, and the available pairing/tasting/structure metadata. Frontend normalizers validate required fields and safely normalize supported backend aliases. Live discovery and wine detail never import or substitute the public demo fixture.

### Private cellar

Every valid cellar route requires an authenticated signed session. Missing authentication returns `401 authentication_required`. The server never accepts browser identity as authorization.

The frontend sends `X-Grapevyne-Expected-User-Id` on every cellar POST, PATCH, and DELETE as a non-authorizing consistency precondition. Flask still derives ownership only from the signed session. The header is optional for backward-compatible API clients; when supplied, it must contain ASCII digits for an integer from 1 through 2,147,483,647. Malformed or out-of-range values return `400 validation_error`, and a value that differs from the authenticated session returns `409 session_identity_changed` before payload parsing, record lookup, or mutation. This closes the cross-tab interval in which a browser may still render User A after the shared cookie has become User B.

| Endpoint | Accepted request fields | Rejected or ignored fields | Success | Contract errors | Ownership, duplicate, and cache |
| --- | --- | --- | --- | --- | --- |
| `GET /api/cellar` | None. | Body/query values are not read. | `200`; `data = { entries, count }`, newest save first. | `401 authentication_required`; standard structured 500/database errors. | Query is filtered by authenticated user ID. Frontend key is `['private', userId, 'cellar']`, `staleTime: 0`, `gcTime: 0`; response entries are checked against the active user before display. |
| `POST /api/cellar` | Exactly one of `externalWineId` or `wine`, plus optional `favorite`, `notes`, `occasion`, `status`, `userRating`; optional expected-user header described above. | Unknown outer/nested fields rejected. `user_id`, `userId`, `owner_id`, `ownerId`, `account_id`, and `accountId` receive explicit ownership-derived validation errors. | `201`; `data = { entry }`; message `Wine saved to cellar.` | `400 invalid_json`; `400 validation_error`; `401 authentication_required`; production `403 csrf_origin_rejected`; `404 wine_not_found`; `409 cellar_entry_exists`; `409 session_identity_changed`; real service `503`/`504`; structured database/500 errors. | Owner is the session user. Duplicate key is `(user_id, wine_id)`; a duplicate returns the same user's existing entry in `error.details.entry`. Two users can save the same canonical wine independently. Successful save invalidates only `['private', activeUserId, 'cellar']`. |
| `GET /api/cellar/<entryId>` | Integer route value. | Non-integer path does not match and yields generic `404 not_found`. | `200`; `data = { entry }`. | `401 authentication_required`; `404 cellar_entry_not_found`. | Lookup filters by both entry ID and session user ID. Cross-owner and nonexistent integer IDs return the identical body. Any private cache must include active user ID. |
| `PATCH /api/cellar/<entryId>` | Non-empty JSON object containing one or more of `favorite`, `notes`, `occasion`, `status`, `userRating`; optional expected-user header. | Unknown, immutable, `tags`, wine, and ownership fields rejected. | `200`; `data = { entry }`; message `Cellar entry updated.` | `400 invalid_json`; `400 validation_error`; `401 authentication_required`; production `403 csrf_origin_rejected`; `404 cellar_entry_not_found`; `409 session_identity_changed`; structured database/500 errors. | Owner-scoped lookup happens before mutation. The frontend waits for server confirmation, verifies returned `userId`, then updates only the active identity key. There is no optimistic write to roll back. |
| `DELETE /api/cellar/<entryId>` | No body fields are read; optional expected-user header. | Body/query values are not used to select an owner. | `200`; `data = { deletedId }`; message `Cellar entry deleted.` | `400 validation_error`; `401 authentication_required`; production `403 csrf_origin_rejected`; `404 cellar_entry_not_found`; `409 session_identity_changed`; structured database/500 errors. | Owner-scoped lookup precedes delete. The frontend removes the item from only the active identity key after server confirmation; a failed delete leaves the UI entry intact. |

Each cellar entry serializes `id`, `userId`, `wineId`, `userRating`, `notes`, `favorite`, `tags`, `occasion`, `status`, `savedAt`, `createdAt`, `updatedAt`, and its persisted `wine`. `tags` is currently response-only and is not an accepted create/update field.

#### Cellar validation details

- `favorite` must be Boolean.
- `userRating` is `null`/empty or an integer from 1 through 5; Boolean and fractional values are rejected.
- `notes` is nullable text up to 4,000 characters. Whitespace-only text is stored as `null`.
- `occasion` is nullable text up to 160 characters. Whitespace-only text is stored as `null`.
- `status` is one of `saved`, `tasted`, `wishlist`, `buy_again`, or `archived`.
- An empty PATCH is rejected because at least one editable field is required.
- JSON request size is globally capped at 1 MiB.

A nested `wine` accepts only `averageRating`, `country`, `description`, `externalApiId`, `externalWineId`, `imageUrl`, `name`, `priceCents`, `region`, `source`, `varietal`, `vintage`, and `winery`. It requires a name and external identifier; when both identifier aliases are present they must match. String limits are enforced, rating must be finite from 0 through 5, and price must be an integer from 0 through 100,000,000 cents.

The server first resolves a nested record against `WineService`. When a canonical record exists, provider metadata wins and repairs stale persisted canonical metadata; client-supplied name, source, rating, price, or image cannot poison the shared record. An unknown but valid nested record is stored under the server-owned source namespace `manual:user:<authenticated user id>`, isolating users with the same external identifier. A rejected same-user manual duplicate does not mutate the existing wine. Deleting the last cellar entry for an owner-namespaced manual wine also removes that private orphan, so a later save can accept current metadata. Supplying only an unknown outer `externalWineId` remains a provider lookup and returns `wine_not_found`.

## Shared method, CORS, and origin behavior

- Unknown routes and malformed integer cellar paths use the nested HTTP error envelope, usually `404 not_found`.
- Unsupported methods use the same envelope with `405 method_not_allowed`.
- Production unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) may fail before route validation with `403 csrf_origin_rejected`.
- Exact configured CORS origins receive `Access-Control-Allow-Origin` plus `Access-Control-Allow-Credentials: true`; unrecognized origins receive neither approval header. Wildcards are rejected during configuration.
- `OPTIONS` preflight remains public: an exact trusted origin receives credentialed approval and an untrusted origin receives a normal preflight response without an allow-origin header.
- Trusted preflight permits both `Content-Type` and the expected-user consistency header; the preferred same-origin topology does not require a cross-origin preflight.
- Safe GET requests are unaffected by CSRF/origin enforcement, though CORS headers are still exact-origin only.
- Auth and Cellar blueprint responses, Taste Profile responses, and recommendation responses explicitly set `Cache-Control: private, no-store` and `Vary: Cookie`; this includes their handled error responses. Other public catalog/health routes retain no endpoint-specific cache policy. Frontend React Query caching remains a separate in-memory policy.

## Public/private cache boundary

Public wine keys begin with `public` and contain no account identity or cellar data. Private keys begin with `private`, put the authenticated numeric user ID second, and use `gcTime: 0` for current cellar operations. On logout or identity change, `AuthProvider` cancels and removes all private queries and removes private mutations; public wine search/detail data may remain. Responses whose `userId` does not match the active identity are rejected as `session_identity_mismatch`, while an expected-user precondition mismatch is `session_identity_changed`; both trigger session revalidation and neither can write into another user's cache. A matching server-confirmed update/delete still reconciles its owner-scoped cache if session revalidation begins before the response arrives, but private editor feedback is suppressed until the identity is verified ready.

Every `/api/cellar` response now carries the same `private, no-store` and `Vary: Cookie` policy as auth/Profile/personalized responses. This is defense in depth for shared HTTP caches and does not replace signed-session authentication or owner filtering.

The public `/demo/cellar` and `/demo/taste-atlas` routes use explicit read-only fixture data and no private query keys. A discovery network error may display a visibly labeled link to that demo route; it never inserts demo entries into live search results.

## Contract boundary for later work

Prompt 06 adds no recommendation endpoint, Taste Atlas engine, AI sommelier, external wine provider, database migration, or deployment configuration. A future provider should preserve the `WineService` method and exception contract. A future Vercel deployment must supply the same-origin `/api` rewrite, a real backend host/database, exact HTTPS origins, and production secrets before this contract can be considered deployed.
