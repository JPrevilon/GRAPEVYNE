from collections import Counter
from dataclasses import dataclass, field

from app.services.taste_signal_service import OwnerTasteSignalService
from app.services.wine_service import WineService


PERSONALIZATION_SIGNAL_THRESHOLD = 3


@dataclass
class PreferenceSnapshot:
    status: str
    signal_count: int
    disclosure: str
    attribute_weights: Counter = field(default_factory=Counter)
    seen_wine_ids: set[str] = field(default_factory=set)

    @property
    def is_active(self):
        return self.status == "active"

    def to_public_dict(self):
        return {
            "status": self.status,
            "signalCount": self.signal_count,
            "disclosure": self.disclosure,
        }


class RecommendationPersonalizationService:
    """Build an owner-scoped, in-memory preference snapshot.

    Notes, entry identifiers, and arbitrary manual wine metadata are never read
    into recommendation evidence. The snapshot exists only for the request.
    """

    def __init__(self, wine_service=None):
        self.wine_service = wine_service or WineService()
        self.signal_service = OwnerTasteSignalService(self.wine_service.source)

    def anonymous_snapshot(self):
        return PreferenceSnapshot(
            status="anonymous",
            signal_count=0,
            disclosure=(
                "Results use only this request. Sign in and record at least three "
                "meaningful cellar signals to enable optional taste matching."
            ),
        )

    def for_user(self, user_id, candidates=None):
        rows = self.signal_service.recommendation_rows_for_user(user_id)
        candidate_records = (
            candidates
            if candidates is not None
            else self.wine_service.list_candidates()
        )
        candidates_by_id = {
            candidate["externalWineId"]: candidate
            for candidate in candidate_records
        }
        signal_count = 0
        evidence_strengths = []

        meaningful_wine_ids = set()

        for row in rows:
            if row.source != self.wine_service.source:
                continue

            candidate = candidates_by_id.get(row.external_api_id)
            if not candidate:
                continue

            strength = 0.0
            if row.user_rating in {1, 2, 4, 5}:
                signal_count += 1
                meaningful_wine_ids.add(row.external_api_id)
                if row.user_rating >= 4:
                    strength += row.user_rating / 5
                else:
                    strength -= (3 - row.user_rating) / 3

            if row.favorite:
                signal_count += 1
                meaningful_wine_ids.add(row.external_api_id)
                strength += 1

            if row.status == "buy_again":
                signal_count += 1
                meaningful_wine_ids.add(row.external_api_id)
                strength += 1

            controlled_occasion = self._controlled_occasion(row.occasion)
            if controlled_occasion:
                signal_count += 1
                meaningful_wine_ids.add(row.external_api_id)
                strength += 0.5

            if strength:
                evidence_strengths.append((candidate, strength, controlled_occasion))

        if (
            signal_count < PERSONALIZATION_SIGNAL_THRESHOLD
            or len(meaningful_wine_ids) < 2
        ):
            return PreferenceSnapshot(
                status="insufficient_data",
                signal_count=signal_count,
                disclosure=(
                    "Results remain request-only until this cellar contains at "
                    f"least {PERSONALIZATION_SIGNAL_THRESHOLD} meaningful ratings, "
                    "favorites, buy-again choices, or controlled occasions across "
                    "at least two sourced bottles."
                ),
            )

        snapshot = PreferenceSnapshot(
            status="active",
            signal_count=signal_count,
            disclosure=(
                "Taste fit uses only aggregate attributes from this signed-in "
                "cellar for the current request; notes and cellar records are not "
                "returned."
            ),
        )

        for candidate, strength, controlled_occasion in evidence_strengths:
            external_id = candidate["externalWineId"]
            snapshot.seen_wine_ids.add(external_id)
            for attribute in self._candidate_attributes(candidate):
                snapshot.attribute_weights[attribute] += strength
            if controlled_occasion:
                snapshot.attribute_weights[f"occasion:{controlled_occasion}"] += strength

        return snapshot

    @staticmethod
    def _candidate_attributes(candidate):
        attributes = []
        for field_name in ("varietal", "region", "country", "body", "acidity", "sweetness"):
            value = candidate.get(field_name)
            if value:
                attributes.append(f"{field_name}:{value.lower()}")
        return attributes

    @staticmethod
    def _controlled_occasion(value):
        if not isinstance(value, str):
            return None
        normalized = " ".join(value.lower().split())
        supported = {
            "celebration",
            "date night",
            "dinner",
            "gift",
            "lunch",
        }
        return normalized if normalized in supported else None
