# Prompt 06 — Integration Verification

## Verdict and scope

The authenticated React-to-Flask integration passes its local Prompt 06 verification boundary. Auth boot, signup, login, logout, refresh persistence, complete safe return routes, live static-service discovery, real external-ID detail, private cellar CRUD, owner isolation, request cancellation, and honest failure states were exercised without replacing the accepted Prompt 05A visual/WebGL work.

Verification used branch `feat/grapevyne-cinematic-v2`, accepted Prompt 05A base `f07407cc08ec629a055ec549356188cab910732d`, a disposable local SQLite database, Flask at `http://127.0.0.1:5000`, and Vite at `http://127.0.0.1:5173`. It did not deploy, add an external provider, or start recommendation/Taste Atlas engine work.

## Automated gates

| Gate | Result |
| --- | --- |
| `npm run verify:assets` | Passed: 3 foundational, 30 hash-locked final video/poster, and 10 hash-locked WebGL assets. |
| `npm run lint` | Passed with zero warnings. |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: 36 files, 246 tests. |
| `npm run build` | Passed: Vite 5.4.21, 2,310 modules transformed. The accepted >500 kB warning remains limited to the lazy WebGL graph. |
| `.venv/bin/python -m pytest` in the tracked backend test environment | Passed: 81 tests. |
| `.venv/bin/python -m pip check` | Passed: no broken requirements. |
| `git diff --check` | Passed. |
| `npm audit` with a disposable cache | Same accepted lockfile result: 10 findings (1 low, 5 moderate, 4 high, 0 critical); no forced remediation. |
| `npm run test:e2e` | Not defined. No fake passing script was added; real Chromium automation supplied browser evidence. |

No frontend package or lockfile changed. No backend production requirement changed. The only dependency addition is exact development/test pin `pytest==8.4.2` in `backend/requirements-dev.txt`, which includes the existing runtime requirements with `-r requirements.txt`.

## Backend suite

| File | Tests | Contract covered |
| --- | ---: | --- |
| `backend/tests/test_health.py` | 2 | Health success envelope; unknown-route error envelope. |
| `backend/tests/test_auth.py` | 8 | Signup/session restore, duplicate account, generic invalid credentials, logout, isolated clients, deleted users, exact JSON fields, length limits. |
| `backend/tests/test_wines.py` | 8 | Trimmed/empty/oversized search, real external IDs including encoded slashes, honest empty set, injected 503/504, generic unexpected-provider 500. |
| `backend/tests/test_cellar_crud.py` | 19 | Auth requirement, complete CRUD, duplicate contract, canonical metadata repair, immutable manual duplicate, manual orphan cleanup/recreation, field/rating/status/note validation, forged fields, nested wine validation, malformed/missing IDs, injected timeout. |
| `backend/tests/test_cellar_expected_user.py` | 11 | Optional mutation precondition, matching full CRUD, malformed/non-positive/out-of-range/overlong values, stale two-user cookies, and zero-write rejection. |
| `backend/tests/test_cellar_ownership.py` | 3 | Full two-user isolation, indistinguishable 404s, independent same-wine save, forged identity rejection, shared canonical anti-poisoning, per-user manual namespaces. |
| `backend/tests/test_session_security.py` | 19 | Three environment cookie policies, fixed expiry, production startup failures, non-bypassable policy, explicit proxy trust, invalid config. |
| `backend/tests/test_cors_origin.py` | 11 | Exact credentialed CORS, untrusted/cross-site rejection, same-origin/non-browser acceptance, safe GET, preflight, wildcard/malformed origins, normalization. |

Each test receives a fresh temporary SQLite database and independent Flask clients. Tests do not use `DATABASE_URL`, production data, shared auth state, or test ordering.

## Frontend integration coverage

Prompt 06 added or extended API client, auth, route, and page tests covering:

