import app.routes.wines as wine_routes
from app.services.wine_service import (
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)


EXTERNAL_WINE_ID = "mock-chateau-montelena-cabernet-sauvignon-2019"


def test_search_trims_the_query_and_returns_real_static_service_results(client):
    response = client.get("/api/wines/search", query_string={"query": "  steak  "})

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["query"] == "steak"
    assert data["source"] == "mock"
    assert [wine["externalWineId"] for wine in data["results"]] == [EXTERNAL_WINE_ID]


def test_search_has_honest_empty_results_without_demo_substitution(client):
    response = client.get(
        "/api/wines/search",
        query_string={"query": "a wine phrase not present in the six records"},
    )

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "query": "a wine phrase not present in the six records",
        "results": [],
        "source": "mock",
    }


def test_search_validates_missing_and_oversized_queries(client, error_assertion):
    missing = client.get("/api/wines/search")
    whitespace = client.get("/api/wines/search", query_string={"query": "   "})
    oversized = client.get(
        "/api/wines/search",
        query_string={"query": "w" * 201},
    )

    error_assertion(missing, 400, "missing_query")
    error_assertion(whitespace, 400, "missing_query")
    assert "query" in error_assertion(
        oversized, 400, "validation_error"
    )["details"]


def test_wine_detail_uses_the_external_identifier(client, error_assertion):
    response = client.get(f"/api/wines/{EXTERNAL_WINE_ID}")
    missing = client.get("/api/wines/not-a-real-external-id")

    assert response.status_code == 200
    assert response.get_json()["data"]["wine"]["externalWineId"] == EXTERNAL_WINE_ID
    assert response.get_json()["data"]["source"] == "mock"
    error_assertion(missing, 404, "wine_not_found")


def test_wine_detail_path_converter_preserves_encoded_slashes(
    client,
    monkeypatch,
):
    requested_ids = []

    def lookup(external_wine_id):
        requested_ids.append(external_wine_id)
        return {
            "externalWineId": external_wine_id,
            "name": "Slash Identifier Wine",
            "source": "mock",
        }

    monkeypatch.setattr(wine_routes.wine_service, "get_by_external_id", lookup)

    response = client.get("/api/wines/provider%2Fcatalog%2Fwine-17")

    assert response.status_code == 200
    assert requested_ids == ["provider/catalog/wine-17"]
    assert response.get_json()["data"]["wine"]["externalWineId"] == (
        "provider/catalog/wine-17"
    )


def test_actual_injected_service_timeout_maps_to_504(
    client,
    monkeypatch,
    error_assertion,
):
    def timeout(_query):
        raise WineServiceTimeoutError("injected timeout")

    monkeypatch.setattr(wine_routes.wine_service, "search", timeout)

    response = client.get("/api/wines/search", query_string={"query": "steak"})

    error_assertion(response, 504, "wine_service_timeout")


def test_actual_injected_service_unavailability_maps_to_503(
    client,
    monkeypatch,
    error_assertion,
):
    def unavailable(_external_wine_id):
        raise WineServiceUnavailableError("injected outage")

    monkeypatch.setattr(wine_routes.wine_service, "get_by_external_id", unavailable)

    response = client.get(f"/api/wines/{EXTERNAL_WINE_ID}")

    error_assertion(response, 503, "wine_service_unavailable")


def test_unexpected_provider_bug_is_not_mislabeled_as_timeout_or_unavailability(
    client,
    monkeypatch,
    error_assertion,
):
    def broken(_query):
        raise RuntimeError("injected provider bug")

    monkeypatch.setattr(wine_routes.wine_service, "search", broken)

    response = client.get("/api/wines/search", query_string={"query": "steak"})

    error_assertion(response, 500, "internal_server_error")
