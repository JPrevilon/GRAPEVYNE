# GRAPEVYNE V2 baseline audit

Audit date: 2026-08-01

Scope: Prompt 01 only; no Prompt 02 or later implementation was performed.

## Executive summary

The repository is a two-application project: a React 18/Vite 5 JavaScript SPA and a Flask 3/PostgreSQL API. The valuable production contracts are the credentialed Flask session, owner-scoped cellar queries, the JSON response envelope, the public wine-search interface, and the existing route URLs. Those contracts must be preserved while the V2 reference is adapted incrementally.

The most serious baseline mismatch is already present in the tracked application: the protected `/cellar` route renders eleven fictional entries from `interactiveCellarData.js`, and edit/favorite/delete operations mutate React state only. Real, owner-scoped cellar API wrappers exist but are disconnected from that route. This audit records that behavior without changing it; Prompt 02 must isolate any fixture data under explicit `/demo/*` routes and reconnect protected routes to authenticated API data.

The reference package is not directly overlayable. Prompts and docs point at `.grapevyne-v2-reference/framework/frontend` and `framework/backend-extension`, but no `framework/` directory exists. The actual trees are `.grapevyne-v2-reference/frontend`, `.grapevyne-v2-reference/backend-extension`, and `.grapevyne-v2-reference/docs`. Several reference contracts also differ from the live API and need adapters rather than backend renames or wholesale replacement.

No tracked production source file was changed in this phase.

## Repository and branch state

| Item | Result |
| --- | --- |
| Remote | `https://github.com/JPrevilon/GRAPEVYNE.git` |
| Intended base | `main` / `origin/main` |
| Base commit | `4e58cac57d2e114f4d1b6626b3085b7a51e8741b` |
| Ahead/behind before branch creation | `0 / 0` |
| Feature branch | `feat/grapevyne-cinematic-v2` |
| Branch point | `origin/main` at `4e58cac57d2e` |

The initial worktree had no tracked modifications, but it was not clean because these paths were untracked:

- `.grapevyne-v2-reference/` — user-supplied reference package.
- `backend/.python-version`, `backend/main.py`, `backend/pyproject.toml`, and `vercel.json` — pre-audit Vercel adapter work.

They were inspected where relevant and preserved. They were not staged, committed, copied over production files, or treated as tracked baseline behavior. Local-only exclude entries are used after the documentation commit so the Prompt 01 clean-worktree gate can be met without deleting, overwriting, stashing, or committing unrelated material.

## Relevant tracked tree

```text
README.md
backend/
  .env.example
  README.md
  requirements.txt
  app/
    __init__.py
    auth.py
    cli.py
    config.py
    errors.py
    extensions.py
    models/{user,wine,cellar_entry,mixins}.py
    routes/{health,auth,wines,cellar}.py
    services/{wine_service,cellar_service}.py
    utils/{responses,validation}.py
frontend/
  .env.example
  eslint.config.js
  index.html
  package.json
  package-lock.json
  vite.config.js
  src/
    main.jsx
    App.jsx
    api/client.js
    components/{layout,routing,ui}/...
    features/auth/...
    features/wines/...
    features/cellar/...
    pages/...
    styles/global.css
    utils/formValidation.js
  public/images/...
docs/screenshots/README.md
```

There are no tracked backend tests, frontend tests, migrations, CI workflows, Docker files, production WSGI entrypoint, or deployment configuration.

## Frontend baseline

### Runtime, scripts, and exact packages

- Runtime used for the audit: Node `v20.19.6`, npm `10.8.2`.
- Vite 5 React SPA, ESM, JavaScript/JSX; there is no TypeScript configuration or type-check command.
- Lockfile version: 3.
- Scripts: `dev=vite`, `build=vite build`, `preview=vite preview`, `lint=eslint .`.
- Missing scripts: `verify:assets`, `test`, and `test:e2e`.

| Package | Manifest range | Locked/installed |
| --- | ---: | ---: |
| `react` | `^18.3.1` | `18.3.1` |
| `react-dom` | `^18.3.1` | `18.3.1` |
| `react-router-dom` | `^6.26.1` | `6.30.3` |
| `framer-motion` | `^12.38.0` | `12.38.0` |
| `lucide-react` | `^0.468.0` | `0.468.0` |
| `vite` | `^5.4.2` | `5.4.21` |
| `@vitejs/plugin-react` | `^4.3.1` | `4.7.0` |
| `eslint` | `^9.9.1` | `9.39.4` |
| `eslint-plugin-react` | `^7.35.0` | `7.37.5` |
| `eslint-plugin-react-hooks` | `^5.1.0` | `5.2.0` |
| `eslint-plugin-react-refresh` | `^0.4.9` | `0.4.26` |
| `globals` | `^15.9.0` | `15.15.0` |

