# Prompt 07 — Recommendation Verification

## Verdict and scope

Prompt 07 passes its implementation and verification gates on `feat/grapevyne-cinematic-v2`. The engine is deterministic, explainable, read-only, and limited to the six existing provider records. It adds no LLM, external recommendation service, runtime dependency, schema change, migration, persisted profile, media change, WebGL change, or deployment configuration.

The accepted Prompt 06 authentication, Flask session, exact-origin CORS, Fetch Metadata, owner-scoped cellar, expected-user mutation, response envelope, cache-isolation, cinematic media, and reduced-motion contracts remain intact.

## Automated verification

| Gate | Final result |
| --- | --- |
| `npm run verify:assets` | Pass: 3 foundational, 30 hash-locked cinematic video/poster, and 10 hash-locked WebGL assets. |
| `npm run lint` | Pass, zero warnings. |
| `npm run typecheck` | Pass. |
| `npm test` | Pass: 40 files, 268 tests. |
| `npm run build` | Pass: Vite 5.4.21, 2,315 modules, 4.50 seconds on the final same-origin build. |
| `npm run test:e2e` | Not defined; no placeholder was added. Real browser automation was used instead. |
| `.venv/bin/python -m pip check` | Pass: no broken requirements. |
| `.venv/bin/python -m pytest` | Pass: 171 tests, including all 81 accepted baseline tests. |
| Focused production/session/CORS/expected-user/recommendation suite | Pass: 75 tests. |
| `.venv/bin/python -m compileall -q app tests` | Pass. |
| `.venv/bin/flask --app app routes` | Pass; `GET /api/wines/recommendations` is present with existing auth, cellar, health, search, and detail routes. |
| `git diff --check` | Pass. |

Recommendation coverage includes parser categories and attributes, conservative negation, idiomatic and conflicting budgets, phrase ambiguity, stable output, unavailable dimensions, hard mismatches, nullable/incomplete provider fields, negative-only preferences, owner scoping, response privacy, validation, provider failures, exact-origin CORS, cache identity, cancellation, honest empty states, accessible score text, keyboard expansion, and server-confirmed saving.

## Browser matrix

Browser automation used the real Vite frontend, Flask API, and a disposable SQLite database under `/tmp`; it did not substitute fixtures in production UI paths.

Two disposable accounts established the privacy boundary without retaining credentials in this document:

- Account A: three meaningful signals across two canonical bottles; personalization `active`. Its private note marker never appeared in recommendation JSON or another account's UI.
- Account B: one neutral saved bottle and zero meaningful taste signals; personalization `insufficient_data`. Its response remained request-only and differed from Account A's personalized ranking.

Verified routes and states:

- `/` at 1,920 × 1,080: all nine semantic chapters, five cinematic videos, one WebGL canvas, no overlay, no console errors, no horizontal overflow.
- `/discover` with no query: one search input and no recommendation request.
- `/discover?query=a+bold+red+under+%2460+for+steak+night` at 1,440 × 900: deterministic anonymous result, budget evidence, limited-catalog disclosure.
- `/discover?query=crisp+white+for+oysters` at desktop and 390 × 844: sourced oyster match, concise live result status, `h2`/`h3`/`h4` hierarchy, no overflow.
- Celebration under $100, light salmon, gift from $40–$75, and something new but not sweet: controlled intent and evidence rendered honestly.
- Rosé request: honest no-meaningful-match state; no demonstration substitute.
- `mode=catalog`: only `/api/wines/search`; a one-character query is accepted, the input limit is 200, and no recommendation request is issued.
- Wine Detail with `request=` and direct Wine Detail without it: safe reconstructed context when available; direct bottle loading remains independent.
- Real API outage: backend-error panel, no false success, and no fixture substitution.
- Account A active state, Account B insufficient state, account switching, save success (`201`), and duplicate feedback (`409`).

Viewports were 390 × 844, 768 × 1,024, 1,440 × 900, and 1,920 × 1,080. Interactions included form submission, suggestion and mode buttons, browser back/forward, keyboard Enter on the native score-breakdown button, focus retention, mobile navigation open/Escape close, sign-in identity changes, save, and duplicate save.

## Network, cache, cancellation, and privacy

- The production bundle made one uncached `GET /api/wines/recommendations?query=crisp+white+for+oysters&limit=6`. React 18 development Strict Mode made two initial requests because of mount replay; both use abort-aware query functions.
- Discover and Wine Detail use the same limit `6` and the same query/identity key, allowing cache reuse for a selected result.
- A real rapid-query test delayed the first fetch, submitted a second query, observed the first `AbortSignal`, rendered only the second response, and showed no stale error.
- Initial/invalid requests make no recommendation call; catalog mode makes no recommendation call.
- Anonymous keys are `['public', 'wine-recommendations', query, limit]`; signed-in keys are `['private', userId, 'wine-recommendations', query, limit]`.
- Identity change/logout tests remove prior private recommendation state while retaining safe public entries. Confirmed cellar mutations invalidate only the owner's recommendation prefix. An unmounted save control suppresses stale feedback while still invalidating caches after confirmed success.
- Endpoint responses, including errors, use `Cache-Control: private, no-store` and `Vary: Cookie`.
- Unknown, repeated, and identity-selection parameters are rejected. No raw notes, tags, entry IDs, wine database IDs, or user IDs are selected into or returned as recommendation evidence. GET causes no database mutation.

