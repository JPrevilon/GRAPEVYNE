# Prompt 06A — Montfort-inspired typography and art direction

Audit date: 2026-08-02

Branch: `feat/grapevyne-cinematic-v2`

Accepted Prompt 06 commit: `3bdfff71e8730d19fcdee67401e305488bc398f9`

## Verdict

GRAPEVYNE now uses the **Precision Cellar Index** typography system. The
rejected Archivo Black, Archivo Variable, and Barlow Condensed identity is
gone from application imports, dependencies, fallback stacks, and computed
styles. Raleway Variable gives major static headings a light architectural
shape; Jost Variable carries body, interface, navigation, directory, and
metadata roles with a calmer monoline rhythm.

The two supplied Montfort screenshots informed only the principles of lighter
geometric letterforms, controlled positive tracking, asymmetrical title scale,
generous space, and readable airy body copy. No Montfort logo, artwork, color
system, page composition, proprietary font, or font file was copied. The
screenshots were not added to the repository.

This phase is frontend typography and layout art direction only. It changes no
Flask route, backend configuration, database model, schema, migration, API
envelope, authentication contract, session key, CORS rule, wine catalog,
production media, WebGL binary, label binary, manifest, hash, or deployment
configuration. Prompt 07 recommendation work and Prompt 08 Taste Atlas work
remain deferred.

## Self-hosted font system

Both faces are exact Fontsource `5.3.0` dependencies and are emitted by Vite as
same-origin WOFF2 assets. Only their variable `wght.css` entry points are
imported.

| Role | Exact token | Package and version |
| --- | --- | --- |
| Display | `"Raleway Variable", "Raleway", "Helvetica Neue", Arial, sans-serif` | `@fontsource-variable/raleway@5.3.0` |
| Body/UI | `"Jost Variable", "Jost", "Helvetica Neue", Arial, sans-serif` | `@fontsource-variable/jost@5.3.0` |
| Directory/metadata | `"Jost Variable", "Jost", "Helvetica Neue", Arial, sans-serif` | `@fontsource-variable/jost@5.3.0` |

Removed packages are `@fontsource/archivo-black`,
`@fontsource-variable/archivo`, and `@fontsource/barlow-condensed`. There is no
remote font stylesheet, font CDN, arbitrary download, or proprietary binary.
The document uses `font-synthesis: none` and `font-optical-sizing: auto`; body
text uses `text-rendering: optimizeLegibility`. Stable system fallbacks allow
semantic content to render without a mandatory font loader.

The production build emits these font assets:

| Asset | Raw size |
| --- | ---: |
| Jost Cyrillic variable weight | 10,140 B |
| Jost Latin Extended variable weight | 17,104 B |
| Jost Latin variable weight | 26,576 B |
| Raleway Vietnamese variable weight | 11,384 B |
| Raleway Cyrillic variable weight | 25,864 B |
| Raleway Cyrillic Extended variable weight | 26,988 B |
| Raleway Latin Extended variable weight | 31,480 B |
| Raleway Latin variable weight | 48,264 B |
| **Total** | **197,800 B** |

The replaced Fontsource output was approximately 236.02 kB, so the new emitted
font set is approximately 38.22 kB smaller while retaining local variable
weight axes.

## Weight, size, tracking, and leading scales

The visible system uses a deliberately narrow weight range:

- display segments: light `300`, regular `400`, or medium `500`;
- large narrative copy: `350`;
- normal body and UI copy: `350–400`;
- navigation, directory labels, metadata, and buttons: `400–500`;
- no authored visible typography uses `700`, `800`, or `900`;
- small explanatory copy remains at least `0.82rem` and weight `400` where it
  needs the extra legibility.

The centralized display tokens are:

| Role | Exact value |
| --- | --- |
| Hero large | `clamp(3.35rem, 6.1vw, 6.15rem)` |
| Hero medium | `clamp(2.35rem, 4.1vw, 4.15rem)` |
| Hero small | `clamp(1.25rem, 2.1vw, 2.1rem)` |
| Hero micro | `clamp(0.95rem, 1.3vw, 1.3rem)` |
| Chapter large | `clamp(2.4rem, 4.3vw, 4.35rem)` |
| Chapter medium | `clamp(1.9rem, 3.25vw, 3.3rem)` |
| Chapter small | `clamp(1.05rem, 1.8vw, 1.75rem)` |
| Chapter micro | `clamp(0.88rem, 1.15vw, 1.1rem)` |
| Product large | `clamp(2.7rem, 4.8vw, 5rem)` |
| Product medium | `clamp(2rem, 3.4vw, 3.55rem)` |
| Product small | `clamp(1.05rem, 1.75vw, 1.7rem)` |
| Product micro | `clamp(0.86rem, 1.1vw, 1.08rem)` |
| Narrative copy | `clamp(1.2rem, 1.85vw, 1.85rem)` |