### Route and component map

`frontend/src/main.jsx` mounts one `BrowserRouter` around `ToastProvider` and `AuthProvider`. `AppLayout` supplies the shared header/footer and outlet.

| URL | Component | Data/auth behavior |
| --- | --- | --- |
| `/` | `pages/HomePage.jsx` | Public, static/marketing route |
| `/discover` | `pages/DiscoverPage.jsx` | Public, live `GET /wines/search` |
| `/wines/:wineId` | `pages/WineDetailPage.jsx` | Public detail; save uses live cellar API |
| `/cellar` | `ProtectedRoute` → `pages/CellarPage.jsx` → `OpenCellarPage.jsx` | Auth guard is real; displayed cellar and mutations are local fixtures |
| `/login` | `pages/LoginPage.jsx` | Live session login |
| `/signup` | `pages/SignupPage.jsx` | Live account/session creation |
| `/profile` | `ProtectedRoute` → `pages/ProfilePage.jsx` | Protected account summary from the auth-context user; no profile/taste API |
| `*` | redirect to `/` | No dedicated 404 |

The active cellar tree is `CellarPage` → `OpenCellarPage` → intro, controls, scene, zoom, markers, detail panel, and empty state. It imports `mockCellarSections` from `interactiveCellarData.js`. The tracked CRUD wrappers in `features/cellar/cellarApi.js` are not used by the active route. A legacy cellar component tree, `cellarGrouping.js`, `openCellarData.js`, and several Open Cellar components are unreachable from the router and should remain until feature parity is proven.

### Browser API contract

- Base URL: `VITE_API_BASE_URL`, otherwise `http://${window.location.hostname}:5000/api`.
- Every fetch uses `credentials: "include"` and a JSON content type. Supplying `Content-Type: application/json` even on cross-origin GETs causes browser CORS preflights.
- Successful callers expect the Flask envelope under `response.data`.
- Non-2xx responses expect `error.message`, `error.code`, and optional `error.details`; thrown errors carry `status`, `code`, and `details`.
- Network failures are converted to `code=network_error`.
- No bearer token, browser storage credential, CSRF token, or CSRF header is used.

Auth calls are `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me`. `AuthProvider` restores the session on mount and treats every refresh failure as anonymous; non-401 failures are logged first. It keeps the current user only in memory. Logout clears that user only after the POST succeeds, so a failed logout leaves the client in its previous authenticated state. `ProtectedRoute` redirects to `/login` with the full location in route state, although login/signup currently restore only the pathname and drop query/hash.

Wine calls are `GET /wines/search?query=...` and `GET /wines/:externalWineId`. Save sends `POST /cellar` with the complete detail object under `wine`. Cellar wrappers expose list/create/get/patch/delete. The legacy edit payload is `{notes, userRating, occasion, favorite}`.

### Frontend mock/demo inventory

- `interactiveCellarData.js`: five sections and eleven fictional cellar wines, active on protected `/cellar`; edits are ephemeral local state. The detail panel explicitly calls it a mock cellar, but the main route has no visible demo banner.
- `openCellarData.js`: currently unused; includes inferred pairings and a computed critic score (`averageRating * 20`). Those invented claims must not be promoted into production data.
- The backend's six mock discovery wines are displayed through the real public API contract and carry `source: "mock"`.
- There are no `/demo/*` routes today.
- Twenty tracked PNGs occupy approximately 37 MB; eleven correspond to the fictional cellar fixture. Large ~2 MB bottle images are a later performance/deployment risk.

## Backend baseline

### Runtime and dependencies

Audit interpreter: Python `3.14.3` in `backend/.venv`; pip `25.3`.

| Requirement | Pinned/installed version |
| --- | ---: |
| Flask | `3.0.3` |
| Flask-Cors | `4.0.1` |
| Flask-Migrate | `4.0.7` |
| Flask-SQLAlchemy | `3.1.1` |
| psycopg[binary] | `3.2.13` |
| python-dotenv | `1.0.1` |