## Accessibility and reduced motion

- axe WCAG 2 A/AA checks at desktop and mobile found zero violations. The desktop run retained one `incomplete` color-contrast item because automated computation could not resolve text over gradient backgrounds; it was not reported as a violation.
- The result live region is a concise status only; interactive cards are outside it. Wine Detail loading, failure, and ready context have explicit status/alert semantics.
- Result hierarchy is section `h2`, bottle `h3`, explanation `h4`; Wine Detail retains `h2` then `h3`.
- Score, confidence, reasons, cautions, and every dimension are available as text and do not rely on color.
- The native breakdown button reports `aria-expanded`/`aria-controls`, toggles with Enter, retains focus, and exposes all seven dimensions.
- At 390 px the result panel remained within the viewport; mobile navigation opened and closed with Escape without overflow.
- With `prefers-reduced-motion: reduce`, the media query matched, running animations were zero, the result remained readable, and no horizontal overflow appeared.

## Performance and bundle evidence

All sizes are minified raw/gzip kB from Vite output.

| Artifact | Accepted baseline | Prompt 07 final | Change |
| --- | ---: | ---: | ---: |
| Principal JS | 229.95 / 73.21 | 235.13 / 74.46 | +5.18 / +1.25 |
| Secondary shared JS | 70.29 / 27.84 | 70.29 / 27.84 | unchanged |
| Discover route | 7.28 / 3.12 | 15.83 / 5.45 | +8.55 / +2.33 |
| Wine Detail route | 8.35 / 3.06 | 8.44 / 2.99 | +0.09 / -0.07 |
| Shared CSS | 129.36 / 23.12 | 137.77 / 24.24 | +8.41 / +1.12 |
| Home CSS | 19.60 / 4.40 | 19.60 / 4.40 | unchanged |
| WebGL lazy chunk | 906.80 / 247.10 | 906.80 / 247.10 | unchanged |

New shared recommendation UI/API chunks are 6.50 / 2.60 kB and 17.50 / 6.23 kB. Product routes remain lazy, and no recommendation code entered the WebGL lazy graph.

Compact wire responses were 6,691 bytes for the anonymous steak query (two results) and 11,706 bytes for an active personalized red query (four results), including the trailing HTTP body newline. Direct service timing over the six-record catalog was:

| Scenario | Runs | Median | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| Anonymous steak request | 1,000 | 0.806 ms | 0.969 ms | 17.752 ms |
| Active personalized red request | 300 | 0.996 ms | 1.363 ms | 2.399 ms |

These local timings exclude network latency and should not be treated as production capacity benchmarks.

## Dependency and advisory comparison

No `package.json`, lockfile, Python dependency, or runtime package changed. `npm audit --json` used a fresh writable cache under `/tmp`, not `/Volumes/LaCie/.npm-cache`.

| Severity | Baseline | Final |
| --- | ---: | ---: |
| Low | 1 | 1 |
| Moderate | 5 | 5 |
| High | 4 | 4 |
| Critical | 0 | 0 |
| Total | 10 | 10 |

No audit fix was run. The accepted advisories are unchanged and remain a repository risk outside this dependency-free phase.

## Media, WebGL, and boundary confirmation

Asset verification passed before and after Prompt 07. Git boundary checks show no changes beneath final cinematic media, models, textures, the accepted media manifest, story chapter registry, WebGL scene targets/materials, migrations, models, dependency manifests, or deployment configuration. The existing >500 kB WebGL chunk warning remains unchanged.

The application still has no application-level request-rate limiter. The current provider is an in-memory six-record catalog and the endpoint has strict query/limit validation; deployment-level abuse controls remain a production operations concern. Prompt 08 remains solely responsible for a full Taste Profile/Taste Atlas. No Prompt 08 work is included here.

## Screenshot evidence

1. `docs/screenshots/prompt-07/01-anonymous-steak-night-desktop-1440x900.png`
2. `docs/screenshots/prompt-07/02-anonymous-oysters-mobile-390x844.png`
3. `docs/screenshots/prompt-07/03-parsed-intent-summary-1440x900.png`
4. `docs/screenshots/prompt-07/04-expanded-score-breakdown-keyboard-1440x900.png`
5. `docs/screenshots/prompt-07/05-limited-catalog-disclosure-1440x900.png`
6. `docs/screenshots/prompt-07/06-no-meaningful-match-1440x900.png`
7. `docs/screenshots/prompt-07/07-backend-unavailable-1440x900.png`
8. `docs/screenshots/prompt-07/08-wine-detail-why-it-fits-1440x900.png`
9. `docs/screenshots/prompt-07/09-signed-in-insufficient-data-1440x900.png`
10. `docs/screenshots/prompt-07/10-signed-in-active-personalization-1440x900.png`
11. `docs/screenshots/prompt-07/11-save-success-1440x900.png`
12. `docs/screenshots/prompt-07/12-duplicate-feedback-1440x900.png`
13. `docs/screenshots/prompt-07/13-second-user-isolation-1440x900.png`
14. `docs/screenshots/prompt-07/14-reduced-motion-discover-768x1024.png`
15. `docs/screenshots/prompt-07/15-home-media-webgl-1920x1080.png`
