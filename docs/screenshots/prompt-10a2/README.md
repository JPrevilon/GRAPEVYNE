# Prompt 10A2 evidence index

This directory is the additive local visual record for Prompt 10A2 on
`feat/grapevyne-cinematic-v2`. The captures were produced on 2026-08-04 from
the final Prompt 10A2 candidate working tree based on accepted Prompt 10A1R
commit `98d37d53e23eda7c47165d09e5370849654cf03d`. The one Prompt 10A2 commit
containing this evidence necessarily receives its exact SHA after capture; that
SHA and the immutable hosted Preview coordinates are recorded in the external
release handoff.

Prompt 10A1R evidence remains unchanged in
[`../prompt-10a1/`](../prompt-10a1/). Nothing here replaces or reclassifies that
accepted evidence. Every artifact below is a local Playwright capture, not a
Production capture and not evidence of a Production deployment.

## Capture provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-04 |
| Provenance | Local Vite production preview plus local Flask backend |
| Browser | Playwright 1.62.1; Chrome for Testing 151.0.7922.34 |
| Desktop screenshots | 1440×900 |
| Mobile screenshots | 390×844 |
| Desktop recordings | 960×600 at 25 fps |
| Mobile recording | 390×844 at 25 fps |
| Accepted base | `98d37d53e23eda7c47165d09e5370849654cf03d` |
| Artifact count | 24: 19 PNG screenshots and 5 WebM recordings |
| PNG byte total | 9,894,411 |
| WebM byte total | 11,717,696 |
| Total payload | 21,612,107 bytes |
| Aggregate SHA-256 | `344a08725909315b2382b9bbe5598c3d6c87c9a385a5190a4df67e5d00713a7f` |
| Production status | No artifact is a Production capture; Production was not deployed or promoted |

The aggregate is the SHA-256 of the sorted repository-relative per-artifact
SHA-256 lines emitted by the command in the checksum section.

## Screenshot inventory

All screenshot rows passed capture, non-empty-file, dimension, and visual
inspection checks.

| Artifact | Coverage | SHA-256 |
| --- | --- | --- |
| `local-public/01-true-black-full-cover-matches-navigation.png` | Full-cover black matches navigation; no media or subject visible | `1611aa975a01464b0587906d9d3cd1792ec9e3f98d3e45931d93afa45213772d` |
| `local-public/02-chapter-01-bottle-front.png` | Chapter 01 bottle front and scoped rotate control | `d99b268d78970fa5a73cd36520b5a3e11de6f51d2d47980354d68de650e8eeb2` |
| `local-public/03-chapter-01-bottle-side-back-after-drag.png` | Direct bottle drag preserves a side/back pose | `aaa7df087c6ea8ebd467924da02ab28f151460454b213076a1175168862c2394` |
| `local-public/04-chapter-02-grapes-front.png` | Grapes-only front pose; no bottle or label | `53db8c5e6aca241026669bade90b958b41792dea87f72d60f7b6259a8fc55ed1` |
| `local-public/05-chapter-02-grapes-side-back-after-drag.png` | Full-yaw grape inspection retains leaves, stems, and berries | `d262348d4139d19726a8b8442a7066a774a685797d593f86c7e62e519602e112` |
| `local-public/06-mobile-bottle-interaction-390x844.png` | Mobile bottle hold-drag at 390×844 | `8d7875be6cf49721d022abf2865e1b2b11bf5e9939ad457104c73e8a5371738e` |
| `local-public/07-mobile-grape-interaction-390x844.png` | Mobile grape hold-drag at 390×844 | `bbe9534343e37be67678e5e01d9e3c0a33d7b8eab697c764be3db98dfb4875bb` |
| `local-public/08-boundary-01-to-02-outgoing-fade.png` | 01→02 outgoing-only fade | `e7b4cc15bb96cf0afdfa8d7cd2a6650149959e98f88e5ee0fa1e5d909ce2546a` |
| `local-public/09-boundary-01-to-02-full-black-hold.png` | 01→02 exact full-black hold | `1611aa975a01464b0587906d9d3cd1792ec9e3f98d3e45931d93afa45213772d` |
| `local-public/10-boundary-01-to-02-incoming-reveal.png` | 01→02 decoded incoming-only reveal | `d0de1c5463baeea534ed8e28cafdeda06404113c19a5e6c0e0f65530fc5703f3` |
| `local-public/11-boundary-02-to-03-full-black-hold.png` | 02→03 grape removal under full black | `1833b2d28e57b552599c92cdf8f036a189546ac07d1b113e4997e9b8a342ffe4` |
| `local-public/12-boundary-04-to-05-full-black-hold.png` | 04→05 bottle ownership/readiness gate | `f91a9f6da3cec0a9cf1f3d2a2df2a076bea72ba6805fae734b5eb087310a4b36` |
| `local-public/13-boundary-07-to-08-full-black-hold.png` | 07→08 atlas bottle gate | `fcdf086bf8e3918c6449f17e4eaadd3d7d306dfb57af9d74e3c66446d4aa8fe4` |
| `local-public/14-boundary-08-to-09-full-black-hold.png` | 08→09 bottle removal under full black | `f735690dbf7d27d65b681715c7c6797bd623fdb36ac78d8d33ba3012ec564839` |
| `local-public/15-reverse-boundary-02-to-01-black-hold.png` | Reverse owner swap under full black | `1611aa975a01464b0587906d9d3cd1792ec9e3f98d3e45931d93afa45213772d` |
| `local-public/16-reduced-motion-mobile-390x844-fallback.png` | Reduced-motion mobile static fallback; no live control | `25b89efa7a5152c67d2f0c4d1bf9105436659f32a5ea290e85ef6e4c827c4b88` |
| `local-public/17-save-data-fallback.png` | Save-Data desktop static fallback | `7b7b0bb9ec8251e5cf535efe15735d17561a24651ab2c04738752ccb27b78776` |
| `local-public/18-save-data-mobile-390x844-fallback.png` | Save-Data mobile static fallback | `25b89efa7a5152c67d2f0c4d1bf9105436659f32a5ea290e85ef6e4c827c4b88` |
| `local-public/19-webgl-failure-fallback.png` | WebGL-failure static subject; no blank area or live control | `445143cd73b9c5a0bbe4ab577bad5d4116f4f2a31f7dfb0e165e5784308a3e1a` |

