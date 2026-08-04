# Prompt 07 — Explainable Recommendation Engine

## Engine verdict

GRAPEVYNE now has a deterministic recommendation engine for the six records exposed by the existing `WineService`. It is not an AI sommelier: no LLM, embedding, vector store, remote recommendation service, training job, or persisted taste profile is involved. Every recognized clue, earned point, unavailable dimension, caution, and ordering decision can be reconstructed from the request, the current catalog record, and—only for an authenticated owner with enough activity—an ephemeral aggregate of that owner's cellar signals.

The current catalog remains explicitly described as a limited demonstration catalog. The matching logic is real; its candidate coverage is intentionally small.

## Controlled parser

`RecommendationIntentParser` normalizes input with Unicode NFKC, case-folding, surrounding-whitespace trimming, and internal whitespace collapse. The public route separately enforces 2–300 characters and rejects markup delimiters plus Unicode control, formatting, and surrogate characters before the query can be echoed.

Only exact controlled phrases become constraints:

| Dimension | Supported grammar in this catalog build |
| --- | --- |
| Category | `red`, `white`, `sparkling`, `champagne`, `rosé`/`rose` |
| Varietal | Cabernet Sauvignon/Cabernet, Sauvignon Blanc, Pinot Noir, Champagne Blend, Sangiovese, Tempranillo |
| Region | Willamette Valley, Napa Valley, Calistoga, Champagne, Tuscany, Rioja |
| Country | United States/American, France/French, Italy/Italian, Spain/Spanish |
| Body | light, medium, full/full-bodied, bold |
| Acidity | low/medium/high acidity, crisp, bright |
| Tannin | low/medium/high tannin(s), structured, tannic |
| Sweetness | dry, bone dry, brut, off-dry, sweet; `not sweet` and `not too sweet` are explicit exclusions |
| Pairing | Exact catalog-aware food phrases such as steak, oysters, salmon, lamb, sushi, mushroom risotto, pasta Bolognese, fried chicken, and caviar |
| Flavor | Exact sourced tasting tags such as blackberry, graphite, red cherry, rose petal, grapefruit, brioche, and earth |
| Occasion | celebration, birthday, anniversary, gift, dinner/date night/steak night, and lunch/warm afternoon |
| Budget | Dollar-prefixed maximum (`under $60`, `no more than $60`, `not over $60`), minimum (`at least $40`, `no less than $40`, `not under $40`), or range (`between $40 and $75`, `from $40 to $75`, `$40-$75`) |
| Novelty | familiar/safe choice or adventurous/something new/something different |

Parser evidence records the controlled dimension, normalized value, and matched text. Unknown informative tokens remain in `unparsedTerms` and receive no score. Years without a dollar sign are never budgets. A reversed range or multiple budget clauses disables budget scoring and produces a warning.

Negation is conservative. `not sweet` is a supported exclusion. Other negated controlled phrases—such as `not red`, `not a red`, `not dry`, or `avoid sweet`—are consumed, disclosed as `unsupported_negation`, and never inverted into a positive preference. Context guards prevent spaced or hyphenated `rose petal` from becoming rosé and `medium rare`, `medium-rare`, or `medium well` steak language from becoming medium body.

## Normalized candidate boundary

`WineService.list_candidates()` returns isolated copies without changing `search(query)` or `get_by_external_id(id)`. Recommendation candidates use only provider fields or conservative derivations:

- external ID, source, name, winery, varietal, region, country, vintage;
- description, image, listed price, and catalog rating;
- body, acidity, sweetness, pairing tags, flavor/tasting tags, occasion, and serving temperature;
- category derived only from an explicit catalog varietal-to-category table;
- occasion tags derived only from explicit words in the sourced occasion;
- tannin remains unavailable because the provider record has no tannin field.

No missing price, tannin, pairing, flavor, region, or other attribute is fabricated. Null provider collections normalize to empty sourced collections instead of crashing. `catalog_metadata()` returns provider `mock`, candidate count `6`, `isDemonstrationCatalog: true`, and the limitation disclosure used by the UI.

## Scoring contract

The conceptual weights total 100:

| Dimension | Weight | Evidence and availability |
| --- | ---: | --- |
| Pairing fit | 30 | Available only when the request contains a controlled pairing and the record has pairing tags. |
| Personal taste fit | 25 | Available only for an active owner-scoped preference snapshot with sourced candidate overlap. Positive affinity earns points; negative overlap remains in the denominator, earns zero, and is disclosed as a caution. |
| Requested style fit | 15 | Divided evenly across explicit category, varietal, region, country, body, acidity, tannin, sweetness/exclusion, and flavor constraints. Missing candidate fields reduce available points. |
| Budget fit | 10 | Available only for a valid explicit budget and a sourced price. Outside-budget candidates earn zero and a caution. |
| Occasion fit | 10 | Available only for a controlled occasion and sourced derived occasion tags. |
| Source-data confidence | 5 | Proportional to presence of identity, source, image, description, price/rating, location/style, pairing, flavor, structure, and occasion fields. Missing core fields are disclosed and force `limited` confidence. |
| Discovery balance | 5 | Available only when novelty is requested and personalization is active. It compares seen bottles and positive aggregate attributes. |

