# Prompt 10A hosted Preview report

Status: **in progress — deployment preparation only**. This report is finalized only after GitHub-hosted CI, dedicated Preview PostgreSQL migration, Vercel Preview deployment, hosted browser/security/accessibility/performance verification, evidence capture, cleanup, and a clean worktree.

## Accepted starting point

- Branch: `feat/grapevyne-cinematic-v2`
- Accepted Prompt 09A commit: `98202a81bb46ea314fce40e9a1b45b1e8c60199d`
- Git remote: `JPrevilon/GRAPEVYNE`
- GitHub authentication: verified as repository owner before external writes
- Vercel CLI: `54.14.0`
- Vercel account/team: verified by the user before external writes
- Existing intended Vercel project: none found before preparation
- Existing Marketplace PostgreSQL integration: none found before preparation

No token or environment value is recorded here.

## Local release gate

The complete accepted release gate was rerun after the deployment changes and before the preparation commit:

| Gate | Result |
| --- | --- |
| Frontend asset verification | Passed: 3 foundational assets, 30 cinematic assets, and 10 WebGL/model/label/font hashes |
| Frontend lint / typecheck | Passed |
| Frontend unit tests | Passed: 346 tests in 46 files |
| Frontend production build | Passed: Vite 6.4.3, 2,313 modules |
| Bundle budgets / route isolation | Passed: 8 budgets and 8 isolation checks |
| Chromium E2E | Passed: 34 tests, 92 intentional project skips |
| Firefox / WebKit smoke | Passed: 5 tests, 4 intentional project skips |
| Axe representative scans | Passed |
| Deterministic visual matrix | Passed |
| Five-run performance gate | Passed: LCP 192–312 ms, CLS 0.0011–0.0013, with one 52 ms long task across the five samples; software-renderer fallback accepted |
| npm audit | 0 low/high/critical; 2 previously accepted moderate React Router entries |
| Backend checks / tests | Passed: `pip check`, compile, 309 tests; 3 expected opt-in skips |
| Python security | 0 `pip-audit` findings; 0 Bandit medium/high findings |
| Flask / Alembic contract | 15 routes unchanged; one head at `0002` |
| Disposable PostgreSQL 14.21 migration test | Upgrade, current/check, downgrade preservation, re-upgrade, and final check passed |
| Workflow / secret / diff checks | `actionlint` passed; reachable history and the working tree contain only the same 2 accepted Gitleaks fixture false positives; built frontend had 0 findings; `git diff --check` passed |

The local performance harness used Chromium's software renderer, so no WebGL-ready hardware timing is claimed. Hosted hardware-capable behavior remains a separate Preview measurement.

## Preparation changes

- Replaced the ignored experimental Vercel Services draft with one stable root Vite project plus one `api/index.py` Flask Function.
- Preserved relative same-origin `/api` browser requests and the existing Flask factory/routes.
- Added Vercel/Python/Node runtime bridges, bounded upload/function packaging, explicit SPA direct-route rewrites, static cache classes, Preview indexing policy, and security headers.
- Added exact trusted Vercel-origin derivation, psycopg URL normalization, encrypted PostgreSQL enforcement, and serverless `NullPool` behavior with focused backend tests.
- Added a fail-closed Vercel environment/database sentinel, verified hosted health identity, and a Preview-only disposable-E2E cleanup command with no public cleanup route.
- Added complete Preview metadata and route-specific deliberate 404 metadata using only committed local assets.
- Added an explicit hosted Playwright mode that binds a READY Vercel Preview to the current Git SHA, attests the dedicated database before any write, never starts local servers/databases, strips operator secrets from Playwright, and guarantees guarded pre/post-run cleanup.
- Added topology, environment, and honest physical-device review documentation.

## Hosted results

The following values remain pending and must not be inferred or fabricated:

| Gate | Result |
| --- | --- |
| Preparation commit | Pending |
| Branch push | Pending |
| Pull request | Pending |
| GitHub Actions run/jobs | Pending |
| Vercel project name/ID/root/link | Pending |
| Preview database provider/resource/region | Pending mandatory billing/free-plan checkpoint |
| Preview migrations 0001/0002 at head | Pending |
| Commit-specific Preview URL/deployment ID | Pending |
| Stable branch Preview URL | Pending |
| Build/runtime log review | Pending |
| Hosted API/session/origin/cache checks | Pending |
| Hosted Playwright/Axe/browser checks | Pending |
| Five-run hosted performance measurements | Pending |
| Prompt 10A screenshot package | Pending |
| Disposable Preview account cleanup | Pending |
| Final worktree status | Pending |

## Deferred physical and Production gates

Physical iPhone Safari, physical Mac Safari, and VoiceOver checks remain manual and unclaimed. Pull-request merge, Production database provisioning/migration, Production deployment/promotion, domain/DNS changes, indexability switch, and the final release tag remain exclusively Prompt 10B work.
