import pytest

from app import cli as cli_module
from app import create_app
from app import deployment as deployment_module
from app import routes
from app.extensions import db
from app.models import CellarEntry, User, Wine


PREVIEW_SENTINEL = "grapevyne-preview-focused-test"
POSTGRES_DATABASE_URL = (
    "postgresql+psycopg://preview:credential@db.example.test/grapevyne"
    "?sslmode=require"
)


def test_deployment_sentinel_uses_the_postgres_database_comment():
    query = str(deployment_module.DEPLOYMENT_SENTINEL_QUERY)

    assert "shobj_description" in query
    assert "pg_database" in query
    assert "current_database()" in query
    assert query.count("pg_catalog.") == 3
    assert "current_setting" not in query


def _hosted_health_app(database_path):
    return create_app(
        "testing",
        {
            "DEPLOYMENT_DATABASE_SENTINEL": PREVIEW_SENTINEL,
            "IS_VERCEL": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
            "VERCEL_ENV": "preview",
        },
    )


def test_vercel_health_reports_verified_database_identity(tmp_path, monkeypatch):
    application = _hosted_health_app(tmp_path / "health-success.sqlite")
    monkeypatch.setattr(
        routes.health,
        "database_deployment_sentinel",
        lambda: PREVIEW_SENTINEL,
    )

    response = application.test_client().get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {
        "data": {
            "deployment": {
                "databaseSentinel": PREVIEW_SENTINEL,
                "databaseVerified": True,
                "environment": "preview",
            },
            "phase": "foundation",
            "service": "grapevyne-api",
            "status": "ok",
        }
    }


@pytest.mark.parametrize("database_sentinel", (None, "grapevyne-preview-other"))
def test_vercel_health_fails_closed_for_absent_or_mismatched_database_identity(
    database_sentinel,
    tmp_path,
    monkeypatch,
):
    application = _hosted_health_app(tmp_path / "health-mismatch.sqlite")
    monkeypatch.setattr(
        routes.health,
        "database_deployment_sentinel",
        lambda: database_sentinel,
    )

    response = application.test_client().get("/api/health")

    assert response.status_code == 503
    assert response.get_json() == {
        "error": {
            "code": "deployment_database_unverified",
            "message": "The deployment database could not be verified.",
        }
    }


def test_vercel_health_fails_closed_without_leaking_query_errors(tmp_path, monkeypatch):
    application = _hosted_health_app(tmp_path / "health-query-error.sqlite")

    def fail_query():
        raise RuntimeError("credential-bearing database failure")

    monkeypatch.setattr(routes.health, "database_deployment_sentinel", fail_query)

    response = application.test_client().get("/api/health")

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "deployment_database_unverified"
    assert "credential-bearing" not in response.get_data(as_text=True)


def _seed_cleanup_rows(application):
    with application.app_context():
        disposable = User(
            name="Disposable Hosted Account",
            email="e2e-hosted-owner@example.test",
        )
        disposable.set_password("disposable-preview-password")
        retained = User(name="Retained Member", email="member@example.test")
        retained.set_password("retained-member-password")
        near_match = User(
            name="Near Match",
            email="e2e-preserve@example.test.invalid",
        )
        near_match.set_password("retained-near-match-password")
        wine = Wine(
            source="cleanup-test",
            external_api_id="cleanup-test-cabernet",
            name="Cleanup Test Cabernet",
        )
        db.session.add_all(
            [
                disposable,
                retained,
                near_match,
                wine,
                CellarEntry(user=disposable, wine=wine),
                CellarEntry(user=retained, wine=wine),
            ]
        )
        db.session.commit()


def _configure_cleanup_test(application, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", POSTGRES_DATABASE_URL)
    # Flask-SQLAlchemy has already created the isolated SQLite test engine. The
    # command still sees the same normalized explicit URL in application config,
    # while its query and deletion behavior remain locally testable.
    application.config["SQLALCHEMY_DATABASE_URI"] = POSTGRES_DATABASE_URL


def test_cleanup_preview_e2e_removes_only_exact_disposable_accounts(
    app,
    monkeypatch,
):
    _seed_cleanup_rows(app)
    _configure_cleanup_test(app, monkeypatch)
    monkeypatch.setattr(
        cli_module,
        "database_deployment_sentinel",
        lambda: PREVIEW_SENTINEL,
    )

    result = app.test_cli_runner().invoke(
        args=["cleanup-preview-e2e", "--sentinel", PREVIEW_SENTINEL]
    )

    assert result.exit_code == 0, result.output
    assert result.output == "users=1 cellar_entries=1\n"

    with app.app_context():
        removed_user = User.query.filter_by(
            email="e2e-hosted-owner@example.test"
        ).first()
        assert removed_user is None
        assert User.query.filter_by(email="member@example.test").one()
        assert User.query.filter_by(email="e2e-preserve@example.test.invalid").one()
        assert CellarEntry.query.count() == 1
        assert Wine.query.filter_by(external_api_id="cleanup-test-cabernet").one()


@pytest.mark.parametrize(
    "database_sentinel",
    (None, "grapevyne-preview-different-database"),
)
def test_cleanup_preview_e2e_refuses_an_absent_or_mismatched_database_sentinel(
    app,
    monkeypatch,
    database_sentinel,
):
    _seed_cleanup_rows(app)
    _configure_cleanup_test(app, monkeypatch)
    monkeypatch.setattr(
        cli_module,
        "database_deployment_sentinel",
        lambda: database_sentinel,
    )

    result = app.test_cli_runner().invoke(
        args=["cleanup-preview-e2e", "--sentinel", PREVIEW_SENTINEL]
    )

    assert result.exit_code != 0
    assert "does not match" in result.output
    with app.app_context():
        assert User.query.filter_by(email="e2e-hosted-owner@example.test").one()
        assert CellarEntry.query.count() == 2


@pytest.mark.parametrize(
    "sentinel",
    (
        "grapevyne-production-focused-test",
        "grapevyne-preview-unsafe/value",
    ),
)
def test_cleanup_preview_e2e_refuses_non_preview_sentinel(app, monkeypatch, sentinel):
    _configure_cleanup_test(app, monkeypatch)

    result = app.test_cli_runner().invoke(
        args=["cleanup-preview-e2e", "--sentinel", sentinel]
    )

    assert result.exit_code != 0
    assert "valid grapevyne-preview-* sentinel" in result.output


def test_cleanup_preview_e2e_refuses_non_postgres_database(app, monkeypatch):
    sqlite_url = app.config["SQLALCHEMY_DATABASE_URI"]
    monkeypatch.setenv("DATABASE_URL", sqlite_url)

    result = app.test_cli_runner().invoke(
        args=["cleanup-preview-e2e", "--sentinel", PREVIEW_SENTINEL]
    )

    assert result.exit_code != 0
    assert "requires PostgreSQL" in result.output


def test_cleanup_preview_e2e_refuses_unencrypted_postgres_database(
    app,
    monkeypatch,
):
    insecure_url = (
        "postgresql+psycopg://preview:credential@db.example.test/grapevyne"
        "?sslmode=prefer"
    )
    monkeypatch.setenv("DATABASE_URL", insecure_url)
    app.config["SQLALCHEMY_DATABASE_URI"] = insecure_url

    result = app.test_cli_runner().invoke(
        args=["cleanup-preview-e2e", "--sentinel", PREVIEW_SENTINEL]
    )

    assert result.exit_code != 0
    assert "requires an encrypted PostgreSQL" in result.output
