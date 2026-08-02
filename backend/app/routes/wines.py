from flask import Blueprint, request

from app.services.wine_service import (
    WineService,
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)
from app.utils.responses import error_response, success_response

wines_bp = Blueprint("wines", __name__)
wine_service = WineService()
MAX_SEARCH_QUERY_LENGTH = 200


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
