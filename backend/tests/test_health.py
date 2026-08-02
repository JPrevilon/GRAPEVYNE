def test_health_uses_the_success_envelope(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {
        "data": {
            "phase": "foundation",
            "service": "grapevyne-api",
            "status": "ok",
        }
    }


def test_unknown_api_route_uses_the_error_envelope(client, error_assertion):
    response = client.get("/api/not-a-route")

    error = error_assertion(response, 404, "not_found")
    assert "details" not in error
