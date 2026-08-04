# GRAPEVYNE cinematic V2 implementation plan

Status: planning output from Prompt 01 only. No phase below has started.

## Operating rules for every phase

- Read `01-baseline-audit.md` and the master rules before changing code.
- Adapt reference patterns into the real repository; never replace working source wholesale.
- Keep one focused commit per phase. Preserve unrelated/local work.
- Do not delete an existing route or implementation until equivalent behavior has an automated test and passes.
- Treat Flask, its authenticated session, response envelopes, WineService boundary, and owner-scoped cellar queries as contract-first dependencies.
- Keep public fixtures visibly labeled and confined to `/demo/*` or an explicit public discovery network-failure fallback. Never substitute them for `/cellar` or `/profile`.
- Use sourced or explicitly curated data only. Missing values stay missing; no generated wine facts, scores, testimonials, awards, provenance, or timestamps.
- At every gate run all scripts that exist among `npm run verify:assets`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, and backend `pytest`; report skipped/missing commands exactly.
- Stop a phase when its gate fails. Record the failure before starting the next phase.

## Dependency order

```text
02 typed foundation and exact API adapters
  -> 03 accessible product routes/design system
    -> 04 semantic cinematic story/media shell
      -> 04A approved final media (blocked until provenance/status is resolved)
      -> 05 lazy persistent WebGL enhancement
        -> 06 verified live auth/API integration
          -> 07 explainable recommendations
            -> 08 persisted memories/private Taste Atlas
              -> 09 full quality hardening and dead-code removal
                -> 10 preview, production, and recruiter release
```

Prompt 04A is treated as a media sub-gate between Prompts 04 and 05. Its exact `web-ready/` and `integration/` paths are absent, although equivalent files exist in the reference frontend. It must not run until their conflicting final/prototype status and provenance are resolved.

## Prompt 02 — typed frontend foundation

### Planned work

- Add strict TypeScript and `@/` incrementally; leave working JSX in place until ported safely.
- Define exact domain types for current `User`, `Wine`, `CellarEntry`, recommendation, and Taste Profile data.
- Introduce TanStack Query and the scene-context shell without a canvas; keep exactly one `BrowserRouter` and adapt the existing auth/toast providers.
- Build transport and normalizers around the real `{data:...}` / nested-error envelopes, current camelCase serializers, current five-value cellar status enum, and `credentials: include`.
- Add route-level lazy loading and meaningful route loading/error states.
- Add `/demo/cellar` and `/demo/taste-atlas` with isolated, visibly labeled, read-only fixtures.
- Port/wrap all current routes without changing their URLs. Reconnect protected `/cellar` to live owned entries before removing the fixture import.
- Copy only present, approved/provenance-checked assets using a manifest; add asset verification. Do not invent missing media.
- Add unit tests for response normalization, auth boot state, protected-route return behavior, and demo isolation; add a direct-route production-build smoke.

### Gate

- Login, signup, logout, discovery, wine detail, save, protected cellar CRUD, and profile routing retain or improve baseline behavior.
- Strict type-check/build passes; all exact API adapter tests pass.
- `/demo/*` is visibly separate and cannot contaminate authenticated state.
- `verify:assets` exists and passes for assets actually approved/present.
- Initial route chunk has no WebGL dependency.
- Direct loads and back/forward work for every existing and new route.

Suggested commit: `feat(frontend): establish GRAPEVYNE v2 typed route foundation`

## Prompt 03 — design system and product routes

### Planned work

- Implement the approved color, typography, spacing, surface, elevation, radius, and motion tokens with licensed/system font delivery.
- Build accessible reusable buttons, fields, notices, state panels, wine cards/fallbacks, navigation/drawer, panel/modal, and live-region feedback.
- Redesign live `/discover`, `/wines/:wineId`, `/login`, and `/signup` without weakening real API, validation, session, duplicate, error, or return-route behavior.
- Finish public, visibly read-only demo cellar/Taste Atlas routes.
- Preserve semantic DOM and keyboard access; add no scroll pinning or WebGL.
- Verify 360, 390, 430, 768, 1024, 1440, and 1920 pixel widths.

### Gate

- Product routes have final-quality baseline styling and honest loading, empty, error, and network-fallback states.
- Keyboard order, labels, focus, dialogs/panels, and feedback pass an accessibility smoke.
- No mobile horizontal overflow; screenshots exist for core routes and target widths.
- All phase-02 API/auth/ownership tests and the production build remain green.

Suggested commit: `feat(ui): redesign GRAPEVYNE product routes and design system`

## Prompt 04 — semantic cinematic scroll story

### Planned work