`create_app(config_name=None)` configures SQLAlchemy, Flask-Migrate, credentialed CORS for `/api/*`, blueprints, error handlers, and CLI commands. The route prefixes are `/api`, `/api/auth`, `/api/wines`, and `/api/cellar`.

The registered blueprint objects and sources are `health_bp` (`backend/app/routes/health.py`, name `health`), `auth_bp` (`routes/auth.py`, name `auth`), `wines_bp` (`routes/wines.py`, name `wines`), and `cellar_bp` (`routes/cellar.py`, name `cellar`).

### Existing endpoint contract

Success responses use `{ "data": ... }` plus an optional top-level `message`. Errors use `{ "error": { "code", "message", "details"? } }`.

| Method and path | Auth | Contract |
| --- | --- | --- |
| `GET /api/health` | Public | Service/status payload |
| `POST /api/auth/signup` | Public | `{name,email,password}`; `201`; session begins; duplicate email is `409 email_already_exists` |
| `POST /api/auth/login` | Public | `{email,password}`; invalid credentials are `401 invalid_credentials`; session begins |
| `POST /api/auth/logout` | Public/idempotent | Clears session and returns `authenticated:false` |
| `GET /api/auth/me` | Required | Current serialized user; otherwise `401 authentication_required` |
| `GET /api/wines/search?query=...` | Public | Blank query is `400 missing_query`; payload contains `query`, `results`, `source` |
| `GET /api/wines/<external_wine_id>` | Public | Exact ID; absent is `404 wine_not_found` |
| `GET /api/cellar` | Required | Current owner's entries, newest saved first; `{entries,count}` |
| `POST /api/cellar` | Required | Inline `wine` or `externalWineId`; `201`; duplicate is `409 cellar_entry_exists` |
| `GET /api/cellar/<int:entry_id>` | Required | Owner-scoped; inaccessible and absent are both `404 cellar_entry_not_found` |
| `PATCH /api/cellar/<int:entry_id>` | Required | Owner-scoped partial update |
| `DELETE /api/cellar/<int:entry_id>` | Required | Owner-scoped delete; returns `deletedId` |

There are no recommendation, taste-profile, or demo API routes.

### Authentication, cookie, and CORS contract

- Session key: exactly `user_id` in Flask's signed client-side cookie.
- Signup/login clear the previous session, mark it permanent, and store the database user ID.
- Current-user lookup loads by primary key per request, caches in `g`, and clears stale sessions.
- Passwords use Werkzeug hashing and are not serialized.
- Cookie name remains Flask's default `session`; `HttpOnly=true`; effective path `/`; default host-only domain.
- `SameSite` comes from `SESSION_COOKIE_SAMESITE` and defaults to `Lax`.
- `Secure` comes from `SESSION_COOKIE_SECURE` and defaults to false.
- Permanent lifetime comes from `SESSION_LIFETIME_DAYS` and defaults to seven days.
- Flask's implicit `SESSION_REFRESH_EACH_REQUEST=true` refreshes permanent-cookie expiry on requests.
- CORS applies to `/api/*`, uses `FRONTEND_ORIGINS`, then singular `FRONTEND_ORIGIN`, then local Vite defaults, and enables credentials.
- An isolated smoke check confirmed allowed origins receive `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`; disallowed origins receive neither.
- There is no CSRF middleware/token and no rate limiting.

`ProductionConfig` does not fail fast when `SECRET_KEY` or `DATABASE_URL` is absent; both inherit development-oriented fallbacks. An unknown `FLASK_ENV` silently selects `DevelopmentConfig`, including debug mode. These behaviors must not be relied on in deployment.

For a cross-site production topology, the deployment must deliberately use HTTPS, `Secure=true`, a compatible `SameSite` value (normally `None` when truly cross-site), exact origin allowlisting, and credentialed browser requests. Same-origin routing is operationally safer when available.

### Persistence models

`User`:

- integer primary key, name, unique/indexed email, password hash, timezone-aware timestamps; auth-route validation, rather than the model/database, performs lowercase normalization;
- delete-orphan cascade to cellar entries.

`Wine`:

- integer primary key; optional indexed external ID; non-null source/name;
- optional winery, varietal, region, country, vintage, description, image URL, decimal average rating, and price cents;
- unique `(source, external_api_id)`.

