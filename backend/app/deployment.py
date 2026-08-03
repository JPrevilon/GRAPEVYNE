from sqlalchemy import text

from app.extensions import db


DEPLOYMENT_SENTINEL_QUERY = text(
    "SELECT current_setting('grapevyne.deployment_sentinel', true)"
)


def database_deployment_sentinel():
    """Read the non-secret safety marker from the active database connection."""
    return db.session.scalar(DEPLOYMENT_SENTINEL_QUERY)
