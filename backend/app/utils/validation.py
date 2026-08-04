import re

from flask import request

from app.utils.responses import error_response

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 256
MAX_NAME_LENGTH = 120
MAX_EMAIL_LENGTH = 255


def validate_allowed_fields(payload, allowed_fields, ownership_fields=()):
    errors = {}
    allowed = set(allowed_fields)
    ownership = set(ownership_fields)

    for field in sorted(set(payload) - allowed):
        if field in ownership:
            errors[field] = "Ownership is derived from the authenticated session."
        else:
            errors[field] = "Field is not accepted."

    return errors


def get_json_payload():
    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return None, error_response(
            "Request body must be valid JSON.",
            status=400,
            code="invalid_json",
        )

    return payload, None


def normalize_email(value):
    if not isinstance(value, str):
        return ""

    return value.strip().lower()


def validate_signup_payload(payload):
    errors = validate_allowed_fields(payload, {"name", "email", "password"})
    name = payload.get("name")
    email = normalize_email(payload.get("email"))
    password = payload.get("password")

    if not isinstance(name, str) or not name.strip():
        errors["name"] = "Name is required."
    elif len(name.strip()) > MAX_NAME_LENGTH:
        errors["name"] = f"Name must be {MAX_NAME_LENGTH} characters or fewer."

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_PATTERN.match(email):
        errors["email"] = "Email must be valid."
    elif len(email) > MAX_EMAIL_LENGTH:
        errors["email"] = f"Email must be {MAX_EMAIL_LENGTH} characters or fewer."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    elif len(password) < MIN_PASSWORD_LENGTH:
        errors["password"] = (
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )
    elif len(password) > MAX_PASSWORD_LENGTH:
        errors["password"] = (
            f"Password must be {MAX_PASSWORD_LENGTH} characters or fewer."
        )

    return {
        "name": name.strip() if isinstance(name, str) else "",
        "email": email,
        "password": password if isinstance(password, str) else "",
    }, errors


def validate_login_payload(payload):
    errors = validate_allowed_fields(payload, {"email", "password"})
    email = normalize_email(payload.get("email"))
    password = payload.get("password")

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_PATTERN.match(email):
        errors["email"] = "Email must be valid."
    elif len(email) > MAX_EMAIL_LENGTH:
        errors["email"] = f"Email must be {MAX_EMAIL_LENGTH} characters or fewer."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    elif len(password) > MAX_PASSWORD_LENGTH:
        errors["password"] = (
            f"Password must be {MAX_PASSWORD_LENGTH} characters or fewer."
        )

    return {
        "email": email,
        "password": password if isinstance(password, str) else "",
    }, errors
