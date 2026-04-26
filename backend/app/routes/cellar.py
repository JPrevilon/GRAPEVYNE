from flask import Blueprint

from app.auth import get_current_user, login_required
from app.models import CELLAR_STATUSES
from app.services.cellar_service import CellarService
from app.utils.responses import error_response, success_response
from app.utils.validation import get_json_payload

cellar_bp = Blueprint("cellar", __name__)
cellar_service = CellarService()


def validate_cellar_create_payload(payload):
    errors = {}
    wine_payload = payload.get("wine")
    external_wine_id = payload.get("externalWineId")

    if not isinstance(wine_payload, dict) and not external_wine_id:
        errors["wine"] = "Wine payload or externalWineId is required."

    if isinstance(wine_payload, dict):
        external_id = wine_payload.get("externalWineId") or wine_payload.get(
            "externalApiId"
        )

        if not external_id:
            errors["externalWineId"] = "Wine externalWineId is required."

        if not wine_payload.get("name"):
            errors["name"] = "Wine name is required."

    validate_cellar_update_payload(payload, errors)
    return errors


def validate_cellar_update_payload(payload, errors=None):
    errors = errors or {}

    if "userRating" in payload:
        rating = payload.get("userRating")

        if rating in ("", None):
            payload["userRating"] = None
        elif not isinstance(rating, int) or rating < 1 or rating > 5:
            errors["userRating"] = "Rating must be a whole number from 1 to 5."

    if "favorite" in payload and not isinstance(payload.get("favorite"), bool):
        errors["favorite"] = "Favorite must be true or false."

    if "notes" in payload and payload.get("notes") is not None:
        notes = payload.get("notes")

        if not isinstance(notes, str):
            errors["notes"] = "Notes must be text."
        elif len(notes) > 4000:
            errors["notes"] = "Notes must be 4000 characters or fewer."

    if "occasion" in payload and payload.get("occasion") is not None:
        occasion = payload.get("occasion")

        if not isinstance(occasion, str):
            errors["occasion"] = "Occasion must be text."
        elif len(occasion) > 160:
            errors["occasion"] = "Occasion must be 160 characters or fewer."

    if "status" in payload and payload.get("status") not in CELLAR_STATUSES:
        errors["status"] = "Status is not supported."

    return errors


@cellar_bp.get("")
@login_required
def list_cellar_entries():
    user = get_current_user()
    entries = cellar_service.list_entries_for_user(user.id)

    return success_response(
        {
            "entries": [entry.to_dict() for entry in entries],
            "count": len(entries),
        }
    )


@cellar_bp.post("")
@login_required
def create_cellar_entry():
    user = get_current_user()
    payload, payload_error = get_json_payload()

    if payload_error:
        return payload_error

    errors = validate_cellar_create_payload(payload)

    if errors:
        return error_response(
            "Cellar entry validation failed.",
            status=400,
            code="validation_error",
            details=errors,
        )

    entry, result = cellar_service.create_entry_for_user(user.id, payload)

    if result == "wine_not_found":
        return error_response(
            "Wine was not found.",
            status=404,
            code="wine_not_found",
        )

    if result == "already_exists":
        return error_response(
            "This wine is already in your cellar.",
            status=409,
            code="cellar_entry_exists",
            details={"entry": entry.to_dict()},
        )

    return success_response(
        {"entry": entry.to_dict()},
        message="Wine saved to cellar.",
        status=201,
    )


@cellar_bp.get("/<int:entry_id>")
@login_required
def get_cellar_entry(entry_id):
    user = get_current_user()
    entry = cellar_service.get_entry_for_user(user.id, entry_id)

    if not entry:
        return error_response(
            "Cellar entry was not found.",
            status=404,
            code="cellar_entry_not_found",
        )

    return success_response({"entry": entry.to_dict()})


@cellar_bp.patch("/<int:entry_id>")
@login_required
def update_cellar_entry(entry_id):
    user = get_current_user()
    entry = cellar_service.get_entry_for_user(user.id, entry_id)

    if not entry:
        return error_response(
            "Cellar entry was not found.",
            status=404,
            code="cellar_entry_not_found",
        )

    payload, payload_error = get_json_payload()

    if payload_error:
        return payload_error

    errors = validate_cellar_update_payload(payload)

    if errors:
        return error_response(
            "Cellar entry validation failed.",
            status=400,
            code="validation_error",
            details=errors,
        )

    updated_entry = cellar_service.update_entry(entry, payload)

    return success_response(
        {"entry": updated_entry.to_dict()},
        message="Cellar entry updated.",
    )


@cellar_bp.delete("/<int:entry_id>")
@login_required
def delete_cellar_entry(entry_id):
    user = get_current_user()
    entry = cellar_service.get_entry_for_user(user.id, entry_id)

    if not entry:
        return error_response(
            "Cellar entry was not found.",
            status=404,
            code="cellar_entry_not_found",
        )

    cellar_service.delete_entry(entry)

    return success_response(
        {"deletedId": entry_id},
        message="Cellar entry deleted.",
    )
