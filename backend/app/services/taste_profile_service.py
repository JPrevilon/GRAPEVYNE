"""Deterministic private Taste Atlas derivation for the current catalog."""

from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass, field
import re
import unicodedata

from app.services.recommendation_service import CATEGORY_BY_VARIETAL
from app.services.taste_signal_service import OwnerTasteSignalService
from app.services.wine_service import WineService


TASTE_PROFILE_ALGORITHM_VERSION = "taste-atlas-v1"
TASTE_PROFILE_ACTIVE_SIGNAL_THRESHOLD = 5
TASTE_PROFILE_ACTIVE_WINE_THRESHOLD = 3
TASTE_PROFILE_ACTIVE_DIMENSION_THRESHOLD = 2
MAX_SIGNALS_PER_CANONICAL_WINE = 8
MAX_ABSOLUTE_WINE_STRENGTH = 8.0

RATING_WEIGHTS = {1: -3.0, 2: -2.0, 3: 0.0, 4: 2.0, 5: 3.0}
FAVORITE_WEIGHT = 3.0
WOULD_BUY_AGAIN_WEIGHT = 4.0
BUY_AGAIN_STATUS_WEIGHT = 2.0
TASTED_STATUS_WEIGHT = 0.5
CONTROLLED_OCCASION_WEIGHT = 0.5
CONTROLLED_PAIRING_WEIGHT = 0.5
CONTROLLED_TAG_WEIGHT = 0.25
MAX_CONTROLLED_TAG_WEIGHT = 0.5

CONTROLLED_OCCASIONS = frozenset(
    {"celebration", "date night", "dinner", "gift", "lunch"}
)
DIMENSION_ORDER = {
    "category": 0,
    "varietal": 1,
    "place": 2,
    "flavor": 3,
    "structure": 4,
    "occasion": 5,
}
ATTRIBUTE_WEIGHTS = {
    "category": 1.5,
    "varietal": 2.0,
    "place": 1.5,
    "flavor": 0.5,
    "structure": 1.0,
}


@dataclass
class _WineEvidence:
    external_id: str
    candidate: dict
    signal_count: int = 0
    strength: float = 0.0
    controlled_tags: set[str] = field(default_factory=set)
    controlled_occasions: set[str] = field(default_factory=set)


@dataclass
class _Aggregate:
    raw_score: float = 0.0
    wine_ids: set[str] = field(default_factory=set)