`CellarEntry` exact persistent fields:

- `id`, `user_id`, `wine_id`;
- nullable `user_rating`, `notes`, `occasion`;
- non-null `favorite`, JSON `tags`, `status`, `saved_at`;
- inherited `created_at`, `updated_at`;
- unique `(user_id, wine_id)`;
- rating check: null or 1–5;
- status check: `saved`, `tasted`, `wishlist`, `buy_again`, or `archived`.

Serialization is camelCase and includes the nested wine by default. `tags` is stored and serialized but cannot currently be written through create/patch. Unknown and empty PATCH data are accepted as successful no-ops. Current rating validation incorrectly accepts JSON `true` as integer rating `1`; JSON `false` fails the 1–5 range check.

Flask-Migrate is initialized, but no tracked `migrations/` directory or revision history exists. `flask --app app init-db` calls `db.create_all()`.

### Ownership boundary

The owner ID always comes from the authenticated session, never a browser-supplied `user_id`.

```python
# list
CellarEntry.query.filter_by(user_id=user_id).join(Wine)

# detail/update/delete lookup
CellarEntry.query.filter_by(id=entry_id, user_id=user_id).first()

# duplicate lookup on create
CellarEntry.query.filter_by(user_id=user_id, wine_id=wine.id)
```

PATCH and DELETE first call the owner-scoped detail lookup and operate only on the returned object. Cross-owner access deliberately returns the same `404` as a nonexistent record. `Wine` rows are shared; privacy attaches to `CellarEntry`. These exact filters and indistinguishable `404` behavior are release invariants.

### Cellar validation and persistence contract

Create requires an inline `wine` dictionary or truthy `externalWineId`. Inline wine requires `externalWineId` or `externalApiId`, plus `name`. Writable entry properties are:

- `userRating`: integer 1–5, or empty/null → null;
- `favorite`: strict boolean;
- `notes`: string/null, maximum 4,000 characters;
- `occasion`: string/null, maximum 160 characters;
- `status`: the five-value model enum.

Saving an inline discovery wine persists only the `Wine` model columns. Pairings, tasting notes, body, acidity, sweetness, occasion, and serving temperature are not persisted.

### WineService interface and failure behavior

The tracked backend has one concrete `WineService`, not a protocol/provider family:

```text
source = "mock"
search(query) -> {query: original input, results: WineProfile[], source: "mock"}
get_by_external_id(external_wine_id) -> WineProfile | None
```

Search lowercases, trims, collapses whitespace, and requires every term to occur in a combined searchable text. Exact-ID lookup is case-sensitive. Six static records are served with fields `externalWineId`, `source`, `name`, `winery`, `varietal`, `region`, `country`, `vintage`, `description`, `imageUrl`, `averageRating`, `priceCents`, `pairings`, `tastingNotes`, `body`, `acidity`, `sweetness`, `occasion`, and `servingTemp`.

There is no external provider, timeout, retry, cache, provider adapter, or provider-specific error mapping. HTTP routes turn a missing query into `missing_query` and a missing exact ID into `wine_not_found`; unexpected errors use the global handler. The ratings, prices, descriptions, pairings, and tasting claims are static mock fixtures with unverified provenance and must not be described as live authoritative facts.

The CLI `seed-demo-data` adds three global `source="seed"` wine records only; it creates no users or cellar entries.

## Environment and deployment assumptions

Tracked frontend key:

- `VITE_API_BASE_URL`

Backend-recognized keys:

- `FLASK_ENV`, `SECRET_KEY`, `DATABASE_URL`, `TEST_DATABASE_URL`;
- `FRONTEND_ORIGINS`, `FRONTEND_ORIGIN`;
- `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, `SESSION_LIFETIME_DAYS`.

`.env.example` omits `TEST_DATABASE_URL` and singular `FRONTEND_ORIGIN`. The ignored local `backend/.env` was inspected and classified, but every value is redacted here. Its database URL points to a hostless/local PostgreSQL topology, and its session flags are development-oriented. That database was reachable and had `users`, `wines`, and `cellar_entries` tables but no `alembic_version` table.

There is no tracked deployment setup. The frontend defaults to a separate backend on port 5000 and has no Vite proxy. `BrowserRouter` needs an SPA fallback for direct routes. If the API base is omitted on an HTTPS deployment, the current fallback becomes an insecure/unreachable `http://<host>:5000/api` URL.