- relative `/api` as the sole default and `credentials: "include"` on every request;
- success/error-envelope parsing, malformed response detection, and network/abort distinction;
- typed auth, wine, and cellar clients plus real response normalizers;
- app-boot refresh, success/401/error outcomes, stale-request cancellation, unmount cancellation, focus/visibility and cross-tab revalidation, coalescing, and private query/mutation removal;
- complete query/hash return paths, login/signup switching, external/open-redirect rejection, and focus behavior;
- protected-route loading/error/signed-out states with no early private request;
- public discovery keys, URL encoding, five-minute caching, superseded-search aborts, honest empty/provider/network errors, explicit read-only-demo navigation, and no demo import;
- wine-detail real external ID, pending save, success, duplicate, origin rejection, network failure, owner mismatch, stale identity, and authenticated return path;
- identity-scoped cellar list/update/delete, server-confirmed cache changes, pending action locking, error preservation, session revalidation, owner mismatch, and no demo fallback;
- expected-user mutation headers, ready-session write gating, preserved private drafts while known-user focus/visibility revalidation hides and inerts the protected route, server-confirmed cache reconciliation, and suppression of late private feedback during identity revalidation/replacement;
- unchanged homepage media/WebGL/typography contracts and factual Under the Cork disclosure.

The relevant test files are `frontend/src/api/__tests__/{client,auth,liveClients,topology}.test.ts`, `frontend/src/features/auth/AuthContext.test.tsx`, auth/navigation/protected-route component tests, and the Cellar, Discover, Home, Profile, and Wine Detail page suites. Obsolete duplicate JS/TS adapters were removed so live requests have one implementation path.

## Same-origin API smoke

The browser and command-line smoke flow used only the Vite origin. Vite forwarded cookies and all methods without changing `/api` paths.

| Operation through `http://127.0.0.1:5173/api` | Observed result |
| --- | --- |
| Health | `GET /api/health` -> 200. |
| Signed-out current user | `GET /api/auth/me` -> 401 `authentication_required`. |
| Signup | `POST /api/auth/signup` -> 201 and authenticated user. |
| Current user | `GET /api/auth/me` -> 200 for the signed cookie. |
| Logout/login | `POST /api/auth/logout` -> 200; `POST /api/auth/login` -> 200. |
| Search | `GET /api/wines/search?query=steak` -> 200 and Estate Cabernet Sauvignon. |
| Detail | `GET /api/wines/mock-chateau-montelena-cabernet-sauvignon-2019` -> 200. |
| Cellar list/create/detail | 200 / 201 / 200. |
| Cellar update/delete | `PATCH` -> 200; `DELETE` -> 200; deleted detail -> 404. |
| Post-logout current user | `GET /api/auth/me` -> 401. |

No API hostname was hardcoded in production source, and no cookie value was recorded.

## Two-user ownership results

Automated tests and browser verification used separate cookie jars for:

- User A: `Prompt 06 User A` / `prompt06-user-a@example.test`;
- User B: `Prompt 06 User B` / `prompt06-user-b@example.test`.

No password appears in this document or screenshot evidence.

User A saved the real static-service record `mock-chateau-montelena-cabernet-sauvignon-2019`, listed and read it, received owner-scoped duplicate feedback, then changed favorite to true, rating to 5, status to `tasted`, and occasion to `Prompt 06 verification`. User B's initial cellar remained empty. Direct User B GET, PATCH, and DELETE attempts against User A's entry all returned the same `404 cellar_entry_not_found` body as a nonexistent entry and did not alter User A's fields. User B then saved the same canonical wine successfully as a distinct User B cellar entry.

The backend suite additionally proved forged snake-case and camel-case identity fields are rejected, User A loses protected access after logout, a canonical nested payload cannot poison shared provider metadata, unknown manual wines with the same external identifier remain in separate server-owned user namespaces, and a stale User A expected-user header cannot mutate User B after the shared cookie changes. A normal DELETE success was exercised only when safe; forced browser DELETE failure preserved the entry until normal cleanup.

## Session persistence and return routes

The real browser flow established:

