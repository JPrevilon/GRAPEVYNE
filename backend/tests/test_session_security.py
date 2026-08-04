import pytest
from werkzeug.middleware.proxy_fix import ProxyFix

from app import create_app
from app.extensions import db

from conftest import TEST_PASSWORD


PRODUCTION_SECRET = "7fdc38e189584d8eb3fc60ab24f19d0a41c6222ac9004da9"
TRUSTED_ORIGIN = "https://app.example.test"
SESSION_ENVIRONMENT_KEYS = (
    "FRONTEND_ORIGIN",
    "FRONTEND_ORIGINS",
    "SECRET_KEY",
    "SESSION_COOKIE_DOMAIN",
    "SESSION_COOKIE_NAME",
    "SESSION_COOKIE_SECURE",
    "SESSION_LIFETIME_DAYS",
    "SESSION_REFRESH_EACH_REQUEST",
    "TRUST_PROXY_HEADERS",
)


def _clear_session_environment(monkeypatch):
    for key in SESSION_ENVIRONMENT_KEYS:
        monkeypatch.delenv(key, raising=False)


def _create_database_app(environment, database_path, overrides=None):
    config = {
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
        "SQLALCHEMY_ENGINE_OPTIONS": {},
    }
    config.update(overrides or {})
    application = create_app(environment, config)

    with application.app_context():
        db.create_all()

    return application


def _signup(client, headers=None):
    return client.post(
        "/api/auth/signup",
        headers=headers or {},
        json={
            "email": "cookie-user@example.test",
            "name": "Cookie User",
            "password": TEST_PASSWORD,
        },
    )


def _login(client, headers=None):
    return client.post(
        "/api/auth/login",
        headers=headers or {},
        json={
            "email": "cookie-user@example.test",
            "password": TEST_PASSWORD,
        },
    )


def _production_environment(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", PRODUCTION_SECRET)
    monkeypatch.setenv("FRONTEND_ORIGINS", TRUSTED_ORIGIN)


def test_development_cookie_is_http_compatible_but_still_httponly_and_lax(
    tmp_path,
    monkeypatch,
):
    _clear_session_environment(monkeypatch)
    application = _create_database_app(
        "development",
        tmp_path / "development.sqlite",
    )

    response = _signup(application.test_client())
    cookie = response.headers["Set-Cookie"]

    assert response.status_code == 201
    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    assert "Secure" not in cookie
    assert application.config["PERMANENT_SESSION_LIFETIME"].days == 7
    assert application.config["SESSION_REFRESH_EACH_REQUEST"] is False
    assert application.config["SESSION_COOKIE_DOMAIN"] is None
    assert application.config["FRONTEND_ORIGINS"] == (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    )


def test_testing_browser_config_ignores_ambient_cookie_proxy_and_origin_values(
    tmp_path,
    monkeypatch,
):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://ambient.example.test")
    monkeypatch.setenv("SESSION_COOKIE_NAME", "ambient-cookie")
    monkeypatch.setenv("SESSION_COOKIE_DOMAIN", ".ambient.example.test")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "not-a-boolean")
    monkeypatch.setenv("SESSION_LIFETIME_DAYS", "999")
    monkeypatch.setenv("SESSION_REFRESH_EACH_REQUEST", "true")
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    application = _create_database_app("testing", tmp_path / "testing.sqlite")

    response = _signup(application.test_client())
    cookie = response.headers["Set-Cookie"]

    assert response.status_code == 201
    assert application.config["SECRET_KEY"] == "testing-secret-key"
    assert application.config["SESSION_COOKIE_NAME"] == "session"
    assert application.config["SESSION_COOKIE_DOMAIN"] is None
    assert application.config["SESSION_COOKIE_SECURE"] is False
    assert application.config["PERMANENT_SESSION_LIFETIME"].days == 7
    assert application.config["SESSION_REFRESH_EACH_REQUEST"] is False
    assert application.config["TRUST_PROXY_HEADERS"] is False
    assert application.config["FRONTEND_ORIGINS"] == (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    )
    assert not isinstance(application.wsgi_app, ProxyFix)
    assert cookie.startswith("session=")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    assert "Secure" not in cookie


def test_production_cookie_is_secure_httponly_lax_and_fixed(
    tmp_path,
    monkeypatch,
):
    _clear_session_environment(monkeypatch)
    _production_environment(monkeypatch)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    application = _create_database_app(
        "production",
        tmp_path / "production.sqlite",
    )
    client = application.test_client()
    headers = {"Origin": TRUSTED_ORIGIN, "Sec-Fetch-Site": "same-origin"}

    signup = _signup(client, headers=headers)
    cookie = signup.headers["Set-Cookie"]
    current_user = client.get("/api/auth/me", headers={"Origin": TRUSTED_ORIGIN})

    assert signup.status_code == 201
    assert cookie.startswith("session=")
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    assert application.config["SESSION_COOKIE_SECURE"] is True
    assert application.config["SESSION_REFRESH_EACH_REQUEST"] is False
    assert application.config["FRONTEND_ORIGINS"] == (TRUSTED_ORIGIN,)
    assert current_user.status_code == 200
    assert "Set-Cookie" not in current_user.headers


