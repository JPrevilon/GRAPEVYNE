import json
from time import perf_counter
from types import SimpleNamespace

import pytest
from sqlalchemy import event

import app.routes.profile as profile_routes
from app.extensions import db
from app.models import CellarEntry, User, Wine
from app.services.taste_profile_service import (
    FAVORITE_WEIGHT,
    MAX_ABSOLUTE_WINE_STRENGTH,
    MAX_SIGNALS_PER_CANONICAL_WINE,
    RATING_WEIGHTS,
    WOULD_BUY_AGAIN_WEIGHT,
    TasteProfileService,
)
from app.services.wine_service import (
    MOCK_WINES,
    WineService,
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)

from conftest import TEST_PASSWORD


CABERNET_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
PINOT_ID = "mock-argyle-reserve-pinot-noir-2021"
SAUVIGNON_ID = "mock-frogs-leap-estate-sauvignon-blanc-2022"
CHIANTI_ID = "mock-antinori-chianti-classico-riserva-2020"


def _signup(client, name, email):
    response = client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": TEST_PASSWORD},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["user"]


def _save(client, external_wine_id, **fields):
    response = client.post(
        "/api/cellar",
        json={"externalWineId": external_wine_id, **fields},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["entry"]


def _profile(client):
    response = client.get("/api/profile/taste")
    assert response.status_code == 200
    return response.get_json()["data"]["profile"], response


def _row(**overrides):
    values = {
        "user_rating": None,
        "favorite": False,
        "status": "saved",
        "occasion": None,
        "tags": [],
        "pairing": None,
        "would_buy_again": None,
        "source": "mock",
        "external_api_id": CABERNET_ID,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class _StaticSignalService:
    def __init__(self, rows):
        self.rows = rows

    def profile_rows_for_user(self, _user_id):
        return list(self.rows)


class _StaticWineService:
    source = "mock"

    def __init__(self, candidates):
        self.candidates = candidates

    def list_candidates(self):
        return list(self.candidates)

    def catalog_metadata(self):
        return {
            "provider": self.source,
            "candidateCount": len(self.candidates),
            "isDemonstrationCatalog": True,
            "limitations": "Test catalog.",
        }


@pytest.fixture(scope="module")
def deterministic_large_profile_rows():
    manual_rows = [
        _row(
            source="manual",
            external_api_id=f"manual-performance-{index:04d}",
            user_rating=5,
            favorite=True,
            tags=["PRIVATE PERFORMANCE TAG"],
        )
        for index in range(2_500)
    ]
    catalog_rows = [
        _row(
            external_api_id=candidate["externalWineId"],
            user_rating=5,
            favorite=True,
            would_buy_again=index % 2 == 0,
        )
        for index, candidate in enumerate(MOCK_WINES)
    ]
    return manual_rows + catalog_rows


def test_profile_requires_authentication_and_private_cache_headers(
    client,
    error_assertion,
):
    response = client.get("/api/profile/taste")

    error_assertion(response, 401, "authentication_required")
    assert response.headers["Cache-Control"] == "private, no-store"
    assert "cookie" in {
        value.strip().lower() for value in response.headers["Vary"].split(",")
    }


@pytest.mark.parametrize("query", ("userId=1", "expectedUserId=1", "extra=true"))
def test_profile_rejects_every_query_parameter(
    client,
    login_user,
    error_assertion,
    query,
):
    login_user(client)

    response = client.get(f"/api/profile/taste?{query}")

    error = error_assertion(response, 400, "validation_error")
    assert set(error["details"]) == {"parameters"}
    assert response.headers["Cache-Control"] == "private, no-store"


def test_empty_profile_contract_is_stable_and_contains_no_suggestion(
    client,
    login_user,
):
    login_user(client)

    profile, response = _profile(client)

    assert set(profile) == {
        "state",
        "algorithmVersion",
        "summary",
        "evidence",
        "signals",
        "lowerAffinitySignals",
        "observedPriceRange",
        "adjacentSuggestion",
        "catalog",
        "disclosure",
    }
    assert profile["state"] == "empty"
    assert profile["algorithmVersion"] == "taste-atlas-v1"
    assert profile["evidence"] == {
        "totalCellarEntries": 0,
        "meaningfulEntries": 0,
        "distinctCanonicalWines": 0,
        "signalCount": 0,
    }
    assert profile["signals"] == []
    assert profile["lowerAffinitySignals"] == []
    assert profile["observedPriceRange"] is None
    assert profile["adjacentSuggestion"] is None
    assert response.headers["Cache-Control"] == "private, no-store"
    assert "cookie" in response.headers["Vary"].lower()


def test_wishlist_only_record_does_not_become_tasted_preference(
    client,
    login_user,
):
    login_user(client)
    _save(
        client,
        CABERNET_ID,
        status="wishlist",
        tags=["steak"],
        occasion="dinner",
        pairing="steak",
    )

    profile, _ = _profile(client)

    assert profile["state"] == "empty"
    assert profile["evidence"] == {
        "totalCellarEntries": 1,
        "meaningfulEntries": 0,
        "distinctCanonicalWines": 1,
        "signalCount": 0,
    }
    assert profile["signals"] == []


def test_one_meaningful_bottle_produces_limited_profile(
    client,
    login_user,
):
    login_user(client)
    _save(client, CABERNET_ID, userRating=5, favorite=True)

    profile, _ = _profile(client)

    assert profile["state"] == "limited"
    assert profile["evidence"]["meaningfulEntries"] == 1
    assert profile["evidence"]["signalCount"] == 2
    assert {signal["dimension"] for signal in profile["signals"]} >= {
        "category",
        "varietal",
        "place",
        "flavor",
        "structure",
    }
    assert profile["adjacentSuggestion"] is None


def test_three_diverse_meaningful_bottles_produce_active_deterministic_profile(
    client,
    login_user,
):
    login_user(client)
    for external_id in (CABERNET_ID, PINOT_ID, SAUVIGNON_ID):
        _save(client, external_id, userRating=5, favorite=True)

    first, _ = _profile(client)
    second, _ = _profile(client)

    assert first == second
    assert first["state"] == "active"
    assert first["evidence"]["meaningfulEntries"] == 3
    assert first["evidence"]["distinctCanonicalWines"] == 3
    assert first["evidence"]["signalCount"] == 6
    assert first["observedPriceRange"] == {
        "minimumCents": 3000,
        "maximumCents": 9500,
        "sampleSize": 3,
    }
    ordering = [signal["dimension"] for signal in first["signals"]]
    assert ordering == sorted(
        ordering,
        key=("category", "varietal", "place", "flavor", "structure", "occasion").index,
    )
    assert "occasion" not in ordering


def test_only_an_explicit_controlled_user_occasion_creates_occasion_signal(
    client,
    login_user,
):
    login_user(client)
    _save(client, CABERNET_ID, userRating=5, occasion="date night")

    profile, _ = _profile(client)

    occasion_signals = [
        signal for signal in profile["signals"] if signal["dimension"] == "occasion"
    ]
    assert [signal["label"] for signal in occasion_signals] == ["Date Night"]


def test_documented_rating_favorite_and_buy_again_weights_are_applied_exactly():
    service = TasteProfileService()
    vocabulary = service._controlled_vocabulary(MOCK_WINES)

    low_strength, low_count = service._row_strength(
        _row(user_rating=1),
        vocabulary,
    )
    high_strength, high_count = service._row_strength(
        _row(user_rating=5),
        vocabulary,
    )
    favorite_strength, favorite_count = service._row_strength(
        _row(favorite=True),
        vocabulary,
    )
    yes_strength, yes_count = service._row_strength(
        _row(would_buy_again=True),
        vocabulary,
    )
    no_strength, no_count = service._row_strength(
        _row(would_buy_again=False),
        vocabulary,
    )

    assert (low_strength, low_count) == (RATING_WEIGHTS[1], 1)
    assert (high_strength, high_count) == (RATING_WEIGHTS[5], 1)
    assert (favorite_strength, favorite_count) == (FAVORITE_WEIGHT, 1)
    assert (yes_strength, yes_count) == (WOULD_BUY_AGAIN_WEIGHT, 1)
    assert (no_strength, no_count) == (-WOULD_BUY_AGAIN_WEIGHT, 1)
    assert high_strength > low_strength
    assert yes_strength > no_strength


def test_negative_signals_require_support_from_multiple_wines():
    rows = [
        _row(user_rating=1, external_api_id=CABERNET_ID),
        _row(user_rating=1, external_api_id=PINOT_ID),
    ]
    profile = TasteProfileService(
        signal_service=_StaticSignalService(rows)
    ).for_user(1)

    assert profile["state"] == "limited"
    assert profile["signals"] == []
    assert profile["lowerAffinitySignals"]
    assert all(
        signal["evidenceCount"] >= 2
        and "emerging pattern, not an absolute" in signal["summary"]
        for signal in profile["lowerAffinitySignals"]
    )


def test_duplicate_canonical_rows_have_bounded_strength_and_signal_count():
    rows = [
        _row(user_rating=5, favorite=True, would_buy_again=True)
        for _ in range(100)
    ]
    service = TasteProfileService(signal_service=_StaticSignalService(rows))
    candidates_by_id = {
        candidate["externalWineId"]: candidate for candidate in MOCK_WINES
    }

    evidence = service._canonical_evidence(rows, candidates_by_id)[CABERNET_ID]

    assert evidence.signal_count == MAX_SIGNALS_PER_CANONICAL_WINE
    assert evidence.strength == MAX_ABSOLUTE_WINE_STRENGTH


def test_large_deterministic_profile_fixture_is_linear_and_bounded(
    deterministic_large_profile_rows,
):
    service = TasteProfileService(
        signal_service=_StaticSignalService(deterministic_large_profile_rows)
    )

    started = perf_counter()
    first = service.for_user(1)
    second = service.for_user(1)
    elapsed_seconds = perf_counter() - started

    assert first == second
    assert first["state"] == "active"
    assert first["evidence"]["totalCellarEntries"] == 2_506
    assert first["evidence"]["distinctCanonicalWines"] == 6
    assert first["evidence"]["meaningfulEntries"] == 6
    assert first["evidence"]["signalCount"] <= (
        6 * MAX_SIGNALS_PER_CANONICAL_WINE
    )
    assert elapsed_seconds < 2.0


def test_larger_profile_stress_fixture_remains_deterministic_and_output_bounded(
    deterministic_large_profile_rows,
):
    manual_rows = deterministic_large_profile_rows[:-len(MOCK_WINES)] * 4
    catalog_rows = deterministic_large_profile_rows[-len(MOCK_WINES):]
    rows = manual_rows + catalog_rows
    service = TasteProfileService(signal_service=_StaticSignalService(rows))

    first = service.for_user(1)
    second = service.for_user(1)

    assert first == second
    assert first["state"] == "active"
    assert first["evidence"]["totalCellarEntries"] == 10_006
    assert first["evidence"]["distinctCanonicalWines"] == len(MOCK_WINES)
    assert first["evidence"]["signalCount"] <= (
        len(MOCK_WINES) * MAX_SIGNALS_PER_CANONICAL_WINE
    )
    assert len(first["signals"]) <= 12
    assert len(first["lowerAffinitySignals"]) <= 12
    assert len(json.dumps(first)) < 16_384
    assert "PRIVATE PERFORMANCE TAG" not in json.dumps(first)


def test_missing_catalog_attributes_create_no_invented_scores_or_suggestion():
    candidate = {
        "externalWineId": "mock-missing-attributes",
        "source": "mock",
        "name": "Sparse Wine",
    }
    rows = [
        _row(
            user_rating=5,
            favorite=True,
            external_api_id="mock-missing-attributes",
        )
    ]
    service = TasteProfileService(
        wine_service=_StaticWineService([candidate]),
        signal_service=_StaticSignalService(rows),
    )

    profile = service.for_user(1)

    assert profile["state"] == "limited"
    assert profile["signals"] == []
    assert profile["lowerAffinitySignals"] == []
    assert profile["adjacentSuggestion"] is None


def test_active_adjacent_suggestion_is_an_unseen_real_catalog_record(
    client,
    login_user,
):
    login_user(client)
    seen = {CABERNET_ID, PINOT_ID, SAUVIGNON_ID}
    for external_id in seen:
        _save(client, external_id, userRating=5, favorite=True)

    profile, _ = _profile(client)
    suggestion = profile["adjacentSuggestion"]

    assert suggestion is not None
    assert suggestion["confidence"] == "limited"
    assert suggestion["reasons"]
    assert suggestion["wine"]["externalWineId"] not in seen
    assert suggestion["wine"] in WineService().list_candidates()


def test_adjacent_suggestion_is_absent_when_catalog_has_no_unseen_supported_record():
    candidates = [wine for wine in MOCK_WINES if wine["externalWineId"] in {
        CABERNET_ID,
        PINOT_ID,
        SAUVIGNON_ID,
    }]
    rows = []
    for candidate in candidates:
        rows.append(
            _row(
                user_rating=5,
                favorite=True,
                external_api_id=candidate["externalWineId"],
            )
        )
    service = TasteProfileService(
        wine_service=_StaticWineService(candidates),
        signal_service=_StaticSignalService(rows),
    )

    profile = service.for_user(1)

    assert profile["state"] == "active"
    assert profile["adjacentSuggestion"] is None


def test_deleting_entry_removes_profile_influence(client, login_user):
    login_user(client)
    entries = [
        _save(client, external_id, userRating=5, favorite=True)
        for external_id in (CABERNET_ID, PINOT_ID, SAUVIGNON_ID)
    ]
    before, _ = _profile(client)

    deleted = client.delete(f"/api/cellar/{entries[-1]['id']}")
    assert deleted.status_code == 200
    after, _ = _profile(client)

    assert before["state"] == "active"
    assert after["state"] == "limited"
    assert after["evidence"]["totalCellarEntries"] == 2
    assert after["evidence"]["signalCount"] == 4
    assert after != before


def test_profile_never_returns_freeform_memory_or_internal_identity_fields(
    client,
    login_user,
):
    login_user(client)
    secrets = {
        "notes": "PRIVATE-NOTE-7A21",
        "memoryTitle": "PRIVATE-TITLE-7A21",
        "location": "PRIVATE-LOCATION-7A21",
        "openedWith": "PRIVATE-COMPANY-7A21",
        "pairing": "PRIVATE-PAIRING-7A21",
    }
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        tags=["PRIVATE-TAG-7A21"],
        **secrets,
    )

    profile, _ = _profile(client)
    serialized = json.dumps(profile)

    assert "cellarEntryId" not in serialized
    assert "wineId" not in serialized
    assert "userId" not in serialized
    for secret in (*secrets.values(), "PRIVATE-TAG-7A21"):
        assert secret not in serialized


def test_profile_projection_is_one_owner_scoped_query_without_freeform_fields(
    app,
    client,
    login_user,
):
    user = login_user(client)
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        notes="NEVER SELECT NOTE",
        memoryTitle="NEVER SELECT TITLE",
        location="NEVER SELECT LOCATION",
        openedWith="NEVER SELECT COMPANY",
    )
    statements = []

    def capture_statement(
        _connection,
        _cursor,
        statement,
        _parameters,
        _context,
        _executemany,
    ):
        if "cellar_entries" in statement.lower():
            statements.append(" ".join(statement.lower().split()))

    with app.app_context():
        engine = db.engine
        event.listen(engine, "before_cursor_execute", capture_statement)
        try:
            TasteProfileService().for_user(user["id"])
        finally:
            event.remove(engine, "before_cursor_execute", capture_statement)

    assert len(statements) == 1
    statement = statements[0]
    projection = statement.split(" from ", 1)[0]
    assert "where cellar_entries.user_id" in statement
    assert "cellar_entries.notes" not in projection
    assert "cellar_entries.memory_title" not in projection
    assert "cellar_entries.location" not in projection
    assert "cellar_entries.opened_with" not in projection
    assert "cellar_entries.id" not in projection
    assert "cellar_entries.user_id" not in projection


