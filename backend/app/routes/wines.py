from flask import Blueprint, request

from app.services.wine_service import WineService
from app.utils.responses import error_response, success_response

wines_bp = Blueprint("wines", __name__)
wine_service = WineService()


@wines_bp.get("/search")
def search_wines():
    query = request.args.get("query", "").strip()

    if not query:
        return error_response(
            "Search query is required.",
            status=400,
            code="missing_query",
        )

    results = wine_service.search(query)
    return success_response(results)


@wines_bp.get("/<external_wine_id>")
def get_wine_detail(external_wine_id):
    wine = wine_service.get_by_external_id(external_wine_id)

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
