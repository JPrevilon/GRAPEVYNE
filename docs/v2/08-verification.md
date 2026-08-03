# Prompt 08 — Verification

## Verdict and scope

Prompt 08 passes its local implementation and verification gates on
`feat/grapevyne-cinematic-v2`. The work preserves the accepted Prompt 07 API,
authentication, recommendation, media, typography, and WebGL contracts. No production
migration, deployment, external provider call, or Prompt 09 work was performed.

Browser verification used an isolated migrated SQLite database, two disposable accounts,
the real Flask API, and the real Vite application. The browser process, accounts, database,
temporary axe installation, and temporary npm caches were removed after capture. No test
credentials or private fixture text are retained in this document.

## Automated gates

| Gate | Result |
| --- | --- |
| `python -m pip check` | Pass. |
| Full Pytest | Pass: 238 tests. |
| Focused Prompt 07 recommendation regression | Pass: 90 tests. |
| Python compileall | Pass. |
| Flask routes | Pass; `/api/profile/taste` is registered as GET/HEAD/OPTIONS. |
| Asset verification | Pass: 3 foundational, 30 final video/poster, and 10 WebGL assets. |
| ESLint | Pass with zero warnings. |
| TypeScript | Pass. |
| Full Vitest | Pass: 42 files, 286 tests. |
| Production build | Pass: Vite 5.4.21, 2,323 modules. |
| `git diff --check` | Pass. |

The build retains the accepted warning for the separately loaded `ExperienceCanvas` chunk
(906.80 kB raw / 247.10 kB gzip). Prompt 08 added no visualization, WebGL, charting,
analytics, state-management, or other frontend dependency.

There is still no `test:e2e` package script. No placeholder script was added; the browser
checks below are real agent-browser sessions against the running applications.

## Migration verification

The tracked revisions are:

```text
0001_prompt07_baseline
└── 0002_prompt08_cellar_memories (head)
```

Seven focused migration tests exercise:

- a fresh upgrade from empty database to head;
- an unversioned Prompt 07 fixture stamped at `0001`, then upgraded;
- preservation of user, wine, and cellar IDs and values;
- nullable old-row values and post-upgrade memory writes;
- migrated-schema authenticated API create/read/update behavior and `flask db check`;
- downgrade to `0001` with core rows, constraints, and indexes retained;
- no DDL on ordinary application creation/startup;
- explicit `init-db` upgrade to head; and
- offline PostgreSQL upgrade and downgrade SQL generation.

SQLite batch migration and rollback were executed. PostgreSQL was not available, so only
offline PostgreSQL DDL generation was verified; no claim of live PostgreSQL execution is
made. No production migration ran.

## Performance and bounded-query results

The deterministic service fixture contained 2,506 rows: 2,500 manual/non-provider rows and
all six current provider wines. The same service instance received 20 warmups followed by
200 measured calls using `perf_counter_ns`; garbage collection was disabled only during the
measurement interval. All 200 serialized outputs were identical.

| Measurement | Result |
| --- | ---: |
| Median service time | 0.285562 ms |
| Nearest-rank p95 service time | 0.431500 ms |
| Minimum / maximum | 0.275000 / 0.952458 ms |
| Three-bottle active endpoint body | 4,010 bytes |
| 2,506-row active endpoint body | 2,666 bytes |
| Empty endpoint body | 841 bytes |

Response sizes use `len(response.get_data())`, include Flask's trailing newline, and exclude
headers and compression. They are fixture-dependent.

SQLAlchemy statement instrumentation reported the same bounded set for 0, 3, and 2,506
rows: **2 total statements, 1 cellar statement, 0 relationship-load statements**. Those
statements are the session-owner lookup and one owner-filtered `cellar_entries JOIN wines`
narrow projection. The projection excludes note, memory-title, location, and opened-with
text. No N+1 behavior was observed.

The timing covers service calculation rather than database latency, authentication, or JSON
encoding. It is a local single-process SQLite measurement, not a concurrent-load or
PostgreSQL query-plan benchmark.

## Frontend bundle comparison

Exact byte counts use `wc -c`; gzip counts use `gzip -c | wc -c`.

| Output | Prompt 07 raw / gzip | Prompt 08 raw / gzip | Delta raw / gzip |
| --- | ---: | ---: | ---: |
| Profile route | 2,368 / 1,207 | 10,079 / 3,715 | +7,711 / +2,508 |
| Cellar route | 18,925 / 6,358 | 28,242 / 9,044 | +9,317 / +2,686 |
| Shared CSS | 137,769 / 24,310 | 147,451 / 25,655 | +9,682 / +1,345 |

The final artifacts were `ProfilePage-Cud_WJpG.js`, `CellarPage-LwTtgJv6.js`, and
`index-01Es9frr.css`. There is no new dependency-size contribution because dependency and
lock files are unchanged.

## Browser, network, and privacy verification

The live flow covered:

1. User A started with an empty cellar and empty profile.
2. Three distinct records from the real current WineService catalog were saved.
3. Rating, favorite, occasion, status, memory title, tasted date, location, pairing,
   opened-with, tags, note, and tri-state buy-again values were edited and read back after a
   full refresh.
4. Profile state moved `empty` → `limited` → `active`.
5. Changing rating 5 → 4 changed the Cabernet signal from 31.4 to 25.5 and the Red signal
   from 52.9 to 48.9 in that fixture.
6. Clearing favorite removed the Cabernet signal, changed Red from 48.9 to 31.4, and reduced
   the signal count from 18 to 17; restoring the values restored the prior profile.
