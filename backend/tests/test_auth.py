from app.extensions import db
from app.models import User

from conftest import TEST_PASSWORD


def signup_payload(**overrides):
    payload = {
        "email": "person@example.test",
        "name": "Person Example",
        "password": TEST_PASSWORD,
    }
    payload.update(overrides)
    return payload


def test_signup_starts_a_persistent_session_and_me_restores_it(client):
    signup = client.post(
        "/api/auth/signup",
        json=signup_payload(email="  PERSON@Example.Test ", name=" Person Example "),
    )

    assert signup.status_code == 201
    body = signup.get_json()
    assert body["message"] == "Account created."
    assert body["data"]["authenticated"] is True
    assert body["data"]["user"]["email"] == "person@example.test"
    assert body["data"]["user"]["name"] == "Person Example"
    assert "password" not in body["data"]["user"]
    assert "password_hash" not in body["data"]["user"]

    current_user = client.get("/api/auth/me")

    assert current_user.status_code == 200
    assert current_user.get_json()["data"]["user"]["id"] == body["data"]["user"]["id"]


def test_signup_duplicate_uses_conflict_envelope(client, error_assertion):
    first = client.post("/api/auth/signup", json=signup_payload())
    duplicate = client.post(
        "/api/auth/signup",
        json=signup_payload(email="PERSON@example.test"),
    )

    assert first.status_code == 201
    error_assertion(duplicate, 409, "email_already_exists")


def test_login_uses_generic_invalid_credentials_for_unknown_or_wrong_password(
    client,
    user_factory,
    error_assertion,
):
    user_factory()

    unknown = client.post(
        "/api/auth/login",
        json={"email": "unknown@example.test", "password": "wrong-password"},
    )
    wrong_password = client.post(
        "/api/auth/login",
        json={"email": "member@example.test", "password": "wrong-password"},
    )

    unknown_error = error_assertion(unknown, 401, "invalid_credentials")
    wrong_error = error_assertion(wrong_password, 401, "invalid_credentials")
    assert unknown_error["message"] == wrong_error["message"]


def test_login_logout_and_refresh_after_logout(client, user_factory, error_assertion):
    user_factory()
    login = client.post(
        "/api/auth/login",
        json={"email": "member@example.test", "password": TEST_PASSWORD},
    )
    logout = client.post("/api/auth/logout")
    current_user = client.get("/api/auth/me")

    assert login.status_code == 200
    assert logout.status_code == 200
    assert logout.get_json() == {
        "data": {"authenticated": False},
        "message": "Signed out.",
    }
    error_assertion(current_user, 401, "authentication_required")


def test_an_independent_client_does_not_share_an_authenticated_session(
    app,
    client,
    error_assertion,
):
    signup = client.post("/api/auth/signup", json=signup_payload())
    independent_client = app.test_client()

    assert signup.status_code == 201
    error_assertion(
        independent_client.get("/api/auth/me"),
        401,
        "authentication_required",
    )


def test_deleted_session_user_is_cleared(client, app, error_assertion):
    signup = client.post("/api/auth/signup", json=signup_payload())
    user_id = signup.get_json()["data"]["user"]["id"]

    with app.app_context():
        user = db.session.get(User, user_id)
        db.session.delete(user)
        db.session.commit()

    response = client.get("/api/auth/me")

    error_assertion(response, 401, "authentication_required")


def test_auth_payloads_require_json_objects_and_reject_unknown_fields(
    client,
    error_assertion,
):
    invalid_json = client.post(
        "/api/auth/signup",
        data="not-json",
        content_type="application/json",
    )
    array_json = client.post("/api/auth/signup", json=["not", "an", "object"])
    unknown_field = client.post(
        "/api/auth/signup",
        json=signup_payload(role="admin"),
    )

    error_assertion(invalid_json, 400, "invalid_json")
    error_assertion(array_json, 400, "invalid_json")
    error = error_assertion(unknown_field, 400, "validation_error")
    assert error["details"]["role"] == "Field is not accepted."


def test_auth_field_length_validation_precedes_database_errors(
    client,
    error_assertion,
):
    too_long_name = client.post(
        "/api/auth/signup",
        json=signup_payload(name="n" * 121),
    )
    too_long_email = client.post(
        "/api/auth/signup",
        json=signup_payload(email=f"{'e' * 244}@example.test"),
    )
    too_long_password = client.post(
        "/api/auth/signup",
        json=signup_payload(password="p" * 257),
    )

    assert "name" in error_assertion(
        too_long_name, 400, "validation_error"
    )["details"]
    assert "email" in error_assertion(
        too_long_email, 400, "validation_error"
    )["details"]
    assert "password" in error_assertion(
        too_long_password, 400, "validation_error"
    )["details"]
