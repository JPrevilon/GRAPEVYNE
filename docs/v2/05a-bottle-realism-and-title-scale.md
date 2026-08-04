# Prompt 05A — Bottle Realism and Title Scale

## Verdict

This focused refinement reduces the oversized display typography and makes the existing persistent bottle read as a premium, old-world Burgundy presentation. It does not change the Flask backend, database, API client, authentication, routing, providers, story copy, cinematic media, fonts, model files, label files, deployment configuration, or the WebGL capability/fallback architecture.

The supplied bottle photograph was used only as visual art direction: sloped Burgundy shoulders, a long narrow neck, subdued red foil, near-black wine and glass, aged-ivory paper, and controlled photographic highlights. Its producer label, vintage, typography, and trademarks were not copied. Reference SHA-256: `9dacf45b1fb08bbc64f8e3df45f8aa2db1044b48bef39f221fe2442cff5a04c9`.

## Display-scale changes

| Role | Accepted Prompt 04B/05 token | Prompt 05A token |
| --- | --- | --- |
| Homepage hero | `clamp(4.5rem, 8vw, 9rem)` | `clamp(3.15rem, 6.6vw, 6.9rem)` |
| Homepage chapters | `clamp(3.4rem, 7.5vw, 8rem)` | `clamp(2.25rem, 4.9vw, 4.85rem)` |
| Product-page display | `clamp(3.2rem, 6.5vw, 7rem)` | `clamp(2.5rem, 4.8vw, 5.2rem)` |

Homepage display tracking is relaxed from `-0.055em` to `-0.05em`. Hero line height moves from `0.84` to `0.9`; chapter line height moves from `0.88` to `0.94`; product-page and wine-detail display line height is `0.9`.

The mobile hero deliberately uses `clamp(1.95rem, 8.8vw, 3.15rem)` instead of the shared hero token. The token's `3.15rem` floor would make the two required `white-space: nowrap` hero lines wider than the 390 px content area. Chapter headings and product titles use their shared tokens at mobile sizes. The late mobile hardcoded PageShell, chapter, and wine-detail clamps were removed or redirected to the tokens so the responsive cascade cannot silently restore the oversized values.

Representative computed sizes are:

| Viewport | Hero | Chapter | Product page |
| --- | ---: | ---: | ---: |
| 390 px | 34.32 px | 36 px | 40 px |
| 430 px | 37.84 px | 36 px | 40 px |
| 1440 px | 95.04 px | 70.56 px | 69.12 px |
| 1920 px | 110.4 px | 77.6 px | 83.2 px |

All nine homepage headings share these contracts. PageShell covers Discover, Demo Cellar, Demo Taste Atlas, auth, Cellar states, and Profile; the dynamic wine-detail title consumes the same product display token. No heading copy, casing, punctuation, font family, semantic element, or hierarchy changed.

## Bottle-realism changes

The source GLBs revealed the main synthetic defect: each label was a flat four-vertex plane at radius `0.372`, so its outer corners reached radius `0.4686` against a bottle radius of `0.37`. The runtime clone now replaces only those planes with cylindrical paper strips:

- radius `0.373`, half-angle approximately `0.870` radians;
- 24 segments on high tier and 12 on standard tier;
- original UV direction and label aspect ratio retained;
- vertical placement moved down `0.14` model units;
- front/back winding and normals face outward;
- first-frame readiness remains attached to `Label_Front`.

The liquid clone now uses a contained Z-up lathed profile. It reaches the lower neck at Z `1.86`, stays at or below radius `0.318`, and preserves seam-continuous analytic normals. Its closed volume remains front-sided to avoid double-blending a nearly opaque transparent shell. This replaces only the cloned `Wine_Liquid` geometry; the cached GLB is not mutated.

Runtime presentation was further refined as follows:

- glass is dark burgundy-black, front-sided, non-metallic, rougher, clear-coated, and opaque-leaning without fake transmission;
- wine is deep burgundy with subdued clearcoat rather than candy-red glow;
- the sealed cork node remains present for the model contract but is hidden so it no longer protrudes as a gold peg;
- the capsule uses muted red foil and two small runtime foil rings;
- label paper is highly rough with a restrained warm lift for legibility;
- condensation is reduced from `0.22` to `0.07` opacity and remains high-tier only;
- the light rig uses lower ambient fill, a narrower champagne key, a restrained front paper fill, and a neutral-warm high-tier rim;
- camera perspective is flatter while preserving apparent size: FOV `30` at Z `8` high, FOV `34` at Z `7.9` standard;
- the high-tier hero target moves from X `1.65` to `1.82` to separate the bottle shoulder from the smaller title.

Transmission intentionally remains disabled. A transparent WebGL canvas cannot refract the CSS cinematic layer behind it as a real environment, so transmission would introduce empty or black refraction rather than believable glass.

## Asset and behavior invariants

No production model, label, video, or poster file changed. The current active asset hashes remain:

