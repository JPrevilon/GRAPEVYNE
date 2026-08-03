# Prompt 08 — Taste Profile Algorithm

## Scope and version

`taste-atlas-v1` is deterministic, ephemeral, and owner-scoped. It loads one bounded SQL
projection for the signed-in owner, joins only the current wine source metadata needed to
resolve canonical external IDs, and calculates the response in memory. It persists no
profile and uses no shared server cache, LLM, embedding, analytics SDK, or external profile
service.

Prompt 07 recommendation personalization continues to activate at three meaningful signals
across two canonical sourced wines. Its accepted weights, outputs, and narrow SQL projection
are unchanged: rating, favorite, `buy_again` status, controlled occasion, source, and external
ID only. Prompt 08 tags, pairing, and `wouldBuyAgain` do **not** alter Prompt 07
personalization. The common `OwnerTasteSignalService` centralizes only the owner filter and
the two explicitly different projections.

## Admitted evidence

For each current-source canonical wine, the service may use rating, favorite, accepted
status, explicit occasion, structured tags, conservatively controlled pairing, and the
tri-state buy-again answer. Public signal attributes are reproducible as follows:

- category uses the accepted Prompt 07 `CATEGORY_BY_VARIETAL` mapping: Cabernet Sauvignon,
  Pinot Noir, Sangiovese, and Tempranillo → `red`; Sauvignon Blanc → `white`; Champagne
  Blend → `sparkling`;
- varietal is the sourced catalog varietal;
- place is the sourced region and country;
- structure is the sourced body, acidity, and sweetness;
- flavor is the sourced `tastingNotes` list;
- occasion is only an allowlisted occasion explicitly recorded by the owner.

Missing attributes contribute nothing. Category is derived by the fixed accepted mapping;
it is not a field supplied directly by the current WineService records.

The service excludes notes, memory title, location, opened-with text, cellar entry IDs,
database wine IDs, and user identity from its SQL projection. Manual/unknown-source wines do
not create catalog affinity. A wishlist-only entry with no explicit rating, favorite, or
buy-again answer produces zero signals even when it contains tags, pairing, or occasion.

Catalog marketing occasion text never creates an owner occasion pattern. Only one of the
five exact recorded values—`celebration`, `date night`, `dinner`, `gift`, or `lunch`—can do
so. Pairing or tag text contributes only after Unicode NFKC normalization, case folding,
whitespace collapse, and exact membership in the controlled vocabulary built from current
catalog pairings, tasting notes, structural labels, and the five occasions.

## Exact evidence weights

Each independent row begins at zero:

| Evidence | Strength | Signal count |
| --- | ---: | ---: |
| Rating 1 | -3.0 | 1 |
| Rating 2 | -2.0 | 1 |
| Rating 3 or absent | 0 | 0 |
| Rating 4 | +2.0 | 1 |
| Rating 5 | +3.0 | 1 |
| Favorite | +3.0 | 1 |
| `wouldBuyAgain: true` | +4.0 | 1 |
| `wouldBuyAgain: false` | -4.0 | 1 |
| Status `buy_again` | +2.0 | 1 |
| Status `tasted` | +0.5 | 1 |
| Exact controlled recorded occasion | +0.5 | 1 |
| Exact controlled pairing | +0.5 | 1 |
| One or more exact controlled tags | +0.25 each, capped at +0.5 per row | 1 total |

Saving a bottle alone is zero evidence. Rating 3 or a missing rating, `favorite: false`, a
null buy-again answer, and statuses other than `tasted` or `buy_again` add zero. Wishlist-only
rows may retain explicit rating/favorite/buy-again evidence, but their occasion, pairing, and
tag fields do not contribute.

A canonical wine is capped at eight counted signals and absolute strength 8.0. Duplicate
rows for the same external wine therefore cannot create unlimited influence. In the current
schema, the owner/wine uniqueness constraint supplies an additional database-level bound.

The capped wine strength is added to every factual, present attribute on that catalog wine.
An exact structured tag also adds +0.25 to the matching controlled attribute. A recorded
controlled occasion adds +0.5 to that occasion pattern. Independent canonical wines add to
the same aggregate and increase its safe `evidenceCount`.

## Public signal normalization and states

Positive aggregates are values above zero. Their public score is:

```text
absolute aggregate / largest positive aggregate × 100
```

Negative aggregates are returned only when their value is at most -2.0 and at least two
distinct canonical wines support them. They are labeled “lower-affinity” and explicitly
described as an emerging pattern, never as an absolute dislike. Positive and lower-affinity
scores normalize separately. Output is stable by dimension order (category, varietal,
place, flavor, structure, occasion), descending strength, case-folded label, then normalized
value; at most two signals per dimension are returned.

States are exact:

- `empty`: zero meaningful signals;
- `limited`: at least one signal, but an active threshold is not met;
- `active`: at least five signals, at least three meaningful canonical wines, and positive
  evidence in at least two public dimensions.

`totalCellarEntries` counts owner rows loaded; `meaningfulEntries` counts distinct canonical
wines with a signal; `distinctCanonicalWines` counts current-source catalog wines represented;
and `signalCount` is the capped sum. The observed price range appears only with at least two
meaningful priced canonical wines and reports their minimum, maximum, and sample size.

## Adjacent branch

Only an active profile can receive one suggestion. Candidates come directly from
`WineService.list_candidates()`, must be unseen, must overlap at least one positive factual
attribute, and must introduce a sourced varietal or region absent from the profile's
positive aggregates. Ranking is deterministic. For every overlapping attribute:

```text
overlap score += raw positive aggregate × dimension weight
```

Dimension weights are category 1.5, varietal 2.0, place 1.5, flavor 0.5, and structure 1.0.
Candidates sort by descending overlap score and then ascending external wine ID.
Catalog-derived occasions are not admitted.

The response copies the real public catalog record and up to three factual reasons. It is
always `limited` confidence and discloses that the choice is from the current limited demo
catalog, not a market-wide rank or availability claim. It is `null` when no responsible
unseen adjacent record exists.

## Determinism and complexity

Database work is one owner-scoped projection, avoiding N+1 queries. Candidate lookup is by
external ID; canonical evidence is bounded per wine. The only small catalog scan used for
controlled-value mapping is over the current six-record in-memory catalog. Identical catalog
and cellar state produces byte-equivalent ordered JSON apart from ordinary envelope encoding.
