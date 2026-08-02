from urllib.parse import urlsplit

from flask import request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import normalize_origin, parse_origins
from app.utils.responses import error_response


UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
CROSS_SITE_FETCH_VALUES = frozenset({"cross-site"})


def configure_request_security(app):
    origins = parse_origins(app.config.get("FRONTEND_ORIGINS"))
    app.config["FRONTEND_ORIGINS"] = origins

    if app.config.get("ENVIRONMENT") == "production":
        if not app.config.get("SECRET_KEY"):
            raise RuntimeError("SECRET_KEY is required in production.")

        if not app.config.get("SESSION_COOKIE_SECURE"):
            raise RuntimeError("Production session cookies must use Secure=true.")

        if app.config.get("SESSION_COOKIE_SAMESITE") != "Lax":
            raise RuntimeError("Production session cookies must use SameSite=Lax.")

        if not app.config.get("SESSION_COOKIE_HTTPONLY"):
            raise RuntimeError("Production session cookies must use HttpOnly=true.")

        if app.config.get("SESSION_REFRESH_EACH_REQUEST"):
            raise RuntimeError("Production sessions must use a fixed expiry.")

        if not app.config.get("ENFORCE_ORIGIN_CHECKS"):
            raise RuntimeError("Production origin checks must remain enabled.")

        if not origins:
            raise RuntimeError(
                "Production requires at least one exact trusted frontend origin."
            )

        if any(urlsplit(origin).scheme != "https" for origin in origins):
            raise RuntimeError("Production trusted origins must use https.")

        if app.config.get("DEBUG") or app.config.get("TESTING"):
            raise RuntimeError("Production cannot run with debug or testing enabled.")

    if app.config.get("TRUST_PROXY_HEADERS"):
        app.wsgi_app = ProxyFix(
            app.wsgi_app,
            x_for=1,
            x_proto=1,
            x_host=1,
            x_port=1,
        )

    if origins:
        CORS(
            app,
            resources={r"/api/*": {"origins": list(origins)}},
            supports_credentials=True,
            send_wildcard=False,
            vary_header=True,
        )

    @app.before_request
    def enforce_trusted_browser_origin():
        if (
            not app.config.get("ENFORCE_ORIGIN_CHECKS")
            or request.method not in UNSAFE_METHODS
            or not request.path.startswith("/api/")
        ):
            return None

        fetch_site = request.headers.get("Sec-Fetch-Site", "").strip().lower()

        if fetch_site in CROSS_SITE_FETCH_VALUES:
            return _origin_rejection()

        origin_header = request.headers.get("Origin")

        if origin_header:
            try:
                request_origin = normalize_origin(origin_header)
            except ValueError:
                return _origin_rejection()

            if request_origin not in origins:
                return _origin_rejection()

        return None


def _origin_rejection():
    return error_response(
        "This request did not come from a trusted application origin.",
        status=403,
        code="csrf_origin_rejected",
    )