1. Signup succeeded and routed to the authenticated cellar.
2. Vite-origin `/api/auth/me` returned the signed-in user.
3. A full reload preserved the session and direct `/cellar` access.
4. The local cookie was intentionally non-Secure on HTTP, remained `HttpOnly`/`SameSite=Lax`, and was unreadable through `document.cookie`.
5. Logout made `/api/auth/me` return 401; another full reload remained signed out.
6. Login returned to `/wines/mock-chateau-montelena-cabernet-sauvignon-2019?origin=prompt06#pairings`, preserving pathname, query, and hash.
7. Injecting `https://attacker.example.test/phish` as return state never left the Vite origin and safely fell back to `/cellar`.
8. A failed logout request kept the authenticated navigation and left `/api/auth/me` at 200 after network recovery.

## Discovery and cellar failure matrix

| Injected condition | Verified browser behavior |
| --- | --- |
| Auth boot `/api/auth/me` unavailable | Protected `/cellar` stayed hidden behind `YOUR PRIVATE SESSION COULD NOT BE VERIFIED`; retry after recovery reached the correct signed-out redirect. No private cellar request ran before auth resolved. |
| Discovery API unavailable | Accurate network panel, controlled retry, and an explicit `Open read-only demo` link; no fixture appeared in live results. Recovery returned the real Estate Cabernet result. |
| Stale discovery | A delayed `champagne` fetch was aborted after a newer `steak` query; the final URL/result stayed `steak` and no stale sparkling result or error appeared. |
| Save unavailable | No success toast or cache insertion; error feedback appeared and the retry control remained available. |
| Logout unavailable | User remained authenticated; no false redirect or cache clear. |
| PATCH unavailable | Error feedback appeared; the card and API remained at the prior `tasted`, favorite, rating-5 state. |
| DELETE unavailable | Confirmation/error feedback remained accurate; no false removal and the API entry still existed. |
| Production origin rejection | The nested `csrf_origin_rejected` message is surfaced as a failed mutation, never as success. |

Abort errors are intentionally suppressed as superseded work. Normal network/provider errors remain visible and retryable. Private results are never replaced with demo data.

## Browser routes, viewports, and accessibility

| Viewport | Routes and evidence |
| --- | --- |
| 390×844 | `/discover?query=...` network failure/recovery; signed-out protected-route redirect; mobile navigation and accurate API-failure layout. |
| 768×1024 | Login round-trip to the complete wine-detail query/hash route. |
| 1440×900 | Signup, session-preserved `/cellar`, real search/detail/save, duplicate feedback, cellar refresh, edit, and mutation-failure states. |
| 1920×1080 | Isolated User B cellar and homepage Under the Cork disclosure. |

The checked routes had no horizontal overflow or blank-page failure. Auth inputs retained programmatic labels and error associations; busy controls exposed pending state; errors/toasts used alert/status live regions; pending mutations disabled conflicting actions; the mobile navigation trapped/returned focus and closed with Escape; cellar detail close returned focus to its bottle trigger. Reduced-motion and disabled-WebGL checks retained the CSS bottle and semantic page with zero canvas/model/label load, while a capable Home session retained one persistent inert canvas. Product routes loaded no Three/R3F/Drei graph.

## Screenshot evidence

All captures are under [`docs/screenshots/prompt-06/`](../screenshots/prompt-06/):

| File | Evidence | Dimensions |
| --- | --- | ---: |
| `01-signup-success-1440x900.png` | Successful signup/authenticated empty cellar | 1440×900 |
| `02-session-preserved-after-refresh-1440x900.png` | Protected cellar after full refresh | 1440×900 |
| `03-duplicate-save-feedback-1440x900.png` | Owner-scoped duplicate response | 1440×900 |
| `04-authenticated-cellar-after-save-1440x900.png` | Real API cellar after save/refresh | 1440×900 |
| `05-cellar-edit-success-1440x900.png` | Server-confirmed edit | 1440×900 |
| `06-login-return-wine-detail-768x1024.png` | Complete internal return route after login | 768×1024 |
| `07-network-unavailable-discovery-390x844.png` | Honest discovery network failure | 390×844 |
| `08-signed-out-protected-route-redirect-390x844.png` | Signed-out protection after auth recovery | 390×844 |
| `09-user-b-cellar-isolated-1920x1080.png` | User B sees no User A entry | 1920×1080 |
| `10-under-the-cork-webgl-disclosure-1920x1080.png` | Factual implemented-WebGL disclosure | 1920×1080 |

