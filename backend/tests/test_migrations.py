from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa

from app import create_app
from app.extensions import db

from conftest import TEST_PASSWORD


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIRECTORY = BACKEND_ROOT / "migrations"
BASELINE_REVISION = "0001_prompt07_baseline"
MEMORY_REVISION = "0002_prompt08_cellar_memories"
MEMORY_COLUMNS = {
    "memory_title",
    "tasted_on",
    "location",
    "pairing",
    "opened_with",
    "would_buy_again",
}
LEGACY_COLUMN_NAMES = {
    "users": (
        "id",
        "name",
        "email",
        "password_hash",
        "created_at",
        "updated_at",
    ),
    "wines": (
        "id",
        "external_api_id",
        "source",
        "name",
        "winery",
        "varietal",
        "region",
        "country",
        "vintage",
        "description",
        "image_url",
        "average_rating",
        "price_cents",
        "created_at",
        "updated_at",
    ),
    "cellar_entries": (
        "id",
        "user_id",
        "wine_id",
        "user_rating",
        "notes",
        "favorite",
        "tags",
        "occasion",
        "status",
        "saved_at",
        "created_at",
        "updated_at",
    ),
}


def _create_isolated_app(database_path):
    return create_app(
        "testing",
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        },
    )


def _run_db_command(app, command, revision=None, *, sql=False):
    arguments = [
        "db",
        command,
        "--directory",
        str(MIGRATIONS_DIRECTORY),
    ]
    if sql:
        arguments.append("--sql")
    if revision is not None:
        arguments.append(revision)

    result = app.test_cli_runner().invoke(args=arguments)
    assert result.exit_code == 0, (
        f"flask {' '.join(arguments)} failed\n{result.output}\n"
        f"{result.exception!r}"
    )
    return result.output


def _revision(app):
    with app.app_context():
        return db.session.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalar_one()


def _seed_prompt07_rows(app):
    recorded_at = datetime(2024, 2, 29, 19, 45, tzinfo=timezone.utc)

    with app.app_context():
        metadata = sa.MetaData()
        users = sa.Table("users", metadata, autoload_with=db.engine)
        wines = sa.Table("wines", metadata, autoload_with=db.engine)
        cellar_entries = sa.Table(
            "cellar_entries", metadata, autoload_with=db.engine
        )

        with db.engine.begin() as connection:
            connection.execute(
                users.insert(),
                {
                    "id": 101,
                    "name": "Legacy Member",
                    "email": "legacy-member@example.test",
                    "password_hash": "legacy-password-hash",
                    "created_at": recorded_at,
                    "updated_at": recorded_at,
                },
            )
            connection.execute(
                wines.insert(),
                {
                    "id": 202,
                    "external_api_id": "legacy-canonical-wine",
                    "source": "mock",
                    "name": "Legacy Canonical Wine",
                    "winery": "Legacy Estate",
                    "varietal": "Pinot Noir",
                    "region": "Willamette Valley",
                    "country": "United States",
                    "vintage": "2021",
                    "description": "Accepted Prompt 07 source data.",
                    "image_url": "/images/wines/legacy.png",
                    "average_rating": Decimal("4.50"),
                    "price_cents": 5400,
                    "created_at": recorded_at,
                    "updated_at": recorded_at,
                },
            )
            connection.execute(
                cellar_entries.insert(),
                {
                    "id": 303,
                    "user_id": 101,
                    "wine_id": 202,
                    "user_rating": 5,
                    "notes": "Legacy private note",
                    "favorite": True,
                    "tags": ["legacy", "dinner"],
                    "occasion": "dinner",
                    "status": "tasted",
                    "saved_at": recorded_at,
                    "created_at": recorded_at,
                    "updated_at": recorded_at,
                },
            )


def _legacy_snapshot(app):
    snapshot = {}

    with app.app_context():
        metadata = sa.MetaData()
        metadata.reflect(bind=db.engine)

        with db.engine.connect() as connection:
            for table_name, column_names in LEGACY_COLUMN_NAMES.items():
                table = metadata.tables[table_name]
                row = connection.execute(
                    sa.select(*(table.c[name] for name in column_names))
                ).mappings().one()
                snapshot[table_name] = dict(row)

    return snapshot


def _prepare_unversioned_prompt07_database(app):
    _run_db_command(app, "upgrade", BASELINE_REVISION)
    _seed_prompt07_rows(app)
    before = _legacy_snapshot(app)

    with app.app_context(), db.engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE alembic_version")

    return before


