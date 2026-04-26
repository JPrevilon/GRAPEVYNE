from flask import Blueprint, g, session
from sqlalchemy.exc import IntegrityError

from app.auth import AUTH_SESSION_KEY, get_current_user, login_required
from app.extensions import db
from app.models import User
from app.utils.responses import error_response, success_response
from app.utils.validation import (
    get_json_payload,
    validate_login_payload,
    validate_signup_payload,
)

auth_bp = Blueprint("auth", __name__)


def _start_user_session(user):
    session.clear()
    session.permanent = True
    session[AUTH_SESSION_KEY] = user.id


@auth_bp.post("/signup")
def signup():
    payload, payload_error = get_json_payload()

    if payload_error:
        return payload_error

    data, errors = validate_signup_payload(payload)

    if errors:
        return error_response(
            "Signup validation failed.",
            status=400,
            code="validation_error",
            details=errors,
        )

    existing_user = User.query.filter_by(email=data["email"]).first()

    if existing_user:
        return error_response(
            "An account with this email already exists.",
            status=409,
            code="email_already_exists",
        )

    user = User(name=data["name"], email=data["email"])
    user.set_password(data["password"])
    db.session.add(user)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response(
            "An account with this email already exists.",
            status=409,
            code="email_already_exists",
        )

    _start_user_session(user)

    return success_response(
        {"user": user.to_dict(), "authenticated": True},
        message="Account created.",
        status=201,
    )


@auth_bp.post("/login")
def login():
    payload, payload_error = get_json_payload()

    if payload_error:
        return payload_error

    data, errors = validate_login_payload(payload)

    if errors:
        return error_response(
            "Login validation failed.",
            status=400,
            code="validation_error",
            details=errors,
        )

    user = User.query.filter_by(email=data["email"]).first()

    if not user or not user.check_password(data["password"]):
        return error_response(
            "Invalid email or password.",
            status=401,
            code="invalid_credentials",
        )

    _start_user_session(user)

    return success_response(
        {"user": user.to_dict(), "authenticated": True},
        message="Signed in.",
    )


@auth_bp.post("/logout")
def logout():
    session.clear()
    g.current_user = None

    return success_response(
        {"authenticated": False},
        message="Signed out.",
    )


@auth_bp.get("/me")
@login_required
def me():
    user = get_current_user()

    return success_response(
        {"user": user.to_dict(), "authenticated": True},
    )
