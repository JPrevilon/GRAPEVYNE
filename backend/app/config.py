import os
import re
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy.pool import NullPool


load_dotenv()

DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://postgres:postgres@localhost:5432/grapevyne"
)
DEFAULT_DEVELOPMENT_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
DEFAULT_SESSION_COOKIE_NAME = "session"
DEFAULT_SESSION_LIFETIME_DAYS = 7
VERCEL_DEPLOYMENT_HOST_KEYS = (
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
)
VERCEL_HOST_PATTERN = re.compile(
    r"(?=.{1,253}\Z)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z"
)
VERCEL_DEPLOYMENT_ENVIRONMENTS = frozenset({"preview", "production"})
DEPLOYMENT_DATABASE_SENTINEL_PATTERN = re.compile(
    r"grapevyne-(preview|production)-"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z"
)
INSECURE_PRODUCTION_SECRET_MARKERS = frozenset(
    {
        "change-me",
        "changeme",
        "dev-only",
        "development-only",
        "development-secret",
        "test-secret",
        "testing-secret",
    }
)


def _environment_value(name):
    value = os.getenv(name)
    return value.strip() if isinstance(value, str) else None


def _boolean_environment_value(name, default=False):
    value = _environment_value(name)

    if value is None or value == "":
        return default

    normalized = value.lower()

    if normalized in {"1", "true", "yes", "on"}:
        return True

    if normalized in {"0", "false", "no", "off"}:
        return False

    raise ValueError(f"{name} must be true or false.")


def _positive_integer_environment_value(name, default):
    value = _environment_value(name)

    if value is None or value == "":
        return default

    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError(f"{name} must be a positive integer.") from error

    if parsed <= 0:
        raise ValueError(f"{name} must be a positive integer.")

    return parsed


def is_insecure_production_secret(secret):
    if not secret:
        return True

    normalized = secret.strip().lower().replace("_", "-").replace(" ", "-")
    return any(
        marker in normalized for marker in INSECURE_PRODUCTION_SECRET_MARKERS
    )


def normalize_origin(origin):
    if not isinstance(origin, str):
        raise ValueError("Configured frontend origins must be strings.")

    candidate = origin.strip()

    if not candidate:
        raise ValueError("Configured frontend origins cannot be empty.")

    if "*" in candidate:
        raise ValueError("Wildcard frontend origins are not allowed with credentials.")

    try:
        parsed = urlsplit(candidate)
        port = parsed.port
    except ValueError as error:
        raise ValueError(f"Invalid frontend origin: {candidate!r}.") from error

    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(f"Invalid frontend origin: {candidate!r}.")

    scheme = parsed.scheme.lower()
    hostname = parsed.hostname.lower()

    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"

    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        port = None

    netloc = f"{hostname}:{port}" if port is not None else hostname
    return urlunsplit((scheme, netloc, "", "", ""))


def parse_origins(value):
    if value is None:
        return ()

    raw_origins = value.split(",") if isinstance(value, str) else value
    origins = []

    for raw_origin in raw_origins:
        if isinstance(raw_origin, str) and not raw_origin.strip():
            continue

        origin = normalize_origin(raw_origin)

        if origin not in origins:
            origins.append(origin)

    return tuple(origins)


def normalize_database_url(database_url):
    """Return a SQLAlchemy URL that explicitly selects the psycopg driver."""
    if not isinstance(database_url, str) or not database_url.strip():
        raise ValueError("DATABASE_URL must be a non-empty string.")

    normalized = database_url.strip()

    if normalized.startswith("postgres://"):
        return f"postgresql+psycopg://{normalized.removeprefix('postgres://')}"

    if normalized.startswith("postgresql://"):
        return (
            "postgresql+psycopg://"
            f"{normalized.removeprefix('postgresql://')}"
        )

    return normalized


def validate_vercel_environment(value):
    """Return one explicit hosted environment or fail closed."""
    if not isinstance(value, str):
        raise ValueError("VERCEL_ENV must be preview or production.")

    environment = value.strip()

    if environment not in VERCEL_DEPLOYMENT_ENVIRONMENTS:
        raise ValueError("VERCEL_ENV must be preview or production.")

    return environment


