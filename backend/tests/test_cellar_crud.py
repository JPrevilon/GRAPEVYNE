import pytest

import app.routes.cellar as cellar_routes
from app.extensions import db
from app.models import Wine
from app.services.wine_service import WineServiceTimeoutError


EXTERNAL_WINE_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"


def test_every_cellar_endpoint_requires_authentication(client, error_assertion):
    requests = (
        client.get("/api/cellar"),
        client.post("/api/cellar", json={"externalWineId": EXTERNAL_WINE_ID}),
        client.get("/api/cellar/1"),
        client.patch("/api/cellar/1", json={"favorite": True}),
        client.delete("/api/cellar/1"),
    )

    for response in requests:
        error_assertion(response, 401, "authentication_required")


def test_complete_cellar_crud_preserves_the_real_response_contract(
    client,
    login_user,
    error_assertion,
):
    user = login_user(client)

    created = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    assert created.status_code == 201
    assert created.get_json()["message"] == "Wine saved to cellar."
    entry = created.get_json()["data"]["entry"]
    entry_id = entry["id"]
    assert entry["userId"] == user["id"]
    assert entry["wine"]["externalWineId"] == EXTERNAL_WINE_ID
    assert entry["status"] == "saved"
    assert entry["favorite"] is False
    assert entry["tags"] == []

    listed = client.get("/api/cellar")
    detail = client.get(f"/api/cellar/{entry_id}")

    assert listed.status_code == 200
    assert listed.get_json()["data"]["count"] == 1
    assert listed.get_json()["data"]["entries"][0]["id"] == entry_id
    assert detail.status_code == 200
    assert detail.get_json()["data"]["entry"]["id"] == entry_id

    updated = client.patch(
        f"/api/cellar/{entry_id}",
        json={
            "favorite": True,
            "notes": " Black cherry and cedar. ",
            "occasion": " Anniversary dinner ",
            "status": "tasted",
            "userRating": 5,
        },
    )

    assert updated.status_code == 200
    assert updated.get_json()["message"] == "Cellar entry updated."
    updated_entry = updated.get_json()["data"]["entry"]
    assert updated_entry["favorite"] is True
    assert updated_entry["notes"] == "Black cherry and cedar."
    assert updated_entry["occasion"] == "Anniversary dinner"
    assert updated_entry["status"] == "tasted"
    assert updated_entry["userRating"] == 5

    deleted = client.delete(f"/api/cellar/{entry_id}")

    assert deleted.status_code == 200
    assert deleted.get_json() == {
        "data": {"deletedId": entry_id},
        "message": "Cellar entry deleted.",
    }
    error_assertion(
        client.get(f"/api/cellar/{entry_id}"),
        404,
        "cellar_entry_not_found",
    )


def test_duplicate_save_is_scoped_and_returns_the_existing_entry(
    client,
    login_user,
    error_assertion,
):
    login_user(client)
    first = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    duplicate = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    assert first.status_code == 201
    error = error_assertion(duplicate, 409, "cellar_entry_exists")
    assert error["details"]["entry"]["id"] == first.get_json()["data"]["entry"]["id"]


def test_duplicate_provider_save_self_heals_legacy_poisoned_metadata(
    app,
    client,
    login_user,
    error_assertion,
):
    login_user(client)
    created = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    assert created.status_code == 201

    with app.app_context():
        wine = Wine.query.filter_by(
            source="mock",
            external_api_id=EXTERNAL_WINE_ID,
        ).one()
        wine.name = "Legacy poisoned name"
        wine.image_url = "https://attacker.example.test/legacy-poison.png"
        wine.average_rating = 1
        wine.price_cents = 1
        db.session.commit()

    duplicate = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    error = error_assertion(duplicate, 409, "cellar_entry_exists")
    healed_response_wine = error["details"]["entry"]["wine"]
    assert healed_response_wine["name"] == "Estate Cabernet Sauvignon"
    assert healed_response_wine["imageUrl"] == (
        "/images/wines/chateau-montelena-estate-cabernet-sauvignon-2019.png"
    )
    assert healed_response_wine["averageRating"] == 4.6
    assert healed_response_wine["priceCents"] == 9500

    with app.app_context():
        healed_wine = Wine.query.filter_by(
            source="mock",
            external_api_id=EXTERNAL_WINE_ID,
        ).one()
        assert healed_wine.name == "Estate Cabernet Sauvignon"
        assert healed_wine.image_url == (
            "/images/wines/chateau-montelena-estate-cabernet-sauvignon-2019.png"
        )
        assert float(healed_wine.average_rating) == 4.6
        assert healed_wine.price_cents == 9500