| Asset | SHA-256 |
| --- | --- |
| Desktop bottle GLB | `2304b4b89cc7a249527746c6b1f7ceb02759f6395a709b129e539941c885c05a` |
| Mobile bottle GLB | `1caa5eb4786326199f0f2b1fd4066590aaccda02a54da03e14bfba9bee10e3f8` |
| Red front label | `fc1e798888c59d1dc335a964309de8ddf570be68b509f47b0be396be244f4281` |
| Back label | `d33586e7beeec7ef60d203a5bf74bbb8a39b9d30f21471549a6b2e7d32f791d3` |
| Accepted 30-item cinematic aggregate | `0799b42fe1b610aa92b8cae9dc7a1dabcc368b6602df6bed0c83263a8fe55018` |

`verify:assets` still validates 3 foundational, 30 cinematic, and 10 WebGL assets. The existing local-only high/standard model choice, red-front/back label choice, one-canvas lifecycle, frame handshake, capability preflight, reduced-motion fallback, disabled-WebGL fallback, context recovery, route-local lazy graph, pointer bounds, GSAP/Lenis story behavior, and disposal ownership remain in place.

The frontend still has one `BrowserRouter`, `QueryClientProvider`, `AuthProvider`, and `SceneProvider`. Requests still use the existing API base, response envelopes, `credentials: "include"`, Flask signed-session authentication, protected route rules, and identity-scoped React Query keys.

## Verification evidence

Automated coverage now additionally checks exact display tokens and effective mobile consumers, label curvature/radius/UVs/winding/normals/bounds, liquid containment and seam normals, cached-asset immutability, runtime disposal, hidden sealed cork, foil details, material properties, tier-specific camera/exposure, and damped key/fill lighting.

Final automated results:

- asset verification: 3 foundational, 30 cinematic, and 10 WebGL assets passed;
- ESLint: passed with zero warnings;
- TypeScript: passed;
- Vitest: 34 files and 197 tests passed;
- production build: 2,309 modules transformed and passed;
- `git diff --check`: passed;
- formal `test:e2e`: not defined; no placeholder command was added;
- backend pytest suite: not present; unchanged API smoke checks returned health 200, public wine search 200, unauthenticated auth state 401, and protected cellar 401.

Browser verification covered 1440×900, 1920×1080, 390×844, and 430×932. Capable Home sessions reached ready with one `aria-hidden`, pointer-inert canvas, the expected high/standard tier, and no horizontal overflow. Discover, Demo Cellar, Demo Taste Atlas, Login, Signup, and a live wine-detail route rendered the new product-title token with zero WebGL canvases. Reduced motion and deliberately disabled WebGL each produced zero canvases and zero `ExperienceCanvas`, GLB, or label requests while leaving the CSS bottle visible.

Required captures are in [`docs/screenshots/prompt-05a/`](../screenshots/prompt-05a/):

- `hero-after-1440x900.png`
- `hero-after-1920x1080.png`
- `hero-mobile-390x844.png`
- `discovery-desktop-1440x900.png`
- `taste-desktop-1440x900.png`
- `memory-desktop-1440x900.png`
- `finale-desktop-1440x900.png`
- `reduced-motion-1440x900.png`
- `webgl-disabled-1440x900.png`

The user-supplied before screenshots remain the comparison source and were not copied into the repository.

## Build and advisory comparison

| Output | Prompt 05 raw/gzip | Prompt 05A raw/gzip | Delta raw/gzip |
| --- | ---: | ---: | ---: |
| Principal application JS | 215.28 / 69.28 kB | 215.28 / 69.29 kB | 0 / +0.01 kB |
| Home JS | 26.87 / 9.47 kB | 26.87 / 9.47 kB | 0 / 0 kB |
| Shared CSS | 124.92 / 22.46 kB | 124.93 / 22.45 kB | +0.01 / -0.01 kB |
| Home CSS | 19.54 / 4.43 kB | 19.48 / 4.41 kB | -0.06 / -0.02 kB |
| Lazy WebGL graph | 904.71 / 246.34 kB | 906.79 / 247.10 kB | +2.08 / +0.76 kB |

Vite retains the accepted warning for the Home-only lazy WebGL chunk over 500 kB. The product-route entry graph remains free of the WebGL canvas module.

`npm audit --audit-level=low` reports the same 10 known findings as accepted Prompt 05: 1 low, 5 moderate, 4 high, and 0 critical. No production dependency or lockfile changed in this refinement, and no `npm audit fix` or forced breaking upgrade was run.

## Limitations

The immutable validation metadata identifies both approved GLBs as placeholder models. Their body is cylindrical from Z `0.06–1.50`, their shoulder has only four transition rings, and their capsule has minimal source geometry. Runtime curvature, liquid, materials, foil accents, lighting, and camera treatment materially improve the presentation, but photographic microgeometry, glass refraction, capsule wrinkles, paper relief, and surface imperfections require a future provenance-approved production GLB and suitable environment-lighting pipeline.

No postprocessing, bloom, remote model, remote label, stock GLB, HDRI, shader package, new font, image-generation output, or reference-image derivative was introduced.
