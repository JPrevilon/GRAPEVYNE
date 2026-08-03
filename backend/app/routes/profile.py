from flask import Blueprint, request

from app.auth import get_current_user, login_required
from app.services.taste_profile_service import TasteProfileService
from app.services.wine_service import (
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)
from app.utils.responses import error_response, success_response


profile_bp = Blueprint("profile", __name__)
taste_profile_service = TasteProfileService()


@profile_bp.after_request
def prevent_shared_profile_caching(response):
    response.headers["Cache-Control"] = "private, no-store"
    response.vary.add("Cookie")
    return response


@profile_bp.get("/taste")
@login_required
def get_taste_profile():
    if request.args:
        return error_response(
            "Taste Profile request validation failed.",
            status=400,
            code="validation_error",
            details={
                "parameters": "Query parameters are not accepted for this endpoint."
            },
        )

    user = get_current_user()
    try:
        profile = taste_profile_service.for_user(user.id)
    except WineServiceTimeoutError:
        return error_response(
            "The wine service timed out. Please try again.",
            status=504,
            code="wine_service_timeout",
        )
    except WineServiceUnavailableError:
        return error_response(
            "The wine service is temporarily unavailable. Please try again.",
            status=503,
            code="wine_service_unavailable",
        )

    return success_response({"profile": profile})