def test_duplicate_manual_save_does_not_mutate_the_existing_wine(
    client,
    login_user,
    error_assertion,
):
    login_user(client)
    external_wine_id = "manual-family-reserve"
    first = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "/images/manual/original.png",
                "name": "Original Family Reserve",
                "source": "mock",
            }
        },
    )
    assert first.status_code == 201
    entry_id = first.get_json()["data"]["entry"]["id"]

    duplicate = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "https://attacker.example.test/replacement.png",
                "name": "Changed By Rejected Duplicate",
                "source": "mock",
            }
        },
    )

    error = error_assertion(duplicate, 409, "cellar_entry_exists")
    duplicate_wine = error["details"]["entry"]["wine"]
    assert duplicate_wine["name"] == "Original Family Reserve"
    assert duplicate_wine["imageUrl"] == "/images/manual/original.png"

    persisted_wine = client.get(f"/api/cellar/{entry_id}").get_json()["data"][
        "entry"
    ]["wine"]
    assert persisted_wine["name"] == "Original Family Reserve"
    assert persisted_wine["imageUrl"] == "/images/manual/original.png"


def test_deleted_manual_wine_can_be_recreated_with_current_metadata(
    client,
    login_user,
):
    login_user(client)
    external_wine_id = "manual-recreated-reserve"
    first = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "/images/manual/original.png",
                "name": "Original Manual Reserve",
            }
        },
    )
    assert first.status_code == 201
    first_entry = first.get_json()["data"]["entry"]

    deleted = client.delete(f"/api/cellar/{first_entry['id']}")
    assert deleted.status_code == 200

    recreated = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": external_wine_id,
                "imageUrl": "/images/manual/replacement.png",
                "name": "Replacement Manual Reserve",
            }
        },
    )

    assert recreated.status_code == 201
    recreated_wine = recreated.get_json()["data"]["entry"]["wine"]
    assert recreated_wine["name"] == "Replacement Manual Reserve"
    assert recreated_wine["imageUrl"] == "/images/manual/replacement.png"
    assert recreated_wine["source"].startswith("manual:user:")


@pytest.mark.parametrize(
    ("changes", "field"),
    (
        ({"userRating": 0}, "userRating"),
        ({"userRating": 6}, "userRating"),
        ({"userRating": 3.5}, "userRating"),
        ({"userRating": True}, "userRating"),
        ({"favorite": "yes"}, "favorite"),
        ({"notes": 12}, "notes"),
        ({"occasion": ["dinner"]}, "occasion"),
        ({"status": "cellared"}, "status"),
    ),
)
def test_cellar_patch_rejects_invalid_field_values(
    client,
    login_user,
    error_assertion,
    changes,
    field,
):
    login_user(client)
    entry_id = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    ).get_json()["data"]["entry"]["id"]

    response = client.patch(f"/api/cellar/{entry_id}", json=changes)

    error = error_assertion(response, 400, "validation_error")
    assert field in error["details"]


def test_empty_notes_clear_to_null_and_oversized_notes_do_not_change_the_entry(
    client,
    login_user,
    error_assertion,
):
    login_user(client)
    entry_id = client.post(
        "/api/cellar",
        json={
            "externalWineId": EXTERNAL_WINE_ID,
            "notes": "Original private note",
        },
    ).get_json()["data"]["entry"]["id"]

    cleared = client.patch(f"/api/cellar/{entry_id}", json={"notes": "   "})
    oversized = client.patch(
        f"/api/cellar/{entry_id}",
        json={"notes": "n" * 4001},
    )
    detail = client.get(f"/api/cellar/{entry_id}")

    assert cleared.status_code == 200
    assert cleared.get_json()["data"]["entry"]["notes"] is None
    assert "notes" in error_assertion(
        oversized, 400, "validation_error"
    )["details"]
    assert detail.get_json()["data"]["entry"]["notes"] is None


