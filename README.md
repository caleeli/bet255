# bet255

## SQLite migrations

This repository includes a small migration runner to initialize and update a SQLite database.

### Initialize the database

```bash
python scripts/migrate.py init --db data/app.db
```

The command creates the SQLite file if needed, ensures the internal `schema_migrations` table exists, and applies every pending SQL file from `migrations/` in filename order.

### Check migration status

```bash
python scripts/migrate.py status --db data/app.db
```

### Add a migration

Create a new SQL file in `migrations/` using the format `<version>_<name>.sql`, for example:

```text
002_create_accounts.sql
```

Then run:

```bash
python scripts/migrate.py up --db data/app.db
```
