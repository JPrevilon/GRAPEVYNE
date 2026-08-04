import pytest

from app.services.recommendation_parser import RecommendationIntentParser


@pytest.fixture
def parser():
    return RecommendationIntentParser()


@pytest.mark.parametrize(
    ("query", "expected"),
    (
        ("a red wine", ["red"]),
        ("a white wine", ["white"]),
        ("something sparkling", ["sparkling"]),
        ("a rosé", ["rosé"]),
        ("rose wine", ["rosé"]),
    ),
)
def test_parser_recognizes_each_supported_category(parser, query, expected):
    assert parser.parse(query).categories == expected


def test_parser_recognizes_only_explicit_catalog_identity_terms(parser):
    intent = parser.parse(
        "Cabernet Sauvignon from Calistoga in the United States"
    )

    assert intent.varietals == ["Cabernet Sauvignon"]
    assert intent.regions == ["Calistoga"]
    assert intent.countries == ["United States"]
    assert "Napa Valley" not in intent.regions


def test_parser_recognizes_body_acidity_tannin_and_catalog_flavors(parser):
    intent = parser.parse(
        "a full-bodied structured wine with high acidity blackberry and cedar"
    )

    assert intent.bodies == ["full"]
    assert intent.acidities == ["high"]
    assert intent.tannins == ["high"]
    assert intent.flavors == ["blackberry", "cedar"]


def test_medium_acidity_does_not_silently_become_medium_body(parser):
    intent = parser.parse("a wine with medium acidity")

    assert intent.acidities == ["medium"]
    assert intent.bodies == []


def test_not_sweet_is_an_exclusion_and_does_not_invent_dry_intent(parser):
    intent = parser.parse("something new but not sweet")

    assert intent.excluded_sweetness == ["sweet"]
    assert intent.sweetness == []
    assert intent.novelty == "adventurous"
    assert any(
        item.dimension == "excluded_sweetness" and item.value == "sweet"
        for item in intent.evidence
    )


@pytest.mark.parametrize(
    "query",
    ("not red", "not a red", "not a red wine", "not dry", "avoid sweet"),
)
def test_other_negated_controlled_terms_never_become_positive_constraints(
    parser,
    query,
):
    intent = parser.parse(query)

    assert intent.has_request_constraints() is False
    assert [warning.code for warning in intent.warnings] == [
        "unsupported_negation"
    ]


def test_parser_avoids_food_and_flavor_phrase_cross_talk(parser):
    rose = parser.parse("rose petal")
    hyphenated_rose = parser.parse("rose-petal")
    steak = parser.parse("medium rare steak")
    hyphenated_steak = parser.parse("medium-rare steak")
    medium_well_steak = parser.parse("medium well steak")

    assert rose.categories == []
    assert rose.flavors == ["rose petal"]
    assert hyphenated_rose.categories == []
    assert hyphenated_rose.flavors == ["rose petal"]
    assert steak.bodies == []
    assert steak.pairings == ["steak"]
    assert hyphenated_steak.bodies == []
    assert hyphenated_steak.pairings == ["steak"]
    assert medium_well_steak.bodies == []
    assert medium_well_steak.pairings == ["steak"]


@pytest.mark.parametrize(
    ("query", "minimum_cents", "maximum_cents"),
    (
        ("a red under $60", None, 6000),
        ("a gift above $40", 4000, None),
        ("a red no more than $60", None, 6000),
        ("a red not over $60", None, 6000),
        ("a gift no less than $40", 4000, None),
        ("a gift not under $40", 4000, None),
        ("a gift between $40 and $75", 4000, 7500),
        ("a gift from $40.50 to $75.25", 4050, 7525),
        ("a gift $40-$75", 4000, 7500),
    ),
)
def test_parser_supports_explicit_dollar_budget_grammar(
    parser,
    query,
    minimum_cents,
    maximum_cents,
):
    budget = parser.parse(query).budget

    assert budget is not None
    assert budget.minimum_cents == minimum_cents
    assert budget.maximum_cents == maximum_cents


def test_parser_does_not_mistake_a_vintage_range_for_a_budget(parser):
    intent = parser.parse("something from 2018-2021")

    assert intent.budget is None
    assert not any(item.dimension == "budget" for item in intent.evidence)


def test_reversed_budget_range_is_disclosed_and_does_not_score(parser):
    intent = parser.parse("a gift between $75 and $40")

    assert intent.budget is None
    assert [warning.code for warning in intent.warnings] == [
        "invalid_budget_range"
    ]


@pytest.mark.parametrize(
    "query",
    (
        "red under $60 and over $100",
        "red between $40 and $75 under $50",
    ),
)
def test_multiple_budget_clauses_are_disclosed_and_disabled(parser, query):
    intent = parser.parse(query)

    assert intent.budget is None
    assert any(warning.code == "conflicting_budget" for warning in intent.warnings)
    assert len([item for item in intent.evidence if item.dimension == "budget"]) == 2


def test_parser_recognizes_pairing_and_occasion_phrases(parser):
    intent = parser.parse("a celebration bottle for fried chicken and brie")

    assert intent.pairings == ["fried chicken", "brie"]
    assert intent.occasions == ["celebration"]


def test_unknown_terms_are_transparent_but_never_become_constraints(parser):
    intent = parser.parse("smoky unicorn nebula")

    assert intent.has_request_constraints() is False
    assert intent.unparsed_terms == ["smoky", "unicorn", "nebula"]
    assert [warning.code for warning in intent.warnings] == ["unparsed_terms"]


def test_conflicting_novelty_language_is_disclosed_and_disabled(parser):
    intent = parser.parse("a safe choice but also something adventurous")

    assert intent.novelty is None
    assert any(
        warning.code == "conflicting_novelty" for warning in intent.warnings
    )


def test_parser_output_is_stable_for_identical_input(parser):
    query = "  A CRISP white between $40 and $75 for oysters  "

    first = parser.parse(query).to_dict()
    second = parser.parse(query).to_dict()

    assert first == second
    assert first["categories"] == ["white"]
    assert first["acidities"] == ["high"]
    assert first["pairings"] == ["oysters"]
