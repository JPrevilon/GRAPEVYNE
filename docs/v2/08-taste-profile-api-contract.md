# Prompt 08 — Taste Profile API Contract

## Endpoint

```http
GET /api/profile/taste
```

The endpoint requires the signed Flask session and derives the owner only from that session.
It accepts no query parameters, including no user or expected-user identifier, and performs
no mutation. Every success and error emitted through the blueprint includes:

```http
Cache-Control: private, no-store
Vary: Cookie
```

## Success envelope

```json
{
  "data": {
    "profile": {
      "state": "active",
      "algorithmVersion": "taste-atlas-v1",
      "summary": "Based on your recorded cellar history, observed signals currently include Red, Cabernet Sauvignon, United States.",
      "evidence": {
        "totalCellarEntries": 3,
        "meaningfulEntries": 3,
        "distinctCanonicalWines": 3,
        "signalCount": 6
      },
      "signals": [
        {
          "id": "varietal-varietal-cabernet-sauvignon",
          "dimension": "varietal",
          "label": "Cabernet Sauvignon",
          "score": 33.3,
          "evidenceCount": 1,
          "summary": "An observed varietal pattern across 1 recorded bottle."
        }
      ],
      "lowerAffinitySignals": [],
      "observedPriceRange": {
        "minimumCents": 3000,
        "maximumCents": 9500,
        "sampleSize": 3
      },
      "adjacentSuggestion": null,
      "catalog": {
        "provider": "mock",
        "candidateCount": 6,
        "isDemonstrationCatalog": true,
        "limitations": "The current portfolio build uses a limited demonstration catalog. Matching logic is real, but the available candidate set is intentionally small."
      },
      "disclosure": "This private profile is calculated per request from aggregate, owner-scoped structured cellar signals and factual attributes in the current limited demonstration catalog. Free-form memories are not analyzed or returned."
    }
  }
}
```

The example shows the shape, not a guaranteed profile for arbitrary input. `state` is one of
`empty`, `limited`, or `active`. Signal `dimension` is one of `category`, `varietal`, `place`,
`flavor`, `structure`, or `occasion`; score is 0–100. At most two signals per dimension are
returned in deterministic order.

`observedPriceRange` is `null` below its two-record evidence threshold.
`adjacentSuggestion` is either `null` or:

```json
{
  "wine": { "externalWineId": "mock-la-rioja-alta-reserva-2018" },
  "reasons": ["It shares an observed factual signal."],
  "confidence": "limited",
  "disclosure": "Limited-catalog provenance and availability boundary."
}
```

The `wine` member uses the existing normalized public wine contract and contains no database
ID. A suggestion always names a real, unseen current-catalog record.

## Privacy omissions

The endpoint never returns user ID, cellar entry ID, database wine ID, notes, memory title,
location, opened-with text, raw row history, or an uncontrolled private tag/pairing. Safe
evidence values are aggregate counts. The service never accepts another owner's selector and
does not persist or share computed profiles.

## Errors

Errors retain the application envelope:

```json
{ "error": { "code": "validation_error", "message": "…", "details": {} } }
```

| Status | Code | Cause |
| ---: | --- | --- |
| 400 | `validation_error` | Any query parameter was supplied. Parameter names are not reflected. |
| 401 | `authentication_required` | No valid signed session. |
| 503 | `wine_service_unavailable` | Current catalog provider unavailable. |
| 504 | `wine_service_timeout` | Current catalog provider timeout. |
| 500 | `database_error` | SQLAlchemy/database failure; details are not exposed. |
| 500 | `internal_server_error` | Other unexpected internal failure; details are not exposed. |

## Frontend transport and cache contract

`getTasteProfile(signal)` uses the existing same-origin client, `/api` prefix,
`credentials: "include"`, and React Query's cancellation signal. The only live key is:

```text
['private', userId, 'taste-profile']
```

It is disabled until authentication resolves and a user ID exists. Logout or account change
cancels and removes all private query and mutation entries. A confirmed Cellar create,
update, or delete invalidates the active owner's cellar, taste-profile, and personalized
recommendation prefixes; pending and failed mutations do not claim success. No profile or
memory is stored in browser storage. Demo Taste Atlas data is read-only fixture state and
never uses the private key or endpoint.
