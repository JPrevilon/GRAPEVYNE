# Prompt 09A — Dependency Remediation

Audit date: **2026-08-03**. Branch: `feat/grapevyne-cinematic-v2`. Accepted Prompt 09
commit: `14f7e4cb85d585d6da1e153c3882da4549f6e4fa`.

## Verdict

The locally actionable dependency release blocker is **resolved**. The final npm full and
`--omit=dev` audits each report **2 package entries: 0 low, 2 moderate, 0 high, 0 critical**.
Those two entries represent three React Router advisories, each reviewed below; none has a
known exploitable path in this client-rendered BrowserRouter application. The final
`pip-audit` reports **0 vulnerabilities across 51 installed Python packages**, and
`python -m pip check` passes.

This is a local release-candidate result, not a production-deployment verdict. Hosted CI,
Vercel, production environment, real edge topology, and physical-device checks remain
outside Prompt 09A.

The complete per-advisory machine-readable record is
[`09a-dependency-inventory.json`](09a-dependency-inventory.json). Raw scanner reports were
kept in disposable untracked storage; no raw credential or environment report is committed.

## Reproducible inventory

Official verification used Node **20.19.6**, npm **10.8.2**, Python **3.12.12**, and
`pip-audit` **2.10.1**. Every npm install, audit, and registry request used writable
disposable storage outside the repository. `/Volumes/LaCie/.npm-cache` was not accessed.

The evidence commands were:

```text
npm audit --json
npm audit --omit=dev --json
npm outdated --json
npm ls --all
python -m pip check
python -m pip list --outdated --format=json
pip-audit --format=json
```

The final `npm ls --all --json` exited 0 with no dependency problem. Final
`npm outdated --json` exited 1 because 29 packages have newer published lines; those
unrelated updates were intentionally not folded into a release-blocker patch. Both final
npm audits exited 1 solely because the documented moderate React Router entries remain,
not because of any low, high, or critical finding.

| Ecosystem and scope | Before | After | Decision |
| --- | --- | --- | --- |
| npm full tree | 10 package entries: 1 low, 5 moderate, 4 high, 0 critical | 2 package entries: 0 low, 2 moderate, 0 high, 0 critical | Pass |
| npm `--omit=dev` | 8 package entries: 1 low, 5 moderate, 2 high, 0 critical | 2 package entries: 0 low, 2 moderate, 0 high, 0 critical | Pass after reachability review |
| npm individual advisories | 16 | 3 residual React Router records | No known exploitable runtime moderate |
| Python scanner rows | 8 rows in 4 packages (7 unique vulnerabilities) | 0 rows in 0 packages | Pass |

The npm package-entry count is not an advisory count: direct packages can inherit a
transitive finding. For example, Drei inherited `uuid`, while Vite inherited `esbuild` and
PostCSS. Python's live Prompt 09A baseline is one row larger than Prompt 09's recorded
seven-row scan because the advisory database now also reports `pytest`; both
`PYSEC-2024-71` and its withdrawn/duplicate alias `PYSEC-2024-260` remain in the eight-row
accounting.

## Exact changes

### Direct npm contracts

| Package | Before | After | Scope and reason |
| --- | --- | --- | --- |
| `@react-three/drei` | exact `9.114.3` | exact `9.122.0` | Runtime; React 18/R3F 8-compatible minor removes the vulnerable `uuid@9.0.1` path. |
| `react-router-dom` | declared `^6.26.1`, resolved `6.30.3` | exact `6.30.4` | Runtime; compatible patch fixes the v6 protocol-relative redirect record while preserving BrowserRouter behavior. |
| `vite` | declared `^5.4.2`, resolved `5.4.21`, incorrectly in `dependencies` | exact `6.4.3` in `devDependencies` | Build-only; clears Vite, esbuild, and PostCSS findings and corrects package scope. |
| `@vitejs/plugin-react` | declared `^4.3.1`, resolved `4.7.0`, incorrectly in `dependencies` | exact `4.7.0` in `devDependencies` | Build-only; exact pin and correct scope. |

The lockfile now resolves the advisory-bearing transitives at
`@babel/core@7.29.7`, `brace-expansion@1.1.18`, `esbuild@0.25.12`,
`js-yaml@4.3.1`, and `postcss@8.5.25`; `uuid` is absent. React **18.3.1**, React DOM
**18.3.1**, R3F **8.17.10**, and Three **0.169.0** remain unchanged. No override was added
for an API-incompatible vulnerable transitive.

