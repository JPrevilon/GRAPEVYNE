from sqlalchemy import text

from app.extensions import db


DEPLOYMENT_SENTINEL_QUERY = text(
    """
    SELECT pg_catalog.shobj_description(database.oid, 'pg_database')
    FROM pg_catalog.pg_database AS database
    WHERE database.datname = pg_catalog.current_database()
    """
)


def database_deployment_sentinel():
    """Read the non-secret safety marker from the active database connection."""
    return db.session.scalar(DEPLOYMENT_SENTINEL_QUERY)
