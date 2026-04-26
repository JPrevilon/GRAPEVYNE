# GrapeVyne Backend

Flask API foundation for GrapeVyne.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask --app app init-db
flask --app app seed-demo-data
flask --app app run --debug
```

The health check is available at:

```text
GET http://localhost:5000/api/health
```

## Auth Endpoints

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Authentication uses Flask's signed, HTTP-only session cookie. Frontend requests
should include credentials.
