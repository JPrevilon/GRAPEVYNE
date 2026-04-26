from functools import wraps

from flask import g, session

from app.extensions import db
from app.models import User
from app.utils.responses import error_response

AUTH_SESSION_KEY = "user_id"


def get_current_user():
    user_id = session.get(AUTH_SESSION_KEY)

    if hasattr(g, "current_user") and getattr(g.current_user, "id", None) == user_id:
        return g.current_user

    if not user_id:
        g.current_user = None
        return None

    user = db.session.get(User, user_id)

    if not user:
        session.clear()

    g.current_user = user
    return user


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user = get_current_user()

        if user is None:
            return error_response(
                "Authentication is required.",
                status=401,
                code="authentication_required",
            )

        return view(*args, **kwargs)

    return wrapped_view
