import json
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import event

from app.extensions import db
from app.models import CellarEntry, Wine


CABERNET_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
PINOT_ID = "mock-argyle-reserve-pinot-noir-2021"
SAUVIGNON_ID = "mock-frogs-leap-estate-sauvignon-blanc-2022"


@contextmanager
def _captured_statements(app):
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
            yield statements
        finally:
            event.remove(engine, "before_cursor_execute", capture_statement)


def _seed_manual_entries(app, user_id, count, prefix, private_marker):
    saved_at = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)

    with app.app_context():
        wines = [
            Wine(
                source=f"manual:user:{user_id}",
                external_api_id=f"{prefix}-{index:05d}",
                name=f"Manual quality fixture {index:05d}",
                varietal="Private fixture varietal",
                region="Private fixture region",
            )
            for index in range(count)
        ]
        db.session.add_all(wines)
        db.session.flush()
        db.session.add_all(
            CellarEntry(
                user_id=user_id,
                wine_id=wine.id,
                user_rating=5,
                favorite=True,
                notes=f"{private_marker}-{index:05d}",
                tags=[private_marker],
                occasion="private fixture occasion",
                status="tasted",
                memory_title=f"{private_marker}-title-{index:05d}",
                pairing=f"{private_marker}-pairing",
                location=f"{private_marker}-location",
                opened_with=f"{private_marker}-company",
                would_buy_again=True,
                saved_at=saved_at,
            )
            for index, wine in enumerate(wines)
        )
        db.session.commit()


def _save_catalog_entry(client, external_wine_id, **fields):
    response = client.post(
        "/api/cellar",
        json={"externalWineId": external_wine_id, **fields},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["entry"]


def _assert_auth_plus_one_owner_query(statements):
    assert len(statements) == 2
    assert sum(" from users " in statement for statement in statements) == 1
    owner_statements = [
        statement for statement in statements if "cellar_entries" in statement
    ]
    assert len(owner_statements) == 1
    assert "where cellar_entries.user_id" in owner_statements[0]
    return owner_statements[0]


def test_large_cellar_list_has_constant_queries_and_stable_tie_order(
    app,
    client,
    login_user,
    user_factory,
):
    user = login_user(client, email="cellar-budget@example.test")
    other_user_id = user_factory(email="cellar-budget-other@example.test")
    _seed_manual_entries(
        app,
        user["id"],
        180,
        "cellar-budget-owner",
        "PRIVATE-CELLAR-BUDGET",
    )
    _seed_manual_entries(
        app,
        other_user_id,
        25,
        "cellar-budget-other",
        "OTHER-OWNER-PRIVATE",
    )

    with _captured_statements(app) as first_statements:
        first = client.get("/api/cellar")
    with _captured_statements(app) as second_statements:
        second = client.get("/api/cellar")

    assert first.status_code == second.status_code == 200
    assert first.get_json() == second.get_json()
    entries = first.get_json()["data"]["entries"]
    assert first.get_json()["data"]["count"] == len(entries) == 180
    assert [entry["id"] for entry in entries] == sorted(
        (entry["id"] for entry in entries),
        reverse=True,
    )
    assert {entry["userId"] for entry in entries} == {user["id"]}
    assert all(entry["wine"] is not None for entry in entries)

    first_owner_query = _assert_auth_plus_one_owner_query(first_statements)
    second_owner_query = _assert_auth_plus_one_owner_query(second_statements)
    assert " join wines " in first_owner_query
    assert first_owner_query == second_owner_query


def test_large_owner_recommendations_are_deterministic_private_and_two_queries(
    app,
    client,
    login_user,
):
    user = login_user(client, email="recommendation-budget@example.test")
    _save_catalog_entry(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        notes="PRIVATE-CANONICAL-RECOMMENDATION-NOTE",
    )
    _save_catalog_entry(client, PINOT_ID, status="buy_again")
    _seed_manual_entries(
        app,
        user["id"],
        400,
        "recommendation-budget-manual",
        "PRIVATE-RECOMMENDATION-LARGE-FIXTURE",
    )

    request_path = "/api/wines/recommendations?query=a+red+wine&limit=6"
    with _captured_statements(app) as first_statements:
        first = client.get(request_path)
    with _captured_statements(app) as second_statements:
        second = client.get(request_path)

    assert first.status_code == second.status_code == 200
    assert first.get_json() == second.get_json()
    data = first.get_json()["data"]
    assert data["personalization"]["status"] == "active"
    assert len(data["results"]) <= 6
    assert len(first.data) < 32_768
    rendered = json.dumps(data)
    assert "PRIVATE-CANONICAL-RECOMMENDATION-NOTE" not in rendered
    assert "PRIVATE-RECOMMENDATION-LARGE-FIXTURE" not in rendered

    first_owner_query = _assert_auth_plus_one_owner_query(first_statements)
    second_owner_query = _assert_auth_plus_one_owner_query(second_statements)
    projection = first_owner_query.split(" from ", 1)[0]
    for private_column in (
        "cellar_entries.id",
        "cellar_entries.user_id",
        "cellar_entries.notes",
        "cellar_entries.tags",
        "cellar_entries.memory_title",
        "cellar_entries.location",
        "cellar_entries.pairing",
        "cellar_entries.opened_with",
        "cellar_entries.would_buy_again",
    ):
        assert private_column not in projection
    assert "wines.source" in first_owner_query
    assert first_owner_query == second_owner_query


def test_large_owner_profile_is_deterministic_bounded_private_and_two_queries(
    app,
    client,
    login_user,
):
    user = login_user(client, email="profile-budget@example.test")
    for external_wine_id in (CABERNET_ID, PINOT_ID, SAUVIGNON_ID):
        _save_catalog_entry(
            client,
            external_wine_id,
            userRating=5,
            favorite=True,
            notes=f"PRIVATE-PROFILE-CANONICAL-{external_wine_id}",
        )
    _seed_manual_entries(
        app,
        user["id"],
        750,
        "profile-budget-manual",
        "PRIVATE-PROFILE-LARGE-FIXTURE",
    )

    with _captured_statements(app) as first_statements:
        first = client.get("/api/profile/taste")
    with _captured_statements(app) as second_statements:
        second = client.get("/api/profile/taste")

    assert first.status_code == second.status_code == 200
    assert first.get_json() == second.get_json()
    profile = first.get_json()["data"]["profile"]
    assert profile["state"] == "active"
    assert profile["evidence"]["totalCellarEntries"] == 753
    assert profile["evidence"]["meaningfulEntries"] == 3
    assert profile["evidence"]["distinctCanonicalWines"] == 3
    assert len(profile["signals"]) <= 12
    assert len(first.data) < 16_384
    rendered = json.dumps(profile)
    assert "PRIVATE-PROFILE-CANONICAL" not in rendered
    assert "PRIVATE-PROFILE-LARGE-FIXTURE" not in rendered

    first_owner_query = _assert_auth_plus_one_owner_query(first_statements)
    second_owner_query = _assert_auth_plus_one_owner_query(second_statements)
    projection = first_owner_query.split(" from ", 1)[0]
    for private_column in (
        "cellar_entries.id",
        "cellar_entries.user_id",
        "cellar_entries.notes",
        "cellar_entries.memory_title",
        "cellar_entries.location",
        "cellar_entries.opened_with",
    ):
        assert private_column not in projection
    assert first_owner_query == second_owner_query
