from copy import deepcopy
from dataclasses import dataclass

from app.services.recommendation_parser import RecommendationIntentParser
from app.services.recommendation_personalization import (
    RecommendationPersonalizationService,
)
from app.services.wine_service import WineService


SCORING_WEIGHTS = {
    "pairing": 30,
    "personal_taste": 25,
    "requested_style": 15,
    "budget": 10,
    "occasion": 10,
    "source_confidence": 5,
    "discovery_balance": 5,
}

CATEGORY_BY_VARIETAL = {
    "Cabernet Sauvignon": "red",
    "Champagne Blend": "sparkling",
    "Pinot Noir": "red",
    "Sangiovese": "red",
    "Sauvignon Blanc": "white",
    "Tempranillo": "red",
}


@dataclass(frozen=True)
class NormalizedRecommendationCandidate:
    wine: dict
    category: str | None
    tannin: str | None
    pairing_tags: tuple[str, ...]
    flavor_tags: tuple[str, ...]
    occasion_tags: tuple[str, ...]

    @property
    def external_id(self):
        return self.wine["externalWineId"]


class RecommendationService:
    def __init__(
        self,
        wine_service=None,
        parser=None,
        personalization_service=None,
    ):
        self.wine_service = wine_service or WineService()
        self.parser = parser or RecommendationIntentParser()
        self.personalization_service = personalization_service or (
            RecommendationPersonalizationService(self.wine_service)
        )

    def recommend(self, query, limit, user_id=None):
        intent = self.parser.parse(query)
        candidates = [
            self._normalize_candidate(record)
            for record in self.wine_service.list_candidates()
        ]
        snapshot = (
            self.personalization_service.for_user(
                user_id,
                candidates=[candidate.wine for candidate in candidates],
            )
            if user_id is not None
            else self.personalization_service.anonymous_snapshot()
        )
        max_personal_affinity = self._max_personal_affinity(candidates, snapshot)
        scored = []

        if intent.has_request_constraints():
            for candidate in candidates:
                result = self._score_candidate(
                    candidate,
                    intent,
                    snapshot,
                    max_personal_affinity,
                )
                if result:
                    scored.append(result)

        if intent.budget:
            budget_compliant = [
                result
                for result in scored
                if self._result_dimension(result, "budget")["earnedPoints"] > 0
            ]
            if budget_compliant:
                scored = budget_compliant

        scored.sort(
            key=lambda result: (
                -result["match"]["score"],
                -result.pop("_coverage"),
                -result.pop("_positiveDimensions"),
                result["wine"]["externalWineId"],
            )
        )

        return {
            "query": query,
            "intent": intent.to_dict(),
            "personalization": snapshot.to_public_dict(),
            "catalog": self.wine_service.catalog_metadata(),
            "results": scored[:limit],
        }

    def _score_candidate(self, candidate, intent, snapshot, max_personal_affinity):
        dimensions = [
            self._pairing_dimension(candidate, intent),
            self._personal_dimension(
                candidate, snapshot, max_personal_affinity
            ),
            self._style_dimension(candidate, intent),
            self._budget_dimension(candidate, intent),
            self._occasion_dimension(candidate, intent),
            self._source_dimension(candidate),
            self._discovery_dimension(candidate, intent, snapshot),
        ]
        requested_names = {
            "pairing",
            "personal_taste",
            "requested_style",
            "budget",
            "occasion",
            "discovery_balance",
        }
        positive_dimensions = sum(
            1
            for dimension in dimensions
            if dimension["dimension"] in requested_names
            and dimension["earnedPoints"] > 0
        )
        primary_requested = any(
            (
                intent.pairings,
                intent.flavors,
                intent.categories,
                intent.varietals,
                intent.regions,
                intent.countries,
                intent.bodies,
                intent.acidities,
                intent.tannins,
                intent.sweetness,
                intent.excluded_sweetness,
                intent.occasions,
            )
        )
        primary_earned = sum(
            dimension["earnedPoints"]
            for dimension in dimensions
            if dimension["dimension"]
            in {"pairing", "requested_style", "occasion"}
        )

        if primary_requested and primary_earned <= 0:
            return None

        available_total = sum(
            dimension["availablePoints"] for dimension in dimensions
        )
        earned_total = sum(dimension["earnedPoints"] for dimension in dimensions)
        if available_total <= 0 or earned_total <= 0 or positive_dimensions <= 0:
            return None

        raw_score = earned_total / available_total * 100
        has_hard_mismatch = self._has_hard_constraint_mismatch(dimensions)
        has_requested_unavailable = self._has_requested_unavailable(
            intent, dimensions
        )
        source_dimension = next(
            dimension
            for dimension in dimensions
            if dimension["dimension"] == "source_confidence"
        )
        has_incomplete_source = (
            source_dimension["earnedPoints"] < source_dimension["weight"]
        )
        score_ceiling = (
            59 if has_hard_mismatch else 69 if has_requested_unavailable else 100
        )
        bounded_score = min(raw_score, score_ceiling)
        score = round(bounded_score)
        if score < 35:
            return None

        contribution_scale = bounded_score / raw_score if raw_score else 0
        for dimension in dimensions:
            dimension["normalizedContribution"] = round(
                dimension["earnedPoints"]
                / available_total
                * 100
                * contribution_scale,
                1,
            )

        confidence = self._confidence(
            score,
            available_total,
            positive_dimensions,
            has_hard_mismatch,
            has_requested_unavailable,
            has_incomplete_source,
        )
        reasons = self._reasons(dimensions)
        cautions = self._cautions(candidate, intent, dimensions)
        missing_data = [
            dimension["unavailableReason"]
            for dimension in dimensions
            if dimension["unavailableReason"]
            and "request did not" not in dimension["unavailableReason"].lower()
            and "personalization is" not in dimension["unavailableReason"].lower()
        ]
        matched_tags = self._matched_tags(dimensions)
        for dimension in dimensions:
            dimension.pop("_matchedValues", None)
        coverage = sum(
            1
            for dimension in dimensions
            for evidence in dimension["evidence"]
            if evidence.startswith("MATCH:")
        )

        return {
            "wine": deepcopy(candidate.wine),
            "match": {
                "score": score,
                "confidence": confidence,
                "scoreBasis": (
                    "personalized" if snapshot.is_active else "request_only"
                ),
                "reasons": reasons,
                "cautions": cautions,
                "matchedTags": matched_tags,
                "missingDataDisclosures": list(dict.fromkeys(missing_data)),
                "breakdown": dimensions,
            },
            "_coverage": coverage,
            "_positiveDimensions": positive_dimensions,
        }

    def _pairing_dimension(self, candidate, intent):
        weight = SCORING_WEIGHTS["pairing"]
        if not intent.pairings:
            return self._unavailable(
                "pairing", weight, "The request did not specify a recognized pairing."
            )
        if not candidate.pairing_tags:
            return self._unavailable(
                "pairing", weight, "This source record has no pairing tags."
            )
        matched = [
            pairing
            for pairing in intent.pairings
            if self._tag_matches(pairing, candidate.pairing_tags)
        ]
        earned = weight * len(matched) / len(intent.pairings)
        evidence = [f"MATCH: Catalog pairing matches {item}." for item in matched]
        unmatched = [item for item in intent.pairings if item not in matched]
        evidence.extend(
            f"NO MATCH: No sourced pairing tag matched {item}." for item in unmatched
        )
        return self._dimension(
            "pairing", earned, weight, evidence, matched_values=matched
        )

    def _style_dimension(self, candidate, intent):
        weight = SCORING_WEIGHTS["requested_style"]
        constraints = []
        self._add_constraint(
            constraints, "category", intent.categories, candidate.category
        )
        self._add_constraint(
            constraints, "varietal", intent.varietals, candidate.wine.get("varietal")
        )
        self._add_constraint(
            constraints, "region", intent.regions, candidate.wine.get("region")
        )
        self._add_constraint(
            constraints, "country", intent.countries, candidate.wine.get("country")
        )
        self._add_constraint(
            constraints,
            "body",
            intent.bodies,
            self._normalize_body(candidate.wine.get("body")),
        )
        self._add_constraint(
            constraints,
            "acidity",
            intent.acidities,
            self._normalize_acidity(candidate.wine.get("acidity")),
        )
        self._add_constraint(
            constraints, "tannin", intent.tannins, candidate.tannin
        )
        self._add_constraint(
            constraints,
            "sweetness",
            intent.sweetness,
            self._normalize_sweetness(candidate.wine.get("sweetness")),
        )
        if intent.flavors:
            flavor_matches = [
                flavor for flavor in intent.flavors if flavor in candidate.flavor_tags
            ]
            constraints.append(
                (
                    "flavor",
                    [value.lower() for value in intent.flavors],
                    ", ".join(candidate.flavor_tags) if candidate.flavor_tags else None,
                    bool(flavor_matches),
                )
            )
        if intent.excluded_sweetness:
            candidate_sweetness = self._normalize_sweetness(
                candidate.wine.get("sweetness")
            )
            constraints.append(
                (
                    "sweetness exclusion",
                    intent.excluded_sweetness,
                    candidate_sweetness,
                    bool(
                        candidate_sweetness
                        and candidate_sweetness not in intent.excluded_sweetness
                    ),
                )
            )

        if not constraints:
            return self._unavailable(
                "requested_style",
                weight,
                "The request did not specify a recognized wine style.",
            )

        available_constraints = [item for item in constraints if item[2] is not None]
        if not available_constraints:
            missing = ", ".join(item[0] for item in constraints)
            return self._unavailable(
                "requested_style",
                weight,
                f"This source record lacks requested style data: {missing}.",
            )

        available = weight * len(available_constraints) / len(constraints)
        matched = [item for item in available_constraints if item[3]]
        earned = weight * len(matched) / len(constraints)
        evidence = []
        for label, requested, value, is_match in constraints:
            if value is None:
                evidence.append(f"UNAVAILABLE: No sourced {label} value.")
            elif is_match:
                request_label = (
                    "not sweet"
                    if label == "sweetness exclusion"
                    else "/".join(requested)
                )
                evidence.append(
                    f"MATCH: {label.title()} {value} satisfies {request_label}."
                )
            else:
                evidence.append(
                    f"NO MATCH: Sourced {label} {value} does not match "
                    f"{'/'.join(requested)}."
                )
        unavailable_reason = None
        missing_count = len(constraints) - len(available_constraints)
        if missing_count:
            unavailable_reason = (
                f"{missing_count} of {len(constraints)} requested style signals "
                "lack source data and receive no credit."
            )
        matched_values = []
        for label, requested, value, is_match in matched:
            if label == "sweetness exclusion":
                matched_values.append("not sweet")
            elif label == "flavor":
                matched_values.extend(
                    item for item in requested if item in candidate.flavor_tags
                )
            elif value:
                matched_values.append(value)
        return self._dimension(
            "requested_style",
            earned,
            available,
            evidence,
            unavailable_reason,
            matched_values,
        )

    def _budget_dimension(self, candidate, intent):
        weight = SCORING_WEIGHTS["budget"]
        if not intent.budget:
            return self._unavailable(
                "budget", weight, "The request did not specify a recognized budget."
            )
        price = candidate.wine.get("priceCents")
        if price is None:
            return self._unavailable(
                "budget", weight, "This source record has no listed price."
            )
        minimum = intent.budget.minimum_cents
        maximum = intent.budget.maximum_cents
        within = (minimum is None or price >= minimum) and (
            maximum is None or price <= maximum
        )
        if within:
            evidence = [
                f"MATCH: Listed price {self._money(price)} is within the requested budget."
            ]
        else:
            evidence = [
                f"NO MATCH: Listed price {self._money(price)} is outside the requested budget."
            ]
        return self._dimension(
            "budget",
            weight if within else 0,
            weight,
            evidence,
            matched_values=["within budget"] if within else [],
        )

    def _occasion_dimension(self, candidate, intent):
        weight = SCORING_WEIGHTS["occasion"]
        if not intent.occasions:
            return self._unavailable(
                "occasion", weight, "The request did not specify a recognized occasion."
            )
        if not candidate.occasion_tags:
            return self._unavailable(
                "occasion", weight, "This source record has no occasion data."
            )
        matched = [item for item in intent.occasions if item in candidate.occasion_tags]
        earned = weight * len(matched) / len(intent.occasions)
        evidence = [f"MATCH: Occasion aligns with {item}." for item in matched]
        evidence.extend(
            f"NO MATCH: Sourced occasion does not match {item}."
            for item in intent.occasions
            if item not in matched
        )
        return self._dimension(
            "occasion", earned, weight, evidence, matched_values=matched
        )

    def _personal_dimension(self, candidate, snapshot, max_affinity):
        weight = SCORING_WEIGHTS["personal_taste"]
        if not snapshot.is_active:
            return self._unavailable(
                "personal_taste",
                weight,
                f"Personalization is {snapshot.status}; no taste credit is assigned.",
            )
        attributes = self._preference_attributes(candidate)
        matched = [
            attribute
            for attribute in attributes
            if snapshot.attribute_weights.get(attribute, 0) > 0
        ]
        opposed = [
            attribute
            for attribute in attributes
            if snapshot.attribute_weights.get(attribute, 0) < 0
        ]
        if max_affinity <= 0:
            if not opposed:
                return self._unavailable(
                    "personal_taste",
                    weight,
                    "Current aggregate signals do not establish a sourced fit "
                    "for this candidate.",
                )
            evidence = [
                "NO MATCH: Aggregate cellar activity weighs against "
                + ", ".join(self._public_attribute(item) for item in opposed[:3])
                + "."
            ]
            return self._dimension(
                "personal_taste",
                0,
                weight,
                evidence,
            )
        positive_affinity = sum(
            snapshot.attribute_weights.get(item, 0) for item in matched
        )
        negative_affinity = sum(
            abs(snapshot.attribute_weights.get(item, 0)) for item in opposed
        )
        earned = weight * min(
            1, max(0, positive_affinity - negative_affinity) / max_affinity
        )
        evidence = []
        if matched:
            evidence.append(
                "MATCH: Aggregate cellar activity supports "
                + ", ".join(self._public_attribute(item) for item in matched[:3])
                + "."
            )
        if opposed:
            evidence.append(
                "NO MATCH: Aggregate cellar activity weighs against "
                + ", ".join(self._public_attribute(item) for item in opposed[:3])
                + "."
            )
        if not evidence:
            evidence.append("NO MATCH: No positive aggregate cellar attribute aligns.")
        return self._dimension(
            "personal_taste",
            earned,
            weight,
            evidence,
            matched_values=[self._public_attribute(item) for item in matched[:3]],
        )

    def _source_dimension(self, candidate):
        weight = SCORING_WEIGHTS["source_confidence"]
        core_fields = [
            candidate.wine.get("externalWineId"),
            candidate.wine.get("name"),
            candidate.wine.get("source"),
            candidate.wine.get("imageUrl"),
            candidate.wine.get("varietal"),
            candidate.wine.get("region"),
            candidate.wine.get("country"),
            candidate.category,
            candidate.wine.get("description"),
            candidate.wine.get("priceCents"),
            candidate.wine.get("averageRating"),
            candidate.pairing_tags,
            candidate.flavor_tags,
            candidate.wine.get("body"),
            candidate.wine.get("acidity"),
            candidate.wine.get("sweetness"),
            candidate.occasion_tags,
        ]
        present = sum(value is not None and value != () and value != "" for value in core_fields)
        earned = weight * present / len(core_fields)
        unavailable_reason = None
        if present < len(core_fields):
            unavailable_reason = (
                f"{len(core_fields) - present} of {len(core_fields)} core source "
                "fields are missing; source-data confidence is reduced."
            )
        return self._dimension(
            "source_confidence",
            earned,
            weight,
            [f"MATCH: {present} of {len(core_fields)} core source fields are present."],
            unavailable_reason,
        )

    def _discovery_dimension(self, candidate, intent, snapshot):
        weight = SCORING_WEIGHTS["discovery_balance"]
        if not intent.novelty:
            return self._unavailable(
                "discovery_balance",
                weight,
                "The request did not specify familiar or adventurous intent.",
            )
        if not snapshot.is_active:
            return self._unavailable(
                "discovery_balance",
                weight,
                "Discovery balance needs an active owner-scoped preference snapshot.",
            )
        seen = candidate.external_id in snapshot.seen_wine_ids
        positive_attributes = any(
            snapshot.attribute_weights.get(attribute, 0) > 0
            for attribute in self._preference_attributes(candidate)
        )
        if intent.novelty == "familiar":
            earned = weight if seen else (weight * 0.6 if positive_attributes else 0)
            evidence = (
                "MATCH: The bottle is represented in current cellar signals."
                if seen
                else "MATCH: The bottle shares aggregate preferred attributes."
                if positive_attributes
                else "NO MATCH: The bottle is outside familiar aggregate signals."
            )
        else:
            if not seen and not positive_attributes:
                earned = weight
            elif not seen:
                earned = weight * 0.6
            else:
                earned = 0
            evidence = (
                "MATCH: The bottle expands beyond seen wines and preferred attributes."
                if earned == weight
                else "MATCH: The bottle is unseen but shares some preferred attributes."
                if earned > 0
                else "NO MATCH: The bottle is already represented in cellar signals."
            )
        return self._dimension(
            "discovery_balance",
            earned,
            weight,
            [evidence],
            matched_values=[intent.novelty] if earned > 0 else [],
        )

    def _normalize_candidate(self, wine):
        return NormalizedRecommendationCandidate(
            wine=wine,
            category=CATEGORY_BY_VARIETAL.get(wine.get("varietal")),
            tannin=None,
            pairing_tags=tuple(
                item.lower() for item in (wine.get("pairings") or [])
            ),
            flavor_tags=tuple(
                item.lower() for item in (wine.get("tastingNotes") or [])
            ),
            occasion_tags=self._occasion_tags(wine.get("occasion")),
        )

    def _max_personal_affinity(self, candidates, snapshot):
        if not snapshot.is_active:
            return 0
        return max(
            (
                sum(
                    max(0, snapshot.attribute_weights.get(attribute, 0))
                    for attribute in self._preference_attributes(candidate)
                )
                for candidate in candidates
            ),
            default=0,
        )

    @staticmethod
    def _preference_attributes(candidate):
        attributes = []
        for field_name in ("varietal", "region", "country", "body", "acidity", "sweetness"):
            value = candidate.wine.get(field_name)
            if value:
                attributes.append(f"{field_name}:{value.lower()}")
        for occasion in candidate.occasion_tags:
            attributes.append(f"occasion:{occasion}")
        return attributes

    @staticmethod
    def _add_constraint(constraints, label, requested, candidate_value):
        if not requested:
            return
        normalized_value = (
            candidate_value.lower() if isinstance(candidate_value, str) else None
        )
        normalized_requested = [value.lower() for value in requested]
        constraints.append(
            (
                label,
                normalized_requested,
                normalized_value,
                normalized_value in normalized_requested if normalized_value else False,
            )
        )

    @staticmethod
    def _normalize_body(value):
        if not value:
            return None
        return {"bold": "full"}.get(value.lower(), value.lower())

    @staticmethod
    def _normalize_acidity(value):
        if not value:
            return None
        return {
            "bright": "high",
            "crisp": "high",
            "lively": "high",
            "balanced": "medium",
        }.get(value.lower(), value.lower())

    @staticmethod
    def _normalize_sweetness(value):
        if not value:
            return None
        return {"brut": "dry"}.get(value.lower(), value.lower())

    @staticmethod
    def _occasion_tags(value):
        if not value:
            return ()
        normalized = value.lower()
        tags = []
        if "celebration" in normalized or "toast" in normalized:
            tags.append("celebration")
        if "gift" in normalized:
            tags.append("gift")
        if "lunch" in normalized or "afternoon" in normalized:
            tags.append("lunch")
        if "date night" in normalized:
            tags.append("date night")
        if "dinner" in normalized or "steakhouse" in normalized:
            tags.append("dinner")
        return tuple(tags)

    @staticmethod
    def _tag_matches(requested, candidate_tags):
        return any(
            requested == tag or requested in tag or tag in requested
            for tag in candidate_tags
        )

    @staticmethod
    def _dimension(
        name,
        earned,
        available,
        evidence,
        unavailable_reason=None,
        matched_values=None,
    ):
        return {
            "dimension": name,
            "weight": SCORING_WEIGHTS[name],
            "earnedPoints": round(earned, 2),
            "availablePoints": round(available, 2),
            "normalizedContribution": 0,
            "evidence": evidence,
            "unavailableReason": unavailable_reason,
            "_matchedValues": matched_values or [],
        }

    @classmethod
    def _unavailable(cls, name, weight, reason):
        return cls._dimension(name, 0, 0, [], reason)

    @staticmethod
    def _confidence(
        score,
        available_total,
        positive_dimensions,
        has_hard_mismatch,
        has_requested_unavailable,
        has_incomplete_source,
    ):
        if (
            has_hard_mismatch
            or has_requested_unavailable
            or has_incomplete_source
        ):
            return "limited"
        if score >= 75 and available_total >= 45 and positive_dimensions >= 2:
            return "high"
        if score >= 55 and available_total >= 15 and positive_dimensions >= 1:
            return "medium"
        return "limited"

    @staticmethod
    def _has_hard_constraint_mismatch(dimensions):
        return any(
            evidence.startswith("NO MATCH:")
            for dimension in dimensions
            if dimension["dimension"] in {"requested_style", "budget"}
            for evidence in dimension["evidence"]
        )

    @staticmethod
    def _has_requested_unavailable(intent, dimensions):
        requested = {
            "pairing": bool(intent.pairings),
            "requested_style": bool(
                intent.categories
                or intent.varietals
                or intent.regions
                or intent.countries
                or intent.bodies
                or intent.acidities
                or intent.tannins
                or intent.sweetness
                or intent.excluded_sweetness
                or intent.flavors
            ),
            "budget": intent.budget is not None,
            "occasion": bool(intent.occasions),
            "discovery_balance": intent.novelty is not None,
        }
        return any(
            requested.get(dimension["dimension"], False)
            and dimension["availablePoints"] < dimension["weight"]
            for dimension in dimensions
        )

    @staticmethod
    def _result_dimension(result, name):
        return next(
            dimension
            for dimension in result["match"]["breakdown"]
            if dimension["dimension"] == name
        )

    @staticmethod
    def _reasons(dimensions):
        preferred = [
            "pairing",
            "requested_style",
            "budget",
            "occasion",
            "personal_taste",
            "discovery_balance",
            "source_confidence",
        ]
        reasons = []
        for name in preferred:
            dimension = next(item for item in dimensions if item["dimension"] == name)
            matches = [
                item.removeprefix("MATCH: ")
                for item in dimension["evidence"]
                if item.startswith("MATCH:")
            ]
            if matches:
                reasons.append(matches[0])
            if len(reasons) == 3:
                break
        return reasons

    @staticmethod
    def _cautions(candidate, intent, dimensions):
        cautions = []
        for dimension in dimensions:
            cautions.extend(
                item.removeprefix("NO MATCH: ")
                for item in dimension["evidence"]
                if item.startswith("NO MATCH:")
            )
            if dimension["unavailableReason"] and (
                (
                    dimension["dimension"] == "requested_style"
                    and (
                        intent.categories
                        or intent.varietals
                        or intent.regions
                        or intent.countries
                        or intent.bodies
                        or intent.acidities
                        or intent.tannins
                        or intent.sweetness
                        or intent.excluded_sweetness
                        or intent.flavors
                    )
                )
                or (
                    dimension["dimension"] == "budget"
                    and intent.budget is not None
                )
            ):
                cautions.append(dimension["unavailableReason"])
        return list(dict.fromkeys(cautions))[:4]

    @staticmethod
    def _matched_tags(dimensions):
        return list(
            dict.fromkeys(
                value
                for dimension in dimensions
                for value in dimension.get("_matchedValues", [])
            )
        )

    @staticmethod
    def _public_attribute(attribute):
        field_name, value = attribute.split(":", 1)
        return f"{value} {field_name}" if field_name in {"body", "acidity"} else value

    @staticmethod
    def _money(cents):
        return f"${cents / 100:,.2f}".replace(".00", "")
