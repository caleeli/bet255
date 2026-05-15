import sqlite3
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from migrate import migrate, status


def test_init_applies_migration_once(tmp_path):
    db_path = tmp_path / "app.db"
    migrations_path = Path(__file__).resolve().parents[1] / "migrations"

    first_run = migrate(db_path, migrations_path)
    second_run = migrate(db_path, migrations_path)

    assert [migration.version for migration in first_run] == ["001"]
    assert second_run == []

    with sqlite3.connect(db_path) as connection:
        metadata_value = connection.execute(
            "SELECT value FROM app_metadata WHERE key = ?",
            ("database_initialized",),
        ).fetchone()[0]
        applied_count = connection.execute(
            "SELECT COUNT(*) FROM schema_migrations"
        ).fetchone()[0]

    assert metadata_value == "true"
    assert applied_count == 1


def test_status_reports_applied_migrations(tmp_path):
    db_path = tmp_path / "app.db"
    migrations_path = Path(__file__).resolve().parents[1] / "migrations"

    assert [(migration.version, applied) for migration, applied in status(db_path, migrations_path)] == [
        ("001", False)
    ]

    migrate(db_path, migrations_path)

    assert [(migration.version, applied) for migration, applied in status(db_path, migrations_path)] == [
        ("001", True)
    ]