def test_create_and_patch_reject_unknown_or_identity_fields(
    client,
    login_user,
    error_assertion,
):
    user = login_user(client)
    forged_create = client.post(
        "/api/cellar",
        json={
            "externalWineId": EXTERNAL_WINE_ID,
            "user_id": user["id"] + 100,
        },
    )
    valid_create = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )
    entry_id = valid_create.get_json()["data"]["entry"]["id"]
    forged_patch = client.patch(
        f"/api/cellar/{entry_id}",
        json={"favorite": True, "ownerId": user["id"] + 100},
    )
    unknown_patch = client.patch(
        f"/api/cellar/{entry_id}",
        json={"unrecognizedMemoryField": "private"},
    )
    empty_patch = client.patch(f"/api/cellar/{entry_id}", json={})

    create_error = error_assertion(forged_create, 400, "validation_error")
    assert "authenticated session" in create_error["details"]["user_id"]
    patch_error = error_assertion(forged_patch, 400, "validation_error")
    assert "authenticated session" in patch_error["details"]["ownerId"]
    assert "unrecognizedMemoryField" in error_assertion(
        unknown_patch, 400, "validation_error"
    )["details"]
    assert "payload" in error_assertion(
        empty_patch, 400, "validation_error"
    )["details"]
    assert client.get(f"/api/cellar/{entry_id}").get_json()["data"]["entry"][
        "favorite"
    ] is False


def test_nested_wine_payload_is_validated_but_uses_canonical_service_metadata(
    client,
    login_user,
    error_assertion,
):
    login_user(client)
    valid = client.post(
        "/api/cellar",
        json={
            "wine": {
                "averageRating": 1.0,
                "country": "Nowhere",
                "externalWineId": EXTERNAL_WINE_ID,
                "imageUrl": "https://attacker.example.test/poison.png",
                "name": "Poisoned Client Name",
                "priceCents": 12_500,
                "source": "mock",
            }
        },
    )
    invalid = client.post(
        "/api/cellar",
        json={
            "wine": {
                "externalWineId": "provider-invalid",
                "name": "Invalid Provider Wine",
                "pairings": ["steak"],
                "priceCents": -1,
            }
        },
    )

    assert valid.status_code == 201
    wine = valid.get_json()["data"]["entry"]["wine"]
    assert wine["name"] == "Estate Cabernet Sauvignon"
    assert wine["country"] == "United States"
    assert wine["averageRating"] == 4.6
    assert wine["priceCents"] == 9500
    assert wine["source"] == "mock"
    assert wine["imageUrl"] == (
        "/images/wines/chateau-montelena-estate-cabernet-sauvignon-2019.png"
    )
    invalid_error = error_assertion(invalid, 400, "validation_error")
    assert "wine.pairings" in invalid_error["details"]
    assert "wine.priceCents" in invalid_error["details"]


def test_malformed_and_nonexistent_entry_ids_return_structured_404s(
    client,
    login_user,
    error_assertion,
):
    login_user(client)

    malformed = client.get("/api/cellar/not-an-integer")
    nonexistent = client.get("/api/cellar/999999")

    error_assertion(malformed, 404, "not_found")
    error_assertion(nonexistent, 404, "cellar_entry_not_found")


def test_real_injected_wine_timeout_during_save_maps_to_504(
    client,
    login_user,
    monkeypatch,
    error_assertion,
):
    login_user(client)

    def timeout(_external_wine_id):
        raise WineServiceTimeoutError("injected timeout")

    monkeypatch.setattr(
        cellar_routes.cellar_service.wine_service,
        "get_by_external_id",
        timeout,
    )

    response = client.post(
        "/api/cellar",
        json={"externalWineId": EXTERNAL_WINE_ID},
    )

    error_assertion(response, 504, "wine_service_timeout")