Mobile has an explicit composition rather than a uniformly reduced desktop
heading: hero large becomes `clamp(2.5rem, 12vw, 3.9rem)`, and chapter/product
focal segments become `clamp(2rem, 9.5vw, 3.25rem)`.

Display line-height ranges from `0.94` for focal segments through `1.05` for
micro segments. Segment tracking is always positive: `0.022em` large,
`0.045em` medium, `0.09em` small, and `0.15em` micro. Navigation uses
approximately `0.095em`; brand display uses `0.12em`; directory and eyebrow
roles use approximately `0.075–0.12em`. The old negative Archivo display
tracking is absent.

Large story ledes use Jost `350`, `clamp(1.2rem, 1.85vw, 1.85rem)`, `1.52`
line-height, `0.025em` tracking, and controlled line lengths. Standard copy
uses Jost `350–400`, approximately `1.55–1.65` line-height, positive tracking,
and sentence case. Body punctuation, API copy, wine names, winery names, user
names, email addresses, occasions, and notes remain source-authored.

## Multi-scale heading component

`DirectoryHeading` renders one semantic `h1` or `h2` with one uninterrupted
`aria-label`. Its visible segment grid is `aria-hidden`, so visual grouping
cannot make a screen reader announce fragments or duplicate the title. Each
segment has one of four finite sizes, three finite weights, an optional
champagne accent, an optional row, and a finite start/inset/end placement.
There are no letter-by-letter spans, CSS-only important words, nested headings,
or independently animated words.

The component is used for all nine homepage chapter headings and the focal
static H1 on Discover, Cellar, Profile, Demo Cellar, Demo Taste Atlas, Login,
and Signup. `PageShell` has an explicit composed-heading slot so a reusable H1
cannot be nested inside its previous H1 wrapper. Dynamic wine-detail names and
dynamic cellar/wine records intentionally remain normal semantic headings with
their provider casing.

The locked homepage compositions are:

| Accessible title | Visible grouping |
| --- | --- |
| `FIND THE BOTTLE KEEP THE MEMORY` | `FIND THE` small/light; `BOTTLE` large/regular; `KEEP THE` micro/light; `MEMORY` medium/regular/champagne |
| `DESCRIBE THE MOMENT` | `DESCRIBE` small/light; `THE MOMENT` large/regular |
| `WHY IT FITS` | `WHY` micro/light; `IT FITS` large/regular |
| `TASTE TAKES SHAPE` | `TASTE` small/light; `TAKES SHAPE` large/regular |
| `OPEN THE CELLAR` | `OPEN` small/light; `THE CELLAR` large/regular |
| `BUILD THE COLLECTION` | `BUILD` small/light; `THE COLLECTION` large/regular |
| `REMEMBER THE POUR` | `REMEMBER` small/light; `THE POUR` large/regular |
| `YOUR TASTE ATLAS` | `YOUR` micro/light; `TASTE ATLAS` large/regular |
| `KEEP THE STORY` | `KEEP` small/light; `THE STORY` large/regular |

All nine original chapter IDs remain unchanged. Major static display titles are
uppercase and punctuation-free. Confirmed-unused legacy static headings were
normalized only so the whole authored frontend obeys the same static-title
contract; their behavior and structure were not replaced.

## Route-by-route refinement

- **Home:** all nine H1/H2 titles use the asymmetric segment system. Narrative
  copy is lighter and airier, while the search, cinematic subject, and bottle
  remain the visual foreground. Portal and Taste Atlas headings use deliberate
  right-side alignment because their bottle targets occupy the left.
- **Discover:** `DISCOVER / WINES` uses the product scale. Search, cancellation,
  failure, retry, filters, real API rows, and provider casing are unchanged;
  record indexes and metadata now use lighter Jost directory styling.
- **Wine detail:** the sourced wine name remains mixed case in Raleway at the
  product scale. Supporting labels and fact rails use Jost without rewriting
  provider data. Real save and duplicate behavior is unchanged.
- **Cellar:** `YOUR / CELLAR` frames thinner indexed owner-scoped records.
  Selection, edit, favorite, rating, status, note, occasion, duplicate, and
  delete contracts remain server-confirmed.
- **Profile:** `TASTE / PROFILE` surrounds the real signed-in name and email.
  The Taste Atlas notice remains explicitly deferred and does not invent a
  profile.
