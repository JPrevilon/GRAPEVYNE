from flask import Flask

from app.cli import register_cli_commands
from app.config import get_config
from app.errors import register_error_handlers
from app.extensions import db, migrate
from app.routes import auth_bp, cellar_bp, health_bp, wines_bp
from app.security import configure_request_security


def create_app(config_name=None, config_overrides=None):
    app = Flask(__name__)
    selected_config = get_config(config_name)
    app.config.from_object(selected_config)
    selected_environment = app.config["ENVIRONMENT"]
    production_policy = None

    if selected_environment == "production":
        production_policy = {
            "DEBUG": False,
            "ENFORCE_ORIGIN_CHECKS": True,
            "ENVIRONMENT": "production",
            "FRONTEND_ORIGINS": app.config["FRONTEND_ORIGINS"],
            "SECRET_KEY": app.config["SECRET_KEY"],
            "SESSION_COOKIE_HTTPONLY": True,
            "SESSION_COOKIE_SAMESITE": "Lax",
            "SESSION_COOKIE_SECURE": True,
            "SESSION_REFRESH_EACH_REQUEST": False,
            "TESTING": False,
        }

    if config_overrides:
        app.config.from_mapping(config_overrides)

    app.config["ENVIRONMENT"] = selected_environment
    app.config["SESSION_REFRESH_EACH_REQUEST"] = False

    if production_policy:
        app.config.update(production_policy)

    configure_request_security(app)

    db.init_app(app)
    migrate.init_app(app, db)

    from app import models  # noqa: F401

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(cellar_bp, url_prefix="/api/cellar")
    app.register_blueprint(wines_bp, url_prefix="/api/wines")

    register_error_handlers(app)
    register_cli_commands(app)

    return app
