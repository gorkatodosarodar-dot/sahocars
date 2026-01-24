from __future__ import annotations

from pathlib import Path
from typing import Tuple

from alembic import command
from alembic.config import Config

from app.config import get_database_url


def run_migrations() -> Tuple[bool, str | None]:
    alembic_ini = Path(__file__).resolve().parents[1] / "alembic.ini"
    alembic_dir = Path(__file__).resolve().parents[1] / "alembic"

    config = Config(str(alembic_ini))
    config.set_main_option("script_location", str(alembic_dir))
    config.set_main_option("sqlalchemy.url", get_database_url())

    try:
        command.upgrade(config, "head")
    except Exception as exc:  # pragma: no cover - error path used in health
        return False, str(exc)
    return True, None
