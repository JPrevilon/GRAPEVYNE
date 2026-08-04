# Prompt 04A final-media audit

Audit date: 2026-08-02

Branch: `feat/grapevyne-cinematic-v2`

Accepted Prompt 04 commit: `ea83e9e706e6302eaf336be42a06fafc001e2c88`

## Verdict

Pass. The production media is the approved Final Media Edition set, all 30
files remain byte-for-byte unchanged, and the playback/runtime corrections are
limited to `CinematicVideo` plus its verification coverage. No backend,
authentication, WebGL, model, dependency, or deployment work is part of this
phase.

## Provenance and identity

The approved website assets came from:

`/Users/rachel/Desktop/GRAPEVYNE_V2_Codex_Framework/framework/frontend/public/assets/video/`

The sibling framework's QC report, final verification, playback rules,
integration components, probe output, and verifier were inspected before the
repository copy was touched. The current production tree and that approved
source each contain exactly 30 files and 83,431,933 bytes. A byte comparison
found no differences.

The identity value is SHA-256 over the sorted `shasum -a 256` lines rooted at
the media directory (`./desktop/...`, `./mobile/...`, and `./posters/...`):

`0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018`

That value matches the accepted Prompt 04 digest, the current repository, and
the approved sibling package. The permanent machine-readable inventory is
[`04a-final-media-manifest.json`](./04a-final-media-manifest.json). The
repository verifier binds the manifest's complete hash table to this accepted
aggregate digest and then hashes every production file.

No prototype, preview, reel, source plate, source master, 4K master, archival
master, GLB, or GLTF file exists under `frontend/public`. No prototype source
was used. No media binary was copied, rewritten, re-encoded, moved, or deleted
during Prompt 04A.

## Production inventory

| Production file | Bytes |
|---|---:|
| `desktop/cellar-corridor-push.desktop.mp4` | 6,249,121 |
| `desktop/cellar-corridor-push.desktop.webm` | 3,788,647 |
| `desktop/hero-bottle-macro.desktop.mp4` | 4,255,788 |
| `desktop/hero-bottle-macro.desktop.webm` | 2,057,308 |
| `desktop/memory-table-ambience.desktop.mp4` | 4,245,613 |
| `desktop/memory-table-ambience.desktop.webm` | 1,522,494 |
| `desktop/taste-atlas-finale.desktop.mp4` | 4,313,294 |
| `desktop/taste-atlas-finale.desktop.webm` | 1,099,483 |
| `desktop/taste-liquid-transition.desktop.mp4` | 8,036,528 |
| `desktop/taste-liquid-transition.desktop.webm` | 5,651,590 |
| `mobile/cellar-corridor-push.mobile.mp4` | 7,138,864 |
| `mobile/cellar-corridor-push.mobile.webm` | 3,903,454 |
| `mobile/hero-bottle-macro.mobile.mp4` | 4,866,050 |
| `mobile/hero-bottle-macro.mobile.webm` | 2,109,020 |
| `mobile/memory-table-ambience.mobile.mp4` | 2,748,585 |
| `mobile/memory-table-ambience.mobile.webm` | 888,496 |
| `mobile/taste-atlas-finale.mobile.mp4` | 4,409,848 |
| `mobile/taste-atlas-finale.mobile.webm` | 1,540,072 |
| `mobile/taste-liquid-transition.mobile.mp4` | 7,280,877 |
| `mobile/taste-liquid-transition.mobile.webm` | 5,150,231 |
| `posters/desktop/cellar-corridor-push.desktop.jpg` | 335,388 |
| `posters/desktop/hero-bottle-macro.desktop.jpg` | 195,724 |
| `posters/desktop/memory-table-ambience.desktop.jpg` | 236,115 |
| `posters/desktop/taste-atlas-finale.desktop.jpg` | 85,408 |
| `posters/desktop/taste-liquid-transition.desktop.jpg` | 219,468 |
| `posters/mobile/cellar-corridor-push.mobile.jpg` | 336,485 |
| `posters/mobile/hero-bottle-macro.mobile.jpg` | 241,475 |
| `posters/mobile/memory-table-ambience.mobile.jpg` | 179,533 |
| `posters/mobile/taste-atlas-finale.mobile.jpg` | 100,414 |
| `posters/mobile/taste-liquid-transition.mobile.jpg` | 246,560 |
| **Total** | **83,431,933 (79.57 MiB)** |

Class totals are 27,100,344 desktop MP4 bytes, 14,119,522 desktop WebM
bytes, 26,444,224 mobile MP4 bytes, 13,591,273 mobile WebM bytes,
1,072,103 desktop-poster bytes, and 1,104,467 mobile-poster bytes.

## Media probing and decode verification

`ffprobe` 8.1.1 read every stream, and `ffmpeg -v error -xerror` completed a
full decode of every video and poster with no corrupt or unreadable frames.
All MP4 files place `moov` before `mdat` (fast start). MP4 and WebM partners
have identical dimensions and differ in duration by only 0.000333 seconds,
well below one 24 fps frame.

