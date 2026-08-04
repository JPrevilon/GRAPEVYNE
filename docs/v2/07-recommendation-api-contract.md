# Prompt 07 — Recommendation API Contract

## Endpoint

```http
GET /api/wines/recommendations?query=<encoded query>&limit=<integer>
```

The endpoint is read-only and works anonymously. When a valid Flask session cookie is present, the server may calculate owner-scoped personalization. Identity always comes from the signed session; `userId`, `user_id`, `ownerId`, and every other unknown parameter are rejected rather than ignored.

The endpoint preserves the existing envelopes:

```json
{ "data": { "query": "…", "intent": {}, "personalization": {}, "catalog": {}, "results": [] } }
```

```json
{ "error": { "code": "validation_error", "message": "…", "details": {} } }
```

Every success and error response from this route includes:

```http
Cache-Control: private, no-store
Vary: Cookie
```

## Input validation

| Field | Rule |
| --- | --- |
| `query` | Required once; trimmed; 2–300 characters; `<`, `>`, Unicode control/format/surrogate characters rejected. |
| `limit` | Optional once; default 6; one or two ASCII digits; integer 1–12. |
| Other parameters | Rejected with `400 validation_error`; unsafe names are not reflected in the error body. |

Repeated `query` or `limit` is rejected. The route does not accept JSON and does not mutate the database. Parser normalization happens after route validation; the trimmed request text is returned as `data.query`.

## Success data

| Field | Contract |
| --- | --- |
| `query` | Trimmed safe request string. |
| `intent` | Arrays for category, varietal, region, country, body, acidity, tannin, sweetness, excluded sweetness, pairing, flavor, and occasion; nullable novelty and budget; parser evidence, warnings, and unparsed terms. |
| `personalization` | `status` (`anonymous`, `insufficient_data`, or `active`), non-negative `signalCount`, and an honest disclosure. No profile, notes, IDs, or cellar entries. |
| `catalog` | Provider ID, candidate count, demonstration flag, and limitation disclosure. |
| `results[].wine` | Existing normalized public wine contract. |
| `results[].match` | Score 0–100, confidence, score basis, reasons, cautions, matched tags, missing-data disclosures, and all seven breakdown dimensions. |

Each breakdown dimension contains:

```json
{
  "dimension": "pairing",
  "weight": 30,
  "earnedPoints": 30,
  "availablePoints": 30,
  "normalizedContribution": 60,
  "evidence": ["MATCH: Catalog pairing matches oysters."],
  "unavailableReason": null
}
```

`normalizedContribution` explains the displayed score after any conservative hard-mismatch or requested-unavailable ceiling. `weight` always reports the original conceptual weight. Results may be empty with HTTP 200 when no current candidate has meaningful evidence.

## Error mapping

| Status | Code | Cause |
| ---: | --- | --- |
| 400 | `missing_query` | Missing or whitespace-only query. |
| 400 | `validation_error` | Length/character/limit failure, repeated field, unknown parameter, or identity-selection attempt. |
| 503 | `wine_service_unavailable` | The provider boundary reports an outage. |
| 504 | `wine_service_timeout` | The provider boundary reports a timeout. |
| 500 | `internal_server_error` | Unexpected engine/database failure; internal details are not returned. |

Exact-origin credentialed CORS behavior is unchanged. Trusted configured origins receive the exact allow-origin and credentials headers; untrusted origins do not. Safe GET is not blocked by production CSRF checks, but CORS still controls browser readability.

## Frontend transport and cache contract

`getWineRecommendations(query, { limit, signal })` uses the existing same-origin API client, relative `/api`, and `credentials: "include"`. It trims and validates the query and limit before issuing:

```text
/api/wines/recommendations?query=<URLSearchParams-encoded>&limit=<n>
```

The response is strictly normalized. Unsupported status/dimension/score values, malformed arrays, out-of-range numbers, missing required fields, or earned points greater than available points become an API contract error rather than partially trusted UI data.

React Query keys are:

```text
anonymous: ['public', 'wine-recommendations', trimmedQuery, limit]
signed in: ['private', userId, 'wine-recommendations', trimmedQuery, limit]
```

The UI waits until authentication status is verified before choosing either key. React Query supplies an `AbortSignal`; query changes, mode switches, navigation, and unmounts cancel stale fetches. Aborts are not rendered as provider errors, and stale results cannot overwrite a newer query. No recommendation is stored in `localStorage`.

Discover and Wine Detail both use limit `6`, so following a result link can reuse the exact identity-scoped recommendation entry. A production build issues one recommendation request for an uncached query; React 18 development Strict Mode intentionally replays the initial mount and therefore issues two abort-safe development requests.

Successful signup/login identity changes and logout remove personalized recommendation queries with all other private cache data. Safe anonymous recommendation entries may survive logout. A server-confirmed cellar save, update, or delete invalidates only the active owner's recommendation prefix; pending and failed mutations do not. A save that completes after its control unmounts still invalidates the confirmed owner's caches but cannot emit stale inline feedback or a toast.

## Discover and Wine Detail contract

`/discover?query=<encoded>` defaults to explainable matching and enforces its 2–300-character controlled-parser contract. `mode=catalog` preserves the accepted `/api/wines/search` 1–200-character behavior with the same single input. Neither mode imports the demo-cellar fixture.

Recommendation detail links contain only bounded safe request text:

```text
/wines/<encodedExternalWineId>?request=<encodedQuery>
```

Wine Detail independently loads the public bottle record and reconstructs recommendation context with the current identity-scoped key. A direct detail URL remains fully functional without context. Invalid, failed, or no-longer-ranked context produces an honest unavailable panel without replacing or blocking bottle details. Save-to-cellar still uses the existing authenticated, expected-user, server-confirmed mutation contract.

## Unchanged boundaries

Prompt 07 adds no database field, migration, auth endpoint, cookie format, CORS topology, cellar ownership change, deployment rewrite, or Vercel setting. Existing search and detail contracts remain intact. The endpoint does not create the Prompt 08 Taste Atlas or expose a persisted taste profile.
