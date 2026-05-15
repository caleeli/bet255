#!/usr/bin/env python3
"""SQLite migration runner for initializing and updating the database."""

from __future__ import annotations

import argparse
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DEFAULT_DB_PATH = Path("data/app.db")
DEFAULT_MIGRATIONS_PATH = Path("migrations")
MIGRATIONS_TABLE = "schema_migrations"


@dataclass(frozen=True, order=True)
class Migration:
    """A SQL migration discovered on disk."""

    version: str
    name: str
    path: Path


class MigrationError(RuntimeError):
    """Raised when migrations cannot be applied safely."""


def discover_migrations(migrations_path: Path) -> list[Migration]:
    """Return SQL migrations ordered by filename."""
    if not migrations_path.exists():
        raise MigrationError(f"Migrations directory not found: {migrations_path}")

    migrations: list[Migration] = []
    seen_versions: set[str] = set()

    for path in sorted(migrations_path.glob("*.sql")):
        version, separator, name = path.stem.partition("_")
        if not separator or not version:
            raise MigrationError(
                f"Invalid migration name '{path.name}'. Use '<version>_<name>.sql'."
            )
        if version in seen_versions:
            raise MigrationError(f"Duplicate migration version found: {version}")
        seen_versions.add(version)
        migrations.append(Migration(version=version, name=name, path=path))

    return migrations


def connect(db_path: Path) -> sqlite3.Connection:
    """Open a SQLite database and ensure the parent directory exists."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def ensure_migrations_table(connection: sqlite3.Connection) -> None:
    """Create the internal migrations table if it does not exist."""
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    connection.commit()


def applied_versions(connection: sqlite3.Connection) -> set[str]:
    """Return the set of migration versions already applied."""
    ensure_migrations_table(connection)
    rows = connection.execute(f"SELECT version FROM {MIGRATIONS_TABLE}").fetchall()
    return {row["version"] for row in rows}


def sql_literal(value: str) -> str:
    """Return a safely escaped SQLite string literal."""
    return "'" + value.replace("'", "''") + "'"


def apply_migration(connection: sqlite3.Connection, migration: Migration) -> None:
    """Apply a single migration and record it atomically."""
    sql = migration.path.read_text(encoding="utf-8")
    script = f"""
BEGIN;
{sql}
INSERT INTO {MIGRATIONS_TABLE} (version, name)
VALUES ({sql_literal(migration.version)}, {sql_literal(migration.name)});
COMMIT;
"""
    try:
        connection.executescript(script)
    except sqlite3.Error as exc:
        if connection.in_transaction:
            connection.rollback()
        raise MigrationError(f"Failed to apply {migration.path.name}: {exc}") from exc


def migrate(db_path: Path, migrations_path: Path) -> list[Migration]:
    """Apply all pending migrations and return the applied migrations."""
    migrations = discover_migrations(migrations_path)
    with connect(db_path) as connection:
        applied = applied_versions(connection)
        pending = [migration for migration in migrations if migration.version not in applied]
        for migration in pending:
            apply_migration(connection, migration)
        return pending


def status(db_path: Path, migrations_path: Path) -> Iterable[tuple[Migration, bool]]:
    """Yield each discovered migration and whether it has been applied."""
    migrations = discover_migrations(migrations_path)
    with connect(db_path) as connection:
        applied = applied_versions(connection)
    for migration in migrations:
        yield migration, migration.version in applied


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Initialize or update the SQLite database with SQL migrations."
    )
    parser.add_argument(
        "command",
        choices=("init", "up", "status"),
        help="Use 'init' or 'up' to apply pending migrations, or 'status' to inspect them.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"SQLite database path (default: {DEFAULT_DB_PATH}).",
    )
    parser.add_argument(
        "--migrations",
        type=Path,
        default=DEFAULT_MIGRATIONS_PATH,
        help=f"Migrations directory (default: {DEFAULT_MIGRATIONS_PATH}).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.command in {"init", "up"}:
            applied = migrate(args.db, args.migrations)
            if not applied:
                print("No pending migrations.")
                return 0
            for migration in applied:
                print(f"Applied {migration.version}_{migration.name}")
            return 0

        for migration, is_applied in status(args.db, args.migrations):
            marker = "applied" if is_applied else "pending"
            print(f"{migration.version}_{migration.name}: {marker}")
        return 0
    except MigrationError as exc:
        print(f"Migration error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
