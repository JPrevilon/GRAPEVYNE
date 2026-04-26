from app.extensions import db
from app.models.mixins import TimestampMixin, serialize_datetime


class Wine(TimestampMixin, db.Model):
    __tablename__ = "wines"
    __table_args__ = (
        db.UniqueConstraint(
            "source",
            "external_api_id",
            name="uq_wines_source_external_api_id",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    external_api_id = db.Column(db.String(160), index=True)
    source = db.Column(db.String(60), nullable=False, default="manual")
    name = db.Column(db.String(255), nullable=False)
    winery = db.Column(db.String(255))
    varietal = db.Column(db.String(120))
    region = db.Column(db.String(160))
    country = db.Column(db.String(120))
    vintage = db.Column(db.String(40))
    description = db.Column(db.Text)
    image_url = db.Column(db.Text)
    average_rating = db.Column(db.Numeric(3, 2))
    price_cents = db.Column(db.Integer)

    cellar_entries = db.relationship(
        "CellarEntry",
        back_populates="wine",
        lazy="selectin",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "externalApiId": self.external_api_id,
            "externalWineId": self.external_api_id,
            "source": self.source,
            "name": self.name,
            "winery": self.winery,
            "varietal": self.varietal,
            "region": self.region,
            "country": self.country,
            "vintage": self.vintage,
            "description": self.description,
            "imageUrl": self.image_url,
            "averageRating": float(self.average_rating)
            if self.average_rating is not None
            else None,
            "priceCents": self.price_cents,
            "createdAt": serialize_datetime(self.created_at),
            "updatedAt": serialize_datetime(self.updated_at),
        }
