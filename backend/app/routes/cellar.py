import math
import re
from datetime import date

from flask import Blueprint, request

from app.auth import get_current_user, login_required
from app.models import CELLAR_STATUSES
from app.services.cellar_service import CellarService
from app.services.wine_service import (
    WineServiceTimeoutError,
    WineServiceUnavailableError,
)
from app.utils.responses import error_response, success_response
from app.utils.validation import get_json_payload, validate_allowed_fields

cellar_bp = Blueprint("cellar", __name__)
cellar_service = CellarService()

EXPECTED_USER_ID_HEADER = "X-Grapevyne-Expected-User-Id"
MAX_EXPECTED_USER_ID = 2_147_483_647
MAX_EXPECTED_USER_ID_DIGITS = len(str(MAX_EXPECTED_USER_ID))

CELLAR_MUTABLE_FIELDS = frozenset(
    {
        "favorite",
        "location",
        "memoryTitle",
        "notes",
        "occasion",
        "openedWith",
        "pairing",
        "status",
        "tags",
        "tastedOn",
        "userRating",
        "wouldBuyAgain",
    }
)
CELLAR_CREATE_FIELDS = CELLAR_MUTABLE_FIELDS | {"externalWineId", "wine"}
OWNERSHIP_FIELDS = frozenset(
    {
        "accountId",
        "account_id",
        "ownerId",
        "owner_id",
        "userId",
        "user_id",
    }
)
WINE_INPUT_FIELDS = frozenset(
    {
        "averageRating",
        "country",
        "description",
        "externalApiId",
        "externalWineId",
        "imageUrl",
        "name",
        "priceCents",
        "region",
        "source",
        "varietal",
        "vintage",
        "winery",
    }
)
WINE_STRING_LIMITS = {
    "country": 120,
    "description": 10_000,
    "externalApiId": 160,
    "externalWineId": 160,
    "imageUrl": 2_048,
    "name": 255,
    "region": 160,
    "source": 60,
    "varietal": 120,
    "vintage": 40,
    "winery": 255,
}
CELLAR_OPTIONAL_STRING_LIMITS = {
    "memoryTitle": 160,
    "location": 240,
    "pairing": 240,
    "openedWith": 240,
}
MAX_CELLAR_TAGS = 12
MAX_CELLAR_TAG_LENGTH = 40
ISO_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@cellar_bp.after_request
def prevent_shared_cellar_caching(response):
    response.headers["Cache-Control"] = "private, no-store"
    response.vary.add("Cookie")
    return response


def validate_cellar_create_payload(payload):
    errors = validate_allowed_fields(
        payload,
        CELLAR_CREATE_FIELDS,
        ownership_fields=OWNERSHIP_FIELDS,
    )
    wine_payload = payload.get("wine")
    external_wine_id = payload.get("externalWineId")

    if wine_payload is not None and not isinstance(wine_payload, dict):
        errors["wine"] = "Wine must be an object."

    if isinstance(external_wine_id, str):
        external_wine_id = external_wine_id.strip()
        payload["externalWineId"] = external_wine_id

    if external_wine_id is not None and (
        not isinstance(external_wine_id, str) or not external_wine_id
    ):
        errors["externalWineId"] = "Wine externalWineId must be non-empty text."
    elif isinstance(external_wine_id, str) and len(external_wine_id) > 160:
        errors["externalWineId"] = (
            "Wine externalWineId must be 160 characters or fewer."
        )

    if wine_payload is None and not external_wine_id:
        errors["wine"] = "Wine payload or externalWineId is required."

    if isinstance(wine_payload, dict) and external_wine_id:
        errors["wine"] = "Provide wine or externalWineId, not both."

    if isinstance(wine_payload, dict):
        _validate_wine_payload(wine_payload, errors)

    return validate_cellar_update_payload(
        payload,
        errors=errors,
        allowed_fields=CELLAR_CREATE_FIELDS,
        require_change=False,
    )


def _validate_wine_payload(wine_payload, errors):
    nested_errors = validate_allowed_fields(wine_payload, WINE_INPUT_FIELDS)

    for field, message in nested_errors.items():
        errors[f"wine.{field}"] = message

    for field, max_length in WINE_STRING_LIMITS.items():
        if field not in wine_payload or wine_payload.get(field) is None:
            continue

        value = wine_payload.get(field)

        if not isinstance(value, str):
            errors[f"wine.{field}"] = "Field must be text."
            continue

        cleaned = value.strip()
        wine_payload[field] = cleaned or None

        if len(cleaned) > max_length:
            errors[f"wine.{field}"] = (
                f"Field must be {max_length} characters or fewer."
            )

    external_wine_id = wine_payload.get("externalWineId")
    external_api_id = wine_payload.get("externalApiId")

    if external_wine_id and external_api_id and external_wine_id != external_api_id:
        errors["wine.externalWineId"] = "Wine external identifiers must match."

    if not (external_wine_id or external_api_id):
        errors["wine.externalWineId"] = "Wine externalWineId is required."

    if not wine_payload.get("name"):
        errors["wine.name"] = "Wine name is required."

    if (
        "averageRating" in wine_payload
        and wine_payload.get("averageRating") is not None
    ):
        rating = wine_payload.get("averageRating")

        if (
            isinstance(rating, bool)
            or not isinstance(rating, (int, float))
            or not math.isfinite(rating)
        ):
            errors["wine.averageRating"] = "Average rating must be a number."
        elif rating < 0 or rating > 5:
            errors["wine.averageRating"] = "Average rating must be from 0 to 5."

    if "priceCents" in wine_payload and wine_payload.get("priceCents") is not None:
        price_cents = wine_payload.get("priceCents")

        if (
            isinstance(price_cents, bool)
            or not isinstance(price_cents, int)
            or price_cents < 0
            or price_cents > 100_000_000
        ):
            errors["wine.priceCents"] = (
                "Price must be a whole number of cents from 0 to 100000000."
            )


