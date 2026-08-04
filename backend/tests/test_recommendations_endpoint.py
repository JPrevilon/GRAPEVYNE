import json

import pytest

import app.routes.wines as wine_routes
from app.extensions import db
from app.models import CellarEntry, User, Wine
from app.services.wine_service import (
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)

from conftest import TEST_PASSWORD


CABERNET_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
PINOT_ID = "mock-argyle-reserve-pinot-noir-2021"
SAUVIGNON_ID = "mock-frogs-leap-estate-sauvignon-blanc-2022"


def _signup(client, name="Recommendation User", email="recommend@example.test"):
    response = client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": TEST_PASSWORD},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["user"]


def _save(client, external_wine_id, **signals):
    response = client.post(
        "/api/cellar",
        json={"externalWineId": external_wine_id, **signals},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["entry"]


def _assert_private_no_store(response):
    assert response.headers["Cache-Control"] == "private, no-store"
    vary = {item.strip().lower() for item in response.headers["Vary"].split(",")}
    assert "cookie" in vary


def _walk_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_keys(child)


def test_anonymous_recommendation_uses_success_envelope_and_full_contract(client):
    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a crisp white for oysters", "limit": "3"},
    )

    assert response.status_code == 200
    assert set(response.get_json()) == {"data"}
    data = response.get_json()["data"]
    assert data["query"] == "a crisp white for oysters"
    assert data["personalization"]["status"] == "anonymous"
    assert data["personalization"]["signalCount"] == 0
    assert data["catalog"] == {
        "provider": "mock",
        "candidateCount": 6,
        "isDemonstrationCatalog": True,
        "limitations": (
            "The current portfolio build uses a limited demonstration catalog. "
            "Matching logic is real, but the available candidate set is "
            "intentionally small."
        ),
    }
    assert 1 <= len(data["results"]) <= 3
    match = data["results"][0]["match"]
    assert set(match) == {
        "score",
        "confidence",
        "scoreBasis",
        "reasons",
        "cautions",
        "matchedTags",
        "missingDataDisclosures",
        "breakdown",
    }
    assert len(match["breakdown"]) == 7
    _assert_private_no_store(response)


@pytest.mark.parametrize(
    ("query_string", "code", "detail_key"),
    (
        ({}, "missing_query", None),
        ({"query": "   "}, "missing_query", None),
        ({"query": "a"}, "validation_error", "query"),
        ({"query": "q" * 301}, "validation_error", "query"),
        ({"query": "<script>alert(1)</script>"}, "validation_error", "query"),
        ({"query": "red\nwine"}, "validation_error", "query"),
        ({"query": "red", "limit": ""}, "validation_error", "limit"),
        ({"query": "red", "limit": "0"}, "validation_error", "limit"),
        ({"query": "red", "limit": "13"}, "validation_error", "limit"),
        ({"query": "red", "limit": "-1"}, "validation_error", "limit"),
        ({"query": "red", "limit": "1.5"}, "validation_error", "limit"),
        ({"query": "red", "limit": "１"}, "validation_error", "limit"),
        ({"query": "red", "limit": "0" * 4301}, "validation_error", "limit"),
        ({"query": "red\u007f"}, "validation_error", "query"),
        ({"query": "red\u202e"}, "validation_error", "query"),
    ),
)
def test_recommendation_query_and_limit_validation(
    client,
    error_assertion,
    query_string,
    code,
    detail_key,
):
    response = client.get(
        "/api/wines/recommendations",
        query_string=query_string,
    )

    error = error_assertion(response, 400, code)
    if detail_key:
        assert detail_key in error["details"]
    _assert_private_no_store(response)


@pytest.mark.parametrize(
    "query_string",
    (
        [("query", "red"), ("query", "white")],
        [("query", "red"), ("limit", "2"), ("limit", "3")],
        {"query": "red", "userId": "1"},
        {"query": "red", "user_id": "1"},
        {"query": "red", "ownerId": "1"},
    ),
)
def test_duplicate_unknown_and_identity_arguments_are_rejected(
    client,
    error_assertion,
    query_string,
):
    response = client.get(
        "/api/wines/recommendations",
        query_string=query_string,
    )

    error = error_assertion(response, 400, "validation_error")
    assert set(error["details"]) & {"duplicates", "parameters"}
    _assert_private_no_store(response)


def test_unknown_parameter_name_is_not_echoed(client):
    unsafe_parameter = "<script>alert(1)</script>"
    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "red", unsafe_parameter: "value"},
    )

    assert response.status_code == 400
    assert unsafe_parameter not in json.dumps(response.get_json())


def test_query_is_trimmed_and_limit_is_enforced(client):
    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "  a red wine  ", "limit": "1"},
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["query"] == "a red wine"
    assert len(data["results"]) == 1


