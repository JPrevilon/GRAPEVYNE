import json

from sqlalchemy import event

from app.extensions import db
from app.models import CellarEntry, User, Wine
from app.services.recommendation_personalization import (
    RecommendationPersonalizationService,
)

from conftest import TEST_PASSWORD


CABERNET_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
PINOT_ID = "mock-argyle-reserve-pinot-noir-2021"
SAUVIGNON_ID = "mock-frogs-leap-estate-sauvignon-blanc-2022"
CHAMPAGNE_ID = "mock-veuve-clicquot-brut-champagne-nv"


def _signup(client, name, email):
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


def test_anonymous_snapshot_is_request_only_and_contains_no_profile():
    snapshot = RecommendationPersonalizationService().anonymous_snapshot()

    assert snapshot.status == "anonymous"
    assert snapshot.signal_count == 0
    assert snapshot.is_active is False
    assert set(snapshot.to_public_dict()) == {
        "status",
        "signalCount",
        "disclosure",
    }


def test_three_signals_on_one_bottle_remain_insufficient(app, client):
    user = _signup(client, "One Bottle", "one-bottle@example.test")
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        status="buy_again",
    )

    with app.app_context():
        snapshot = RecommendationPersonalizationService().for_user(user["id"])

    assert snapshot.signal_count == 3
    assert snapshot.status == "insufficient_data"
    assert snapshot.is_active is False


def test_three_meaningful_signals_across_two_sourced_bottles_activate(app, client):
    user = _signup(client, "Active Taste", "active-taste@example.test")
    _save(client, CABERNET_ID, userRating=5, favorite=True)
    _save(client, PINOT_ID, status="buy_again")

    with app.app_context():
        snapshot = RecommendationPersonalizationService().for_user(user["id"])

    assert snapshot.status == "active"
    assert snapshot.signal_count == 3
    assert snapshot.seen_wine_ids == {CABERNET_ID, PINOT_ID}
    assert snapshot.attribute_weights["varietal:cabernet sauvignon"] > 0
    assert snapshot.attribute_weights["varietal:pinot noir"] > 0


def test_rating_three_saved_and_tasted_do_not_invent_preference(app, client):
    user = _signup(client, "Neutral Taste", "neutral-taste@example.test")
    _save(client, CABERNET_ID, userRating=3, status="tasted")
    _save(client, PINOT_ID, status="saved")

    with app.app_context():
        snapshot = RecommendationPersonalizationService().for_user(user["id"])

    assert snapshot.status == "insufficient_data"
    assert snapshot.signal_count == 0
    assert snapshot.attribute_weights == {}


def test_manual_wine_metadata_and_signals_do_not_activate_profile(app, client):
    user = _signup(client, "Manual Taste", "manual-taste@example.test")
    response = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": "manual-private-wine",
                "name": "Private Family Wine",
                "varietal": "Invented Private Varietal",
                "region": "Private Region",
            },
            "userRating": 5,
            "favorite": True,
            "status": "buy_again",
            "occasion": "celebration",
        },
    )
    assert response.status_code == 201

    with app.app_context():
        snapshot = RecommendationPersonalizationService().for_user(user["id"])

    assert snapshot.status == "insufficient_data"
    assert snapshot.signal_count == 0
    assert "private" not in json.dumps(snapshot.to_public_dict()).lower()


def test_owner_scoped_profiles_do_not_influence_each_other(app):
    client_a = app.test_client()
    client_b = app.test_client()
    user_a = _signup(client_a, "Taste User A", "taste-a@example.test")
    user_b = _signup(client_b, "Taste User B", "taste-b@example.test")

    _save(client_a, CABERNET_ID, userRating=5, favorite=True)
    _save(client_a, PINOT_ID, status="buy_again")
    _save(client_b, SAUVIGNON_ID, userRating=5, favorite=True)
    _save(client_b, CHAMPAGNE_ID, status="buy_again")

    with app.app_context():
        service = RecommendationPersonalizationService()
        snapshot_a = service.for_user(user_a["id"])
        snapshot_b = service.for_user(user_b["id"])

    assert snapshot_a.status == snapshot_b.status == "active"
    assert snapshot_a.attribute_weights["varietal:cabernet sauvignon"] > 0
    assert snapshot_b.attribute_weights["varietal:cabernet sauvignon"] == 0
    assert snapshot_b.attribute_weights["varietal:sauvignon blanc"] > 0
    assert snapshot_a.attribute_weights["varietal:sauvignon blanc"] == 0
    assert CABERNET_ID not in snapshot_b.seen_wine_ids
    assert SAUVIGNON_ID not in snapshot_a.seen_wine_ids


def test_personalization_query_projects_no_notes_ids_tags_or_user_identity(
    app,
    client,
):
    user = _signup(client, "Projection User", "projection@example.test")
    _save(
        client,
        CABERNET_ID,
        userRating=5,
        favorite=True,
        notes="NEVER SELECT THIS PRIVATE NOTE",
    )
    _save(client, PINOT_ID, status="buy_again")
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
            statements.append(statement.lower())

    with app.app_context():
        engine = db.engine
        event.listen(engine, "before_cursor_execute", capture_statement)
        try:
            RecommendationPersonalizationService().for_user(user["id"])
        finally:
            event.remove(engine, "before_cursor_execute", capture_statement)

    recommendation_select = next(
        " ".join(statement.split())
        for statement in statements
        if "join wines" in statement and "cellar_entries.user_rating" in statement
    )
    projection = recommendation_select.split(" from ", 1)[0]

    assert "cellar_entries.notes" not in projection
    assert "cellar_entries.tags" not in projection
    assert "cellar_entries.id" not in projection
    assert "cellar_entries.user_id" not in projection
    assert "where cellar_entries.user_id" in recommendation_select
    assert "wines.source" in recommendation_select


def test_snapshot_building_is_ephemeral_and_does_not_mutate_database(app, client):
    user = _signup(client, "Ephemeral User", "ephemeral@example.test")
    _save(client, CABERNET_ID, userRating=5, favorite=True)
    _save(client, PINOT_ID, status="buy_again")

    with app.app_context():
        before = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )
        RecommendationPersonalizationService().for_user(user["id"])
        after = (
            User.query.count(),
            Wine.query.count(),
            CellarEntry.query.count(),
        )

    assert after == before
