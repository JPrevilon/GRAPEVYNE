import re

from flask import request

from app.utils.responses import error_response

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8


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
    errors = {}
    name = payload.get("name")
    email = normalize_email(payload.get("email"))
    password = payload.get("password")

    if not isinstance(name, str) or not name.strip():
        errors["name"] = "Name is required."

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_PATTERN.match(email):
        errors["email"] = "Email must be valid."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    elif len(password) < MIN_PASSWORD_LENGTH:
        errors["password"] = (
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )

    return {
        "name": name.strip() if isinstance(name, str) else "",
        "email": email,
        "password": password if isinstance(password, str) else "",
    }, errors


def validate_login_payload(payload):
    errors = {}
    email = normalize_email(payload.get("email"))
    password = payload.get("password")

    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_PATTERN.match(email):
        errors["email"] = "Email must be valid."

    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."

    return {
        "email": email,
        "password": password if isinstance(password, str) else "",
    }, errors