Untracked Vercel adapter files exist from pre-audit work, but they are not part of the commit under audit and do not repair the missing production PostgreSQL/CORS/cookie configuration. They must be evaluated only in Prompt 10 after the quality gate.

## Reference package assessment

### Path and completeness issues

- Requested `framework/frontend` and `framework/backend-extension` paths are absent; actual trees omit `framework/`.
- Prompt 04A requests `web-ready/public/assets/video/` and `integration/*`; those exact paths are absent. Equivalent files exist under `frontend/public/assets/video/` and `frontend/src/experience/{media.ts,CinematicVideo.tsx}`.
- `START-HERE.md` refers to missing `FINAL-MEDIA-STATUS.md`, preview folders, and `scripts/stage-reference.sh`.
- Other asset documentation refers to missing source plates, incoming masters, production prompt files, `scripts/verify_media.py`, and `asset-manifest.json`.
- `model-validation.json` names `*-placeholder.glb` files while the distributed models are named `grapevyne-master-bottle*.glb`.
- The reference must therefore remain a design/template source, not a blind copy operation. Prompt 04A needs a provenance/status decision before those equivalent media files can be treated as approved final assets.

### Contract mismatches that require adaptation

| Area | Live repository | Reference assumption | Required treatment |
| --- | --- | --- | --- |
| Success envelope | `{data: ...}` | Several normalizers inspect top-level `user`, `entries`, or `results` | Unwrap exact live envelope first; test every route |
| Error envelope | `{error:{code,message,details?}}` | Docs propose top-level `error` code and `message` | Preserve live shape or normalize only at client boundary |
| Auth | `data.user` | Reference auth normalizer does not reliably read `data.user` | Adapt normalizer; do not rename Flask response |
| Cellar list | `data.entries` | Reference checks top-level array/`entries`/`cellar` | Add exact envelope support |
| Wine search/detail | `data.results` / `data` | Reference primarily checks top-level result fields | Add exact envelope support |
| API base/path | base normally ends in `/api`; callers use `/auth/...` | base normally blank; callers use `/api/auth/...` | Choose one convention; avoid `/api/api/...` |
| Status values | `saved`, `tasted`, `wishlist`, `buy_again`, `archived` | `wishlist`, `cellared`, `tasted` | Use a mapping without weakening server validation |
| Price | `priceCents` | Reference domain emphasizes `averagePrice` | Normalize explicitly; avoid unit mistakes |
| Style fields | live mock uses text labels for body/acidity/sweetness | Reference types/normalizers expect numbers | Preserve sourced labels or define a transparent controlled mapping |
| Wine identifiers/details | `externalWineId`, `pairings`, `tastingNotes` | Reference normalizer omits these camelCase forms and can synthesize UUIDs | Preserve stable provider IDs and sourced arrays; never invent IDs for saves |
| Private query cache | current user held in auth context | Reference query keys are not user-scoped/cleared at logout | Scope or clear caches on identity changes to prevent cross-user display |
| Profile | protected auth-context account summary; no taste endpoint | Reference calls `/api/profile/taste` | Implement only in Prompt 08 from private owner-scoped aggregates |
| WineService | `search(query)` and exact lookup | Reference extension protocol uses criteria/keyword signatures | Adapt extension behind existing interface; retain basic search |
| Migrations | Flask-Migrate configured, no revisions | Reference supplies raw SQL | Bootstrap a real migration history safely before schema extension |
| Normalization | real IDs/timestamps may be absent | Reference can synthesize UUIDs/current timestamps/`Unknown` labels | Do not fabricate production facts; represent missing data honestly |

The reference frontend structurally intends to separate public demo routes from protected routes and uses credentialed fetches, route-level lazy loading, semantic DOM, reduced-motion handling, and a single-scene architecture. Those patterns are candidates for adaptation, but its protected routes do not work unmodified against the current response envelopes, its cellar is display-only, and its navigation omits logout. Reference demo wine IDs also resolve through the ordinary wine-detail/save flow, which could persist curated demo facts into an authenticated cellar unless explicitly blocked. Its backend extension is a template and needs current blueprint registration, response helpers, auth decorators, ownership services, integer user IDs, model names, WineService signatures, and migration tooling.

