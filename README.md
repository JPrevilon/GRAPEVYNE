# GrapeVyne

GrapeVyne is a premium wine discovery and personal cellar platform. Users can create an account, discover wines through a backend wine-service abstraction, save bottles to a protected personal cellar, and manage private tasting notes, ratings, occasions, and favorites.

The MVP is built as a real full-stack product, not a static demo. It demonstrates a React frontend, Flask API, PostgreSQL relational database, SQLAlchemy ORM models, authentication, protected user-owned data, related resources, and full CRUD.

## Product Overview

GrapeVyne helps users answer two practical questions:

- What wine should I choose for this meal, moment, or gift?
- Which wines have I already loved enough to remember?

The signature experience is **Open Cellar**, a premium visual interface where saved bottles are grouped into smart shelves such as Favorites, Recently Tried, Best for Steak, Best for Date Night, Rare Vintages, and Gifts / Celebrations.

## Tech Stack

- Frontend: React, Vite, React Router, Lucide icons
- Backend: Flask, Flask-CORS, Flask-SQLAlchemy, Flask-Migrate
- Database: PostgreSQL
- ORM: SQLAlchemy
- Auth: Flask signed HTTP-only session cookies
- External API strategy: backend `WineService` abstraction using mock data until a real wine API key is available

## MVP Features

- Signup, login, logout, and current-user session restore
- Protected `/cellar` and `/profile` routes
- Backend-mediated wine discovery search
- Wine detail pages
- Save discovered wines to a personal cellar
- Cached local `Wine` records created from external/mock wine data
- User-owned `CellarEntry` records
- CRUD for cellar entries:
  - create saved bottle
  - read cellar list and detail
  - update notes, rating, occasion, favorite
  - delete saved bottle
- Open Cellar visual shelves with selected-bottle detail panel
- Loading, empty, error, success, and validation states
- Toast feedback for key user actions

## Project Structure

```text
GRAPEVYNE/
  backend/
    app/
      models/      SQLAlchemy models
      routes/      Flask API blueprints
      services/    Wine and cellar service layers
      utils/       validation and response helpers
  frontend/
    src/
      api/         fetch client
      components/  layout, routing, shared UI
      features/    auth, wines, cellar
      pages/       route-level views
      styles/      global design system
  docs/
    screenshots/   presentation screenshot placeholders
```

## Database Schema

### User

Stores account identity and authentication data.

- `id`
- `name`
- `email`
- `password_hash`
- `created_at`
- `updated_at`

Relationship:

- User has many `CellarEntry` records.

### Wine

Stores cached wine metadata from the wine service layer.

- `id`
- `external_api_id`
- `source`
- `name`
- `winery`
- `varietal`
- `region`
- `country`
- `vintage`
- `description`
- `image_url`
- `average_rating`
- `price_cents`
- `created_at`
- `updated_at`

Relationship:

- Wine has many `CellarEntry` records.

Constraint:

- Unique `source + external_api_id`.

### CellarEntry

Stores private user-owned cellar data.

- `id`
- `user_id`
- `wine_id`
- `user_rating`
- `notes`
- `favorite`
- `tags`
- `occasion`
- `status`
- `saved_at`
- `created_at`
- `updated_at`

Relationships:

- CellarEntry belongs to one User.
- CellarEntry belongs to one Wine.

Ownership rule:

- Every cellar query filters by authenticated `user_id`.

## API Endpoints

### Health

```text
GET /api/health
```

### Auth

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Wines

```text
GET /api/wines/search?query=steak
GET /api/wines/:externalWineId
```

The frontend never calls an external wine API directly. It calls Flask, and Flask delegates to `WineService`.

### Cellar

```text
GET    /api/cellar
POST   /api/cellar
GET    /api/cellar/:entryId
PATCH  /api/cellar/:entryId
DELETE /api/cellar/:entryId
```

All cellar endpoints require authentication.

## Setup Instructions

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create a PostgreSQL database named `grapevyne`, or update `DATABASE_URL` in `backend/.env`.

```bash
flask --app app init-db
flask --app app seed-demo-data
flask --app app run --debug
```

Backend runs at:

```text
http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## Demo Flow

1. Open the app.
2. Create an account.
3. Search for a wine in Discover, for example `steak`, `salmon`, `gift`, or `champagne`.
4. Open a wine detail page.
5. Save the bottle to your cellar.
6. Open Cellar.
7. Select a bottle from a shelf.
8. Edit rating, occasion, notes, and favorite status.
9. Delete the bottle if needed.
10. Log out and confirm protected routes redirect to login.

## Screenshots

Add presentation screenshots here:

- `docs/screenshots/home.png`
- `docs/screenshots/discover.png`
- `docs/screenshots/wine-detail.png`
- `docs/screenshots/open-cellar.png`
- `docs/screenshots/profile.png`

## Full-Stack Rubric Signals

- React frontend: route-based UI in `frontend/src/pages`
- Flask backend: application factory in `backend/app/__init__.py`
- PostgreSQL database: configured through `DATABASE_URL`
- SQLAlchemy ORM: models in `backend/app/models`
- Authentication: session auth routes in `backend/app/routes/auth.py`
- Protected data: cellar routes require login and filter by `user_id`
- Related resources: User, Wine, CellarEntry
- CRUD: cellar create/read/update/delete endpoints and UI
- External API readiness: `WineService` can be swapped from mock data to a real wine provider
- Documentation readiness: setup, schema, API, and demo flow included

## Future Features

- Real wine API provider integration
- Advanced cellar search/filter/sort
- Pairing assistant by meal and occasion
- Taste profile analytics
- Wishlist and buy-again status
- More cinematic Open Cellar transitions
- Mobile camera label capture
- Restaurant and gift modes
- Inventory quantity tracking

