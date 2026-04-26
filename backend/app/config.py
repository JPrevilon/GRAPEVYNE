import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-key")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/grapevyne",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            os.getenv(
                "FRONTEND_ORIGIN",
                "http://localhost:5173,http://127.0.0.1:5173",
            ),
        ).split(",")
        if origin.strip()
    ]
    JSON_SORT_KEYS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    PERMANENT_SESSION_LIFETIME = timedelta(
        days=int(os.getenv("SESSION_LIFETIME_DAYS", "7"))
    )


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL",
        "sqlite:///:memory:",
    )


class ProductionConfig(BaseConfig):
    DEBUG = False


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(config_name=None):
    selected = config_name or os.getenv("FLASK_ENV", "development")
    return CONFIG_BY_NAME.get(selected, DevelopmentConfig)