The reference frontend has no lockfile, so its dependency ranges are not a reproducible install. Its included tests cover only a subset of the promised matrix, and its verification report says install/build/application E2E were not run. `verify-assets.mjs` checks only nine files for presence/nonzero size; it does not validate all video fallbacks, posters, dimensions, audio, model nodes, or budgets.

Twenty reference video files have the expected desktop/mobile dimensions and no audio, but documentation conflicts on whether they are final or prototype derivatives. Known stated-budget overruns include both liquid loops, the mobile cellar MP4, and several mobile posters. The mobile hero is 5.04 seconds, below the documented 6–8 second target. Stable replace-in-place media names must also not receive immutable one-year caching unless URLs are versioned.

## Preserve / adapt / retire map

| Preserve exactly until tested | Adapt incrementally | Retire or quarantine only after parity |
| --- | --- | --- |
| Flask session key and credentialed fetch boundary | Router/provider shell; keep one `BrowserRouter` | `interactiveCellarData.js` from protected `/cellar`; retain only in labeled demo if useful |
| Current auth URLs, payloads, envelopes, and error codes | Strict TypeScript for new code while JSX remains valid | Inferred critic scores, pairings, or other invented claims |
| Owner-scoped list/detail/duplicate filters and cross-owner `404` | API transport/normalizers for exact `{data:...}` responses | Duplicate/unreachable cellar implementations after tests prove parity |
| WineService basic `search(query)` and exact lookup behavior | Active cellar UI to real async CRUD with loading/error/empty/rollback | Dead V1 CSS/assets/dependencies in Prompt 09 only |
| Public Discover and Wine Detail live calls | Public, visibly labeled, read-only `/demo/*` fixtures | Root wildcard redirect after an accessible 404 exists |
| Existing validation constraints and duplicate-save handling | Profile/Taste Atlas only after protected aggregation exists | Transitional account-only profile content after real profile parity |
| Accessibility primitives, toasts, focus styles, reduced-motion support | Split the 3,720-line CSS only after visual/behavioral parity | Any mock fallback on `/cellar` or `/profile` |
| Current route URLs and direct-link behavior | Vercel/deployment topology only after Prompt 09 | Unused large fictional images after provenance and references are checked |

### File disposition

| Disposition | Existing files | Reason |
| --- | --- | --- |
| Preserve | `backend/app/{__init__,auth,config,errors,extensions}.py`, `backend/app/routes/{health,auth,wines,cellar}.py`, `backend/app/models/*.py`, `backend/app/services/{wine_service,cellar_service}.py`, `backend/app/utils/*.py` | These files define the live application factory, envelopes, sessions, CORS, models, WineService, validation, and ownership boundaries. Extend behind tests; do not replace. |
| Preserve/adapt | `frontend/src/api/client.js`, `frontend/src/features/auth/{AuthContext.jsx,authApi.js,authContextValue.js,authErrors.js,useAuth.js}`, `frontend/src/features/wines/wineApi.js`, `frontend/src/features/wines/components/{WineBottleMark,WineCard,WineResultsGrid}.jsx`, `frontend/src/features/cellar/cellarApi.js`, `frontend/src/components/routing/ProtectedRoute.jsx`, `frontend/src/components/ui/{ToastProvider.jsx,toastContextValue.js,useToast.js}`, `frontend/src/utils/formValidation.js` | Port incrementally while retaining credentialed requests, exact envelopes, auth boot/redirect behavior, feedback, validation, and duplicate handling. |
| Adapt | `frontend/src/{main.jsx,App.jsx}`, `frontend/src/components/layout/{AppLayout,Header,Footer}.jsx`, `frontend/src/pages/{HomePage,DiscoverPage,WineDetailPage,CellarPage,LoginPage,SignupPage,ProfilePage}.jsx`, `frontend/src/styles/global.css` | Introduce typed providers/routes and the V2 design without deleting working flows; replacement navigation must retain auth/logout and accessibility. |
| Adapt to live data | `frontend/src/features/cellar/openCellar/{OpenCellarPage,CellarIntro,CellarControls,CellarScene,CellarSection,CellarZoomView,BottleMarker,BottleDetailPanel,EmptyCellarState}.jsx` | Keep useful interaction/presentation, but source protected data and mutations from the owner-scoped API with async states and rollback. |
| Quarantine | `frontend/src/features/cellar/openCellar/interactiveCellarData.js` and its eleven `frontend/public/images/cellar-wines/*.png` assets | Remove from protected `/cellar`; retain only if explicitly relabeled and isolated under read-only `/demo/*`. |
| Retire after parity | `frontend/src/features/cellar/cellarGrouping.js`, `frontend/src/features/cellar/components/{CellarBottleCard,CellarDetailPanel,CellarShelf}.jsx`, `frontend/src/features/cellar/openCellar/{openCellarData.js,BottleCard.jsx,CellarHero.jsx,CellarShelfSection.jsx,LoadingCellarState.jsx,ScrollCellarScene.jsx}` | These are disconnected or duplicate baseline implementations. Preserve until Prompt 09 proves no behavior or accessibility regression; strip inferred claims before any reuse. |
| Retire after parity | superseded V1 route/layout files, duplicate global CSS selectors, unused images/dependencies, and wildcard redirect | Remove only from an evidence-backed Prompt 09 dead-code pass after direct-route and flow coverage exists. |

