# Prompt 04B typography and art direction

Audit date: 2026-08-02

Branch: `feat/grapevyne-cinematic-v2`

Accepted Prompt 04A commit: `43d845b9871c8c15422eeabb4aa9b07fd40e82d1`

## Direction and verdict

GRAPEVYNE now uses an original **Neo Cellar Directory** system: broad display
type, direct narrative copy, condensed record labels, live typographic brand
lockups, a twelve-column editorial grid, and flatter catalog structures. The
former delicate serif presentation has been removed from production imports
and dependencies. The burgundy, champagne, ivory, and near-black palette and
the accepted cinematic media remain the continuity between phases.

The visual change is deliberately typographic. It does not add a canvas,
WebGL, a model request, or a mandatory loading screen, and it does not alter
backend, API, authentication, recommendation, media, or playback contracts.

## Font system

All faces are pinned Fontsource `5.3.0` packages and load locally from the
application bundle.

| Role | Family and fallback token | Package | Use |
|---|---|---|---|
| Display | `Archivo Black`, `Arial Black`, `Helvetica Neue`, sans-serif | `@fontsource/archivo-black@5.3.0` | Hero, chapter, page, card, and state headlines |
| Body and UI | `Archivo Variable`, `Archivo`, `Helvetica Neue`, Arial, sans-serif | `@fontsource-variable/archivo@5.3.0` | Narrative copy, forms, controls, and dynamic content |
| Directory | `Barlow Condensed`, `Arial Narrow`, sans-serif | `@fontsource/barlow-condensed@5.3.0` | Navigation, eyebrows, indexes, metadata, and buttons |

`@fontsource/eb-garamond` and `@fontsource/inter` were removed after their
imports were replaced. There is no remote font stylesheet or arbitrary font
binary. `font-synthesis: none` prevents browsers from inventing weights or
styles that would weaken the intended hierarchy.

## Typography scale

The semantic scale lives in `design-system.css`:

| Token | Value |
|---|---|
| `--size-display-hero` | `clamp(4.5rem, 8vw, 9rem)` |
| `--size-display-chapter` | `clamp(3.4rem, 7.5vw, 8rem)` |
| `--size-display-page` | `clamp(3.2rem, 6.5vw, 7rem)` |
| `--size-copy-narrative` | `clamp(1.3rem, 2.2vw, 2.35rem)` |
| `--size-copy-body` | `1rem` |
| `--size-metadata` | `clamp(0.78rem, 0.9vw, 0.9rem)` |
| `--size-directory-label` | `clamp(0.86rem, 1.1vw, 1rem)` |
| `--size-navigation` | `0.92rem` |
| `--size-button` | `0.92rem` |
| `--size-numerical` | `clamp(1rem, 1.5vw, 1.3rem)` |

The hero uses an `8vw` upper rhythm instead of the approximate `10vw`
reference so the two locked lines remain intact beside the desktop chapter
rail at the required viewports. Narrow layouts use copy-safe viewport clamps.
Display line-height stays between `0.84` and `0.94`, with negative tracking;
metadata uses compact positive tracking only where it helps scanability.

## Copy rules

- Static major marketing and product titles are uppercase and have no terminal
  periods.
- Homepage chapter copy retains exactly nine semantic headings and the locked
  wording, including `FIND THE BOTTLE / KEEP THE MEMORY` as two literal lines.
- Eyebrows, indexes, metadata labels, navigation labels, and buttons use the
  condensed directory role and uppercase presentation.
- Body copy is larger, heavier, and more direct than the prior restrained
  luxury treatment.
- Dynamic wine names, producers, origins, varietals, user names, emails, API
  messages, and authored notes keep their source casing and punctuation.
  Dynamic selectors explicitly opt out of uppercase transforms where needed.

## Spacing and grid rules

- Pages use a responsive twelve-column editorial grid with `minmax(0, 1fr)`
  tracks to prevent content-driven overflow.
- Major sections use `--section-space: clamp(7rem, 13vh, 12rem)` and
  `--section-space-mobile: clamp(5rem, 9vh, 7.5rem)`.
- Narrative copy spans wide columns; metadata and actions align to the same
  directory grid instead of floating in unrelated cards.
- Hairline dividers, squared record cells, and restrained small radii replace
  repeated rounded-card stacks. Pills remain only where the interaction or
  compact status treatment benefits from that shape.
- At tablet width, hero copy occupies eight columns so the search action and
  CSS bottle remain visually separate. Mobile hero media, lockup, copy, and
  search use normal document flow with copy-safe tracks.

## Directory-system rules

- Catalog records carry stable visible indexes without altering record IDs or
  request payloads.
- Wine facts use semantic `dl`, `dt`, and `dd` structures where the source data
  supports label/value pairs.
- Price, vintage, score, count, and index treatments use tabular numerical
  styling.
- Navigation presents a live GRAPEVYNE name and descriptor, numbered drawer
  destinations, and a separate account record.
- Product routes reuse the same display/body/directory roles; the homepage is
  not a disconnected campaign skin.

## Components and routes restyled

`BrandLockup` is the single live-DOM identity treatment used by the product
navigation, mobile drawer, footer, homepage, auth form, route loading state,
and legacy header. It keeps the existing decorative crest asset but replaces
the old image wordmark with selectable text.

