import pytest

from app.extensions import db
from app.models import CellarEntry, Wine

from conftest import TEST_PASSWORD


EXPECTED_USER_HEADER = "X-Grapevyne-Expected-User-Id"
EXTERNAL_WINE_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"


def _signup(client, name, email):
    response = client.post(
        "/api/auth/signup",
        json={"email": email, "name": name, "password": TEST_PASSWORD},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["user"]


@pytest.mark.parametrize(
    "header_value",
    (
        "",
        "0",
        "-1",
        "+1",
        "1.0",
        "not-an-integer",
        " 1 ",
        pytest.param("2147483648", id="out-of-range"),
        pytest.param("9" * 5_000, id="overlong-numeric"),
    ),
)
def test_malformed_expected_user_header_rejects_create_without_writes(
    app,
    client,
    login_user,
    error_assertion,
    header_value,
):
    login_user(client)

    response = client.post(
        "/api/cellar",
        headers={EXPECTED_USER_HEADER: header_value},
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    error = error_assertion(response, 400, "validation_error")
    assert error["details"] == {
        EXPECTED_USER_HEADER: "Expected user ID must be a positive integer."
    }

    with app.app_context():
        assert CellarEntry.query.count() == 0
        assert Wine.query.count() == 0


def test_matching_precondition_allows_crud_and_rejections_do_not_mutate(
    client,
    login_user,
    error_assertion,
):
    user = login_user(client)
    matching_headers = {EXPECTED_USER_HEADER: str(user["id"])}
    mismatch_headers = {EXPECTED_USER_HEADER: str(user["id"] + 1)}

    mismatch_create = client.post(
        "/api/cellar",
        headers=mismatch_headers,
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    error_assertion(mismatch_create, 409, "session_identity_changed")
    assert client.get("/api/cellar").get_json()["data"]["count"] == 0

    created = client.post(
        "/api/cellar",
        headers=matching_headers,
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    assert created.status_code == 201
    entry_id = created.get_json()["data"]["entry"]["id"]

    malformed_patch = client.patch(
        f"/api/cellar/{entry_id}",
        headers={EXPECTED_USER_HEADER: "invalid"},
        json={"favorite": True},
    )
    mismatch_patch = client.patch(
        f"/api/cellar/{entry_id}",
        headers=mismatch_headers,
        json={"favorite": True},
    )
    error_assertion(malformed_patch, 400, "validation_error")
    error_assertion(mismatch_patch, 409, "session_identity_changed")
    assert client.get(f"/api/cellar/{entry_id}").get_json()["data"]["entry"][
        "favorite"
    ] is False

    malformed_delete = client.delete(
        f"/api/cellar/{entry_id}",
        headers={EXPECTED_USER_HEADER: "0"},
    )
    mismatch_delete = client.delete(
        f"/api/cellar/{entry_id}",
        headers=mismatch_headers,
    )
    error_assertion(malformed_delete, 400, "validation_error")
    error_assertion(mismatch_delete, 409, "session_identity_changed")
    assert client.get(f"/api/cellar/{entry_id}").status_code == 200

    updated = client.patch(
        f"/api/cellar/{entry_id}",
        headers=matching_headers,
        json={"favorite": True},
    )
    assert updated.status_code == 200
    assert updated.get_json()["data"]["entry"]["favorite"] is True

    deleted = client.delete(
        f"/api/cellar/{entry_id}",
        headers=matching_headers,
    )
    assert deleted.status_code == 200
    assert client.get("/api/cellar").get_json()["data"]["count"] == 0


def test_stale_other_user_expectation_rejects_the_current_cookie_without_writes(
    app,
    error_assertion,
):
    client_a = app.test_client()
    client_b = app.test_client()
    user_a = _signup(client_a, "Expected User A", "expected-a@example.test")
    user_b = _signup(client_b, "Expected User B", "expected-b@example.test")

    stale_request = client_b.post(
        "/api/cellar",
        headers={EXPECTED_USER_HEADER: str(user_a["id"])},
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    error_assertion(stale_request, 409, "session_identity_changed")
    assert client_a.get("/api/cellar").get_json()["data"]["count"] == 0
    assert client_b.get("/api/cellar").get_json()["data"]["count"] == 0

    matching_request = client_b.post(
        "/api/cellar",
        headers={EXPECTED_USER_HEADER: str(user_b["id"])},
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    assert matching_request.status_code == 201
    assert matching_request.get_json()["data"]["entry"]["userId"] == user_b["id"]

    with app.app_context():
        assert CellarEntry.query.filter_by(user_id=user_a["id"]).count() == 0
        assert CellarEntry.query.filter_by(user_id=user_b["id"]).count() == 1
        matching_entry_id = matching_request.get_json()["data"]["entry"]["id"]
        matching_entry = db.session.get(CellarEntry, matching_entry_id)
        assert matching_entry is not None
        assert matching_entry.user_id == user_b["id"]
