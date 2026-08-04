# Prompt 08 — Private Cellar Memories

## Product and privacy boundary

The authenticated Cellar is now the source of truth for tasting memories. Every displayed
value comes from the current owner's persisted `CellarEntry`; no demo record is copied into
the private cellar and no memory is placed in `localStorage`. Cellar list, detail, create,
update, and delete queries retain the accepted owner predicate and indistinguishable 404
behavior.

The UI states the boundary directly: **“Your tasting memories are private to your
account.”** There is no public-memory or sharing endpoint. Search, public wine detail, demo
routes, recommendations, and the Taste Profile never return free-form memory text.

## Persisted fields and validation

Prompt 08 adds only nullable, backward-compatible columns:

| API field | Database column | Contract |
| --- | --- | --- |
| `memoryTitle` | `memory_title` | Optional trimmed text, maximum 160 characters; blank becomes `null`. |
| `tastedOn` | `tasted_on` | Optional strict `YYYY-MM-DD` calendar date; blank becomes `null`; future dates are rejected. |
| `location` | `location` | Optional trimmed text, maximum 240 characters; blank becomes `null`. |
| `pairing` | `pairing` | Optional trimmed text, maximum 240 characters; blank becomes `null`. |
| `openedWith` | `opened_with` | Optional trimmed text, maximum 240 characters; blank becomes `null`. |
| `wouldBuyAgain` | `would_buy_again` | `true`, `false`, or `null`; strings and numbers are rejected. |

The complete editable contract is:

- `notes`: optional trimmed text, maximum 4,000 characters;
- `occasion`: optional trimmed text, maximum 160 characters;
- `userRating`: `null` or a non-boolean integer from 1 through 5;
- `favorite`: a boolean;
- `status`: `saved`, `tasted`, `wishlist`, `buy_again`, or `archived`;
- `tags`: an array of at most 12 trimmed, nonempty strings, each at most 40
  characters and unique without regard to case.

Blank optional strings are stored as `null`; fields are never silently truncated. PATCH
rejects unknown fields and requires at least one editable field. Validation failures use the
existing `400 validation_error` envelope with field-specific details. React renders memory
values through ordinary text and form-value bindings—there is no
`dangerouslySetInnerHTML` path. The frontend suite includes an inert-markup regression test
for saved title and note strings.

The existing expected-user request header applies to every mutation. Success is shown only
after the database commit; an exception rolls the transaction back and returns the existing
truthful database error.

## Authenticated editing workflow

The selected-bottle panel exposes the full server-confirmed form: rating, private note,
favorite, tags, occasion, status, memory title, tasted date, location, pairing, opened with,
and the tri-state buy-again answer. Native labels, help/error associations, live mutation
feedback, and disabled pending controls make the state operable without pointer hover.
Closing the panel returns focus to the bottle control that opened it.

Successful create, update, and delete operations refresh three owner-specific views:

1. `['private', userId, 'cellar']`
2. `['private', userId, 'taste-profile']`
3. `['private', userId, 'wine-recommendations', ...]`

Failed or still-pending operations do not present saved success. Auth identity changes and
logout cancel and remove private queries and mutations, so an old account's memory or profile
cannot render for a new account.

## Data-derived organization

Cellar groups are computed only from the signed-in user's normalized entries:

- **Recently added** is the six newest persisted entries;
- **Favorites** requires `favorite: true`;
- **Highest rated** contains every entry tied at the current maximum non-null rating;
- **Date night** requires the normalized recorded occasion to be exactly `date`, `date
  night`, `date-night`, or `romantic dinner`;
- **Dinner pairings** requires both a nonblank persisted pairing and a `dinner` token in the
  normalized recorded occasion;
- **Celebrations** requires exactly `anniversary`, `birthday`, `celebration`, `graduation`,
  `holiday celebration`, or `wedding` after normalization;
- **Wishlist** requires status `wishlist`;
- **Buy again** requires status `buy_again` or an explicit `wouldBuyAgain: true`.

Empty groups are omitted. The same entry may appear in more than one truthful view, but the
underlying bottle count is never inflated. The all-bottles list/grid remains the complete,
accessible management interface; visual shelves are not the only way to reach an entry.

## Trust boundary for Taste Atlas input

Free-form `notes`, `memoryTitle`, `location`, and `openedWith` are never selected by the
owner-scoped signal query. `pairing` and `tags` contribute only when an exact normalized
value is present in the controlled current-catalog vocabulary. Unknown text remains private
display data and has no scoring effect. No private text is sent to an external service or
parsed by an LLM.

Schema rollout and rollback are documented in
[`08-migration-and-rollback.md`](./08-migration-and-rollback.md); the aggregate algorithm is
documented in [`08-taste-profile-algorithm.md`](./08-taste-profile-algorithm.md).
