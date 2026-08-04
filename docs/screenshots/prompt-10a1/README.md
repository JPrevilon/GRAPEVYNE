# Prompt 10A1R local evidence index

This directory contains the final local visual evidence for Prompt 10A1R on
`feat/grapevyne-cinematic-v2`, based on accepted commit
`b99dd6d8bc75f97f3047ba71c3c92b9f34df9c0f`. It is local evidence only: no
file in this directory is represented as a Vercel Preview or Production
capture.

## Evidence payload

| Directory | Visual artifacts | Bytes | Aggregate SHA-256 |
| --- | ---: | ---: | --- |
| [`local-public/`](./local-public/) | 30 (29 PNG, 1 WebM) | 24,171,572 | `ae72002df2d4a7cd21a58bf8e778ef98ac293ea837f759285ca6f08e24d628f1` |
| [`product-regressions/`](./product-regressions/) | 3 PNG | 634,630 | `9fbec0cee690a7e3e31621c0808e9e54e4030dd58818fdd39833c05cd9fb1ad6` |
| [`model-comparisons/`](./model-comparisons/) comparison renders only | 4 PNG | 2,317,926 | `1f9a25e3661300b8a5a8751e14facaa84b352d5e46235d3757c8ad70fc70f4cb` |
| **Total visual payload** | **37** | **27,124,128** | `925f607a897051c0a76e1a58abe7dac615e53dbb317cddd1c936b8940883f1e9` |

Each aggregate is the SHA-256 of lexicographically sorted, repository-relative
`shasum -a 256` output lines. The totals exclude this index and the comparison
README, render harness, tangent-repair script, and locked toolchain manifests.

## Provenance and coverage

`local-public/` was captured from the local Vite application with Chromium
browser automation on 2026-08-04. It covers desktop/mobile Hero and vineyard,
all subject-free chapters, subject exit/re-entry boundaries, the compact chapter
menu, Chapter 02 search, exact bottle-label front/quarter/side views, the mobile
inspector, reduced-motion, Save-Data, disabled-WebGL fallback, and a local
after-state walkthrough. The filenames carry the capture viewport.

`product-regressions/` is an exact byte-for-byte copy of the passing
deterministic Playwright baselines for Discover results, populated authenticated
Cellar, and active Taste Profile. Their SHA-256 values are, respectively:

- `724bb691d74ba10edf263e32eaa6b5dcb01b8a20d0d3a89aad66a8ccfeecda0e`;
- `71e04cbe9a8de888b347a0bb247621ffc1176d48fb8766185534c8b93e4b15b4`;
- `0dd42e9dd66d7d601e23a5da692259805c0c27ccd84beff8ecd0e416fd5d003e`.

`model-comparisons/` contains four deterministic 1600x900, source-versus-
production browser renders plus the complete local reproduction harness. Its
[`README.md`](./model-comparisons/README.md) records per-image hashes, browser
environment, review findings, and exact commands. The user-supplied source GLBs
were loaded read-only from `/Users/rachel/Downloads/`; they were not copied into
the repository or a public asset path.

The automated viewport suite separately passed at 360x800, 390x844, 430x932,
768x1024, 1024x768, 1440x900, and 1920x1080. Hosted Preview evidence must be
stored and identified separately after an exact-SHA Preview deployment; this
index must not be used as hosted or Production proof.
