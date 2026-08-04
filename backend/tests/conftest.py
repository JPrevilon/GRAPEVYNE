import pytest

from app import create_app
from app.extensions import db
from app.models import User


TEST_PASSWORD = "correct-horse-battery"


@pytest.fixture
def app(tmp_path):
    database_path = tmp_path / "grapevyne-test.sqlite"
    application = create_app(
        "testing",
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "SQLALCHEMY_ENGINE_OPTIONS": {},
        },
    )

    with application.app_context():
        db.create_all()

    yield application

    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user_factory(app):
    def create_user(
        email="member@example.test",
        name="Test Member",
        password=TEST_PASSWORD,
    ):
        with app.app_context():
            user = User(name=name, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            return user.id

    return create_user


@pytest.fixture
def login_user(user_factory):
    def login(client, email="member@example.test", password=TEST_PASSWORD, **kwargs):
        user_factory(email=email, password=password, **kwargs)
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200
        return response.get_json()["data"]["user"]

    return login


def assert_error(response, status, code):
    assert response.status_code == status
    body = response.get_json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    return body["error"]


@pytest.fixture
def error_assertion():
    return assert_error
