from copy import deepcopy

import pytest

from app.services.recommendation_service import (
    SCORING_WEIGHTS,
    RecommendationService,
)
from app.services.wine_service import MOCK_WINES, WineService


class FixtureWineService:
    source = "mock"

    def __init__(self, candidates):
        self.candidates = deepcopy(candidates)

    def list_candidates(self):
        return deepcopy(self.candidates)

    def catalog_metadata(self):
        return {
            "provider": self.source,
            "candidateCount": len(self.candidates),
            "isDemonstrationCatalog": True,
            "limitations": "Limited deterministic test catalog.",
        }


def _dimension(result, name):
    return next(
        item
        for item in result["match"]["breakdown"]
        if item["dimension"] == name
    )


def _result(response, external_wine_id):
    return next(
        item
        for item in response["results"]
        if item["wine"]["externalWineId"] == external_wine_id
    )


def _clone_candidate(index, external_wine_id, **changes):
    candidate = deepcopy(MOCK_WINES[index])
    candidate["externalWineId"] = external_wine_id
    candidate.update(changes)
    return candidate


def test_wine_service_candidate_iteration_is_isolated_and_preserves_contracts():
    service = WineService()
    candidates = service.list_candidates()
    candidates[0]["name"] = "Mutated test name"
    candidates[0]["pairings"].append("invented pairing")

    fresh = service.list_candidates()[0]

    assert fresh["name"] != "Mutated test name"
    assert "invented pairing" not in fresh["pairings"]
    assert service.search("oysters")["results"]
    assert service.get_by_external_id(fresh["externalWineId"]) is not None


def test_real_catalog_ranks_crisp_oyster_white_first_with_explainable_score():
    response = RecommendationService().recommend(
        "a crisp white for oysters",
        6,
    )

    first = response["results"][0]
    assert first["wine"]["externalWineId"] == (
        "mock-frogs-leap-estate-sauvignon-blanc-2022"
    )
    assert first["match"]["confidence"] == "high"
    assert first["match"]["scoreBasis"] == "request_only"
    assert 0 <= first["match"]["score"] <= 100
    assert _dimension(first, "pairing")["earnedPoints"] == 30
    assert _dimension(first, "requested_style")["earnedPoints"] == 15
    assert "oysters" in first["match"]["matchedTags"]


def test_in_budget_reds_rank_before_the_known_over_budget_cabernet():
    response = RecommendationService().recommend("a red under $60", 6)
    ids = [item["wine"]["externalWineId"] for item in response["results"]]
    cabernet_id = "mock-chateau-montelena-cabernet-sauvignon-2019"

    assert "mock-antinori-chianti-classico-riserva-2020" in ids
    assert cabernet_id not in ids
    assert all(
        _dimension(result, "budget")["earnedPoints"] == 10
        for result in response["results"]
    )


def test_missing_price_is_unavailable_and_never_receives_budget_credit():
    known = _clone_candidate(3, "known-price-red", priceCents=4500)
    missing = _clone_candidate(3, "missing-price-red", priceCents=None)
    service = RecommendationService(wine_service=FixtureWineService([missing]))

    response = service.recommend("a red under $60", 2)
    missing_result = _result(response, "missing-price-red")
    budget = _dimension(missing_result, "budget")

    assert budget["earnedPoints"] == 0
    assert budget["availablePoints"] == 0
    assert budget["normalizedContribution"] == 0
    assert "price" in budget["unavailableReason"].lower()
    assert any(
        "price" in disclosure.lower()
        for disclosure in missing_result["match"]["missingDataDisclosures"]
    )
    assert missing_result["match"]["confidence"] == "limited"

    mixed = RecommendationService(
        wine_service=FixtureWineService([missing, known])
    ).recommend("a red under $60", 2)
    assert [item["wine"]["externalWineId"] for item in mixed["results"]] == [
        "known-price-red"
    ]


def test_unrequested_budget_and_personalization_get_no_automatic_credit():
    first = RecommendationService().recommend("a red wine", 1)["results"][0]

    for dimension_name in ("budget", "personal_taste", "occasion"):
        dimension = _dimension(first, dimension_name)
        assert dimension["earnedPoints"] == 0
        assert dimension["availablePoints"] == 0
        assert dimension["normalizedContribution"] == 0


def test_missing_pairing_tags_are_unavailable_instead_of_invented():
    candidate = _clone_candidate(3, "red-without-pairings", pairings=[])
    service = RecommendationService(
        wine_service=FixtureWineService([candidate])
    )

    result = service.recommend("a red for steak", 1)["results"][0]
    pairing = _dimension(result, "pairing")

    assert pairing["earnedPoints"] == 0
    assert pairing["availablePoints"] == 0
    assert "no pairing tags" in pairing["unavailableReason"].lower()


