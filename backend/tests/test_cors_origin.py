import pytest
from flask import Flask
from flask_cors import CORS

from app import create_app
from app.config import normalize_origin, parse_origins
from app.extensions import db

from conftest import TEST_PASSWORD


TRUSTED_ORIGIN = "https://app.example.test"
UNTRUSTED_ORIGIN = "https://attacker.example.test"


@pytest.fixture
def secured_app(tmp_path):
    application = create_app(
        "testing",
        {
            "ENFORCE_ORIGIN_CHECKS": True,
            "FRONTEND_ORIGINS": (TRUSTED_ORIGIN,),
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'origin.sqlite'}",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        },
    )

    with application.app_context():
        db.create_all()

    return application


def _signup(client, headers=None, email="origin-user@example.test"):
    return client.post(
        "/api/auth/signup",
        headers=headers or {},
        json={
            "email": email,
            "name": "Origin User",
            "password": TEST_PASSWORD,
        },
    )


def test_trusted_origin_is_accepted_with_credentials(secured_app):
    response = _signup(
        secured_app.test_client(),
        headers={"Origin": TRUSTED_ORIGIN, "Sec-Fetch-Site": "same-origin"},
    )

    assert response.status_code == 201
    assert response.headers["Access-Control-Allow-Origin"] == TRUSTED_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


def test_untrusted_origin_gets_structured_403_without_cors_approval(
    secured_app,
    error_assertion,
):
    response = _signup(
        secured_app.test_client(),
        headers={"Origin": UNTRUSTED_ORIGIN, "Sec-Fetch-Site": "same-origin"},
    )

    error_assertion(response, 403, "csrf_origin_rejected")
    assert "Access-Control-Allow-Origin" not in response.headers


def test_same_origin_proxy_and_nonbrowser_unsafe_requests_are_accepted(secured_app):
    same_origin = _signup(
        secured_app.test_client(),
        headers={"Sec-Fetch-Site": "same-origin"},
    )
    nonbrowser_client = secured_app.test_client()
    nonbrowser = _signup(nonbrowser_client, email="nonbrowser@example.test")

    assert same_origin.status_code == 201
    assert nonbrowser.status_code == 201


def test_cross_site_fetch_metadata_is_rejected_even_with_a_trusted_origin(
    secured_app,
    error_assertion,
):
    response = _signup(
        secured_app.test_client(),
        headers={"Origin": TRUSTED_ORIGIN, "Sec-Fetch-Site": "cross-site"},
    )

    error_assertion(response, 403, "csrf_origin_rejected")


def test_safe_get_requests_are_unaffected_by_origin_enforcement(secured_app):
    response = secured_app.test_client().get(
        "/api/health",
        headers={"Origin": UNTRUSTED_ORIGIN, "Sec-Fetch-Site": "cross-site"},
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == "ok"
    assert "Access-Control-Allow-Origin" not in response.headers


def test_preflight_behavior_approves_only_the_exact_trusted_origin(secured_app):
    client = secured_app.test_client()
    trusted = client.options(
        "/api/auth/signup",
        headers={
            "Access-Control-Request-Headers": (
                "content-type,x-grapevyne-expected-user-id"
            ),
            "Access-Control-Request-Method": "POST",
            "Origin": TRUSTED_ORIGIN,
        },
    )
    untrusted = client.options(
        "/api/auth/signup",
        headers={
            "Access-Control-Request-Headers": "content-type",
            "Access-Control-Request-Method": "POST",
            "Origin": UNTRUSTED_ORIGIN,
        },
    )

    assert trusted.status_code == 200
    assert trusted.headers["Access-Control-Allow-Origin"] == TRUSTED_ORIGIN
    assert trusted.headers["Access-Control-Allow-Credentials"] == "true"
    allowed_headers = trusted.headers["Access-Control-Allow-Headers"].lower()
    assert "content-type" in allowed_headers
    assert "x-grapevyne-expected-user-id" in allowed_headers
    assert "POST" in trusted.headers["Access-Control-Allow-Methods"]
    assert "Access-Control-Allow-Private-Network" not in trusted.headers
    assert untrusted.status_code == 200
    assert "Access-Control-Allow-Origin" not in untrusted.headers


def test_private_network_preflight_is_explicitly_denied(secured_app):
    client = secured_app.test_client()
    headers = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Private-Network": "true",
    }

    trusted = client.options(
        "/api/auth/signup",
        headers={**headers, "Origin": TRUSTED_ORIGIN},
    )
    untrusted = client.options(
        "/api/auth/signup",
        headers={**headers, "Origin": UNTRUSTED_ORIGIN},
    )

    assert trusted.status_code == 200
    assert trusted.headers["Access-Control-Allow-Origin"] == TRUSTED_ORIGIN
    assert trusted.headers["Access-Control-Allow-Credentials"] == "true"
    assert trusted.headers["Access-Control-Allow-Private-Network"] == "false"
    assert "Access-Control-Allow-Origin" not in untrusted.headers
    assert "Access-Control-Allow-Credentials" not in untrusted.headers
    assert "Access-Control-Allow-Private-Network" not in untrusted.headers