7. Explicit buy-again was changed from true to false, persisted as false rather than null,
   and recalculated the owner profile.
8. Deleting a contributing entry changed the profile from active (3 meaningful wines, 18
   capped signals) to limited (2 meaningful wines, 14 capped signals) and removed the
   adjacent suggestion.
9. The adjacent suggestion linked to the real
   `/wines/mock-la-rioja-alta-reserva-2018` detail route.
10. Browser back and forward navigation between protected routes preserved complete internal
    return behavior.

For User B, User A's real entry ID and a nonexistent ID returned the same `404
cellar_entry_not_found` code and message for GET, PATCH, and DELETE. User B's profile remained
empty and recommendation personalization reported `insufficient_data`; User A's profile and
active recommendation personalization remained owner-scoped. Switching accounts removed the
old account's cellar/profile content immediately.

Verified requests included `/api/auth/me`, authenticated Cellar GET/POST/PATCH/DELETE,
`/api/profile/taste`, `/api/wines/recommendations`, public wine detail, login/logout, and the
same-origin Vite proxy path. The profile response had `private, no-store` and `Vary: Cookie`.
A targeted aborted `/api/profile/taste` request produced the truthful no-demo network-error
state; removing the route restored the real profile. Demo Cellar and Demo Taste Atlas made
no request to `/api/cellar` or `/api/profile/taste`.

Profile and recommendation JSON, demo DOM, public homepage DOM, URLs, and browser console
were checked for private memory strings. None leaked. The console contained only expected
Vite/React development diagnostics and dev-server reconnection chatter, with no uncaught
page errors or private values.

## Responsive and interaction results

Profile was measured at every required viewport:

```text
360 × 800
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
1920 × 1080
```

At each size, document `scrollWidth` equaled `clientWidth`. Cellar detail was also opened at
430 × 932, 1024 × 768, and 1440 × 900 with no horizontal overflow or clipping. The 360 px
editor remained document-scrollable without a nested scroll trap. A server-confirmed
160-character memory title wrapped within a 320 px card (`scrollWidth === width`) and was
then restored. Date and tri-state controls fit their mobile captures; the Atlas switches to
a label-safe stacked layout and has no canvas intercepting controls. Dynamic wine names keep
source casing.

Normal homepage mode produced one ready WebGL canvas and all nine chapters. A reduced-motion
session produced zero running animations, zero canvas, nine chapters, and the CSS fallback.
A separate no-WebGL capability probe returned false and produced zero canvas, the CSS bottle
fallback, and all nine chapters.

## Accessibility: automated results

axe-core 4.10.3 was installed only in a disposable temporary directory and injected into the
real browser. Populated Cellar desktop/mobile; empty, limited, and active Profile
desktop/mobile; and Demo Taste Atlas each reported **zero WCAG 2 A/AA violations**. The
network-error and reduced-motion views also reported zero violations.

`color-contrast` was marked incomplete because composited gradients/media prevent axe from
computing a reliable background. This is reported as an automation boundary, not silently
counted as a pass.

## Accessibility: manual results

Manual browser and visual review confirmed one meaningful H1 per route, logical visible
headings, explicit form labels/descriptions/errors, live feedback, visible focus, minimum
usable touch targets, non-color node shapes and labels, keyboard focus/selection with
`aria-pressed`, the adjacent readable text Atlas, and no hover-only conclusion. The inline
detail panel is not modal; closing it restores focus to its bottle trigger, as covered by
the interaction test. Reduced motion produced `0` running animations and a `0.00001s`
transition duration.

Text remained visually readable over the reviewed solid and overlaid backgrounds. Exact
contrast on composited video/gradient frames remains a device/browser manual-QA boundary and
should be rechecked when cinematic media or color tokens change.

## Assets, dependencies, and advisories

Both pre-change and final asset verification passed. Prompt 08 changed none of the 30 final
media binaries, desktop/mobile GLBs, label PNGs, Raleway/Jost packages, WebGL scene targets,
materials, or accepted title tokens.

No Python or frontend dependency manifest/lockfile changed. `Flask-Migrate==4.0.7` was
already pinned and is now used by the tracked migration scaffold. `pip check` passes.

`npm audit` ran with a disposable writable `/tmp` cache, which was removed. The result is
unchanged from accepted Prompt 07: **10 total — 1 low, 5 moderate, 4 high, 0 critical**. No
forced remediation or framework upgrade was attempted.

## Screenshot evidence

The 20 required captures are in [`docs/screenshots/prompt-08`](../screenshots/prompt-08).
Most long routes are full-page captures taken at the viewport named in the filename; targeted
interaction captures use the exact viewport frame. The set covers empty/populated Cellar,
desktop/mobile editor, refresh persistence, tri-state input, groups, empty/limited/active
Profile, readable Atlas, adjacent suggestion, network failure, User B isolation, public demo
disclosures, homepage Atlas, and reduced motion.

## Remaining boundaries

- The current provider remains a fixed six-record demonstration catalog.
- Controlled tags/pairings/occasions intentionally ignore unknown private text.
- Profiles are calculated per request and are not shared or server-cached.
- PostgreSQL DDL was generated offline but not executed against a live PostgreSQL service.
- Performance measurements are local, single-process, and uncompressed.
- No social sharing, public memories, LLM, embeddings, external AI API, vector database, or
  machine-learning profile was added.
- There is no package-level `test:e2e` script; real browser automation is documented above.
- Composite-background contrast retains the manual verification boundary described above.
