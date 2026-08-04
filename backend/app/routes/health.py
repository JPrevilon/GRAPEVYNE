from flask import Blueprint, current_app

from app.deployment import database_deployment_sentinel
from app.extensions import db
from app.utils.responses import error_response, success_response

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    data = {
        "status": "ok",
        "service": "grapevyne-api",
        "phase": "foundation",
    }

    if not current_app.config.get("IS_VERCEL"):
        return success_response(data)

    environment = current_app.config.get("VERCEL_ENV")
    expected_sentinel = current_app.config.get("DEPLOYMENT_DATABASE_SENTINEL")

    try:
        actual_sentinel = database_deployment_sentinel()
    except Exception as error:  # The public health contract must fail closed.
        _discard_database_session()
        current_app.logger.error(
            "Deployment database verification query failed (%s).",
            type(error).__name__,
        )
        return _deployment_database_error()

    if not expected_sentinel or actual_sentinel != expected_sentinel:
        _discard_database_session()
        current_app.logger.error("Deployment database verification did not match.")
        return _deployment_database_error()

    data["deployment"] = {
        "environment": environment,
        "databaseSentinel": expected_sentinel,
        "databaseVerified": True,
    }
    return success_response(data)


def _deployment_database_error():
    return error_response(
        "The deployment database could not be verified.",
        status=503,
        code="deployment_database_unverified",
    )


def _discard_database_session():
    try:
        db.session.rollback()
    except Exception:
        try:
            db.session.remove()
        except Exception:
            pass
