"""Opt-in PostgreSQL migration contract for an isolated loopback CI database.

This module deliberately does not use the ordinary SQLite test fixture. It runs
only when both ``GRAPEVYNE_POSTGRES_TESTS=1`` and an explicit
``POSTGRES_TEST_DATABASE_URL`` are present. The URL must target loopback and a
database named exactly ``grapevyne_ci`` or ``grapevyne_test``; there is no
application, development, or production database fallback.
"""

from datetime import date
import os
import re

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

from app import create_app
from app.extensions import db
from app.models import CellarEntry, User, Wine


POSTGRES_OPT_IN_ENV = "GRAPEVYNE_POSTGRES_TESTS"
POSTGRES_URL_ENV = "POSTGRES_TEST_DATABASE_URL"
POSTGRES_STAGE_ENV = "GRAPEVYNE_POSTGRES_SCHEMA_STAGE"
POSTGRES_MARKER_ENV = "POSTGRES_TEST_MARKER"
PROMPT07_REVISION = "0001_prompt07_baseline"
PROMPT08_REVISION = "0002_prompt08_cellar_memories"
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
SAFE_DATABASE_NAMES = frozenset({"grapevyne_ci", "grapevyne_test"})
MEMORY_COLUMNS = frozenset(
    {
        "location",
        "memory_title",
        "opened_with",
        "pairing",
        "tasted_on",
        "would_buy_again",
    }
)


def _validated_postgres_test_url():
    if os.getenv(POSTGRES_OPT_IN_ENV) != "1":
        pytest.skip(
            f"Set {POSTGRES_OPT_IN_ENV}=1 and {POSTGRES_URL_ENV} explicitly "
            "to run the isolated PostgreSQL contract."
        )

    raw_url = os.getenv(POSTGRES_URL_ENV)
    if not raw_url:
        pytest.fail(
            f"{POSTGRES_URL_ENV} is required when {POSTGRES_OPT_IN_ENV}=1.",
            pytrace=False,
        )

    try:
        parsed_url = make_url(raw_url)
    except (ArgumentError, TypeError, ValueError):
        pytest.fail(
            f"{POSTGRES_URL_ENV} must be a valid SQLAlchemy PostgreSQL URL.",
            pytrace=False,
        )

    database_name = (parsed_url.database or "").strip()
    if parsed_url.get_backend_name() != "postgresql":
        pytest.fail(
            f"{POSTGRES_URL_ENV} must use PostgreSQL; no fallback is allowed.",
            pytrace=False,
        )
    if (parsed_url.host or "").lower() not in LOOPBACK_HOSTS:
        pytest.fail(
            f"{POSTGRES_URL_ENV} must target a loopback-only CI service.",
            pytrace=False,
        )
    if database_name not in SAFE_DATABASE_NAMES:
        pytest.fail(
            f"{POSTGRES_URL_ENV} must name the dedicated grapevyne_ci or "
            "grapevyne_test database.",
            pytrace=False,
        )

    return raw_url, database_name


def _marker_values():
    raw_marker = os.getenv(POSTGRES_MARKER_ENV, "local-opt-in")
    marker = re.sub(r"[^a-zA-Z0-9-]+", "-", raw_marker).strip("-")[:48]
    if not marker:
        marker = "local-opt-in"
    return {
        "email": f"prompt09-postgres-{marker}@example.test",
        "external_id": f"prompt09-postgres-{marker}",
    }


def _require_stage(expected_stage):
    actual_stage = os.getenv(POSTGRES_STAGE_ENV)
    if actual_stage != expected_stage:
        pytest.fail(
            f"{POSTGRES_STAGE_ENV} must be {expected_stage!r} for this check; "
            f"received {actual_stage!r}.",
            pytrace=False,
        )


@pytest.fixture(scope="module")
def postgres_app():
    database_url, expected_database_name = _validated_postgres_test_url()
    application = create_app(
        "testing",
        {
            "SQLALCHEMY_DATABASE_URI": database_url,
            "SQLALCHEMY_ENGINE_OPTIONS": {"pool_pre_ping": True},
        },
    )

    with application.app_context():
        actual_database_name = db.session.scalar(text("SELECT current_database()"))
        if actual_database_name != expected_database_name:
            pytest.fail(
                "The connected PostgreSQL database does not match the explicit "
                "test URL.",
                pytrace=False,
            )
        yield application
        db.session.remove()
        db.engine.dispose()


def _current_revision():
    return db.session.scalar(text("SELECT version_num FROM alembic_version"))


def _cellar_columns():
    return {column["name"] for column in inspect(db.engine).get_columns("cellar_entries")}