The base score is:

```text
sum(earned points) / sum(available points) × 100
```

An unrequested or unavailable dimension has `earnedPoints: 0` and `availablePoints: 0`; it never receives free credit. Every result still returns all seven dimensions with original weight, earned points, available points, normalized contribution, evidence, and an unavailable reason. Normalized contributions are scaled to the displayed score.

Two conservative ceilings prevent sparse evidence from looking perfect:

- any explicit hard style or budget mismatch caps the displayed score at 59 and confidence at `limited`;
- any explicitly requested but unavailable pairing/style/budget/occasion/novelty evidence caps the score at 69 and confidence at `limited`.

When at least one meaningful scored candidate satisfies an explicit budget, scored candidates known to be outside that budget or lacking a price are removed. If no budget-compliant meaningful candidate exists, the best evidence-backed candidate may remain with the hard-mismatch cap and a direct caution. Results below 35, results with no positive requested dimension, and candidates with no primary evidence for an explicit pairing/style/occasion request are omitted.

This makes limited-catalog relaxation explicit: a result may be useful, but it cannot be labeled as a high-confidence excellent match when a strong clue is contradicted or unavailable.

## Confidence and stable ordering

After constraint ceilings:

- `high`: score at least 75, at least 45 available points, at least two positive requested/personal dimensions, no hard mismatch, no requested unavailable evidence, and complete core source coverage;
- `medium`: score at least 55, at least 15 available points, at least one positive requested/personal dimension, no hard mismatch, no requested unavailable evidence, and complete core source coverage;
- `limited`: every other returned result.

Ordering is deterministic: descending score, descending matched-evidence coverage, descending positive-dimension count, then ascending external wine ID. No random input or time-dependent value participates. Identical requests over identical catalog and cellar state return identical results.

## Personalization states

Personalization is derived only from the signed Flask session:

- `anonymous`: request-only scoring and zero signals;
- `insufficient_data`: request-only scoring until there are at least three meaningful signals across at least two canonical sourced bottles;
- `active`: the 25-point personal dimension and requested discovery balance may use an in-memory aggregate.

Meaningful signals are ratings 1, 2, 4, or 5; favorite; `buy_again`; and a controlled occasion (`celebration`, `date night`, `dinner`, `gift`, or `lunch`). Rating 3 and neutral `saved`/`tasted` states do not invent preference. Positive signals support catalog-derived varietal, region, country, body, acidity, sweetness, and occasion attributes. Ratings 1–2 contribute negative aggregate weights; overlap produces an explicit caution and offsets positive affinity.

The aggregation SQL is filtered by the current owner and canonical provider source, has a stable external-ID ordering, and projects only rating, favorite, status, controlled occasion input, source, and external wine ID. Notes, tags, cellar entry IDs, wine database IDs, and user identity are not selected into recommendation evidence. Provider candidates are reused within the request, and the snapshot is never persisted.

## Privacy and threat boundary

The endpoint does not accept a user ID in query parameters, JSON, or the expected-user mutation header. A header cannot activate personalization. Signed-out responses contain no cellar data. Signed-in responses expose only status, signal count, disclosure, scores, and safe aggregate attribute explanations for the current session owner.

HTTP responses are `private, no-store` with `Vary: Cookie`. Frontend personalized keys begin `['private', userId, 'wine-recommendations', ...]`; anonymous keys begin `['public', 'wine-recommendations', ...]`. Auth changes remove all private queries/mutations, while safe public cache entries may remain. Cellar save, confirmed update, and confirmed delete invalidate only the active owner's recommendation prefix.

This boundary does not defend against a compromised same-origin application script or an already-stolen valid session; those remain broader application/browser security concerns. Existing exact-origin CORS, Fetch Metadata, secure production cookie, expected-user mutation precondition, and owner-scoped cellar rules remain unchanged.

## Current limitations and Prompt 08 boundary

The parser is deliberately finite and English-language. It does not perform fuzzy matching, semantic similarity, arbitrary negation, compound preference logic, or inference from prose outside its dictionaries. The six-record catalog has no rosé and no explicit tannin field. Scores compare only this candidate set and must not be interpreted as market-wide rankings.

Prompt 08 remains responsible for any full Taste Profile or Taste Atlas aggregation. Prompt 07 adds no schema, migration, persisted profile, social feature, AI service, background job, or deployment configuration.
