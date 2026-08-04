import pytest
from sqlalchemy.pool import NullPool

from app import create_app
from app.config import (
    normalize_database_url,
    validate_deployment_database_sentinel,
    validate_vercel_environment,
)


PRODUCTION_SECRET = "-".join(("production", "configuration", "fixture"))
COMMIT_HOST = "grapevyne-a1b2c3-joshuaprevilon13.vercel.app"
BRANCH_HOST = "grapevyne-git-feat-grapevyne-cinematic-v2.vercel.app"
PROJECT_HOST = "grapevyne.vercel.app"
PREVIEW_SENTINEL = "grapevyne-preview-prompt10a"
VERCEL_ENVIRONMENT_KEYS = (
    "DATABASE_URL",
    "DEPLOYMENT_DATABASE_SENTINEL",
    "FRONTEND_ORIGIN",
    "FRONTEND_ORIGINS",
    "SECRET_KEY",
    "VERCEL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "VERCEL_ENV",
)


def _clear_deployment_environment(monkeypatch):
    for key in VERCEL_ENVIRONMENT_KEYS:
        monkeypatch.delenv(key, raising=False)


def _vercel_production_environment(monkeypatch, database_url=None):
    _clear_deployment_environment(monkeypatch)
    monkeypatch.setenv("SECRET_KEY", PRODUCTION_SECRET)
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "preview")
    monkeypatch.setenv("VERCEL_URL", COMMIT_HOST)
    monkeypatch.setenv("DEPLOYMENT_DATABASE_SENTINEL", PREVIEW_SENTINEL)

    if database_url is not None:
        monkeypatch.setenv("DATABASE_URL", database_url)


@pytest.mark.parametrize(
    ("source", "expected"),
    (
        (
            "postgres://member:secret@db.example.test/preview?sslmode=require",
            "postgresql+psycopg://member:secret@db.example.test/preview?sslmode=require",
        ),
        (
            "postgresql://member:secret@db.example.test/preview",
            "postgresql+psycopg://member:secret@db.example.test/preview",
        ),
        (
            "postgresql+psycopg://member:secret@db.example.test/preview",
            "postgresql+psycopg://member:secret@db.example.test/preview",
        ),
        ("sqlite:///:memory:", "sqlite:///:memory:"),
    ),
)
def test_database_url_normalization_selects_psycopg_without_losing_options(
    source,
    expected,
):
    assert normalize_database_url(source) == expected


def test_hosted_environment_and_database_sentinel_validation():
    assert validate_vercel_environment("preview") == "preview"
    assert validate_vercel_environment("production") == "production"
    assert (
        validate_deployment_database_sentinel(PREVIEW_SENTINEL, "preview")
        == PREVIEW_SENTINEL
    )


def test_vercel_production_exposes_matching_production_database_identity(monkeypatch):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/production?sslmode=require",
    )
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv(
        "DEPLOYMENT_DATABASE_SENTINEL",
        "grapevyne-production-prompt10b",
    )

    application = create_app("production")

    assert application.config["VERCEL_ENV"] == "production"
    assert application.config["DEPLOYMENT_DATABASE_SENTINEL"] == (
        "grapevyne-production-prompt10b"
    )


@pytest.mark.parametrize("environment", (None, "", "development", "PREVIEW"))
def test_vercel_production_rejects_unknown_deployment_environment(
    environment,
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )

    if environment is None:
        monkeypatch.delenv("VERCEL_ENV")
    else:
        monkeypatch.setenv("VERCEL_ENV", environment)

    with pytest.raises(ValueError, match="VERCEL_ENV"):
        create_app("production")


@pytest.mark.parametrize(
    "sentinel",
    (
        None,
        "",
        "grapevyne-production-prompt10a",
        "grapevyne-preview-",
        "grapevyne-preview-unsafe/value",
        "GRAPEVYNE-preview-prompt10a",
    ),
)
def test_vercel_production_rejects_missing_malformed_or_mismatched_sentinel(
    sentinel,
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )

    if sentinel is None:
        monkeypatch.delenv("DEPLOYMENT_DATABASE_SENTINEL")
    else:
        monkeypatch.setenv("DEPLOYMENT_DATABASE_SENTINEL", sentinel)

    with pytest.raises(ValueError, match="DEPLOYMENT_DATABASE_SENTINEL"):
        create_app("production")


def test_vercel_production_requires_an_explicit_postgres_database(monkeypatch):
    _vercel_production_environment(monkeypatch)

    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        create_app("production")


@pytest.mark.parametrize(
    "database_url",
    (
        "sqlite:////tmp/not-allowed.sqlite",
        "mysql://member:secret@db.example.test/preview",
    ),
)
def test_vercel_production_rejects_non_postgres_databases(
    database_url,
    monkeypatch,
):
    _vercel_production_environment(monkeypatch, database_url)

    with pytest.raises(RuntimeError, match="requires PostgreSQL") as error:
        create_app("production")

    assert "member:secret" not in str(error.value)