## Baseline commands and results

The tables below summarize the results. The literal command/stdout/stderr capture, including repeated install/build output and the complete isolated smoke harness, is committed in [`01-baseline-command-output.txt`](./01-baseline-command-output.txt).

### Frontend

| Command | Result |
| --- | --- |
| `node --version` | PASS — `v20.19.6` |
| `npm --version` | PASS — `10.8.2` |
| `npm ls --depth=0` | PASS — direct dependencies resolved to the versions above |
| `npm ci` | FAIL, exit 243 — configured cache `/Volumes/LaCie/.npm-cache` was inaccessible (`EACCES mkdir`); npm partially cleaned `node_modules` |
| `npm ci --cache "$(mktemp -d)"` | PASS, exit 0 — added/audited 270 packages in about 4s; 110 funding notices; 8 audit findings (1 low, 3 moderate, 4 high) |
| `npm run verify:assets` | FAIL, exit 1 — missing script |
| `npm run lint` | PASS, exit 0 — no lint output/warnings |
| `npm run test` | FAIL, exit 1 — missing script |
| `npm run build` | PASS, exit 0 — Vite 5.4.21; 2,019 modules; `dist/index.html` 0.40 kB (0.27 gzip), CSS 60.96 kB (11.50 gzip), JS 354.77 kB (114.00 gzip); 1.86s |
| `npm run test:e2e` | FAIL, exit 1 — missing script |

`frontend/package-lock.json` SHA-256 was unchanged before and after install: `f9fc8e6bc1d7a5c3678e47ffcebb477fb81f2ea1115e909e923a21cc960bd555`. No lockfile change occurred. The successful install only restored ignored `node_modules`; the build produced ignored `dist`.

### Backend

| Command | Result |
| --- | --- |
| `.venv/bin/python --version` | PASS — Python 3.14.3 |
| `.venv/bin/python -m pip install -r requirements.txt` | PASS — all exact requirements already satisfied |
| `.venv/bin/python -m pip check` | PASS — `No broken requirements found.` |
| `pytest` | FAIL, exit 127 — command not found |
| `.venv/bin/python -m pytest --collect-only` | FAIL, exit 1 — `No module named pytest` |
| `.venv/bin/flask --app app routes` | PASS — confirmed the endpoint inventory above |
| Isolated `sqlite:///:memory:` API smoke | PASS — health, query validation, search, not-found, auth/session/logout, cellar create/list/patch/delete, and cross-owner GET/PATCH/DELETE `404` |
| Isolated CORS smoke | PASS — credential headers only for an allowed origin |

No persistent local database row was created or changed by the smoke test.

### Repository/reference inspection commands

The audit also used non-writing repository inspection commands (`git status`, `git remote`, `git rev-parse`, `git rev-list`, and `git ls-files`) plus `find`, `rg`, `sed`, `nl`, `du`, and lockfile/package probes. Required `git fetch --prune origin` updated remote-reference metadata but did not alter tracked files. Branch creation used:

```bash
git switch -c feat/grapevyne-cinematic-v2 origin/main
```

No reset, checkout overwrite, clean, delete, stash, merge, rebase, source overlay, or Prompt 02+ implementation command was run.

## Risks and blockers

