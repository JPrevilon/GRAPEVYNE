from app.extensions import db
from app.models.mixins import TimestampMixin, serialize_datetime, utc_now


CELLAR_STATUSES = ("saved", "tasted", "wishlist", "buy_again", "archived")


class CellarEntry(TimestampMixin, db.Model):
    __tablename__ = "cellar_entries"
    __table_args__ = (
        db.UniqueConstraint("user_id", "wine_id", name="uq_cellar_entries_user_wine"),
        db.CheckConstraint(
            "(user_rating IS NULL) OR (user_rating BETWEEN 1 AND 5)",
            name="ck_cellar_entries_user_rating_range",
        ),
        db.CheckConstraint(
            "status IN ('saved', 'tasted', 'wishlist', 'buy_again', 'archived')",
            name="ck_cellar_entries_status",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wine_id = db.Column(
        db.Integer,
        db.ForeignKey("wines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_rating = db.Column(db.Integer)
    notes = db.Column(db.Text)
    favorite = db.Column(db.Boolean, nullable=False, default=False)
    tags = db.Column(db.JSON, nullable=False, default=list)
    occasion = db.Column(db.String(160))
    status = db.Column(db.String(40), nullable=False, default="saved")
    saved_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    user = db.relationship("User", back_populates="cellar_entries")
    wine = db.relationship("Wine", back_populates="cellar_entries")

    def to_dict(self, include_wine=True):
        data = {
            "id": self.id,
            "userId": self.user_id,
            "wineId": self.wine_id,
            "userRating": self.user_rating,
            "notes": self.notes,
            "favorite": self.favorite,
            "tags": self.tags,
            "occasion": self.occasion,
            "status": self.status,
            "savedAt": serialize_datetime(self.saved_at),
            "createdAt": serialize_datetime(self.created_at),
            "updatedAt": serialize_datetime(self.updated_at),
        }

        if include_wine:
            data["wine"] = self.wine.to_dict() if self.wine else None

        return data