- Build all nine homepage chapters in normal semantic document order before animation: Hero, Discovery, Match, Taste, Portal, Cellar, Memory, Atlas, Finale.
- Keep copy, search, labels, controls, memory text, Taste Atlas summaries, CTAs, and engineering panel as readable DOM.
- Add fixed navigation and keyboard-operable chapter progress.
- Add GSAP/ScrollTrigger and Lenis with a single owner per property, React Strict Mode cleanup, reversible scroll, shorter/no pinning on mobile, and no scroll trap.
- Add responsive video/poster behavior only for assets that are actually present and approved: correct desktop/mobile source, WebM/MP4 fallback, offscreen pause, autoplay-blocked behavior, reduced-motion poster, and no mandatory loader.
- Keep homepage search linked to `/discover?query=...`; every CTA must land on a real route.

### Gate

- The complete story remains readable and navigable with animation disabled, autoplay blocked, reduced motion, and keyboard-only input.
- Mobile portrait media works; offscreen video pauses; reverse scroll works.
- No duplicate ScrollTriggers, console warnings, broken CTA, or route regression.
- No WebGL has been introduced.

Suggested commit: `feat(experience): add cinematic From Vine to Memory scroll story`

## Prompt 04A — approved final media sub-gate

### Entry blocker

Do not begin until the user confirms that the equivalent files under `frontend/public/assets/video/` and `frontend/src/experience/` are the approved replacements for the absent documented paths, or supplies other verified assets. Reconcile the final-versus-prototype documentation and measured budget overruns first.

### Planned work after unblock

- Copy the complete approved video tree without renaming; update the asset manifest.
- Adapt final media behavior to the real app: hero/liquid/memory loop; cellar/atlas play once, hold ending frame, and reset only after leaving the viewport.
- Keep the live bottle and all product content outside video; position the bottle over the hero pedestal; keep live Atlas data readable above its treated background.
- Eagerly preload only the current viewport's hero asset; lazy-load later chapters and switch responsive sources cleanly.
- Retain poster fallbacks and verify every file is silent, final, and free of prototype media.

### Gate

- Asset verification, lint, unit tests, and build pass.
- Desktop/mobile browser checks show correct sources, no missing/prototype media, no audio, correct one-shot endings, readable overlays, reduced-motion posters, and no console errors.

## Prompt 05 — persistent WebGL enhancement

### Planned work

- Add one lazy, fixed React Three Fiber canvas after core hero DOM is usable; isolate Three/R3F/Drei in a separate chunk.
- Validate all required GLB nodes before integration and fail to an accessible DOM/CSS fallback when models/WebGL fail.
- Add the persistent bottle, restrained pointer response, chapter targets, reusable label/material contract, lighting, low-cost accents, and cellar transition primitives.
- Cap DPR by device tier, use mobile model/material budgets, cache/clone safely, dispose created resources, avoid click/scroll interception, and pause when hidden where practical.
- Do not mount decorative WebGL for reduced motion unless a justified static need remains.

### Gate

- Initial content and critical routes do not wait for WebGL.
- Model failure, disabled WebGL, mobile/integrated graphics, repeated navigation, hidden document, and reduced-motion paths work.
- There is one canvas, no duplicate context/listener, no observed leak, and all essential information remains in DOM.

Suggested commit: `feat(webgl): add persistent GRAPEVYNE bottle scene`

## Prompt 06 — verified authentication and live API integration

### Planned work

- Recompare every frontend call/test with exact live Flask success/error envelopes; adapt clients instead of renaming stable backend fields.
- Verify current-user boot, signup, login, logout, session refresh persistence, pending/error feedback, and complete query/hash return paths.
- Decide and test the production session topology: cookie `Secure`/`SameSite`, exact credentialed CORS, HTTPS, and CSRF mitigation.
- Keep discovery on WineService; add cancellation, controlled caching, timeout, and meaningful errors. Permit labeled public demo fallback only for network unavailability and an explicit flag.
- Reverify and harden the live protected-cellar list/add/update/delete transition completed in Prompt 02. Add optimistic behavior only with rollback. Continue deriving owner identity only from the session.
- Add two-user integration coverage for read, patch, and delete isolation plus duplicate-save tests.

### Gate

- All real auth, discovery, wine detail, and cellar flows pass locally and in the intended deployment topology.
- Two-user ownership regression tests prove cross-owner GET/PATCH/DELETE remain indistinguishable `404`s.
- Demo data cannot enter protected queries or mutations; network failures are visible and recoverable.
- Production cookie/CORS/CSRF decisions are documented and tested.

Suggested commit: `feat(api): complete authenticated GRAPEVYNE v2 integration`

## Prompt 07 — deterministic explainable recommendations

### Planned work

- Preserve `WineService.search(query)` and exact lookup; add recommendation behavior behind an adapted service boundary rather than replacing the working interface.
- Normalize only sourced/curated provider fields. Parse category, food, occasion, style, maximum price, region, and varietal deterministically.
- Implement and test the specified 30/25/15/10/10/5/5 weighting for pairing, personal taste, requested style, budget, occasion, confidence, and discovery balance.
- Return 0–100 `matchScore`, confidence, field-backed reasons/cautions, and matched tags. Missing price/data must lower confidence, never create facts.
- Use private aggregate history only for authenticated personal-fit scoring; guests receive request-only scoring and an honest explanation.
- Add input validation, provider timeout/cache/error handling, and rate limiting; retain basic search.