def test_incomplete_provider_data_reduces_confidence_and_is_disclosed():
    candidate = _clone_candidate(
        1,
        "incomplete-sauvignon-blanc",
        averageRating=None,
        description=None,
        imageUrl=None,
        occasion=None,
        priceCents=None,
    )
    service = RecommendationService(
        wine_service=FixtureWineService([candidate])
    )

    result = service.recommend("a crisp white for oysters", 1)["results"][0]
    source = _dimension(result, "source_confidence")

    assert source["earnedPoints"] < source["availablePoints"]
    assert result["match"]["confidence"] == "limited"
    assert any(
        "core source fields are missing" in disclosure
        for disclosure in result["match"]["missingDataDisclosures"]
    )


def test_nullable_provider_collections_normalize_as_missing_source_data():
    candidate = _clone_candidate(
        3,
        "red-with-null-collections",
        pairings=None,
        tastingNotes=None,
    )
    service = RecommendationService(
        wine_service=FixtureWineService([candidate])
    )

    result = service.recommend("a red wine", 1)["results"][0]
    source = _dimension(result, "source_confidence")

    assert result["match"]["confidence"] == "limited"
    assert source["earnedPoints"] < source["availablePoints"]
    assert any(
        "core source fields are missing" in disclosure
        for disclosure in result["match"]["missingDataDisclosures"]
    )


def test_tannin_is_parsed_but_unavailable_for_the_current_catalog():
    result = RecommendationService().recommend("a structured red", 1)["results"][0]
    style = _dimension(result, "requested_style")

    assert style["availablePoints"] < SCORING_WEIGHTS["requested_style"]
    assert any(item.startswith("UNAVAILABLE:") for item in style["evidence"])
    assert "lack source data" in style["unavailableReason"].lower()
    assert result["match"]["confidence"] == "limited"
    assert result["match"]["score"] <= 69


def test_unavailable_novelty_cannot_present_a_perfect_anonymous_score():
    result = RecommendationService().recommend(
        "something new but not sweet",
        1,
    )["results"][0]

    assert result["match"]["score"] <= 69
    assert result["match"]["confidence"] == "limited"
    assert _dimension(result, "discovery_balance")["availablePoints"] == 0


def test_hard_mismatches_are_capped_when_no_compliant_candidate_exists():
    cabernet = _clone_candidate(5, "only-cabernet")
    result = RecommendationService(
        wine_service=FixtureWineService([cabernet])
    ).recommend("Cabernet Sauvignon under $60 for steak", 1)["results"][0]

    assert result["match"]["score"] <= 59
    assert result["match"]["confidence"] == "limited"
    assert any("outside" in caution.lower() for caution in result["match"]["cautions"])


def test_occasion_and_budget_are_evidence_backed_for_celebration():
    response = RecommendationService().recommend(
        "a celebration bottle under $100",
        6,
    )
    first = response["results"][0]

    assert first["wine"]["externalWineId"] == (
        "mock-veuve-clicquot-brut-champagne-nv"
    )
    assert _dimension(first, "occasion")["earnedPoints"] == 10
    assert _dimension(first, "budget")["earnedPoints"] == 10


def test_no_supported_or_satisfiable_intent_returns_honest_empty_results():
    service = RecommendationService()

    unknown = service.recommend("smoky unicorn nebula", 6)
    rose = service.recommend("a rosé", 6)

    assert unknown["results"] == []
    assert unknown["intent"]["unparsedTerms"] == [
        "smoky",
        "unicorn",
        "nebula",
    ]
    assert rose["results"] == []
    assert rose["catalog"]["candidateCount"] == 6
    assert rose["catalog"]["isDemonstrationCatalog"] is True


def test_ties_use_external_id_and_identical_requests_are_stable():
    later = _clone_candidate(3, "z-identical-red")
    earlier = _clone_candidate(3, "a-identical-red")
    service = RecommendationService(
        wine_service=FixtureWineService([later, earlier])
    )

    first = service.recommend("a red wine", 2)
    second = service.recommend("a red wine", 2)

    assert first == second
    assert [item["wine"]["externalWineId"] for item in first["results"]] == [
        "a-identical-red",
        "z-identical-red",
    ]


def test_breakdown_is_complete_and_normalized_contributions_explain_score():
    result = RecommendationService().recommend(
        "a crisp white for oysters under $60",
        1,
    )["results"][0]
    breakdown = result["match"]["breakdown"]

    assert [item["dimension"] for item in breakdown] == list(SCORING_WEIGHTS)
    assert all(item["weight"] == SCORING_WEIGHTS[item["dimension"]] for item in breakdown)
    assert all(item["earnedPoints"] <= item["availablePoints"] for item in breakdown)
    assert sum(item["normalizedContribution"] for item in breakdown) == pytest.approx(
        result["match"]["score"],
        abs=0.5,
    )


def test_budget_mismatch_reasons_and_cautions_only_reference_real_evidence():
    response = RecommendationService().recommend(
        "Cabernet Sauvignon under $60 for steak",
        6,
    )
    result = _result(
        response,
        "mock-chateau-montelena-cabernet-sauvignon-2019",
    )
    rendered = " ".join(
        result["match"]["reasons"] + result["match"]["cautions"]
    ).lower()

    assert "steak" in rendered
    assert "$95" in rendered
    assert "$60" not in rendered or "outside" in rendered
    assert result["match"]["confidence"] == "limited"