@pytest.mark.parametrize(
    "path",
    (
        "/API/health",
        "/apiary",
        "/api+probe",
        "/not-api/api/probe",
    ),
)
def test_cors_resource_is_anchored_to_lowercase_api_boundary(secured_app, path):
    response = secured_app.test_client().get(
        path,
        headers={"Origin": TRUSTED_ORIGIN},
    )

    assert "Access-Control-Allow-Origin" not in response.headers
    assert "Access-Control-Allow-Credentials" not in response.headers
    assert "Access-Control-Allow-Private-Network" not in response.headers


def test_plus_character_is_not_normalized_to_space_for_resource_matching():
    application = Flask(__name__)
    application.add_url_rule("/api/a+b", view_func=lambda: "ok")
    CORS(
        application,
        resources={
            "/api/a+b": {"origins": [TRUSTED_ORIGIN]},
            "/api/a b": {"origins": [UNTRUSTED_ORIGIN]},
        },
        supports_credentials=True,
    )
    client = application.test_client()

    trusted = client.get("/api/a+b", headers={"Origin": TRUSTED_ORIGIN})
    untrusted = client.get("/api/a+b", headers={"Origin": UNTRUSTED_ORIGIN})

    assert trusted.headers["Access-Control-Allow-Origin"] == TRUSTED_ORIGIN
    assert "Access-Control-Allow-Origin" not in untrusted.headers


def test_static_cors_policy_beats_a_longer_generic_regex():
    application = Flask(__name__)
    application.add_url_rule("/api/private/data", view_func=lambda: "ok")
    CORS(
        application,
        resources={
            r"/api/private/(?:data|other)": {"origins": [UNTRUSTED_ORIGIN]},
            "/api/private/data": {"origins": [TRUSTED_ORIGIN]},
        },
        supports_credentials=True,
    )
    client = application.test_client()

    trusted = client.get(
        "/api/private/data",
        headers={"Origin": TRUSTED_ORIGIN},
    )
    untrusted = client.get(
        "/api/private/data",
        headers={"Origin": UNTRUSTED_ORIGIN},
    )

    assert trusted.headers["Access-Control-Allow-Origin"] == TRUSTED_ORIGIN
    assert "Access-Control-Allow-Origin" not in untrusted.headers


@pytest.mark.parametrize(
    "origin",
    (
        "*",
        "https://*.example.test",
        "https://app.example.test/path",
        "javascript:alert(1)",
    ),
)
def test_wildcard_or_malformed_configured_origins_fail_at_startup(origin):
    with pytest.raises(ValueError, match="origin|Wildcard"):
        create_app("testing", {"FRONTEND_ORIGINS": (origin,)})


def test_default_origin_ports_normalize_to_browser_canonical_origins():
    assert normalize_origin("http://LOCALHOST:80/") == "http://localhost"
    assert normalize_origin("https://APP.EXAMPLE.TEST:443") == (
        "https://app.example.test"
    )
    assert normalize_origin("https://app.example.test:8443") == (
        "https://app.example.test:8443"
    )
    assert parse_origins(
        "https://app.example.test:443,https://app.example.test"
    ) == ("https://app.example.test",)