@pytest.mark.parametrize("sslmode", ("disable", "allow", "prefer"))
def test_vercel_production_rejects_unencrypted_postgres_modes(
    sslmode,
    monkeypatch,
):
    database_url = (
        "postgresql://member:private-value@db.example.test/preview"
        f"?sslmode={sslmode}"
    )
    _vercel_production_environment(monkeypatch, database_url)

    with pytest.raises(RuntimeError, match="encrypted SSL") as error:
        create_app("production")

    assert "private-value" not in str(error.value)


def test_vercel_production_uses_a_null_pool_and_requires_ssl_by_default(
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgres://member:secret@db.example.test/preview",
    )
    application = create_app("production")

    assert application.config["SQLALCHEMY_DATABASE_URI"].startswith(
        "postgresql+psycopg://"
    )
    assert application.config["SQLALCHEMY_ENGINE_OPTIONS"] == {
        "connect_args": {"sslmode": "require"},
        "poolclass": NullPool,
    }
    assert application.config["IS_VERCEL"] is True
    assert application.config["VERCEL_ENV"] == "preview"
    assert application.config["DEPLOYMENT_DATABASE_SENTINEL"] == PREVIEW_SENTINEL


def test_vercel_production_preserves_provider_verify_full_ssl_mode(monkeypatch):
    _vercel_production_environment(
        monkeypatch,
        (
            "postgresql://member:secret@db.example.test/preview"
            "?sslmode=verify-full&channel_binding=require"
        ),
    )
    application = create_app("production")

    assert application.config["SQLALCHEMY_ENGINE_OPTIONS"] == {
        "poolclass": NullPool
    }


def test_exact_vercel_system_origins_are_additive_and_attacker_origin_is_rejected(
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )
    monkeypatch.setenv("VERCEL_BRANCH_URL", BRANCH_HOST)
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", PROJECT_HOST)
    application = create_app(
        "production",
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        },
    )
    client = application.test_client()

    assert application.config["FRONTEND_ORIGINS"] == (
        f"https://{COMMIT_HOST}",
        f"https://{BRANCH_HOST}",
        f"https://{PROJECT_HOST}",
    )

    for hostname in (COMMIT_HOST, BRANCH_HOST, PROJECT_HOST):
        accepted = client.post(
            "/api/auth/logout",
            headers={
                "Origin": f"https://{hostname}",
                "Sec-Fetch-Site": "same-origin",
            },
        )
        assert accepted.status_code == 200
        assert accepted.headers["Access-Control-Allow-Origin"] == (
            f"https://{hostname}"
        )

    rejected = client.post(
        "/api/auth/logout",
        headers={
            "Origin": "https://attacker-project.vercel.app",
            "Sec-Fetch-Site": "same-origin",
        },
    )
    assert rejected.status_code == 403
    assert rejected.get_json()["error"]["code"] == "csrf_origin_rejected"
    assert "Access-Control-Allow-Origin" not in rejected.headers


@pytest.mark.parametrize(
    "malformed_hostname",
    (
        "//grapevyne.example.test",
        "http://grapevyne.example.test",
        "https://grapevyne.example.test",
        "grapevyne.vercel.app:443",
        "grapevyne.vercel.app/path",
        "grapevyne.vercel.app?query=yes",
        "*.vercel.app",
        "vercel.app",
        "not-a-vercel-host.example.test",
    ),
)
def test_malformed_or_untrusted_vercel_url_metadata_fails_closed(
    malformed_hostname,
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )
    monkeypatch.setenv("VERCEL_URL", malformed_hostname)

    with pytest.raises(ValueError, match="Vercel"):
        create_app("production")


def test_custom_production_origin_requires_explicit_or_trusted_metadata(
    monkeypatch,
):
    _vercel_production_environment(
        monkeypatch,
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://cellar.example.test")
    monkeypatch.setenv(
        "VERCEL_PROJECT_PRODUCTION_URL",
        "www.grapevyne.example",
    )
    application = create_app("production")

    assert application.config["FRONTEND_ORIGINS"] == (
        "https://cellar.example.test",
        f"https://{COMMIT_HOST}",
        "https://www.grapevyne.example",
    )


def test_vercel_metadata_is_ignored_without_the_vercel_trust_marker(monkeypatch):
    _clear_deployment_environment(monkeypatch)
    monkeypatch.setenv("SECRET_KEY", PRODUCTION_SECRET)
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://member:secret@db.example.test/preview?sslmode=require",
    )
    monkeypatch.setenv("VERCEL_URL", COMMIT_HOST)

    with pytest.raises(RuntimeError, match="FRONTEND_ORIGINS"):
        create_app("production")


def test_deployment_configuration_errors_never_echo_environment_secrets(
    monkeypatch,
):
    marker = "DO-NOT-PRINT-THIS-DATABASE-CREDENTIAL"
    _vercel_production_environment(
        monkeypatch,
        f"sqlite:///{marker}",
    )

    with pytest.raises(RuntimeError) as error:
        create_app("production")

    assert marker not in str(error.value)
