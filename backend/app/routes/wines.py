import unicodedata

from flask import Blueprint, after_this_request, request

from app.auth import get_current_user
from app.services.recommendation_service import RecommendationService
from app.services.wine_service import (
    WineService,
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)
from app.utils.responses import error_response, success_response

wines_bp = Blueprint("wines", __name__)
wine_service = WineService()
recommendation_service = RecommendationService(wine_service=wine_service)
MAX_SEARCH_QUERY_LENGTH = 200
MIN_RECOMMENDATION_QUERY_LENGTH = 2
MAX_RECOMMENDATION_QUERY_LENGTH = 300
MIN_RECOMMENDATION_LIMIT = 1
MAX_RECOMMENDATION_LIMIT = 12
DEFAULT_RECOMMENDATION_LIMIT = 6
RECOMMENDATION_QUERY_ARGUMENTS = frozenset({"query", "limit"})


def _wine_service_error_response(error):
    if isinstance(error, WineServiceTimeoutError):
        return error_response(
            "The wine service timed out. Please try again.",
            status=504,
            code="wine_service_timeout",
        )

    return error_response(
        "The wine service is temporarily unavailable. Please try again.",
        status=503,
        code="wine_service_unavailable",
    )


@wines_bp.get("/search")
def search_wines():
    query = request.args.get("query", "").strip()

    if not query:
        return error_response(
            "Search query is required.",
            status=400,
            code="missing_query",
        )

    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        return error_response(
            f"Search query must be {MAX_SEARCH_QUERY_LENGTH} characters or fewer.",
            status=400,
            code="validation_error",
            details={
                "query": (
                    "Search query must be "
                    f"{MAX_SEARCH_QUERY_LENGTH} characters or fewer."
                )
            },
        )

    try:
        results = wine_service.search(query)
    except (WineServiceTimeoutError, WineServiceUnavailableError) as error:
        return _wine_service_error_response(error)

    return success_response(results)


@wines_bp.get("/recommendations")
def get_wine_recommendations():
    @after_this_request
    def prevent_shared_recommendation_caching(response):
        response.headers["Cache-Control"] = "private, no-store"
        response.vary.add("Cookie")
        return response

    unknown_arguments = sorted(
        set(request.args.keys()) - RECOMMENDATION_QUERY_ARGUMENTS
    )
    repeated_arguments = sorted(
        key
        for key in RECOMMENDATION_QUERY_ARGUMENTS
        if len(request.args.getlist(key)) > 1
    )
    if unknown_arguments or repeated_arguments:
        details = {}
        if unknown_arguments:
            details["parameters"] = (
                "Unsupported query parameters are not accepted."
            )
        if repeated_arguments:
            details["duplicates"] = (
                "Query parameters may be provided once: "
                + ", ".join(repeated_arguments)
                + "."
            )
        return error_response(
            "Recommendation request validation failed.",
            status=400,
            code="validation_error",
            details=details,
        )

    query = request.args.get("query", "").strip()
    if not query:
        return error_response(
            "Recommendation query is required.",
            status=400,
            code="missing_query",
        )
    if len(query) < MIN_RECOMMENDATION_QUERY_LENGTH:
        return error_response(
            "Recommendation query must be at least 2 characters.",
            status=400,
            code="validation_error",
            details={"query": "Recommendation query must be at least 2 characters."},
        )
    if len(query) > MAX_RECOMMENDATION_QUERY_LENGTH:
        return error_response(
            "Recommendation query must be 300 characters or fewer.",
            status=400,
            code="validation_error",
            details={"query": "Recommendation query must be 300 characters or fewer."},
        )
    if (
        "<" in query
        or ">" in query
        or any(
            unicodedata.category(character) in {"Cc", "Cf", "Cs"}
            for character in query
        )
    ):
        return error_response(
            "Recommendation query cannot contain markup or control characters.",
            status=400,
            code="validation_error",
            details={
                "query": "Recommendation query cannot contain markup or control characters."
            },
        )

    limit_value = request.args.get("limit", str(DEFAULT_RECOMMENDATION_LIMIT))
    if (
        not limit_value
        or len(limit_value) > 2
        or not limit_value.isascii()
        or not limit_value.isdigit()
    ):
        return error_response(
            "Recommendation limit must be an integer from 1 to 12.",
            status=400,
            code="validation_error",
            details={"limit": "Recommendation limit must be an integer from 1 to 12."},
        )
    limit = int(limit_value)
    if limit < MIN_RECOMMENDATION_LIMIT or limit > MAX_RECOMMENDATION_LIMIT:
        return error_response(
            "Recommendation limit must be an integer from 1 to 12.",
            status=400,
            code="validation_error",
            details={"limit": "Recommendation limit must be an integer from 1 to 12."},
        )

    user = get_current_user()
    try:
        results = recommendation_service.recommend(
            query,
            limit,
            user_id=user.id if user else None,
        )
    except (WineServiceTimeoutError, WineServiceUnavailableError) as error:
        return _wine_service_error_response(error)

    return success_response(results)


@wines_bp.get("/<path:external_wine_id>")
def get_wine_detail(external_wine_id):
    try:
        wine = wine_service.get_by_external_id(external_wine_id)
    except (WineServiceTimeoutError, WineServiceUnavailableError) as error:
        return _wine_service_error_response(error)

    if not wine:
        return error_response(
            "Wine was not found.",
            status=404,
            code="wine_not_found",
        )

    return success_response(
        {
            "wine": wine,
            "source": wine_service.source,
        }
    )