Screenshots contain no cookie inspector, session value, secret, or password.

## Build and route/chunk boundary

| Output | Prompt 05A raw/gzip | Prompt 06 raw/gzip | Delta raw/gzip |
| --- | ---: | ---: | ---: |
| Principal application JS | 215.28 / 69.29 kB | 228.66 / 72.98 kB | +13.38 / +3.69 kB |
| Home JS | 26.87 / 9.47 kB | 26.98 / 9.53 kB | +0.11 / +0.06 kB |
| Shared CSS | 124.93 / 22.45 kB | 124.93 / 22.45 kB | 0 / 0 kB |
| Home CSS | 19.48 / 4.41 kB | 19.48 / 4.41 kB | 0 / 0 kB |
| Lazy WebGL graph | 906.79 / 247.10 kB | 906.76 / 247.08 kB | -0.03 / -0.02 kB |

Prompt 06 route chunks include Discover 7.20/3.09 kB, Wine Detail 8.35/3.06 kB, and Cellar 18.72/6.28 kB raw/gzip. Auth/cache hardening belongs to the principal product graph, not the lazy WebGL chunk. Production build inspection and browser resource observation confirmed the WebGL graph remains Home-only; product routes did not load `ExperienceCanvas`, GLBs, labels, Three, R3F, or Drei. No remote model, HDRI, label, or font request was introduced.

## Immutable visual boundary

All accepted assets and Prompt 05A typography stayed unchanged:

| Contract | SHA-256/token |
| --- | --- |
| 30-item cinematic aggregate | `0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018` |
| Desktop GLB | `2304b4b89cc7a249527746c6b1f7ceb02759f6395a709b129e539941c885c05a` |
| Mobile GLB | `1caa5eb4786326199f0f2b1fd4066590aaccda02a54da03e14bfba9bee10e3f8` |
| Red front label | `fc1e798888c59d1dc335a964309de8ddf570be68b509f47b0be396be244f4281` |
| White front label | `543107978d3e46f5b60846c326079f4cae8481ebaa91994c051a77450ecfa4c3` |
| Sparkling front label | `79a159d2399734f60f6602dde705cfc279d31aa70cfc607538244f29b0eed3ce` |
| Rosé front label | `6f4b8d61ec65a22d50c391ebe2fd1846b2651ad5f30e08f40dcb953e3a074e50` |
| Back label | `d33586e7beeec7ef60d203a5bf74bbb8a39b9d30f21471549a6b2e7d32f791d3` |
| Capsule label | `63e056294a30643153444a8f33df805f715ba4a09cfeb39fe4156377cef5992e` |
| Hero title | `clamp(3.15rem, 6.6vw, 6.9rem)` |
| Chapter title | `clamp(2.25rem, 4.9vw, 4.85rem)` |
| Product title | `clamp(2.5rem, 4.8vw, 5.2rem)` |

No video, poster, GLB, label, font, visual registry, title token, or binary changed.

## API/schema boundary and remaining work

There is no database migration or schema change. Existing User, Wine, and CellarEntry columns and uniqueness constraints remain intact. The changes harden route validation, canonical/manual wine handling, production configuration, session/origin policy, frontend clients, cache lifecycle, and tests.

Remaining work is intentionally outside Prompt 06:

- create and verify the production/Vercel `/api` rewrite and deploy the Flask service;
- provision the production database, exact HTTPS origins, secret, cookie domain decision, logging/monitoring, and backups;
- replace or extend the honest six-record static `WineService` only in an authorized later phase;
- address the accepted npm advisories through a separately tested non-forced dependency upgrade;
- add a formal end-to-end script if the project later chooses a maintained browser-test harness;
- implement recommendation, personalized Taste Atlas, and AI sommelier behavior only in their later prompts.

The disposable SQLite database, cookie jars, browser sessions, and accounts are verification-only artifacts outside the repository and are removed during teardown.