@pytest.mark.parametrize("environment", ("development", "testing", "production"))
def test_fixed_expiry_never_reissues_an_unchanged_session_but_auth_writes_do(
    environment,
    tmp_path,
    monkeypatch,
):
    _clear_session_environment(monkeypatch)

    if environment == "production":
        _production_environment(monkeypatch)
        headers = {"Origin": TRUSTED_ORIGIN, "Sec-Fetch-Site": "same-origin"}
    else:
        headers = {}

    application = _create_database_app(
        environment,
        tmp_path / f"fixed-expiry-{environment}.sqlite",
    )
    client = application.test_client()

    signup = _signup(client, headers=headers)
    current_user = client.get("/api/auth/me", headers=headers)
    logout = client.post("/api/auth/logout", headers=headers)
    login = _login(client, headers=headers)

    assert application.config["SESSION_REFRESH_EACH_REQUEST"] is False
    assert signup.status_code == 201
    assert "Set-Cookie" in signup.headers
    assert current_user.status_code == 200
    assert "Set-Cookie" not in current_user.headers
    assert logout.status_code == 200
    assert "Set-Cookie" in logout.headers
    assert login.status_code == 200
    assert "Set-Cookie" in login.headers


def test_production_missing_secret_fails_during_app_creation(monkeypatch):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("FRONTEND_ORIGINS", TRUSTED_ORIGIN)

    with pytest.raises(RuntimeError, match="SECRET_KEY is required"):
        create_app("production")


@pytest.mark.parametrize(
    "placeholder",
    (
        "testing-secret-key",
        "test-secret-key",
        "dev-only-secret-key",
        "development-secret-key",
        "change-me-in-development",
        "CHANGE_ME_NOW",
    ),
)
def test_production_rejects_repository_placeholder_secret_variants(
    placeholder,
    monkeypatch,
):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("SECRET_KEY", placeholder)
    monkeypatch.setenv("FRONTEND_ORIGINS", TRUSTED_ORIGIN)

    with pytest.raises(RuntimeError, match="non-placeholder SECRET_KEY"):
        create_app("production")


def test_production_requires_an_environment_configured_exact_origin(monkeypatch):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("SECRET_KEY", PRODUCTION_SECRET)

    with pytest.raises(RuntimeError, match="FRONTEND_ORIGINS"):
        create_app(
            "production",
            {"FRONTEND_ORIGINS": (TRUSTED_ORIGIN,)},
        )


@pytest.mark.parametrize(
    "origins",
    (
        "http://app.example.test",
        "https://app.example.test,http://admin.example.test",
    ),
)
def test_production_rejects_non_https_origins(origins, monkeypatch):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("SECRET_KEY", PRODUCTION_SECRET)
    monkeypatch.setenv("FRONTEND_ORIGINS", origins)

    with pytest.raises(RuntimeError, match="must use https"):
        create_app("production")


def test_config_overrides_cannot_bypass_production_security_policy(monkeypatch):
    _clear_session_environment(monkeypatch)
    _production_environment(monkeypatch)

    application = create_app(
        "production",
        {
            "DEBUG": True,
            "ENFORCE_ORIGIN_CHECKS": False,
            "ENVIRONMENT": "development",
            "FRONTEND_ORIGINS": ("https://attacker.example.test",),
            "SECRET_KEY": "testing-secret-key",
            "SESSION_COOKIE_HTTPONLY": False,
            "SESSION_COOKIE_SAMESITE": "None",
            "SESSION_COOKIE_SECURE": False,
            "SESSION_REFRESH_EACH_REQUEST": True,
            "TESTING": True,
        },
    )

    assert application.config["ENVIRONMENT"] == "production"
    assert application.config["DEBUG"] is False
    assert application.config["TESTING"] is False
    assert application.config["SECRET_KEY"] == PRODUCTION_SECRET
    assert application.config["SESSION_COOKIE_SECURE"] is True
    assert application.config["SESSION_COOKIE_HTTPONLY"] is True
    assert application.config["SESSION_COOKIE_SAMESITE"] == "Lax"
    assert application.config["SESSION_REFRESH_EACH_REQUEST"] is False
    assert application.config["ENFORCE_ORIGIN_CHECKS"] is True
    assert application.config["FRONTEND_ORIGINS"] == (TRUSTED_ORIGIN,)

    rejected = application.test_client().post(
        "/api/auth/logout",
        headers={
            "Origin": "https://attacker.example.test",
            "Sec-Fetch-Site": "same-origin",
        },
    )
    assert rejected.status_code == 403
    assert rejected.get_json()["error"]["code"] == "csrf_origin_rejected"


def test_proxy_headers_are_trusted_only_after_explicit_opt_in(monkeypatch):
    _clear_session_environment(monkeypatch)
    default_application = create_app("testing")
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    ambient_application = create_app("testing")
    explicit_application = create_app(
        "testing",
        {"TRUST_PROXY_HEADERS": True},
    )

    assert not isinstance(default_application.wsgi_app, ProxyFix)
    assert not isinstance(ambient_application.wsgi_app, ProxyFix)
    assert isinstance(explicit_application.wsgi_app, ProxyFix)


def test_invalid_development_boolean_configuration_fails_clearly(monkeypatch):
    _clear_session_environment(monkeypatch)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "sometimes")

    with pytest.raises(ValueError, match="must be true or false"):
        create_app("development")