def _stamp_and_upgrade_existing_database(app):
    _run_db_command(app, "stamp", BASELINE_REVISION)
    assert _revision(app) == BASELINE_REVISION
    _run_db_command(app, "upgrade", MEMORY_REVISION)
    assert _revision(app) == MEMORY_REVISION


def _assert_accepted_core_schema(app):
    with app.app_context():
        inspector = sa.inspect(db.engine)
        assert {
            index["name"] for index in inspector.get_indexes("users")
        } == {"ix_users_email"}
        assert next(
            index
            for index in inspector.get_indexes("users")
            if index["name"] == "ix_users_email"
        )["unique"]
        assert {
            constraint["name"]
            for constraint in inspector.get_unique_constraints("wines")
        } == {"uq_wines_source_external_api_id"}
        assert {
            constraint["name"]
            for constraint in inspector.get_unique_constraints("cellar_entries")
        } == {"uq_cellar_entries_user_wine"}
        assert {
            constraint["name"]
            for constraint in inspector.get_check_constraints("cellar_entries")
        } == {
            "ck_cellar_entries_status",
            "ck_cellar_entries_user_rating_range",
        }
        assert {
            index["name"] for index in inspector.get_indexes("cellar_entries")
        } == {
            "ix_cellar_entries_user_id",
            "ix_cellar_entries_wine_id",
        }
        assert {
            tuple(foreign_key["constrained_columns"])
            for foreign_key in inspector.get_foreign_keys("cellar_entries")
        } == {("user_id",), ("wine_id",)}


def test_migration_history_builds_a_fresh_database(tmp_path):
    app = _create_isolated_app(tmp_path / "fresh.sqlite")

    _run_db_command(app, "upgrade", "head")

    with app.app_context():
        inspector = sa.inspect(db.engine)
        assert set(inspector.get_table_names()) == {
            "alembic_version",
            "cellar_entries",
            "users",
            "wines",
        }
        columns = {
            column["name"]: column
            for column in inspector.get_columns("cellar_entries")
        }
        assert MEMORY_COLUMNS <= set(columns)
        assert all(columns[name]["nullable"] for name in MEMORY_COLUMNS)
        assert isinstance(columns["memory_title"]["type"], sa.String)
        assert columns["memory_title"]["type"].length == 160
        for name in ("location", "pairing", "opened_with"):
            assert isinstance(columns[name]["type"], sa.String)
            assert columns[name]["type"].length == 240
        assert isinstance(columns["tasted_on"]["type"], sa.Date)
        assert isinstance(columns["would_buy_again"]["type"], sa.Boolean)

    assert _revision(app) == MEMORY_REVISION
    _assert_accepted_core_schema(app)


def test_init_db_is_an_explicit_migration_command(tmp_path):
    app = _create_isolated_app(tmp_path / "init-command.sqlite")

    result = app.test_cli_runner().invoke(args=["init-db"])

    assert result.exit_code == 0, f"{result.output}\n{result.exception!r}"
    assert "Database migrations applied." in result.output
    assert _revision(app) == MEMORY_REVISION


def test_fresh_migrated_schema_matches_models_and_supports_memory_api(tmp_path):
    app = _create_isolated_app(tmp_path / "migrated-api.sqlite")
    _run_db_command(app, "upgrade", "head")
    _run_db_command(app, "check")
    client = app.test_client()

    signup = client.post(
        "/api/auth/signup",
        json={
            "name": "Migrated Member",
            "email": "migrated-member@example.test",
            "password": TEST_PASSWORD,
        },
    )
    assert signup.status_code == 201

    created = client.post(
        "/api/cellar",
        json={
            "externalWineId": "mock-argyle-reserve-pinot-noir-2021",
            "memoryTitle": "Migration dinner",
            "tastedOn": "2024-02-29",
            "location": "At home",
            "pairing": "Mushroom risotto",
            "openedWith": "Family",
            "wouldBuyAgain": True,
        },
    )
    assert created.status_code == 201
    entry_id = created.get_json()["data"]["entry"]["id"]

    updated = client.patch(
        f"/api/cellar/{entry_id}",
        json={"wouldBuyAgain": False, "memoryTitle": "Migration supper"},
    )
    refreshed = client.get(f"/api/cellar/{entry_id}")

    assert updated.status_code == refreshed.status_code == 200
    entry = refreshed.get_json()["data"]["entry"]
    assert entry["memoryTitle"] == "Migration supper"
    assert entry["tastedOn"] == "2024-02-29"
    assert entry["wouldBuyAgain"] is False