| Files | Dimensions | Duration | Codec/profile | Pixel/color | FPS | Audio | Decode |
|---|---:|---:|---|---|---:|---|---|
| Desktop hero MP4/WebM | 1920×1080 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Desktop liquid MP4/WebM | 1920×1080 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Desktop cellar MP4/WebM | 1920×1080 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Desktop memory MP4/WebM | 1920×1080 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Desktop atlas MP4/WebM | 1920×1080 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Mobile hero MP4/WebM | 1080×1920 | 5.041667 / 5.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Mobile liquid MP4/WebM | 1080×1920 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Mobile cellar MP4/WebM | 1080×1920 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Mobile memory MP4/WebM | 1080×1920 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |
| Mobile atlas MP4/WebM | 1080×1920 | 6.041667 / 6.042 s | H.264 High / VP9 Profile 0 | yuv420p, BT.709, TV range | 24/1 | none | pass |

All desktop posters are 1920×1080 and all mobile posters are 1080×1920.
Their JPEG full-range / `yuvj420p` metadata is expected for still images and is
not a video-color defect.

## Playback contract

| Scene | Required and observed behavior |
|---|---|
| Hero | Native loop; eager selected-device sources; observed looping after 6.7 s. |
| Liquid | Native loop; lazy near-chapter load; observed playing only on its chapter. |
| Cellar | No loop attribute; plays once; naturally held at 6.042 s; reset only after the whole chapter exited; replayed on re-entry. |
| Memory | Native loop; lazy near-chapter load; observed looping after 6.7 s. |
| Atlas | No loop attribute; plays once; naturally held at 6.042 s; reset only after whole-chapter exit; replayed on re-entry. |

Playback visibility is measured on the enclosing semantic chapter, not the
inner video rectangle. This prevents chapter padding or minor threshold
fluctuations from resetting the cellar or atlas. A stale or intentionally
aborted `play()` promise can no longer turn into a false permanent poster
fallback; real playback failures still do.

Only one selected responsive video element exists per scene. WebM precedes
MP4, MP4 remains the fallback, the hero is eager, and later scenes remain
source-free until their 320 px lazy-load margin. Off-chapter and hidden-page
media pause, responsive swaps replace and pause the old element, and route
unmount disconnects observers and pauses the captured media element.

## Scene-specific visual limitations

- Hero: the media intentionally contains a central burgundy
  pedestal/reflection. The current CSS bottle covers it at all seven required
  viewports. The bottle remains a CSS fallback; Prompt 05 has not begun.
- Liquid: the footage is intentionally stylized and glass-like. It is an
  atmospheric transformation, not a literal educational viscosity depiction.
- Cellar: its first and last frames do not form a clean loop. The one-shot and
  held-final-frame behavior is therefore mandatory and verified.
- Memory: the footage includes a blank card and glass. The demonstration title,
  note, rating, favorite/status data, and disclosure remain crisp semantic DOM.
- Atlas: the source becomes brighter and painterly near its peak. The required
  `brightness(0.68) saturate(0.78)` filter and `opacity: 0.9` are present on
  video and poster fallbacks. The labeled, fictional semantic demonstration
  remains above it; it does not claim personalization or current-user data.

The GRAPEVYNE marks, headings, inputs, buttons, results, explanations, memory
content, atlas labels/disclosure, and navigation remain HTML. Every video is
decorative, muted, control-free, and `aria-hidden="true"`. There is no canvas,
WebGL context, audio element, GLB/GLTF request, or model request.

## Responsive composition

| Viewport | Selected assets | Runtime mode | Result |
|---|---|---|---|
| 360×800 | mobile | normal document flow | pass |
| 390×844 | mobile | normal document flow | pass |
| 430×932 | mobile | normal document flow | pass |
| 768×1024 | desktop (720 px media breakpoint) | normal document flow | pass |
| 1024×768 | desktop | normal document flow | pass |
| 1440×900 | desktop | five pinned sequences | pass |
| 1920×1080 | desktop | five pinned sequences | pass |

All five media chapters were visited at every listed size. Each selected source
reached ready state 4, used `object-fit: cover`, retained its expected object
position, and produced no horizontal overflow. The three narrow mobile sizes
use hero `center bottom`; all other scene/device combinations use `center`.
There was no letterboxing, stretching, material aspect-ratio jump, important
subject crop, halo/glass/card/arch collision, address-bar scroll trap, or
chapter-navigation obstruction in the captured views. No object-position value
was changed in Prompt 04A.

The approved registry has five media scenes: hero, liquid, cellar, memory, and
atlas. Chapter 02 (Discover) is intentionally semantic UI and has no sixth
"discovery video" asset; inventing one would violate the exact 30-file set.

## Posters, failure handling, and reduced motion

Every poster has the same orientation and dimensions as its scene/device video
pair. Normal loading showed continuous composition from poster to playable
media. A real browser test forced both hero WebM and MP4 requests to fail: the
video was removed, the desktop hero poster remained visible, and its heading,
search, and CTA stayed usable. A separate forced `NotAllowedError` produced the
same complete poster state. The media-error and autoplay paths emitted no
unhandled page error.

