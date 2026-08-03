# Prompt 09A full-history secret scan

Date: 2026-08-03

Branch: `feat/grapevyne-cinematic-v2`

Accepted Prompt 09 revision: `14f7e4cb85d585d6da1e153c3882da4549f6e4fa`

## Verdict

**PASS after manual adjudication.** No real credential, access token, private URL, database secret, or browser-auth state was found in the complete reachable Git history or the current repository tree. The scanner returned two redacted `generic-api-key` candidates in each scan. Both are deterministic test-only fixtures, not live credentials; their values are intentionally omitted from this document.

No history rewrite, credential rotation, ignore rule, or scanner suppression was performed.

## Scanner and scope

- Scanner: Gitleaks `8.30.1`, obtained in a disposable Homebrew download/extraction area and executed from `/tmp`.
- Repository state: non-shallow (`git rev-parse --is-shallow-repository` returned `false`).
- Reachable history: all refs via `--log-opts=--all`; 15 reachable commits at scan time.
- History volume reported by Gitleaks: 2.30 MB.
- Working-tree volume reported by Gitleaks: 257.64 MB.
- Reports: JSON with values fully redacted. Raw reports remained under the disposable `/tmp/grapevyne-scanner-tools.gL82sP/` directory and were not added to Git.

Normalized commands used:

```bash
git rev-parse --is-shallow-repository
git rev-list --all --count
gitleaks git . --log-opts=--all --redact=100 \
  --report-format=json --report-path=<disposable-history-report>
gitleaks dir . --redact=100 \
  --report-format=json --report-path=<disposable-working-tree-report>
git ls-files
git check-ignore -v backend/.env frontend/.env frontend/test-results
```

Gitleaks exited nonzero because it reports candidates before contextual adjudication. The result is not represented as a raw zero-finding scanner run; the pass verdict follows the explicit review below.

## Redacted findings and adjudication

| Scan | Rule | Location | Commit | Classification | Reason |
| --- | --- | --- | --- | --- | --- |
| Full history | `generic-api-key` | `frontend/scripts/run-e2e.mjs:166` | `14f7e4cb85d585d6da1e153c3882da4549f6e4fa` | False positive / test fixture | A fixed, disposable E2E Flask session-signing value used only for local test processes. It is not accepted by any hosted or production system. |
| Full history | `generic-api-key` | `backend/tests/test_session_security.py:10` | `3bdfff71e8730d19fcdee67401e305488bc398f9` | False positive / test fixture | A fixed sentinel used to prove that production configuration rejects insecure or default session configuration. It is not a deployed credential. |
| Working tree | `generic-api-key` | `frontend/scripts/run-e2e.mjs:166` | n/a | Same false positive | Same deterministic E2E-only fixture as above. |
| Working tree | `generic-api-key` | `backend/tests/test_session_security.py:10` | n/a | Same false positive | Same deterministic security-test sentinel as above. |

No candidate value is reproduced here. The redacted reports contain fingerprints and locations only for review.

## Tracked-file checks

- The only tracked environment-shaped files are `backend/.env.example` and `frontend/.env.example`; both are templates without production secrets.
- The local `backend/.env` is ignored by `.gitignore` and is not tracked. Its contents were not copied into evidence.
- No browser storage state, Playwright authentication state, disposable account credential file, database (`.db`, `.sqlite`, `.sqlite3`), Vercel project/token state, Gitleaks raw report, or generated dependency-audit report is tracked.
- `.gitignore` covers `.env`, `.env.*` except examples, Playwright reports/results and auth directories, and local database extensions.
- No generated report containing a detected value was committed.

## Boundary

This is local repository and reachable-history evidence. Prompt 10 still owns hosted GitHub secret configuration, Vercel project/environment inspection, production credential provenance and rotation policy, and live platform validation.
