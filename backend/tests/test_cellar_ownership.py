from app.extensions import db
from app.models import Wine

from conftest import TEST_PASSWORD


EXTERNAL_WINE_ID = "mock-la-rioja-alta-reserva-2018"
SECOND_EXTERNAL_WINE_ID = "mock-argyle-reserve-pinot-noir-2021"
POISON_TARGET_WINE_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"
CANONICAL_IMAGE_URL = (
    "/images/wines/chateau-montelena-estate-cabernet-sauvignon-2019.png"
)


def _signup(client, name, email):
    response = client.post(
        "/api/auth/signup",
        json={"email": email, "name": name, "password": TEST_PASSWORD},
    )
    assert response.status_code == 201
    return response.get_json()["data"]["user"]


def test_two_users_have_indistinguishable_owner_scoped_cellars(
    app,
    error_assertion,
):
    client_a = app.test_client()
    client_b = app.test_client()
    user_a = _signup(client_a, "User A", "user-a@example.test")
    user_b = _signup(client_b, "User B", "user-b@example.test")

    created_a = client_a.post(
        "/api/cellar",
        json={
            "externalWineId": EXTERNAL_WINE_ID,
            "favorite": True,
            "notes": "User A private note",
            "status": "tasted",
            "userRating": 5,
        },
    )
    assert created_a.status_code == 201
    entry_a = created_a.get_json()["data"]["entry"]
    entry_a_id = entry_a["id"]
    assert entry_a["userId"] == user_a["id"]

    list_a = client_a.get("/api/cellar")
    detail_a = client_a.get(f"/api/cellar/{entry_a_id}")
    assert list_a.status_code == 200
    assert [entry["id"] for entry in list_a.get_json()["data"]["entries"]] == [
        entry_a_id
    ]
    assert detail_a.get_json()["data"]["entry"]["notes"] == "User A private note"

    list_b = client_b.get("/api/cellar")
    assert list_b.status_code == 200
    assert list_b.get_json()["data"] == {"count": 0, "entries": []}

    missing_for_b = client_b.get("/api/cellar/999999")
    cross_get = client_b.get(f"/api/cellar/{entry_a_id}")
    cross_patch = client_b.patch(
        f"/api/cellar/{entry_a_id}",
        json={"notes": "User B attempted overwrite", "userRating": 1},
    )
    cross_delete = client_b.delete(f"/api/cellar/{entry_a_id}")

    expected_missing_body = missing_for_b.get_json()
    error_assertion(missing_for_b, 404, "cellar_entry_not_found")

    for response in (cross_get, cross_patch, cross_delete):
        error_assertion(response, 404, "cellar_entry_not_found")
        assert response.get_json() == expected_missing_body

    unchanged_a = client_a.get(f"/api/cellar/{entry_a_id}")
    assert unchanged_a.status_code == 200
    assert unchanged_a.get_json()["data"]["entry"]["notes"] == "User A private note"
    assert unchanged_a.get_json()["data"]["entry"]["userRating"] == 5

    created_b = client_b.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    assert created_b.status_code == 201
    entry_b = created_b.get_json()["data"]["entry"]
    assert entry_b["userId"] == user_b["id"]
    assert entry_b["wine"]["externalWineId"] == EXTERNAL_WINE_ID
    assert entry_b["id"] != entry_a_id

    duplicate_a = client_a.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    error_assertion(duplicate_a, 409, "cellar_entry_exists")

    forged_create = client_b.post(
        "/api/cellar",
        json={
            "externalWineId": SECOND_EXTERNAL_WINE_ID,
            "owner_id": user_a["id"],
            "user_id": user_a["id"],
        },
    )
    forged_patch = client_b.patch(
        f"/api/cellar/{entry_b['id']}",
        json={"favorite": True, "ownerId": user_a["id"]},
    )

    create_error = error_assertion(forged_create, 400, "validation_error")
    assert "owner_id" in create_error["details"]
    assert "user_id" in create_error["details"]
    assert "ownerId" in error_assertion(
        forged_patch, 400, "validation_error"
    )["details"]
    assert client_b.get(f"/api/cellar/{entry_b['id']}").get_json()["data"][
        "entry"
    ]["userId"] == user_b["id"]
    assert client_a.get("/api/cellar").get_json()["data"]["count"] == 1
    assert client_b.get("/api/cellar").get_json()["data"]["count"] == 1

    logout_a = client_a.post("/api/auth/logout")
    assert logout_a.status_code == 200
    error_assertion(
        client_a.get(f"/api/cellar/{entry_a_id}"),
        401,
        "authentication_required",
    )


