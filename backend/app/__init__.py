from flask import Flask
from flask_cors import CORS

from app.cli import register_cli_commands
from app.config import get_config
from app.errors import register_error_handlers
from app.extensions import db, migrate
from app.routes import auth_bp, cellar_bp, health_bp, wines_bp


def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}},
        supports_credentials=True,
    )

    from app import models  # noqa: F401

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(cellar_bp, url_prefix="/api/cellar")
    app.register_blueprint(wines_bp, url_prefix="/api/wines")

    register_error_handlers(app)
    register_cli_commands(app)

    return app