def test_signed_in_insufficient_data_is_honest_and_leaks_no_private_fields(
    client,
):
    _signup(client)
    private_note = "PROMPT07 PRIVATE NOTE MUST NEVER LEAK"
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        status="buy_again",
        notes=private_note,
    )

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red for steak"},
    )
    body = response.get_json()
    rendered = json.dumps(body)

    assert response.status_code == 200
    assert body["data"]["personalization"]["status"] == "insufficient_data"
    assert body["data"]["personalization"]["signalCount"] == 3
    assert all(
        result["match"]["scoreBasis"] == "request_only"
        for result in body["data"]["results"]
    )
    assert private_note not in rendered
    assert not (
        {"notes", "entryId", "cellarEntryId", "userId", "user_id", "entry_id"}
        & set(_walk_keys(body))
    )


def test_active_personalization_uses_only_current_session_and_safe_aggregates(
    client,
):
    _signup(client)
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        notes="ANOTHER PRIVATE NOTE",
    )
    _save(client, PINOT_ID, status="buy_again")

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )
    data = response.get_json()["data"]
    rendered = json.dumps(data)

    assert response.status_code == 200
    assert data["personalization"]["status"] == "active"
    assert data["personalization"]["signalCount"] == 3
    assert all(
        result["match"]["scoreBasis"] == "personalized"
        for result in data["results"]
    )
    assert "ANOTHER PRIVATE NOTE" not in rendered
    assert not (
        {"notes", "entryId", "cellarEntryId", "userId", "user_id", "entry_id"}
        & set(_walk_keys(data))
    )


def test_negative_rating_signals_are_disclosed_as_aggregate_cautions(client):
    _signup(client)
    _save(client, CABERNET_ID, userRating=1)
    _save(client, PINOT_ID, userRating=1)
    _save(client, SAUVIGNON_ID, favorite=True)

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )
    data = response.get_json()["data"]

    assert data["personalization"]["status"] == "active"
    assert any(
        "aggregate cellar activity weighs against" in caution.lower()
        for result in data["results"]
        for caution in result["match"]["cautions"]
    )


def test_negative_only_active_signals_remain_in_the_score_denominator(client):
    _signup(client)
    _save(client, CABERNET_ID, userRating=1)
    _save(client, PINOT_ID, userRating=1)
    _save(client, SAUVIGNON_ID, userRating=1)

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )
    data = response.get_json()["data"]
    opposed_results = [
        result
        for result in data["results"]
        if any(
            "aggregate cellar activity weighs against" in caution.lower()
            for caution in result["match"]["cautions"]
        )
    ]

    assert data["personalization"]["status"] == "active"
    assert opposed_results
    assert all(result["match"]["score"] < 100 for result in opposed_results)
    assert all(
        _dimension["availablePoints"] == 25
        for result in opposed_results
        for _dimension in result["match"]["breakdown"]
        if _dimension["dimension"] == "personal_taste"
    )


def test_expected_user_header_cannot_activate_or_select_personalization(client):
    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
        headers={"X-Grapevyne-Expected-User-Id": "999999"},
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["personalization"]["status"] == "anonymous"


@pytest.mark.parametrize(
    ("exception", "status", "code"),
    (
        (WineServiceUnavailableError("injected outage"), 503, "wine_service_unavailable"),
        (WineServiceTimeoutError("injected timeout"), 504, "wine_service_timeout"),
    ),
)
def test_provider_failures_never_return_false_success(
    client,
    monkeypatch,
    error_assertion,
    exception,
    status,
    code,
):
    def fail():
        raise exception

    monkeypatch.setattr(
        wine_routes.recommendation_service.wine_service,
        "list_candidates",
        fail,
    )

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )

    error_assertion(response, status, code)
    _assert_private_no_store(response)


def test_unexpected_engine_failure_uses_generic_500_envelope(
    client,
    monkeypatch,
    error_assertion,
):
    def fail():
        raise RuntimeError("private internal detail")

    monkeypatch.setattr(
        wine_routes.recommendation_service.wine_service,
        "list_candidates",
        fail,
    )

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )

    error = error_assertion(response, 500, "internal_server_error")
    assert "private internal detail" not in json.dumps(error)
    _assert_private_no_store(response)


def test_empty_match_is_200_with_limited_catalog_disclosure(client):
    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a rosé"},
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["results"] == []
    assert data["catalog"]["candidateCount"] == 6
    assert "limited demonstration catalog" in data["catalog"]["limitations"]


def test_recommendation_get_does_not_mutate_database(app, client):
    _signup(client)
    _save(client, CABERNET_ID, userRating=5, favorite=True)
    _save(client, PINOT_ID, status="buy_again")

    with app.app_context():
        before = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )

    response = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
    )

    with app.app_context():
        after = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )

    assert response.status_code == 200
    assert after == before


def test_recommendation_get_preserves_exact_origin_cors_behavior(client):
    trusted = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
        headers={"Origin": "http://127.0.0.1:5173"},
    )
    untrusted = client.get(
        "/api/wines/recommendations",
        query_string={"query": "a red wine"},
        headers={"Origin": "https://attacker.example.test"},
    )

    assert trusted.status_code == untrusted.status_code == 200
    assert trusted.headers["Access-Control-Allow-Origin"] == (
        "http://127.0.0.1:5173"
    )
    assert trusted.headers["Access-Control-Allow-Credentials"] == "true"
    assert "Access-Control-Allow-Origin" not in untrusted.headers
    _assert_private_no_store(trusted)
    _assert_private_no_store(untrusted)