def test_nested_payload_cannot_poison_shared_canonical_wine_metadata(app):
    client_a = app.test_client()
    client_b = app.test_client()
    _signup(client_a, "Poison User A", "poison-a@example.test")
    _signup(client_b, "Poison User B", "poison-b@example.test")

    attacker_save = client_a.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": POISON_TARGET_WINE_ID,
                "imageUrl": "https://attacker.example.test/replacement.png",
                "name": "Attacker-controlled global name",
                "source": "mock",
            }
        },
    )
    independent_save = client_b.post(
        "/api/cellar",
        json={"externalWineId": POISON_TARGET_WINE_ID},
    )

    assert attacker_save.status_code == 201
    assert independent_save.status_code == 201
    attacker_wine = attacker_save.get_json()["data"]["entry"]["wine"]
    independent_wine = independent_save.get_json()["data"]["entry"]["wine"]

    for wine in (attacker_wine, independent_wine):
        assert wine["name"] == "Estate Cabernet Sauvignon"
        assert wine["imageUrl"] == CANONICAL_IMAGE_URL
        assert wine["source"] == "mock"

    assert attacker_wine["id"] == independent_wine["id"]

    with app.app_context():
        persisted_wines = Wine.query.filter_by(
            source="mock",
            external_api_id=POISON_TARGET_WINE_ID,
        ).all()
        assert len(persisted_wines) == 1
        assert persisted_wines[0].name == "Estate Cabernet Sauvignon"
        assert persisted_wines[0].image_url == CANONICAL_IMAGE_URL
        assert Wine.query.count() == 1


def test_unknown_nested_wines_use_independent_server_owned_manual_namespaces(
    app,
    error_assertion,
):
    client_a = app.test_client()
    client_b = app.test_client()
    user_a = _signup(client_a, "Manual User A", "manual-a@example.test")
    user_b = _signup(client_b, "Manual User B", "manual-b@example.test")
    external_wine_id = "private-family-bottle-1997"

    saved_a = client_a.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "/images/manual/user-a.png",
                "name": "User A Family Bottle",
                "source": "mock",
            }
        },
    )
    saved_b = client_b.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "/images/manual/user-b.png",
                "name": "User B Family Bottle",
                "source": "mock",
            }
        },
    )

    assert saved_a.status_code == 201
    assert saved_b.status_code == 201
    wine_a = saved_a.get_json()["data"]["entry"]["wine"]
    wine_b = saved_b.get_json()["data"]["entry"]["wine"]
    assert wine_a["id"] != wine_b["id"]
    assert wine_a["name"] == "User A Family Bottle"
    assert wine_b["name"] == "User B Family Bottle"
    assert wine_a["imageUrl"] == "/images/manual/user-a.png"
    assert wine_b["imageUrl"] == "/images/manual/user-b.png"
    assert wine_a["source"] == f"manual:user:{user_a['id']}"
    assert wine_b["source"] == f"manual:user:{user_b['id']}"

    provider_only_lookup = client_a.post(
        "/api/cellar",
        json={"externalWineId": external_wine_id},
    )
    error_assertion(provider_only_lookup, 404, "wine_not_found")

    assert client_a.get("/api/cellar").get_json()["data"]["entries"][0][
        "wine"
    ]["name"] == "User A Family Bottle"
    assert client_b.get("/api/cellar").get_json()["data"]["entries"][0][
        "wine"
    ]["name"] == "User B Family Bottle"

    with app.app_context():
        manual_wines = Wine.query.filter_by(
            external_api_id=external_wine_id,
        ).order_by(Wine.source).all()
        assert [(wine.source, wine.name) for wine in manual_wines] == [
            (f"manual:user:{user_a['id']}", "User A Family Bottle"),
            (f"manual:user:{user_b['id']}", "User B Family Bottle"),
        ]
        assert Wine.query.filter_by(
            source="mock",
            external_api_id=external_wine_id,
        ).count() == 0