def test_profile_endpoint_performs_auth_plus_one_narrow_owner_query(
    app,
    client,
    login_user,
):
    login_user(client)
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        notes="DO NOT EAGER LOAD THIS NOTE",
        memoryTitle="DO NOT EAGER LOAD THIS TITLE",
    )
    statements = []

    def capture_statement(
        _connection,
        _cursor,
        statement,
        _parameters,
        _context,
        _executemany,
    ):
        statements.append(" ".join(statement.lower().split()))

    with app.app_context():
        engine = db.engine
        event.listen(engine, "before_cursor_execute", capture_statement)
        try:
            response = client.get("/api/profile/taste")
        finally:
            event.remove(engine, "before_cursor_execute", capture_statement)

    assert response.status_code == 200
    assert len(statements) == 2
    assert " from users " in statements[0]
    profile_statements = [
        statement for statement in statements if "cellar_entries" in statement
    ]
    assert len(profile_statements) == 1
    projection = profile_statements[0].split(" from ", 1)[0]
    assert "cellar_entries.user_rating" in projection
    assert "cellar_entries.notes" not in projection
    assert "cellar_entries.memory_title" not in projection
    assert "cellar_entries.location" not in projection
    assert "cellar_entries.opened_with" not in projection


def test_profile_get_is_read_only(app, client, login_user):
    login_user(client)
    _save(client, CABERNET_ID, userRating=5)

    with app.app_context():
        before = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )
    _profile(client)
    with app.app_context():
        after = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )

    assert after == before