def validate_deployment_database_sentinel(value, environment):
    """Validate a non-secret database marker against its hosted environment."""
    validated_environment = validate_vercel_environment(environment)

    if not isinstance(value, str):
        raise ValueError(
            "DEPLOYMENT_DATABASE_SENTINEL must be a valid deployment marker."
        )

    sentinel = value.strip()
    match = DEPLOYMENT_DATABASE_SENTINEL_PATTERN.fullmatch(sentinel)

    if not match or match.group(1) != validated_environment:
        raise ValueError(
            "DEPLOYMENT_DATABASE_SENTINEL must match the hosted environment."
        )

    return sentinel


def normalize_vercel_hostname(value, *, allow_custom_hostname=False):
    """Validate a hostname supplied by Vercel's trusted system environment."""
    if not isinstance(value, str):
        raise ValueError("Vercel deployment hostnames must be strings.")

    hostname = value.strip().lower()

    if (
        not hostname
        or "://" in hostname
        or any(character in hostname for character in "/?#@:*[]")
        or not VERCEL_HOST_PATTERN.fullmatch(hostname)
    ):
        raise ValueError("Vercel deployment metadata contains an invalid hostname.")

    if not allow_custom_hostname and not hostname.endswith(".vercel.app"):
        raise ValueError(
            "Vercel deployment URLs must use an exact vercel.app hostname."
        )

    if hostname == "vercel.app":
        raise ValueError("A Vercel deployment hostname requires a project prefix.")

    return hostname


def trusted_vercel_origins():
    """Derive only exact HTTPS origins from authenticated Vercel metadata."""
    if not _boolean_environment_value("VERCEL", default=False):
        return ()

    origins = []

    for key in VERCEL_DEPLOYMENT_HOST_KEYS:
        value = _environment_value(key)

        if not value:
            continue

        hostname = normalize_vercel_hostname(
            value,
            allow_custom_hostname=key == "VERCEL_PROJECT_PRODUCTION_URL",
        )
        origin = f"https://{hostname}"

        if origin not in origins:
            origins.append(origin)

    return tuple(origins)


class BaseConfig:
    DEBUG = False
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_REFRESH_EACH_REQUEST = False
    MAX_CONTENT_LENGTH = 1_048_576

    def __init__(self, deterministic_browser_config=False):
        self.SECRET_KEY = _environment_value("SECRET_KEY") or "dev-only-secret-key"
        database_url = _environment_value("DATABASE_URL") or DEFAULT_DATABASE_URL
        self.SQLALCHEMY_DATABASE_URI = normalize_database_url(database_url)
        self.SQLALCHEMY_ENGINE_OPTIONS = {}
        self.IS_VERCEL = False
        self.VERCEL_ENV = None
        self.DEPLOYMENT_DATABASE_SENTINEL = None

        if deterministic_browser_config:
            self.FRONTEND_ORIGINS = DEFAULT_DEVELOPMENT_ORIGINS
            self.SESSION_COOKIE_NAME = DEFAULT_SESSION_COOKIE_NAME
            self.SESSION_COOKIE_DOMAIN = None
            self.SESSION_COOKIE_SECURE = False
            self.PERMANENT_SESSION_LIFETIME = timedelta(
                days=DEFAULT_SESSION_LIFETIME_DAYS
            )
            self.TRUST_PROXY_HEADERS = False
        else:
            self.FRONTEND_ORIGINS = parse_origins(
                _environment_value("FRONTEND_ORIGINS")
                or _environment_value("FRONTEND_ORIGIN")
                or DEFAULT_DEVELOPMENT_ORIGINS
            )
            self.SESSION_COOKIE_NAME = (
                _environment_value("SESSION_COOKIE_NAME")
                or DEFAULT_SESSION_COOKIE_NAME
            )
            self.SESSION_COOKIE_DOMAIN = (
                _environment_value("SESSION_COOKIE_DOMAIN") or None
            )
            self.SESSION_COOKIE_SECURE = _boolean_environment_value(
                "SESSION_COOKIE_SECURE", default=False
            )
            self.PERMANENT_SESSION_LIFETIME = timedelta(
                days=_positive_integer_environment_value(
                    "SESSION_LIFETIME_DAYS", DEFAULT_SESSION_LIFETIME_DAYS
                )
            )
            self.TRUST_PROXY_HEADERS = _boolean_environment_value(
                "TRUST_PROXY_HEADERS", default=False
            )
        self.ENFORCE_ORIGIN_CHECKS = False


