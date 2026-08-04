from datetime import date, timedelta

import pytest
from sqlalchemy.exc import SQLAlchemyError

import app.routes.cellar as cellar_routes
from app.extensions import db

from conftest import TEST_PASSWORD


EXTERNAL_WINE_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
SECOND_EXTERNAL_WINE_ID = "mock-argyle-reserve-pinot-noir-2021"


def _signup(client, name, email):
    response = client.post(
        "/api/auth/signup",
        json={"email": email, "name": name, "password": TEST_PASSWORD},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["user"]


def _create(client, external_wine_id=EXTERNAL_WINE_ID, **fields):
    response = client.post(
        "/api/cellar",
        json={"externalWineId": external_wine_id, **fields},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["entry"]


def test_create_and_refresh_persist_all_private_memory_fields(client, login_user):
    user = login_user(client)
    created = _create(
        client,
        memoryTitle="  Anniversary at home  ",
        tastedOn="2026-02-14",
        location="  Brooklyn, NY  ",
        pairing="  Braised short ribs  ",
        openedWith="  Sam and Jo  ",
        wouldBuyAgain=False,
        tags=["  Cedar  ", "Dinner"],
    )

    assert created["userId"] == user["id"]
    assert created["memoryTitle"] == "Anniversary at home"
    assert created["tastedOn"] == "2026-02-14"
    assert created["location"] == "Brooklyn, NY"
    assert created["pairing"] == "Braised short ribs"
    assert created["openedWith"] == "Sam and Jo"
    assert created["wouldBuyAgain"] is False
    assert created["tags"] == ["Cedar", "Dinner"]

    entry_id = created["id"]
    detail = client.get(f"/api/cellar/{entry_id}")
    listed = client.get("/api/cellar")

    assert detail.status_code == listed.status_code == 200
    assert detail.get_json()["data"]["entry"] == created
    assert listed.get_json()["data"]["entries"] == [created]


@pytest.mark.parametrize(
    ("field", "value", "response_value"),
    (
        ("memoryTitle", "  First pour  ", "First pour"),
        ("tastedOn", "2025-12-31", "2025-12-31"),
        ("location", "  At home  ", "At home"),
        ("pairing", "  Steak  ", "Steak"),
        ("openedWith", "  Family  ", "Family"),
        ("wouldBuyAgain", True, True),
        ("wouldBuyAgain", False, False),
        ("wouldBuyAgain", None, None),
        ("tags", ["  blackberry ", "Steak night"], ["blackberry", "Steak night"]),
    ),
)
def test_patch_each_memory_field_individually(
    client,
    login_user,
    field,
    value,
    response_value,
):
    login_user(client)
    entry = _create(client)

    response = client.patch(
        f"/api/cellar/{entry['id']}",
        json={field: value},
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["entry"][field] == response_value
    assert client.get(f"/api/cellar/{entry['id']}").get_json()["data"][
        "entry"
    ][field] == response_value


def test_patch_multiple_memory_fields_and_clear_nullable_values(
    client,
    login_user,
):
    login_user(client)
    entry = _create(
        client,
        memoryTitle="Original",
        tastedOn="2025-01-05",
        location="Original place",
        pairing="Original pairing",
        openedWith="Original company",
        wouldBuyAgain=True,
        tags=["original"],
    )

    updated = client.patch(
        f"/api/cellar/{entry['id']}",
        json={
            "memoryTitle": "   ",
            "tastedOn": "",
            "location": None,
            "pairing": "  ",
            "openedWith": None,
            "wouldBuyAgain": None,
            "tags": [],
        },
    )

    assert updated.status_code == 200
    persisted = updated.get_json()["data"]["entry"]
    assert persisted["memoryTitle"] is None
    assert persisted["tastedOn"] is None
    assert persisted["location"] is None
    assert persisted["pairing"] is None
    assert persisted["openedWith"] is None
    assert persisted["wouldBuyAgain"] is None
    assert persisted["tags"] == []


@pytest.mark.parametrize(
    ("changes", "detail_key"),
    (
        ({"memoryTitle": 12}, "memoryTitle"),
        ({"memoryTitle": "m" * 161}, "memoryTitle"),
        ({"location": ["home"]}, "location"),
        ({"location": "l" * 241}, "location"),
        ({"pairing": {"food": "steak"}}, "pairing"),
        ({"pairing": "p" * 241}, "pairing"),
        ({"openedWith": True}, "openedWith"),
        ({"openedWith": "o" * 241}, "openedWith"),
        ({"tastedOn": "02/14/2026"}, "tastedOn"),
        ({"tastedOn": "2026-2-4"}, "tastedOn"),
        ({"tastedOn": "2025-02-29"}, "tastedOn"),
        ({"tastedOn": 20260214}, "tastedOn"),
        ({"wouldBuyAgain": "yes"}, "wouldBuyAgain"),
        ({"wouldBuyAgain": 1}, "wouldBuyAgain"),
        ({"tags": None}, "tags"),
        ({"tags": "cedar"}, "tags"),
        ({"tags": ["tag"] * 13}, "tags"),
        ({"tags": ["valid", "   "]}, "tags[1]"),
        ({"tags": ["valid", 5]}, "tags[1]"),
        ({"tags": ["t" * 41]}, "tags[0]"),
        ({"tags": ["Cedar", " cedar "]}, "tags"),
    ),
)
def test_invalid_memory_values_are_rejected_without_changing_the_entry(
    client,
    login_user,
    error_assertion,
    changes,
    detail_key,
):
    login_user(client)
    entry = _create(client, memoryTitle="Original memory")

    response = client.patch(f"/api/cellar/{entry['id']}", json=changes)

    error = error_assertion(response, 400, "validation_error")
    assert detail_key in error["details"]
    persisted = client.get(f"/api/cellar/{entry['id']}").get_json()["data"][
        "entry"
    ]
    assert persisted["memoryTitle"] == "Original memory"


def test_future_tasted_date_is_rejected(client, login_user, error_assertion):
    login_user(client)
    entry = _create(client)
    future_date = (date.today() + timedelta(days=1)).isoformat()

    response = client.patch(
        f"/api/cellar/{entry['id']}",
        json={"tastedOn": future_date},
    )

    error = error_assertion(response, 400, "validation_error")
    assert error["details"] == {
        "tastedOn": "Tasted date cannot be in the future."
    }


def test_memory_fields_remain_owner_scoped_and_cross_owner_404_is_indistinguishable(
    app,
    error_assertion,
):
    client_a = app.test_client()
    client_b = app.test_client()
    user_a = _signup(client_a, "Memory A", "memory-a@example.test")
    _signup(client_b, "Memory B", "memory-b@example.test")
    entry = _create(
        client_a,
        memoryTitle="User A only",
        location="Private location",
        openedWith="Private company",
    )

    missing = client_b.get("/api/cellar/999999")
    cross_get = client_b.get(f"/api/cellar/{entry['id']}")
    cross_patch = client_b.patch(
        f"/api/cellar/{entry['id']}",
        json={"memoryTitle": "User B overwrite"},
    )
    cross_delete = client_b.delete(f"/api/cellar/{entry['id']}")

    expected_body = missing.get_json()
    for response in (missing, cross_get, cross_patch, cross_delete):
        error_assertion(response, 404, "cellar_entry_not_found")
        assert response.get_json() == expected_body

    unchanged = client_a.get(f"/api/cellar/{entry['id']}").get_json()["data"]
    assert unchanged["entry"]["userId"] == user_a["id"]
    assert unchanged["entry"]["memoryTitle"] == "User A only"
    assert unchanged["entry"]["location"] == "Private location"
    assert unchanged["entry"]["openedWith"] == "Private company"


def test_memory_update_rolls_back_when_the_transaction_fails(
    client,
    login_user,
    monkeypatch,
    error_assertion,
):
    login_user(client)
    entry = _create(client, memoryTitle="Before failure")

    def fail_update(owned_entry, _payload):
        owned_entry.memory_title = "MUST ROLL BACK"
        db.session.flush()
        raise SQLAlchemyError("injected transaction failure")

    monkeypatch.setattr(cellar_routes.cellar_service, "update_entry", fail_update)
    response = client.patch(
        f"/api/cellar/{entry['id']}",
        json={"memoryTitle": "Attempted change"},
    )

    error_assertion(response, 500, "database_error")
    persisted = client.get(f"/api/cellar/{entry['id']}").get_json()["data"][
        "entry"
    ]
    assert persisted["memoryTitle"] == "Before failure"


def test_expected_user_precondition_applies_to_memory_updates(
    client,
    login_user,
    error_assertion,
):
    user = login_user(client)
    entry = _create(client, memoryTitle="Current owner")

    response = client.patch(
        f"/api/cellar/{entry['id']}",
        headers={"X-Grapevyne-Expected-User-Id": str(user["id"] + 1)},
        json={"memoryTitle": "Stale identity"},
    )

    error_assertion(response, 409, "session_identity_changed")
    persisted = client.get(f"/api/cellar/{entry['id']}").get_json()["data"][
        "entry"
    ]
    assert persisted["memoryTitle"] == "Current owner"
