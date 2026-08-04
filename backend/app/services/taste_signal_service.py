"""Owner-scoped cellar projections shared by taste-aware services.

The two projections are intentionally different. Recommendation personalization
keeps its accepted Prompt 07 projection, which excludes tags and every private
memory field. The Taste Atlas projection adds only structured fields that its
documented, controlled algorithm can use; free-form notes, titles, locations,
and opened-with values are never selected.
"""

from app.models import CellarEntry, Wine


class OwnerTasteSignalService:
    """Load deterministic, owner-filtered evidence without hydrating ORM rows."""

    def __init__(self, wine_source):
        self.wine_source = wine_source

    def recommendation_rows_for_user(self, user_id):
        """Return the exact narrow evidence boundary accepted in Prompt 07."""

        return (
            CellarEntry.query.with_entities(
                CellarEntry.user_rating,
                CellarEntry.favorite,
                CellarEntry.status,
                CellarEntry.occasion,
                Wine.source,
                Wine.external_api_id,
            )
            .join(Wine, CellarEntry.wine_id == Wine.id)
            .filter(
                CellarEntry.user_id == user_id,
                Wine.source == self.wine_source,
            )
            .order_by(Wine.external_api_id.asc())
            .all()
        )

    def profile_rows_for_user(self, user_id):
        """Return one bounded projection for private Taste Atlas calculation."""

        return (
            CellarEntry.query.with_entities(
                CellarEntry.user_rating,
                CellarEntry.favorite,
                CellarEntry.status,
                CellarEntry.occasion,
                CellarEntry.tags,
                CellarEntry.pairing,
                CellarEntry.would_buy_again,
                Wine.source,
                Wine.external_api_id,
            )
            .join(Wine, CellarEntry.wine_id == Wine.id)
            .filter(CellarEntry.user_id == user_id)
            .order_by(Wine.source.asc(), Wine.external_api_id.asc())
            .all()
        )