class DevelopmentConfig(BaseConfig):
    ENVIRONMENT = "development"
    DEBUG = True


class TestingConfig(BaseConfig):
    ENVIRONMENT = "testing"
    TESTING = True

    def __init__(self):
        super().__init__(deterministic_browser_config=True)
        self.SECRET_KEY = "testing-secret-key"
        self.SQLALCHEMY_DATABASE_URI = (
            _environment_value("TEST_DATABASE_URL") or "sqlite:///:memory:"
        )
        self.SESSION_COOKIE_SECURE = False


class ProductionConfig(BaseConfig):
    ENVIRONMENT = "production"

    def __init__(self):
        production_secret = _environment_value("SECRET_KEY")

        if is_insecure_production_secret(production_secret):
            raise RuntimeError(
                "A non-placeholder SECRET_KEY is required when FLASK_ENV is production."
            )

        super().__init__()
        self.SECRET_KEY = production_secret
        configured_origins = parse_origins(
            _environment_value("FRONTEND_ORIGINS")
            or _environment_value("FRONTEND_ORIGIN")
        )
        self.FRONTEND_ORIGINS = tuple(
            dict.fromkeys((*configured_origins, *trusted_vercel_origins()))
        )

        if _boolean_environment_value("VERCEL", default=False):
            self.IS_VERCEL = True
            self.VERCEL_ENV = validate_vercel_environment(
                _environment_value("VERCEL_ENV")
            )
            self.DEPLOYMENT_DATABASE_SENTINEL = (
                validate_deployment_database_sentinel(
                    _environment_value("DEPLOYMENT_DATABASE_SENTINEL"),
                    self.VERCEL_ENV,
                )
            )

            if not _environment_value("DATABASE_URL"):
                raise RuntimeError(
                    "DATABASE_URL is required for a Vercel production-mode app."
                )

            if urlsplit(self.SQLALCHEMY_DATABASE_URI).scheme != (
                "postgresql+psycopg"
            ):
                raise RuntimeError(
                    "A Vercel production-mode app requires PostgreSQL."
                )

            ssl_modes = parse_qs(
                urlsplit(self.SQLALCHEMY_DATABASE_URI).query
            ).get("sslmode", ())

            if ssl_modes and ssl_modes[-1].lower() not in {
                "require",
                "verify-ca",
                "verify-full",
            }:
                raise RuntimeError(
                    "A Vercel PostgreSQL connection requires encrypted SSL."
                )

            self.SQLALCHEMY_ENGINE_OPTIONS = {"poolclass": NullPool}

            if not ssl_modes:
                self.SQLALCHEMY_ENGINE_OPTIONS["connect_args"] = {
                    "sslmode": "require"
                }

        if not self.FRONTEND_ORIGINS:
            raise RuntimeError(
                "FRONTEND_ORIGINS must contain at least one exact origin in production."
            )

        if any(
            urlsplit(origin).scheme != "https" for origin in self.FRONTEND_ORIGINS
        ):
            raise RuntimeError(
                "Every production FRONTEND_ORIGINS value must use https."
            )

        self.SESSION_COOKIE_SECURE = True
        self.ENFORCE_ORIGIN_CHECKS = True


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(config_name=None):
    selected = (config_name or _environment_value("FLASK_ENV") or "development").lower()

    try:
        config_class = CONFIG_BY_NAME[selected]
    except KeyError as error:
        supported = ", ".join(sorted(CONFIG_BY_NAME))
        raise ValueError(
            f"Unknown Flask environment {selected!r}; expected one of: {supported}."
        ) from error

    return config_class()
