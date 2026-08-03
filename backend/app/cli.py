from pathlib import Path

import click
from flask_migrate import upgrade

from app.extensions import db
from app.models import Wine


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
