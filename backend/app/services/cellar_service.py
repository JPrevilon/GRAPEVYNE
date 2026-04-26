from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import CellarEntry, Wine
from app.services.wine_service import WineService


class CellarService:
    def __init__(self, wine_service=None):
        self.wine_service = wine_service or WineService()

    def list_entries_for_user(self, user_id):
        return (
            CellarEntry.query.filter_by(user_id=user_id)
            .join(Wine)
            .order_by(CellarEntry.saved_at.desc())
            .all()
        )

    def get_entry_for_user(self, user_id, entry_id):
        return CellarEntry.query.filter_by(id=entry_id, user_id=user_id).first()

    def create_entry_for_user(self, user_id, payload):
        wine_payload = self._resolve_wine_payload(payload)

        if not wine_payload:
            return None, "wine_not_found"

        wine = self._find_or_create_wine(wine_payload)

        existing_entry = CellarEntry.query.filter_by(
            user_id=user_id,
            wine_id=wine.id,
        ).first()

        if existing_entry:
            return existing_entry, "already_exists"

        entry = CellarEntry(
            user_id=user_id,
            wine_id=wine.id,
            notes=self._clean_optional_string(payload.get("notes")),
            user_rating=payload.get("userRating"),
            favorite=bool(payload.get("favorite", False)),
            occasion=self._clean_optional_string(payload.get("occasion")),
            status=payload.get("status", "saved"),
        )

        db.session.add(entry)
        db.session.commit()

        return entry, "created"

    def update_entry(self, entry, payload):
        if "notes" in payload:
            entry.notes = self._clean_optional_string(payload.get("notes"))

        if "userRating" in payload:
            entry.user_rating = payload.get("userRating")

        if "favorite" in payload:
            entry.favorite = bool(payload.get("favorite"))

        if "occasion" in payload:
            entry.occasion = self._clean_optional_string(payload.get("occasion"))

        if "status" in payload:
            entry.status = payload.get("status")

        db.session.commit()
        return entry

    def delete_entry(self, entry):
        db.session.delete(entry)
        db.session.commit()

    def _resolve_wine_payload(self, payload):
        wine_payload = payload.get("wine")

        if isinstance(wine_payload, dict):
            return wine_payload

        external_wine_id = payload.get("externalWineId")

        if external_wine_id:
            return self.wine_service.get_by_external_id(external_wine_id)

        return None

    def _find_or_create_wine(self, wine_payload):
        external_api_id = wine_payload.get("externalWineId") or wine_payload.get(
            "externalApiId"
        )
        source = wine_payload.get("source") or self.wine_service.source

        wine = Wine.query.filter_by(
            source=source,
            external_api_id=external_api_id,
        ).first()

        if wine:
            return wine

        wine = Wine(
            external_api_id=external_api_id,
            source=source,
            name=wine_payload["name"],
            winery=wine_payload.get("winery"),
            varietal=wine_payload.get("varietal"),
            region=wine_payload.get("region"),
            country=wine_payload.get("country"),
            vintage=wine_payload.get("vintage"),
            description=wine_payload.get("description"),
            image_url=wine_payload.get("imageUrl"),
            average_rating=wine_payload.get("averageRating"),
            price_cents=wine_payload.get("priceCents"),
        )

        db.session.add(wine)

        try:
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            wine = Wine.query.filter_by(
                source=source,
                external_api_id=external_api_id,
            ).first()

        return wine

    def _clean_optional_string(self, value):
        if not isinstance(value, str):
            return None

        cleaned = value.strip()
        return cleaned or None
