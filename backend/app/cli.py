import os
from pathlib import Path

import click
from flask import current_app
from flask_migrate import upgrade
from sqlalchemy import delete, func, select
from sqlalchemy.engine import make_url

from app.config import normalize_database_url, validate_deployment_database_sentinel
from app.deployment import database_deployment_sentinel
from app.extensions import db
from app.models import CellarEntry, User, Wine


SEED_WINES = [
    {
        "external_api_id": "seed-argyle-pinot-noir",
        "source": "seed",
        "name": "Reserve Pinot Noir",
        "winery": "Argyle",
        "varietal": "Pinot Noir",
        "region": "Willamette Valley",
        "country": "United States",
        "vintage": "2021",
        "description": "A graceful red with bright cherry, spice, and soft earth.",
        "average_rating": 4.3,
        "price_cents": 4200,
    },
    {
        "external_api_id": "seed-frog-leap-sauvignon-blanc",
        "source": "seed",
        "name": "Estate Sauvignon Blanc",
        "winery": "Frog's Leap",
        "varietal": "Sauvignon Blanc",
        "region": "Napa Valley",
        "country": "United States",
        "vintage": "2022",
        "description": "Crisp citrus, mineral lift, and a clean dinner-table finish.",
        "average_rating": 4.1,
        "price_cents": 3000,
    },
    {
        "external_api_id": "seed-rioja-reserva",
        "source": "seed",
        "name": "Rioja Reserva",
        "winery": "La Rioja Alta",
        "varietal": "Tempranillo",
        "region": "Rioja",
        "country": "Spain",
        "vintage": "2018",
        "description": "Layered red fruit, leather, cedar, and polished structure.",
        "average_rating": 4.5,
        "price_cents": 5200,
    },
]

MIGRATIONS_DIRECTORY = Path(__file__).resolve().parents[1] / "migrations"
PREVIEW_E2E_EMAIL_PATTERN = "e2e-%@example.test"


def _require_preview_cleanup_database_url():
    raw_database_url = os.getenv("DATABASE_URL")

    try:
        environment_url = make_url(normalize_database_url(raw_database_url))
        configured_url = make_url(current_app.config["SQLALCHEMY_DATABASE_URI"])
    except (KeyError, TypeError, ValueError):
        raise click.ClickException(
            "Cleanup requires an explicit valid DATABASE_URL."
        ) from None

    if environment_url.get_backend_name() != "postgresql":
        raise click.ClickException("Cleanup requires PostgreSQL DATABASE_URL.")

    ssl_mode = environment_url.query.get("sslmode")
    if isinstance(ssl_mode, tuple):
        ssl_mode = ssl_mode[-1]
    if not isinstance(ssl_mode, str) or ssl_mode.lower() not in {
        "require",
        "verify-ca",
        "verify-full",
    }:
        raise click.ClickException(
            "Cleanup requires an encrypted PostgreSQL DATABASE_URL."
        )

    if environment_url != configured_url:
        raise click.ClickException(
            "Cleanup requires the application connection to match DATABASE_URL."
        )


def _count_entries_for_user_ids(user_ids):
    if not user_ids:
        return 0

    return db.session.scalar(
        select(func.count(CellarEntry.id)).where(CellarEntry.user_id.in_(user_ids))
    ) or 0


def register_cli_commands(app):
    @app.cli.command("init-db")
    def init_db():
        """Apply tracked database migrations for local development."""
        upgrade(directory=str(MIGRATIONS_DIRECTORY), revision="head")
        click.echo("Database migrations applied.")

    @app.cli.command("seed-demo-data")
    def seed_demo_data():
        """Insert a small set of demo wines."""
        created_count = 0

        for wine_data in SEED_WINES:
            existing = Wine.query.filter_by(
                source=wine_data["source"],
                external_api_id=wine_data["external_api_id"],
            ).first()

            if existing:
                continue

            db.session.add(Wine(**wine_data))
            created_count += 1

        db.session.commit()
        click.echo(f"Seeded {created_count} demo wines.")

    @app.cli.command("cleanup-preview-e2e")
    @click.option("--sentinel", required=True)
    def cleanup_preview_e2e(sentinel):
        """Delete only disposable hosted-E2E users from a verified Preview DB."""
        _require_preview_cleanup_database_url()

        try:
            expected_sentinel = validate_deployment_database_sentinel(
                sentinel,
                "preview",
            )
        except ValueError:
            raise click.ClickException(
                "Cleanup requires a valid grapevyne-preview-* sentinel."
            ) from None

        try:
            actual_sentinel = database_deployment_sentinel()
        except Exception:
            db.session.rollback()
            raise click.ClickException(
                "Cleanup could not verify the Preview database sentinel."
            ) from None

        if actual_sentinel != expected_sentinel:
            db.session.rollback()
            raise click.ClickException(
                "Cleanup refused because the database sentinel does not match."
            )

        try:
            target_user_ids = list(
                db.session.scalars(
                    select(User.id).where(User.email.like(PREVIEW_E2E_EMAIL_PATTERN))
                )
            )
            user_count = len(target_user_ids)
            entry_count = _count_entries_for_user_ids(target_user_ids)

            if target_user_ids:
                db.session.execute(
                    delete(CellarEntry).where(
                        CellarEntry.user_id.in_(target_user_ids)
                    )
                )
                db.session.execute(delete(User).where(User.id.in_(target_user_ids)))

            db.session.commit()

            remaining_users = db.session.scalar(
                select(func.count(User.id)).where(
                    User.email.like(PREVIEW_E2E_EMAIL_PATTERN)
                )
            ) or 0
            remaining_entries = _count_entries_for_user_ids(target_user_ids)
        except Exception:
            db.session.rollback()
            raise click.ClickException("Preview E2E cleanup failed.") from None

        if remaining_users or remaining_entries:
            raise click.ClickException("Preview E2E cleanup verification failed.")

        click.echo(f"users={user_count} cellar_entries={entry_count}")