With `prefers-reduced-motion: reduce`, the desktop and mobile sessions mounted
zero videos, requested zero MP4/WebM files, created zero pin spacers, and kept
all nine chapters in increasing normal-flow order. All nine chapter links and
the search/CTA controls remained enabled. The intended device posters were
requested, including the treated atlas poster; no hidden video was present.

## Lifecycle and interaction verification

The sequence Home → Discover → Home → Demo Cellar → Home was repeated three
complete times. On each departure, all five test-held prior video elements were
paused and disconnected, the destination contained zero videos and zero pin
spacers, and returning Home produced exactly five new videos and five desktop
pin spacers with the hero playing. Counts did not grow. No cleanup warning or
page error appeared.

The full test gate initially exposed a canceled-before-setup GSAP import whose
singleton ticker could retain a requestAnimationFrame after jsdom teardown.
The scroll runtime now tracks active story ticker owners and sleeps the ticker
when the last owner cleans up, including an async import invalidated before
setup. A dedicated deferred-load test and the final full suite verify that no
orphaned ticker callback remains.

Browser back/forward navigation returned the correct routes with zero media on
Discover and five media elements/five pins on Home. Chapter navigation worked
forward to Atlas and in reverse to Liquid. The atlas paused and reset to zero
only after the reverse navigation genuinely removed its whole chapter from the
viewport. Desktop and mobile forward/reverse scrolling worked without a Vite
overlay or missing asset.

## Browser network evidence

Normal desktop Chromium requested only these final assets (duplicate HTTP range
requests omitted):

- `/assets/video/desktop/hero-bottle-macro.desktop.webm`
- `/assets/video/desktop/taste-liquid-transition.desktop.webm`
- `/assets/video/desktop/cellar-corridor-push.desktop.webm`
- `/assets/video/desktop/memory-table-ambience.desktop.webm`
- `/assets/video/desktop/taste-atlas-finale.desktop.webm`
- `/assets/video/posters/desktop/hero-bottle-macro.desktop.jpg`
- `/assets/video/posters/desktop/taste-liquid-transition.desktop.jpg`
- `/assets/video/posters/desktop/cellar-corridor-push.desktop.jpg`
- `/assets/video/posters/desktop/memory-table-ambience.desktop.jpg`
- `/assets/video/posters/desktop/taste-atlas-finale.desktop.jpg`

Normal mobile Chromium requested only the corresponding ten `/mobile/` and
`/posters/mobile/` paths. Chromium selected WebM, so it did not request the MP4
fallback. Reduced desktop requested only the desktop hero poster during the
captured hero state. Reduced mobile requested the mobile hero, memory, and atlas
posters while navigating to Atlas and requested no video. No normal session
requested the opposite device variant, and no session requested a prototype,
preview, source master, model, or other unexpected media URL.

## Screenshot evidence

The dedicated evidence is in [`docs/screenshots/prompt-04a/`](../screenshots/prompt-04a/).
It contains every required Prompt 04A capture: aligned desktop/mobile heroes,
desktop liquid, cellar first/final holds on desktop and final hold on mobile,
desktop/mobile memory, treated desktop/mobile atlas with DOM, reduced desktop
hero, reduced mobile atlas, autoplay-rejection fallback, and a chapter after
the third Home return. It also includes the initial annotated health check,
hero evidence at the other required viewports, and a forced media-load-failure
fallback.

## Final automated gates

- Repository asset verifier: pass, 3 foundational plus 30 hash-locked media
  assets.
- Approved sibling verifier: pass, 30/30.
- ESLint: pass with zero warnings.
- TypeScript `--noEmit`: pass.
- Vitest: 25 files, 136 tests passed; zero failed and zero unhandled errors.
- Vite production build: pass, 1,700 modules transformed. Key output is
  `HomePage` 22.48 kB / 7.66 kB gzip, lazy Lenis 15.26 kB / 4.24 kB,
  lazy ScrollTrigger 43.47 kB / 18.09 kB, application chunks 70.29 kB /
  27.84 kB and 214.53 kB / 68.93 kB, Home CSS 12.62 kB / 3.29 kB, and
  global CSS 109.99 kB / 20.10 kB.
- `git diff --check`: pass.
- `npm audit`: unchanged from Prompt 04 at 8 advisories (1 low, 3 moderate,
  4 high, 0 critical); no forced remediation or dependency change was made.
- `test:e2e`: not defined. Real Chromium automation supplied the required E2E
  coverage instead of adding a placeholder.
- Backend pytest: not installed in the existing virtual environment. No backend
  file changed; the real local Flask API served the browser matrix and retained
  the expected unauthenticated `/api/auth/me` 401 contract.

## Remaining boundaries

No objective media defect was found, so no re-encoding was permitted or needed.
The current CSS bottle is deliberately temporary pending Prompt 05. The Taste
Atlas remains an explicitly fictional demonstration because no personalization
engine exists. A full production-browser/device lab and heap profiler are
outside this local audit; the real Chromium matrix, stable runtime counts,
detached-node state checks, and Strict Mode teardown tests provide the current
cleanup evidence.