### Gate

- Deterministic fixtures prove relevant sourced wines outrank unrelated ones, scores remain bounded, reasons map to present fields, and missing data yields limited confidence.
- Personal history affects only personal-fit weight and never leaks another user's entries.
- UI and endpoint support natural requests without breaking ordinary discovery.

Suggested commit: `feat(recommendations): add explainable wine matching service`

## Prompt 08 — persisted cellar memories and private Taste Atlas

### Planned work

- Reconcile the existing database with Flask-Migrate, establish a safe baseline, and add nullable `tasted_on`, `location`, `pairing`, `would_buy_again`, `opened_with`, and `memory_title` columns with tested upgrade/downgrade behavior.
- Extend server validation/serialization and every owner-scoped mutation; make existing `tags` genuinely writable if retained.
- Build protected `/cellar` sections from real entries and provide a complete accessible grid/list alternative to any shelf visualization.
- Derive `/api/profile/taste` only from the signed-in user's persisted entries: varietals/styles, regions, sourced flavor tags, price range, occasions, favorites, and buy-again behavior.
- Represent empty/limited evidence honestly; make any adjacent-style suggestion controlled and explainable.
- Keep `/demo/cellar` and `/demo/taste-atlas` curated, public, labeled, read-only, and entirely separate from user storage.

### Gate

- Upgrade preserves every existing row; downgrade behavior is documented/tested.
- Every new memory field survives refresh and all mutations enforce current-session ownership.
- Taste Profile changes predictably with the current user's ratings/favorites and never reads another user's records.
- Empty/limited states are honest; demo mutation attempts cannot persist and direct visitors to signup.

Suggested commit: `feat(cellar): add tasting memories and personal Taste Atlas`

## Prompt 09 — quality hardening

### Planned work

- Complete the reference test matrix: frontend unit, backend unit/integration, and end-to-end public/auth/cellar/demo/ownership/navigation flows.
- Test Chromium desktop, mobile emulation, reduced motion, autoplay blocked, and WebGL failure/disabled paths.
- Audit keyboard access, focus, headings/landmarks, labels/errors, actual-frame contrast, readable cellar/Atlas alternatives, silent-by-default media, and non-hover controls.
- Record bundle/chunk/media/model sizes, dynamically import optional systems, pause offscreen work, fix layout shift/listener leaks, remove unused assets/dependencies, and test throttled mobile.
- Add route/canvas error boundaries, API timeout/retry behavior, direct-route/back-forward coverage, and console/unhandled-promise assertions.
- Remove dead V1 files only after equivalence is proven.
- Publish `docs/v2/quality-report.md` with evidence, screenshots, limitations, accessibility findings, and bundle analysis.

### Gate

- Asset verification, lint, frontend tests, backend tests, production build, and E2E all pass.
- No critical accessibility issue, console error, unhandled rejection, ownership regression, or core route dependency on WebGL.
- Budgets pass, or release remains blocked with a concrete measured fix.

Suggested commit: `test: harden GRAPEVYNE v2 for production release`

## Prompt 10 — Vercel and recruiter release

### Preconditions

Prompt 09 must pass, the worktree must be clean, secrets must remain outside source/logs, and the existing Vercel project/link must be inspected before creating anything.

### Planned work

- Choose the verified topology and configure Vite build/output, SPA rewrites, `/api/*` routing or production API base, cache headers, environment variables, and secure session/CORS settings.
- Reconcile the untracked pre-audit Vercel adapters with the final tracked architecture; do not create a duplicate project.
- Deploy preview first. Smoke and E2E direct loads for `/`, `/discover`, a real wine detail, both `/demo/*` routes, signup, login, `/cellar`, and `/profile`.
- Review network/console, authentication refresh, ownership, media, mobile, reduced motion, fallbacks, metadata, and database persistence against the preview URL.
- Deploy production only after preview approval; repeat the checks.
- Rewrite README with live URL, screenshots, architecture, matching method, privacy/ownership, accessibility/performance, setup/env/tests/deployment, and honest tradeoffs.
- Add final social metadata, icons, canonical URL, theme color, and custom 404.
- Complete the recruiter checklist and `docs/v2/release-report.md`; tag only the verified production commit.

### Gate

- Production direct routes, demo, signup/login/session refresh, protected cellar, private Taste Atlas, ownership isolation, mobile, reduced motion, fallbacks, metadata, and README are verified.
- Release report names the URL, immutable SHA/tag, commands/results, measured performance, known limitations, demo flow, and recruiter-ready summary.
- No secret is committed or printed and no duplicate Vercel project was created.

Suggested commit: `chore(release): publish recruiter-ready GRAPEVYNE v2`

## Current authorization boundary

Stop here after Prompt 01. The next authorized action, if requested, is Prompt 02 only. Nothing in this plan authorizes copying the reference framework, changing production behavior, adding dependencies, running migrations, deploying, or executing any later phase now.