- **Demo Cellar:** `DEMO / CELLAR` is paired with the existing prominent public,
  fictional, read-only disclosure; no private API or mutation control is
  introduced.
- **Demo Taste Atlas:** `DEMO / TASTE ATLAS` keeps its illustrative disclosure
  and read-only fixture boundary.
- **Login/Signup:** `RETURN TO / YOUR CELLAR` and `CREATE / YOUR CELLAR` use the
  same product system around unchanged labels, descriptions, autocomplete,
  validation, busy states, and safe return-path logic.

## Brand, navigation, and controls

The live DOM BrandLockup preserves the approved decorative monogram. Its
selectable `GRAPEVYNE` name now uses Raleway `400` with `0.12em` tracking; the
`PRIVATE WINE DIRECTORY` descriptor uses Jost `400` with wider tracking. The
same component remains in desktop/mobile navigation, the drawer, footer,
authentication framing, and appropriate homepage surfaces.

Desktop navigation, chapter progress, drawer routes, directory labels, and
metadata now use Jost `400–500`, positive tracking, tabular numbers where
applicable, finer dividers, and more space. Existing active indicators remain.
Buttons use Jost `500`, moderate tracking, smaller radii, and thin secondary
borders. Inputs retain generous spacing, visible focus, labels, descriptions,
errors, autocomplete, and readable text. Functional filters remain functional;
no control was converted into decorative UI.

## Accessibility and font-loading decisions

- Every verified route has one meaningful H1 and coherent heading order.
- The segmented visual layer is hidden once from assistive technology while
  its containing semantic heading exposes the exact full accessible name.
- Skip navigation, route announcements, focus styling, chapter links, drawer
  dialog semantics, Escape, forward/reverse focus trap, focus return, body
  lock, form descriptions, live feedback, and reduced-motion behavior remain.
- Dynamic/API/user strings are explicitly outside automatic uppercase rules.
- There is no WebGL or Troika text; every heading remains semantic DOM text.
- `document.fonts.ready` still causes one guarded `ScrollTrigger.refresh()`.
  The callback cannot revive a disposed homepage, does not add a loader, and
  does not duplicate triggers.
- The browser reached `document.fonts.status === "loaded"`; both variable faces
  passed `document.fonts.check`, all WOFF2 resources came from the Vite origin,
  and no layout-shift entries were observed after font readiness.
- Axe-core 4.12.1 found zero violations on Home, Discover, both public demos,
  Login, and Signup. Manual keyboard review also covered drawer focus cycling,
  Escape, return focus, protected-route redirects, and form use.

## Scroll story, WebGL, and media findings

The Raleway geometry did not require any scene-target recalibration. No WebGL
target, camera, material, model, label, capability, context-loss, or lifecycle
value changed. At 1440×900, all nine heading bounds and every segment remained
inside the viewport; Portal and Taste Atlas preserved the intended left-side
bottle clearance. A capable desktop session reached one high-tier canvas and
the ready handshake. At scroll position 1,800 px, Lenis remained active,
ScrollTrigger advanced story progress to `0.2075`, chapter progress to
`0.1308`, and the active chapter to `03 / MATCH LOGIC`.

Reduced motion created no canvas and used normal-flow fallback media. A separate
capability/fallback session also rendered the CSS bottle with no canvas. The
active hero video loaded from the existing local path at readyState 4, played
without an error, and no media or poster binary changed. The fallback, bottle,
chapter rail, title groups, search UI, and cinematic subjects showed no observed
overlap or horizontal overflow at the required responsive sizes.

## Before and after observations

Before Prompt 06A, broad uniform Archivo Black headings, tight negative
tracking, Barlow Condensed directory labels, and many `650–800` weights made
media and working controls feel subordinate to a generic heavy portfolio
identity. After Prompt 06A, scale changes inside each phrase communicate
hierarchy with less area and weight. Positive tracking, fine rules, aligned
indexes, and airy Jost copy make the product read as a wine catalog rather than
a dashboard, while the existing burgundy/champagne palette keeps continuity.

The main remaining visual limitation is the already documented placeholder
geometry inside the immutable approved GLBs. The current typography cannot add
the photographic glass microgeometry, paper relief, or capsule detail that
would require a future provenance-approved model. The large lazy WebGL chunk
also retains its accepted Vite size warning. Neither limitation belongs to
Prompt 07, and no recommendation or Taste Atlas logic was started here.

## Verification evidence

Final automated results:

- `verify:assets`: 3 foundational, 30 cinematic, and 10 WebGL assets passed;
- ESLint: passed with zero warnings;
- TypeScript: passed;
- Vitest: 39 files and 252 tests passed;
- production build: 2,309 modules transformed and passed;
- backend dependency check: passed;
- backend pytest: 81 tests passed;
- backend compileall: passed;
- production fail-closed session/configuration and route/CORS security tests:
  passed;
- `git diff --check`: passed.

The accepted 30-item cinematic aggregate remains
`0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018`.
The asset verifier also reconfirmed every tracked GLB and label checksum against
the unchanged WebGL manifest.

Browser verification covered `/`, `/discover?query=steak`, the real
`/wines/mock-chateau-montelena-cabernet-sauvignon-2019` record,
`/demo/cellar`, `/demo/taste-atlas`, `/login`, `/signup`, signed-out and
signed-in `/cellar`, and signed-out and signed-in `/profile`. It exercised
360×800, 390×844, 430×932, 768×1024, 1024×768, 1440×900, and 1920×1080.

The real browser flow preserved signup/login/logout, refresh-persistent session,
an internal return route, external-open-redirect rejection, real search/detail,
save, owner-scoped duplicate feedback, edit persistence, delete, two-user
isolation, private-cache separation, and truthful network failure/recovery.
The signed session remained invisible to `document.cookie`.

## Screenshot index

Evidence is in [`docs/screenshots/prompt-06a/`](../screenshots/prompt-06a/):

- `01-hero-desktop-1440x900.png`
- `02-hero-desktop-1920x1080.png`
- `03-hero-mobile-390x844.png`
- `04-discovery-chapter-desktop-1440x900.png`
- `05-taste-chapter-desktop-1440x900.png`
- `06-memory-chapter-desktop-1440x900.png`
- `07-atlas-chapter-mobile-390x844.png`
- `08-finale-chapter-desktop-1440x900.png`
- `09-discover-results-desktop-1440x900.png`
- `10-discover-results-mobile-390x844.png`
- `11-wine-detail-desktop-1440x900.png`
- `12-authenticated-cellar-desktop-1440x900.png`
- `12b-authenticated-cellar-detail-desktop-1440x900.png`
- `13-profile-desktop-1440x900.png`
- `14-login-mobile-390x844.png`
- `15-signup-desktop-1440x900.png`
- `16-navigation-drawer-open-mobile-390x844.png`
- `17-reduced-motion-hero-desktop-1440x900.png`
- `18-webgl-disabled-fallback-desktop-1440x900.png`
- `19-demo-cellar-desktop-1440x900.png`
- `20-demo-taste-atlas-desktop-1440x900.png`

## Build and advisory comparison

| Output | Accepted Prompt 06 raw/gzip | Prompt 06A raw/gzip | Delta raw/gzip |
| --- | ---: | ---: | ---: |
| Principal application JS | 228.66 / 72.98 kB | 229.95 / 73.21 kB | +1.29 / +0.23 kB |
| Home JS | 26.98 / 9.53 kB | 27.03 / 9.55 kB | +0.05 / +0.02 kB |
| Cellar JS | 18.72 / 6.28 kB | 18.83 / 6.33 kB | +0.11 / +0.05 kB |
| Shared CSS | 124.93 / 22.45 kB | 129.36 / 23.12 kB | +4.43 / +0.67 kB |
| Home CSS | 19.48 / 4.41 kB | 19.60 / 4.40 kB | +0.12 / -0.01 kB |
| Lazy WebGL graph | 906.76 / 247.08 kB | 906.80 / 247.10 kB | +0.04 / +0.02 kB |

The new reusable chunks are `DirectoryHeading` at 1.00 / 0.49 kB and
`PageShell` at 2.21 / 0.64 kB raw/gzip. Product routes still do not import the
Home-only lazy WebGL graph. Vite retains the accepted warning for that graph
being larger than 500 kB.

`npm audit --audit-level=low` remains at the accepted Prompt 06 baseline: 10
total advisories, comprising 1 low, 5 moderate, 4 high, and 0 critical. No
forced audit fix, broad framework upgrade, or unrelated dependency change was
performed.

## Deferred work

Prompt 07 remains wholly deferred. No recommendation endpoint, scoring rule,
ranking model, AI integration, provider change, or fabricated wine data was
added. Prompt 08 Taste Atlas logic also remains deferred. A future deployment
still needs the production same-origin `/api` topology, database, exact HTTPS
origins, real secret, and deployment smoke documented by Prompt 06; Prompt 06A
does not modify or claim that deployment work.