def test_two_users_are_isolated_and_do_not_change_each_others_profile(app):
    client_a = app.test_client()
    client_b = app.test_client()
    _signup(client_a, "Atlas A", "atlas-a@example.test")
    _signup(client_b, "Atlas B", "atlas-b@example.test")
    for external_id in (CABERNET_ID, PINOT_ID, SAUVIGNON_ID):
        _save(client_a, external_id, userRating=5, favorite=True)

    profile_a_before, _ = _profile(client_a)
    profile_b_before, _ = _profile(client_b)
    _save(client_b, CHIANTI_ID, userRating=1, wouldBuyAgain=False)
    profile_b_after, _ = _profile(client_b)
    profile_a_after, _ = _profile(client_a)

    assert profile_a_before == profile_a_after
    assert profile_a_after["state"] == "active"
    assert profile_b_before["state"] == "empty"
    assert profile_b_after["state"] == "limited"
    assert profile_b_after["signals"] == []
    assert profile_b_after["evidence"]["totalCellarEntries"] == 1


@pytest.mark.parametrize(
    ("exception", "status", "code"),
    (
        (WineServiceUnavailableError("offline"), 503, "wine_service_unavailable"),
        (WineServiceTimeoutError("slow"), 504, "wine_service_timeout"),
    ),
)
def test_profile_maps_provider_failures_without_losing_private_cache_headers(
    client,
    login_user,
    monkeypatch,
    error_assertion,
    exception,
    status,
    code,
):
    login_user(client)

    def fail(_user_id):
        raise exception

    monkeypatch.setattr(profile_routes.taste_profile_service, "for_user", fail)
    response = client.get("/api/profile/taste")

    error_assertion(response, status, code)
    assert response.headers["Cache-Control"] == "private, no-store"
    assert "cookie" in response.headers["Vary"].lower()