class TasteProfileService:
    """Build an ephemeral, explainable profile from one owner's persisted rows."""

    def __init__(self, wine_service=None, signal_service=None):
        self.wine_service = wine_service or WineService()
        self.signal_service = signal_service or OwnerTasteSignalService(
            self.wine_service.source
        )

    def for_user(self, user_id):
        candidates = self.wine_service.list_candidates()
        candidates_by_id = {
            candidate["externalWineId"]: candidate for candidate in candidates
        }
        rows = self.signal_service.profile_rows_for_user(user_id)
        evidence_by_wine = self._canonical_evidence(rows, candidates_by_id)
        aggregates = defaultdict(_Aggregate)
        meaningful_entries = 0
        signal_count = 0
        priced_records = []

        for evidence in evidence_by_wine.values():
            if evidence.signal_count == 0:
                continue

            meaningful_entries += 1
            signal_count += evidence.signal_count
            candidate = evidence.candidate
            price_cents = candidate.get("priceCents")
            if isinstance(price_cents, int) and price_cents >= 0:
                priced_records.append(price_cents)

            for attribute in self._candidate_attributes(candidate):
                aggregate = aggregates[attribute]
                aggregate.raw_score += evidence.strength
                aggregate.wine_ids.add(evidence.external_id)

            for tag in evidence.controlled_tags:
                attribute = self._attribute_for_controlled_value(tag, candidates)
                if attribute:
                    aggregate = aggregates[attribute]
                    aggregate.raw_score += CONTROLLED_TAG_WEIGHT
                    aggregate.wine_ids.add(evidence.external_id)

            for occasion in evidence.controlled_occasions:
                attribute = ("occasion", "recorded", occasion, occasion.title())
                aggregate = aggregates[attribute]
                aggregate.raw_score += CONTROLLED_OCCASION_WEIGHT
                aggregate.wine_ids.add(evidence.external_id)

        positive_signals = self._public_signals(aggregates, polarity="positive")
        lower_affinity_signals = self._public_signals(
            aggregates,
            polarity="negative",
        )
        positive_dimensions = {signal["dimension"] for signal in positive_signals}

        if signal_count == 0:
            state = "empty"
        elif (
            signal_count >= TASTE_PROFILE_ACTIVE_SIGNAL_THRESHOLD
            and meaningful_entries >= TASTE_PROFILE_ACTIVE_WINE_THRESHOLD
            and len(positive_dimensions) >= TASTE_PROFILE_ACTIVE_DIMENSION_THRESHOLD
        ):
            state = "active"
        else:
            state = "limited"

        seen_wine_ids = set(evidence_by_wine)
        adjacent_suggestion = self._adjacent_suggestion(
            state,
            candidates,
            seen_wine_ids,
            aggregates,
        )
        observed_price_range = (
            {
                "minimumCents": min(priced_records),
                "maximumCents": max(priced_records),
                "sampleSize": len(priced_records),
            }
            if len(priced_records) >= 2
            else None
        )

        return {
            "state": state,
            "algorithmVersion": TASTE_PROFILE_ALGORITHM_VERSION,
            "summary": self._summary(state, positive_signals),
            "evidence": {
                "totalCellarEntries": len(rows),
                "meaningfulEntries": meaningful_entries,
                "distinctCanonicalWines": len(evidence_by_wine),
                "signalCount": signal_count,
            },
            "signals": positive_signals,
            "lowerAffinitySignals": lower_affinity_signals,
            "observedPriceRange": observed_price_range,
            "adjacentSuggestion": adjacent_suggestion,
            "catalog": self.wine_service.catalog_metadata(),
            "disclosure": (
                "This private profile is calculated per request from aggregate, "
                "owner-scoped structured cellar signals and factual attributes in "
                "the current limited demonstration catalog. Free-form memories are "
                "not analyzed or returned."
            ),
        }

    def _canonical_evidence(self, rows, candidates_by_id):
        evidence_by_wine = {}
        controlled_vocabulary = self._controlled_vocabulary(
            candidates_by_id.values()
        )

        for row in rows:
            if getattr(row, "source", None) != self.wine_service.source:
                continue

            external_id = getattr(row, "external_api_id", None)
            candidate = candidates_by_id.get(external_id)
            if not candidate:
                continue

            evidence = evidence_by_wine.setdefault(
                external_id,
                _WineEvidence(external_id=external_id, candidate=candidate),
            )
            row_strength, row_signal_count = self._row_strength(
                row,
                controlled_vocabulary,
            )
            evidence.strength = max(
                -MAX_ABSOLUTE_WINE_STRENGTH,
                min(MAX_ABSOLUTE_WINE_STRENGTH, evidence.strength + row_strength),
            )
            evidence.signal_count = min(
                MAX_SIGNALS_PER_CANONICAL_WINE,
                evidence.signal_count + row_signal_count,
            )

            if self._wishlist_only(row):
                continue

            evidence.controlled_tags.update(
                tag
                for tag in self._normalized_tags(getattr(row, "tags", None))
                if tag in controlled_vocabulary
            )
            controlled_occasion = self._controlled_occasion(
                getattr(row, "occasion", None)
            )
            if controlled_occasion:
                evidence.controlled_occasions.add(controlled_occasion)

        return evidence_by_wine

    def _row_strength(self, row, controlled_vocabulary):
        rating = getattr(row, "user_rating", None)
        favorite = getattr(row, "favorite", False) is True
        status = getattr(row, "status", None)
        would_buy_again = getattr(row, "would_buy_again", None)
        strength = 0.0
        signal_count = 0

        if rating in {1, 2, 4, 5}:
            strength += RATING_WEIGHTS[rating]
            signal_count += 1
        if favorite:
            strength += FAVORITE_WEIGHT
            signal_count += 1
        if would_buy_again is not None:
            strength += WOULD_BUY_AGAIN_WEIGHT if would_buy_again else -WOULD_BUY_AGAIN_WEIGHT
            signal_count += 1
        if status == "buy_again":
            strength += BUY_AGAIN_STATUS_WEIGHT
            signal_count += 1
        elif status == "tasted":
            strength += TASTED_STATUS_WEIGHT
            signal_count += 1

        if self._wishlist_only(row):
            return strength, signal_count

        occasion = self._controlled_occasion(getattr(row, "occasion", None))
        if occasion:
            strength += CONTROLLED_OCCASION_WEIGHT
            signal_count += 1

        pairing = self._normalize_value(getattr(row, "pairing", None))
        if pairing and pairing in controlled_vocabulary:
            strength += CONTROLLED_PAIRING_WEIGHT
            signal_count += 1

        controlled_tags = {
            tag
            for tag in self._normalized_tags(getattr(row, "tags", None))
            if tag in controlled_vocabulary
        }
        if controlled_tags:
            strength += min(
                MAX_CONTROLLED_TAG_WEIGHT,
                len(controlled_tags) * CONTROLLED_TAG_WEIGHT,
            )
            signal_count += 1

        return strength, signal_count

    @staticmethod
    def _wishlist_only(row):
        return (
            getattr(row, "status", None) == "wishlist"
            and getattr(row, "user_rating", None) not in {1, 2, 4, 5}
            and getattr(row, "favorite", False) is not True
            and getattr(row, "would_buy_again", None) is None
        )

    @classmethod
    def _controlled_vocabulary(cls, candidates):
        vocabulary = set(CONTROLLED_OCCASIONS)
        for candidate in candidates:
            for field_name in ("pairings", "tastingNotes"):
                vocabulary.update(
                    cls._normalize_value(value)
                    for value in (candidate.get(field_name) or [])
                    if cls._normalize_value(value)
                )
            for field_name in ("body", "acidity", "sweetness"):
                value = cls._normalize_value(candidate.get(field_name))
                if value:
                    vocabulary.add(value)
        return vocabulary

    @classmethod
    def _candidate_attributes(cls, candidate):
        attributes = []
        category = CATEGORY_BY_VARIETAL.get(candidate.get("varietal"))
        if category:
            attributes.append(("category", "category", category, category.title()))

        varietal = candidate.get("varietal")
        if varietal:
            attributes.append(
                ("varietal", "varietal", cls._normalize_value(varietal), varietal)
            )

        for subtype, field_name in (("region", "region"), ("country", "country")):
            value = candidate.get(field_name)
            if value:
                attributes.append(
                    ("place", subtype, cls._normalize_value(value), value)
                )

        for subtype in ("body", "acidity", "sweetness"):
            value = candidate.get(subtype)
            if value:
                normalized = cls._normalize_value(value)
                attributes.append(
                    (
                        "structure",
                        subtype,
                        normalized,
                        f"{value.title()} {subtype}",
                    )
                )

        for value in candidate.get("tastingNotes") or []:
            attributes.append(
                ("flavor", "flavor", cls._normalize_value(value), value.title())
            )

        return tuple(dict.fromkeys(attributes))

    @classmethod
    def _attribute_for_controlled_value(cls, value, candidates):
        for candidate in candidates:
            for attribute in cls._candidate_attributes(candidate):
                if attribute[2] == value:
                    return attribute
        return None

    @classmethod
    def _public_signals(cls, aggregates, polarity):
        if polarity == "positive":
            eligible = [
                (attribute, aggregate)
                for attribute, aggregate in aggregates.items()
                if aggregate.raw_score > 0
            ]
        else:
            eligible = [
                (attribute, aggregate)
                for attribute, aggregate in aggregates.items()
                if aggregate.raw_score <= -2 and len(aggregate.wine_ids) >= 2
            ]

        if not eligible:
            return []

        maximum = max(abs(aggregate.raw_score) for _, aggregate in eligible)
        eligible.sort(
            key=lambda item: (
                DIMENSION_ORDER[item[0][0]],
                -abs(item[1].raw_score),
                item[0][3].casefold(),
                item[0][2],
            )
        )
        per_dimension = defaultdict(int)
        signals = []

        for attribute, aggregate in eligible:
            dimension, subtype, normalized_value, label = attribute
            if per_dimension[dimension] >= 2:
                continue
            per_dimension[dimension] += 1
            score = round(abs(aggregate.raw_score) / maximum * 100, 1)
            evidence_count = len(aggregate.wine_ids)
            if polarity == "positive":
                summary = (
                    f"An observed {dimension} pattern across {evidence_count} "
                    f"recorded {'bottle' if evidence_count == 1 else 'bottles'}."
                )
            else:
                summary = (
                    f"A lower-affinity {dimension} signal across {evidence_count} "
                    "recorded bottles; this is an emerging pattern, not an absolute."
                )
            signals.append(
                {
                    "id": cls._signal_id(dimension, subtype, normalized_value),
                    "dimension": dimension,
                    "label": label,
                    "score": score,
                    "evidenceCount": evidence_count,
                    "summary": summary,
                }
            )

        return signals

    @classmethod
    def _adjacent_suggestion(cls, state, candidates, seen_wine_ids, aggregates):
        if state != "active":
            return None

        positive_attributes = {
            attribute: aggregate.raw_score
            for attribute, aggregate in aggregates.items()
            if aggregate.raw_score > 0
        }
        seen_varietals = {
            attribute[2]
            for attribute in positive_attributes
            if attribute[0] == "varietal"
        }
        seen_regions = {
            attribute[2]
            for attribute in positive_attributes
            if attribute[:2] == ("place", "region")
        }
        ranked = []

        for candidate in candidates:
            external_id = candidate.get("externalWineId")
            if not external_id or external_id in seen_wine_ids:
                continue

            attributes = cls._candidate_attributes(candidate)
            overlaps = [
                attribute for attribute in attributes if attribute in positive_attributes
            ]
            if not overlaps:
                continue

            varietal = cls._normalize_value(candidate.get("varietal"))
            region = cls._normalize_value(candidate.get("region"))
            has_novel_varietal = bool(varietal) and varietal not in seen_varietals
            has_novel_region = bool(region) and region not in seen_regions
            if not (has_novel_varietal or has_novel_region):
                continue

            overlap_score = sum(
                positive_attributes[attribute]
                * ATTRIBUTE_WEIGHTS[attribute[0]]
                for attribute in overlaps
            )
            ranked.append((overlap_score, external_id, candidate, overlaps))

        if not ranked:
            return None

        ranked.sort(key=lambda item: (-item[0], item[1]))
        _, _, candidate, overlaps = ranked[0]
        overlaps.sort(
            key=lambda attribute: (
                -positive_attributes[attribute] * ATTRIBUTE_WEIGHTS[attribute[0]],
                DIMENSION_ORDER[attribute[0]],
                attribute[3].casefold(),
            )
        )
        reasons = [
            f"It shares the observed {attribute[3]} {attribute[0]} signal."
            for attribute in overlaps[:2]
        ]
        varietal = candidate.get("varietal")
        region = candidate.get("region")
        if varietal or region:
            addition = " from ".join(value for value in (varietal, region) if value)
            reasons.append(f"It adds {addition} within the current catalog.")

        return {
            "wine": deepcopy(candidate),
            "reasons": reasons[:3],
            "confidence": "limited",
            "disclosure": (
                "This deterministic next branch is one adjacent, unseen record in "
                "the current limited demonstration catalog—not a market-wide or "
                "purchase-availability claim."
            ),
        }

    @staticmethod
    def _summary(state, positive_signals):
        if state == "empty":
            return (
                "Your Taste Atlas begins with the first bottle you taste, rate, "
                "or mark as a favorite."
            )
        if state == "limited":
            return (
                "An early preference is emerging. A few more rated bottles across "
                "different styles will make this profile clearer."
            )

        labels = [signal["label"] for signal in positive_signals[:3]]
        if labels:
            return (
                "Based on your recorded cellar history, observed signals currently "
                f"include {', '.join(labels)}."
            )
        return (
            "Your recorded cellar history is active, while its positive dimensions "
            "remain intentionally cautious."
        )

    @classmethod
    def _controlled_occasion(cls, value):
        normalized = cls._normalize_value(value)
        return normalized if normalized in CONTROLLED_OCCASIONS else None

    @classmethod
    def _normalized_tags(cls, value):
        if not isinstance(value, list):
            return ()
        return tuple(
            normalized
            for item in value
            if (normalized := cls._normalize_value(item))
        )

    @staticmethod
    def _normalize_value(value):
        if not isinstance(value, str):
            return ""
        return " ".join(unicodedata.normalize("NFKC", value).casefold().split())

    @classmethod
    def _signal_id(cls, dimension, subtype, value):
        slug = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
        slug = re.sub(r"[^a-z0-9]+", "-", slug.casefold()).strip("-") or "value"
        return f"{dimension}-{subtype}-{slug}"