def validate_cellar_update_payload(
    payload,
    errors=None,
    allowed_fields=CELLAR_MUTABLE_FIELDS,
    require_change=True,
):
    if errors is None:
        errors = {}

    errors.update(
        validate_allowed_fields(
            payload,
            allowed_fields,
            ownership_fields=OWNERSHIP_FIELDS,
        )
    )

    if require_change and not any(field in payload for field in CELLAR_MUTABLE_FIELDS):
        errors["payload"] = "At least one editable cellar field is required."

    if "userRating" in payload:
        rating = payload.get("userRating")

        if rating in ("", None):
            payload["userRating"] = None
        elif (
            isinstance(rating, bool)
            or not isinstance(rating, int)
            or rating < 1
            or rating > 5
        ):
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

    for field, max_length in CELLAR_OPTIONAL_STRING_LIMITS.items():
        if field not in payload or payload.get(field) is None:
            continue

        value = payload.get(field)
        if not isinstance(value, str):
            errors[field] = "Field must be text or null."
            continue

        cleaned = value.strip()
        payload[field] = cleaned or None
        if len(cleaned) > max_length:
            errors[field] = f"Field must be {max_length} characters or fewer."

    if "tastedOn" in payload:
        tasted_on = payload.get("tastedOn")
        if tasted_on in (None, ""):
            payload["tastedOn"] = None
        elif not isinstance(tasted_on, str) or not ISO_DATE_PATTERN.fullmatch(
            tasted_on
        ):
            errors["tastedOn"] = "Tasted date must use YYYY-MM-DD format."
        else:
            try:
                parsed_date = date.fromisoformat(tasted_on)
            except ValueError:
                errors["tastedOn"] = "Tasted date must be a valid calendar date."
            else:
                if parsed_date > date.today():
                    errors["tastedOn"] = "Tasted date cannot be in the future."
                else:
                    payload["tastedOn"] = parsed_date

    if "wouldBuyAgain" in payload:
        would_buy_again = payload.get("wouldBuyAgain")
        if would_buy_again is not None and not isinstance(
            would_buy_again, bool
        ):
            errors["wouldBuyAgain"] = (
                "Would buy again must be true, false, or null."
            )

    if "tags" in payload:
        tags = payload.get("tags")
        if not isinstance(tags, list):
            errors["tags"] = "Tags must be a list."
        elif len(tags) > MAX_CELLAR_TAGS:
            errors["tags"] = f"Use no more than {MAX_CELLAR_TAGS} tags."
        else:
            normalized_tags = []
            seen_tags = set()
            for index, tag in enumerate(tags):
                detail_key = f"tags[{index}]"
                if not isinstance(tag, str):
                    errors[detail_key] = "Tag must be text."
                    continue

                cleaned_tag = tag.strip()
                if not cleaned_tag:
                    errors[detail_key] = "Tag cannot be blank."
                    continue
                if len(cleaned_tag) > MAX_CELLAR_TAG_LENGTH:
                    errors[detail_key] = (
                        f"Tag must be {MAX_CELLAR_TAG_LENGTH} characters or fewer."
                    )
                    continue

                normalized_key = cleaned_tag.casefold()
                if normalized_key in seen_tags:
                    errors["tags"] = "Tags must be unique."
                    continue

                seen_tags.add(normalized_key)
                normalized_tags.append(cleaned_tag)

            if not any(key.startswith("tags") for key in errors):
                payload["tags"] = normalized_tags

    if "status" in payload and payload.get("status") not in CELLAR_STATUSES:
        errors["status"] = "Status is not supported."

    return errors


def _wine_service_failure_response(error):
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


def _expected_user_id_validation_error():
    return error_response(
        "Expected user ID must be a positive integer.",
        status=400,
        code="validation_error",
        details={
            EXPECTED_USER_ID_HEADER: "Expected user ID must be a positive integer."
        },
    )


def _expected_user_precondition(user_id):
    expected_user_id_header = request.headers.get(EXPECTED_USER_ID_HEADER)

    if expected_user_id_header is None:
        return None

    if (
        not expected_user_id_header
        or not expected_user_id_header.isascii()
        or not expected_user_id_header.isdigit()
        or len(expected_user_id_header) > MAX_EXPECTED_USER_ID_DIGITS
    ):
        return _expected_user_id_validation_error()

    expected_user_id = int(expected_user_id_header)

    if expected_user_id < 1 or expected_user_id > MAX_EXPECTED_USER_ID:
        return _expected_user_id_validation_error()

    if expected_user_id != user_id:
        return error_response(
            "The authenticated session identity changed before this request.",
            status=409,
            code="session_identity_changed",
        )

    return None


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
    precondition_error = _expected_user_precondition(user.id)

    if precondition_error:
        return precondition_error

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

    try:
        entry, result = cellar_service.create_entry_for_user(user.id, payload)
    except (WineServiceTimeoutError, WineServiceUnavailableError) as error:
        return _wine_service_failure_response(error)

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
    precondition_error = _expected_user_precondition(user.id)

    if precondition_error:
        return precondition_error

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
    precondition_error = _expected_user_precondition(user.id)

    if precondition_error:
        return precondition_error

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
