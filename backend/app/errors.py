from http import HTTPStatus

from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from app.extensions import db
from app.utils.responses import error_response


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        status = error.code or 500
        code = error.name.lower().replace(" ", "_")
        message = error.description or HTTPStatus(status).phrase

        return error_response(message, status=status, code=code)

    @app.errorhandler(SQLAlchemyError)
    def handle_database_exception(error):
        db.session.rollback()
        current_app.logger.exception("Database error: %s", error)

        return error_response(
            "A database error occurred.",
            status=500,
            code="database_error",
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        if current_app.config.get("DEBUG"):
            raise error

        current_app.logger.exception("Unexpected error: %s", error)
        return error_response(
            "An unexpected error occurred.",
            status=500,
            code="internal_server_error",
        )