## Recording inventory

All recording rows passed non-empty-file, stream metadata, duration, and
sampled-frame visual checks. Recordings use Playwright's software-capable
browser path; they demonstrate interaction state and visual continuity but do
not replace a physical-GPU or physical-touch-device review.

| Artifact | Dimensions / duration | Coverage | SHA-256 |
| --- | --- | --- | --- |
| `walkthroughs/20-desktop-forward-complete-walkthrough.webm` | 960×600 / 33.28 s | Chapters 01→09 and all eight forward boundaries | `7711db16474e3d28ab8dc2955bcc4356561f84ecc1a9cfd67a3b021512016e28` |
| `walkthroughs/21-desktop-reverse-complete-walkthrough.webm` | 960×600 / 39.96 s | Chapters 09→01 and all eight reverse boundaries | `37e61bdece171f50a1ccea793224a96c09bc662a02fb78cdfff8bd283f0244d6` |
| `walkthroughs/22-mobile-model-interaction-walkthrough.webm` | 390×844 / 9.68 s | Native scrolling plus bottle/grape hold-drag and release | `11a84fa95ef7a2b40e84f0924b4b93a23ca9a09df62a5b87b2142153a9153fac` |
| `walkthroughs/23-focused-bottle-direct-rotation.webm` | 960×600 / 15.88 s | Bottle front/quarter/side/back/full rotation, release, and reset | `2df332ea6c9411afe396e84c21fd66cf5eabbd109e6c9747f8d08c57db522d8f` |
| `walkthroughs/24-focused-grape-direct-rotation.webm` | 960×600 / 16.52 s | Grape full yaw, restrained pitch, release, and reset | `b2b10823b99453a6e7eb8e325435eca40ec6fcc6cc132009292e71bb77d2bd1f` |

## Checksum reproduction

```bash
find docs/screenshots/prompt-10a2 -type f \
  ! -name README.md -print0 | sort -z | xargs -0 shasum -a 256

find docs/screenshots/prompt-10a2 -type f \
  ! -name README.md -print0 | sort -z | xargs -0 shasum -a 256 \
  | shasum -a 256
```

The exact-SHA CI results, immutable protected Preview URL, deployment ID,
stable branch alias, hosted verification results, and Production-before/after
identity remain external because those values can exist only after the single
Prompt 10A2 commit containing this index is created.