def _remove_marker_rows(marker):
    db.session.execute(
        text(
            """
            DELETE FROM cellar_entries
            WHERE user_id IN (SELECT id FROM users WHERE email = :email)
               OR wine_id IN (
                    SELECT id FROM wines WHERE external_api_id = :external_id
                )
            """
        ),
        marker,
    )
    db.session.execute(text("DELETE FROM users WHERE email = :email"), marker)
    db.session.execute(
        text("DELETE FROM wines WHERE external_api_id = :external_id"), marker
    )
    db.session.commit()


def test_postgres_head_write_persists_memory_fields(postgres_app):
    _require_stage("head")
    marker = _marker_values()
    _remove_marker_rows(marker)

    assert _current_revision() == PROMPT08_REVISION
    assert MEMORY_COLUMNS <= _cellar_columns()

    user = User(name="Prompt 09 PostgreSQL CI", email=marker["email"])
    user.set_password("ci-only-postgres-contract-password")
    wine = Wine(
        source="prompt09-ci",
        external_api_id=marker["external_id"],
        name="PostgreSQL Contract Cabernet",
        winery="CI Fixture Estate",
        varietal="Cabernet Sauvignon",
        region="Test Valley",
        country="United States",
        vintage="2024",
        price_cents=4200,
    )
    entry = CellarEntry(
        user=user,
        wine=wine,
        user_rating=5,
        notes="Synthetic CI migration contract.",
        favorite=True,
        tags=["blackberry", "dinner"],
        occasion="dinner",
        status="tasted",
        memory_title="PostgreSQL head write",
        tasted_on=date(2026, 8, 1),
        location="CI loopback",
        pairing="steak",
        opened_with="CI runner",
        would_buy_again=True,
    )
    db.session.add_all([user, wine, entry])
    db.session.commit()
    db.session.expire_all()

    stored = (
        CellarEntry.query.join(User)
        .join(Wine)
        .filter(
            User.email == marker["email"],
            Wine.external_api_id == marker["external_id"],
        )
        .one()
    )
    assert stored.memory_title == "PostgreSQL head write"
    assert stored.tasted_on == date(2026, 8, 1)
    assert stored.location == "CI loopback"
    assert stored.pairing == "steak"
    assert stored.opened_with == "CI runner"
    assert stored.would_buy_again is True


def test_postgres_baseline_preserves_core_row_and_remains_writable(postgres_app):
    _require_stage("baseline")
    marker = _marker_values()

    assert _current_revision() == PROMPT07_REVISION
    assert MEMORY_COLUMNS.isdisjoint(_cellar_columns())

    row = db.session.execute(
        text(
            """
            SELECT ce.id, ce.user_rating, ce.notes, ce.favorite, ce.status
            FROM cellar_entries AS ce
            JOIN users AS u ON u.id = ce.user_id
            JOIN wines AS w ON w.id = ce.wine_id
            WHERE u.email = :email AND w.external_api_id = :external_id
            """
        ),
        marker,
    ).mappings().one()
    assert row["user_rating"] == 5
    assert row["favorite"] is True
    assert row["status"] == "tasted"

    db.session.execute(
        text(
            """
            UPDATE cellar_entries
            SET user_rating = 4, notes = :notes
            WHERE id = :entry_id
            """
        ),
        {
            "entry_id": row["id"],
            "notes": "Core row remained writable at the Prompt 07 baseline.",
        },
    )
    db.session.commit()


def test_postgres_reupgrade_restores_nullable_memory_schema(postgres_app):
    _require_stage("reup")
    marker = _marker_values()

    try:
        assert _current_revision() == PROMPT08_REVISION
        assert MEMORY_COLUMNS <= _cellar_columns()

        stored = (
            CellarEntry.query.join(User)
            .join(Wine)
            .filter(
                User.email == marker["email"],
                Wine.external_api_id == marker["external_id"],
            )
            .one()
        )
        assert stored.user_rating == 4
        assert stored.notes == (
            "Core row remained writable at the Prompt 07 baseline."
        )
        assert stored.memory_title is None
        assert stored.tasted_on is None
        assert stored.location is None
        assert stored.pairing is None
        assert stored.opened_with is None
        assert stored.would_buy_again is None

        stored.memory_title = "PostgreSQL re-upgrade write"
        stored.tasted_on = date(2026, 8, 2)
        stored.would_buy_again = False
        db.session.commit()
        db.session.expire_all()

        restored = db.session.get(CellarEntry, stored.id)
        assert restored.memory_title == "PostgreSQL re-upgrade write"
        assert restored.tasted_on == date(2026, 8, 2)
        assert restored.would_buy_again is False
    finally:
        db.session.rollback()
        _remove_marker_rows(marker)
