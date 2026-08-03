from datetime import date
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import CellarEntry, Wine
from app.services.wine_service import WineService


class CellarService:
    manual_source_prefix = "manual:user:"

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
        wine_payload, source = self._resolve_wine_payload(user_id, payload)

        if not wine_payload:
            return None, "wine_not_found"

        wine, metadata_changed = self._find_or_create_wine(wine_payload, source)

        existing_entry = CellarEntry.query.filter_by(
            user_id=user_id,
            wine_id=wine.id,
        ).first()

        if existing_entry:
            if metadata_changed:
                db.session.commit()

            return existing_entry, "already_exists"

        wine_id = wine.id
        entry = CellarEntry(
            user_id=user_id,
            wine_id=wine_id,
            notes=self._clean_optional_string(payload.get("notes")),
            user_rating=payload.get("userRating"),
            favorite=bool(payload.get("favorite", False)),
            tags=list(payload.get("tags", [])),
            occasion=self._clean_optional_string(payload.get("occasion")),
            status=payload.get("status", "saved"),
            memory_title=self._clean_optional_string(payload.get("memoryTitle")),
            tasted_on=self._date_value(payload.get("tastedOn")),
            location=self._clean_optional_string(payload.get("location")),
            pairing=self._clean_optional_string(payload.get("pairing")),
            opened_with=self._clean_optional_string(payload.get("openedWith")),
            would_buy_again=payload.get("wouldBuyAgain"),
        )

        db.session.add(entry)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            existing_entry = CellarEntry.query.filter_by(
                user_id=user_id,
                wine_id=wine_id,
            ).first()

            if existing_entry:
                return existing_entry, "already_exists"

            raise

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

        if "tags" in payload:
            entry.tags = list(payload.get("tags", []))

        if "status" in payload:
            entry.status = payload.get("status")

        if "memoryTitle" in payload:
            entry.memory_title = self._clean_optional_string(
                payload.get("memoryTitle")
            )

        if "tastedOn" in payload:
            entry.tasted_on = self._date_value(payload.get("tastedOn"))

        if "location" in payload:
            entry.location = self._clean_optional_string(payload.get("location"))

        if "pairing" in payload:
            entry.pairing = self._clean_optional_string(payload.get("pairing"))

        if "openedWith" in payload:
            entry.opened_with = self._clean_optional_string(
                payload.get("openedWith")
            )

        if "wouldBuyAgain" in payload:
            entry.would_buy_again = payload.get("wouldBuyAgain")

        db.session.commit()
        return entry

    def delete_entry(self, entry):
        wine = entry.wine
        remove_orphaned_manual_wine = bool(
            wine
            and wine.source == self._manual_source_for_user(entry.user_id)
        )

        db.session.delete(entry)

        if remove_orphaned_manual_wine:
            db.session.flush()
            remaining_entry = CellarEntry.query.filter_by(wine_id=wine.id).first()

            if not remaining_entry:
                db.session.delete(wine)

        db.session.commit()

    def _resolve_wine_payload(self, user_id, payload):
        wine_payload = payload.get("wine")

        if isinstance(wine_payload, dict):
            external_wine_id = wine_payload.get(
                "externalWineId"
            ) or wine_payload.get("externalApiId")
        else:
            external_wine_id = payload.get("externalWineId")

        if external_wine_id:
            canonical_wine = self.wine_service.get_by_external_id(external_wine_id)

            if canonical_wine:
                return canonical_wine, self.wine_service.source

            if isinstance(wine_payload, dict):
                return wine_payload, self._manual_source_for_user(user_id)

        return None, None

    def _find_or_create_wine(self, wine_payload, source):
        external_api_id = wine_payload.get("externalWineId") or wine_payload.get(
            "externalApiId"
        )

        wine = Wine.query.filter_by(
            source=source,
            external_api_id=external_api_id,
        ).first()

        if wine:
            if source == self.wine_service.source:
                return wine, self._reconcile_wine_metadata(wine, wine_payload)

            return wine, False

        wine = Wine(
            external_api_id=external_api_id,
            source=source,
            name=wine_payload["name"],
        )
        self._reconcile_wine_metadata(wine, wine_payload)

        db.session.add(wine)

        try:
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            wine = Wine.query.filter_by(
                source=source,
                external_api_id=external_api_id,
            ).first()

            if not wine:
                raise

            if source == self.wine_service.source:
                return wine, self._reconcile_wine_metadata(wine, wine_payload)

            return wine, False

        return wine, False

    def _reconcile_wine_metadata(self, wine, wine_payload):
        average_rating = wine_payload.get("averageRating")
        wine.name = wine_payload["name"]
        wine.winery = wine_payload.get("winery")
        wine.varietal = wine_payload.get("varietal")
        wine.region = wine_payload.get("region")
        wine.country = wine_payload.get("country")
        wine.vintage = wine_payload.get("vintage")
        wine.description = wine_payload.get("description")
        wine.image_url = wine_payload.get("imageUrl")
        wine.average_rating = (
            Decimal(str(average_rating)) if average_rating is not None else None
        )
        wine.price_cents = wine_payload.get("priceCents")
        return db.session.is_modified(wine, include_collections=False)

    def _manual_source_for_user(self, user_id):
        return f"{self.manual_source_prefix}{user_id}"

    def _clean_optional_string(self, value):
        if not isinstance(value, str):
            return None

        cleaned = value.strip()
        return cleaned or None

    @staticmethod
    def _date_value(value):
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value:
            return date.fromisoformat(value)
        return None