### Direct Python pins

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| `Flask` | `3.0.3` | `3.1.3` | Correct complete `Vary: Cookie` behavior for session access. |
| `Flask-Cors` | `4.0.1` | `6.0.5` | Correct PNA default and case, regex-priority, and `+` path matching. |
| `python-dotenv` | `1.0.1` | `1.2.2` | Correct symlink handling in dotenv writer helpers. |
| `pytest` | `8.4.2` | `9.0.3` | Correct predictable UNIX temporary-directory behavior. |

The CORS upgrade is paired with an anchored `^/api(?:/.*)?$` resource expression,
explicit `allow_private_network=False`, and focused API-boundary, mixed-case,
plus-character, PNA-preflight, and policy-precedence tests. Those controls preserve the
exact-origin credentialed CORS contract; they are not advisory suppressions.

## Npm advisory disposition

Every underlying npm advisory is listed separately. “Build-only” means the package executes
for local/CI transformation and is absent from the shipped browser runtime, even where the
old manifest caused npm's baseline `--omit=dev` tree to include it.

| Package / installed before | Advisory | Severity | Directness and scope | Dependency path | Affected / first fixed | Reachability, remediation, final status |
| --- | --- | --- | --- | --- | --- | --- |
| `@babel/core@7.29.0` | [`GHSA-4x5r-pxfx-6jf8`](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | Low | Transitive; build-only (baseline scope was misclassified) | root → plugin-react → Babel | `<=7.29.0`; `7.29.6` | Only trusted React/source-map build input reaches it. Lock refresh and corrected scope resolve it at `7.29.7`. |
| `brace-expansion@1.1.14` | [`GHSA-3jxr-9vmj-r5cp`](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | High | Transitive; development-only | root → ESLint → minimatch → brace-expansion | `<1.1.16`; `1.1.16` | Public requests cannot provide lint globs, but repository input could consume CI CPU. Resolved at `1.1.18`. |
| `brace-expansion@1.1.14` | [`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | High | Transitive; development-only | root → ESLint → minimatch → brace-expansion | `<1.1.17`; `1.1.17` | Public requests cannot provide lint globs, but repository input could exhaust CI memory. Resolved at `1.1.18`. |
| `esbuild@0.21.5` | [`GHSA-67mh-4wv8-2f99`](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | Moderate | Transitive; build/dev only (baseline scope was misclassified) | root → Vite → esbuild | `<=0.24.2`; `0.25.0` | Affects the dev server, not the static production client; no public dev server is configured. Vite 6.4.3 resolves it at `0.25.12`. |
| `js-yaml@4.1.1` | [`GHSA-h67p-54hq-rp68`](https://github.com/advisories/GHSA-h67p-54hq-rp68) | Moderate | Transitive; development-only | root → ESLint → eslintrc → js-yaml | `>=4.0.0 <=4.1.1`; `4.2.0` | Only tracked lint configuration is parsed, but malicious repository YAML could consume CI CPU. Resolved at `4.3.1`. |
| `js-yaml@4.1.1` | [`GHSA-52cp-r559-cp3m`](https://github.com/advisories/GHSA-52cp-r559-cp3m) | High | Transitive; development-only | root → ESLint → eslintrc → js-yaml | `>=4.0.0 <4.3.0`; `4.3.0` | Same lint-only reachability; compatible lock refresh resolves it at `4.3.1`. |
| `postcss@8.5.10` | [`GHSA-6g55-p6wh-862q`](https://github.com/advisories/GHSA-6g55-p6wh-862q) | High | Transitive; build-only (baseline scope was misclassified) | root → Vite → PostCSS | `<=8.5.11`; `8.5.12` | Only repository CSS enters the build; source-map file disclosure still mattered on a compromised source tree. Resolved at `8.5.25`. |
| `postcss@8.5.10` | [`GHSA-r28c-9q8g-f849`](https://github.com/advisories/GHSA-r28c-9q8g-f849) | High | Transitive; build-only (baseline scope was misclassified) | root → Vite → PostCSS | `<=8.5.17`; `8.5.18` | Same build-only boundary; previous-map traversal still mattered on a compromised source tree. Resolved at `8.5.25`. |
| `react-router@6.30.3` | [`GHSA-2j2x-hqr9-3h42`](https://github.com/advisories/GHSA-2j2x-hqr9-3h42) | Moderate | Transitive; runtime | root → react-router-dom → react-router | `>=6.7.0 <6.30.4`; `6.30.4` | Browser navigation is reachable, so the exact compatible patch was applied. Resolved at `6.30.4`. |
| `react-router@6.30.3` | [`GHSA-wrjc-x8rr-h8h6`](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) | Moderate | Transitive; runtime | root → react-router-dom → react-router | `>=6.0.0 <7.18.0`; `7.18.0` | Dynamic auth destinations pass `isSafeInternalReturnTo`, which rejects backslashes, external/protocol-relative URLs, CR, and LF; no direct attacker-controlled Link/navigate sink was found. Accepted residual, no known exploitable path. |
| `react-router@6.30.3` | [`GHSA-337j-9hxr-rhxg`](https://github.com/advisories/GHSA-337j-9hxr-rhxg) | Moderate | Transitive runtime package; affected feature is SSR-only | root → react-router-dom → react-router | `>=6.4.0 <7.18.0`; `7.18.0` | This Vite SPA has BrowserRouter only—no server renderer, hydration data, `deserializeErrors`, `StaticRouterProvider`, or `HydratedRouter`. Accepted residual, affected feature absent. |
| `react-router-dom@6.30.3` | [`GHSA-jjmj-jmhj-qwj2`](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2) | Moderate | Direct; runtime | root → react-router-dom | `>=6.30.2 <=6.30.4`; no v6 patch, `7.13.0` on v7 | Unsafe attacker-directed navigation is required. ProtectedRoute creates internal state and every dynamic auth return goes through the hostile-destination-tested validator. Accepted residual, no known exploitable path. |
| `uuid@9.0.1` | [`GHSA-w5hq-g745-h8pq`](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate | Transitive; runtime | root → Drei → uuid | `<11.1.1`; `11.1.1` | Source never imports UUID or calls affected v3/v5/v6 buffer APIs. Drei 9.122.0 safely removes the package instead of forcing an incompatible override. Resolved; package absent. |
| `vite@5.4.21` | [`GHSA-4w7w-66w2-5vf9`](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | Moderate | Direct build tool; baseline scope was misclassified | root → Vite | `<=6.4.1`; `6.4.2` | Optimized-dependency map dev-server path; no public dev server. Exact Vite 6.4.3 resolves it and moves it to development scope. |
| `vite@5.4.21` | [`GHSA-v6wh-96g9-6wx3`](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | Moderate | Direct build tool; baseline scope was misclassified | root → Vite | `<=6.4.2`; `6.4.3` | Windows UNC launch-editor path was not present on the reference host, but remained a collaborator/CI risk. Resolved at `6.4.3`. |
| `vite@5.4.21` | [`GHSA-fx2h-pf6j-xcff`](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | High | Direct build tool; baseline scope was misclassified | root → Vite | `<=6.4.2`; `6.4.3` | Windows alternate-path dev-server bypass; no public dev server, but high severity required removal. Resolved at `6.4.3`. |

### Why React Router 7 was not accepted

The proposed major was tested rather than assumed safe. React Router 7.11 retained multiple
high paths. The current 7.18.2 pair resolves the three v6 moderate records but the live audit
then reports **2 high affected package entries** through
[`GHSA-qwww-vcr4-c8h2`](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), an RSC-mode
CSRF issue affecting `react-router >=7.12.0 <8.3.0`. GrapeVyne does not use RSC, but adopting
a new major that fails the explicit zero-high target is not an acceptable remediation.

The first advisory fix is React Router 8.3.0, whose evaluated graph requires Node
`>=22.22` and React/React DOM `>=19.2.7`; no matching `react-router-dom` 8.3 migration was
available. That would break the required Node 20 and React 18/R3F 8 anchors. Exact
`react-router-dom@6.30.4` therefore has the smaller and safer risk surface: it resolves the
compatible v6 advisory and retains only the three demonstrably unreachable moderate paths.
This is an explicit residual-risk decision, not an npm suppression.

## Python advisory disposition

| Package / installed before | Advisory and aliases | Severity | Directness / scope / path | Affected / first fixed | Reachability, remediation, final status |
| --- | --- | --- | --- | --- | --- |
| `Flask@3.0.3` | `PYSEC-2026-2151`; [`CVE-2026-27205`, `GHSA-68rp-wp8r-4726`](https://github.com/advisories/GHSA-68rp-wp8r-4726) | Low | Direct runtime; root → Flask | `<3.1.3`; `3.1.3` | Signed sessions and proxy caching make the class relevant even with existing private/no-store and `Vary: Cookie` controls. Exact 3.1.3 resolves it; session/cache regressions pass. |
| `Flask-Cors@4.0.1` | `PYSEC-2024-71`; [`CVE-2024-6221`, `GHSA-hxwh-jpp2-84pm`](https://github.com/advisories/GHSA-hxwh-jpp2-84pm) | High | Direct runtime; root → Flask-Cors | `<4.0.2`; `4.0.2` | Exact-origin CORS reduced but did not correct automatic PNA approval. Exact 6.0.5 plus explicit PNA denial resolves it. |
| `Flask-Cors@4.0.1` | `PYSEC-2024-260`; alias of row above | High | Direct runtime; root → Flask-Cors | `<4.0.2`; `4.0.2` | Scanner-retained withdrawn/duplicate row, not a second vulnerability. Same 6.0.5/PNA remediation resolves it; row remains visible for exact accounting. |
| `Flask-Cors@4.0.1` | `PYSEC-2026-1383`; [`CVE-2024-6866`, `GHSA-43qf-4rqw-9q2g`](https://github.com/advisories/GHSA-43qf-4rqw-9q2g) | Moderate | Direct runtime; root → Flask-Cors | `<=5.0.1`; `6.0.0` | Single API policy reduced differential impact but did not fix case-insensitive matching. Resolved at 6.0.5 with mixed-case and API-boundary tests. |
| `Flask-Cors@4.0.1` | `PYSEC-2026-1384`; [`CVE-2024-6839`, `GHSA-7rxf-gvfg-47g4`](https://github.com/advisories/GHSA-7rxf-gvfg-47g4) | Moderate | Direct runtime; root → Flask-Cors | `<=5.0.1`; `6.0.0` | One exact-origin policy reduced regex-priority risk but did not patch it. Resolved at 6.0.5 with policy-precedence coverage. |
| `Flask-Cors@4.0.1` | `PYSEC-2026-1385`; [`CVE-2024-6844`, `GHSA-8vgw-p6qm-5gr7`](https://github.com/advisories/GHSA-8vgw-p6qm-5gr7) | Moderate | Direct runtime; root → Flask-Cors | `<=5.0.1`; `6.0.0` | One API policy reduced `+` normalization impact but did not patch it. Resolved at 6.0.5 with plus-path coverage. |
| `pytest@8.4.2` | `PYSEC-2026-1845`; [`CVE-2025-71176`, `GHSA-6w46-j5rx-g56g`](https://github.com/advisories/GHSA-6w46-j5rx-g56g) | Moderate | Direct development-only; root → pytest | `<9.0.3`; `9.0.3` | Absent from production, but predictable UNIX temp directories affect shared developer/CI hosts. Exact 9.0.3 resolves it; complete tests pass. |
| `python-dotenv@1.0.1` | `PYSEC-2026-2270`; [`CVE-2026-28684`, `GHSA-mf9w-mj56-hr94`](https://github.com/advisories/GHSA-mf9w-mj56-hr94) | Moderate | Direct runtime package; affected writer helpers are local-only; root → python-dotenv | `<1.2.2`; `1.2.2` | Application calls `load_dotenv`, not vulnerable `set_key`/`unset_key`, but the compatible patch was required. Exact 1.2.2 resolves it. |

## Safe-upgrade process and verification

No `npm audit fix --force`, blanket `pip-audit` ignore, advisory suppression, incompatible
override, or React upgrade was used. Direct changes are exact. Each Python pin was installed
in a fresh Python 3.12 environment and followed by `pip check`, `compileall`, the complete
backend suite, and `pip-audit`; the advisory count stepped from 8 to 7, 2, 1, and finally 0.
The final backend suite reports **256 passed, 3 skipped** in the ordinary SQLite run.

The dependency graph also passed the complete frontend lint, typecheck, 294-test unit suite,
production build, bundle budgets, desktop/mobile/reduced-motion Chromium matrix,
Firefox/WebKit smoke, Axe, visual, performance, asset-integrity, auth, privacy, and CORS
regressions. The build retains route isolation and its approved React/R3F/Three anchors.

Residual React Router risk must be re-audited before any future router major or SSR/RSC
adoption. Prompt 10 must rerun the immutable hosted workflow and verify the actual deployed
HTTPS `/api`, cookie, CORS, cache, header, and rollback topology; this local dependency pass
does not claim those platform outcomes.
