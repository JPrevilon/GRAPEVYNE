import json
import logging

from sqlalchemy.exc import SQLAlchemyError

import app.routes.cellar as cellar_routes
import app.routes.wines as wine_routes
from app.extensions import db
from app.models import CellarEntry, Wine

from conftest import TEST_PASSWORD


CABERNET_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"


def _assert_success_envelope(response, status=200):
    assert response.status_code == status
    body = response.get_json()
    assert isinstance(body, dict)
    assert "data" in body
    assert "error" not in body
    assert set(body) <= {"data", "message"}
    return body


def _assert_error_envelope(response, status, code):
    assert response.status_code == status
    body = response.get_json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    assert set(body["error"]) <= {"code", "message", "details"}
    return body["error"]


def _assert_private_cache_policy(response):
    assert response.headers["Cache-Control"] == "private, no-store"
    vary = {value.strip().lower() for value in response.headers["Vary"].split(",")}
    assert "cookie" in vary


def _nested_keys(value):
    if isinstance(value, dict):
        for key, nested_value in value.items():
            yield key
            yield from _nested_keys(nested_value)
    elif isinstance(value, list):
        for item in value:
            yield from _nested_keys(item)


def test_every_application_route_keeps_the_standard_success_envelope(client):
    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "Envelope Member",
            "email": "envelope-member@example.test",
            "password": TEST_PASSWORD,
        },
    )
    _assert_success_envelope(signup, 201)

    public_and_auth_reads = (
        client.get("/api/health"),
        client.get("/api/auth/me"),
        client.get("/api/wines/search", query_string={"query": "steak"}),
        client.get(f"/api/wines/{CABERNET_ID}"),
        client.get(
            "/api/wines/recommendations",
            query_string={"query": "a red wine", "limit": "3"},
        ),
    )
    for response in public_and_auth_reads:
        _assert_success_envelope(response)

    created_response = client.post(
        "/api/cellar",
        json={
            "externalWineId": CABERNET_ID,
            "memoryTitle": "Envelope dinner",
            "userRating": 5,
        },
    )
    created = _assert_success_envelope(created_response, 201)["data"]["entry"]
    entry_id = created["id"]

    private_reads_and_update = (
        client.get("/api/cellar"),
        client.get(f"/api/cellar/{entry_id}"),
        client.patch(
            f"/api/cellar/{entry_id}",
            json={"wouldBuyAgain": True},
        ),
        client.get("/api/profile/taste"),
    )
    for response in private_reads_and_update:
        _assert_success_envelope(response)

    _assert_success_envelope(client.delete(f"/api/cellar/{entry_id}"))
    _assert_success_envelope(client.post("/api/auth/logout"))
    _assert_success_envelope(
        client.post(
            "/api/auth/login",
            json={
                "email": "envelope-member@example.test",
                "password": TEST_PASSWORD,
            },
        )
    )


def test_http_404_405_and_oversized_json_keep_the_standard_error_envelope(
    client,
):
    missing = client.get("/api/not-a-real-route")
    unsupported_method = client.post("/api/health")
    oversized_json = (
        b'{"name":"'
        + (b"x" * 1_048_576)
        + b'","email":"large@example.test","password":"password-123"}'
    )
    oversized = client.post(
        "/api/auth/signup",
        data=oversized_json,
        content_type="application/json",
    )

    _assert_error_envelope(missing, 404, "not_found")
    _assert_error_envelope(unsupported_method, 405, "method_not_allowed")
    _assert_error_envelope(oversized, 413, "request_entity_too_large")


def test_auth_and_cellar_responses_are_never_shared_cached(client):
    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "Private Cache Member",
            "email": "private-cache@example.test",
            "password": TEST_PASSWORD,
        },
    )
    created = client.post(
        "/api/cellar",
        json={"externalWineId": CABERNET_ID},
    )
    entry_id = created.get_json()["data"]["entry"]["id"]

    private_responses = (
        signup,
        client.get("/api/auth/me"),
        created,
        client.get("/api/cellar"),
        client.get(f"/api/cellar/{entry_id}"),
        client.patch(f"/api/cellar/{entry_id}", json={"favorite": True}),
        client.get("/api/cellar/999999999"),
        client.delete(f"/api/cellar/{entry_id}"),
        client.post("/api/auth/logout"),
        client.get("/api/auth/me"),
    )

    for response in private_responses:
        _assert_private_cache_policy(response)