def test_existing_unversioned_database_stamps_and_upgrades_without_data_loss(
    tmp_path,
):
    app = _create_isolated_app(tmp_path / "existing.sqlite")
    before = _prepare_unversioned_prompt07_database(app)

    _stamp_and_upgrade_existing_database(app)

    after = _legacy_snapshot(app)
    assert after == before

    with app.app_context():
        metadata = sa.MetaData()
        cellar_entries = sa.Table(
            "cellar_entries", metadata, autoload_with=db.engine
        )
        memory_columns = [cellar_entries.c[name] for name in sorted(MEMORY_COLUMNS)]

        with db.engine.begin() as connection:
            old_memory = connection.execute(
                sa.select(*memory_columns).where(cellar_entries.c.id == 303)
            ).mappings().one()
            assert all(value is None for value in old_memory.values())

            connection.execute(
                cellar_entries.update()
                .where(cellar_entries.c.id == 303)
                .values(
                    memory_title="First snow dinner",
                    tasted_on=date(2024, 2, 29),
                    location="Brooklyn, New York",
                    pairing="Mushroom risotto",
                    opened_with="Family",
                    would_buy_again=False,
                )
            )
            saved_memory = connection.execute(
                sa.select(*memory_columns).where(cellar_entries.c.id == 303)
            ).mappings().one()

        assert saved_memory["memory_title"] == "First snow dinner"
        assert saved_memory["tasted_on"] == date(2024, 2, 29)
        assert saved_memory["location"] == "Brooklyn, New York"
        assert saved_memory["pairing"] == "Mushroom risotto"
        assert saved_memory["opened_with"] == "Family"
        assert saved_memory["would_buy_again"] is False


def test_downgrade_removes_only_memory_columns_and_preserves_core_rows(tmp_path):
    app = _create_isolated_app(tmp_path / "downgrade.sqlite")
    before = _prepare_unversioned_prompt07_database(app)
    _stamp_and_upgrade_existing_database(app)

    _run_db_command(app, "downgrade", BASELINE_REVISION)

    assert _revision(app) == BASELINE_REVISION
    assert _legacy_snapshot(app) == before
    _assert_accepted_core_schema(app)

    with app.app_context():
        inspector = sa.inspect(db.engine)
        column_names = {
            column["name"]
            for column in inspector.get_columns("cellar_entries")
        }
        assert MEMORY_COLUMNS.isdisjoint(column_names)

        metadata = sa.MetaData()
        cellar_entries = sa.Table(
            "cellar_entries", metadata, autoload_with=db.engine
        )
        with db.engine.begin() as connection:
            connection.execute(
                cellar_entries.update()
                .where(cellar_entries.c.id == 303)
                .values(notes="Core row remains writable after rollback")
            )
            note = connection.execute(
                sa.select(cellar_entries.c.notes).where(
                    cellar_entries.c.id == 303
                )
            ).scalar_one()
        assert note == "Core row remains writable after rollback"


def test_creating_and_serving_the_app_does_not_run_migrations(tmp_path):
    database_path = tmp_path / "startup.sqlite"
    app = _create_isolated_app(database_path)

    response = app.test_client().get("/api/health")

    assert response.status_code == 200
    with app.app_context():
        assert sa.inspect(db.engine).get_table_names() == []


def test_memory_revision_renders_postgresql_upgrade_and_downgrade_sql():
    app = create_app(
        "testing",
        {
            "SQLALCHEMY_DATABASE_URI": (
                "postgresql+psycopg://migration-render:unused@"
                "127.0.0.1/grapevyne_migration_render"
            ),
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        },
    )

    upgrade_sql = _run_db_command(
        app,
        "upgrade",
        f"{BASELINE_REVISION}:{MEMORY_REVISION}",
        sql=True,
    )
    downgrade_sql = _run_db_command(
        app,
        "downgrade",
        f"{MEMORY_REVISION}:{BASELINE_REVISION}",
        sql=True,
    )

    normalized_upgrade = " ".join(upgrade_sql.lower().split())
    normalized_downgrade = " ".join(downgrade_sql.lower().split())
    expected_upgrade_fragments = (
        "add column memory_title varchar(160)",
        "add column tasted_on date",
        "add column location varchar(240)",
        "add column pairing varchar(240)",
        "add column opened_with varchar(240)",
        "add column would_buy_again boolean",
    )

    for fragment in expected_upgrade_fragments:
        assert fragment in normalized_upgrade
    for column_name in MEMORY_COLUMNS:
        assert f"drop column {column_name}" in normalized_downgrade
