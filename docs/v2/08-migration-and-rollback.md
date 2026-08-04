# Prompt 08 — Migration and Rollback

## Framework and revisions

The backend uses the already pinned `Flask-Migrate==4.0.7` dependency, backed by Alembic.
Prompt 08 adds the first tracked history:

```text
0001_prompt07_baseline
└── 0002_prompt08_cellar_memories (head)
```

Revision `0001` describes the accepted User, Wine, and pre-memory CellarEntry schema.
Revision `0002` uses Alembic batch operations to add or remove the six nullable fields on
SQLite while emitting ordinary PostgreSQL-compatible `ALTER TABLE` operations for the
production target. Alembic batch mode may rebuild `cellar_entries` on SQLite; the automated
safety boundary verifies preservation of its existing rows, IDs, values, constraints, and
indexes through upgrade and rollback. Application import/startup never calls `create_all`,
`upgrade`, or custom DDL. `flask --app app init-db` is retained as an explicit convenience
command and now invokes the tracked upgrade to `head`.

No production database migration was run during Prompt 08. PostgreSQL behavior was verified
by offline upgrade/downgrade SQL generation only, not by execution against a live server.

## Before any existing-database change

1. Stop writers or enter the application's normal maintenance procedure.
2. Take and verify a database backup/snapshot.
3. Record `users`, `wines`, and `cellar_entries` row counts and the exact CellarEntry columns,
   constraints, and indexes.
4. Set the intended `DATABASE_URL` explicitly and verify it points to the exact target.
5. Never stamp a blank, partial, or schema-drifted database. A stamp records history; it does
   not create tables.

Commands below run from `backend/` with the virtual environment active.

## Fresh local database

```bash
flask --app app db upgrade --directory migrations head
flask --app app db current --directory migrations
flask --app app db check --directory migrations
```

Equivalent convenience command:

```bash
flask --app app init-db
```

The expected current revision is `0002_prompt08_cellar_memories (head)`.

## Existing local database

First inspect current state:

```bash
flask --app app db current --directory migrations
```

If a valid Alembic revision is already reported, upgrade normally:

```bash
flask --app app db upgrade --directory migrations head
flask --app app db check --directory migrations
```

For an **unversioned database confirmed to match the accepted Prompt 07 baseline exactly**,
back up first, then record the baseline and apply only the memory revision:

```bash
flask --app app db stamp --directory migrations 0001_prompt07_baseline
flask --app app db upgrade --directory migrations head
flask --app app db current --directory migrations
flask --app app db check --directory migrations
```

If the schema does not match baseline, stop and reconcile it explicitly; do not guess or
stamp over drift.

## Production deployment migration

Use the platform's protected one-off/release command with the production `DATABASE_URL`,
after backup and baseline verification. For a versioned database:

```bash
flask --app app db current --directory migrations
flask --app app db upgrade --directory migrations head
flask --app app db current --directory migrations
flask --app app db check --directory migrations
```

For a legacy unversioned production database, use the same reviewed
`stamp 0001_prompt07_baseline` step only after schema comparison and change approval. Deploying
application code does not run these commands automatically.

## Downgrade and recovery

Downgrading from Prompt 08 removes only the six memory columns:

```bash
flask --app app db downgrade --directory migrations 0001_prompt07_baseline
flask --app app db current --directory migrations
```

This preserves accepted core users, wines, cellar rows, IDs, notes, tags, ratings, statuses,
constraints, and indexes. It necessarily destroys values held in the six removed columns;
restore the verified backup if those values must be recovered. Re-upgrading recreates the
columns as nullable but cannot reconstruct their prior contents:

```bash
flask --app app db upgrade --directory migrations head
```

Downgrading below `0001` drops the accepted core schema and is outside the routine Prompt 08
rollback. Do not do that against a retained database.

## Verification performed

Isolated automated tests cover fresh history, unversioned-baseline stamp and upgrade with
row/ID/value preservation, nullability and post-upgrade writes, migrated-schema auth and API
create/read/update behavior, `flask db check`, batch downgrade with core rows still writable,
no schema mutation on ordinary startup, and offline PostgreSQL upgrade/downgrade DDL. The
ordinary application suite separately covers authenticated deletion. Disposable databases
are removed by their test fixtures.