The homepage retains all nine chapter IDs, controls, media nodes, search
behavior, chapter progress, GSAP pinning, and Lenis ownership. Typography,
grid placement, record styling, and copy hierarchy were changed around those
contracts. The hero, discovery, recommendation, portal, cellar, memory, atlas,
profile, and finale sections now read as one directory narrative.

The following route surfaces share the system:

- Discover: indexed flat wine records and a stronger search/results hierarchy.
- Wine detail: a broad dynamic title and structured available catalog facts.
- Cellar: a consistent `YOUR CELLAR` page title across loading, error, empty,
  and populated states; indexed owner-scoped records remain interactive.
- Profile: `TASTE PROFILE` hierarchy around the existing signed-in data.
- Demo cellar and demo Taste Atlas: explicit public/read-only record language,
  fixture indexes, and a contained decorative atlas orbit.
- Login and signup: `RETURN TO YOUR CELLAR` and `CREATE YOUR CELLAR` framing
  around the unchanged session-authentication forms.

## Accessibility and motion

- Heading order and route landmarks remain semantic; decorative marks, media,
  orbits, and the CSS bottle remain hidden from assistive technology.
- Live text replaces the primary image wordmark and keeps a descriptive home
  link label.
- Existing focus indicators, form labels, error/status announcements, drawer
  dialog semantics, Escape handling, focus trap, focus restoration, and body
  scroll lock remain intact.
- The navigation removes its backdrop filter only while the drawer is open so
  the fixed dialog is viewport-sized rather than trapped by the sticky header's
  containing block.
- Reduced motion continues to use poster-only media and normal-flow chapters;
  it creates no pin spacers or video nodes.
- Contrast retains aged ivory/champagne text on near-black and burgundy
  surfaces. Dynamic content is never hidden for the sake of composition.

## Scroll measurement and cleanup

The scroll story renders and initializes immediately, then awaits
`document.fonts.ready` asynchronously and calls one `ScrollTrigger.refresh()`
to correct measurements made while fonts were loading. A disposed and
generation-gated setup cannot revive after unmount. This adds no listener,
loader, duplicate trigger, or persistent ticker. Existing cleanup still kills
owned triggers, removes pinning, releases Lenis, and sleeps the shared GSAP
ticker when its last story owner exits.

## Before and after

Before Prompt 04B, EB Garamond display type, Inter UI text, sentence-case
headlines, terminal periods, smaller copy, and repeated rounded panels produced
a conventional luxury-site rhythm. After Prompt 04B, Archivo Black establishes
graphic scale, Archivo Variable supports confident readable prose, and Barlow
Condensed makes the interface feel like a numbered private catalog. Wider
copy, stronger section spacing, flat record grids, and indexed metadata connect
cinematic media to the working product instead of sitting above it as a theme.

## Preserved contracts

The phase changes no Flask file, schema, migration, session setting, CORS
setting, service, recommendation logic, or Taste Atlas calculation. It retains
the single router, authentication provider, query provider, scene provider,
`credentials: "include"`, current API envelopes, protected-route behavior,
owner-scoped/private-cache behavior, public demo boundaries, and all save,
login, signup, cellar, profile, discovery, and wine-detail flows.

The 30 Prompt 04A production media files remain unchanged. Their aggregate
SHA-256 identity is:

`0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018`

## Browser evidence

The dedicated evidence directory is
[`docs/screenshots/prompt-04b/`](../screenshots/prompt-04b/). It covers both
desktop hero sizes, mobile hero and navigation, desktop/mobile discovery,
wine detail, public demo cellar and Taste Atlas, authenticated cellar, mobile
login, desktop signup, homepage memory/atlas/finale states, and reduced-motion
hero mode.

Browser verification also exercised widths 360, 390, 430, 768, 1024, 1440,
and 1920 pixels; real discovery and wine-detail API responses; signed-out
protected-route redirects; disposable signup, save, cellar, and profile
requests; forward/reverse chapter travel; and route return cleanup. Computed
styles resolved to Archivo Black, Archivo Variable, and Barlow Condensed for
their respective roles, with no remote font, model, canvas, or WebGL request.

## Final verification

- Asset verifier: pass, three foundational assets and 30 hash-locked media
  assets.
- ESLint: pass with zero warnings.
- TypeScript: pass with `tsc --noEmit`.
- Vitest: 27 files and 144 tests passed, with no failed or unhandled tests.
- Vite build: pass, 1,699 modules transformed.
- Final CSS: homepage 18.36 kB / 4.17 kB gzip; shared 124.92 kB / 22.46
  kB gzip.
- Final principal JavaScript: homepage 22.76 kB / 7.77 kB gzip; shared app
  215.20 kB / 69.24 kB gzip; vendor 70.29 kB / 27.84 kB gzip.
- `npm audit`: unchanged from the accepted baseline at eight advisories: one
  low, three moderate, four high, and zero critical. No forced or broad
  dependency upgrade was applied.
- `git diff --check`: pass.

## Deferred work

Prompt 05 remains entirely deferred. The bottle is still the accessible CSS
fallback composition; no Three.js/WebGL renderer, canvas, GLB/GLTF asset,
lighting environment, material system, 3D interaction, or model-loading code
was introduced. Any later model phase must preserve the semantic title,
search, data, motion preference, and CSS fallback established here.