def test_catalog_and_recommendation_responses_exclude_private_and_internal_fields(
    client,
):
    marker = "PRIVATE-PUBLIC-BOUNDARY-9F31"
    _assert_success_envelope(
        client.post(
            "/api/auth/signup",
            json={
                "name": "Privacy Boundary",
                "email": "privacy-boundary@example.test",
                "password": TEST_PASSWORD,
            },
        ),
        201,
    )
    _assert_success_envelope(
        client.post(
            "/api/cellar",
            json={
                "externalWineId": CABERNET_ID,
                "notes": marker,
                "memoryTitle": f"{marker}-title",
                "location": f"{marker}-location",
                "openedWith": f"{marker}-company",
                "userRating": 5,
                "favorite": True,
            },
        ),
        201,
    )

    responses = (
        client.get("/api/wines/search", query_string={"query": "steak"}),
        client.get(f"/api/wines/{CABERNET_ID}"),
        client.get(
            "/api/wines/recommendations",
            query_string={"query": "a red wine", "limit": "6"},
        ),
    )
    forbidden_keys = {
        "createdAt",
        "id",
        "location",
        "memoryTitle",
        "notes",
        "openedWith",
        "savedAt",
        "tastedOn",
        "updatedAt",
        "userId",
        "wineId",
        "wouldBuyAgain",
    }

    for response in responses:
        data = _assert_success_envelope(response)["data"]
        assert marker not in json.dumps(data)
        assert forbidden_keys.isdisjoint(set(_nested_keys(data)))


def test_failed_create_rolls_back_and_logs_only_the_exception_class(
    app,
    client,
    login_user,
    monkeypatch,
    caplog,
):
    marker = "PRIVATE-CREATE-ROLLBACK-DETAIL"
    user = login_user(client, email="create-rollback@example.test")

    with app.app_context():
        before = (Wine.query.count(), CellarEntry.query.count())

    def fail_after_flush(user_id, _payload):
        wine = Wine(
            source=f"manual:user:{user_id}",
            external_api_id="create-rollback-wine",
            name="Create rollback wine",
        )
        db.session.add(wine)
        db.session.flush()
        db.session.add(
            CellarEntry(
                user_id=user_id,
                wine_id=wine.id,
                notes=marker,
            )
        )
        db.session.flush()
        raise SQLAlchemyError(marker)

    monkeypatch.setattr(
        cellar_routes.cellar_service,
        "create_entry_for_user",
        fail_after_flush,
    )
    caplog.set_level(logging.ERROR)
    response = client.post(
        "/api/cellar",
        json={"externalWineId": CABERNET_ID},
    )

    _assert_error_envelope(response, 500, "database_error")
    with app.app_context():
        after = (Wine.query.count(), CellarEntry.query.count())
    assert after == before
    assert user["id"] > 0
    assert marker not in response.get_data(as_text=True)
    assert marker not in caplog.text
    assert "SQLAlchemyError" in caplog.text


def test_failed_delete_rolls_back_and_preserves_the_owned_entry(
    app,
    client,
    login_user,
    monkeypatch,
    caplog,
):
    marker = "PRIVATE-DELETE-ROLLBACK-DETAIL"
    login_user(client, email="delete-rollback@example.test")
    created = _assert_success_envelope(
        client.post("/api/cellar", json={"externalWineId": CABERNET_ID}),
        201,
    )["data"]["entry"]

    def fail_after_flush(entry):
        db.session.delete(entry)
        db.session.flush()
        raise SQLAlchemyError(marker)

    monkeypatch.setattr(
        cellar_routes.cellar_service,
        "delete_entry",
        fail_after_flush,
    )
    caplog.set_level(logging.ERROR)
    response = client.delete(f"/api/cellar/{created['id']}")

    _assert_error_envelope(response, 500, "database_error")
    persisted = client.get(f"/api/cellar/{created['id']}")
    assert persisted.status_code == 200
    assert persisted.get_json()["data"]["entry"] == created
    with app.app_context():
        assert CellarEntry.query.count() == 1
        assert Wine.query.count() == 1
    assert marker not in response.get_data(as_text=True)
    assert marker not in caplog.text
    assert "SQLAlchemyError" in caplog.text


def test_unexpected_provider_failure_does_not_log_or_return_private_details(
    client,
    monkeypatch,
    caplog,
):
    marker = "PRIVATE-UNEXPECTED-PROVIDER-DETAIL"

    def fail_search(_query):
        raise RuntimeError(marker)

    monkeypatch.setattr(wine_routes.wine_service, "search", fail_search)
    caplog.set_level(logging.ERROR)
    response = client.get("/api/wines/search", query_string={"query": "steak"})

    _assert_error_envelope(response, 500, "internal_server_error")
    assert marker not in response.get_data(as_text=True)
    assert marker not in caplog.text
    assert "RuntimeError" in caplog.text