1. **Protected mock data (release blocker):** `/cellar` is authenticated but does not read or mutate owned server data.
2. **Reference paths/media (phase blocker):** documented `framework/`, `web-ready/`, and integration paths are missing. Equivalent media is present elsewhere, but approval/prototype documentation conflicts and several files exceed stated budgets.
3. **No automated baseline suites:** required frontend scripts do not exist and pytest is neither pinned nor installed.
4. **No migration history:** Flask-Migrate is configured without a tracked migration repository or `alembic_version`; Prompt 08 cannot safely add columns until this is reconciled against existing databases.
5. **Contract mismatch:** reference normalizers and status/domain types do not match the real Flask envelopes and fields. Wholesale copying would break login, discovery, and cellar flows.
6. **Private cache/demo contamination:** unadapted reference query keys can retain one user's private data across logout/login, and demo wine detail can reach the authenticated save flow.
7. **Production auth topology:** default cookies/CORS/API URL are development settings; cross-site production needs deliberate Secure/SameSite/CORS/HTTPS configuration and a CSRF decision.
8. **Deployment is not baseline-ready:** no tracked deployment entrypoint/configuration, and the ignored database topology is local-only.
9. **Data integrity:** inline wine payloads accept client-supplied descriptive/rating/price fields with minimal validation; duplicate insert races become generic database errors; `tags` is not writable; JSON `true` passes as rating 1.
10. **Provider honesty/reliability:** discovery is static mock data with no live adapter, timeout, cache, retry, or provider error translation.
11. **Performance:** roughly 37 MB of tracked PNG assets and a 355 kB baseline JS chunk precede any cinematic/WebGL dependencies.
12. **Accessibility/interaction:** the responsive cellar detail panel lacks full dialog semantics/focus trapping; some animation behavior needs explicit reduced-motion verification.
13. **Tooling environment:** the configured npm cache path is unavailable on this machine; repeatable installs currently need an accessible cache override or corrected npm configuration.
14. **Dependency advisories:** npm reports eight unresolved findings, including four high severity. The audit did not run an automatic fix because that could change dependencies; Prompt 02 must inspect advisories and make tested, non-breaking updates deliberately.

## Prompt 01 phase report

### Files added, modified, moved, or deleted

- Added in the Prompt 01 commit: `docs/v2/01-baseline-audit.md`, `docs/v2/01-baseline-command-output.txt`, and `docs/v2/02-implementation-plan.md`.
- Locally modified outside the worktree: `.git/info/exclude`, with five narrow patterns for the user-supplied reference tree and pre-audit deployment adapters. This was changed before the documentation commit so the final clean-status gate does not require deleting or committing that local work.
- Modified tracked production files: none.
- Moved files: none.
- Deleted files: none.
- Preserved, still physically present, and intentionally uncommitted: `.grapevyne-v2-reference/`, `backend/.python-version`, `backend/main.py`, `backend/pyproject.toml`, and `vercel.json`.

### Contract and behavior changes

- API contract changes: none.
- Database/schema/data changes: none.
- Frontend/backend feature changes: none.
- Dependency/lockfile changes: none.

### Verification performed

- Automated/CLI: dependency install/checks, required-script probes, lint, production build, Flask route inventory, and 25 isolated API/auth/cellar/ownership/CORS assertions.
- Manually browser-verified screens/routes: none in Prompt 01; no dev server or browser session was started.
- Accessibility: source-level inspection only; no keyboard or screen-reader browser audit was performed.
- Reduced motion: existing source/CSS behavior was inspected; no browser reduced-motion session was performed.

### Decisions, tradeoffs, and next step

- Kept all production behavior untouched, including documented defects, to preserve the audit baseline.
- Used local excludes instead of deleting, stashing, or committing unrelated untracked material. A clean final `git status` therefore depends on those repository-local exclude entries while the files remain on disk.
- Treat the reference as an adaptation source because paths and contracts are inconsistent.
- Proposed Prompt 01 commit: `docs: audit GRAPEVYNE baseline for cinematic v2`.
- Next authorized step: Prompt 02 only, and only after an explicit request.

## Phase 01 exit state

- Feature behavior and production source: unchanged.
- Baseline failures: documented, not hidden.
- API, auth, cookie/CORS, model, WineService, and ownership contracts: documented.
- V2 reference: mapped as an adaptation source, never applied as a replacement.
- Later implementation: planned separately in `docs/v2/02-implementation-plan.md`, not executed.
